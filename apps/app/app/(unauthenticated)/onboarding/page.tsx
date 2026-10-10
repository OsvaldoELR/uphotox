import { auth } from "@repo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { publicPageMetadata } from "@/lib/metadata";
import { getStudioContext } from "@/lib/studio";
import { AuthHeader } from "../components/auth-header";
import { OnboardingForm } from "./onboarding-form";

const title = "Crea tu estudio";
const description =
  "Ponle nombre a tu estudio. Después podrás crear tableros e invitar a tu equipo.";

export const metadata: Metadata = publicPageMetadata({ title, description });

// Shares the sign-in look, but requires a session: it runs right after the
// owner's first sign-in, before any studio exists.
const OnboardingPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (await getStudioContext()) {
    redirect("/");
  }

  return (
    <>
      <AuthHeader description={description} title={title} />
      <OnboardingForm />
    </>
  );
};

export default OnboardingPage;
