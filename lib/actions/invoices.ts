"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, clients, invoices, invoiceItems, users } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId } from "@/lib/utils";
import { getRateToMKD, isDdvRate, isSupportedCurrency } from "@/lib/tax/calculator";
import { issueDraftInvoice } from "@/lib/invoices/numbering";
import { updateDraftInvoice, type DraftLineItem, type DraftValues } from "@/lib/invoices/drafts";
import { eq, and, inArray, sql } from "drizzle-orm";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// The posted line items, or null if they aren't a non-empty list of items
// with a description, a positive quantity and a price that isn't negative.
function parseItems(json: FormDataEntryValue | null): DraftLineItem[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(typeof json === "string" ? json : "");
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return null;
  const items: DraftLineItem[] = [];
  for (const item of raw) {
    const description = typeof item?.description === "string" ? item.description.trim() : "";
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unitPrice);
    if (!description || !(quantity > 0) || !Number.isFinite(quantity)) return null;
    if (!(unitPrice >= 0) || !Number.isFinite(unitPrice)) return null;
    items.push({ description, quantity, unitPrice });
  }
  return items;
}

type InvoiceFormErrorKey =
  | "requiredFields"
  | "fillItems"
  | "currencyUnsupported"
  | "ddvRateInvalid";

// Reads and checks the invoice form for createInvoice and updateInvoice,
// and works out the amounts. Nothing posted is trusted: the client must be
// the user's own, the currency supported, and the DDV rate allowed for how
// the user is registered.
async function readInvoiceForm(
  formData: FormData,
  userId: string
): Promise<
  | { errorKey: InvoiceFormErrorKey }
  | { values: DraftValues; items: DraftLineItem[] }
> {
  const clientId = formData.get("clientId") as string;
  const date = formData.get("date") as string;
  const supplyDate = (formData.get("supplyDate") as string) || date;
  const dueDate = formData.get("dueDate") as string;
  const currency = formData.get("currency") as string;
  const notes = formData.get("notes") as string;

  if (
    !clientId ||
    !DATE_PATTERN.test(date) ||
    !DATE_PATTERN.test(supplyDate) ||
    (dueDate && !DATE_PATTERN.test(dueDate))
  ) {
    return { errorKey: "requiredFields" };
  }
  const items = parseItems(formData.get("items"));
  if (!items) return { errorKey: "fillItems" };

  if (!isSupportedCurrency(currency)) return { errorKey: "currencyUnsupported" };

  // DDV only for a VAT-registered user (VAT law Art. 51(3)); for anyone else
  // it's 0 whatever the form sent, since a VAT amount on their invoice would
  // be owed to UJP (Art. 55).
  const [issuer] = await getDb()
    .select({ vatRegistered: users.vatRegistered })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  let ddvRate = 0;
  if (issuer?.vatRegistered) {
    ddvRate = Number(formData.get("ddvRate") ?? 0);
    if (!isDdvRate(ddvRate)) return { errorKey: "ddvRateInvalid" };
  }

  // The client id comes from the form, so make sure it is one of this
  // user's clients before attaching an invoice to it.
  const [ownClient] = await getDb()
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
    .limit(1);
  if (!ownClient) return { errorKey: "requiredFields" };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const ddvAmount = subtotal * ddvRate;
  const total = subtotal + ddvAmount;
  const rate = getRateToMKD(currency);

  return {
    values: {
      clientId,
      date,
      supplyDate,
      dueDate: dueDate || null,
      currency,
      exchangeRateMKD: rate,
      subtotal,
      ddvRate,
      ddvAmount,
      total,
      totalMKD: total * rate,
      notes: notes || null,
    },
    items,
  };
}

export async function createInvoice(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const form = await readInvoiceForm(formData, session.userId);
  if ("errorKey" in form) return { errorKey: form.errorKey };

  const invoiceId = generateId();

  // A new invoice is a draft without a number; issueInvoice() numbers it.
  await getDb().insert(invoices).values({
    id: invoiceId,
    userId: session.userId,
    ...form.values,
    status: "draft",
  });

  await getDb().insert(invoiceItems).values(
    form.items.map((item) => ({
      id: generateId(),
      invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }))
  );

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

// Saves changes to a draft; an issued invoice is locked (updateDraftInvoice
// only matches drafts).
export async function updateInvoice(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const form = await readInvoiceForm(formData, session.userId);
  if ("errorKey" in form) return { errorKey: form.errorKey };

  const saved = await updateDraftInvoice(
    getDb(),
    id,
    session.userId,
    form.values,
    form.items,
    generateId
  );
  if (!saved) return { errorKey: "notDraft" as const };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

// Gives a draft the next number for its year and marks it issued ("sent").
export async function issueInvoice(id: string) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const number = await issueDraftInvoice(getDb(), id, session.userId);
  if (!number) return { errorKey: "notDraft" as const };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/dashboard");
  return { number };
}

const ISSUED_STATUSES = ["sent", "paid", "overdue", "cancelled"] as const;
type IssuedStatus = (typeof ISSUED_STATUSES)[number];

// Moves an issued invoice between issued statuses. A draft only leaves
// "draft" through issueInvoice(), so it gets a number; nothing goes back to
// draft.
export async function updateInvoiceStatus(id: string, status: IssuedStatus) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!(ISSUED_STATUSES as readonly string[]).includes(status)) return;

  await getDb()
    .update(invoices)
    .set({
      status,
      // Keeps the payment date when an invoice that's already paid is
      // marked paid again.
      paidAt:
        status === "paid"
          ? sql`coalesce(${invoices.paidAt}, ${new Date().toISOString()})`
          : null,
    })
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.userId, session.userId),
        inArray(invoices.status, ISSUED_STATUSES)
      )
    );

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}

export async function deleteInvoice(id: string) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  await getDb()
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, session.userId)));

  revalidatePath("/invoices");
  redirect("/invoices");
}
