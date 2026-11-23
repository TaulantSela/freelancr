"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markMonthUjp, switchMonthToNbrsmRates } from "@/lib/actions/payments";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

// A month's е-ПДД, one step at a time: filed (with the calculation number, if
// you have it), approved (with UJP's folio number from the recapitulation),
// paid (on the day you paid against the PP53 order).
export function MonthUjpActions({
  month,
  today,
  canFile,
  canApprove,
  canPay,
}: {
  month: string;
  today: string;
  canFile: boolean;
  canApprove: boolean;
  canPay: boolean;
}) {
  const t = useTranslations();
  const a = t.payments.monthActions;
  const [reference, setReference] = useState("");
  const [folio, setFolio] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [pending, startTransition] = useTransition();

  function run(step: "filed" | "approved" | "paid", value: string) {
    startTransition(async () => {
      const result = await markMonthUjp(month, step, value);
      if ("errorKey" in result) toast.error(a.errors[result.errorKey]);
      else toast.success(formatMessage(a.marked, { count: result.changed }));
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {canFile && (
        <div className="flex gap-2">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={a.calculationNumber}
            aria-label={a.calculationNumber}
            className="h-8 text-xs min-w-0"
          />
          <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={pending} onClick={() => run("filed", reference)}>
            {a.markFiled}
          </Button>
        </div>
      )}
      {canApprove && (
        <div className="flex gap-2">
          <Input
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder={a.folioNumber}
            aria-label={a.folioNumber}
            className="h-8 text-xs min-w-0"
          />
          <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={pending} onClick={() => run("approved", folio)}>
            {a.markApproved}
          </Button>
        </div>
      )}
      {canPay && (
        <div className="flex gap-2">
          <Input
            type="date"
            max={today}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            aria-label={a.paidOn}
            className="h-8 text-xs min-w-0"
          />
          <Button size="sm" className="h-8 shrink-0 gap-1" disabled={pending} onClick={() => run("paid", paidOn)}>
            {pending && <Loader2 className="h-3 w-3 animate-spin" />}
            {a.markPaid}
          </Button>
        </div>
      )}
    </div>
  );
}

// For a month with backfilled payments: look up the National Bank's rate for
// each one's day and use it instead of the invoice's.
export function UseNbrsmRatesButton({ month }: { month: string }) {
  const t = useTranslations();
  const a = t.payments.monthActions;
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await switchMonthToNbrsmRates(month);
          if ("errorKey" in result) toast.error(a.errors[result.errorKey]);
          else toast.success(formatMessage(a.ratesUpdated, { count: result.changed }));
        })
      }
    >
      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
      {a.useNbrsmRates}
    </Button>
  );
}
