import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb, users } from "../lib/db";
import { toSkopjeDate } from "../lib/tax/calculator";
import { SAMPLE_PROFILE, insertSampleData } from "../lib/demo/sample-data";
import { SHARED_DEMO_EMAIL } from "../lib/demo/shared";

const DEMO_EMAIL = SHARED_DEMO_EMAIL;
const DEMO_PASSWORD = "demo1234";

// The shared demo account, with the same sample data a visitor's sandbox
// gets (lib/demo/sample-data.ts), dated from today. Unlike a sandbox it
// doesn't expire; the daily cron seeds it again every day
// (lib/demo/shared.ts).
async function main() {
  const db = getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (existing) {
    console.log(`Demo account already exists (${DEMO_EMAIL}) — skipping seed.`);
    process.exit(0);
  }

  const userId = nanoid();
  await db.insert(users).values({
    id: userId,
    email: DEMO_EMAIL,
    passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 12),
    ...SAMPLE_PROFILE,
    // Its password is public: no password changes, resets, email or
    // reminders.
    isDemo: true,
  });
  const { approximateRates } = await insertSampleData(db, userId, toSkopjeDate(new Date()));
  console.log(
    approximateRates === 0
      ? "Using the National Bank's rates."
      : `National Bank rates missing for ${approximateRates} amount(s): those use the fixed rates, marked as such.`
  );

  console.log("✓ Demo account seeded");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
