import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 replaced `middleware.ts` with `proxy.ts`.
 *
 * Optimistic route protection only (per the docs, proxy is NOT a session
 * solution): it checks that a session cookie EXISTS, then lets the pages do
 * the real verification — /dashboard awaits auth(), the Express API decrypts
 * the token itself.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dev (http) uses the plain name, production (https) the __Secure- one.
  const token =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value;

  // Not signed in → can't see the dashboard.
  if (pathname.startsWith("/dashboard") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already signed in → no point showing the sign-in/sign-up forms.
  if ((pathname === "/login" || pathname === "/signup") && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
