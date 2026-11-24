import { formatMessage } from "@/lib/i18n/format";
import type { Dictionary, Locale } from "@/lib/i18n/types";
import { countryName } from "@/lib/clients/countries";
import { formatCurrency, formatMKD } from "@/lib/tax/calculator";
import { epddMonth, type EpddPayment } from "@/lib/tax/epdd";
import { toNbrsmDate } from "@/lib/rates/nbrsm";

// A month's "What to type into e-PDD": for each self-reported payment, the
// values for UJP's form (one calculation each, whole units) and what UJP's
// calculation should come to (lib/tax/epdd.ts). Open while the month still
// has something to file.
export function EpddPanel({
  payments,
  open,
  locale,
  t,
}: {
  payments: readonly (EpddPayment & { clientName: string })[];
  open: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const e = t.payments.epdd;
  const { entries, owedMKD } = epddMonth(payments);
  if (entries.length === 0) return null;
  const clientOf = new Map(payments.map((p) => [p.id, p.clientName]));
  return (
    <details open={open} className="group rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">{e.title}</summary>
      <div className="space-y-3 px-3 pb-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{e.intro}</p>
        {entries.map((entry, i) => (
          <div key={entry.paymentId} className="space-y-2 rounded-md bg-muted/40 p-3">
            <div className="text-xs font-medium">
              {formatMessage(e.payment, { n: i + 1, count: entries.length, client: clientOf.get(entry.paymentId) ?? "" })}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">{e.receivedOn}</dt>
              <dd className="font-mono">{toNbrsmDate(entry.receivedOn)}</dd>
              <dt className="text-muted-foreground">{e.country}</dt>
              <dd>{countryName(entry.clientCountry, locale)}</dd>
              <dt className="text-muted-foreground">{e.currency}</dt>
              <dd className="font-mono">{entry.currency}</dd>
              <dt className="text-muted-foreground">{e.amount}</dt>
              <dd>
                <span className="font-mono font-medium">{entry.amount}</span>
                {entry.amount !== entry.exactAmount && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({formatMessage(e.exact, { amount: formatCurrency(entry.exactAmount, entry.currency) })})
                  </span>
                )}
              </dd>
              {entry.exactTaxPaidAbroad > 0 && (
                <>
                  <dt className="text-muted-foreground">{e.taxPaidAbroad}</dt>
                  <dd>
                    <span className="font-mono font-medium">{entry.taxPaidAbroad}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      ({e.taxPaidAbroadHint}
                      {entry.taxPaidAbroad !== entry.exactTaxPaidAbroad &&
                        `; ${formatMessage(e.exact, { amount: formatCurrency(entry.exactTaxPaidAbroad, entry.currency) })}`}
                      )
                    </span>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">{e.kind}</dt>
              <dd>
                {entry.deemedCostsRate > 0
                  ? formatMessage(e.kindAuthor, { rate: Math.round(entry.deemedCostsRate * 100) })
                  : e.kindServices}
              </dd>
            </dl>
            <p className="text-xs text-muted-foreground">
              {e.ujpWill}:{" "}
              <span className="font-mono">
                {formatMessage(entry.creditMKD > 0 ? e.ujpLine : e.ujpLineNoCredit, {
                  income: formatMKD(entry.incomeMKD),
                  tax: formatMKD(entry.taxMKD),
                  credit: formatMKD(entry.creditMKD),
                  owed: formatMKD(entry.owedMKD),
                })}
              </span>
            </p>
          </div>
        ))}
        <div className="flex justify-between gap-4 text-sm font-medium">
          <span>{e.total}</span>
          <span className="font-mono">{formatMKD(owedMKD)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{e.totalNote}</p>
      </div>
    </details>
  );
}
