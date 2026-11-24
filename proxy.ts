import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getSessionSecret } from "@/lib/env";

const SESSION_COOKIE = "freelancr_session";

// The app lives at freelancr.taulantsela.com; its old address forwards
// there. Not the cron route: Vercel Cron calls the production URL and
// doesn't follow redirects, so a redirect there would skip the job. (A
// redirect set on the domain in Vercel can't make that exception.)
const OLD_HOST = "freelancr-mk.vercel.app";
const HOST = "freelancr.taulantsela.com";

// Checks the session token's signature only; pages check it against the
// database (lib/auth/session.ts), which can end a session this lets
// through. Signed-in visitors to /sign-in and /sign-up are sent on by the
// (auth) layout, which can tell a current session from a stale one; doing
// it here would bounce a stale one back and forth.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.nextUrl.hostname === OLD_HOST && !pathname.startsWith("/api/cron/")) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  const isPublic =
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    // The walkthrough page and its video, poster and screenshots.
    pathname === "/demo" ||
    pathname.startsWith("/demo/") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    // Where deleting an account lands, signed out.
    pathname === "/account-deleted" ||
    // Vercel Cron: no session, a bearer secret (checked by the route).
    pathname.startsWith("/api/cron/");

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isPublic) return NextResponse.next();

  if (!token) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  try {
    await jwtVerify(token, getSessionSecret());
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/sign-in", request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
