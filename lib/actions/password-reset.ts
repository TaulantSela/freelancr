"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { normalizeEmail } from "@/lib/auth/email";
import { getDb, users } from "@/lib/db";
import { getSessionSecret } from "@/lib/env";
import { generateId } from "@/lib/utils";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
  RESET_TOKEN_MINUTES,
  clientIp,
  consumeResetToken,
  hashIp,
  hashResetToken,
  issueResetToken,
  newResetToken,
  recordResetRequest,
} from "@/lib/auth/reset";
import { appUrl, isEmailConfigured, mailFrom } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/send";
import { emailHtml } from "@/lib/email/html";
import { getDictionary } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { formatMessage } from "@/lib/i18n/format";

export type ForgotPasswordState = { sent: true } | { errorKey: "emailRequired" | "notConfigured" } | null;

// The same answer for any email, whether or not it has an account, and in
// about the same time: the lookup, the limits and the email all happen
// after the response (next/server's after()).
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  if (!isEmailConfigured()) return { errorKey: "notConfigured" };
  const email = normalizeEmail(formData.get("email"));
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    return { errorKey: "emailRequired" };
  }
  const ipHash = hashIp(clientIp(await headers()), getSessionSecret());
  after(() => sendResetLink(email, ipHash));
  return { sent: true };
}

// Up to 10 requests an hour from one IP and 3 emails an hour to one
// account; over either, nothing is sent. Demo accounts never get one.
async function sendResetLink(email: string, ipHash: string) {
  const db = getDb();
  if (!(await recordResetRequest(db, generateId(), ipHash))) return;
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, isDemo: users.isDemo, locale: users.locale })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  if (!user || user.isDemo) return;
  const base = appUrl();
  const from = mailFrom();
  if (!base || !from) return;
  const { token, hash } = newResetToken();
  if (!(await issueResetToken(db, generateId(), user.id, hash))) return;

  const e = getDictionary(isLocale(user.locale) ? user.locale : DEFAULT_LOCALE).emails.reset;
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const greeting = formatMessage(e.greeting, { name: user.name });
  const body = formatMessage(e.body, { minutes: RESET_TOKEN_MINUTES });
  // Its result doesn't change the answer (the same for any email); over the
  // app's daily cap nothing is sent.
  await sendEmail({
    kind: "reset",
    from,
    to: user.email,
    subject: e.subject,
    text: [greeting, body, link, e.ignore].join("\n\n"),
    html: emailHtml({
      paragraphs: [greeting, body],
      button: { label: e.button, url: link },
      footer: e.ignore,
    }),
  });
}

export type ResetPasswordState =
  | { errorKey: "required" | "tooShort" | "mismatch" | "invalidToken" }
  | null;

// Sets a new password from a reset link. Every session ends (the version is
// bumped) and the link, and any other the user has, stops working.
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!next || !confirm) return { errorKey: "required" };
  if (next.length < MIN_PASSWORD_LENGTH) return { errorKey: "tooShort" };
  if (next !== confirm) return { errorKey: "mismatch" };
  if (!token) return { errorKey: "invalidToken" };

  const userId = await consumeResetToken(
    getDb(),
    hashResetToken(token),
    await bcrypt.hash(next, BCRYPT_COST)
  );
  if (!userId) return { errorKey: "invalidToken" };
  redirect("/sign-in?reset=1");
}
