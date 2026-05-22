"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, users } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

export async function updateProfile(
  formData: FormData
): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "Name is required" };

  await getDb()
    .update(users)
    .set({
      name,
      businessName: (formData.get("businessName") as string) || null,
      businessType: (formData.get("businessType") as string) || "personal",
      taxNumber: (formData.get("taxNumber") as string) || null,
      address: (formData.get("address") as string) || null,
      bankAccount: (formData.get("bankAccount") as string) || null,
      bankName: (formData.get("bankName") as string) || null,
    })
    .where(eq(users.id, session.userId));

  revalidatePath("/settings");
}
