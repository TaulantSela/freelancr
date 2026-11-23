import Link from "next/link";
import { AlertTriangle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  daysBetween,
  formatMKD,
  groupTaxDeadlines,
  type TaxDeadline,
  type TaxStatus,
} from "@/lib/tax/calculator";
import { taxDeadlineAction, taxDeadlineGroupTitle } from "@/lib/tax/labels";
import { deadlineMet, type MonthSummary } from "@/lib/tax/payments";
import { formatMessage } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";

// Every UJP deadline due in `year`, grouped (a month's report and payment,
// an advance, an annual balance or return). A month's group shows its tax
// and where its е-ПДД stands; a deadline already met (the calculation filed,
// the tax paid) doesn't count as the next one.
export function TaxCalendar({
  year,
  today,
  taxStatus,
  monthlyAdvanceMKD,
  deadlines,
  months,
  t,
}: {
  year: number;
  today: string;
  taxStatus: TaxStatus;
  monthlyAdvanceMKD: number | null;
  deadlines: TaxDeadline[];
  months: MonthSummary[];
  t: Dictionary;
}) {
  const c = t.payments.calendar;
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const done = (d: TaxDeadline) => deadlineMet(d, byMonth);
  const nextDueDate = deadlines.find((d) => d.dueDate >= today && !done(d))?.dueDate;
  const groups = groupTaxDeadlines(deadlines);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatMessage(c.title, { year })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t.tax.rules[taxStatus]}</p>
        {groups.length === 0 ? (
          <div className="text-xs text-muted-foreground py-1">{t.tax.noneInYear}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((group) => {
              const month = group.kind === "income" ? byMonth.get(group.period) : undefined;
              const open = group.deadlines.filter((d) => !done(d));
              const upcoming = open.find((d) => d.dueDate >= today);
              const isNext = group.deadlines.some((d) => d.dueDate === nextDueDate && !done(d));
              const daysUntil = upcoming ? daysBetween(today, upcoming.dueDate) : null;
              const status = month?.status;
              return (
                <div
                  key={`${group.kind}-${group.period}`}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm",
                    status === "late"
                      ? "border-red-500/40 bg-red-500/5"
                      : !upcoming
                      ? "border-border bg-muted/20"
                      : isNext
                      ? "border-yellow-500/40 bg-yellow-500/5"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {month ? (
                      <Link
                        href={`#month-${group.period}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {taxDeadlineGroupTitle(group, t)}
                      </Link>
                    ) : (
                      <span className="font-medium">{taxDeadlineGroupTitle(group, t)}</span>
                    )}
                    {isNext || status === "late" ? (
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4 shrink-0",
                          status === "late" ? "text-red-400" : "text-yellow-500"
                        )}
                      />
                    ) : (
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {month && (
                    <div className="text-sm font-mono mb-1">
                      {formatMessage(t.tax.owed.groupAmount, { amount: formatMKD(month.owedMKD) })}
                    </div>
                  )}
                  {/* The amount entered in Settings; only for advances still
                      to pay, since earlier ones may have been different. */}
                  {group.kind === "advance" && upcoming && monthlyAdvanceMKD !== null && (
                    <div className="text-sm font-mono mb-1">{formatMKD(monthlyAdvanceMKD)}</div>
                  )}
                  {group.deadlines.map((d) => (
                    <div
                      key={d.kind}
                      className={cn("text-xs text-muted-foreground mb-1", done(d) && "line-through")}
                    >
                      {taxDeadlineAction(d, t)}
                    </div>
                  ))}
                  {status && status !== "nothing" ? (
                    <div
                      className={cn(
                        "text-xs font-medium",
                        status === "late"
                          ? "text-red-400"
                          : status === "paid"
                          ? "text-emerald-400"
                          : daysUntil !== null && daysUntil <= 7
                          ? "text-yellow-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {t.payments.ujpStatuses[status]}
                      {status !== "paid" && status !== "late" && daysUntil !== null && (
                        <> · {daysLabel(daysUntil, c)}</>
                      )}
                    </div>
                  ) : daysUntil === null ? (
                    <div className="text-xs text-muted-foreground">{c.passed}</div>
                  ) : (
                    <div
                      className={cn(
                        "text-xs font-medium",
                        daysUntil <= 7 ? "text-yellow-400" : "text-muted-foreground"
                      )}
                    >
                      {daysLabel(daysUntil, c)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {formatMessage(t.tax.basedOn, { status: t.tax.statuses[taxStatus] })}{" "}
          <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
            {t.tax.changeInSettings}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function daysLabel(days: number, c: Dictionary["payments"]["calendar"]): string {
  if (days === 0) return c.dueToday;
  if (days === 1) return c.dueTomorrow;
  return formatMessage(c.daysAway, { days });
}
