import { signOut } from "@repo/auth/actions";
import { auth } from "@repo/auth/server";
import { Button } from "@repo/design-system/components/ui/button";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { publicPageMetadata } from "@/lib/metadata";
import { getStudioContext } from "@/lib/studio";
import { AuthHeader } from "../components/auth-header";

export const metadata: Metadata = publicPageMetadata({
  title: "Estudio pausado",
  description: "Este estudio está pausado en Uphotox.",
});

// Where requireStudio() sends the members of a studio the platform paused.
// RLS already hides the studio's data; this only explains why.
const PausedStudioPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const context = await getStudioContext();

  if (!context?.studio.paused) {
    redirect("/");
  }

  return (
    <>
      <AuthHeader
        description={`${context.studio.name} está pausado en Uphotox. Mientras tanto no se puede entrar al estudio.`}
        title="Estudio pausado"
      />
      {context.studio.paused.reason && (
        <p className="border border-flare/40 bg-flare/10 px-4 py-3 text-sm">
          {context.studio.paused.reason}
        </p>
      )}
      <p className="text-muted-foreground text-sm">
        Tus datos siguen guardados: en cuanto se reactive, todo estará como lo
        dejaste.
      </p>
      <form action={signOut}>
        <Button className="w-full" type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </>
  );
};

export default PausedStudioPage;
