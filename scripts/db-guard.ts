// The commands that change a database from a laptop (`npm run db:migrate`, `db:push`, `db:seed`,
// and `setup`, which runs two of them) only run on a database marked as a disposable dev
// database. Production is never marked, so if .env.local (or the shell) ever points at it, they
// stop instead of changing it. Production gets its migrations from its own build (`vercel-build`
// runs lib/db/migrate.ts directly) and its demo account from the daily cron, so neither goes
// through this check. Backups have their own (`restore --into <host>`).
//
// The mark is a comment on the database itself, so it holds whichever connection string leads
// there. To mark a dev database (never production), run this once against it, e.g. in Neon's
// SQL editor:
//   COMMENT ON DATABASE neondb IS 'freelancr:disposable';
import { neon } from "@neondatabase/serverless";

export const DISPOSABLE_MARK = "freelancr:disposable";

/**
 * Throws unless every database the environment points at (DATABASE_URL, and
 * DATABASE_URL_UNPOOLED if set) is marked as disposable. Returns what it checked.
 */
export async function assertDisposableDatabase(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const urls = [...new Set([env.DATABASE_URL, env.DATABASE_URL_UNPOOLED].filter((url): url is string => !!url))];
  if (urls.length === 0) throw new Error("DATABASE_URL isn't set; run `vercel env pull .env.local` first.");

  const checked: string[] = [];
  for (const url of urls) {
    const sql = neon(url);
    const rows = (await sql`
      select datname as name, shobj_description(oid, 'pg_database') as mark
      from pg_database where datname = current_database()`) as { name: string; mark: string | null }[];
    const where = `${new URL(url).hostname.split(".")[0]}/${rows[0]?.name ?? "?"}`;
    if (rows[0]?.mark !== DISPOSABLE_MARK) {
      throw new Error(
        `Refusing to touch ${where}: it isn't marked as a disposable dev database, and production never is.\n` +
          "Point DATABASE_URL at the dev database, freelancr-dev: run `vercel env pull .env.local` (see the README).",
      );
    }
    checked.push(where);
  }
  return checked;
}
