"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";
import type { InvoiceDisplayStatus } from "@/lib/payments/settlement";

const colors: Record<InvoiceDisplayStatus, string> = {
  draft: "text-zinc-400 border-zinc-400/30",
  issued: "text-blue-400 border-blue-400/30",
  partly_paid: "text-amber-400 border-amber-400/30",
  paid: "text-emerald-400 border-emerald-400/30",
  overdue: "text-red-400 border-red-400/30",
  cancelled: "text-zinc-500 border-zinc-500/30",
};

// Where an invoice stands, worked out from its payments and due date
// (invoiceStanding in lib/payments/settlement.ts). There's no status menu:
// recording payments is what moves an invoice to partly paid or paid.
export function InvoiceStandingBadge({
  status,
  className,
}: {
  status: InvoiceDisplayStatus;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded border text-xs",
        colors[status],
        className
      )}
    >
      {t.invoices.standing[status]}
    </span>
  );
}
