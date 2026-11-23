"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRateToMkd } from "@/lib/rates/queries";
import { isSupportedCurrency, toSkopjeDate } from "@/lib/tax/calculator";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type RateResult =
  | { rate: number; date: string }
  | { unavailable: true }
  | { errorKey: "invalid" | "future" };

// For the invoice and payment forms: the NBRSM middle rate for one unit of
// `currency` on `date`, so the form can show it as the date or currency
// changes. Signed-in users only; the actions that save look the rate up again
// and don't trust what the form sends.
export async function lookupRate(currency: string, date: string): Promise<RateResult> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  if (!isSupportedCurrency(currency) || !DATE_PATTERN.test(date)) {
    return { errorKey: "invalid" };
  }
  const today = toSkopjeDate(new Date());
  if (date > today) return { errorKey: "future" };

  return (await getRateToMkd(currency, date, today)) ?? { unavailable: true };
}
