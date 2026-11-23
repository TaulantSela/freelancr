// Credit notes (книжно одобрение): pure amounts. A credit note lowers what an
// invoice's client owes. On an invoice with DDV it lowers the base and the
// DDV in the invoice's proportion; the supplier corrects the tax in the
// period the change was made (VAT law Art. 22(1)), which is the credit
// note's date.

import { SETTLED_TOLERANCE } from "@/lib/payments/settlement";

// To the cent, without floating-point noise (1.005 -> 1.01).
export function roundCents(x: number): number {
  return Math.round(Number((x * 100).toPrecision(15))) / 100;
}

// The DDV part of a credit note of `amount` (DDV included) on an invoice
// with `ddvRate` (0.18, 0.05 or 0), rounded to the cent.
export function creditNoteDdv(amount: number, ddvRate: number): number {
  if (!(ddvRate > 0)) return 0;
  return roundCents((amount * ddvRate) / (1 + ddvRate));
}

// The most a new credit note can be: the invoice total less the credit
// notes it already has.
export function creditableAmount(total: number, credited: number): number {
  return Math.max(0, roundCents(total - credited));
}

// Whether `amount` fits within what's left to credit (half a cent of slack,
// as for settling).
export function fitsCreditable(amount: number, total: number, credited: number): boolean {
  return amount > 0 && amount <= creditableAmount(total, credited) + SETTLED_TOLERANCE;
}

// CN-YYYY-NNN, as invoice numbers: at least three digits.
export function creditNoteNumber(year: string, n: number): string {
  return `CN-${year}-${String(n).padStart(3, "0")}`;
}
