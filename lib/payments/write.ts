import { sql, type SQL } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { SETTLED_TOLERANCE } from "./settlement";

type Db = ReturnType<typeof getDb>;

// Every write here is one SQL statement: the payment changes and the invoice
// it settles is brought in step in the same statement, so there's never a
// payment without its invoice's status, or the other way round. The invoice
// becomes 'paid' (paid_at = the latest payment's day) once its payments cover
// the total within half a cent, and goes back to 'sent' otherwise. A
// cancelled invoice is left alone. Ownership is checked in the statement
// itself: a payment, invoice or client that isn't the user's matches nothing.
//
// In a statement with data-modifying CTEs every part sees the table as it was
// before the statement, so the totals below take the payments as they were
// and add (or leave out) the row being written.

export type PaymentFields = {
  receivedOn: string;
  currency: string;
  amount: number;
  fees: number;
  taxWithheld: number;
  rateToMKD: number;
  rateSource: "nbrsm" | "manual" | "invoice";
  deemedCostsRate: number;
  channel: string | null;
  note: string | null;
};

// "settle as (...)": brings the invoice in `totals` (invoice_id, settled,
// last_received) in step.
const SETTLE = (tolerance: number) => sql`
  settle as (
    update invoices as i set
      status = case
        when totals.settled > 0 and totals.settled >= i.total - ${tolerance}::double precision then 'paid'
        else 'sent' end,
      paid_at = case
        when totals.settled > 0 and totals.settled >= i.total - ${tolerance}::double precision then totals.last_received
        else null end
    from totals
    where i.id = totals.invoice_id and i.status <> 'cancelled'
    returning i.id
  )`;

function values(id: string, userId: string, f: PaymentFields) {
  return {
    id,
    userId,
    receivedOn: f.receivedOn,
    amount: sql`${f.amount}::double precision`,
    fees: sql`${f.fees}::double precision`,
    taxWithheld: sql`${f.taxWithheld}::double precision`,
    rate: sql`${f.rateToMKD}::double precision`,
    deemed: sql`${f.deemedCostsRate}::double precision`,
  };
}

async function count(db: Db, query: SQL): Promise<number> {
  const result = await db.execute<{ n: number }>(query);
  return Number(result.rows[0]?.n ?? 0);
}

// A payment against one of the user's issued invoices, in that invoice's
// currency and for its client. Returns false (and writes nothing) when the
// invoice isn't the user's, isn't issued (a draft or cancelled), or is in
// another currency.
export async function insertInvoicePayment(
  db: Db,
  p: { id: string; userId: string; invoiceId: string; taxTreatment: string; ujpStatus: string | null } & PaymentFields
): Promise<boolean> {
  const v = values(p.id, p.userId, p);
  return (
    (await count(
      db,
      sql`
        with target as (
          select i.id, i.client_id, i.currency from invoices as i
          where i.id = ${p.invoiceId} and i.user_id = ${p.userId}
            and i.number is not null and i.status in ('sent', 'paid', 'overdue')
        ), ins as (
          insert into payments (id, user_id, client_id, invoice_id, received_on, currency, amount, fees,
            tax_withheld, rate_to_mkd, rate_source, tax_treatment, deemed_costs_rate, channel, note, ujp_status)
          select ${v.id}, ${v.userId}, target.client_id, target.id, ${v.receivedOn}, target.currency,
            ${v.amount}, ${v.fees}, ${v.taxWithheld}, ${v.rate}, ${p.rateSource}, ${p.taxTreatment},
            ${v.deemed}, ${p.channel}, ${p.note}, ${p.ujpStatus}
          from target where target.currency = ${p.currency}
          returning invoice_id, amount + fees + tax_withheld as part, received_on
        ), totals as (
          select ins.invoice_id,
            coalesce((select sum(q.amount + q.fees + q.tax_withheld) from payments as q
                      where q.invoice_id = ins.invoice_id), 0) + ins.part as settled,
            greatest(coalesce((select max(q.received_on) from payments as q
                               where q.invoice_id = ins.invoice_id), ''), ins.received_on) as last_received
          from ins
        ), ${SETTLE(SETTLED_TOLERANCE)}
        select (select count(*) from ins)::int as n
      `
    )) > 0
  );
}

// A payout without an invoice (a platform, a one-off job) from one of the
// user's clients. Returns false when the client isn't the user's.
export async function insertPayout(
  db: Db,
  p: { id: string; userId: string; clientId: string; taxTreatment: string; ujpStatus: string | null } & PaymentFields
): Promise<boolean> {
  const v = values(p.id, p.userId, p);
  return (
    (await count(
      db,
      sql`
        with owner as (
          select c.id from clients as c where c.id = ${p.clientId} and c.user_id = ${p.userId}
        ), ins as (
          insert into payments (id, user_id, client_id, invoice_id, received_on, currency, amount, fees,
            tax_withheld, rate_to_mkd, rate_source, tax_treatment, deemed_costs_rate, channel, note, ujp_status)
          select ${v.id}, ${v.userId}, owner.id, null, ${v.receivedOn}, ${p.currency},
            ${v.amount}, ${v.fees}, ${v.taxWithheld}, ${v.rate}, ${p.rateSource}, ${p.taxTreatment},
            ${v.deemed}, ${p.channel}, ${p.note}, ${p.ujpStatus}
          from owner
          returning id
        )
        select (select count(*) from ins)::int as n
      `
    )) > 0
  );
}

// Changes one of the user's payments. The payer, the invoice and the tax
// treatment stay as they were, and so does the currency of a payment against
// an invoice. Returns false when the payment isn't the user's.
export async function updatePayment(
  db: Db,
  p: { id: string; userId: string } & PaymentFields
): Promise<boolean> {
  const v = values(p.id, p.userId, p);
  return (
    (await count(
      db,
      sql`
        with upd as (
          update payments as p set
            received_on = ${v.receivedOn},
            currency = case when p.invoice_id is null then ${p.currency} else p.currency end,
            amount = ${v.amount}, fees = ${v.fees}, tax_withheld = ${v.taxWithheld},
            rate_to_mkd = ${v.rate}, rate_source = ${p.rateSource}, deemed_costs_rate = ${v.deemed},
            channel = ${p.channel}, note = ${p.note}
          where p.id = ${p.id} and p.user_id = ${p.userId}
          returning p.invoice_id, p.amount + p.fees + p.tax_withheld as part, p.received_on
        ), totals as (
          select upd.invoice_id,
            coalesce((select sum(q.amount + q.fees + q.tax_withheld) from payments as q
                      where q.invoice_id = upd.invoice_id and q.id <> ${p.id}), 0) + upd.part as settled,
            greatest(coalesce((select max(q.received_on) from payments as q
                               where q.invoice_id = upd.invoice_id and q.id <> ${p.id}), ''), upd.received_on) as last_received
          from upd where upd.invoice_id is not null
        ), ${SETTLE(SETTLED_TOLERANCE)}
        select (select count(*) from upd)::int as n
      `
    )) > 0
  );
}

// Deletes one of the user's payments; its invoice goes back to 'sent' if the
// rest no longer cover it. Returns false when the payment isn't the user's.
export async function deletePayment(db: Db, id: string, userId: string): Promise<boolean> {
  return (
    (await count(
      db,
      sql`
        with del as (
          delete from payments as p where p.id = ${id} and p.user_id = ${userId}
          returning p.invoice_id
        ), totals as (
          select del.invoice_id,
            coalesce((select sum(q.amount + q.fees + q.tax_withheld) from payments as q
                      where q.invoice_id = del.invoice_id and q.id <> ${id}), 0) as settled,
            (select max(q.received_on) from payments as q
             where q.invoice_id = del.invoice_id and q.id <> ${id}) as last_received
          from del where del.invoice_id is not null
        ), ${SETTLE(SETTLED_TOLERANCE)}
        select (select count(*) from del)::int as n
      `
    )) > 0
  );
}

// The month's self-reported payments ("YYYY-MM") move one step on UJP's way.
// Filing only moves what's still to file; approving moves anything not yet
// approved or paid; paying moves everything not paid. A calculation number,
// folio number or payment date is recorded when given. Returns how many
// payments changed.
export async function markMonth(
  db: Db,
  userId: string,
  month: string,
  step:
    | { to: "filed"; reference: string | null }
    | { to: "approved"; folio: string | null }
    | { to: "paid"; paidOn: string }
): Promise<number> {
  const inMonth = sql`user_id = ${userId} and tax_treatment = 'self_reported'
    and received_on >= ${`${month}-01`} and received_on <= ${`${month}-31`}`;
  const query =
    step.to === "filed"
      ? sql`with upd as (
          update payments set ujp_status = 'filed',
            ujp_reference = coalesce(${step.reference}, ujp_reference)
          where ${inMonth} and ujp_status = 'to_file' returning id)
        select count(*)::int as n from upd`
      : step.to === "approved"
      ? sql`with upd as (
          update payments set ujp_status = 'approved',
            ujp_folio = coalesce(${step.folio}, ujp_folio)
          where ${inMonth} and ujp_status in ('to_file', 'filed') returning id)
        select count(*)::int as n from upd`
      : sql`with upd as (
          update payments set ujp_status = 'paid', tax_paid_on = ${step.paidOn}
          where ${inMonth} and ujp_status is distinct from 'paid' returning id)
        select count(*)::int as n from upd`;
  return count(db, query);
}

// Replaces the rate of payments that took their invoice's rate (backfilled)
// with the National Bank's for their day. `rates` maps payment id -> rate.
export async function applyNbrsmRates(
  db: Db,
  userId: string,
  rates: ReadonlyMap<string, number>
): Promise<number> {
  if (rates.size === 0) return 0;
  const rows = sql.join(
    [...rates].map(([id, rate]) => sql`(${id}, ${rate}::double precision)`),
    sql`, `
  );
  return count(
    db,
    sql`with upd as (
      update payments as p set rate_to_mkd = v.rate, rate_source = 'nbrsm'
      from (values ${rows}) as v (id, rate)
      where p.id = v.id and p.user_id = ${userId} and p.rate_source = 'invoice'
      returning p.id)
    select count(*)::int as n from upd`
  );
}
