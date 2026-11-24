"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { createPayment, updatePayment } from "@/lib/actions/payments";
import {
  DEEMED_COSTS_RATES,
  PAYMENT_CHANNELS,
  taxTreatmentFor,
  type TaxTreatment,
} from "@/lib/payments/config";
import { paymentTax } from "@/lib/tax/payments";
import { SUPPORTED_CURRENCIES, formatCurrency, formatMKD } from "@/lib/tax/calculator";
import { formatTaxDate } from "@/lib/tax/labels";
import { DeemedCostsHelp } from "@/components/payments/deemed-costs-help";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";
import { useNbrsmRate } from "@/components/rates/use-nbrsm-rate";

export type PayableInvoice = {
  id: string;
  number: string;
  currency: string;
  total: number;
  // Credit notes on it; what's left to pay is total - credited - settled.
  credited: number;
  settled: number;
  clientId: string;
  clientName: string;
  clientCountry: string;
  clientType: string;
  clientDeemedCostsRate: number;
};

export type PayerClient = {
  id: string;
  name: string;
  country: string;
  clientType: string;
  currency: string;
  deemedCostsRate: number;
};

export type ExistingPayment = {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  clientId: string;
  clientName: string;
  clientCountry: string;
  currency: string;
  receivedOn: string;
  amount: number;
  fees: number;
  taxWithheld: number;
  rateToMKD: number;
  rateSource: string;
  taxTreatment: TaxTreatment;
  deemedCostsRate: number;
  channel: string | null;
  note: string | null;
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function round2(x: number): number {
  return Math.round(Number((x * 100).toPrecision(15))) / 100;
}

function amountText(x: number): string {
  return x ? String(round2(x)) : "";
}

// Records a payment, or edits one. The rate shows as the date or currency
// changes (the National Bank's middle rate for that day), with a field to
// type it only if the National Bank can't be reached; the action looks it up
// again either way.
export function PaymentForm({
  taxStatus,
  today,
  invoices,
  clients,
  presetInvoiceId,
  existing,
  filed = false,
}: {
  taxStatus: string;
  today: string;
  invoices: PayableInvoice[];
  clients: PayerClient[];
  presetInvoiceId?: string;
  existing?: ExistingPayment;
  // Editing a payment whose month is already filed with UJP.
  filed?: boolean;
}) {
  const t = useTranslations();
  const f = t.payments.form;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const preset = invoices.find((i) => i.id === presetInvoiceId);
  // A new payment starts from the invoice's balance; a company in North
  // Macedonia pays 90% of it and withholds the other 10% (Art. 80(1)).
  const prefill = (inv: PayableInvoice | undefined) => {
    if (!inv) return { amount: "", taxWithheld: "" };
    const balance = Math.max(0, round2(inv.total - inv.credited - inv.settled));
    if (taxTreatmentFor(taxStatus, { country: inv.clientCountry, clientType: inv.clientType }) === "withheld") {
      const amount = round2(balance * 0.9);
      return { amount: amountText(amount), taxWithheld: amountText(round2(balance - amount)) };
    }
    return { amount: amountText(balance), taxWithheld: "" };
  };
  const start = existing
    ? { amount: amountText(existing.amount), taxWithheld: amountText(existing.taxWithheld) }
    : prefill(preset);

  const [invoiceId, setInvoiceId] = useState(existing ? existing.invoiceId ?? "" : preset?.id ?? "");
  const [clientId, setClientId] = useState(existing?.clientId ?? preset?.clientId ?? clients[0]?.id ?? "");
  const [currency, setCurrency] = useState(
    existing?.currency ?? preset?.currency ?? clients[0]?.currency ?? "EUR"
  );
  const [receivedOn, setReceivedOn] = useState(existing?.receivedOn ?? today);
  const [amount, setAmount] = useState(start.amount);
  const [fees, setFees] = useState(existing ? amountText(existing.fees) : "");
  const [taxWithheld, setTaxWithheld] = useState(start.taxWithheld);
  const [deemed, setDeemed] = useState(
    existing?.deemedCostsRate ?? preset?.clientDeemedCostsRate ?? clients[0]?.deemedCostsRate ?? 0
  );
  const [manualRate, setManualRate] = useState("");

  const invoice = invoices.find((i) => i.id === invoiceId);
  const payer = existing
    ? { country: existing.clientCountry, clientType: "" }
    : invoice
    ? { country: invoice.clientCountry, clientType: invoice.clientType }
    : clients.find((c) => c.id === clientId) ?? { country: "", clientType: "" };
  const treatment: TaxTreatment =
    existing?.taxTreatment ?? taxTreatmentFor(taxStatus, payer);
  const localPerson = treatment === "self_reported" && payer.country === "MK";
  const linked = Boolean(existing ? existing.invoiceId : invoice);

  const nbrsm = useNbrsmRate(currency, receivedOn && receivedOn <= today ? receivedOn : today);
  const typedRate = Number(manualRate.replace(",", "."));
  const rate =
    nbrsm.status === "ready" ? nbrsm.rate : typedRate > 0 ? typedRate : existing?.rateToMKD ?? 0;

  const num = (s: string) => {
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const preview = paymentTax({
    id: "preview",
    receivedOn,
    amount: num(amount),
    fees: num(fees),
    taxWithheld: localPerson ? 0 : num(taxWithheld),
    rateToMKD: rate,
    rateSource: "nbrsm",
    taxTreatment: treatment,
    deemedCostsRate: treatment === "self_reported" ? deemed : 0,
    clientCountry: payer.country,
    ujpStatus: null,
  });

  function chooseInvoice(id: string) {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) {
      setCurrency(inv.currency);
      setClientId(inv.clientId);
      setDeemed(inv.clientDeemedCostsRate);
      const p = prefill(inv);
      setAmount(p.amount);
      setTaxWithheld(p.taxWithheld);
    }
  }

  function chooseClient(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) {
      setCurrency(c.currency);
      setDeemed(c.deemedCostsRate);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (localPerson) fd.set("taxWithheld", "0");
    startTransition(async () => {
      const result = existing ? await updatePayment(existing.id, fd) : await createPayment(fd);
      if (result?.errorKey) toast.error(f.errors[result.errorKey]);
    });
  }

  const treatmentNote = t.payments.treatmentNotes[treatment];
  const withheldLabel =
    treatment === "withheld"
      ? f.taxWithheldLocal
      : treatment === "self_reported"
      ? f.taxWithheldAbroad
      : f.taxWithheldAtSource;
  const withheldHint =
    treatment === "withheld"
      ? f.taxWithheldLocalHint
      : treatment === "self_reported"
      ? f.taxWithheldAbroadHint
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {filed && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          {f.filedWarning}
        </p>
      )}
      {existing ? (
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          <div className="font-medium">{existing.clientName}</div>
          <div className="text-xs text-muted-foreground">
            {existing.invoiceNumber ?? t.payments.noInvoice}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="invoiceId">{f.invoice}</Label>
            <select
              id="invoiceId"
              name="invoiceId"
              value={invoiceId}
              onChange={(e) => chooseInvoice(e.target.value)}
              className={selectClass}
            >
              <option value="" className="bg-card">
                {f.noInvoice}
              </option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id} className="bg-card">
                  {i.number} · {i.clientName}
                </option>
              ))}
            </select>
            {invoice && (
              <p className="text-xs text-muted-foreground">
                {formatMessage(f.balanceHint, {
                  number: invoice.number,
                  amount: formatCurrency(
                    Math.max(0, round2(invoice.total - invoice.credited - invoice.settled)),
                    invoice.currency
                  ),
                })}
              </p>
            )}
          </div>
          {!invoice && (
            <div className="space-y-1.5">
              <Label htmlFor="clientId">{f.client}</Label>
              <select
                id="clientId"
                name="clientId"
                value={clientId}
                onChange={(e) => chooseClient(e.target.value)}
                className={selectClass}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-card">
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{f.clientHint}</p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
        <span className="font-medium text-foreground">{t.payments.treatments[treatment]}.</span>{" "}
        {treatmentNote}
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="receivedOn">{f.receivedOn}</Label>
          <Input
            id="receivedOn"
            name="receivedOn"
            type="date"
            max={today}
            value={receivedOn}
            onChange={(e) => setReceivedOn(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">{f.receivedOnHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">{f.currency}</Label>
          {linked ? (
            <>
              <Input id="currency" value={currency} readOnly className="font-mono" />
              <input type="hidden" name="currency" value={currency} />
            </>
          ) : (
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={selectClass}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c} className="bg-card">
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount">{f.amount}</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{f.amountHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fees">{f.fees}</Label>
          <Input
            id="fees"
            name="fees"
            inputMode="decimal"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            placeholder="0.00"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{f.feesHint}</p>
        </div>
        {!localPerson && (
          <div className="space-y-1.5">
            <Label htmlFor="taxWithheld">{withheldLabel}</Label>
            <Input
              id="taxWithheld"
              name="taxWithheld"
              inputMode="decimal"
              value={taxWithheld}
              onChange={(e) => setTaxWithheld(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
            {withheldHint && <p className="text-xs text-muted-foreground">{withheldHint}</p>}
          </div>
        )}
      </div>

      {/* MKD needs no rate. */}
      {currency !== "MKD" && (
        <div className="space-y-1.5">
          <Label>{f.rate}</Label>
          {nbrsm.status === "ready" ? (
            <p className="text-sm font-mono">
              {formatMessage(f.rateNbrsm, {
                currency,
                rate: String(nbrsm.rate),
                date: formatTaxDate(nbrsm.date, t),
              })}
            </p>
          ) : nbrsm.status === "loading" ? (
            <p className="text-sm text-muted-foreground">{f.rateLoading}</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-amber-400">
                {formatMessage(f.rateUnavailable, { date: formatTaxDate(receivedOn || today, t) })}
              </p>
              <Input
                id="manualRate"
                name="manualRate"
                inputMode="decimal"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                placeholder={formatMessage(f.manualRate, { currency })}
                required={!existing}
                className="font-mono sm:w-1/2"
              />
            </div>
          )}
        </div>
      )}

      {treatment === "self_reported" && (
        <div className="space-y-1.5">
          <Label htmlFor="deemedCostsRate">{f.deemedCosts}</Label>
          <select
            id="deemedCostsRate"
            name="deemedCostsRate"
            value={deemed}
            onChange={(e) => setDeemed(Number(e.target.value))}
            className={selectClass}
          >
            {DEEMED_COSTS_RATES.map((r) => (
              <option key={r} value={r} className="bg-card">
                {t.payments.deemedOptions[String(r) as keyof typeof t.payments.deemedOptions]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{f.deemedCostsHint}</p>
          <DeemedCostsHelp />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="channel">{f.channel}</Label>
          <select id="channel" name="channel" defaultValue={existing?.channel ?? "bank"} className={selectClass}>
            {PAYMENT_CHANNELS.map((c) => (
              <option key={c} value={c} className="bg-card">
                {t.payments.channels[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">{f.note}</Label>
          <Textarea id="note" name="note" rows={1} defaultValue={existing?.note ?? ""} />
        </div>
      </div>

      {rate > 0 && num(amount) > 0 && (
        <>
          <Separator />
          <div className="space-y-1.5 text-sm">
            <Row label={f.previewReceived} value={formatMKD(preview.receivedMKD)} />
            <Row label={f.previewGross} value={formatMKD(preview.grossMKD)} />
            {treatment === "self_reported" && (
              <>
                <Row label={f.previewTax} value={formatMKD(preview.taxMKD)} />
                {preview.creditMKD > 0 && <Row label={f.previewCredit} value={`− ${formatMKD(preview.creditMKD)}`} />}
                <Row label={f.previewOwed} value={formatMKD(preview.owedMKD)} strong />
              </>
            )}
            {treatment === "withheld" && (
              <Row label={f.previewAlreadyPaid} value={formatMKD(preview.alreadyPaidForYouMKD)} strong />
            )}
            <p className="text-xs text-muted-foreground pt-1">{t.payments.feesNote}</p>
          </div>
        </>
      )}

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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-medium" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
