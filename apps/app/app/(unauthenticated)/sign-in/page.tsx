import { SignIn } from "@repo/auth/components/sign-in";
import { safeRedirectPath } from "@repo/auth/redirect";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { AuthHeader } from "../components/auth-header";

const title = "Bienvenido de nuevo";
const description = "Introduce tus datos para entrar al estudio.";

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
          error
            ? "Ese enlace no es válido o ha caducado. Inténtalo de nuevo."
            : undefined
        }
        next={safeRedirectPath(next)}
      />
    </>
  );
};

export default SignInPage;
