// North Macedonia tax constants (2026)

// DDV (VAT) registration threshold: total turnover over 2,000,000 MKD in a
// calendar year (VAT law, "ЗДДВ", Art. 51(1)). See getLocalSupplies() for
// what counts toward it.
export const DDV_THRESHOLD_MKD = 2_000_000;

// MK personal income tax (2026): a flat 10%, with no brackets (Personal
// Income Tax law, "ЗДЛД", Art. 11(1); 15% applies only to gambling winnings).
// UJP's guide on income from independent activity gives the rate as 10%:
// https://ujp.gov.mk/en/vodic/category/546
// The 10%/18% progressive rates that applied in 2019 were suspended for
// 2020-2022 and then abolished from 1 January 2023 (Official Gazette
// 274/2022). PwC Worldwide Tax Summaries (reviewed 23 July 2026) lists the
// same flat 10% for self-employment income:
// https://taxsummaries.pwc.com/north-macedonia/individual/taxes-on-personal-income
// lib/tax/payments.ts applies it to each self-reported payment.
export const PERSONAL_INCOME_TAX_RATE = 0.1;

// How a user is registered for tax, which decides their UJP deadlines. They
// pick it in Settings and it's stored in users.tax_status.
// "paid_from_abroad" (the default; the name predates local private persons):
// an individual who isn't registered for an independent activity and reports
// self-reported income (isSelfReportedIncome below) month by month.
// "self_employed": a registered self-employed person (самостоен вршител на
// дејност).
export const TAX_STATUSES = ["paid_from_abroad", "self_employed"] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];
export const DEFAULT_TAX_STATUS: TaxStatus = "paid_from_abroad";

export function isTaxStatus(value: unknown): value is TaxStatus {
  return (
    typeof value === "string" &&
    (TAX_STATUSES as readonly string[]).includes(value)
  );
}

// Standard DDV rate in Macedonia
export const DDV_RATE_STANDARD = 0.18; // 18%
export const DDV_RATE_REDUCED = 0.05; // 5%

// The rates a VAT-registered user can put on an invoice. Everyone else's
// invoices carry no DDV at all: only a taxpayer registered for VAT may show
// it (VAT law Art. 51(3)), and showing it anyway makes the issuer owe the
// amount shown (Art. 55). The invoice actions enforce this from
// users.vat_registered, whatever the form sends.
export const DDV_RATES = [0, DDV_RATE_REDUCED, DDV_RATE_STANDARD] as const;

export function isDdvRate(value: number): boolean {
  return (DDV_RATES as readonly number[]).includes(value);
}

// Invoice statuses that count as issued: numbered and sent to the client,
// whether paid or not. Drafts and cancelled invoices are neither.
export const ISSUED_STATUSES = ["sent", "paid", "overdue"] as const;

export type ThresholdInvoice = {
  clientCountry: string;
  status: string;
  // Date of supply, "YYYY-MM-DD"; null on rows saved before it existed.
  supplyDate: string | null;
  // Invoice date, "YYYY-MM-DD", used when there's no date of supply.
  date: string;
  totalMKD: number;
};

// A payment without an invoice (a platform's payout, a one-off job).
export type ThresholdPayout = {
  clientCountry: string;
  // The day it was received, "YYYY-MM-DD".
  receivedOn: string;
  // What the client paid for it, in MKD: credited + fees + tax withheld,
  // at the payment's rate.
  valueMKD: number;
};

// A credit note on an invoice: it takes its amount off the supplies of the
// year it's dated in, when the change was made (VAT law Art. 22(1)).
export type ThresholdCreditNote = {
  clientCountry: string;
  // "YYYY-MM-DD"
  date: string;
  // DDV included, at the invoice's rate, as invoices count their total.
  amountMKD: number;
};

// What counts toward the DDV threshold in `year`. "Total turnover" is the
// turnover taxable under Art. 2(1), i.e. supplies made in North Macedonia
// (Art. 51(2)). A service to a taxable person abroad is supplied where that
// person is established (Art. 14-а(2)), and so are most services a freelancer
// sells to private persons abroad (Art. 14-а(6): consulting, engineering,
// data processing, electronic services, copyright and the like), so they
// don't count. The app takes "supplied in North Macedonia" to mean "done for
// a client in North Macedonia": every issued, not cancelled invoice to a
// client there, paid or not, by its date of supply in the year, and every
// payment without an invoice from a client there, by the day it was received
// (there's no date of supply without an invoice), less the credit notes on
// invoices to clients there dated in the year. The total never goes below 0.
export function getLocalSupplies(
  invoices: readonly ThresholdInvoice[],
  year: number,
  payouts: readonly ThresholdPayout[] = [],
  creditNotes: readonly ThresholdCreditNote[] = []
): { totalMKD: number; count: number } {
  let totalMKD = 0;
  let count = 0;
  for (const invoice of invoices) {
    if (invoice.clientCountry !== "MK") continue;
    if (!(ISSUED_STATUSES as readonly string[]).includes(invoice.status)) continue;
    const supplied = invoice.supplyDate ?? invoice.date;
    if (!supplied.startsWith(`${year}-`)) continue;
    totalMKD += invoice.totalMKD;
    count++;
  }
  for (const payout of payouts) {
    if (payout.clientCountry !== "MK") continue;
    if (!payout.receivedOn.startsWith(`${year}-`)) continue;
    totalMKD += payout.valueMKD;
    count++;
  }
  for (const creditNote of creditNotes) {
    if (creditNote.clientCountry !== "MK") continue;
    if (!creditNote.date.startsWith(`${year}-`)) continue;
    totalMKD -= creditNote.amountMKD;
  }
  return { totalMKD: Math.max(0, totalMKD), count };
}

export function getDDVStatus(localSuppliesMKD: number): {
  percentage: number;
  // Over the threshold: registration is due (Art. 51(1), (11)).
  mustRegister: boolean;
  alertLevel: "safe" | "warning" | "critical" | "exceeded";
  remaining: number;
} {
  const percentage = (localSuppliesMKD / DDV_THRESHOLD_MKD) * 100;
  const remaining = DDV_THRESHOLD_MKD - localSuppliesMKD;
  // The law says "exceeded" (надминал), so exactly 2,000,000 isn't over.
  const mustRegister = localSuppliesMKD > DDV_THRESHOLD_MKD;

  let alertLevel: "safe" | "warning" | "critical" | "exceeded" = "safe";
  if (mustRegister) alertLevel = "exceeded";
  else if (percentage >= 85) alertLevel = "critical";
  else if (percentage >= 70) alertLevel = "warning";

  return {
    percentage: Math.min(percentage, 100),
    mustRegister,
    alertLevel,
    remaining: Math.max(0, remaining),
  };
}

// ---------------------------------------------------------------------------
// Tax deadlines (UJP)
//
// Which deadlines apply depends on the user's TaxStatus (above).
//
// "paid_from_abroad": for each month in which self-reported income was
// received, submit the electronic calculation (е-ПДД) by the 10th of the
// following month and pay the tax by the 15th of the following month
// (Personal Income Tax law, Art. 88(1) points 4 and 7, Art. 93(1)).
// https://biznisinfo.mk/kako-i-koga-da-prijavite-dohod-od-stranstvo-upatstvo-od-ujp-co-pravila-i-rokovi-za-prijavuvanje/
// https://republika.mk/vesti/ekonomija/ujp-se-priblizhuva-rokot-za-podnesuvane-presmetki-za-dohod-ostvaren-od-rabota-vo-stranstvo-vo-2025-godina/
// (The republika.mk piece is UJP's reminder about the 31 March calculation
// for salaries from work abroad, which isn't modelled here.)
//
// Also for "paid_from_abroad", for each tax year with income: UJP prepares
// the annual tax return (годишна даночна пријава, ГДП) and sends it by
// 30 April; the taxpayer confirms or corrects it by 31 May (otherwise it
// counts as confirmed) and pays any tax it shows by 30 June (Art. 96(2)-(4),
// Art. 100(2)).
//
// "self_employed": an income tax advance by the 15th of each month for the
// previous month (1/12 of the tax in last year's annual balance); the annual
// tax balance (ПДД-ДБ) and the statement of income and expenses by 15 March
// of the following year, filed through etax.ujp.gov.mk; any difference paid
// within 15 days after that, i.e. by 30 March.
// https://ujp.gov.mk/en/vodic/category/546
// https://taxsummaries.pwc.com/north-macedonia/individual/tax-administration
//
// Nothing else is modelled: no social contributions, and a deadline that
// falls on a weekend or public holiday is shown on that date.
//
// Every date here is a calendar date in North Macedonia, as "YYYY-MM-DD".
// The functions are pure: callers pass in today's date and the months that
// had income, so they can be tested without a clock or a database.
// ---------------------------------------------------------------------------

// Not registered: day of the following month to submit the calculation by,
// and to pay the tax by.
const ABROAD_REPORT_DAY = 10;
const ABROAD_PAYMENT_DAY = 15;
// Self-employed: day of the following month the monthly advance is due.
const ADVANCE_DAY = 15;
// Self-employed: month and day in the following year for the annual tax
// balance (ПДД-ДБ), and for paying any difference (15 days after it).
const ANNUAL_RETURN_DATE = "03-15";
const ANNUAL_PAYMENT_DATE = "03-30";
// Not registered: month and day in the following year to confirm or correct
// UJP's annual tax return (ГДП), and to pay what it shows.
const RETURN_CONFIRM_DATE = "05-31";
const RETURN_PAYMENT_DATE = "06-30";

export type TaxDeadlineKind =
  | "report" // not registered: submit the calculation for a month's income
  | "pay" // not registered: pay the tax on a month's income
  | "returnConfirm" // not registered: confirm or correct the annual return (ГДП)
  | "returnPay" // not registered: pay the tax the annual return shows
  | "advance" // self-employed: pay the monthly advance for a month
  | "annualReturn" // self-employed: file the annual tax balance for a year
  | "annualPayment"; // self-employed: pay any difference for a year

export type TaxDeadline = {
  kind: TaxDeadlineKind;
  // What the deadline is for: a month ("YYYY-MM") for report, pay and
  // advance; a tax year ("YYYY") for the annual ones.
  period: string;
  // "YYYY-MM-DD"
  dueDate: string;
};

const KIND_ORDER: Record<TaxDeadlineKind, number> = {
  report: 0,
  pay: 1,
  advance: 2,
  annualReturn: 3,
  annualPayment: 4,
  returnConfirm: 5,
  returnPay: 6,
};

function compareDeadlines(a: TaxDeadline, b: TaxDeadline): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return a.period < b.period ? -1 : a.period > b.period ? 1 : 0;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// "2026-12" -> "2027-01"
function followingMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${pad2(m + 1)}`;
}

// Every deadline that one tax year leads to, soonest first. incomeMonths
// ("YYYY-MM") only matters when not registered: a month without
// self-reported income has nothing to report. incomeYears are the years with
// any income at all, withheld or not, which each lead to an annual return;
// left out, they're the years of incomeMonths.
export function getTaxDeadlinesForTaxYear(
  status: TaxStatus,
  taxYear: number,
  incomeMonths: readonly string[],
  incomeYears?: readonly number[]
): TaxDeadline[] {
  const deadlines: TaxDeadline[] = [];

  if (status === "paid_from_abroad") {
    for (const month of new Set(incomeMonths)) {
      if (!MONTH_PATTERN.test(month) || !month.startsWith(`${taxYear}-`)) {
        continue;
      }
      const next = followingMonth(month);
      deadlines.push(
        { kind: "report", period: month, dueDate: `${next}-${pad2(ABROAD_REPORT_DAY)}` },
        { kind: "pay", period: month, dueDate: `${next}-${pad2(ABROAD_PAYMENT_DAY)}` }
      );
    }
    const years =
      incomeYears ??
      incomeMonths.filter((m) => MONTH_PATTERN.test(m)).map((m) => Number(m.slice(0, 4)));
    if (years.includes(taxYear)) {
      deadlines.push(
        { kind: "returnConfirm", period: String(taxYear), dueDate: `${taxYear + 1}-${RETURN_CONFIRM_DATE}` },
        { kind: "returnPay", period: String(taxYear), dueDate: `${taxYear + 1}-${RETURN_PAYMENT_DATE}` }
      );
    }
  } else {
    for (let m = 1; m <= 12; m++) {
      const month = `${taxYear}-${pad2(m)}`;
      deadlines.push({
        kind: "advance",
        period: month,
        dueDate: `${followingMonth(month)}-${pad2(ADVANCE_DAY)}`,
      });
    }
    deadlines.push(
      { kind: "annualReturn", period: String(taxYear), dueDate: `${taxYear + 1}-${ANNUAL_RETURN_DATE}` },
      { kind: "annualPayment", period: String(taxYear), dueDate: `${taxYear + 1}-${ANNUAL_PAYMENT_DATE}` }
    );
  }

  return deadlines.sort(compareDeadlines);
}

// The Payments page's list for `year`: every deadline due from 1 January
// of `year`, which covers the last of the previous tax year (December's
// report or advance, the annual balance) and all of `year`'s own, including
// the ones that fall early the next year.
export function getTaxCalendar(
  status: TaxStatus,
  year: number,
  incomeMonths: readonly string[],
  incomeYears?: readonly number[]
): TaxDeadline[] {
  return [
    ...getTaxDeadlinesForTaxYear(status, year - 1, incomeMonths, incomeYears),
    ...getTaxDeadlinesForTaxYear(status, year, incomeMonths, incomeYears),
  ]
    .filter((d) => d.dueDate >= `${year}-01-01`)
    .sort(compareDeadlines);
}

// Deadlines due today or later, soonest first. Tax years before the previous
// one have none left (the last deadline a tax year leads to is 30 June of the
// year after), and next year's start in February, which matters in December
// when the dashboard shows the deadline after the next one.
export function getUpcomingTaxDeadlines(
  status: TaxStatus,
  today: string,
  incomeMonths: readonly string[],
  incomeYears?: readonly number[]
): TaxDeadline[] {
  const year = Number(today.slice(0, 4));
  return [year - 1, year, year + 1]
    .flatMap((taxYear) => getTaxDeadlinesForTaxYear(status, taxYear, incomeMonths, incomeYears))
    .filter((d) => d.dueDate >= today)
    .sort(compareDeadlines);
}

export type TaxDeadlineGroup = {
  // One month's self-reported income (report + pay), one month's advance,
  // one tax year's annual balance (return + payment), or one tax year's
  // annual return (confirm + pay).
  kind: "income" | "advance" | "annual" | "return";
  period: string;
  deadlines: TaxDeadline[];
};

const GROUP_KIND: Record<TaxDeadlineKind, TaxDeadlineGroup["kind"]> = {
  report: "income",
  pay: "income",
  advance: "advance",
  annualReturn: "annual",
  annualPayment: "annual",
  returnConfirm: "return",
  returnPay: "return",
};

// Groups deadlines that belong together, ordered by each group's first
// deadline.
export function groupTaxDeadlines(
  deadlines: readonly TaxDeadline[]
): TaxDeadlineGroup[] {
  const groups = new Map<string, TaxDeadlineGroup>();
  for (const deadline of [...deadlines].sort(compareDeadlines)) {
    const kind = GROUP_KIND[deadline.kind];
    const key = `${kind}:${deadline.period}`;
    const group = groups.get(key);
    if (group) group.deadlines.push(deadline);
    else groups.set(key, { kind, period: deadline.period, deadlines: [deadline] });
  }
  return [...groups.values()];
}

let skopjeDateFormat: Intl.DateTimeFormat | undefined;

// The calendar date ("YYYY-MM-DD") in North Macedonia at a given moment.
// Servers run in UTC, which is one or two hours behind.
export function toSkopjeDate(moment: Date): string {
  skopjeDateFormat ??= new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of skopjeDateFormat.formatToParts(moment)) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// "YYYY-MM-DD" plus a number of days, e.g. ("2026-12-20", 30) -> "2027-01-19".
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Whole days from one "YYYY-MM-DD" date to another; negative if `to` is
// earlier.
export function daysBetween(from: string, to: string): number {
  const toUtc = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

// Every currency a client can default to or an invoice can be issued in.
// The client form, the invoice form and the server actions all read this
// list, so a currency can't be offered without a rate below.
export const SUPPORTED_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "MKD",
  "CHF",
  "AUD",
  "CAD",
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

// Approximate MKD rates, the fallback only: invoices and payments convert at
// the NBRSM middle rate for their date (lib/rates), and an invoice uses one of
// these, flagged as approximate, only when the National Bank can't be
// reached. Values are NBRM middle rates (среден курс) from the exchange rate
// list formed on 20 November 2026 (valid from 21 November 2026), rounded to
// one decimal, retrieved from
// https://www.nbrm.mk/KLServiceNOV/GetExchangeRates?StartDate=21.11.2026&EndDate=21.11.2026&format=json
export const APPROXIMATE_RATES_TO_MKD: Record<Currency, number> = {
  EUR: 61.6, // NBRM middle 61.5942
  USD: 56.0, // NBRM middle 56.0457
  GBP: 73.6, // NBRM middle 73.5585
  CHF: 66.8, // NBRM middle 66.7833
  AUD: 37.4, // NBRM middle 37.3593
  CAD: 39.2, // NBRM middle 39.1746
  MKD: 1,
};

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

// Throws for a currency without a rate rather than treating it as 1:1 MKD,
// which would silently distort the DDV threshold and income totals.
export function getRateToMKD(currency: string): number {
  if (!isSupportedCurrency(currency)) {
    throw new Error(
      `Unsupported currency "${currency}": no MKD exchange rate is configured`
    );
  }
  return APPROXIMATE_RATES_TO_MKD[currency];
}

// "1.234.567,89 ден.": the Macedonian format, from the en-US one with the
// separators swapped. Browsers whose Intl has no Macedonian data (Chrome's
// doesn't) printed "1,234,567.89" for "mk-MK" in client components, which
// also broke hydration against the server's output; en-US data is always
// there, and rounds the same way.
export function formatMKD(amount: number): string {
  const enUS = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return enUS.replace(/[,.]/g, (sep) => (sep === "," ? "." : ",")) + " ден.";
}

export function formatCurrency(amount: number, currency: string): string {
  const locale = currency === "MKD" ? "mk-MK" : "en-US";
  if (currency === "MKD") return formatMKD(amount);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
