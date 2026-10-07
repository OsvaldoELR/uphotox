import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { createProject } from "@/app/actions/projects/create";
import { env } from "@/env";
import { AvatarStack } from "./components/avatar-stack";
import { Cursors } from "./components/cursors";
import { Header } from "./components/header";
import { ProjectGrid } from "./components/project-grid";

const title = "Uphotox";
const description = "Panel del estudio.";

const CollaborationProvider = dynamic(() =>
  import("./components/collaboration-provider").then(
    (mod) => mod.CollaborationProvider
  )
);

export const metadata: Metadata = {
  title,
  description,
};

const App = async () => {
  const { userId } = await auth();

  if (!userId) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: profile }, { data: projects, error }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    supabase
      .from("projects")
      .select("id, name, description")
      .order("created_at", { ascending: false }),
  ]);

  const firstName = profile?.full_name?.split(" ")[0];
  const projectCount = projects?.length ?? 0;

  return (
    <>
      <Header page="Panel" pages={["Uphotox"]}>
        {env.LIVEBLOCKS_SECRET && (
          <CollaborationProvider workspaceId={userId}>
            <AvatarStack />
            <Cursors />
          </CollaborationProvider>
        )}
      </Header>
      <div className="flex flex-1 flex-col gap-12 px-4 pt-4 pb-12 md:px-10">
        <section className="flex animate-fade-in-up flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <HudLabel align="start" className="max-w-xs">
              写真 · Panel del estudio
            </HudLabel>
            <h1 className="font-black font-mono text-4xl uppercase tracking-[-0.02em] md:text-5xl">
              {firstName ? "Hola, " : "Hola"}
              {firstName && (
                <span className="text-glow text-signal-ink">{firstName}</span>
              )}
            </h1>
            <p className="max-w-prose text-muted-foreground">
              Cada proyecto es una sesión: de la reserva a la entrega.
            </p>
          </div>
          <form action={createProject} className="flex w-full gap-3 lg:w-auto">
            <Input
              aria-label="Nombre del proyecto"
              className="lg:w-64"
              maxLength={120}
              name="name"
              placeholder="Ej.: Boda Ana y Luis"
              required
            />
            <Button type="submit">Crear proyecto</Button>
          </form>
        </section>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            No se pudieron cargar los proyectos: {error.message}
          </p>
        )}

        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <HudLabel align="start" className="flex-1">
              Proyectos
            </HudLabel>
            <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
              <span className="tabular font-bold text-foreground">
                {String(projectCount).padStart(2, "0")}
              </span>{" "}
              activos
            </span>
          </div>
          <ProjectGrid projects={projects ?? []} />
        </section>
      </div>
    </>
  );
};

export default App;
