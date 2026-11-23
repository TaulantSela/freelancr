// Which deadline reminders are due on a day (Skopje), for one user. Pure.
//
// Not registered for an activity, about last month's self-reported payments
// (е-ПДД by the 10th, tax by the 15th: PIT Art. 88(1), 93(1)):
//   5th   "file-by-10"     some payment is still to file
//   9th   "file-tomorrow"  still to file
//   13th  "pay-by-15"      some payment isn't marked paid: what's not paid
// and on 20 May, "annual-return" (confirm UJP's ГДП by 31 May, Art. 96(3))
// for last year, if it had payments.
// Registered self-employed: on the 12th, "advance" (by the 15th), with the
// amount from Settings if there is one.
// The period identifies a reminder (one per user, kind and period).

import type { MonthSummary } from "@/lib/tax/payments";

export type ReminderKind = "file-by-10" | "file-tomorrow" | "pay-by-15" | "annual-return" | "advance";

export type PlannedReminder = {
  kind: ReminderKind;
  // "YYYY-MM" (a month's deadlines, the advance) or "YYYY" (the return).
  period: string;
  // MKD: the month's tax, what's not paid of it, or the advance.
  amountMKD: number | null;
};

// "2026-11-05" -> "2026-10"
export function previousMonth(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// The days anything can be due on, so the runner can stop early.
export function isReminderDay(today: string): boolean {
  const day = Number(today.slice(8, 10));
  return [5, 9, 12, 13].includes(day) || today.slice(5) === "05-20";
}

export function dueReminders(input: {
  today: string;
  taxStatus: string;
  monthlyAdvanceMKD: number | null;
  // Last month's summary (lib/tax/payments.ts), or null without payments.
  lastMonth: MonthSummary | null;
  hadPaymentsLastYear: boolean;
}): PlannedReminder[] {
  const { today, taxStatus, lastMonth } = input;
  const day = Number(today.slice(8, 10));
  const period = previousMonth(today);
  const due: PlannedReminder[] = [];

  if (taxStatus === "self_employed") {
    if (day === 12) due.push({ kind: "advance", period, amountMKD: input.monthlyAdvanceMKD });
    return due;
  }

  const open = lastMonth && lastMonth.status !== "nothing" && lastMonth.status !== "paid";
  const toFile = open && !lastMonth.filed;
  if (day === 5 && toFile) due.push({ kind: "file-by-10", period, amountMKD: lastMonth.owedMKD });
  if (day === 9 && toFile) due.push({ kind: "file-tomorrow", period, amountMKD: lastMonth.owedMKD });
  if (day === 13 && open) due.push({ kind: "pay-by-15", period, amountMKD: lastMonth.unpaidOwedMKD });
  if (today.slice(5) === "05-20" && input.hadPaymentsLastYear) {
    due.push({ kind: "annual-return", period: String(Number(today.slice(0, 4)) - 1), amountMKD: null });
  }
  return due;
}
