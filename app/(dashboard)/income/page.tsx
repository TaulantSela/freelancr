import { getSession } from "@/lib/auth/session";
import { getDb, invoices, clients } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";
import {
  getDDVStatus,
  getTaxCalendar,
  groupTaxDeadlines,
  getSelfReportedIncomeMonths,
  getMonthlyTaxOwed,
  getOwedToUjp,
  toSkopjeDate,
  daysBetween,
  formatMKD,
  DDV_THRESHOLD_MKD,
} from "@/lib/tax/calculator";
import { getTaxProfile, getPaidInvoicesForDeadlines } from "@/lib/tax/queries";
import {
  formatTaxDate,
  formatTaxPeriod,
  taxDeadlineAction,
  taxDeadlineGroupTitle,
} from "@/lib/tax/labels";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Calendar, Info } from "lucide-react";
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";

export default async function IncomePage() {
  const session = await getSession();
  if (!session) return null;

  const { t } = await getTranslations();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;

  // All paid invoices this year
  const paidInvoices = await getDb()
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      currency: invoices.currency,
      total: invoices.total,
      totalMKD: invoices.totalMKD,
      exchangeRateMKD: invoices.exchangeRateMKD,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.userId, session.userId),
        eq(invoices.status, "paid"),
        gte(invoices.date, yearStart)
      )
    )
    .orderBy(invoices.date);

  const annualIncomeMKD = paidInvoices.reduce((s, i) => s + i.totalMKD, 0);
  const ddvStatus = getDDVStatus(annualIncomeMKD);

  // UJP deadlines due from 1 January, for how the user is registered for tax.
  // When not registered, they follow the month each invoice was paid in,
  // which can differ from the invoice date the breakdowns below use, and each
  // month's group shows 10% of that month's self-reported income.
  const today = toSkopjeDate(new Date());
  const { taxStatus, monthlyAdvanceMKD } = await getTaxProfile(session.userId);
  const notRegistered = taxStatus === "paid_from_abroad";
  const payments = notRegistered
    ? await getPaidInvoicesForDeadlines(session.userId, year)
    : [];
  const incomeMonths = getSelfReportedIncomeMonths(payments);
  const owedByMonth = new Map(getMonthlyTaxOwed(payments).map((m) => [m.month, m]));
  const owed = getOwedToUjp(payments, today);
  const owedNext = owed.due ?? owed.current;
  const taxCalendar = getTaxCalendar(taxStatus, year, incomeMonths);
  const deadlineGroups = groupTaxDeadlines(taxCalendar);
  const nextDueDate = taxCalendar.find((d) => d.dueDate >= today)?.dueDate;
  const nextAdvance = taxCalendar.find((d) => d.kind === "advance" && d.dueDate >= today);

  const ddvBadgeLabels = {
    safe: t.dashboard.ddvSafe,
    warning: t.dashboard.ddvWarning,
    critical: t.dashboard.ddvCritical,
    exceeded: t.dashboard.ddvExceeded,
  };

  const alertItems = [
    { label: t.income.alert70, threshold: DDV_THRESHOLD_MKD * 0.7, reached: annualIncomeMKD >= DDV_THRESHOLD_MKD * 0.7 },
    { label: t.income.alert85, threshold: DDV_THRESHOLD_MKD * 0.85, reached: annualIncomeMKD >= DDV_THRESHOLD_MKD * 0.85 },
    { label: t.income.alert100, threshold: DDV_THRESHOLD_MKD, reached: annualIncomeMKD >= DDV_THRESHOLD_MKD },
  ];

  // Income by currency
  const byCurrency: Record<string, number> = {};
  for (const inv of paidInvoices) {
    byCurrency[inv.currency] = (byCurrency[inv.currency] ?? 0) + inv.total;
  }

  // Income by client
  const byClient: Record<string, { name: string; totalMKD: number; invoiceCount: number }> = {};
  for (const inv of paidInvoices) {
    const name = inv.clientName ?? "Unknown";
    if (!byClient[name]) byClient[name] = { name, totalMKD: 0, invoiceCount: 0 };
    byClient[name].totalMKD += inv.totalMKD;
    byClient[name].invoiceCount++;
  }
  const clientBreakdown = Object.values(byClient).sort((a, b) => b.totalMKD - a.totalMKD);

  // Running total (cumulative MKD by month)
  const monthlyIncome: Record<string, number> = {};
  for (const inv of paidInvoices) {
    const month = inv.date.slice(0, 7); // YYYY-MM
    monthlyIncome[month] = (monthlyIncome[month] ?? 0) + inv.totalMKD;
  }

  const ddvColors = {
    safe: "bg-emerald-500",
    warning: "bg-yellow-500",
    critical: "bg-orange-500",
    exceeded: "bg-red-500",
  };

  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    return `${year}-${m}`;
  });

  let runningTotal = 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t.income.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatMessage(t.income.subtitle, { year })}
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {t.tax.owed.title}
            </div>
            {notRegistered ? (
              <>
                <div className="text-lg font-mono font-semibold">{formatMKD(owedNext.taxMKD)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatMessage(t.tax.owed.tileDue, {
                    month: formatTaxPeriod(owedNext.month, t),
                    date: formatTaxDate(owedNext.payBy, t),
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-mono font-semibold">
                  {monthlyAdvanceMKD !== null ? formatMKD(monthlyAdvanceMKD) : "—"}
                </div>
                {nextAdvance && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatMessage(t.tax.owed.advanceTile, {
                      date: formatTaxDate(nextAdvance.dueDate, t),
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {t.income.grossIncome}
            </div>
            <div className="text-lg font-mono font-semibold">{formatMKD(annualIncomeMKD)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatMessage(t.income.invoicesPaid, { count: paidInvoices.length })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {t.income.ddvThresholdPct}
            </div>
            <div className="text-lg font-mono font-semibold">
              {ddvStatus.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatMKD(ddvStatus.remaining)} {t.dashboard.remaining}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {/* DDV Tracker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              {t.income.ddvMonitor}
              <Badge
                variant={ddvStatus.alertLevel === "safe" ? "outline" : "destructive"}
                className="text-xs font-normal"
              >
                {ddvBadgeLabels[ddvStatus.alertLevel]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{t.income.currentAnnual}</span>
                <span className="font-mono text-sm">{formatMKD(annualIncomeMKD)}</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", ddvColors[ddvStatus.alertLevel])}
                  style={{ width: `${Math.min(ddvStatus.percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>{ddvStatus.percentage.toFixed(1)}%</span>
                <span>{formatMKD(DDV_THRESHOLD_MKD)}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {alertItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  {item.reached ? (
                    <div className="h-4 w-4 rounded-full bg-red-500 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-muted-foreground shrink-0" />
                  )}
                  <span className={item.reached ? "text-foreground" : "text-muted-foreground"}>
                    {item.label}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {formatMKD(item.threshold)}
                  </span>
                </div>
              ))}
            </div>

            {ddvStatus.alertLevel !== "safe" && (
              <div className="flex items-start gap-2 text-xs bg-yellow-500/10 text-yellow-400 rounded px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {ddvStatus.alertLevel === "exceeded"
                    ? t.income.ddvExceededMsg
                    : formatMessage(t.income.ddvWarningMsg, {
                        remaining: formatMKD(ddvStatus.remaining),
                      })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {formatMessage(t.income.taxDeadlines, { year })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t.tax.rules[taxStatus]}</p>
          {deadlineGroups.length === 0 ? (
            <div className="text-xs text-muted-foreground py-1">{t.tax.noneInYear}</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {deadlineGroups.map((group) => {
                const upcoming = group.deadlines.find((d) => d.dueDate >= today);
                const isPast = !upcoming;
                const isNext = group.deadlines.some((d) => d.dueDate === nextDueDate);
                const daysUntil = upcoming ? daysBetween(today, upcoming.dueDate) : null;
                return (
                  <div
                    key={`${group.kind}-${group.period}`}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm",
                      isPast
                        ? "border-border bg-muted/20"
                        : isNext
                        ? "border-yellow-500/40 bg-yellow-500/5"
                        : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-medium">{taxDeadlineGroupTitle(group, t)}</span>
                      {isNext ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                      ) : (
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    {group.kind === "income" && owedByMonth.has(group.period) && (
                      <div className="text-sm font-mono mb-1">
                        {formatMessage(t.tax.owed.groupAmount, {
                          amount: formatMKD(owedByMonth.get(group.period)!.taxMKD),
                        })}
                      </div>
                    )}
                    {/* The amount entered in Settings; only for advances still
                        to pay, since earlier ones may have been different. */}
                    {group.kind === "advance" && !isPast && monthlyAdvanceMKD !== null && (
                      <div className="text-sm font-mono mb-1">{formatMKD(monthlyAdvanceMKD)}</div>
                    )}
                    {group.deadlines.map((d) => (
                      <div key={d.kind} className="text-xs text-muted-foreground mb-1">
                        {taxDeadlineAction(d, t)}
                      </div>
                    ))}
                    {daysUntil === null ? (
                      <div className="text-xs text-muted-foreground">{t.income.passed}</div>
                    ) : (
                      <div
                        className={cn(
                          "text-xs font-medium",
                          daysUntil <= 7 ? "text-yellow-400" : "text-muted-foreground"
                        )}
                      >
                        {daysUntil === 0
                          ? t.income.dueToday
                          : daysUntil === 1
                          ? t.income.dueTomorrow
                          : formatMessage(t.income.daysAway, { days: daysUntil })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {notRegistered && owedByMonth.size > 0 && (
            <div className="bg-muted/50 rounded px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{t.tax.owed.note}</span>
            </div>
          )}
          {!notRegistered && (
            <p className="text-xs text-muted-foreground">
              {monthlyAdvanceMKD !== null ? t.tax.owed.advanceSet : t.tax.owed.advanceHint}{" "}
              <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
                {monthlyAdvanceMKD !== null ? t.tax.changeInSettings : t.tax.owed.addInSettings}
              </Link>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {formatMessage(t.tax.basedOn, { status: t.tax.statuses[taxStatus] })}{" "}
            <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
              {t.tax.changeInSettings}
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {formatMessage(t.income.monthlyBreakdown, { year })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {allMonths.map((month, i) => {
              const income = monthlyIncome[month] ?? 0;
              runningTotal += income;
              const monthLabel = new Date(month + "-01").toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              });
              const isFuture = new Date(month + "-01") > new Date();
              return (
                <div key={month}>
                  <div className="flex items-center gap-4 py-2">
                    <span className="text-sm text-muted-foreground w-28">{monthLabel}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width:
                            annualIncomeMKD > 0
                              ? `${(income / annualIncomeMKD) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-mono text-sm w-40 text-right",
                        isFuture && !income ? "text-muted-foreground/40" : ""
                      )}
                    >
                      {income > 0 ? formatMKD(income) : "—"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground w-40 text-right">
                      {runningTotal > 0 ? formatMKD(runningTotal) : "—"}
                    </span>
                  </div>
                  {i < 11 && <Separator />}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between pt-3 border-t border-border text-sm font-medium mt-2">
            <span>{t.income.annualTotal}</span>
            <span className="font-mono">{formatMKD(annualIncomeMKD)}</span>
          </div>
        </CardContent>
      </Card>

      {clientBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t.income.byClient}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientBreakdown.map((client) => (
                <div key={client.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{client.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {client.invoiceCount} {t.income.invShort}
                      </span>
                      <span className="font-mono">{formatMKD(client.totalMKD)}</span>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {annualIncomeMKD > 0
                          ? ((client.totalMKD / annualIncomeMKD) * 100).toFixed(0) + "%"
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full"
                      style={{
                        width:
                          annualIncomeMKD > 0
                            ? `${(client.totalMKD / annualIncomeMKD) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
