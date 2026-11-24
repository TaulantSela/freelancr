// The shared demo account: demo@freelancr.mk, whose password is public in
// the README. Its sample data is dated from the day it's seeded, so left
// alone it ages: this month's "to file" turns late, and the months move on.
// The daily cron seeds it again every day (lib/cron/jobs.ts), which also
// undoes whatever visitors changed in it.
//
// The user row is deleted, which takes all its records with it (as the
// sandbox clean-up does), and put back with the same id, password hash,
// session version and language, so whoever is signed in stays signed in.

import { and, eq, isNull } from "drizzle-orm";
import { getDb, users } from "@/lib/db";
import { SAMPLE_PROFILE, insertSampleData } from "./sample-data";

type Db = ReturnType<typeof getDb>;

export const SHARED_DEMO_EMAIL = "demo@freelancr.mk";

export async function refreshSharedDemo(db: Db, today: string): Promise<Record<string, number>> {
  const [demo] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      sessionVersion: users.sessionVersion,
      locale: users.locale,
    })
    .from(users)
    .where(and(eq(users.email, SHARED_DEMO_EMAIL), eq(users.isDemo, true), isNull(users.demoExpiresAt)))
    .limit(1);
  if (!demo) return { refreshed: 0 };

  await db.delete(users).where(eq(users.id, demo.id));
  await db.insert(users).values({
    id: demo.id,
    email: SHARED_DEMO_EMAIL,
    passwordHash: demo.passwordHash,
    sessionVersion: demo.sessionVersion,
    locale: demo.locale,
    ...SAMPLE_PROFILE,
    isDemo: true,
  });
  const { approximateRates } = await insertSampleData(db, demo.id, today);
  return { refreshed: 1, approximateRates };
}
