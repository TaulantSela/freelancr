import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Info, Paperclip, Plus } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatCurrency, formatMKD, getTaxCalendar, toSkopjeDate } from "@/lib/tax/calculator";
import { formatTaxDate, formatTaxPeriod } from "@/lib/tax/labels";
import { getTaxProfile } from "@/lib/tax/queries";
import { getPaymentsReceived, getPaymentYears, type PaymentRow } from "@/lib/payments/queries";
import {
  paymentTax,
  selfReportedMonths,
  summarizeMonths,
  summarizeYear,
  type MonthSummary,
  type UjpMonthStatus,
} from "@/lib/tax/payments";
import { MonthUjpActions, UseNbrsmRatesButton } from "@/components/payments/month-actions";
import { TaxCalendar } from "@/components/payments/tax-calendar";
import type { Dictionary } from "@/lib/i18n/types";

const STATUS_COLORS: Record<UjpMonthStatus, string> = {
  nothing: "text-muted-foreground border-border",
  to_file: "text-amber-400 border-amber-400/30",
  filed: "text-blue-400 border-blue-400/30",
  approved: "text-sky-400 border-sky-400/30",
  paid: "text-emerald-400 border-emerald-400/30",
  late: "text-red-400 border-red-400/40 bg-red-500/10",
};

// The year's payments by client: what each paid, per currency and in MKD.
function byClient(rows: readonly PaymentRow[]) {
  const clients = new Map<
    string,
    { id: string; name: string; count: number; receivedMKD: number; byCurrency: Map<string, number> }
  >();
  for (const r of rows) {
    const c =
      clients.get(r.clientId) ??
      { id: r.clientId, name: r.clientName, count: 0, receivedMKD: 0, byCurrency: new Map<string, number>() };
    c.count++;
    c.receivedMKD += paymentTax(r).receivedMKD;
    c.byCurrency.set(r.currency, (c.byCurrency.get(r.currency) ?? 0) + r.amount);
    clients.set(r.clientId, c);
  }
  return [...clients.values()].sort((a, b) => b.receivedMKD - a.receivedMKD);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { t } = await getTranslations();
  const today = toSkopjeDate(new Date());
  const currentYear = Number(today.slice(0, 4));
  const { year: yearParam } = await searchParams;
  const year = /^\d{4}$/.test(yearParam ?? "") ? Number(yearParam) : currentYear;

  // From December of the year before: its deadlines fall in January.
  const [{ taxStatus, monthlyAdvanceMKD }, years, fetched] = await Promise.all([
    getTaxProfile(session.userId),
    getPaymentYears(session.userId),
    getPaymentsReceived(session.userId, `${year - 1}-12-01`, `${year}-12-31`),
  ]);
  const rows = fetched.filter((r) => r.receivedOn >= `${year}-01-01`);
  const yearOptions = [...new Set([currentYear, year, ...years])].sort((a, b) => b - a);
  const notRegistered = taxStatus === "paid_from_abroad";
  const months = summarizeMonths(rows, today);
  const total = summarizeYear(months);
  const clients = byClient(rows);
  const calendarMonths = summarizeMonths(fetched, today);
  const calendar = getTaxCalendar(taxStatus, year, selfReportedMonths(fetched), years);
  const p = t.payments;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{p.title}</h1>
          <p className="text-sm text-muted-foreground">{formatMessage(p.subtitle, { year })}</p>
        </div>
        <Link href="/payments/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> {p.newPayment}
          </Button>
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label={p.yearLabel}>
        {yearOptions.map((y) => (
          <Link
            key={y}
            href={`/payments?year=${y}`}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              y === year
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {y}
          </Link>
        ))}
      </nav>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{formatMessage(p.yearSummary, { year })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Line label={p.received} value={formatMKD(total.receivedMKD)} />
          <Line label={p.grossIncome} value={formatMKD(total.grossMKD)} />
          {notRegistered ? (
            <>
              <Separator />
              <Line label={p.totalIncomeTax} value={formatMKD(total.totalIncomeTaxMKD)} strong />
              <Line label={p.owedPart} value={formatMKD(total.owedMKD)} indent />
              {total.creditMKD > 0 && <Line label={p.creditPart} value={formatMKD(total.creditMKD)} indent />}
              <Line label={p.alreadyPaidPart} value={formatMKD(total.alreadyPaidForYouMKD)} indent />
              {total.unpaidOwedMKD > 0 && (
                <Line
                  label={p.notPaidYet}
                  value={formatMKD(total.unpaidOwedMKD)}
                  warn={months.some((m) => m.status === "late")}
                />
              )}
              <p className="text-xs text-muted-foreground pt-1">
                {formatMessage(p.annualReturn, {
                  year,
                  confirmBy: formatTaxDate(`${year + 1}-05-31`, t),
                  payBy: formatTaxDate(`${year + 1}-06-30`, t),
                })}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground pt-1">
              {monthlyAdvanceMKD !== null
                ? formatMessage(p.selfEmployedAdvance, { amount: formatMKD(monthlyAdvanceMKD) })
                : p.selfEmployedNoAdvance}
            </p>
          )}
          {clients.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="text-xs font-medium">{p.byClient}</div>
                {clients.map((c) => (
                  <div key={c.id} className="flex flex-wrap justify-between gap-x-4 text-xs">
                    <span className="text-muted-foreground">
                      {c.name} · {formatMessage(p.paymentsCount, { count: c.count })}
                    </span>
                    <span className="font-mono">
                      {[...c.byCurrency]
                        .filter(([currency]) => currency !== "MKD")
                        .map(([currency, amount]) => `${formatCurrency(amount, currency)} · `)
                        .join("")}
                      {formatMKD(c.receivedMKD)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground flex gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {p.conversionNote} {p.feesNote}
            </span>
          </p>
        </CardContent>
      </Card>

      {months.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {formatMessage(p.empty, { year })}
          </CardContent>
        </Card>
      ) : (
        months.map((month) => (
          <MonthCard
            key={month.month}
            month={month}
            rows={rows.filter((r) => r.receivedOn.startsWith(`${month.month}-`))}
            notRegistered={notRegistered}
            today={today}
            t={t}
          />
        ))
      )}

      <TaxCalendar
        year={year}
        today={today}
        taxStatus={taxStatus}
        monthlyAdvanceMKD={monthlyAdvanceMKD}
        deadlines={calendar}
        months={calendarMonths}
        t={t}
      />
    </div>
  );
}

function MonthCard({
  month,
  rows,
  notRegistered,
  today,
  t,
}: {
  month: MonthSummary;
  rows: PaymentRow[];
  notRegistered: boolean;
  today: string;
  t: Dictionary;
}) {
  const p = t.payments;
  const selfReported = rows.filter((r) => r.taxTreatment === "self_reported");
  const hasInvoiceRates = rows.some((r) => r.rateSource === "invoice");
  return (
    <Card id={`month-${month.month}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
          <span>{formatTaxPeriod(month.month, t)}</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{formatMKD(month.receivedMKD)}</span>
            {notRegistered && month.status !== "nothing" && (
              <span className={cn("rounded border px-2 py-0.5 text-xs font-normal", STATUS_COLORS[month.status])}>
                {p.ujpStatuses[month.status]}
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <li key={r.id} className="px-3 py-2.5 text-sm space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-medium">
                  {formatTaxDate(r.receivedOn, t)} · {r.clientName}
                </span>
                <span className="font-mono">{formatCurrency(r.amount, r.currency)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{r.invoiceNumber ?? p.noInvoice}</span>
                  <span>·</span>
                  <span>{p.treatments[r.taxTreatment]}</span>
                  {r.taxTreatment === "self_reported" && r.ujpStatus && (
                    <>
                      <span>·</span>
                      <span>{p.ujpStatuses[r.ujpStatus]}</span>
                    </>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono">
                    {r.currency !== "MKD" && `× ${r.rateToMKD} `}
                    {r.rateSource !== "nbrsm" && (
                      <span className="text-amber-400">({p.rateSources[r.rateSource]}) </span>
                    )}
                    = {formatMKD(paymentTax(r).receivedMKD)}
                  </span>
                  <Link href={`/payments/${r.id}/edit`} className="underline underline-offset-2 hover:text-foreground">
                    {t.common.edit}
                  </Link>
                </span>
              </div>
              {(r.fees > 0 || r.taxWithheld > 0) && (
                <div className="text-xs text-muted-foreground">
                  {r.fees > 0 && formatMessage(p.feesLine, { amount: formatCurrency(r.fees, r.currency) })}
                  {r.fees > 0 && r.taxWithheld > 0 && " · "}
                  {r.taxWithheld > 0 &&
                    formatMessage(p.withheldLine, { amount: formatCurrency(r.taxWithheld, r.currency) })}
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 text-sm">
          {month.selfReportedGrossMKD > 0 && <Line label={p.selfReportedGross} value={formatMKD(month.selfReportedGrossMKD)} />}
          {month.withheldGrossMKD > 0 && <Line label={p.withheldGross} value={formatMKD(month.withheldGrossMKD)} />}
          {month.businessGrossMKD > 0 && <Line label={p.businessGross} value={formatMKD(month.businessGrossMKD)} />}
          {notRegistered && selfReported.length > 0 && (
            <>
              <Separator />
              <Line label={t.tax.owed.title} value={formatMKD(month.owedMKD)} strong warn={month.status === "late"} />
              {month.creditMKD > 0 && <Line label={p.creditPart} value={formatMKD(month.creditMKD)} indent />}
              <p className="text-xs text-muted-foreground">
                {formatMessage(t.tax.owed.fileAndPay, {
                  reportBy: formatTaxDate(month.reportBy, t),
                  payBy: formatTaxDate(month.payBy, t),
                })}
                {month.status === "late" && (
                  <span className="text-red-400"> · {p.ujpStatuses.late}</span>
                )}
              </p>
            </>
          )}
          {month.alreadyPaidForYouMKD > 0 && (
            <Line label={p.alreadyPaidPart} value={formatMKD(month.alreadyPaidForYouMKD)} />
          )}
        </div>

        {month.hasOtherRates && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 min-w-[12rem]">{p.otherRatesFlag}</span>
            {hasInvoiceRates && <UseNbrsmRatesButton month={month.month} />}
          </div>
        )}

        {notRegistered && selfReported.length > 0 && month.status !== "paid" && (
          <MonthUjpActions
            month={month.month}
            today={today}
            canFile={selfReported.some((r) => r.ujpStatus === "to_file" || r.ujpStatus === null)}
            canApprove={selfReported.some((r) => r.ujpStatus !== "approved" && r.ujpStatus !== "paid")}
            canPay={selfReported.some((r) => r.ujpStatus !== "paid")}
          />
        )}

        {notRegistered && selfReported.length > 0 && (
          <p className="text-xs text-muted-foreground flex gap-1.5">
            <Paperclip className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{p.evidenceHint}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Line({
  label,
  value,
  strong,
  indent,
  warn,
}: {
  label: string;
  value: string;
  strong?: boolean;
  indent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "font-medium", indent && "pl-3 text-xs")}>
      <span className={cn(!strong && "text-muted-foreground", warn && "text-red-400")}>{label}</span>
      <span className={cn("font-mono", warn && "text-red-400")}>{value}</span>
    </div>
  );
}
