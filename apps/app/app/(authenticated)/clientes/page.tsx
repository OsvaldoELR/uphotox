import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/studio";
import { Header } from "../components/header";
import { ClientList } from "./components/client-list";
import type { ClientListItem } from "./components/types";

export const metadata: Metadata = {
  title: "Clientes · Uphotox",
  description: "Clientes del estudio y sus sesiones.",
};

// PostgREST returns at most 1000 rows per request.
const LIMIT = 1000;

const ClientsPage = async () => {
  const context = await requirePermission("clients.view");
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, full_name, email, phone, notes, created_at, cards(id, title, session_at, board_id, created_at, boards(name), board_stages!cards_stage_id_board_id_fkey(name))"
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  const clients: ClientListItem[] = (data ?? []).map((client) => ({
    id: client.id,
    fullName: client.full_name,
    email: client.email,
    phone: client.phone,
    notes: client.notes,
    createdAt: client.created_at,
    sessions: [...client.cards]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((card) => ({
        id: card.id,
        title: card.title,
        sessionAt: card.session_at,
        boardId: card.board_id,
        boardName: card.boards?.name ?? "",
        stageName: card.board_stages?.name ?? "",
      })),
  }));

  return (
    <>
      <Header page="Clientes" trail={[{ label: "Panel", href: "/" }]} />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-12 md:px-10">
        <div className="flex flex-col gap-2">
          <HudLabel align="start">
            Clientes · {String(clients.length).padStart(2, "0")}
            {clients.length === LIMIT && "+"}
          </HudLabel>
          <p className="max-w-prose text-muted-foreground text-sm">
            Cada cliente con sus sesiones. Se crean al añadir una tarjeta en un
            tablero, al llegar por la entrada de clientes o importando un CSV.
          </p>
        </div>
        <ClientList
          access={{
            canManage: context.can("clients.manage"),
            canImport:
              context.can("clients.manage") &&
              context.can("cards.create") &&
              context.can("boards.view"),
            canDeleteCards: context.can("cards.delete"),
          }}
          clients={clients}
        />
      </div>
    </>
  );
};

export default ClientsPage;
