// How far payments settle an invoice, and the status an invoice shows. Pure:
// the database keeps invoices.status ('sent' or 'paid') and paid_at in step
// with the payments and credit notes (lib/payments/write.ts,
// lib/credit-notes/write.ts); everything else is worked out here when a page
// is read. What's due is the invoice's total less its credit notes.

// Amounts are in the invoice's currency; within half a cent counts as equal.
export const SETTLED_TOLERANCE = 0.005;

export type SettlingPayment = {
  amount: number;
  fees: number;
  taxWithheld: number;
  receivedOn: string;
};

function round2(x: number): number {
  return Math.round(Number((x * 100).toPrecision(15))) / 100;
}

// What the payments cover of an invoice: everything credited, plus what banks
// or platforms took on the way, plus tax the client withheld for the user.
export function settledAmount(payments: readonly SettlingPayment[]): number {
  return round2(payments.reduce((sum, p) => sum + p.amount + p.fees + p.taxWithheld, 0));
}

// The invoice's total less its credit notes: what the client owes in all.
export function effectiveTotal(total: number, credited: number): number {
  return round2(total - credited);
}

// The stored status the payments imply: 'paid' (with the day of the last
// payment) once they cover the total less any credit notes, otherwise 'sent'.
export function settlementStatus(
  total: number,
  payments: readonly SettlingPayment[],
  credited = 0
): { status: "paid" | "sent"; paidAt: string | null } {
  const settled = settledAmount(payments);
  if (payments.length > 0 && settled >= effectiveTotal(total, credited) - SETTLED_TOLERANCE) {
    const last = payments.reduce((max, p) => (p.receivedOn > max ? p.receivedOn : max), "");
    return { status: "paid", paidAt: last };
  }
  return { status: "sent", paidAt: null };
}

export type InvoiceDisplayStatus =
  | "draft"
  | "issued"
  | "partly_paid"
  | "paid"
  | "overdue"
  | "credited"
  | "cancelled";

export type InvoiceStanding = {
  status: InvoiceDisplayStatus;
  settled: number;
  // Credit notes on the invoice, DDV included.
  credited: number;
  // What's still to pay (the total less credit notes and payments); 0 once
  // paid.
  balance: number;
  // What was paid beyond what's due; 0 unless overpaid.
  overpaid: number;
};

// What an invoice shows. Paid, partly paid, overdue and credited come from
// the payments, the credit notes and the due date, never from a stored
// 'overdue': overdue means issued, not fully paid, and due before `today`
// ("YYYY-MM-DD", Skopje); credited means credit notes cover all of it and
// nothing was paid.
export function invoiceStanding(
  invoice: { status: string; total: number; dueDate: string | null },
  settled: number,
  today: string,
  credited = 0
): InvoiceStanding {
  const due = effectiveTotal(invoice.total, credited);
  const balance = round2(Math.max(0, due - settled));
  const overpaid = round2(Math.max(0, settled - due));
  const base = {
    settled,
    credited,
    balance: balance <= SETTLED_TOLERANCE ? 0 : balance,
    overpaid: overpaid <= SETTLED_TOLERANCE ? 0 : overpaid,
  };
  if (invoice.status === "draft") return { status: "draft", ...base };
  if (invoice.status === "cancelled") return { status: "cancelled", ...base };
  if (settled > 0 && settled >= due - SETTLED_TOLERANCE) {
    return { status: "paid", ...base, balance: 0 };
  }
  if (credited > 0 && due <= SETTLED_TOLERANCE) return { status: "credited", ...base, balance: 0 };
  if (invoice.dueDate && invoice.dueDate < today) return { status: "overdue", ...base };
  if (settled > 0) return { status: "partly_paid", ...base };
  return { status: "issued", ...base };
}
