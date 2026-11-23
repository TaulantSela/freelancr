"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, clients, invoices, payments, users } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId } from "@/lib/utils";
import { isSupportedCurrency, toSkopjeDate } from "@/lib/tax/calculator";
import { getRateToMkd, getRatesForRange } from "@/lib/rates/queries";
import {
  isDeemedCostsRate,
  isPaymentChannel,
  taxTreatmentFor,
} from "@/lib/payments/config";
import {
  deletePayment as deletePaymentRow,
  insertInvoicePayment,
  insertPayout,
  markMonth,
  updatePayment as updatePaymentRow,
  applyNbrsmRates,
  type PaymentFields,
} from "@/lib/payments/write";

export type PaymentErrorKey =
  | "dateInvalid"
  | "dateFuture"
  | "amountInvalid"
  | "feesInvalid"
  | "withheldInvalid"
  | "withheldNotAllowed"
  | "currencyInvalid"
  | "clientInvalid"
  | "invoiceInvalid"
  | "rateRequired"
  | "deemedInvalid"
  | "notFound";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function money(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (raw === null || raw === "") return 0;
  const value = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function text(formData: FormData, name: string, max = 500): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

type Parsed = {
  receivedOn: string;
  amount: number;
  fees: number;
  taxWithheld: number;
  deemedCostsRate: number;
  channel: string | null;
  note: string | null;
  manualRate: number | null;
};

// The fields every payment has, checked. Nothing posted is trusted: the rate
// is looked up again, and the payer, invoice and treatment come from the
// database.
function readFields(formData: FormData, today: string): Parsed | { errorKey: PaymentErrorKey } {
  const receivedOn = String(formData.get("receivedOn") ?? "");
  if (!isRealDate(receivedOn)) return { errorKey: "dateInvalid" };
  if (receivedOn > today) return { errorKey: "dateFuture" };
  const amount = money(formData, "amount");
  if (amount === null || !(amount > 0)) return { errorKey: "amountInvalid" };
  const fees = money(formData, "fees");
  if (fees === null || fees < 0) return { errorKey: "feesInvalid" };
  const taxWithheld = money(formData, "taxWithheld");
  if (taxWithheld === null || taxWithheld < 0) return { errorKey: "withheldInvalid" };
  const deemed = money(formData, "deemedCostsRate");
  if (deemed === null || !isDeemedCostsRate(deemed)) return { errorKey: "deemedInvalid" };
  const channel = formData.get("channel");
  const manual = money(formData, "manualRate");
  return {
    receivedOn,
    amount,
    fees,
    taxWithheld,
    deemedCostsRate: deemed,
    channel: isPaymentChannel(channel) ? channel : null,
    note: text(formData, "note"),
    manualRate: manual !== null && manual > 0 ? manual : null,
  };
}

// The NBRSM middle rate on the day received, as UJP converts it (Personal
// Income Tax law Art. 93(2)); a rate typed by hand only if the National Bank
// can't be reached.
async function paymentRate(
  currency: string,
  receivedOn: string,
  today: string,
  manualRate: number | null
): Promise<Pick<PaymentFields, "rateToMKD" | "rateSource"> | null> {
  const nbrsm = await getRateToMkd(currency, receivedOn, today);
  if (nbrsm) return { rateToMKD: nbrsm.rate, rateSource: "nbrsm" };
  if (manualRate) return { rateToMKD: manualRate, rateSource: "manual" };
  return null;
}

// Withholding rules by treatment. A private person in North Macedonia doesn't
// withhold anything, and deemed costs only matter where the user works out
// the tax (self-reported).
function shape(
  fields: Parsed,
  treatment: string,
  clientCountry: string
): { errorKey: PaymentErrorKey } | Parsed {
  if (treatment === "self_reported" && clientCountry === "MK" && fields.taxWithheld > 0) {
    return { errorKey: "withheldNotAllowed" };
  }
  return { ...fields, deemedCostsRate: treatment === "self_reported" ? fields.deemedCostsRate : 0 };
}

function refresh(invoiceId: string | null) {
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

export async function createPayment(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const today = toSkopjeDate(new Date());

  const fields = readFields(formData, today);
  if ("errorKey" in fields) return fields;

  const [user] = await getDb()
    .select({ taxStatus: users.taxStatus })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) redirect("/sign-in");

  const invoiceId = text(formData, "invoiceId", 64);
  let currency: string;
  let client: { id: string; country: string; clientType: string };
  if (invoiceId) {
    // The invoice decides the payer and the currency.
    const [invoice] = await getDb()
      .select({
        currency: invoices.currency,
        status: invoices.status,
        number: invoices.number,
        clientId: clients.id,
        country: clients.country,
        clientType: clients.clientType,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, session.userId)))
      .limit(1);
    if (!invoice || !invoice.number || !["sent", "paid", "overdue"].includes(invoice.status)) {
      return { errorKey: "invoiceInvalid" as const };
    }
    if (formData.get("currency") && formData.get("currency") !== invoice.currency) {
      return { errorKey: "currencyInvalid" as const };
    }
    currency = invoice.currency;
    client = { id: invoice.clientId, country: invoice.country, clientType: invoice.clientType };
  } else {
    const clientId = text(formData, "clientId", 64) ?? "";
    const [own] = await getDb()
      .select({ id: clients.id, country: clients.country, clientType: clients.clientType })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.userId, session.userId)))
      .limit(1);
    if (!own) return { errorKey: "clientInvalid" as const };
    const posted = String(formData.get("currency") ?? "");
    if (!isSupportedCurrency(posted)) return { errorKey: "currencyInvalid" as const };
    currency = posted;
    client = own;
  }

  const taxTreatment = taxTreatmentFor(user.taxStatus, client);
  const shaped = shape(fields, taxTreatment, client.country);
  if ("errorKey" in shaped) return shaped;
  const rate = await paymentRate(currency, shaped.receivedOn, today, shaped.manualRate);
  if (!rate) return { errorKey: "rateRequired" as const };

  const row = {
    id: generateId(),
    userId: session.userId,
    taxTreatment,
    ujpStatus: taxTreatment === "self_reported" ? "to_file" : null,
    currency,
    ...shaped,
    ...rate,
  };
  const saved = invoiceId
    ? await insertInvoicePayment(getDb(), { ...row, invoiceId })
    : await insertPayout(getDb(), { ...row, clientId: client.id });
  if (!saved) return { errorKey: invoiceId ? ("invoiceInvalid" as const) : ("clientInvalid" as const) };

  refresh(invoiceId);
  redirect(invoiceId ? `/invoices/${invoiceId}` : `/payments?year=${shaped.receivedOn.slice(0, 4)}`);
}

export async function updatePayment(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const today = toSkopjeDate(new Date());

  const fields = readFields(formData, today);
  if ("errorKey" in fields) return fields;

  const [existing] = await getDb()
    .select({
      invoiceId: payments.invoiceId,
      currency: payments.currency,
      receivedOn: payments.receivedOn,
      rateToMKD: payments.rateToMKD,
      rateSource: payments.rateSource,
      taxTreatment: payments.taxTreatment,
      country: clients.country,
    })
    .from(payments)
    .innerJoin(clients, eq(payments.clientId, clients.id))
    .where(and(eq(payments.id, id), eq(payments.userId, session.userId)))
    .limit(1);
  if (!existing) return { errorKey: "notFound" as const };

  // A payment against an invoice keeps the invoice's currency.
  let currency = existing.currency;
  if (!existing.invoiceId) {
    const posted = String(formData.get("currency") ?? "");
    if (!isSupportedCurrency(posted)) return { errorKey: "currencyInvalid" as const };
    currency = posted;
  }
  const shaped = shape(fields, existing.taxTreatment, existing.country);
  if ("errorKey" in shaped) return shaped;

  // The rate follows the day and currency; if the National Bank can't be
  // reached and nothing was typed, an unchanged day and currency keep theirs.
  let rate = await paymentRate(currency, shaped.receivedOn, today, shaped.manualRate);
  if (!rate && shaped.receivedOn === existing.receivedOn && currency === existing.currency) {
    rate = { rateToMKD: existing.rateToMKD, rateSource: existing.rateSource };
  }
  if (!rate) return { errorKey: "rateRequired" as const };

  const saved = await updatePaymentRow(getDb(), {
    id,
    userId: session.userId,
    currency,
    ...shaped,
    ...rate,
  });
  if (!saved) return { errorKey: "notFound" as const };

  refresh(existing.invoiceId);
  redirect(
    existing.invoiceId
      ? `/invoices/${existing.invoiceId}`
      : `/payments?year=${shaped.receivedOn.slice(0, 4)}`
  );
}

export async function deletePayment(id: string) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [existing] = await getDb()
    .select({ invoiceId: payments.invoiceId, receivedOn: payments.receivedOn })
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, session.userId)))
    .limit(1);
  if (!existing || !(await deletePaymentRow(getDb(), id, session.userId))) {
    return { errorKey: "notFound" as const };
  }

  refresh(existing.invoiceId);
  redirect(
    existing.invoiceId
      ? `/invoices/${existing.invoiceId}`
      : `/payments?year=${existing.receivedOn.slice(0, 4)}`
  );
}

export type MonthErrorKey = "monthInvalid" | "dateInvalid" | "dateFuture" | "nothingToMark";

// Moves a month's self-reported payments on: filed (with the calculation
// number, if given), approved (with UJP's folio number, if given) or paid (on
// a day).
export async function markMonthUjp(
  month: string,
  step: "filed" | "approved" | "paid",
  value: string
): Promise<{ errorKey: MonthErrorKey } | { changed: number }> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!MONTH.test(month)) return { errorKey: "monthInvalid" };
  const today = toSkopjeDate(new Date());
  const given = value.trim().slice(0, 64) || null;

  let changed: number;
  if (step === "paid") {
    if (!given || !isRealDate(given)) return { errorKey: "dateInvalid" };
    if (given > today) return { errorKey: "dateFuture" };
    changed = await markMonth(getDb(), session.userId, month, { to: "paid", paidOn: given });
  } else if (step === "approved") {
    changed = await markMonth(getDb(), session.userId, month, { to: "approved", folio: given });
  } else {
    changed = await markMonth(getDb(), session.userId, month, { to: "filed", reference: given });
  }
  if (changed === 0) return { errorKey: "nothingToMark" };

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { changed };
}

// Gives the month's payments that took their invoice's rate (backfilled) the
// National Bank's rate for the day they were received.
export async function switchMonthToNbrsmRates(
  month: string
): Promise<{ errorKey: "monthInvalid" | "unavailable" } | { changed: number }> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!MONTH.test(month)) return { errorKey: "monthInvalid" };
  const today = toSkopjeDate(new Date());

  const inMonth = await getDb()
    .select({ id: payments.id, receivedOn: payments.receivedOn, currency: payments.currency })
    .from(payments)
    .where(
      and(
        eq(payments.userId, session.userId),
        eq(payments.rateSource, "invoice"),
        gte(payments.receivedOn, `${month}-01`),
        lte(payments.receivedOn, `${month}-31`),
        lte(payments.receivedOn, today)
      )
    );
  if (inMonth.length === 0) return { changed: 0 };

  const from = inMonth.reduce((min, r) => (r.receivedOn < min ? r.receivedOn : min), inMonth[0].receivedOn);
  const to = inMonth.reduce((max, r) => (r.receivedOn > max ? r.receivedOn : max), inMonth[0].receivedOn);
  const cached = await getRatesForRange(from, to, [...new Set(inMonth.map((r) => r.currency))]);
  const rates = new Map<string, number>();
  for (const r of inMonth) {
    const rate = r.currency === "MKD" ? 1 : cached.get(`${r.receivedOn}:${r.currency}`);
    if (rate) rates.set(r.id, rate);
  }
  if (rates.size === 0) return { errorKey: "unavailable" };
  const changed = await applyNbrsmRates(getDb(), session.userId, rates);

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { changed };
}
