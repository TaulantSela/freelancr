"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, clients, invoices, payments } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId } from "@/lib/utils";
import { isSupportedCurrency } from "@/lib/tax/calculator";
import { isDeemedCostsRate } from "@/lib/payments/config";
import {
  DEFAULT_CLIENT_TYPE,
  defaultInvoiceLanguage,
  isClientType,
  isInvoiceLanguage,
} from "@/lib/clients/config";
import { isCountryCode } from "@/lib/clients/countries";
import { looksLikeEmbg } from "@/lib/profile";
import { eq, and, count } from "drizzle-orm";

// A private person has no tax ID or contact person on file: the form hides
// both, and anything posted for them anyway is dropped.
function readClientType(formData: FormData) {
  const value = formData.get("clientType");
  const clientType = isClientType(value) ? value : DEFAULT_CLIENT_TYPE;
  const isPerson = clientType === "person";
  return {
    clientType,
    taxId: isPerson ? null : (formData.get("taxId") as string) || null,
    contactPerson: isPerson
      ? null
      : (formData.get("contactPerson") as string) || null,
  };
}

function readInvoiceLanguage(formData: FormData, country: string) {
  const value = formData.get("invoiceLanguage");
  return isInvoiceLanguage(value) ? value : defaultInvoiceLanguage(country);
}

// The deemed costs new payments from this client start with (Personal Income
// Tax law Art. 40: author's rights only). Anything not on the list is 0.
function readDeemedCostsRate(formData: FormData): number {
  const value = Number(formData.get("deemedCostsRate") ?? 0);
  return isDeemedCostsRate(value) ? value : 0;
}

export async function createClient(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const country = formData.get("country") as string;
  const currency = (formData.get("currency") as string) || "EUR";
  const address = formData.get("address") as string;
  const notes = formData.get("notes") as string;

  if (!name) return { errorKey: "nameRequired" as const };
  if (!isCountryCode(country)) return { errorKey: "countryRequired" as const };
  if (!isSupportedCurrency(currency)) {
    return { errorKey: "currencyUnsupported" as const };
  }
  const typeFields = readClientType(formData);
  if (looksLikeEmbg(typeFields.taxId)) return { errorKey: "looksLikeEmbg" as const };

  await getDb().insert(clients).values({
    id: generateId(),
    userId: session.userId,
    name,
    ...typeFields,
    email: email || null,
    country,
    currency,
    invoiceLanguage: readInvoiceLanguage(formData, country),
    deemedCostsRate: readDeemedCostsRate(formData),
    address: address || null,
    notes: notes || null,
  });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClient(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const name = formData.get("name") as string;
  const country = formData.get("country");
  const currency = (formData.get("currency") as string) || "EUR";
  if (!name) return { errorKey: "nameRequired" as const };
  if (!isCountryCode(country)) return { errorKey: "countryRequired" as const };
  if (!isSupportedCurrency(currency)) {
    return { errorKey: "currencyUnsupported" as const };
  }
  const typeFields = readClientType(formData);
  if (looksLikeEmbg(typeFields.taxId)) return { errorKey: "looksLikeEmbg" as const };

  await getDb()
    .update(clients)
    .set({
      name,
      ...typeFields,
      email: (formData.get("email") as string) || null,
      country,
      currency,
      invoiceLanguage: readInvoiceLanguage(formData, country),
      deemedCostsRate: readDeemedCostsRate(formData),
      address: (formData.get("address") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .where(and(eq(clients.id, id), eq(clients.userId, session.userId)));

  revalidatePath("/clients");
  redirect("/clients");
}

// Invoices plus payments: both are income records that keep a client.
async function countClientRecords(clientId: string, userId: string) {
  const [[invoiceRow], [paymentRow]] = await Promise.all([
    getDb()
      .select({ value: count() })
      .from(invoices)
      .where(and(eq(invoices.clientId, clientId), eq(invoices.userId, userId))),
    getDb()
      .select({ value: count() })
      .from(payments)
      .where(and(eq(payments.clientId, clientId), eq(payments.userId, userId))),
  ]);
  return (invoiceRow?.value ?? 0) + (paymentRow?.value ?? 0);
}

// Postgres foreign_key_violation. Drizzle wraps the driver error, so the
// code is on error.cause.
function isForeignKeyViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return [error, cause].some(
    (e) =>
      typeof e === "object" && e !== null && "code" in e && e.code === "23503"
  );
}

function deleteBlocked(recordCount: number) {
  // Refresh the list so the dialog switches to the "can't delete" message.
  revalidatePath("/clients");
  return { errorKey: "deleteBlocked" as const, recordCount };
}

// Invoices and payments are income records, so invoices.client_id and
// payments.client_id have no ON DELETE action and Postgres refuses to delete
// a client that still has any. Check first so the user gets a clear message
// instead of a failed query.
export async function deleteClient(id: string) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const recordCount = await countClientRecords(id, session.userId);
  if (recordCount > 0) return deleteBlocked(recordCount);

  try {
    await getDb()
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, session.userId)));
  } catch (error) {
    // An invoice or payment saved after the count above still trips the
    // constraint.
    if (isForeignKeyViolation(error)) {
      return deleteBlocked(await countClientRecords(id, session.userId));
    }
    throw error;
  }

  revalidatePath("/clients");
}
