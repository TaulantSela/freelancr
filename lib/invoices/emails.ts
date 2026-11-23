import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, invoiceEmails } from "@/lib/db";
import type { InvoiceDetail } from "@/lib/invoices/queries";
import { getDictionary } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";
import { resolveInvoiceLanguage } from "@/lib/clients/config";
import { formatDate, formatMoney } from "@/lib/pdf/invoice-document";

type Db = ReturnType<typeof getDb>;

export const INVOICE_EMAILS_PER_DAY = 20;

// Reserves one of the user's 20 invoice emails for the last 24 hours, in
// one statement: the row is written only while there's room. The send then
// fills in Resend's id or the error. Returns whether it was written.
export async function reserveInvoiceEmail(
  db: Db,
  e: { id: string; userId: string; invoiceId: string; toAddress: string }
): Promise<boolean> {
  const result = await db.execute<{ n: number }>(sql`
    with recent as (
      select count(*) as n from invoice_emails
      where user_id = ${e.userId} and sent_at > now() - interval '24 hours'
    ), ins as (
      insert into invoice_emails (id, user_id, invoice_id, to_address, error)
      select ${e.id}, ${e.userId}, ${e.invoiceId}, ${e.toAddress}, 'sending'
      from recent where recent.n < ${INVOICE_EMAILS_PER_DAY}
      returning id
    )
    select count(*)::int as n from ins
  `);
  return Number(result.rows[0]?.n ?? 0) > 0;
}

export async function completeInvoiceEmail(
  db: Db,
  id: string,
  outcome: { providerId: string | null } | { error: string }
) {
  await db
    .update(invoiceEmails)
    .set("error" in outcome ? { error: outcome.error } : { providerId: outcome.providerId, error: null })
    .where(eq(invoiceEmails.id, id));
}

// The invoice's emails that went out, newest first.
export async function getInvoiceEmailLog(invoiceId: string, userId: string) {
  return getDb()
    .select({ id: invoiceEmails.id, toAddress: invoiceEmails.toAddress, sentAt: invoiceEmails.sentAt })
    .from(invoiceEmails)
    .where(
      and(
        eq(invoiceEmails.invoiceId, invoiceId),
        eq(invoiceEmails.userId, userId),
        isNotNull(invoiceEmails.providerId)
      )
    )
    .orderBy(desc(invoiceEmails.sentAt));
}

// What the form starts with, in the invoice's language: "Invoice INV-… from
// <name>" and a short note with the amount and due date.
export function invoiceEmailDefaults(data: InvoiceDetail) {
  const lang = resolveInvoiceLanguage(data.client);
  const e = getDictionary(lang).invoices.email;
  const name = data.user.businessName || data.user.name;
  const number = data.invoice.number ?? "";
  const total = formatMoney(data.invoice.total, data.invoice.currency, lang);
  return {
    to: data.client.email ?? "",
    subject: formatMessage(e.defaultSubject, { number, name }),
    message: data.invoice.dueDate
      ? formatMessage(e.defaultMessage, { number, total, due: formatDate(data.invoice.dueDate, lang), name })
      : formatMessage(e.defaultMessageNoDue, { number, total, name }),
  };
}
