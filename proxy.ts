import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await validateSession(sessionId) : null;

  // FR-6.2 / FR-7.1: block dashboard access without a valid session before any
  // protected content is rendered.
  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      return NextResponse.redirect(new URL("/signin", request.url));
    }
    return NextResponse.next();
  }

  // FR-7.2: a signed-in, verified user visiting auth screens is sent to the
  // dashboard.
  if (pathname === "/signin" || pathname === "/signup") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/signin", "/signup"],
};
