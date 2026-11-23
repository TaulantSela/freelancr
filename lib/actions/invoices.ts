"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, clients, invoices, invoiceItems, users } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId, generateInvoiceNumber } from "@/lib/utils";
import { getRateToMKD, isDdvRate, isSupportedCurrency } from "@/lib/tax/calculator";
import { eq, and } from "drizzle-orm";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function createInvoice(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const clientId = formData.get("clientId") as string;
  const date = formData.get("date") as string;
  const supplyDate = (formData.get("supplyDate") as string) || date;
  const dueDate = formData.get("dueDate") as string;
  const currency = formData.get("currency") as string;
  const notes = formData.get("notes") as string;

  const itemsJson = formData.get("items") as string;
  const items: { description: string; quantity: number; unitPrice: number }[] =
    JSON.parse(itemsJson);

  if (
    !clientId ||
    !DATE_PATTERN.test(date) ||
    !DATE_PATTERN.test(supplyDate) ||
    (dueDate && !DATE_PATTERN.test(dueDate)) ||
    items.length === 0
  ) {
    return { errorKey: "requiredFields" as const };
  }

  if (!isSupportedCurrency(currency)) {
    return { errorKey: "currencyUnsupported" as const };
  }

  // DDV only for a VAT-registered user (VAT law Art. 51(3)); for anyone else
  // it's 0 whatever the form sent, since a VAT amount on their invoice would
  // be owed to UJP (Art. 55).
  const [issuer] = await getDb()
    .select({ vatRegistered: users.vatRegistered })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  let ddvRate = 0;
  if (issuer?.vatRegistered) {
    ddvRate = Number(formData.get("ddvRate") ?? 0);
    if (!isDdvRate(ddvRate)) return { errorKey: "ddvRateInvalid" as const };
  }

  // The client id comes from the form, so make sure it is one of this
  // user's clients before attaching an invoice to it.
  const [ownClient] = await getDb()
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, session.userId)))
    .limit(1);
  if (!ownClient) {
    return { errorKey: "requiredFields" as const };
  }

  const existingInvoices = await getDb()
    .select({ number: invoices.number })
    .from(invoices)
    .where(eq(invoices.userId, session.userId));

  const number = generateInvoiceNumber(existingInvoices.map((i) => i.number));

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const ddvAmount = subtotal * ddvRate;
  const total = subtotal + ddvAmount;
  const rate = getRateToMKD(currency);
  const totalMKD = total * rate;

  const invoiceId = generateId();

  await getDb().insert(invoices).values({
    id: invoiceId,
    userId: session.userId,
    clientId,
    number,
    date,
    supplyDate,
    dueDate: dueDate || null,
    currency,
    exchangeRateMKD: rate,
    subtotal,
    ddvRate,
    ddvAmount,
    total,
    totalMKD,
    status: "draft",
    notes: notes || null,
  });

  await getDb().insert(invoiceItems).values(
    items.map((item) => ({
      id: generateId(),
      invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }))
  );

  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function updateInvoiceStatus(
  id: string,
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  await getDb()
    .update(invoices)
    .set({
      status,
      paidAt: status === "paid" ? new Date().toISOString() : null,
    })
    .where(and(eq(invoices.id, id), eq(invoices.userId, session.userId)));

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
