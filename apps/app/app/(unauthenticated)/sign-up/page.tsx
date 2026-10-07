import { SignUp } from "@repo/auth/components/sign-up";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { AuthHeader } from "../components/auth-header";

const title = "Create an account";
const description = "Enter your details to get started.";

export const metadata: Metadata = createMetadata({ title, description });

const SignUpPage = () => (
  <>
    <AuthHeader description={description} title={title} />
    <SignUp />
  </>
);

export default SignUpPage;
