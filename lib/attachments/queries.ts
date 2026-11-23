import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, attachments } from "@/lib/db";

// Everything but the bytes: those are only selected by getAttachmentFile,
// for the download route.
const listColumns = {
  id: attachments.id,
  filename: attachments.filename,
  contentType: attachments.contentType,
  sizeBytes: attachments.sizeBytes,
  createdAt: attachments.createdAt,
};

export type AttachmentRow = Awaited<ReturnType<typeof getPaymentAttachments>>[number];

export async function getPaymentAttachments(paymentId: string, userId: string) {
  return getDb()
    .select(listColumns)
    .from(attachments)
    .where(and(eq(attachments.paymentId, paymentId), eq(attachments.userId, userId)))
    .orderBy(desc(attachments.createdAt));
}

export async function getClientAttachments(clientId: string, userId: string) {
  return getDb()
    .select(listColumns)
    .from(attachments)
    .where(and(eq(attachments.clientId, clientId), eq(attachments.userId, userId)))
    .orderBy(desc(attachments.createdAt));
}

// payment id -> how many files it has, for the given payments.
export async function getPaymentAttachmentCounts(
  userId: string,
  paymentIds: readonly string[]
): Promise<Map<string, number>> {
  if (paymentIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ paymentId: attachments.paymentId, n: count() })
    .from(attachments)
    .where(and(eq(attachments.userId, userId), inArray(attachments.paymentId, [...paymentIds])))
    .groupBy(attachments.paymentId);
  return new Map(rows.map((r) => [r.paymentId as string, Number(r.n)]));
}

// client id -> how many contracts it has.
export async function getClientAttachmentCounts(userId: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ clientId: attachments.clientId, n: count() })
    .from(attachments)
    .where(and(eq(attachments.userId, userId), isNotNull(attachments.clientId)))
    .groupBy(attachments.clientId);
  return new Map(rows.map((r) => [r.clientId as string, Number(r.n)]));
}

// What the user keeps in all, in bytes.
export async function getAttachmentUsage(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ used: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)` })
    .from(attachments)
    .where(eq(attachments.userId, userId));
  return Number(row?.used ?? 0);
}

// The file itself, only if it's the user's. The one place the bytes are
// read; they travel as base64 text, which every Postgres driver handles the
// same way.
export async function getAttachmentFile(
  id: string,
  userId: string
): Promise<{ filename: string; contentType: string; data: Buffer } | null> {
  const [row] = await getDb()
    .select({
      filename: attachments.filename,
      contentType: attachments.contentType,
      data: sql<string>`encode(${attachments.data}, 'base64')`,
    })
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { filename: row.filename, contentType: row.contentType, data: Buffer.from(row.data, "base64") };
}
