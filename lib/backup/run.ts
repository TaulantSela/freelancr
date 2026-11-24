// The nightly backup (lib/cron/jobs.ts): the whole database, sealed with
// BACKUP_KEY, into the private Vercel Blob store at backups/<time>.flbk,
// then backups older than 14 days are deleted (the newest 3 always stay).
// Skipped unless BACKUP_KEY and BLOB_READ_WRITE_TOKEN are both set.
// scripts/restore-backup.ts reads one back.

import { del, list, put } from "@vercel/blob";
import { dumpDatabase } from "./dump";
import { backupKey, sealBackup } from "./format";

export const BACKUP_PREFIX = "backups/";
export const BACKUP_KEEP_DAYS = 14;
const BACKUP_KEEP_AT_LEAST = 3;

export function isBackupConfigured(): boolean {
  return Boolean(process.env.BACKUP_KEY?.trim() && process.env.BLOB_READ_WRITE_TOKEN);
}

// "backups/2026-11-25T07-00-03Z.flbk"
export function backupPathname(now: Date): string {
  return `${BACKUP_PREFIX}${now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-")}.flbk`;
}

export async function listBackups(): Promise<{ pathname: string; uploadedAt: Date; size: number }[]> {
  const found: { pathname: string; uploadedAt: Date; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: BACKUP_PREFIX, cursor });
    for (const b of page.blobs) found.push({ pathname: b.pathname, uploadedAt: new Date(b.uploadedAt), size: b.size });
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return found.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

async function pruneBackups(now: Date): Promise<number> {
  const cutoff = now.getTime() - BACKUP_KEEP_DAYS * 86_400_000;
  const old = (await listBackups()).slice(BACKUP_KEEP_AT_LEAST).filter((b) => b.uploadedAt.getTime() < cutoff);
  if (old.length > 0) await del(old.map((b) => b.pathname));
  return old.length;
}

export async function runBackup(now: Date): Promise<Record<string, number>> {
  const key = backupKey();
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!key || !url) throw new Error("BACKUP_KEY and DATABASE_URL must be set");
  const { text, manifest } = await dumpDatabase(url, now);
  const sealed = sealBackup(Buffer.from(text, "utf8"), key);
  await put(backupPathname(now), sealed, {
    access: "private",
    contentType: "application/octet-stream",
    addRandomSuffix: false,
    multipart: sealed.length > 20_000_000,
  });
  return {
    tables: manifest.tables.length,
    rows: manifest.tables.reduce((s, t) => s + t.rows, 0),
    bytes: sealed.length,
    pruned: await pruneBackups(now),
  };
}
