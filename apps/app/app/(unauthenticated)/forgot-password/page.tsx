import { ForgotPassword } from "@repo/auth/components/forgot-password";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { AuthHeader } from "../components/auth-header";

const title = "Recupera tu contraseña";
const description = "Te enviaremos un enlace para elegir una contraseña nueva.";

export const metadata: Metadata = createMetadata({ title, description });

const ForgotPasswordPage = () => (
  <>
    <AuthHeader description={description} title={title} />
    <ForgotPassword />
  </>
);

export default ForgotPasswordPage;
