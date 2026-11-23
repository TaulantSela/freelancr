import { getSession } from "@/lib/auth/session";
import { getDb, invoices, clients } from "@/lib/db";
import { eq, and, inArray, isNotNull, desc } from "drizzle-orm";
import {
  getDDVStatus,
  getLocalSupplies,
  getUpcomingTaxDeadlines,
  toSkopjeDate,
  daysBetween,
  formatMKD,
  formatCurrency,
  DDV_THRESHOLD_MKD,
} from "@/lib/tax/calculator";
import {
  getTaxProfile,
  getInvoicesForThreshold,
  getPayoutsForThreshold,
} from "@/lib/tax/queries";
import { formatTaxDate, formatTaxPeriod, taxDeadlineLabel } from "@/lib/tax/labels";
import { getPaymentsReceived, getPaymentYears, getSettledByInvoice } from "@/lib/payments/queries";
import { invoiceStanding } from "@/lib/payments/settlement";
import {
  deadlineMet,
  owedToUjp,
  selfReportedMonths,
  summarizeMonths,
  summarizeYear,
  type MonthSummary,
} from "@/lib/tax/payments";
import { formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  TrendingUp,
  FileText,
  Plus,
  Calendar,
  Clock,
  CircleDollarSign,
} from "lucide-react";
import { InvoiceStandingBadge } from "@/components/invoices/invoice-standing-badge";
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const { t } = await getTranslations();
  const today = toSkopjeDate(new Date());
  const thisYear = Number(today.slice(0, 4));
  const yearStart = `${thisYear}-01-01`;

  const [profile, rows, paymentYears, issued, settledByInvoice, recent] = await Promise.all([
    getTaxProfile(session.userId),
    // This year's payments, plus earlier self-reported ones UJP isn't paid
    // for yet: those are still owed.
    getPaymentsReceived(session.userId, yearStart, today, { includeOlderUnpaid: true }),
    getPaymentYears(session.userId),
    getDb()
      .select({
        id: invoices.id,
        status: invoices.status,
        total: invoices.total,
        dueDate: invoices.dueDate,
        exchangeRateMKD: invoices.exchangeRateMKD,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, session.userId),
          isNotNull(invoices.number),
          inArray(invoices.status, ["sent", "paid", "overdue"])
        )
      ),
    getSettledByInvoice(session.userId),
    getDb()
      .select({
        id: invoices.id,
        number: invoices.number,
        date: invoices.date,
        dueDate: invoices.dueDate,
        total: invoices.total,
        currency: invoices.currency,
        status: invoices.status,
        clientName: clients.name,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoices.userId, session.userId))
      .orderBy(desc(invoices.createdAt))
      .limit(5),
  ]);
  const { taxStatus, monthlyAdvanceMKD, vatRegistered } = profile;
  const notRegistered = taxStatus === "paid_from_abroad";

  // What's owed to UJP, from the payments: every self-reported month not
  // marked paid yet, late ones first.
  const months = summarizeMonths(rows, today);
  const owed = owedToUjp(months, today);
  const openMonths = [...owed.late, owed.due, owed.current].filter(
    (m): m is MonthSummary => m !== null && m.status !== "nothing" && m.status !== "paid"
  );
  const approximate = openMonths.some((m) => m.hasOtherRates);
  const year = summarizeYear(summarizeMonths(rows.filter((r) => r.receivedOn >= yearStart), today));
  const yearPayments = rows.filter((r) => r.receivedOn >= yearStart).length;

  // Outstanding: issued invoices with something left to pay, in MKD at each
  // invoice's rate.
  const unpaid = issued
    .map((inv) => ({ inv, standing: invoiceStanding(inv, settledByInvoice.get(inv.id) ?? 0, today) }))
    .filter(({ standing }) => standing.balance > 0);
  const outstandingMKD = unpaid.reduce((s, { inv, standing }) => s + standing.balance * inv.exchangeRateMKD, 0);

  // The DDV threshold counts this year's supplies in North Macedonia only
  // (getLocalSupplies). It doesn't apply once registered for VAT, and
  // there's nothing to show without a local supply.
  const localSupplies = vatRegistered
    ? { totalMKD: 0, count: 0 }
    : getLocalSupplies(
        await getInvoicesForThreshold(session.userId, thisYear),
        thisYear,
        await getPayoutsForThreshold(session.userId, thisYear)
      );
  const showDdv = !vatRegistered && localSupplies.count > 0;
  const ddvStatus = getDDVStatus(localSupplies.totalMKD);

  // The next UJP deadline for how the user is registered for tax, leaving
  // out what's already done: a month's calculation once it's filed, its
  // payment once it's paid.
  const monthByKey = new Map(months.map((m) => [m.month, m]));
  const upcomingDeadlines = getUpcomingTaxDeadlines(
    taxStatus,
    today,
    selfReportedMonths(rows),
    paymentYears
  ).filter((d) => !deadlineMet(d, monthByKey));
  const nextAdvance = upcomingDeadlines.find((d) => d.kind === "advance");
  const [nextDeadline] = upcomingDeadlines;
  // Everything due on the next date (an advance and the annual balance can
  // share 15 March), then the first deadline after it.
  const dueWithNext = nextDeadline
    ? upcomingDeadlines.filter((d) => d.dueDate === nextDeadline.dueDate)
    : [];
  const thenDeadline =
    nextDeadline && upcomingDeadlines.find((d) => d.dueDate > nextDeadline.dueDate);
  const daysToNext = nextDeadline ? daysBetween(today, nextDeadline.dueDate) : null;
  const nextDeadlineWhen =
    nextDeadline &&
    formatMessage(
      daysToNext === 0
        ? t.dashboard.dueToday
        : daysToNext === 1
        ? t.dashboard.dueTomorrow
        : t.dashboard.daysAway,
      { date: formatTaxDate(nextDeadline.dueDate, t), days: daysToNext ?? 0 }
    );

  const ddvColors = {
    safe: "bg-emerald-500",
    warning: "bg-yellow-500",
    critical: "bg-orange-500",
    exceeded: "bg-red-500",
  };

  const ddvBadge = {
    safe: { label: t.dashboard.ddvSafe, variant: "outline" as const },
    warning: { label: t.dashboard.ddvWarning, variant: "outline" as const },
    critical: { label: t.dashboard.ddvCritical, variant: "destructive" as const },
    exceeded: { label: t.dashboard.ddvExceeded, variant: "destructive" as const },
  };

  const owedTileNote =
    owed.late.length > 0
      ? formatMessage(t.dashboard.owedLateMonths, { count: owed.late.length })
      : owed.due
      ? formatMessage(t.tax.owed.tileDue, {
          month: formatTaxPeriod(owed.due.month, t),
          date: formatTaxDate(owed.due.payBy, t),
        })
      : owed.current && owed.current.unpaidOwedMKD > 0
      ? formatMessage(t.dashboard.owedSoFarNote, {
          month: formatTaxPeriod(owed.current.month, t),
          date: formatTaxDate(owed.current.payBy, t),
        })
      : t.dashboard.owedNothingShort;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatMessage(t.dashboard.welcome, { name: session.name, year: thisYear })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/payments/new">
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> {t.payments.newPayment}
            </Button>
          </Link>
          <Link href="/invoices/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> {t.dashboard.newInvoice}
            </Button>
          </Link>
        </div>
      </div>

      {showDdv && ddvStatus.alertLevel !== "safe" && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
            ddvStatus.alertLevel === "exceeded"
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
          )}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            {ddvStatus.alertLevel === "exceeded"
              ? t.dashboard.ddvAlertExceeded
              : formatMessage(t.dashboard.ddvAlertWarning, {
                  pct: ddvStatus.percentage.toFixed(1),
                  remaining: formatMKD(ddvStatus.remaining),
                })}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.tax.owed.title}
              </span>
            </div>
            {notRegistered ? (
              <>
                <div
                  className={cn(
                    "text-xl font-mono font-semibold",
                    owed.late.length > 0 && "text-red-400"
                  )}
                >
                  {formatMKD(owed.totalUnpaidMKD)}
                </div>
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    owed.late.length > 0 ? "text-red-400" : "text-muted-foreground"
                  )}
                >
                  {owedTileNote}
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-mono font-semibold">
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
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {formatMessage(t.dashboard.receivedIn, { year: thisYear })}
              </span>
            </div>
            <div className="text-xl font-mono font-semibold">{formatMKD(year.receivedMKD)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatMessage(t.dashboard.paymentsCount, { count: yearPayments })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.dashboard.outstanding}
              </span>
            </div>
            <div className="text-xl font-mono font-semibold">{formatMKD(outstandingMKD)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatMessage(t.dashboard.awaitingPayment, { count: unpaid.length })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid gap-4", showDdv && "md:grid-cols-2")}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
              {t.tax.owed.title}
              <span className="flex items-center gap-2">
                {notRegistered && approximate && (
                  <Badge variant="outline" className="text-xs font-normal text-amber-400">
                    {t.tax.owed.approximate}
                  </Badge>
                )}
                <Link
                  href="/payments"
                  className="text-xs font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {t.nav.payments}
                </Link>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notRegistered ? (
              <OwedToUjpDetails owed={owed} alreadyPaidMKD={year.alreadyPaidForYouMKD} year={thisYear} t={t} />
            ) : (
              <div className="space-y-2">
                {nextAdvance && (
                  <div className="rounded-lg border border-border px-3 py-2.5 space-y-0.5">
                    <div className="text-xs text-muted-foreground">
                      {formatMessage(t.tax.owed.advanceFor, {
                        month: formatTaxPeriod(nextAdvance.period, t),
                      })}
                    </div>
                    <div className="text-xl font-mono font-semibold">
                      {monthlyAdvanceMKD !== null ? formatMKD(monthlyAdvanceMKD) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatMessage(t.tax.owed.advancePayBy, {
                        date: formatTaxDate(nextAdvance.dueDate, t),
                      })}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {monthlyAdvanceMKD !== null ? t.tax.owed.advanceSet : t.tax.owed.advanceHint}{" "}
                  <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
                    {monthlyAdvanceMKD !== null ? t.tax.changeInSettings : t.tax.owed.addInSettings}
                  </Link>
                </p>
              </div>
            )}
            <Separator />
            <div className="flex items-start gap-3 bg-muted/50 rounded-lg px-3 py-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-medium">{t.dashboard.nextDeadline}</div>
                {nextDeadline ? (
                  <>
                    {dueWithNext.map((d) => (
                      <div key={`${d.kind}-${d.period}`} className="text-xs">
                        {taxDeadlineLabel(d, t)}
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground">{nextDeadlineWhen}</div>
                    {thenDeadline && (
                      <div className="text-xs text-muted-foreground">
                        {formatMessage(t.tax.then, {
                          label: taxDeadlineLabel(thenDeadline, t),
                          date: formatTaxDate(thenDeadline.dueDate, t),
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">{t.tax.noUpcoming}</div>
                )}
                <div className="text-xs text-muted-foreground pt-1">
                  {formatMessage(t.tax.basedOn, { status: t.tax.statuses[taxStatus] })}{" "}
                  <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
                    {t.tax.changeInSettings}
                  </Link>
                </div>
              </div>
              {daysToNext !== null && daysToNext <= 7 && (
                <AlertTriangle className="h-4 w-4 text-yellow-500 ml-auto shrink-0" />
              )}
            </div>
            {notRegistered && openMonths.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {approximate ? t.tax.owed.noteApproximate : t.tax.owed.note}
              </p>
            )}
          </CardContent>
        </Card>
        {showDdv && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                {t.dashboard.ddvMonitor}
                <Badge variant={ddvBadge[ddvStatus.alertLevel].variant} className="text-xs font-normal">
                  {ddvBadge[ddvStatus.alertLevel].label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between gap-4 text-sm mb-2">
                  <span className="text-muted-foreground">
                    {formatMessage(t.dashboard.localSupplies, { year: thisYear })}
                  </span>
                  <span className="font-mono text-sm">{formatMKD(localSupplies.totalMKD)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", ddvColors[ddvStatus.alertLevel])}
                    style={{ width: `${Math.min(ddvStatus.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{ddvStatus.percentage.toFixed(1)}%</span>
                  <span>
                    {formatMKD(ddvStatus.remaining)} {t.dashboard.remaining}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.dashboard.ddvThreshold}</span>
                  <span className="font-mono text-xs">{formatMKD(DDV_THRESHOLD_MKD)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.dashboard.ddvStatus}</span>
                  <span className="text-xs">
                    {ddvStatus.mustRegister ? t.dashboard.mustRegister : t.dashboard.notRequired}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t.dashboard.ddvLocalOnly}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            {t.dashboard.recentInvoices}
            <Link
              href="/invoices"
              className="text-xs font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {t.common.viewAll}
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{t.dashboard.noInvoices}</p>
              <Link href="/invoices/new">
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> {t.dashboard.createFirst}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-0">
              {recent.map((inv, i) => {
                const standing = invoiceStanding(inv, settledByInvoice.get(inv.id) ?? 0, today);
                const showBalance = inv.status !== "draft" && inv.status !== "cancelled" && standing.balance > 0;
                return (
                  <div key={inv.id}>
                    <Link href={`/invoices/${inv.id}`} className="flex items-center gap-4 py-2.5 hover:bg-accent/30 -mx-2 px-2 rounded">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              inv.number ? "font-mono" : "italic text-muted-foreground"
                            )}
                          >
                            {inv.number ?? t.invoices.standing.draft}
                          </span>
                          {/* A draft without a number already reads "Draft". */}
                          {inv.number && <InvoiceStandingBadge status={standing.status} />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{inv.clientName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono">
                          {formatCurrency(inv.total, inv.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {showBalance
                            ? formatMessage(t.dashboard.balanceLeft, {
                                amount: formatCurrency(standing.balance, inv.currency),
                              })
                            : formatDate(inv.date)}
                        </div>
                      </div>
                    </Link>
                    {i < recent.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Late months in red, the month due next, this month so far, and what
// companies in North Macedonia already paid for the user this year.
function OwedToUjpDetails({
  owed,
  alreadyPaidMKD,
  year,
  t,
}: {
  owed: ReturnType<typeof owedToUjp>;
  alreadyPaidMKD: number;
  year: number;
  t: Dictionary;
}) {
  const current = owed.current && owed.current.unpaidOwedMKD > 0 ? owed.current : null;
  const nothing = owed.late.length === 0 && !owed.due && !current;
  return (
    <div className="space-y-2">
      {owed.late.map((m) => (
        <Link
          key={m.month}
          href={`/payments?year=${m.month.slice(0, 4)}#month-${m.month}`}
          className="block rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 space-y-0.5 text-red-400"
        >
          <div className="text-xs">
            {formatMessage(t.tax.owed.forMonth, { month: formatTaxPeriod(m.month, t) })} ·{" "}
            {t.payments.ujpStatuses.late}
          </div>
          <div className="text-xl font-mono font-semibold">{formatMKD(m.unpaidOwedMKD)}</div>
          <div className="text-xs">
            {formatMessage(m.filed ? t.dashboard.notPaidBy : t.dashboard.notFiledBy, {
              date: formatTaxDate(m.filed ? m.payBy : m.reportBy, t),
            })}
          </div>
        </Link>
      ))}
      {owed.due && (
        <Link
          href={`/payments?year=${owed.due.month.slice(0, 4)}#month-${owed.due.month}`}
          className="block rounded-lg border border-border px-3 py-2.5 space-y-0.5 hover:bg-accent/30"
        >
          <div className="text-xs text-muted-foreground">
            {formatMessage(t.tax.owed.forMonth, { month: formatTaxPeriod(owed.due.month, t) })} ·{" "}
            {t.payments.ujpStatuses[owed.due.status]}
          </div>
          <div className="text-xl font-mono font-semibold">{formatMKD(owed.due.unpaidOwedMKD)}</div>
          <div className="text-xs text-muted-foreground">
            {formatMessage(t.tax.owed.fileAndPay, {
              reportBy: formatTaxDate(owed.due.reportBy, t),
              payBy: formatTaxDate(owed.due.payBy, t),
            })}
          </div>
        </Link>
      )}
      {current && (
        <div className="flex justify-between gap-4 text-sm px-3">
          <span className="text-muted-foreground">
            {formatMessage(t.tax.owed.soFar, { month: formatTaxPeriod(current.month, t) })}
          </span>
          <span className="font-mono text-xs">{formatMKD(current.unpaidOwedMKD)}</span>
        </div>
      )}
      {nothing && <p className="text-xs text-muted-foreground">{t.tax.owed.nothing}</p>}
      {alreadyPaidMKD > 0 && (
        <div className="flex justify-between gap-4 text-sm px-3">
          <span className="text-muted-foreground">
            {formatMessage(t.dashboard.alreadyPaidYear, { year })}
          </span>
          <span className="font-mono text-xs">{formatMKD(alreadyPaidMKD)}</span>
        </div>
      )}
    </div>
  );
}
