import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { addDays, daysBetween } from "@/lib/tax/calculator";
import type { DraftLineItem, DraftValues } from "./drafts";

type Db = ReturnType<typeof getDb>;

// A duplicate's due date keeps the source's payment term (due date less
// invoice date, in days) from `today`; no due date if the source had none.
export function duplicateDueDate(
  source: { date: string; dueDate: string | null },
  today: string
): string | null {
  if (!source.dueDate) return null;
  return addDays(today, Math.max(0, daysBetween(source.date, source.dueDate)));
}

// Writes a duplicate of one of the user's invoices as a new draft, with its
// line items, in one statement: nothing is written unless the source is the
// user's. The client and notes are copied from the source row itself; the
// amounts, dates and rate come from the caller (which applies today's date
// and the user's VAT registration). Returns false when the source isn't the
// user's.
export async function insertDuplicateDraft(
  db: Db,
  d: {
    id: string;
    userId: string;
    sourceId: string;
    values: Omit<DraftValues, "clientId" | "notes">;
    items: readonly (DraftLineItem & { id: string })[];
  }
): Promise<boolean> {
  const v = d.values;
  const rows = sql.join(
    d.items.map(
      (item) =>
        sql`(${item.id}, ${item.description}, ${item.quantity}::double precision, ${item.unitPrice}::double precision, ${item.quantity * item.unitPrice}::double precision)`
    ),
    sql`, `
  );
  const result = await db.execute<{ n: number }>(sql`
    with source as (
      select id, client_id, notes from invoices
      where id = ${d.sourceId} and user_id = ${d.userId}
    ), ins as (
      insert into invoices (id, user_id, client_id, number, date, supply_date, due_date, currency,
        exchange_rate_mkd, rate_source, rate_date, subtotal, ddv_rate, ddv_amount, total, total_mkd,
        status, notes)
      select ${d.id}, ${d.userId}, source.client_id, null, ${v.date}, ${v.supplyDate ?? v.date},
        ${v.dueDate ?? null}, ${v.currency}, ${v.exchangeRateMKD}::double precision, ${v.rateSource ?? null},
        ${v.rateDate ?? null}, ${v.subtotal}::double precision, ${v.ddvRate}::double precision,
        ${v.ddvAmount}::double precision, ${v.total}::double precision, ${v.totalMKD}::double precision,
        'draft', source.notes
      from source
      returning id
    ), items as (
      insert into invoice_items (id, invoice_id, description, quantity, unit_price, total)
      select item.id, ins.id, item.description, item.quantity, item.unit_price, item.total
      from ins, (values ${rows}) as item (id, description, quantity, unit_price, total)
      returning id
    )
    select (select count(*) from ins)::int as n
  `);
  return Number(result.rows[0]?.n ?? 0) > 0;
}
