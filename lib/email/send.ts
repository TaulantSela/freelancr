import { resendBase } from "./config";

export type EmailAttachment = { filename: string; content: string /* base64 */ };

export type EmailMessage = {
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

// One email through Resend's HTTP API (POST /emails). Never throws: a
// failure comes back as { ok: false } with what Resend (or the network)
// said, for the caller to log.
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
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
