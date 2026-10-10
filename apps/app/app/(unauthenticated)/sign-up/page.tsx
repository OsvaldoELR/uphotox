import { SignUp } from "@repo/auth/components/sign-up";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/metadata";
import { AuthHeader } from "../components/auth-header";

const title = "Crea tu cuenta";
const description = "Introduce tus datos para empezar.";

export const metadata: Metadata = publicPageMetadata({ title, description });

const SignUpPage = () => (
  <>
    <AuthHeader description={description} title={title} />
    <SignUp />
  </>
);

export default SignUpPage;
