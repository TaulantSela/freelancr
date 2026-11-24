import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, users, payments } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { toSkopjeDate, formatMKD } from "@/lib/tax/calculator";
import { formatTaxDate, formatTaxPeriod } from "@/lib/tax/labels";
import { getPaymentsReceived } from "@/lib/payments/queries";
import { summarizeMonths } from "@/lib/tax/payments";
import { appUrl, mailFrom } from "@/lib/email/config";
import { DAILY_CAP_ERROR, sendEmail } from "@/lib/email/send";
import { emailHtml } from "@/lib/email/html";
import { getDictionary } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { formatMessage } from "@/lib/i18n/format";
import { dueReminders, inWindow, isReminderDay, previousMonth, type PlannedReminder } from "./plan";

// At most this many emails a run, one at a time with a pause (Resend's free
// tier takes about 2 a second); anything left goes out on the next day's run
// while the reminder is still due (lib/reminders/plan.ts).
export const REMINDERS_PER_RUN = 100;
const PAUSE_MS = 600;

type Recipient = { id: string; email: string; name: string; locale: string };

// The reminders due today (Skopje) for every user who wants them (not demo
// accounts), each sent once: the log row goes in first, and only a row that
// went in is sent; a failed send deletes it so the next run can retry.
export async function runReminders(now: Date): Promise<{ due: number; sent: number; failed: number }> {
  const today = toSkopjeDate(now);
  const result = { due: 0, sent: 0, failed: 0 };
  if (!isReminderDay(today)) return result;
  const base = appUrl();
  const from = mailFrom();
  if (!base || !from) return result;

  const db = getDb();
  const recipients = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      locale: users.locale,
      taxStatus: users.taxStatus,
      monthlyAdvanceMKD: users.monthlyAdvanceMKD,
    })
    .from(users)
    .where(and(eq(users.remindersEnabled, true), eq(users.isDemo, false)));

  const lastMonth = previousMonth(today);
  const lastYear = Number(today.slice(0, 4)) - 1;
  // Once the app's daily cap is reached, the rest wait for a later run.
  let capped = false;
  for (const user of recipients) {
    let summary = null;
    let hadPaymentsLastYear = false;
    if (user.taxStatus !== "self_employed") {
      const rows = await getPaymentsReceived(user.id, `${lastMonth}-01`, `${lastMonth}-31`);
      summary = summarizeMonths(rows, today).find((m) => m.month === lastMonth) ?? null;
      if (inWindow("annual-return", today)) {
        const [any] = await db
          .select({ id: payments.id })
          .from(payments)
          .where(
            and(
              eq(payments.userId, user.id),
              gte(payments.receivedOn, `${lastYear}-01-01`),
              lte(payments.receivedOn, `${lastYear}-12-31`)
            )
          )
          .limit(1);
        hadPaymentsLastYear = Boolean(any);
      }
    }
    const planned = dueReminders({
      today,
      taxStatus: user.taxStatus,
      monthlyAdvanceMKD: user.monthlyAdvanceMKD,
      lastMonth: summary,
      hadPaymentsLastYear,
    });
    for (const reminder of planned) {
      result.due++;
      if (capped || result.sent + result.failed >= REMINDERS_PER_RUN) continue;
      const logId = generateId();
      const inserted = await db.execute<{ id: string }>(sql`
        insert into reminder_log (id, user_id, kind, period)
        values (${logId}, ${user.id}, ${reminder.kind}, ${reminder.period})
        on conflict (user_id, kind, period) do nothing
        returning id
      `);
      if (inserted.rows.length === 0) continue;
      const sent = await sendEmail({
        kind: "reminder",
        from,
        to: user.email,
        ...reminderEmail(user, reminder, today, base),
      });
      if (sent.ok) result.sent++;
      else {
        result.failed++;
        await db.execute(sql`delete from reminder_log where id = ${logId}`);
        if (sent.error === DAILY_CAP_ERROR) {
          capped = true;
          continue;
        }
      }
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }
  return result;
}

// The email, in the user's language, with a link to their payments.
export function reminderEmail(
  user: Recipient,
  reminder: PlannedReminder,
  today: string,
  base: string
): { subject: string; text: string; html: string } {
  const t = getDictionary(isLocale(user.locale) ? user.locale : DEFAULT_LOCALE);
  const r = t.emails.reminders;
  const year = reminder.kind === "annual-return" ? reminder.period : reminder.period.slice(0, 4);
  const month = reminder.kind === "annual-return" ? "" : formatTaxPeriod(reminder.period, t);
  const amount = reminder.amountMKD !== null ? formatMKD(reminder.amountMKD) : "";
  const dayOf = (d: string) => formatTaxDate(`${today.slice(0, 7)}-${d}`, t);
  const values = {
    month,
    year,
    amount,
    date:
      reminder.kind === "file-by-10" || reminder.kind === "file-tomorrow"
        ? dayOf("10")
        : reminder.kind === "annual-return"
        ? dayOf("31")
        : dayOf("15"),
  };
  const kind = {
    "file-by-10": r.fileBy10,
    "file-tomorrow": r.fileTomorrow,
    "pay-by-15": r.payBy15,
    "annual-return": r.annualReturn,
    advance: r.advance,
  }[reminder.kind];
  const body =
    reminder.kind === "advance" && reminder.amountMKD === null ? r.advance.bodyNoAmount : kind.body;
  const link = `${base}/payments?year=${year}`;
  const greeting = formatMessage(r.greeting, { name: user.name });
  const text = formatMessage(body, values);
  return {
    subject: formatMessage(kind.subject, values),
    text: [greeting, text, `${r.button}: ${link}`, r.footer].join("\n\n"),
    html: emailHtml({ paragraphs: [greeting, text], button: { label: r.button, url: link }, footer: r.footer }),
  };
}
