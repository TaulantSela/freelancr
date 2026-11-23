"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, users } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { isTaxStatus } from "@/lib/tax/calculator";

export type SettingsErrorKey = "nameRequired" | "advanceInvalid" | "vatNumberRequired";

// "" -> null (not entered); otherwise a non-negative amount in MKD.
function parseMonthlyAdvance(value: FormDataEntryValue | null): number | null | undefined {
  const text = typeof value === "string" ? value.trim().replace(",", ".") : "";
  if (!text) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export async function updateProfile(
  formData: FormData
): Promise<{ errorKey: SettingsErrorKey } | void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const name = formData.get("name") as string;
  if (!name?.trim()) return { errorKey: "nameRequired" };

  // Only a known status is saved; anything else leaves the stored one as is.
  const taxStatus = formData.get("taxStatus");

  // The advance field is only on the form for the self-employed; when it
  // isn't posted, the stored amount stays.
  const monthlyAdvanceMKD = formData.has("monthlyAdvanceMKD")
    ? parseMonthlyAdvance(formData.get("monthlyAdvanceMKD"))
    : null;
  if (monthlyAdvanceMKD === undefined) return { errorKey: "advanceInvalid" };

  // A registered user must print their VAT number on invoices. The number
  // field is only on the form while the box is ticked; when it's unticked,
  // the stored number stays for if they tick it again.
  const vatRegistered = formData.get("vatRegistered") === "on";
  const vatNumber = ((formData.get("vatNumber") as string | null) ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (vatRegistered && !vatNumber) return { errorKey: "vatNumberRequired" };

  await getDb()
    .update(users)
    .set({
      name,
      businessName: (formData.get("businessName") as string) || null,
      taxNumber: (formData.get("taxNumber") as string) || null,
      address: (formData.get("address") as string) || null,
      bankAccount: (formData.get("bankAccount") as string) || null,
      bankName: (formData.get("bankName") as string) || null,
      ...(isTaxStatus(taxStatus) ? { taxStatus } : {}),
      ...(formData.has("monthlyAdvanceMKD") ? { monthlyAdvanceMKD } : {}),
      vatRegistered,
      ...(formData.has("vatNumber") ? { vatNumber: vatNumber || null } : {}),
    })
    .where(eq(users.id, session.userId));

  revalidatePath("/settings");
}
