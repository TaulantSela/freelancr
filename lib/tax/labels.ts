import type { Dictionary } from "@/lib/i18n/types";
import { formatMessage } from "@/lib/i18n/format";
import type { TaxDeadline, TaxDeadlineGroup } from "./calculator";

// "2026-12-10" -> "10 December 2026", with the month in the user's language.
export function formatTaxDate(date: string, t: Dictionary): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${t.tax.months[month - 1]} ${year}`;
}

// "2026-11" -> "November 2026"; a tax year ("2026") stays as it is.
export function formatTaxPeriod(period: string, t: Dictionary): string {
  if (!period.includes("-")) return period;
  const [year, month] = period.split("-").map(Number);
  return `${t.tax.months[month - 1]} ${year}`;
}

// A whole sentence, e.g. "Submit the tax calculation for November 2026 income".
export function taxDeadlineLabel(deadline: TaxDeadline, t: Dictionary): string {
  return formatMessage(t.tax.deadlines[deadline.kind], {
    period: formatTaxPeriod(deadline.period, t),
  });
}

// One line under a group's title, e.g. "Submit the calculation by 10 December 2026".
export function taxDeadlineAction(deadline: TaxDeadline, t: Dictionary): string {
  return formatMessage(t.tax.actions[deadline.kind], {
    date: formatTaxDate(deadline.dueDate, t),
  });
}

// A group's title, e.g. "November 2026 income".
export function taxDeadlineGroupTitle(group: TaxDeadlineGroup, t: Dictionary): string {
  return formatMessage(t.tax.groups[group.kind], {
    period: formatTaxPeriod(group.period, t),
  });
}
