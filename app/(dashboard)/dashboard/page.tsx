import { getSession } from "@/lib/auth/session";
import { getDb, invoices, clients } from "@/lib/db";
import { eq, sum, count, and, gte, inArray } from "drizzle-orm";
import {
  getDDVStatus,
  getLocalSupplies,
  getUpcomingTaxDeadlines,
  getSelfReportedIncomeMonths,
  getOwedToUjp,
  toSkopjeDate,
  daysBetween,
  formatMKD,
  formatCurrency,
  DDV_THRESHOLD_MKD,
} from "@/lib/tax/calculator";
import {
  getTaxProfile,
  getPaidInvoicesForDeadlines,
  getInvoicesForThreshold,
} from "@/lib/tax/queries";
import { formatTaxDate, formatTaxPeriod, taxDeadlineLabel } from "@/lib/tax/labels";
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
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";

type InvoiceStatus = keyof Dictionary["invoices"]["status"];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const { t } = await getTranslations();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;

  const [annualStats] = await getDb()
    .select({ totalMKD: sum(invoices.totalMKD), totalInvoices: count() })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, session.userId),
        eq(invoices.status, "paid"),
        gte(invoices.date, yearStart)
      )
    );

  const annualIncomeMKD = Number(annualStats?.totalMKD ?? 0);

  // Issued and not paid yet, overdue or not.
  const [outstandingStats] = await getDb()
    .select({ cnt: count() })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, session.userId),
        inArray(invoices.status, ["sent", "overdue"])
      )
    );

  const recentInvoices = await getDb()
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      total: invoices.total,
      currency: invoices.currency,
      status: invoices.status,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.userId, session.userId))
    .orderBy(invoices.createdAt)
    .limit(5);

  // The next UJP deadline for how the user is registered for tax. When not
  // registered, only months with self-reported income (a client abroad or a
  // private person in North Macedonia paid) have deadlines, and the tax owed
  // is 10% of that income (approximate; see getOwedToUjp).
  const today = toSkopjeDate(new Date());
  const { taxStatus, monthlyAdvanceMKD, vatRegistered } = await getTaxProfile(session.userId);

  // The DDV threshold counts this year's supplies in North Macedonia only
  // (getLocalSupplies). It doesn't apply once registered for VAT, and
  // there's nothing to show without a local supply.
  const thisYear = Number(today.slice(0, 4));
  const localSupplies = vatRegistered
    ? { totalMKD: 0, count: 0 }
    : getLocalSupplies(await getInvoicesForThreshold(session.userId, thisYear), thisYear);
  const showDdv = !vatRegistered && localSupplies.count > 0;
  const ddvStatus = getDDVStatus(localSupplies.totalMKD);
  const notRegistered = taxStatus === "paid_from_abroad";
  const payments = notRegistered
    ? await getPaidInvoicesForDeadlines(session.userId, Number(today.slice(0, 4)))
    : [];
  const incomeMonths = getSelfReportedIncomeMonths(payments);
  const owed = getOwedToUjp(payments, today);
  // The payment coming up: last month's until the 15th, then this month's.
  const owedNext = owed.due ?? owed.current;
  const hasOwed = owed.due !== null || owed.current.incomeMKD > 0;
  const upcomingDeadlines = getUpcomingTaxDeadlines(taxStatus, today, incomeMonths);
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

  const statusColors: Record<string, string> = {
    paid: "text-emerald-400",
    sent: "text-blue-400",
    overdue: "text-red-400",
    draft: "text-zinc-400",
    cancelled: "text-zinc-500",
  };

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatMessage(t.dashboard.welcome, { name: session.name, year })}
          </p>
        </div>
        <Link href="/invoices/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> {t.dashboard.newInvoice}
          </Button>
        </Link>
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                <div className="text-xl font-mono font-semibold">{formatMKD(owedNext.taxMKD)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatMessage(t.tax.owed.tileDue, {
                    month: formatTaxPeriod(owedNext.month, t),
                    date: formatTaxDate(owedNext.payBy, t),
                  })}
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
                {t.dashboard.annualIncome}
              </span>
            </div>
            <div className="text-xl font-mono font-semibold">{formatMKD(annualIncomeMKD)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatMessage(t.dashboard.paidInvoicesYear, { year })}
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
            <div className="text-xl font-mono font-semibold">{outstandingStats?.cnt ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t.dashboard.awaitingPayment}</div>
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid gap-4", showDdv && "md:grid-cols-2")}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              {t.tax.owed.title}
              {notRegistered && (
                <Badge variant="outline" className="text-xs font-normal">
                  {t.tax.owed.approximate}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notRegistered ? (
              hasOwed ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-border px-3 py-2.5 space-y-0.5">
                    <div className="text-xs text-muted-foreground">
                      {formatMessage(owed.due ? t.tax.owed.forMonth : t.tax.owed.soFar, {
                        month: formatTaxPeriod(owedNext.month, t),
                      })}
                    </div>
                    <div className="text-xl font-mono font-semibold">
                      {formatMKD(owedNext.taxMKD)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatMessage(t.tax.owed.fileAndPay, {
                        reportBy: formatTaxDate(owedNext.reportBy, t),
                        payBy: formatTaxDate(owedNext.payBy, t),
                      })}
                    </div>
                  </div>
                  {owed.due && (
                    <div className="flex justify-between gap-4 text-sm px-3">
                      <span className="text-muted-foreground">
                        {formatMessage(t.tax.owed.soFar, {
                          month: formatTaxPeriod(owed.current.month, t),
                        })}
                      </span>
                      <span className="font-mono text-xs">{formatMKD(owed.current.taxMKD)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t.tax.owed.nothing}</p>
              )
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
            {notRegistered && hasOwed && (
              <p className="text-xs text-muted-foreground">{t.tax.owed.note}</p>
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
                <div className="flex justify-between text-sm mb-2">
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
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">{t.dashboard.recentInvoices}</CardTitle>
          <Link href="/invoices">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
              {t.common.viewAll}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
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
              {recentInvoices.map((inv, i) => {
                const statusKey = inv.status as InvoiceStatus;
                const statusLabel = t.invoices.status[statusKey] ?? inv.status;
                return (
                  <div key={inv.id}>
                    <div className="flex items-center gap-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              inv.number ? "font-mono" : "italic text-muted-foreground"
                            )}
                          >
                            {inv.number ?? t.invoices.status.draft}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("text-xs border-0 px-1.5", statusColors[inv.status])}
                          >
                            {statusLabel}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">{inv.clientName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono">
                          {formatCurrency(inv.total, inv.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(inv.date)}</div>
                      </div>
                    </div>
                    {i < recentInvoices.length - 1 && <Separator />}
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
