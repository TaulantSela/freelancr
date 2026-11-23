// Middle exchange rates (среден курс) of the National Bank of the Republic of
// North Macedonia (NBRSM). UJP converts foreign-currency income at the middle
// rate on the day the income is received (Personal Income Tax law Art.
// 93(2)), and VAT at the middle rate on the day the tax liability arises
// (VAT law Art. 20).
//
// GET .../GetExchangeRate?StartDate=dd.MM.yyyy&EndDate=dd.MM.yyyy&format=json
// returns one row per currency (31 of them) for every CALENDAR day in the
// range, weekends and holidays included: Sunday 22.11.2026 comes back with
// datum 2026-11-22T00:00:00 and datum_f 2026-11-20T00:00:00 (the Friday the
// list was formed). A day without a list yet answers 404.
// Fields used: oznaka (currency code), sreden (middle rate), nomin (units the
// rate is for), datum (the day the list applies), datum_f (the day it was
// formed). The rate for one unit is sreden / nomin.
//
// Nothing here runs at import or build time; callers fetch on request.

export const NBRSM_ENDPOINT = "https://www.nbrm.mk/KLServiceNOV/GetExchangeRate";
export const NBRSM_TIMEOUT_MS = 5000;

export type NbrsmRate = {
  // "YYYY-MM-DD": the day the list applies to.
  date: string;
  // ISO 4217 code, e.g. "EUR".
  code: string;
  // MKD for one unit of the currency.
  rate: number;
  // "YYYY-MM-DD": the day the list was formed, when given.
  formedOn: string | null;
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

// "2026-11-22" -> "22.11.2026"
export function toNbrsmDate(date: string): string {
  const m = DAY.exec(date);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function nbrsmUrl(from: string, to: string): string {
  return `${NBRSM_ENDPOINT}?StartDate=${toNbrsmDate(from)}&EndDate=${toNbrsmDate(to)}&format=json`;
}

function dayOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = DAY.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// The rows of a response, one rate per day and currency. Rows that don't
// have a day, a three-letter code and a positive rate are skipped.
export function parseNbrsmRates(json: unknown): NbrsmRate[] {
  if (!Array.isArray(json)) return [];
  const rates: NbrsmRate[] = [];
  for (const row of json) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const date = dayOf(r.datum);
    const code = typeof r.oznaka === "string" ? r.oznaka.trim().toUpperCase() : "";
    const middle = Number(r.sreden);
    const units = r.nomin === undefined || r.nomin === null ? 1 : Number(r.nomin);
    if (!date || !/^[A-Z]{3}$/.test(code)) continue;
    if (!(middle > 0) || !(units > 0) || !Number.isFinite(middle / units)) continue;
    // Rounded to 8 decimals so 15.81 / 100 is 0.1581, not 0.15810000000000002.
    const rate = Number((middle / units).toFixed(8));
    rates.push({ date, code, rate, formedOn: dayOf(r.datum_f) });
  }
  return rates;
}

// Every rate from `from` to `to` (inclusive), or null when the service
// doesn't answer in time, answers with an error, or has no rates.
export async function fetchNbrsmRates(
  from: string,
  to: string,
  fetchImpl: typeof fetch = fetch
): Promise<NbrsmRate[] | null> {
  try {
    const res = await fetchImpl(nbrsmUrl(from, to), {
      signal: AbortSignal.timeout(NBRSM_TIMEOUT_MS),
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const rates = parseNbrsmRates(await res.json());
    return rates.length > 0 ? rates : null;
  } catch {
    return null;
  }
}
