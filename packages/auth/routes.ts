import "server-only";

import type { EmailOtpType } from "@repo/database";
import { createClient } from "@repo/database/server";
import { type NextRequest, NextResponse } from "next/server";
import { safeRedirectPath } from "./redirect";

const failed = (request: NextRequest) =>
  NextResponse.redirect(new URL("/sign-in?error=auth", request.url));

/**
 * GET /auth/callback — exchanges the PKCE `code` from OAuth sign-ins and from
 * Supabase's default email links (confirm sign up, reset password).
 */
export const handleAuthCallback = async (request: NextRequest) => {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return failed(request);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return failed(request);
  }

  return NextResponse.redirect(new URL(next, request.url));
};

/**
 * GET /auth/confirm — verifies `token_hash` links. Use it from custom email
 * templates, e.g. `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`,
 * so links also work when opened in a different browser.
 */
export const handleAuthConfirm = async (request: NextRequest) => {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (!(tokenHash && type)) {
    return failed(request);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return failed(request);
  }

  const fallback = type === "recovery" ? "/update-password" : "/";
  const next = safeRedirectPath(
    request.nextUrl.searchParams.get("next"),
    fallback
  );

  return NextResponse.redirect(new URL(next, request.url));
};
