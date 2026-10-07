import { SignUp } from "@repo/auth/components/sign-up";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { AuthHeader } from "../components/auth-header";

const title = "Crea tu cuenta";
const description = "Introduce tus datos para empezar.";

export const metadata: Metadata = createMetadata({ title, description });

const SignUpPage = () => (
  <>
    <AuthHeader description={description} title={title} />
    <SignUp />
  </>
);

export default SignUpPage;
