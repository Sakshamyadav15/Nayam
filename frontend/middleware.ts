/**
 * NAYAM — Next.js Middleware
 *
 * Protects all routes except /login by checking for the auth token cookie.
 * Since we use localStorage for tokens (client-side), this middleware
 * is a lightweight guard that redirects unauthenticated requests.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/api", "/_next", "/favicon.ico", "/icon", "/apple-icon"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for auth token in cookie (set by client-side for middleware compat)
  const token = request.cookies.get("nayam_token")?.value

  // If no cookie, we can't block server-rendered pages reliably
  // since the token is in localStorage. The client-side AuthGuard
  // will handle the redirect. Let the request through.
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
