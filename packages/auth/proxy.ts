import { updateSession } from "@repo/database/proxy";
import { type NextRequest, NextResponse } from "next/server";

interface AuthMiddlewareOptions {
  afterSignInUrl?: string;
  /** Pages for signed-out users only; signed-in users are sent home. */
  authRoutes?: string[];
  /** Prefixes reachable without a session. */
  publicRoutes?: string[];
  signInUrl?: string;
}

const matches = (pathname: string, routes: string[]) =>
  routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

// A redirect must carry the refreshed session cookies and no-cache headers,
// otherwise the user is signed out or a CDN could cache their session.
const redirectWithSession = (url: URL, session: NextResponse) => {
  const response = NextResponse.redirect(url);

  for (const cookie of session.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = session.headers.get(header);

    if (value) {
      response.headers.set(header, value);
    }
  }

  return response;
};

/**
 * Refreshes the Supabase session on every request and guards routes.
 * Pages redirect to sign in; API routes get a 401. Layouts and route handlers
 * should still check `auth()` themselves — the proxy is a first line only.
 */
export const authMiddleware = ({
  authRoutes = ["/sign-in", "/sign-up", "/forgot-password"],
  publicRoutes = ["/auth", "/.well-known"],
  signInUrl = "/sign-in",
  afterSignInUrl = "/",
}: AuthMiddlewareOptions = {}) => {
  return async (request: NextRequest) => {
    const { response, claims } = await updateSession(request);
    const { pathname, search } = request.nextUrl;

    if (claims) {
      if (matches(pathname, authRoutes)) {
        return redirectWithSession(
          new URL(afterSignInUrl, request.url),
          response
        );
      }

      return response;
    }

    if (matches(pathname, [...authRoutes, ...publicRoutes])) {
      return response;
    }

    if (matches(pathname, ["/api"])) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(signInUrl, request.url);

    if (pathname !== "/") {
      url.searchParams.set("next", `${pathname}${search}`);
    }

    return redirectWithSession(url, response);
  };
};
