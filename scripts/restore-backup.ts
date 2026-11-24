// Backups by hand: list them, make one now, look inside one, or restore one.
//
//   npm run backup -- list
//   npm run backup -- now
//   npm run backup -- inspect <backups/....flbk | ./file.flbk>
//   npm run backup -- restore <backups/....flbk | ./file.flbk> --into <database host> [--wipe]
//
// Reads BACKUP_KEY, BLOB_READ_WRITE_TOKEN and DATABASE_URL(_UNPOOLED) from the
// env file the npm script loads (BACKUP_ENV, default .env.local). To restore
// production, pull its env into a file outside the repo, point BACKUP_ENV at
// it, and delete it afterwards (README, "Backups").
//
// restore writes to the database in DATABASE_URL, so --into has to name that
// database's host: a typo can't restore into the wrong one. The database must
// be migrated to the backup's level first; --wipe empties it before loading.

import { readFile } from "node:fs/promises";
import { get } from "@vercel/blob";
import { dumpDatabase, parseDump, restoreDatabase } from "../lib/backup/dump";
import { backupKey, openBackup } from "../lib/backup/format";
import { listBackups, runBackup } from "../lib/backup/run";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL isn't set");
  return url;
}

function requireKey(): Buffer {
  const key = backupKey();
  if (!key) throw new Error("BACKUP_KEY isn't set");
  return key;
}

async function readSealed(source: string): Promise<Buffer> {
  if (!source.startsWith("backups/")) return readFile(source);
  const result = await get(source, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) throw new Error(`No backup at ${source}`);
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

async function main() {
  const [command, source, ...rest] = process.argv.slice(2);
  if (command === "list") {
    for (const b of await listBackups()) {
      console.log(`${b.pathname}  ${(b.size / 1024).toFixed(0)} KB  ${b.uploadedAt.toISOString()}`);
    }
    return;
  }
  if (command === "now") {
    requireKey();
    console.log(await runBackup(new Date()));
    return;
  }
  if (command === "inspect" && source) {
    const { manifest } = parseDump(openBackup(await readSealed(source), requireKey()).toString("utf8"));
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  if (command === "restore" && source) {
    const into = rest[rest.indexOf("--into") + 1];
    const host = new URL(databaseUrl()).hostname;
    if (!rest.includes("--into") || !into || into !== host) {
      throw new Error(`--into must name the target database's host, ${host}`);
    }
    const text = openBackup(await readSealed(source), requireKey()).toString("utf8");
    const { manifest, restored } = await restoreDatabase(databaseUrl(), text, { wipe: rest.includes("--wipe") });
    console.log(`Restored the backup from ${manifest.createdAt} into ${host}:`);
    for (const t of restored) console.log(`  ${t.name}: ${t.rows}`);
    return;
  }
  // A dump of the current database to stdout, unencrypted, for checks.
  if (command === "dump-plain") {
    process.stdout.write((await dumpDatabase(databaseUrl(), new Date())).text);
    return;
  }
  console.error("Usage: npm run backup -- list | now | inspect <source> | restore <source> --into <host> [--wipe]");
  process.exit(2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
