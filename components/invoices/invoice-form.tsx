"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { createInvoice, updateInvoice } from "@/lib/actions/invoices";
import {
  SUPPORTED_CURRENCIES,
  DDV_RATE_REDUCED,
  DDV_RATE_STANDARD,
  formatCurrency,
  formatMKD,
  getRateToMKD,
} from "@/lib/tax/calculator";
import Link from "next/link";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";
import { formatTaxDate } from "@/lib/tax/labels";
import { useNbrsmRate } from "@/components/rates/use-nbrsm-rate";

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

// A draft being edited. Issued invoices never reach the form: they're locked.
export type DraftInvoice = {
  id: string;
  clientId: string;
  date: string;
  supplyDate: string;
  dueDate: string | null;
  currency: string;
  ddvRate: number;
  notes: string | null;
  items: LineItem[];
};

export function InvoiceForm({
  clients,
  vatRegistered,
  today,
  dueDefault,
  draft,
}: {
  clients: { id: string; name: string; currency: string }[];
  // Only a VAT-registered user gets the DDV rate choice; the action forces
  // 0 for everyone else anyway.
  vatRegistered: boolean;
  // "YYYY-MM-DD" in North Macedonia, from the server: the default invoice
  // date, and the default due date 30 days later.
  today: string;
  dueDefault: string;
  // Set when editing a draft; otherwise the form creates one.
  draft?: DraftInvoice;
}) {
  const t = useTranslations();
  const f = t.invoices.form;
  const [items, setItems] = useState<LineItem[]>(
    draft?.items.length ? draft.items : [{ description: "", quantity: 1, unitPrice: 0 }]
  );
  const [currency, setCurrency] = useState(draft?.currency ?? clients[0]?.currency ?? "EUR");
  const [ddvRate, setDdvRate] = useState(vatRegistered ? (draft?.ddvRate ?? 0) : 0);
  const [date, setDate] = useState(draft?.date ?? today);
  // The date of supply follows the invoice date until it's changed by hand
  // (a draft's counts as changed when it differs from its invoice date).
  const [supplyDate, setSupplyDate] = useState(draft?.supplyDate ?? today);
  const [supplyDateEdited, setSupplyDateEdited] = useState(
    draft ? draft.supplyDate !== draft.date : false
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const ddvOptions = [
    { label: f.noDdv, value: 0 },
    { label: f.reducedDdv, value: DDV_RATE_REDUCED },
    { label: f.standardDdv, value: DDV_RATE_STANDARD },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const ddvAmount = subtotal * ddvRate;
  const total = subtotal + ddvAmount;
  // The NBRSM middle rate on the date of supply (today's while it's still
  // ahead), as the action will save it; the fixed approximate rate only if the
  // National Bank can't be reached.
  const rateDate = supplyDate && supplyDate < today ? supplyDate : today;
  const nbrsm = useNbrsmRate(currency, rateDate);
  const rate = nbrsm.status === "ready" ? nbrsm.rate : getRateToMKD(currency);
  const totalMKD = total * rate;
  const rateLabel =
    nbrsm.status === "ready"
      ? formatMessage(f.nbrsmRate, {
          currency,
          rate: String(nbrsm.rate),
          date: formatTaxDate(nbrsm.date, t),
        })
      : nbrsm.status === "loading"
      ? f.rateLoading
      : `${formatMessage(f.approximateRate, { currency, rate: String(rate) })} · ${f.rateUnavailable}`;

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.some((item) => !item.description || item.unitPrice <= 0)) {
      toast.error(f.fillItems);
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("items", JSON.stringify(items));
    fd.set("currency", currency);
    if (vatRegistered) fd.set("ddvRate", ddvRate.toString());

    startTransition(async () => {
      const result = draft ? await updateInvoice(draft.id, fd) : await createInvoice(fd);
      if (result?.errorKey) toast.error(f[result.errorKey]);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="clientId">
            {f.client} <span className="text-destructive">*</span>
          </Label>
          <select
            name="clientId"
            id="clientId"
            required
            defaultValue={draft?.clientId}
            onChange={(e) => {
              const selected = clients.find((c) => c.id === e.target.value);
              if (selected) setCurrency(selected.currency);
            }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id} className="bg-card">
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">{f.currency}</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-card">
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">
            {f.invoiceDate} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (!supplyDateEdited) setSupplyDate(e.target.value);
            }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supplyDate">
            {f.supplyDate} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="supplyDate"
            name="supplyDate"
            type="date"
            value={supplyDate}
            onChange={(e) => {
              setSupplyDate(e.target.value);
              setSupplyDateEdited(true);
            }}
            required
          />
          <p className="text-xs text-muted-foreground">{f.supplyDateHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">{f.dueDate}</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={draft ? (draft.dueDate ?? "") : dueDefault}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{f.lineItems}</Label>
          {currency !== "MKD" && (
            <span className="text-xs text-muted-foreground text-right">{rateLabel}</span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_80px_110px_32px] gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <div>{f.description}</div>
          <div className="text-center">{f.qty}</div>
          <div className="text-right">{formatMessage(f.unitPrice, { currency })}</div>
          <div />
        </div>

        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_110px_32px] gap-2 items-center">
            <Input
              placeholder={f.description}
              value={item.description}
              onChange={(e) => updateItem(i, "description", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={item.quantity}
              onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 1)}
              className="h-8 text-sm text-center"
            />
            <Input
              type="number"
              min={0}
              step={0.01}
              value={item.unitPrice || ""}
              placeholder="0.00"
              onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
              className="h-8 text-sm text-right font-mono"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(i)}
              disabled={items.length === 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" className="gap-2 text-xs" onClick={addItem}>
          <Plus className="h-3.5 w-3.5" /> {f.addLine}
        </Button>
      </div>

      <Separator />

      <div className="grid sm:grid-cols-2 gap-4">
        {vatRegistered ? (
          <div className="space-y-1.5">
            <Label htmlFor="ddvRate">{f.ddv}</Label>
            <select
              id="ddvRate"
              value={ddvRate}
              onChange={(e) => setDdvRate(parseFloat(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ddvOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-card">
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{f.ddvHint}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {f.noVatRegistration}{" "}
            <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
              {t.tax.changeInSettings}
            </Link>
          </p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{f.subtotal}</span>
            <span className="font-mono">{formatCurrency(subtotal, currency)}</span>
          </div>
          {ddvRate > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {f.ddv} ({(ddvRate * 100).toFixed(0)}%)
              </span>
              <span className="font-mono">{formatCurrency(ddvAmount, currency)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-medium">
            <span>{f.total}</span>
            <span className="font-mono">{formatCurrency(total, currency)}</span>
          </div>
          {currency !== "MKD" && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{f.mkdEquivalent}</span>
              <span className="font-mono">{formatMKD(totalMKD)}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="notes">{f.notes}</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder={f.notesPlaceholder}
          rows={3}
          defaultValue={draft?.notes ?? ""}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {draft ? f.saveDraft : f.submit}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
