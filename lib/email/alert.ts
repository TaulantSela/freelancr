// Emails the app's owner when something needs a look: a nightly backup or
// the shared demo's refresh that failed. Goes to ALERT_EMAIL, only when
// email is set up; otherwise the failure is only in the function log.

import { isEmailConfigured, mailFrom } from "./config";
import { emailHtml } from "./html";
import { sendEmail } from "./send";

export function alertEmail(): string | null {
  const to = process.env.ALERT_EMAIL?.trim();
  return to && /^[^\s@<>]+@[^\s@<>]+$/.test(to) ? to : null;
}

export async function alertOwner(subject: string, lines: string[]): Promise<boolean> {
  const to = alertEmail();
  const from = mailFrom();
  if (!to || !from || !isEmailConfigured()) return false;
  const result = await sendEmail({
    kind: "alert",
    from,
    to,
    subject: `Freelancr: ${subject}`,
    text: lines.join("\n\n"),
    html: emailHtml({ paragraphs: lines }),
  });
  if (!result.ok) console.error("Alert email failed:", result.error);
  return result.ok;
}
