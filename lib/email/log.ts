// The app-wide daily cap: every email that went out is logged (email_log),
// and nothing more is sent once EMAIL_DAILY_CAP went out in the last 24
// hours. It protects the sending account (Resend's free plan sends 100 a
// day). Soft under concurrency: two sends at the same moment can both pass.

import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { generateId } from "@/lib/utils";

type Db = ReturnType<typeof getDb>;

export type EmailKind = "reset" | "invoice" | "reminder" | "alert";

export async function sentInLast24Hours(db: Db): Promise<number> {
  const result = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from email_log where sent_at > now() - interval '24 hours'
  `);
  return Number(result.rows[0]?.n ?? 0);
}

export async function logSent(db: Db, kind: EmailKind): Promise<void> {
  await db.execute(sql`insert into email_log (id, kind) values (${generateId()}, ${kind})`);
}

// The daily cron: rows older than 2 days are no longer counted.
export async function pruneEmailLog(db: Db, now: Date): Promise<{ deleted: number }> {
  const result = await db.execute<{ id: string }>(sql`
    delete from email_log where sent_at < ${now.toISOString()}::timestamp - interval '2 days' returning id
  `);
  return { deleted: result.rows.length };
}
