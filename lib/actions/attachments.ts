"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deleteAttachment as deleteAttachmentRow } from "@/lib/attachments/write";

// Deletes one of the user's files.
export async function deleteAttachment(id: string): Promise<{ errorKey: "notFound" } | { ok: true }> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const owner = await deleteAttachmentRow(getDb(), id, session.userId);
  if (!owner) return { errorKey: "notFound" };

  if (owner.paymentId) revalidatePath(`/payments/${owner.paymentId}/edit`);
  if (owner.clientId) revalidatePath(`/clients/${owner.clientId}/edit`);
  revalidatePath("/payments");
  revalidatePath("/clients");
  return { ok: true };
}
