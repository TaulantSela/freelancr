// A logical copy of every table in the public schema, and loading one back.
//
// A dump is text, one JSON object per line: first the manifest, then one
// line per row, {"t": table, "r": row_to_json(row)}. Tables come in load
// order (a table after every table its foreign keys point to), so a restore
// can insert them as they come. bytea comes out as Postgres' hex text
// ("\\x..."), which json_populate_recordset turns back into bytes.
//
// Both run over one WebSocket connection (the app's HTTP driver can't hold a
// transaction open): the dump inside a read-only REPEATABLE READ transaction,
// so it's one consistent snapshot; the restore inside one transaction, so a
// failed restore changes nothing.

import { Pool, type PoolClient } from "@neondatabase/serverless";

export type BackupManifest = {
  format: "freelancr-backup";
  version: 1;
  createdAt: string;
  // The schema the rows fit: drizzle's applied migrations.
  migrations: { count: number; lastCreatedAt: string | null };
  // In load order.
  tables: { name: string; rows: number }[];
};

// Rows per query. Tables with bytea (attachments, up to 4 MB a file) go a
// few at a time to keep each response small.
const BATCH_ROWS = 500;
const BATCH_ROWS_BYTEA = 5;
// A restore sends rows in batches of about this much JSON.
const INSERT_BATCH_CHARS = 4_000_000;

function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function connect(url: string): Pool {
  return new Pool({ connectionString: url });
}

async function tables(client: PoolClient): Promise<string[]> {
  const r = await client.query<{ name: string }>(`
    select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by c.relname
  `);
  return r.rows.map((row) => row.name);
}

// Parents before children; a table's own self-references don't count.
async function loadOrder(client: PoolClient, names: string[]): Promise<string[]> {
  const r = await client.query<{ child: string; parent: string }>(`
    select cc.relname as child, pc.relname as parent
    from pg_constraint k
    join pg_class cc on cc.oid = k.conrelid
    join pg_class pc on pc.oid = k.confrelid
    join pg_namespace n on n.oid = cc.relnamespace
    where k.contype = 'f' and n.nspname = 'public'
  `);
  const parents = new Map<string, Set<string>>(names.map((n) => [n, new Set()]));
  for (const { child, parent } of r.rows) {
    if (child !== parent && parents.has(child) && parents.has(parent)) parents.get(child)!.add(parent);
  }
  const ordered: string[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (name: string) => {
    if (done.has(name)) return;
    if (visiting.has(name)) throw new Error(`Foreign keys go round in a circle at ${name}`);
    visiting.add(name);
    for (const p of [...parents.get(name)!].sort()) visit(p);
    visiting.delete(name);
    done.add(name);
    ordered.push(name);
  };
  for (const name of names) visit(name);
  return ordered;
}

async function primaryKeys(client: PoolClient): Promise<Map<string, string[]>> {
  const r = await client.query<{ table_name: string; column_name: string }>(`
    select kcu.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema and kcu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'
    order by kcu.table_name, kcu.ordinal_position
  `);
  const keys = new Map<string, string[]>();
  for (const row of r.rows) keys.set(row.table_name, [...(keys.get(row.table_name) ?? []), row.column_name]);
  return keys;
}

async function byteaTables(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ table_name: string }>(`
    select distinct table_name from information_schema.columns
    where table_schema = 'public' and data_type = 'bytea'
  `);
  return new Set(r.rows.map((row) => row.table_name));
}

async function migrations(client: PoolClient): Promise<BackupManifest["migrations"]> {
  const exists = await client.query(
    `select 1 from pg_tables where schemaname = 'drizzle' and tablename = '__drizzle_migrations'`
  );
  if (exists.rows.length === 0) return { count: 0, lastCreatedAt: null };
  const r = await client.query<{ count: number; last: string | null }>(
    `select count(*)::int as count, max(created_at)::text as last from drizzle.__drizzle_migrations`
  );
  return { count: r.rows[0].count, lastCreatedAt: r.rows[0].last };
}

// The whole database as dump text, with its manifest.
export async function dumpDatabase(url: string, now: Date): Promise<{ text: string; manifest: BackupManifest }> {
  const pool = connect(url);
  const client = await pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const order = await loadOrder(client, await tables(client));
    const keys = await primaryKeys(client);
    const bytea = await byteaTables(client);
    const manifest: BackupManifest = {
      format: "freelancr-backup",
      version: 1,
      createdAt: now.toISOString(),
      migrations: await migrations(client),
      tables: [],
    };
    const lines: string[] = [];
    for (const table of order) {
      const orderBy = (keys.get(table) ?? []).map(ident).join(", ") || "ctid";
      const batch = bytea.has(table) ? BATCH_ROWS_BYTEA : BATCH_ROWS;
      let rows = 0;
      for (let offset = 0; ; offset += batch) {
        const r = await client.query<{ r: string }>(
          `select row_to_json(t)::text as r from ${ident(table)} t order by ${orderBy} limit $1 offset $2`,
          [batch, offset]
        );
        for (const row of r.rows) lines.push(`{"t":${JSON.stringify(table)},"r":${row.r}}`);
        rows += r.rows.length;
        if (r.rows.length < batch) break;
      }
      manifest.tables.push({ name: table, rows });
    }
    await client.query("commit");
    return { text: [JSON.stringify(manifest), ...lines].join("\n") + "\n", manifest };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

export function parseDump(text: string): { manifest: BackupManifest; rows: Map<string, string[]> } {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const manifest = JSON.parse(lines[0]) as BackupManifest;
  if (manifest.format !== "freelancr-backup" || manifest.version !== 1) throw new Error("Unknown backup format");
  const rows = new Map<string, string[]>(manifest.tables.map((t) => [t.name, []]));
  for (const line of lines.slice(1)) {
    const { t, r } = JSON.parse(line) as { t: string; r: unknown };
    const list = rows.get(t);
    if (!list) throw new Error(`Row for a table the manifest doesn't list: ${t}`);
    list.push(JSON.stringify(r));
  }
  for (const t of manifest.tables) {
    const n = rows.get(t.name)!.length;
    if (n !== t.rows) throw new Error(`${t.name}: ${n} rows, the manifest says ${t.rows}`);
  }
  return { manifest, rows };
}

// Loads a dump into the database at `url`, all or nothing. The database has
// to be at the same migration as the backup (run the migrations of the same
// commit first). With `wipe`, every table the backup has is emptied first;
// without it, the database must have no users.
export async function restoreDatabase(
  url: string,
  text: string,
  { wipe }: { wipe: boolean }
): Promise<{ manifest: BackupManifest; restored: { name: string; rows: number }[] }> {
  const { manifest, rows } = parseDump(text);
  const pool = connect(url);
  const client = await pool.connect();
  try {
    const target = await migrations(client);
    if (target.count !== manifest.migrations.count) {
      throw new Error(
        `The database has ${target.count} migrations applied and the backup ${manifest.migrations.count}: migrate it to the backup's level first`
      );
    }
    await client.query("begin");
    if (wipe) {
      await client.query(`truncate ${manifest.tables.map((t) => ident(t.name)).join(", ")} cascade`);
    } else {
      const users = await client.query<{ n: number }>(`select count(*)::int as n from users`);
      if (users.rows[0].n > 0) throw new Error("The database already has users: pass --wipe to replace them");
    }
    const restored: { name: string; rows: number }[] = [];
    for (const { name } of manifest.tables) {
      const list = rows.get(name)!;
      let batch: string[] = [];
      let chars = 0;
      const flush = async () => {
        if (batch.length === 0) return;
        await client.query(
          `insert into ${ident(name)} select * from json_populate_recordset(null::${ident(name)}, $1::json)`,
          [`[${batch.join(",")}]`]
        );
        batch = [];
        chars = 0;
      };
      for (const row of list) {
        if (chars + row.length > INSERT_BATCH_CHARS) await flush();
        batch.push(row);
        chars += row.length;
      }
      await flush();
      const count = await client.query<{ n: number }>(`select count(*)::int as n from ${ident(name)}`);
      if (count.rows[0].n !== list.length) throw new Error(`${name}: ${count.rows[0].n} rows after restoring ${list.length}`);
      restored.push({ name, rows: list.length });
    }
    await client.query("commit");
    return { manifest, restored };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
