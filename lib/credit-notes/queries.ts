import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, creditNotes, invoices, clients } from "@/lib/db";
import { getInvoiceDetail, type InvoiceDetail } from "@/lib/invoices/queries";
import type { ThresholdCreditNote } from "@/lib/tax/calculator";

const creditNoteColumns = {
  id: creditNotes.id,
  number: creditNotes.number,
  date: creditNotes.date,
  amount: creditNotes.amount,
  ddvAmount: creditNotes.ddvAmount,
  reason: creditNotes.reason,
  rateToMKD: creditNotes.rateToMKD,
  invoiceId: creditNotes.invoiceId,
  createdAt: creditNotes.createdAt,
};

export type CreditNoteRow = Awaited<ReturnType<typeof getInvoiceCreditNotes>>[number];

// An invoice's credit notes, oldest first.
export async function getInvoiceCreditNotes(invoiceId: string, userId: string) {
  return getDb()
    .select(creditNoteColumns)
    .from(creditNotes)
    .where(and(eq(creditNotes.invoiceId, invoiceId), eq(creditNotes.userId, userId)))
    .orderBy(creditNotes.createdAt, creditNotes.id);
}

// invoice id -> its credit notes' total (DDV included), for the user's
// invoices that have any.
export async function getCreditedByInvoice(userId: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({
      invoiceId: creditNotes.invoiceId,
      credited: sql<number>`sum(${creditNotes.amount})`,
    })
    .from(creditNotes)
    .where(eq(creditNotes.userId, userId))
    .groupBy(creditNotes.invoiceId);
  return new Map(rows.map((r) => [r.invoiceId, Number(r.credited)]));
}

// The user's most recent credit note, the only one that can be deleted.
export async function getLatestCreditNoteId(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: creditNotes.id })
    .from(creditNotes)
    .where(eq(creditNotes.userId, userId))
    .orderBy(desc(creditNotes.createdAt), desc(creditNotes.id))
    .limit(1);
  return row?.id ?? null;
}

export type CreditNoteDetail = {
  creditNote: CreditNoteRow;
  invoice: InvoiceDetail;
};

// A credit note with its invoice, issuer and client, for the PDF.
export async function getCreditNoteDetail(
  id: string,
  userId: string
): Promise<CreditNoteDetail | null> {
  const [creditNote] = await getDb()
    .select(creditNoteColumns)
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.userId, userId)))
    .limit(1);
  if (!creditNote) return null;
  const invoice = await getInvoiceDetail(creditNote.invoiceId, userId);
  if (!invoice) return null;
  return { creditNote, invoice };
}

// The year's credit notes with their invoice number and client, oldest
// first (the CSV export).
export async function getCreditNotesForYear(userId: string, year: number) {
  return getDb()
    .select({
      number: creditNotes.number,
      date: creditNotes.date,
      invoiceNumber: invoices.number,
      clientName: clients.name,
      currency: invoices.currency,
      amount: creditNotes.amount,
      ddvAmount: creditNotes.ddvAmount,
      reason: creditNotes.reason,
      rateToMKD: creditNotes.rateToMKD,
    })
    .from(creditNotes)
    .innerJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(creditNotes.userId, userId),
        gte(creditNotes.date, `${year}-01-01`),
        lte(creditNotes.date, `${year}-12-31`)
      )
    )
    .orderBy(creditNotes.date, creditNotes.number);
}

// Credit notes dated in `year`, with their client's country; the DDV
// threshold takes the ones to clients in North Macedonia off that year's
// supplies (getLocalSupplies).
export async function getCreditNotesForThreshold(
  userId: string,
  year: number
): Promise<ThresholdCreditNote[]> {
  const rows = await getDb()
    .select({
      clientCountry: clients.country,
      date: creditNotes.date,
      amountMKD: sql<number>`${creditNotes.amount} * ${creditNotes.rateToMKD}`,
    })
    .from(creditNotes)
    .innerJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(creditNotes.userId, userId),
        gte(creditNotes.date, `${year}-01-01`),
        lte(creditNotes.date, `${year}-12-31`)
      )
    );
  return rows.map((r) => ({ ...r, amountMKD: Number(r.amountMKD) }));
}
