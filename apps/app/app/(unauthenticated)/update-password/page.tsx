import { UpdatePassword } from "@repo/auth/components/update-password";
import { auth } from "@repo/auth/server";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeader } from "../components/auth-header";

const title = "Choose a new password";
const description = "Enter a new password for your account.";

export const metadata: Metadata = createMetadata({ title, description });

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
