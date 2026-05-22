"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, clients } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

export async function createClient(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const taxId = formData.get("taxId") as string;
  const country = formData.get("country") as string;
  const currency = formData.get("currency") as string;
  const address = formData.get("address") as string;
  const contactPerson = formData.get("contactPerson") as string;
  const notes = formData.get("notes") as string;

  if (!name) return { errorKey: "nameRequired" as const };

  await getDb().insert(clients).values({
    id: generateId(),
    userId: session.userId,
    name,
    email: email || null,
    taxId: taxId || null,
    country: country || "MK",
    currency: currency || "EUR",
    address: address || null,
    contactPerson: contactPerson || null,
    notes: notes || null,
  });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClient(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const name = formData.get("name") as string;
  if (!name) return { errorKey: "nameRequired" as const };

  await getDb()
    .update(clients)
    .set({
      name,
      email: (formData.get("email") as string) || null,
      taxId: (formData.get("taxId") as string) || null,
      country: (formData.get("country") as string) || "MK",
      currency: (formData.get("currency") as string) || "EUR",
      address: (formData.get("address") as string) || null,
      contactPerson: (formData.get("contactPerson") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .where(and(eq(clients.id, id), eq(clients.userId, session.userId)));

  revalidatePath("/clients");
  redirect("/clients");
}

export async function deleteClient(id: string) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  await getDb()
    .delete(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, session.userId)));

  revalidatePath("/clients");
}
