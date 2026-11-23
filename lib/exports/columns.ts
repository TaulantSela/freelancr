// The CSV exports' columns, in order. Headers come from the dictionary
// (t.exports.<file>.<column>), in the user's language.

export const PAYMENT_COLUMNS = [
  "received_on",
  "client",
  "client_country",
  "invoice_number",
  "currency",
  "amount_credited",
  "fees",
  "tax_withheld",
  "rate_to_mkd",
  "rate_source",
  "received_mkd",
  "gross_mkd",
  "treatment",
  "deemed_costs_rate",
  "base_mkd",
  "tax_mkd",
  "credit_mkd",
  "owed_mkd",
  "already_paid_for_you_mkd",
  "ujp_status",
  "ujp_reference",
  "ujp_folio",
  "tax_paid_on",
  "channel",
  "note",
] as const;

export const INVOICE_COLUMNS = [
  "number",
  "standing",
  "date",
  "supply_date",
  "due_date",
  "client",
  "client_country",
  "currency",
  "subtotal",
  "ddv_rate",
  "ddv_amount",
  "total",
  "credited",
  "paid",
  "balance",
  "rate_to_mkd",
  "rate_source",
  "total_mkd",
] as const;

export const CREDIT_NOTE_COLUMNS = [
  "number",
  "date",
  "invoice_number",
  "client",
  "currency",
  "amount",
  "ddv_amount",
  "reason",
  "amount_mkd",
] as const;

export type PaymentColumn = (typeof PAYMENT_COLUMNS)[number];
export type InvoiceColumn = (typeof INVOICE_COLUMNS)[number];
export type CreditNoteColumn = (typeof CREDIT_NOTE_COLUMNS)[number];

// A year from ?year=, or null.
export function exportYear(url: string): number | null {
  const year = new URL(url).searchParams.get("year") ?? "";
  return /^\d{4}$/.test(year) ? Number(year) : null;
}
