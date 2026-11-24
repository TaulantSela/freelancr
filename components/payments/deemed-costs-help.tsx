"use client";

import { DEEMED_COSTS_RATES } from "@/lib/payments/config";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

// "How does this work?" under the choice of what a client (or a payment)
// pays for: the rule in a sentence, a worked example, and the tax each
// choice leaves on 1,000 (Personal Income Tax law, Art. 40). Closed until
// asked for.
export function DeemedCostsHelp() {
  const t = useTranslations();
  const h = t.payments.deemedHelp;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none w-fit underline underline-offset-2 hover:text-foreground">
        {h.summary}
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        <p>{h.intro}</p>
        <p>{h.example}</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-foreground/80">
              <th className="py-1 pr-3 font-medium">{h.work}</th>
              <th className="py-1 pr-3 font-medium whitespace-nowrap">{h.deducted}</th>
              <th className="py-1 font-medium whitespace-nowrap text-right">{h.taxOn}</th>
            </tr>
          </thead>
          <tbody>
            {DEEMED_COSTS_RATES.map((r) => (
              <tr key={r} className="border-t border-border/60 align-top">
                <td className="py-1 pr-3">
                  {t.payments.deemedKinds[String(r) as keyof typeof t.payments.deemedKinds]}
                </td>
                <td className="py-1 pr-3 font-mono tabular-nums">{Math.round(r * 100)}%</td>
                <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatMessage(h.taxAmount, { n: Math.round(100 * (1 - r)) })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{h.services}</p>
      </div>
    </details>
  );
}
