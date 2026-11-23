import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { SETTLED_TOLERANCE } from "@/lib/payments/settlement";
import { SETTLE } from "@/lib/payments/write";

type Db = ReturnType<typeof getDb>;

// Postgres unique_violation, on the error or (wrapped by Drizzle) its cause.
function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return [error, cause].some(
    (e) => typeof e === "object" && e !== null && "code" in e && e.code === "23505"
  );
}

// Creates a credit note on one of the user's issued, not cancelled invoices,
// in one statement: the number (CN-YYYY-NNN, one more than the user's
// highest for the credit note's year), the DDV part in the invoice's
// proportion, the invoice's rate, a check that the amount fits within the
// total less earlier credit notes, and the invoice's status brought in step
// with its payments. If two credit notes for the same user and year race,
// the unique index on (user_id, number) rejects the second, which tries
// again. Returns the number, or null when nothing was written (not the
// user's, not issued, cancelled, or more than what's left to credit).
export async function insertCreditNote(
  db: Db,
  c: { id: string; userId: string; invoiceId: string; date: string; amount: number; reason: string }
): Promise<string | null> {
  const year = c.date.slice(0, 4);
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await db.execute<{ number: string | null }>(sql`
        with target as (
          select i.id, i.total, i.ddv_rate, i.exchange_rate_mkd,
            coalesce((select sum(cn.amount) from credit_notes as cn where cn.invoice_id = i.id), 0) as credited
          from invoices as i
          where i.id = ${c.invoiceId} and i.user_id = ${c.userId}
            and i.number is not null and i.status in ('sent', 'paid', 'overdue')
        ), next as (
          select coalesce(max(substring(o.number from '^CN-[0-9]{4}-([0-9]+)$')::bigint), 0) + 1 as n
          from credit_notes as o
          where o.user_id = ${c.userId} and o.number like ${`CN-${year}-%`}
        ), ins as (
          insert into credit_notes (id, user_id, invoice_id, number, date, amount, ddv_amount, reason, rate_to_mkd)
          select ${c.id}, ${c.userId}, target.id,
            ${`CN-${year}-`} || lpad(next.n::text, greatest(3, length(next.n::text)), '0'),
            ${c.date}, ${c.amount}::double precision,
            case when target.ddv_rate > 0
              then round((${c.amount}::double precision * target.ddv_rate / (1 + target.ddv_rate))::numeric, 2)::double precision
              else 0 end,
            ${c.reason}, target.exchange_rate_mkd
          from target, next
          where ${c.amount}::double precision <= target.total - target.credited + ${SETTLED_TOLERANCE}::double precision
          returning invoice_id, number, amount
        ), totals as (
          select ins.invoice_id,
            coalesce((select sum(q.amount + q.fees + q.tax_withheld) from payments as q
                      where q.invoice_id = ins.invoice_id), 0) as settled,
            (select max(q.received_on) from payments as q where q.invoice_id = ins.invoice_id) as last_received,
            target.credited + ins.amount as credited
          from ins, target
        ), ${SETTLE(SETTLED_TOLERANCE)}
        select (select number from ins) as number
      `);
      return result.rows[0]?.number ?? null;
    } catch (error) {
      if (attempt < 3 && isUniqueViolation(error)) continue;
      throw error;
    }
  }
}

// Deletes one of the user's credit notes, but only their most recent one, so
// the numbers stay without gaps, and brings its invoice's status back in
// step. Returns false when nothing was deleted.
export async function deleteLatestCreditNote(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.execute<{ n: number }>(sql`
    with target as (
      select cn.id, cn.invoice_id, cn.amount from credit_notes as cn
      where cn.id = ${id} and cn.user_id = ${userId}
        and not exists (
          select 1 from credit_notes as later
          where later.user_id = cn.user_id
            and (later.created_at > cn.created_at or (later.created_at = cn.created_at and later.id > cn.id))
        )
    ), del as (
      delete from credit_notes where id in (select id from target)
      returning invoice_id, amount
    ), totals as (
      select del.invoice_id,
        coalesce((select sum(q.amount + q.fees + q.tax_withheld) from payments as q
                  where q.invoice_id = del.invoice_id), 0) as settled,
        (select max(q.received_on) from payments as q where q.invoice_id = del.invoice_id) as last_received,
        coalesce((select sum(cn.amount) from credit_notes as cn where cn.invoice_id = del.invoice_id), 0)
          - del.amount as credited
      from del
    ), ${SETTLE(SETTLED_TOLERANCE)}
    select (select count(*) from del)::int as n
  `);
  return Number(result.rows[0]?.n ?? 0) > 0;
}
