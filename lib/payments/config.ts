// Payments: money a client actually sent, the day it reached the account.
// Income is realised on that day (Personal Income Tax law Art. 93(2)), so
// payments, not invoices, are what the monthly tax is worked out from.

// Where the MKD rate of a payment came from: the National Bank's middle rate
// on the day received, a rate the user typed because the National Bank
// couldn't be reached, or (only for payments backfilled from invoices marked
// paid before payments existed) the invoice's stored rate.
export const PAYMENT_RATE_SOURCES = ["nbrsm", "manual", "invoice"] as const;
export type PaymentRateSource = (typeof PAYMENT_RATE_SOURCES)[number];

// Who deals with the income tax on a payment, fixed when it's saved:
// - "business": the user is a registered self-employed person; it's business
//   income for the annual balance, with no monthly е-ППД and no withholding;
// - "withheld": a company in North Macedonia paid; it keeps business books, so
//   it withheld the 10% when it paid (Art. 80(1));
// - "self_reported": a client abroad (income from abroad, Art. 87(1) point 3)
//   or a private person in North Macedonia (Art. 87(1) point 6) paid; the user
//   files the calculation and pays the tax.
export const TAX_TREATMENTS = ["business", "withheld", "self_reported"] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

// Where a self-reported payment's monthly calculation (е-ППД) stands: filed
// with UJP, approved (UJP issues a recapitulation with a folio number and a
// PP53 payment order to pay against), then paid.
export const UJP_STATUSES = ["to_file", "filed", "approved", "paid"] as const;
export type UjpStatus = (typeof UJP_STATUSES)[number];

export const PAYMENT_CHANNELS = [
  "bank",
  "paypal",
  "wise",
  "payoneer",
  "platform",
  "cash",
  "other",
] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

// Deemed costs for income from author's and related rights (Art. 40(1)):
// 50% sculpture, tapestry, ceramics, stained glass; 40% art photography,
// murals, painting, graphic and industrial design, costume and fashion design,
// scenography, musical and film works, restoration; 30% scientific,
// professional and journalistic works, performing serious music, ballet,
// opera, acting, recitation, filming; 20% translations, lectures and other
// author's works. Anything else (most freelance work, which is "income from
// work" under Art. 14, including service contracts with foreign persons) has
// none: 0.
export const DEEMED_COSTS_RATES = [0, 0.2, 0.3, 0.4, 0.5] as const;
export type DeemedCostsRate = (typeof DEEMED_COSTS_RATES)[number];

export function isDeemedCostsRate(value: number): value is DeemedCostsRate {
  return (DEEMED_COSTS_RATES as readonly number[]).includes(value);
}

export function isPaymentChannel(value: unknown): value is PaymentChannel {
  return (
    typeof value === "string" &&
    (PAYMENT_CHANNELS as readonly string[]).includes(value)
  );
}

// The treatment a payment gets when it's saved.
export function taxTreatmentFor(
  taxStatus: string,
  client: { country: string; clientType: string }
): TaxTreatment {
  if (taxStatus === "self_employed") return "business";
  if (client.country === "MK" && client.clientType === "company") return "withheld";
  return "self_reported";
}
