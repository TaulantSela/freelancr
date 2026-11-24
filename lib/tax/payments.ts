// The income tax on payments, month by month (Personal Income Tax law,
// "ЗДЛД"). Pure: callers pass the payments and today's date.
//
// For a self-reported payment (a client abroad, or a private person in North
// Macedonia; lib/payments/config.ts) the user files the calculation (е-ПДД)
// by the 10th of the next month (Art. 88(1) points 4 and 7) and pays by the
// 15th (Art. 93(1)). UJP's system converts the amount at the NBRSM middle
// rate on the day the income was received (Art. 93(2)), which is the rate
// each payment stores. For each payment:
//   gross  = (amount credited + fees + tax withheld at source) x rate
//   base   = gross x (1 - deemed costs)        deemed costs: Art. 40, author's
//                                               rights only; 0 for income from
//                                               work (Art. 14)
//   tax    = 10% x base                         (Art. 11(1))
//   credit = min(tax withheld abroad x rate, tax), clients abroad only
//                                               (Art. 8(4): tax paid in another
//                                               state, up to the tax due here)
//   owed   = tax - credit
// The income is what the client paid: fees a bank or platform took on the
// way (an Upwork or Payoneer fee) are part of it, like tax withheld at
// source. An individual not registered for an activity has no deductible
// costs (only Art. 40's deemed costs), so a fee doesn't lower the base.
// For a "withheld" payment (a company in North Macedonia paid), the company
// already paid the 10% for the user (Art. 80(1)): nothing to file, and the
// withheld amount is "already paid for you". "business" payments (registered
// self-employed) only track income; their tax runs through the monthly
// advance and the annual balance.
// Amounts are rounded to the deni per payment, and months add those up.

import { PERSONAL_INCOME_TAX_RATE } from "./calculator";
import type { UjpStatus } from "@/lib/payments/config";

export type TaxPayment = {
  id: string;
  receivedOn: string;
  amount: number;
  fees: number;
  taxWithheld: number;
  rateToMKD: number;
  rateSource: string;
  taxTreatment: string;
  deemedCostsRate: number;
  clientCountry: string;
  ujpStatus: string | null;
};

export type PaymentTax = {
  // What reached the account, in MKD.
  receivedMKD: number;
  // What the client paid, in MKD: credited + fees + withheld at source. The
  // income.
  grossMKD: number;
  baseMKD: number;
  taxMKD: number;
  creditMKD: number;
  owedMKD: number;
  alreadyPaidForYouMKD: number;
};

export function roundDeni(amount: number): number {
  return Math.round(Number((amount * 100).toPrecision(15))) / 100;
}

export function paymentTax(p: TaxPayment): PaymentTax {
  const receivedMKD = roundDeni(p.amount * p.rateToMKD);
  const grossMKD = roundDeni((p.amount + p.fees + p.taxWithheld) * p.rateToMKD);
  const withheldMKD = roundDeni(p.taxWithheld * p.rateToMKD);
  const none = { baseMKD: 0, taxMKD: 0, creditMKD: 0, owedMKD: 0, alreadyPaidForYouMKD: 0 };

  if (p.taxTreatment === "self_reported") {
    const baseMKD = roundDeni(grossMKD * (1 - p.deemedCostsRate));
    const taxMKD = roundDeni(baseMKD * PERSONAL_INCOME_TAX_RATE);
    const creditMKD = p.clientCountry !== "MK" ? Math.min(withheldMKD, taxMKD) : 0;
    return {
      receivedMKD,
      grossMKD,
      ...none,
      baseMKD,
      taxMKD,
      creditMKD,
      owedMKD: roundDeni(taxMKD - creditMKD),
    };
  }
  if (p.taxTreatment === "withheld") {
    return {
      receivedMKD,
      grossMKD,
      ...none,
      baseMKD: grossMKD,
      taxMKD: withheldMKD,
      alreadyPaidForYouMKD: withheldMKD,
    };
  }
  return { receivedMKD, grossMKD, ...none };
}

// "2026-12" -> "2027-01"
function followingMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
}

export type UjpMonthStatus = "nothing" | "to_file" | "filed" | "approved" | "paid" | "late";

// Where a month's е-ПДД stands, from its self-reported payments' statuses.
// Late: something still not filed after the 10th, or not paid after the 15th.
export function ujpMonthStatus(
  statuses: readonly (string | null)[],
  reportBy: string,
  payBy: string,
  today: string
): UjpMonthStatus {
  if (statuses.length === 0) return "nothing";
  if (statuses.every((s) => s === "paid")) return "paid";
  if (statuses.some((s) => s === "to_file" || s === null)) {
    return today > reportBy ? "late" : "to_file";
  }
  if (today > payBy) return "late";
  return statuses.every((s) => s === "approved" || s === "paid") ? "approved" : "filed";
}

export type MonthSummary = {
  // "YYYY-MM": the month the money was received in.
  month: string;
  paymentIds: string[];
  receivedMKD: number;
  selfReportedGrossMKD: number;
  withheldGrossMKD: number;
  businessGrossMKD: number;
  taxMKD: number;
  creditMKD: number;
  owedMKD: number;
  // Owed on self-reported payments not marked paid yet.
  unpaidOwedMKD: number;
  alreadyPaidForYouMKD: number;
  // File the calculation by this date, pay by the next one.
  reportBy: string;
  payBy: string;
  status: UjpMonthStatus;
  // Every self-reported payment is filed (or approved, or paid): what's
  // left, if anything, is paying. False when there's none.
  filed: boolean;
  // Some payment converts at a rate that isn't the National Bank's for its
  // day: copied from the invoice (backfilled) or typed in by hand.
  hasOtherRates: boolean;
};

// One summary per month that has payments, newest first.
export function summarizeMonths(
  payments: readonly TaxPayment[],
  today: string
): MonthSummary[] {
  const byMonth = new Map<string, TaxPayment[]>();
  for (const p of payments) {
    const month = p.receivedOn.slice(0, 7);
    const list = byMonth.get(month);
    if (list) list.push(p);
    else byMonth.set(month, [p]);
  }
  const months: MonthSummary[] = [];
  for (const [month, list] of byMonth) {
    const next = followingMonth(month);
    const reportBy = `${next}-10`;
    const payBy = `${next}-15`;
    const sum = { received: 0, selfGross: 0, withheldGross: 0, businessGross: 0, tax: 0, credit: 0, owed: 0, unpaid: 0, already: 0 };
    const selfStatuses: (string | null)[] = [];
    for (const p of list) {
      const t = paymentTax(p);
      sum.received += t.receivedMKD;
      if (p.taxTreatment === "self_reported") {
        sum.selfGross += t.grossMKD;
        sum.tax += t.taxMKD;
        sum.credit += t.creditMKD;
        sum.owed += t.owedMKD;
        if (p.ujpStatus !== "paid") sum.unpaid += t.owedMKD;
        selfStatuses.push(p.ujpStatus);
      } else if (p.taxTreatment === "withheld") {
        sum.withheldGross += t.grossMKD;
        sum.already += t.alreadyPaidForYouMKD;
      } else {
        sum.businessGross += t.grossMKD;
      }
    }
    months.push({
      month,
      paymentIds: list.map((p) => p.id),
      receivedMKD: roundDeni(sum.received),
      selfReportedGrossMKD: roundDeni(sum.selfGross),
      withheldGrossMKD: roundDeni(sum.withheldGross),
      businessGrossMKD: roundDeni(sum.businessGross),
      taxMKD: roundDeni(sum.tax),
      creditMKD: roundDeni(sum.credit),
      owedMKD: roundDeni(sum.owed),
      unpaidOwedMKD: roundDeni(sum.unpaid),
      alreadyPaidForYouMKD: roundDeni(sum.already),
      reportBy,
      payBy,
      status: ujpMonthStatus(selfStatuses, reportBy, payBy, today),
      filed: selfStatuses.length > 0 && selfStatuses.every((s) => s !== null && s !== "to_file"),
      hasOtherRates: list.some((p) => p.rateSource !== "nbrsm"),
    });
  }
  return months.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
}

export type YearSummary = {
  receivedMKD: number;
  grossMKD: number;
  selfReportedGrossMKD: number;
  withheldGrossMKD: number;
  businessGrossMKD: number;
  owedMKD: number;
  creditMKD: number;
  alreadyPaidForYouMKD: number;
  // owed + credit + already paid for you: all the income tax on the year's
  // payments, whoever paid it.
  totalIncomeTaxMKD: number;
  unpaidOwedMKD: number;
};

export function summarizeYear(months: readonly MonthSummary[]): YearSummary {
  const total = (f: (m: MonthSummary) => number) => roundDeni(months.reduce((s, m) => s + f(m), 0));
  const owedMKD = total((m) => m.owedMKD);
  const creditMKD = total((m) => m.creditMKD);
  const alreadyPaidForYouMKD = total((m) => m.alreadyPaidForYouMKD);
  const selfReportedGrossMKD = total((m) => m.selfReportedGrossMKD);
  const withheldGrossMKD = total((m) => m.withheldGrossMKD);
  const businessGrossMKD = total((m) => m.businessGrossMKD);
  return {
    receivedMKD: total((m) => m.receivedMKD),
    grossMKD: roundDeni(selfReportedGrossMKD + withheldGrossMKD + businessGrossMKD),
    selfReportedGrossMKD,
    withheldGrossMKD,
    businessGrossMKD,
    owedMKD,
    creditMKD,
    alreadyPaidForYouMKD,
    totalIncomeTaxMKD: roundDeni(owedMKD + creditMKD + alreadyPaidForYouMKD),
    unpaidOwedMKD: total((m) => m.unpaidOwedMKD),
  };
}

export type OwedToUjp = {
  // Months whose calculation wasn't filed by the 10th or tax not paid by the
  // 15th, oldest first.
  late: MonthSummary[];
  // The month whose deadlines come next and isn't late or paid (last month's
  // until the 15th), if any.
  due: MonthSummary | null;
  // This month so far, if anything was received.
  current: MonthSummary | null;
  // Everything owed on self-reported payments not marked paid yet.
  totalUnpaidMKD: number;
};

// What the dashboard shows on `today`.
export function owedToUjp(months: readonly MonthSummary[], today: string): OwedToUjp {
  const currentMonth = today.slice(0, 7);
  const open = months.filter((m) => m.status !== "nothing" && m.status !== "paid");
  const late = open.filter((m) => m.status === "late").sort((a, b) => (a.month < b.month ? -1 : 1));
  const due =
    open
      .filter((m) => m.status !== "late" && m.month < currentMonth)
      .sort((a, b) => (a.month < b.month ? -1 : 1))[0] ?? null;
  return {
    late,
    due,
    current: months.find((m) => m.month === currentMonth) ?? null,
    totalUnpaidMKD: roundDeni(open.reduce((s, m) => s + m.unpaidOwedMKD, 0)),
  };
}

// Whether a month's deadline is already met: its calculation filed (report)
// or its tax paid (pay). The other deadlines (advances, annual ones) aren't
// tracked, so they never are.
export function deadlineMet(
  deadline: { kind: string; period: string },
  months: ReadonlyMap<string, MonthSummary>
): boolean {
  const month = months.get(deadline.period);
  if (deadline.kind === "report") return Boolean(month?.filed);
  if (deadline.kind === "pay") return month?.status === "paid";
  return false;
}

// The months with self-reported income, for the deadline calendar.
export function selfReportedMonths(payments: readonly TaxPayment[]): string[] {
  return [
    ...new Set(
      payments.filter((p) => p.taxTreatment === "self_reported").map((p) => p.receivedOn.slice(0, 7))
    ),
  ].sort();
}

// UJP's statuses in the order a calculation goes through them.
export const UJP_STATUS_ORDER: Record<UjpStatus, number> = {
  to_file: 0,
  filed: 1,
  approved: 2,
  paid: 3,
};
