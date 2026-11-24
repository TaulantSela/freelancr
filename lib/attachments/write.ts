import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { ATTACHMENT_QUOTA_BYTES } from "./files";

type Db = ReturnType<typeof getDb>;

export type InsertAttachmentResult = "saved" | "notFound" | "overQuota";

// Stores a file for one of the user's payments or clients, in one
// statement: nothing is written unless the payment or client is the user's
// and their files stay within the quota. The bytes go in as base64 text,
// decoded by Postgres.
export async function insertAttachment(
  db: Db,
  a: {
    id: string;
    userId: string;
    owner: { paymentId: string } | { clientId: string };
    filename: string;
    contentType: string;
    bytes: Uint8Array;
    // Their files' limit in all.
    quotaBytes?: number;
  }
): Promise<InsertAttachmentResult> {
  const paymentId = "paymentId" in a.owner ? a.owner.paymentId : null;
  const clientId = "clientId" in a.owner ? a.owner.clientId : null;
  const owner =
    paymentId !== null
      ? sql`select id from payments where id = ${paymentId} and user_id = ${a.userId}`
      : sql`select id from clients where id = ${clientId} and user_id = ${a.userId}`;
  const size = a.bytes.byteLength;
  const result = await db.execute<{ saved: number; owned: number }>(sql`
    with owner as (${owner}),
    usage as (
      select coalesce(sum(size_bytes), 0) as used from attachments where user_id = ${a.userId}
    ), ins as (
      insert into attachments (id, user_id, payment_id, client_id, filename, content_type, size_bytes, data)
      select ${a.id}, ${a.userId}, ${paymentId}, ${clientId}, ${a.filename}, ${a.contentType},
        ${size}::int, decode(${Buffer.from(a.bytes).toString("base64")}, 'base64')
      from owner, usage
      where usage.used + ${size}::bigint <= ${a.quotaBytes ?? ATTACHMENT_QUOTA_BYTES}::bigint
      returning id
    )
    select (select count(*) from ins)::int as saved, (select count(*) from owner)::int as owned
  `);
  const row = result.rows[0];
  if (Number(row?.saved ?? 0) > 0) return "saved";
  return Number(row?.owned ?? 0) > 0 ? "overQuota" : "notFound";
}

// Deletes one of the user's files. Returns what it belonged to, or null
// when it isn't the user's.
export async function deleteAttachment(
  db: Db,
  id: string,
  userId: string
): Promise<{ paymentId: string | null; clientId: string | null } | null> {
  const result = await db.execute<{ payment_id: string | null; client_id: string | null }>(sql`
    delete from attachments where id = ${id} and user_id = ${userId}
    returning payment_id, client_id
  `);
  const row = result.rows[0];
  return row ? { paymentId: row.payment_id, clientId: row.client_id } : null;
}
