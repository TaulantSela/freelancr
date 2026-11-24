import { getDb } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email/config";
import { runReminders } from "@/lib/reminders/run";
import { deleteExpiredSandboxes } from "@/lib/demo/sandbox";
import { pruneEmailLog } from "@/lib/email/log";
import { isBackupConfigured, runBackup } from "@/lib/backup/run";
import { refreshSharedDemo } from "@/lib/demo/shared";
import { alertOwner } from "@/lib/email/alert";
import { toSkopjeDate } from "@/lib/tax/calculator";

// What the daily cron (app/api/cron/daily) runs, in order.
type Job = {
  name: string;
  // Skipped (not run) while email isn't configured.
  needsEmail: boolean;
  // Skipped while this says no.
  enabled?: () => boolean;
  run: (now: Date) => Promise<Record<string, number>>;
};

// A job whose failure shouldn't stop the run: it's logged, reported in the
// cron's result as { failed: 1 }, and emailed to ALERT_EMAIL.
function guarded(
  what: string,
  run: (now: Date) => Promise<Record<string, number>>
): (now: Date) => Promise<Record<string, number>> {
  return async (now) => {
    try {
      return await run(now);
    } catch (error) {
      console.error(`${what} failed:`, error);
      const message = error instanceof Error ? error.message : String(error);
      await alertOwner(`${what} failed`, [
        `${what} failed in the daily run at ${now.toISOString()}.`,
        `Error: ${message.slice(0, 1000)}`,
        "Check the function log for /api/cron/daily in Vercel. For a backup, make one by hand: npm run backup -- now, with the production env (README, \"Backups\").",
      ]).catch(() => {});
      return { failed: 1 };
    }
  };
}

const JOBS: Job[] = [
  // Sandboxes past their 24 hours, whether or not email is set up.
  { name: "sandboxes", needsEmail: false, run: (now) => deleteExpiredSandboxes(getDb(), now) },
  // The email log the daily cap counts: rows older than 2 days.
  { name: "emailLog", needsEmail: false, run: (now) => pruneEmailLog(getDb(), now) },
  { name: "reminders", needsEmail: true, run: runReminders },
  // The shared demo account's sample data, dated from today (lib/demo/shared.ts).
  {
    name: "sharedDemo",
    needsEmail: false,
    run: guarded("The shared demo's refresh", (now) => refreshSharedDemo(getDb(), toSkopjeDate(now))),
  },
  // The whole database, encrypted, to private Vercel Blob (lib/backup), last:
  // it's the slowest, and it then has the refreshed demo in it.
  { name: "backup", needsEmail: false, enabled: isBackupConfigured, run: guarded("The nightly backup", runBackup) },
];

export async function runDailyJobs(now: Date) {
  const ran: Record<string, Record<string, number>> = {};
  const skipped: string[] = [];
  for (const job of JOBS) {
    if ((job.needsEmail && !isEmailConfigured()) || (job.enabled && !job.enabled())) skipped.push(job.name);
    else ran[job.name] = await job.run(now);
  }
  return { ran, skipped };
}
