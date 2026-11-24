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
//
// Each stays due for a few days after its day, until the next reminder or
// the deadline: the cron runs once a day and sends each reminder once (the
// log), so one that failed or didn't fit in a run goes out the next day.
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

// From each reminder's day to the last day it's still sent on.
const WINDOWS: Record<ReminderKind, [from: number, to: number]> = {
  "file-by-10": [5, 8],
  "file-tomorrow": [9, 9],
  advance: [12, 14],
  "pay-by-15": [13, 14],
  // In May.
  "annual-return": [20, 30],
};

export function inWindow(kind: ReminderKind, today: string): boolean {
  const day = Number(today.slice(8, 10));
  const [from, to] = WINDOWS[kind];
  if (kind === "annual-return" && today.slice(5, 7) !== "05") return false;
  return day >= from && day <= to;
}

// The days anything can be due on, so the runner can stop early.
export function isReminderDay(today: string): boolean {
  return (Object.keys(WINDOWS) as ReminderKind[]).some((kind) => inWindow(kind, today));
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
  const period = previousMonth(today);
  const due: PlannedReminder[] = [];

  if (taxStatus === "self_employed") {
    if (inWindow("advance", today)) due.push({ kind: "advance", period, amountMKD: input.monthlyAdvanceMKD });
    return due;
  }

  const open = lastMonth && lastMonth.status !== "nothing" && lastMonth.status !== "paid";
  const toFile = open && !lastMonth.filed;
  if (inWindow("file-by-10", today) && toFile) due.push({ kind: "file-by-10", period, amountMKD: lastMonth.owedMKD });
  if (inWindow("file-tomorrow", today) && toFile) due.push({ kind: "file-tomorrow", period, amountMKD: lastMonth.owedMKD });
  if (inWindow("pay-by-15", today) && open) due.push({ kind: "pay-by-15", period, amountMKD: lastMonth.unpaidOwedMKD });
  if (inWindow("annual-return", today) && input.hadPaymentsLastYear) {
    due.push({ kind: "annual-return", period: String(Number(today.slice(0, 4)) - 1), amountMKD: null });
  }
  return due;
}
