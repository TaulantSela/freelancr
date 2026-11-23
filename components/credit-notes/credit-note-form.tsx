"use client";

import { useState, useTransition } from "react";
import { FileMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCreditNote } from "@/lib/actions/credit-notes";
import { creditNoteDdv } from "@/lib/credit-notes/amounts";
import { formatCurrency } from "@/lib/tax/calculator";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

// Issues a credit note on an invoice: a date (not after today, not before
// the invoice), an amount up to what's left to credit, and a reason. On an
// invoice with DDV the amount includes it, split in the invoice's
// proportion.
export function CreditNoteForm({
  invoiceId,
  currency,
  ddvRate,
  creditable,
  today,
  invoiceDate,
}: {
  invoiceId: string;
  currency: string;
  ddvRate: number;
  creditable: number;
  today: string;
  invoiceDate: string;
}) {
  const t = useTranslations();
  const c = t.creditNotes;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(creditable));
  const [pending, startTransition] = useTransition();
  const value = Number(amount.replace(",", "."));
  const ddv = value > 0 ? creditNoteDdv(value, ddvRate) : 0;

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <FileMinus className="h-3.5 w-3.5" /> {c.issue}
      </Button>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createCreditNote(invoiceId, fd);
      if ("errorKey" in result) {
        toast.error(
          formatMessage(c.errors[result.errorKey], { amount: formatCurrency(creditable, currency) })
        );
      } else {
        toast.success(formatMessage(c.issued, { number: result.number }));
        setOpen(false);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-border p-3">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cn-date">{c.date}</Label>
          <Input id="cn-date" name="date" type="date" defaultValue={today} min={invoiceDate} max={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cn-amount">
            {formatMessage(ddvRate > 0 ? c.amount : c.amountPlain, { currency })}
          </Label>
          <Input
            id="cn-amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono"
            required
          />
          <p className="text-xs text-muted-foreground">
            {formatMessage(c.amountHint, { amount: formatCurrency(creditable, currency) })}
            {ddvRate > 0 &&
              value > 0 &&
              ` ${formatMessage(c.ddvSplit, {
                base: formatCurrency(value - ddv, currency),
                ddv: formatCurrency(ddv, currency),
              })}`}
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cn-reason">{c.reason}</Label>
        <Textarea id="cn-reason" name="reason" rows={2} placeholder={c.reasonPlaceholder} required />
      </div>
      <p className="text-xs text-muted-foreground">{c.numberNote}</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {c.submit}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
