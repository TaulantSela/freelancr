import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getSessionSecret } from "@/lib/env";

const SESSION_COOKIE = "freelancr_session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" || pathname === "/sign-in" || pathname === "/sign-up";

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isPublic) {
    if (token && (pathname === "/sign-in" || pathname === "/sign-up")) {
      try {
        await jwtVerify(token, getSessionSecret());
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } catch {
        // Invalid token, let them through
      }
    }
    return NextResponse.next();
  }

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
