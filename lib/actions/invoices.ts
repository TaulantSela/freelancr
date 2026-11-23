"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, invoices, invoiceItems } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId, generateInvoiceNumber } from "@/lib/utils";
import { getRateToMKD } from "@/lib/tax/calculator";
import { eq, and } from "drizzle-orm";

export async function createInvoice(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const clientId = formData.get("clientId") as string;
  const date = formData.get("date") as string;
  const dueDate = formData.get("dueDate") as string;
  const currency = formData.get("currency") as string;
  const ddvRate = parseFloat(formData.get("ddvRate") as string) || 0;
  const notes = formData.get("notes") as string;

  const itemsJson = formData.get("items") as string;
  const items: { description: string; quantity: number; unitPrice: number }[] =
    JSON.parse(itemsJson);

  if (!clientId || !date || items.length === 0) {
    return { error: "Client, date, and at least one item are required" };
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
