"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getDb, users } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/auth/session";
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

  const existing = (
    await getDb().select().from(users).where(eq(users.email, email))
  )[0];
  if (existing) {
    return { errorKey: "emailExists" as AuthErrorKey };
  }

  const passwordHash = await bcrypt.hash(password, 12);
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

export async function signOut() {
  await deleteSession();
  redirect("/sign-in");
}
