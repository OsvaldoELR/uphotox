import { UpdatePassword } from "@repo/auth/components/update-password";
import { auth } from "@repo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { publicPageMetadata } from "@/lib/metadata";
import { AuthHeader } from "../components/auth-header";

const title = "Elige una contraseña nueva";
const description = "Introduce la nueva contraseña de tu cuenta.";

export const metadata: Metadata = publicPageMetadata({ title, description });

// Reached from the reset email: /auth/callback signs the user in first.
const UpdatePasswordPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <>
      <AuthHeader description={description} title={title} />
      <UpdatePassword />
    </>
  );
};

export default UpdatePasswordPage;
