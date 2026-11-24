// "Try it with sample data": each visitor gets their own demo account (a
// sandbox) with the sample data, signed in, for 24 hours; the daily cron
// deletes it after that (deleteExpiredSandboxes). A sandbox is a demo
// account (users.is_demo), so Phase 4's guard applies: no password changes
// or resets, no email, no reminders; and its files are capped at 5 MB.

import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { SAMPLE_PROFILE } from "./sample-data";

type Db = ReturnType<typeof getDb>;

export const SANDBOXES_PER_IP_PER_HOUR = 5;
export const MAX_LIVE_SANDBOXES = 300;
export const SANDBOX_HOURS = 24;

// RFC 2606 reserves .invalid: an address there can never receive email.
export function sandboxEmail(): string {
  return `demo+${randomBytes(8).toString("hex")}@sandbox.invalid`;
}

// Not a bcrypt hash, so no password matches it (bcrypt's compare is false
// for anything that isn't one): a sandbox can't be signed into again.
export const SANDBOX_PASSWORD_HASH = "!sandbox: no password";

// Records the request and says whether the IP is still within 5 an hour,
// this one included.
export async function recordSandboxRequest(db: Db, id: string, ipHash: string): Promise<boolean> {
  const result = await db.execute<{ n: number }>(sql`
    with earlier as (
      select count(*) as n from sandbox_requests
      where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'
    ), ins as (
      insert into sandbox_requests (id, ip_hash) values (${id}, ${ipHash}) returning id
    )
    select (select n from earlier)::int + (select count(*) from ins)::int as n
  `);
  return Number(result.rows[0]?.n ?? Infinity) <= SANDBOXES_PER_IP_PER_HOUR;
}

// Creates the sandbox user in one statement, only while fewer than 300
// sandboxes are live. Returns whether it was created.
export async function insertSandboxUser(
  db: Db,
  u: { id: string; email: string; locale: string; now: Date }
): Promise<boolean> {
  const now = u.now.toISOString();
  const expires = new Date(u.now.getTime() + SANDBOX_HOURS * 3_600_000).toISOString();
  const p = SAMPLE_PROFILE;
  const result = await db.execute<{ id: string }>(sql`
    with live as (
      select count(*) as n from users
      where is_demo and demo_expires_at > ${now}::timestamp
    )
    insert into users (id, email, password_hash, name, business_name, tax_number, address,
      place_of_issue, bank_name, iban, bic, tax_status, is_demo, locale, demo_expires_at)
    select ${u.id}, ${u.email}, ${SANDBOX_PASSWORD_HASH}, ${p.name}, ${p.businessName}, ${p.taxNumber},
      ${p.address}, ${p.placeOfIssue}, ${p.bankName}, ${p.iban}, ${p.bic}, ${p.taxStatus}, true,
      ${u.locale}, ${expires}::timestamp
    from live where live.n < ${MAX_LIVE_SANDBOXES}
    returning id
  `);
  return result.rows.length > 0;
}

// The daily cron's cleanup: every sandbox whose 24 hours are over, with all
// of its records (one delete; everything cascades from users). The shared
// demo account has no expiry and is never deleted. Also drops request
// records older than a day (the limits only look at the last hour).
export async function deleteExpiredSandboxes(db: Db, now: Date): Promise<{ deleted: number }> {
  const at = now.toISOString();
  const deleted = await db.execute<{ id: string }>(sql`
    delete from users
    where is_demo and demo_expires_at is not null and demo_expires_at <= ${at}::timestamp
    returning id
  `);
  await db.execute(sql`delete from sandbox_requests where created_at < ${at}::timestamp - interval '1 day'`);
  await db.execute(sql`delete from password_reset_requests where created_at < ${at}::timestamp - interval '1 day'`);
  return { deleted: deleted.rows.length };
}
