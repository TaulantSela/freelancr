import { createHash, timingSafeEqual } from "node:crypto";
import { runDailyJobs } from "@/lib/cron/jobs";

export const dynamic = "force-dynamic";

// Vercel Cron calls this once a day (vercel.json) with
// "Authorization: Bearer <CRON_SECRET>". Anything else, or no CRON_SECRET
// set, gets a 401. Compared in constant time, over digests so the lengths
// don't matter.
function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await runDailyJobs(new Date()));
}
