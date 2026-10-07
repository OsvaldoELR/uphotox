import { ForgotPassword } from "@repo/auth/components/forgot-password";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { AuthHeader } from "../components/auth-header";

const title = "Reset your password";
const description = "We'll email you a link to choose a new password.";

export const metadata: Metadata = createMetadata({ title, description });

const ForgotPasswordPage = () => (
  <>
    <AuthHeader description={description} title={title} />
    <ForgotPassword />
  </>
);

export default ForgotPasswordPage;
