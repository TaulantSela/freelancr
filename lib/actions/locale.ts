"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/types";

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Signed in: emails to them follow (password reset, reminders).
  const session = await getSession();
  if (session) {
    await getDb().update(users).set({ locale }).where(eq(users.id, session.userId));
  }

  revalidatePath("/", "layout");
}
