import { getDb } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email/config";
import { runReminders } from "@/lib/reminders/run";
import { deleteExpiredSandboxes } from "@/lib/demo/sandbox";
import { pruneEmailLog } from "@/lib/email/log";
import { isBackupConfigured, runBackup } from "@/lib/backup/run";

// What the daily cron (app/api/cron/daily) runs, in order.
type Job = {
  name: string;
  // Skipped (not run) while email isn't configured.
  needsEmail: boolean;
  // Skipped while this says no.
  enabled?: () => boolean;
  run: (now: Date) => Promise<Record<string, number>>;
};

// The nightly backup, last: it's the slowest, and a failure is reported in
// the cron's result (and the function log) instead of stopping the run.
async function backupJob(now: Date): Promise<Record<string, number>> {
  try {
    return await runBackup(now);
  } catch (error) {
    console.error("Backup failed:", error);
    return { failed: 1 };
  }
}

const JOBS: Job[] = [
  // Sandboxes past their 24 hours, whether or not email is set up.
  { name: "sandboxes", needsEmail: false, run: (now) => deleteExpiredSandboxes(getDb(), now) },
  // The email log the daily cap counts: rows older than 2 days.
  { name: "emailLog", needsEmail: false, run: (now) => pruneEmailLog(getDb(), now) },
  { name: "reminders", needsEmail: true, run: runReminders },
  // The whole database, encrypted, to private Vercel Blob (lib/backup).
  { name: "backup", needsEmail: false, enabled: isBackupConfigured, run: backupJob },
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
