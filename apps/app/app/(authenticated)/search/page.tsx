import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Panel } from "@repo/design-system/components/hud/panel";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/studio";
import { Header } from "../components/header";

interface SearchPageProperties {
  readonly searchParams: Promise<{ q?: string }>;
}

export const generateMetadata = async ({
  searchParams,
}: SearchPageProperties): Promise<Metadata> => {
  const { q } = await searchParams;

  return {
    title: `${q ?? ""} · Búsqueda · Uphotox`,
    description: `Resultados para ${q ?? ""}`,
  };
};

// PostgREST filter syntax uses , ( ) as separators: keep them out of the term.
const sanitize = (term: string) => term.replace(/[%_,()\\]/g, " ").trim();

const SearchPage = async ({ searchParams }: SearchPageProperties) => {
  await requirePermission("boards.view");
  const { q = "" } = await searchParams;
  const term = sanitize(q).slice(0, 80);

  if (!term) {
    redirect("/");
  }

  const supabase = await createClient();
  const pattern = `%${term}%`;
  const [{ data: byTitle }, { data: clients }] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id, title, board_id, boards(name), board_stages!cards_stage_id_board_id_fkey(name), clients(full_name)"
      )
      .ilike("title", pattern)
      .limit(30),
    supabase.from("clients").select("id").ilike("full_name", pattern).limit(30),
  ]);

  const clientIds = (clients ?? []).map((client) => client.id);
  const { data: byClient } = clientIds.length
    ? await supabase
        .from("cards")
        .select(
          "id, title, board_id, boards(name), board_stages!cards_stage_id_board_id_fkey(name), clients(full_name)"
        )
        .in("client_id", clientIds)
        .limit(30)
    : { data: [] };

  const results = [
    ...new Map(
      [...(byTitle ?? []), ...(byClient ?? [])].map((card) => [card.id, card])
    ).values(),
  ];

  return (
    <>
      <Header page={`«${term}»`} trail={[{ label: "Búsqueda", href: "/" }]} />
      <div className="flex flex-1 flex-col gap-5 px-4 pt-4 pb-12 md:px-10">
        <HudLabel align="start">
          {String(results.length).padStart(2, "0")} resultados
        </HudLabel>
        {results.length > 0 ? (
          <ul className="divide-y border bg-card">
            {results.map((card) => (
              <li key={card.id}>
                <Link
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent"
                  href={`/tableros/${card.board_id}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-sm">
                      {card.title}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
                      {card.clients?.full_name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                    {card.boards?.name}
                    <br />
                    <span className="text-signal-ink">
                      {card.board_stages?.name}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Panel className="px-6 py-10 text-center text-muted-foreground text-sm">
            Nada coincide con «{term}».
          </Panel>
        )}
      </div>
    </>
  );
};

export default SearchPage;
