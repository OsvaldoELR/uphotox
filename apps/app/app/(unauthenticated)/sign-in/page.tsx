import { SignIn } from "@repo/auth/components/sign-in";
import { safeRedirectPath } from "@repo/auth/redirect";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { AuthHeader } from "../components/auth-header";

const title = "Welcome back";
const description = "Enter your details to sign in.";

export const metadata: Metadata = createMetadata({ title, description });

interface SignInPageProperties {
  readonly searchParams: Promise<{ next?: string; error?: string }>;
}

const SignInPage = async ({ searchParams }: SignInPageProperties) => {
  const { next, error } = await searchParams;

  return (
    <>
      <AuthHeader description={description} title={title} />
      <SignIn
        error={
          error ? "That link is invalid or has expired. Try again." : undefined
        }
        next={safeRedirectPath(next)}
      />
    </>
  );
};

export default SignInPage;
