"use client";

import { useTransition } from "react";
import { updateInvoiceStatus } from "@/lib/actions/invoices";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "@/lib/i18n/client";

// The statuses an issued invoice can be moved between. A draft has no menu
// (it leaves "draft" only by being issued, which gives it a number), and
// neither has a cancelled invoice (cancelling is final; see
// CancelInvoiceButton).
const OPEN_STATUS_KEYS = ["sent", "paid", "overdue"] as const;
type InvoiceStatus = "draft" | "cancelled" | (typeof OPEN_STATUS_KEYS)[number];

const statusColors: Record<InvoiceStatus, string> = {
  paid: "text-emerald-400 border-emerald-400/30",
  sent: "text-blue-400 border-blue-400/30",
  overdue: "text-red-400 border-red-400/30",
  draft: "text-zinc-400 border-zinc-400/30",
  cancelled: "text-zinc-500 border-zinc-500/30",
};

export function InvoiceStatusButton({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const status = currentStatus as InvoiceStatus;
  const label = t.invoices.status[status] ?? currentStatus;

  if (status === "draft" || status === "cancelled") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded border text-xs",
          statusColors[status]
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs transition-opacity",
              statusColors[status] ?? statusColors.draft,
              pending && "opacity-50 cursor-not-allowed"
            )}
          >
            {label}
            <ChevronDown className="h-3 w-3" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-36">
        {OPEN_STATUS_KEYS.map((opt) => (
          <DropdownMenuItem
            key={opt}
            className={cn("text-xs cursor-pointer", opt === status && "font-medium")}
            onClick={() => startTransition(() => updateInvoiceStatus(id, opt))}
          >
            {t.invoices.status[opt]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
