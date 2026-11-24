import { isEmailConfigured } from "@/lib/email/config";
import { runReminders } from "@/lib/reminders/run";

// What the daily cron (app/api/cron/daily) runs, in order. Phase 5 adds
// sandbox cleanup here.
type Job = {
  name: string;
  // Skipped (not run) while email isn't configured.
  needsEmail: boolean;
  run: (now: Date) => Promise<Record<string, number>>;
};

const JOBS: Job[] = [{ name: "reminders", needsEmail: true, run: runReminders }];

export async function runDailyJobs(now: Date) {
  const ran: Record<string, Record<string, number>> = {};
  const skipped: string[] = [];
  for (const job of JOBS) {
    if (job.needsEmail && !isEmailConfigured()) skipped.push(job.name);
    else ran[job.name] = await job.run(now);
  }
  return { ran, skipped };
}
