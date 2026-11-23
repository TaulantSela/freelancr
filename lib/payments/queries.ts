import { and, desc, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { getDb, payments, clients, invoices } from "@/lib/db";

// A payment as the pages and the tax maths read it.
const paymentColumns = {
  id: payments.id,
  receivedOn: payments.receivedOn,
  currency: payments.currency,
  amount: payments.amount,
  fees: payments.fees,
  taxWithheld: payments.taxWithheld,
  rateToMKD: payments.rateToMKD,
  rateSource: payments.rateSource,
  taxTreatment: payments.taxTreatment,
  deemedCostsRate: payments.deemedCostsRate,
  channel: payments.channel,
  note: payments.note,
  ujpStatus: payments.ujpStatus,
  ujpReference: payments.ujpReference,
  ujpFolio: payments.ujpFolio,
  taxPaidOn: payments.taxPaidOn,
  invoiceId: payments.invoiceId,
  invoiceNumber: invoices.number,
  clientId: payments.clientId,
  clientName: clients.name,
  clientCountry: clients.country,
  clientType: clients.clientType,
};

export type PaymentRow = Awaited<ReturnType<typeof getPaymentsReceived>>[number];

// The user's payments received from `from` to `to` ("YYYY-MM-DD", inclusive),
// newest first, plus self-reported ones from earlier that aren't marked paid
// with UJP yet (they're still owed, whatever their month).
export async function getPaymentsReceived(
  userId: string,
  from: string,
  to: string,
  { includeOlderUnpaid = false } = {}
) {
  const inRange = and(gte(payments.receivedOn, from), lte(payments.receivedOn, to));
  return getDb()
    .select(paymentColumns)
    .from(payments)
    .innerJoin(clients, eq(payments.clientId, clients.id))
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(
      and(
        eq(payments.userId, userId),
        includeOlderUnpaid
          ? or(
              inRange,
              and(
                eq(payments.taxTreatment, "self_reported"),
                sql`${payments.ujpStatus} is distinct from 'paid'`,
                lte(payments.receivedOn, to)
              )
            )
          : inRange
      )
    )
    .orderBy(desc(payments.receivedOn), desc(payments.createdAt));
}

// The years the user has payments in, newest first (for the year switcher).
export async function getPaymentYears(userId: string): Promise<number[]> {
  const rows = await getDb()
    .selectDistinct({ year: sql<string>`substr(${payments.receivedOn}, 1, 4)` })
    .from(payments)
    .where(eq(payments.userId, userId));
  return rows.map((r) => Number(r.year)).sort((a, b) => b - a);
}

export async function getPayment(id: string, userId: string) {
  const [row] = await getDb()
    .select(paymentColumns)
    .from(payments)
    .innerJoin(clients, eq(payments.clientId, clients.id))
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(payments.id, id), eq(payments.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getInvoicePayments(invoiceId: string, userId: string) {
  return getDb()
    .select(paymentColumns)
    .from(payments)
    .innerJoin(clients, eq(payments.clientId, clients.id))
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.userId, userId)))
    .orderBy(payments.receivedOn, payments.createdAt);
}

// invoice id -> what its payments cover (credited + fees + withheld), for the
// user's invoices that have payments.
export async function getSettledByInvoice(userId: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({
      invoiceId: payments.invoiceId,
      settled: sql<number>`sum(${payments.amount} + ${payments.fees} + ${payments.taxWithheld})`,
    })
    .from(payments)
    .where(and(eq(payments.userId, userId), isNotNull(payments.invoiceId)))
    .groupBy(payments.invoiceId);
  return new Map(rows.map((r) => [r.invoiceId as string, Number(r.settled)]));
}

// The user's issued invoices a payment can go against (not drafts, not
// cancelled), with what's settled so far, newest first.
export async function getPayableInvoices(userId: string) {
  const settled = await getSettledByInvoice(userId);
  const rows = await getDb()
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      currency: invoices.currency,
      total: invoices.total,
      clientId: invoices.clientId,
      clientName: clients.name,
      clientCountry: clients.country,
      clientType: clients.clientType,
      clientDeemedCostsRate: clients.deemedCostsRate,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.userId, userId),
        isNotNull(invoices.number),
        inArray(invoices.status, ["sent", "paid", "overdue"])
      )
    )
    .orderBy(desc(invoices.date));
  return rows.map((r) => ({ ...r, number: r.number as string, settled: settled.get(r.id) ?? 0 }));
}
