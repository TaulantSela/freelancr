"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/lib/db";
import { getSessionSecret } from "@/lib/env";
import { generateId } from "@/lib/utils";
import { clientIp, hashIp } from "@/lib/auth/reset";
import { createSession, deleteSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { toSkopjeDate } from "@/lib/tax/calculator";
import { SAMPLE_PROFILE, insertSampleData } from "@/lib/demo/sample-data";
import { insertSandboxUser, recordSandboxRequest, sandboxEmail } from "@/lib/demo/sandbox";

export type SandboxState = { errorKey: "busy" } | null;

// "Try it with sample data": a new sandbox account with the sample data, in
// the visitor's language, then signed in on the dashboard. At most 5 an hour
// from one IP and 300 live at once; past either, "the demo is busy".
// (A form action through useActionState; it takes nothing from the form.)
export async function startSandbox(): Promise<SandboxState> {
  const db = getDb();
  const ipHash = hashIp(clientIp(await headers()), getSessionSecret());
  if (!(await recordSandboxRequest(db, generateId(), ipHash))) return { errorKey: "busy" };

  const id = generateId();
  const email = sandboxEmail();
  const now = new Date();
  if (!(await insertSandboxUser(db, { id, email, locale: await getLocale(), now }))) {
    return { errorKey: "busy" };
  }
  try {
    // The National Bank gets 2.5 seconds; past that, the fixed rates.
    await insertSampleData(db, id, toSkopjeDate(now), { rateTimeoutMs: 2500 });
  } catch (error) {
    await db.delete(users).where(eq(users.id, id));
    throw error;
  }
  await createSession({ userId: id, email, name: SAMPLE_PROFILE.name, sv: 0 });
  redirect("/dashboard");
}

// "Create your own account" from a sandbox: signs out and opens the sign-up
// page. The sandbox itself goes with the daily cleanup.
export async function leaveSandbox() {
  await deleteSession();
  redirect("/sign-up");
}
