"use client";

import { useEffect, useState } from "react";
import { lookupRate, type RateResult } from "@/lib/actions/rates";

export type NbrsmRateState =
  | { status: "ready"; rate: number; date: string }
  | { status: "loading" }
  | { status: "unavailable" };

// The NBRSM middle rate for `currency` on `date`, looked up on the server
// (lookupRate) whenever either changes. MKD is 1 without a lookup.
export function useNbrsmRate(currency: string, date: string): NbrsmRateState {
  const key = `${currency}:${date}`;
  const [answer, setAnswer] = useState<{ key: string; result: RateResult } | null>(null);

  useEffect(() => {
    if (currency === "MKD" || !date) return;
    let cancelled = false;
    lookupRate(currency, date)
      .then((result) => {
        if (!cancelled) setAnswer({ key, result });
      })
      .catch(() => {
        if (!cancelled) setAnswer({ key, result: { unavailable: true } });
      });
    return () => {
      cancelled = true;
    };
  }, [currency, date, key]);

  if (currency === "MKD") return { status: "ready", rate: 1, date };
  if (!answer || answer.key !== key) return { status: "loading" };
  if ("rate" in answer.result) {
    return { status: "ready", rate: answer.result.rate, date: answer.result.date };
  }
  return { status: "unavailable" };
}
