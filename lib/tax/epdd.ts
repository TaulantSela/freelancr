// What to type into UJP's e-PDD for a self-reported payment, and what UJP's
// calculation should come to. Pure.
//
// The form, as used for a real filing in 2026: one item per calculation, the
// amount in the payment's currency in whole units, the payer's country, and
// for a payer abroad the tax paid there, also in whole units. UJP converts at
// the NBRSM middle rate for the day the money arrived and works in whole
// denars, rounding each figure: the income, the 10% tax, and the credit for
// tax paid abroad (capped at the tax). That filing (EUR 1,520 with EUR 68
// Kosovo tax at 61.627) came to 9,367 − 4,191 = 5,176 MKD, which
// epddEntry reproduces (lib/tax/epdd.test.ts).
//
// Rounding the amounts to whole units: the income to the nearest unit, the
// tax paid abroad down, so the credit claimed is never more than was paid.
// An open question for an accountant; the UI shows the exact amounts too.

import { PERSONAL_INCOME_TAX_RATE } from "./calculator";
import type { TaxPayment } from "./payments";

// A payment as the tax maths reads it, with its currency.
export type EpddPayment = TaxPayment & { currency: string };

export type EpddEntry = {
  paymentId: string;
  // "YYYY-MM-DD": the day the money arrived, the date the form asks for.
  receivedOn: string;
  currency: string;
  clientCountry: string;
  // What the client paid, in the payment's currency: credited + fees + tax
  // withheld at source.
  exactAmount: number;
  // What to type: exactAmount to the nearest whole unit.
  amount: number;
  // Tax withheld abroad (clients abroad only), and what to type: rounded down.
  exactTaxPaidAbroad: number;
  taxPaidAbroad: number;
  deemedCostsRate: number;
  // What UJP's calculation should show, in whole denars.
  incomeMKD: number;
  baseMKD: number;
  taxMKD: number;
  creditMKD: number;
  owedMKD: number;
};

// Rounds after clearing floating-point noise, so 2.5000000000000004 and
// 2.4999999999999996 both count as 2.5.
function clean(x: number): number {
  return Number(x.toPrecision(12));
}

function toWholeDenars(x: number): number {
  return Math.round(clean(x));
}

export function epddEntry(p: EpddPayment): EpddEntry {
  const exactAmount = clean(p.amount + p.fees + p.taxWithheld);
  const amount = Math.round(exactAmount);
  const exactTaxPaidAbroad = p.clientCountry !== "MK" ? clean(p.taxWithheld) : 0;
  const taxPaidAbroad = Math.floor(exactTaxPaidAbroad);
  const incomeMKD = toWholeDenars(amount * p.rateToMKD);
  const baseMKD = toWholeDenars(incomeMKD * (1 - p.deemedCostsRate));
  const taxMKD = toWholeDenars(baseMKD * PERSONAL_INCOME_TAX_RATE);
  const creditMKD = Math.min(toWholeDenars(taxPaidAbroad * p.rateToMKD), taxMKD);
  return {
    paymentId: p.id,
    receivedOn: p.receivedOn,
    currency: p.currency,
    clientCountry: p.clientCountry,
    exactAmount,
    amount,
    exactTaxPaidAbroad,
    taxPaidAbroad,
    deemedCostsRate: p.deemedCostsRate,
    incomeMKD,
    baseMKD,
    taxMKD,
    creditMKD,
    owedMKD: taxMKD - creditMKD,
  };
}

// One entry per self-reported payment, in the order they arrived, and what
// they come to in all.
export function epddMonth(payments: readonly EpddPayment[]): { entries: EpddEntry[]; owedMKD: number } {
  const entries = payments
    .filter((p) => p.taxTreatment === "self_reported")
    .slice()
    .sort((a, b) => (a.receivedOn < b.receivedOn ? -1 : a.receivedOn > b.receivedOn ? 1 : 0))
    .map(epddEntry);
  return { entries, owedMKD: entries.reduce((s, e) => s + e.owedMKD, 0) };
}
