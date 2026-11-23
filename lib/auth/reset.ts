import { createHash, createHmac, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

type Db = ReturnType<typeof getDb>;

// Password reset links (the tables are in lib/db/schema.ts).
export const RESET_TOKEN_MINUTES = 60;
export const RESET_EMAILS_PER_ACCOUNT_PER_HOUR = 3;
export const RESET_REQUESTS_PER_IP_PER_HOUR = 10;

// 32 random bytes, base64url, for the link; only the sha256 is stored.
export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// The requester's IP, keyed with the app's secret, so requests can be
// counted per IP without keeping the IP.
export function hashIp(ip: string, secret: Uint8Array): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

// On Vercel the first hop of x-forwarded-for is the client.
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

// Records a request from an IP; true while that IP is within its hourly
// limit (this request included).
export async function recordResetRequest(db: Db, id: string, ipHash: string): Promise<boolean> {
  const result = await db.execute<{ earlier: number }>(sql`
    with ins as (
      insert into password_reset_requests (id, ip_hash) values (${id}, ${ipHash}) returning id
    )
    select count(*)::int as earlier from password_reset_requests
    where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'
  `);
  // The count sees the table as it was before this insert.
  return Number(result.rows[0]?.earlier ?? 0) + 1 <= RESET_REQUESTS_PER_IP_PER_HOUR;
}

// Stores a new token for the user, valid for 60 minutes, unless they've had
// their hourly share already. Returns whether it was stored.
export async function issueResetToken(
  db: Db,
  id: string,
  userId: string,
  tokenHash: string
): Promise<boolean> {
  const result = await db.execute<{ n: number }>(sql`
    with recent as (
      select count(*) as n from password_reset_tokens
      where user_id = ${userId} and created_at > now() - interval '1 hour'
    ), ins as (
      insert into password_reset_tokens (id, user_id, token_hash, expires_at)
      select ${id}, ${userId}, ${tokenHash}, now() + make_interval(mins => ${RESET_TOKEN_MINUTES})
      from recent where recent.n < ${RESET_EMAILS_PER_ACCOUNT_PER_HOUR}
      returning id
    )
    select count(*)::int as n from ins
  `);
  return Number(result.rows[0]?.n ?? 0) > 0;
}

// Whether a token (by its hash) can still be used: not used, not expired,
// and not a demo account's.
export async function isResetTokenUsable(db: Db, tokenHash: string): Promise<boolean> {
  const result = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from password_reset_tokens as t
    join users as u on u.id = t.user_id
    where t.token_hash = ${tokenHash} and t.used_at is null and t.expires_at > now() and not u.is_demo
  `);
  return Number(result.rows[0]?.n ?? 0) > 0;
}

// Uses a token, in one statement: the user's new password, their session
// version bumped (every session ends), and all their tokens marked used.
// Returns the user's id, or null when the token isn't usable.
export async function consumeResetToken(
  db: Db,
  tokenHash: string,
  passwordHash: string
): Promise<string | null> {
  const result = await db.execute<{ id: string }>(sql`
    with target as (
      select t.user_id from password_reset_tokens as t
      join users as u on u.id = t.user_id
      where t.token_hash = ${tokenHash} and t.used_at is null and t.expires_at > now() and not u.is_demo
    ), upd as (
      update users set password_hash = ${passwordHash}, session_version = session_version + 1
      where id in (select user_id from target)
      returning id
    ), used as (
      update password_reset_tokens set used_at = now()
      where user_id in (select id from upd) and used_at is null
      returning id
    )
    select id from upd
  `);
  return result.rows[0]?.id ?? null;
}
