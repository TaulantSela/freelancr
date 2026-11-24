import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { getSessionSecret } from "@/lib/env";
import { getDb, users } from "@/lib/db";

const SESSION_COOKIE = "freelancr_session";

// What the session cookie's JWT carries. `sv` is the user's session_version
// when it was issued: changing or resetting the password bumps the version,
// which ends every session issued before. Tokens from before `sv` existed
// count as version 0, so they outlived the deploy that added it.
export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  sv: number;
}

// The signed-in user, as the database has them now.
export interface Session {
  userId: string;
  email: string;
  name: string;
  // A shared account with a public password (users.is_demo).
  isDemo: boolean;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

// The signature, then the database: the user still exists and the token's
// version is current. React's cache() makes it one query per request,
// however many components ask. proxy.ts only checks the signature (it runs
// before any page, without the database); a stale token gets through it and
// is turned away here.
export const getSession = cache(async (): Promise<Session | null> => {
  let claims: Partial<SessionPayload>;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    ({ payload: claims } = (await jwtVerify(token, getSessionSecret())) as {
      payload: Partial<SessionPayload>;
    });
  } catch {
    return null;
  }
  if (typeof claims.userId !== "string") return null;

  const [user] = await getDb()
    .select({
      email: users.email,
      name: users.name,
      isDemo: users.isDemo,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, claims.userId))
    .limit(1);
  const version = typeof claims.sv === "number" ? claims.sv : 0;
  if (!user || user.sessionVersion !== version) return null;
  return { userId: claims.userId, email: user.email, name: user.name, isDemo: user.isDemo };
});

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
