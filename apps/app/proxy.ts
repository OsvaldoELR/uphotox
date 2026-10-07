import { authMiddleware } from "@repo/auth/proxy";
import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";
import type { NextProxy, NextRequest } from "next/server";

const securityHeaders = securityMiddleware(noseconeOptions);

const auth = authMiddleware();

// Refresh the Supabase session (and guard routes), then add security headers
// to whatever response auth decided on.
const proxy: NextProxy = async (request: NextRequest) => {
  const response = await auth(request);
  const { headers } = await securityHeaders();

  for (const [key, value] of headers) {
    if (key !== "x-middleware-next" && !response.headers.has(key)) {
      response.headers.set(key, value);
    }
  }

  return response;
};

export default proxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
