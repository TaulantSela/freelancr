"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getDb, users } from "@/lib/db";
import { deleteSession, getSession } from "@/lib/auth/session";

export type DeleteAccountState =
  | { errorKey: "required" | "wrongPassword" | "notConfirmed" | "demo" }
  | null;

// Deletes the signed-in user and everything that's theirs: the foreign keys
// on users cascade to clients, invoices, payments, credit notes, attachments
// and the rest, as the daily cron's sandbox clean-up already relies on. It
// takes the password and a ticked box. Every other session ends with it
// (pages check the user against the database), and this one's cookie goes.
// Demo accounts can't be deleted this way: the shared one has a public
// password, and sandboxes go on their own after 24 hours.
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.isDemo) return { errorKey: "demo" };

  const password = String(formData.get("password") ?? "");
  if (!password) return { errorKey: "required" };
  if (formData.get("confirm") !== "on") return { errorKey: "notConfirmed" };

  const db = getDb();
  const [user] = await db
    .select({ passwordHash: users.passwordHash, isDemo: users.isDemo })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) redirect("/sign-in");
  if (user.isDemo) return { errorKey: "demo" };
  if (!(await bcrypt.compare(password, user.passwordHash))) return { errorKey: "wrongPassword" };

  await db.delete(users).where(and(eq(users.id, session.userId), eq(users.isDemo, false)));
  await deleteSession();
  redirect("/account-deleted");
}
