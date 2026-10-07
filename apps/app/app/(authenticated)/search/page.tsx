import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";
import { notFound, redirect } from "next/navigation";
import { Header } from "../components/header";
import { ProjectGrid } from "../components/project-grid";

interface SearchPageProperties {
  searchParams: Promise<{
    q: string;
  }>;
}

export const generateMetadata = async ({
  searchParams,
}: SearchPageProperties) => {
  const { q } = await searchParams;

  return {
    title: `${q} - Search results`,
    description: `Search results for ${q}`,
  };
};

const SearchPage = async ({ searchParams }: SearchPageProperties) => {
  const { q } = await searchParams;
  const { userId } = await auth();

  if (!userId) {
    notFound();
  }

  if (!q) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description")
    .ilike("name", `%${q}%`)
    .order("created_at", { ascending: false });

  return (
    <>
      <Header page="Search" pages={["Home"]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <ProjectGrid projects={projects ?? []} />
        <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      </div>
    </>
  );
};

export default SearchPage;
