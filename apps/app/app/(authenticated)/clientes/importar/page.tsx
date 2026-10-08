import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/studio";
import { Header } from "../../components/header";
import { ClientImporter, type ImportBoard } from "./client-importer";

export const metadata: Metadata = {
  title: "Importar clientes · Uphotox",
  description: "Importa desde un CSV los clientes con sesión agendada.",
};

const ImportPage = async () => {
  const context = await requirePermission("clients.manage");

  if (!(context.can("cards.create") && context.can("boards.view"))) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("boards")
    .select("id, name, board_stages(id, name, position)")
    .order("created_at");

  const boards: ImportBoard[] = (data ?? []).map((board) => ({
    id: board.id,
    name: board.name,
    stages: [...board.board_stages]
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({ id: stage.id, name: stage.name })),
  }));

  return (
    <>
      <Header
        page="Importar"
        trail={[
          { label: "Panel", href: "/" },
          { label: "Clientes", href: "/clientes" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-8 px-4 pt-4 pb-12 md:px-10">
        <div className="flex flex-col gap-2">
          <HudLabel align="start">Importar clientes · CSV</HudLabel>
          <p className="max-w-prose text-muted-foreground text-sm">
            Sube un CSV con los clientes que ya tienen su sesión agendada. Cada
            fila se convierte en un cliente y una tarjeta en la etapa que elijas
            (por ejemplo, «Agendado»). Revisas todo antes de guardar y no se
            envía ningún correo.
          </p>
        </div>
        <ClientImporter boards={boards} />
      </div>
    </>
  );
};

export default ImportPage;
