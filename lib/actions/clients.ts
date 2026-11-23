"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, clients, invoices } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId } from "@/lib/utils";
import { isSupportedCurrency } from "@/lib/tax/calculator";
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
      address: (formData.get("address") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .where(and(eq(clients.id, id), eq(clients.userId, session.userId)));

  revalidatePath("/clients");
  redirect("/clients");
}

async function countClientInvoices(clientId: string, userId: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(invoices)
    .where(and(eq(invoices.clientId, clientId), eq(invoices.userId, userId)));
  return row?.value ?? 0;
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

function deleteBlocked(invoiceCount: number) {
  // Refresh the list so the dialog switches to the "can't delete" message.
  revalidatePath("/clients");
  return { errorKey: "deleteBlocked" as const, invoiceCount };
}

// Invoices are income records, so invoices.client_id has no ON DELETE
// action and Postgres refuses to delete a client that still has any.
// Check first so the user gets a clear message instead of a failed query.
export async function deleteClient(id: string) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const invoiceCount = await countClientInvoices(id, session.userId);
  if (invoiceCount > 0) return deleteBlocked(invoiceCount);

  try {
    await getDb()
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, session.userId)));
  } catch (error) {
    // An invoice created after the count above still trips the constraint.
    if (isForeignKeyViolation(error)) {
      return deleteBlocked(await countClientInvoices(id, session.userId));
    }
    throw error;
  }

  revalidatePath("/clients");
}
