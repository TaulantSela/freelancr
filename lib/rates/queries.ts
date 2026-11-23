import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb, exchangeRateCache } from "@/lib/db";
import { fetchNbrsmRates, type NbrsmRate } from "./nbrsm";

// NBRSM middle rates, cached in exchange_rate_cache: id "YYYY-MM-DD:EUR",
// from_currency = the code, to_currency = "MKD", source = "nbrsm". A list
// never changes once published, so a cached day is never fetched again.

export type RateLookup = { rate: number; date: string };

async function cacheRates(rates: readonly NbrsmRate[]) {
  if (rates.length === 0) return;
  await getDb()
    .insert(exchangeRateCache)
    .values(
      rates.map((r) => ({
        id: `${r.date}:${r.code}`,
        date: r.date,
        fromCurrency: r.code,
        toCurrency: "MKD",
        rate: r.rate,
        source: "nbrsm",
      }))
    )
    .onConflictDoUpdate({
      target: exchangeRateCache.id,
      set: { rate: sql`excluded.rate`, source: sql`excluded.source` },
    });
}

// The middle rate for one unit of `currency` on `date`, from the cache or
// the National Bank. MKD is always 1. A date after `today` is refused (the
// list may not exist yet, and income can't be received in the future), and
// so is anything the service can't give: both return null, and the caller
// asks for the rate or falls back.
export async function getRateToMkd(
  currency: string,
  date: string,
  today: string
): Promise<RateLookup | null> {
  if (currency === "MKD") return { rate: 1, date };
  if (date > today) return null;

  const [cached] = await getDb()
    .select({ rate: exchangeRateCache.rate })
    .from(exchangeRateCache)
    .where(
      and(
        eq(exchangeRateCache.id, `${date}:${currency}`),
        eq(exchangeRateCache.source, "nbrsm")
      )
    )
    .limit(1);
  if (cached) return { rate: cached.rate, date };

  const fetched = await fetchNbrsmRates(date, date);
  if (!fetched) return null;
  await cacheRates(fetched);
  const hit = fetched.find((r) => r.date === date && r.code === currency);
  return hit ? { rate: hit.rate, date } : null;
}

// Fetches and caches every rate from `from` to `to` in one request, then
// returns the cached rates for those days and currencies, keyed
// "YYYY-MM-DD:EUR". Days the service didn't return are simply missing.
export async function getRatesForRange(
  from: string,
  to: string,
  currencies: readonly string[]
): Promise<Map<string, number>> {
  const wanted = currencies.filter((c) => c !== "MKD");
  const fetched = await fetchNbrsmRates(from, to);
  if (fetched) await cacheRates(fetched);
  const rows =
    wanted.length === 0
      ? []
      : await getDb()
          .select({ id: exchangeRateCache.id, rate: exchangeRateCache.rate })
          .from(exchangeRateCache)
          .where(
            and(
              gte(exchangeRateCache.date, from),
              lte(exchangeRateCache.date, to),
              inArray(exchangeRateCache.fromCurrency, wanted),
              eq(exchangeRateCache.source, "nbrsm")
            )
          );
  return new Map(rows.map((r) => [r.id, r.rate]));
}
