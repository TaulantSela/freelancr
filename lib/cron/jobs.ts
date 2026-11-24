import { getDb } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email/config";
import { runReminders } from "@/lib/reminders/run";
import { deleteExpiredSandboxes } from "@/lib/demo/sandbox";

// What the daily cron (app/api/cron/daily) runs, in order.
type Job = {
  name: string;
  // Skipped (not run) while email isn't configured.
  needsEmail: boolean;
  run: (now: Date) => Promise<Record<string, number>>;
};

const JOBS: Job[] = [
  // Sandboxes past their 24 hours, whether or not email is set up.
  { name: "sandboxes", needsEmail: false, run: (now) => deleteExpiredSandboxes(getDb(), now) },
  { name: "reminders", needsEmail: true, run: runReminders },
];

export async function runDailyJobs(now: Date) {
  const ran: Record<string, Record<string, number>> = {};
  const skipped: string[] = [];
  for (const job of JOBS) {
    if (job.needsEmail && !isEmailConfigured()) skipped.push(job.name);
    else ran[job.name] = await job.run(now);
  }
  return { ran, skipped };
}
