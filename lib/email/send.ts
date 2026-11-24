import { getDb } from "@/lib/db";
import { emailDailyCap, resendBase } from "./config";
import { logSent, sentInLast24Hours, type EmailKind } from "./log";

export type EmailAttachment = { filename: string; content: string /* base64 */ };

export type EmailMessage = {
  // What it is, for the log the daily cap counts.
  kind: EmailKind;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  bcc?: string;
  attachments?: EmailAttachment[];
};

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

// What sendEmail says when the app's daily cap is reached.
export const DAILY_CAP_ERROR = "daily cap";

// One email through Resend's HTTP API, unless the app already sent
// EMAIL_DAILY_CAP in the last 24 hours. Each one that goes out is logged for
// the cap. Never throws: a failure comes back as { ok: false } with what
// went wrong, for the caller to log.
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  const db = getDb();
  try {
    if ((await sentInLast24Hours(db)) >= emailDailyCap()) return { ok: false, error: DAILY_CAP_ERROR };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 500) };
  }
  const result = await sendWithResend(key, message);
  // Counted once it went out; a failed log write doesn't undo the send.
  if (result.ok) await logSent(db, message.kind).catch(() => {});
  return result;
}

// Resend's HTTP API (POST /emails).
async function sendWithResend(key: string, message: EmailMessage): Promise<SendResult> {
  try {
    const res = await fetch(`${resendBase()}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        ...(message.bcc ? { bcc: [message.bcc] } : {}),
        ...(message.attachments ? { attachments: message.attachments } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) return { ok: false, error: `${res.status} ${body?.message ?? ""}`.trim().slice(0, 500) };
    return { ok: true, id: body?.id ?? null };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 500) };
  }
}
