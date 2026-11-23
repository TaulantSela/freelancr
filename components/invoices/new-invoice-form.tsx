"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { createInvoice } from "@/lib/actions/invoices";
import {
  SUPPORTED_CURRENCIES,
  formatCurrency,
  formatMKD,
  getRateToMKD,
} from "@/lib/tax/calculator";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function NewInvoiceForm({
  clients,
}: {
  clients: { id: string; name: string; currency: string }[];
}) {
  const t = useTranslations();
  const f = t.invoices.form;
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [currency, setCurrency] = useState(clients[0]?.currency ?? "EUR");
  const [ddvRate, setDdvRate] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const ddvOptions = [
    { label: f.noDdv, value: 0 },
    { label: f.reducedDdv, value: 0.05 },
    { label: f.standardDdv, value: 0.18 },
  ];

  const today = new Date().toISOString().split("T")[0];
  const dueDefault = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const ddvAmount = subtotal * ddvRate;
  const total = subtotal + ddvAmount;
  const rate = getRateToMKD(currency);
  const totalMKD = total * rate;

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
    fd.set("ddvRate", ddvRate.toString());

    startTransition(async () => {
      const result = await createInvoice(fd);
      if (result?.error) toast.error(result.error);
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
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">{f.dueDate}</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={dueDefault} />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{f.lineItems}</Label>
          <span className="text-xs text-muted-foreground">
            {formatMessage(f.approximateRate, { currency, rate: String(rate) })}
          </span>
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
              <span className="font-mono text-yellow-400">{formatMKD(totalMKD)}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="notes">{f.notes}</Label>
        <Textarea id="notes" name="notes" placeholder={f.notesPlaceholder} rows={3} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {f.submit}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
