// Email goes out through Resend's HTTP API, and only when it's set up:
// RESEND_API_KEY and MAIL_FROM. Without them the app works as before and
// says, where it matters, that email isn't set up on this server. No
// address is built into the app: MAIL_FROM is the owner's choice.
//
//   RESEND_API_KEY   the API key
//   MAIL_FROM        the sender, "Name <address@domain>"
//   RESEND_API_BASE  tests only: points the API at a local stub
//   APP_URL          the base URL for links in emails; without it,
//                    https://<VERCEL_PROJECT_PRODUCTION_URL>
//   CRON_SECRET      the bearer token Vercel Cron sends (app/api/cron)

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export function resendBase(): string {
  return (process.env.RESEND_API_BASE || "https://api.resend.com").replace(/\/+$/, "");
}

// "Name <addr@domain>" or a bare address -> its parts; null if it isn't one.
export function parseMailbox(value: string): { name: string | null; address: string } | null {
  const trimmed = value.trim();
  const angled = /^(.*)<([^<>\s]+@[^<>\s]+)>$/.exec(trimmed);
  if (angled) {
    const name = angled[1].trim().replace(/^"(.*)"$/, "$1").trim();
    return { name: name || null, address: angled[2] };
  }
  return /^[^<>\s"]+@[^<>\s"]+$/.test(trimmed) ? { name: null, address: trimmed } : null;
}

// A display name that can't break out of a header: no control characters,
// quotes, backslashes or angle brackets, at most 100 characters, quoted.
export function displayName(name: string): string {
  const clean = name
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/["\\<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `"${clean}"`;
}

// MAIL_FROM as it is (password resets, reminders).
export function mailFrom(): string | null {
  const from = process.env.MAIL_FROM;
  return from && parseMailbox(from) ? from.trim() : null;
}

// MAIL_FROM's address with another display name: invoice emails go out as
// "<business or user name> via Freelancr".
export function mailFromAs(name: string): string | null {
  const parsed = parseMailbox(process.env.MAIL_FROM ?? "");
  if (!parsed) return null;
  return `${displayName(`${name} via Freelancr`)} <${parsed.address}>`;
}

// The base URL for links in emails, never from a request's Host header.
export function appUrl(): string | null {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel.replace(/\/+$/, "")}` : null;
}
