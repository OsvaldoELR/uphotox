import { ForgotPassword } from "@repo/auth/components/forgot-password";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/metadata";
import { AuthHeader } from "../components/auth-header";

const title = "Recupera tu contraseña";
const description = "Te enviaremos un enlace para elegir una contraseña nueva.";

export const metadata: Metadata = publicPageMetadata({ title, description });

const ForgotPasswordPage = () => (
  <>
    <AuthHeader description={description} title={title} />
    <ForgotPassword />
  </>
);

export default ForgotPasswordPage;
