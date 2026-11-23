// North Macedonia tax constants (2026)

// DDV (VAT) threshold in MKD per year
export const DDV_THRESHOLD_MKD = 2_000_000;

// MK personal income tax brackets (2026)
// Progressive tax: 10% on first 1.08M MKD, 18% above
export const TAX_BRACKETS = [
  { upTo: 1_080_000, rate: 0.1, label: "10%" },
  { upTo: Infinity, rate: 0.18, label: "18%" },
];

// Quarterly tax deadlines
export const QUARTERLY_DEADLINES = [
  { quarter: "Q1", deadline: "April 30", months: [1, 2, 3] },
  { quarter: "Q2", deadline: "July 31", months: [4, 5, 6] },
  { quarter: "Q3", deadline: "October 31", months: [7, 8, 9] },
  { quarter: "Q4", deadline: "January 31 (next year)", months: [10, 11, 12] },
];

// Standard DDV rate in Macedonia
export const DDV_RATE_STANDARD = 0.18; // 18%
export const DDV_RATE_REDUCED = 0.05; // 5%

export function calculateIncomeTax(annualIncomeMKD: number): {
  totalTax: number;
  effectiveRate: number;
  breakdown: { bracket: string; amount: number; tax: number }[];
} {
  let remaining = annualIncomeMKD;
  let totalTax = 0;
  const breakdown: { bracket: string; amount: number; tax: number }[] = [];

  for (let i = 0; i < TAX_BRACKETS.length; i++) {
    const bracket = TAX_BRACKETS[i];
    const prev = i === 0 ? 0 : TAX_BRACKETS[i - 1].upTo;
    const taxable = Math.min(remaining, bracket.upTo - prev);

    if (taxable <= 0) break;

    const tax = taxable * bracket.rate;
    totalTax += tax;
    breakdown.push({
      bracket: bracket.label,
      amount: taxable,
      tax,
    });

    remaining -= taxable;
    if (remaining <= 0) break;
  }

  return {
    totalTax,
    effectiveRate: annualIncomeMKD > 0 ? totalTax / annualIncomeMKD : 0,
    breakdown,
  };
}

export function getDDVStatus(annualIncomeMKD: number): {
  percentage: number;
  isRegistered: boolean;
  alertLevel: "safe" | "warning" | "critical" | "exceeded";
  remaining: number;
} {
  const percentage = (annualIncomeMKD / DDV_THRESHOLD_MKD) * 100;
  const remaining = DDV_THRESHOLD_MKD - annualIncomeMKD;

  let alertLevel: "safe" | "warning" | "critical" | "exceeded" = "safe";
  if (percentage >= 100) alertLevel = "exceeded";
  else if (percentage >= 85) alertLevel = "critical";
  else if (percentage >= 70) alertLevel = "warning";

  return {
    percentage: Math.min(percentage, 100),
    isRegistered: annualIncomeMKD >= DDV_THRESHOLD_MKD,
    alertLevel,
    remaining: Math.max(0, remaining),
  };
}

export function getNextQuarterlyDeadline(): {
  quarter: string;
  deadline: string;
  daysUntil: number;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const deadlines = [
    { quarter: "Q1", date: new Date(`${year}-04-30`) },
    { quarter: "Q2", date: new Date(`${year}-07-31`) },
    { quarter: "Q3", date: new Date(`${year}-10-31`) },
    { quarter: "Q4", date: new Date(`${year + 1}-01-31`) },
  ];

  for (const d of deadlines) {
    if (d.date > now) {
      const daysUntil = Math.ceil(
        (d.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        quarter: d.quarter,
        deadline: d.date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        daysUntil,
      };
    }
  }

  const nextQ4 = new Date(`${year + 1}-01-31`);
  return {
    quarter: "Q4",
    deadline: nextQ4.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    daysUntil: Math.ceil(
      (nextQ4.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  };
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

// Approximate MKD rates. These are the only rates the app uses: nothing calls
// a live rate service, and each invoice stores the rate it was created with.
// Values are NBRM middle rates (среден курс) from the exchange rate list
// formed on 20 November 2026 (valid from 21 November 2026), rounded to one
// decimal, retrieved from
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

export function formatMKD(amount: number): string {
  return new Intl.NumberFormat("mk-MK", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " ден.";
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
