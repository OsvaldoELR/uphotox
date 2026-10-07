import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";
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
const description = "My application.";

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

  return (
    <>
      <Header page="Dashboard" pages={["Home"]}>
        {env.LIVEBLOCKS_SECRET && (
          <CollaborationProvider workspaceId={userId}>
            <AvatarStack />
            <Cursors />
          </CollaborationProvider>
        )}
      </Header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="font-semibold text-xl">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <form action={createProject} className="flex gap-2">
            <Input
              aria-label="Project name"
              maxLength={120}
              name="name"
              placeholder="New project name"
              required
            />
            <Button type="submit">Create</Button>
          </form>
        </div>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            Couldn&apos;t load projects: {error.message}
          </p>
        )}
        <ProjectGrid projects={projects ?? []} />
        <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      </div>
    </>
  );
};

export default App;
