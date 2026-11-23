"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getDb, users } from "@/lib/db";
import { createSession, deleteSession, getSession } from "@/lib/auth/session";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import type { AuthErrorKey } from "@/lib/i18n/format";

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;

  if (!email || !password || !name) {
    return { errorKey: "allFieldsRequired" as AuthErrorKey };
  }
  // The form says so too; this holds for any post.
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { errorKey: "passwordTooShort" as AuthErrorKey };
  }

  const existing = (
    await getDb().select().from(users).where(eq(users.email, email))
  )[0];
  if (existing) {
    return { errorKey: "emailExists" as AuthErrorKey };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const id = generateId();

  await getDb().insert(users).values({ id, email, passwordHash, name });

  await createSession({ userId: id, email, name });
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { errorKey: "emailPasswordRequired" as AuthErrorKey };
  }

  const user = (
    await getDb().select().from(users).where(eq(users.email, email))
  )[0];
  if (!user) {
    return { errorKey: "invalidCredentials" as AuthErrorKey };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { errorKey: "invalidCredentials" as AuthErrorKey };
  }

  await createSession({ userId: user.id, email: user.email, name: user.name });
  redirect("/dashboard");
}

export type ChangePasswordState =
  | { errorKey: "required" | "wrongCurrent" | "tooShort" | "mismatch" }
  | { changed: true }
  | null;

// Changes the signed-in user's password: the current one has to match, and
// the new one follows the sign-up rules (length, bcrypt cost). Other
// sessions stay signed in (sessions are signed cookies, not stored).
export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!current || !next || !confirm) return { errorKey: "required" };
  if (next.length < MIN_PASSWORD_LENGTH) return { errorKey: "tooShort" };
  if (next !== confirm) return { errorKey: "mismatch" };

  const [user] = await getDb()
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
    return { errorKey: "wrongCurrent" };
  }

  await getDb()
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, BCRYPT_COST) })
    .where(eq(users.id, session.userId));
  return { changed: true };
}

export async function signOut() {
  await deleteSession();
  redirect("/sign-in");
}
