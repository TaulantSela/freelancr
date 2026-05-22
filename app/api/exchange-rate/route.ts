import { NextResponse } from "next/server";
import { FALLBACK_RATES } from "@/lib/tax/calculator";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get("currency")?.toUpperCase() ?? "EUR";

  // Try to fetch from a free exchange rate API
  try {
    const res = await fetch(
      `https://api.exchangerate-api.com/v4/latest/MKD`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (res.ok) {
      const data = await res.json();
      // The API returns rates relative to MKD base
      // We want MKD per foreign currency
      const ratePerMKD = data.rates[currency];
      if (ratePerMKD) {
        const mkdPerForeign = 1 / ratePerMKD;
        return NextResponse.json({
          currency,
          rate: mkdPerForeign,
          source: "exchangerate-api",
          date: data.date,
        });
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Return fallback rate
  const fallbackRate = FALLBACK_RATES[currency] ?? 61.5;
  return NextResponse.json({
    currency,
    rate: fallbackRate,
    source: "fallback",
    note: "Using approximate rate. For official tax purposes, use NBRM (www.nbrm.mk).",
  });
}
