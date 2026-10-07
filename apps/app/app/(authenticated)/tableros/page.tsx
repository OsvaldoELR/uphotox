import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Panel } from "@repo/design-system/components/hud/panel";
import { KanbanIcon } from "lucide-react";
import type { Metadata } from "next";
import { getBoardSummaries } from "@/lib/board-summary";
import { requirePermission } from "@/lib/studio";
import { BoardPipeline } from "../components/board-pipeline";
import { Header } from "../components/header";
import { CreateBoardDialog } from "./create-board-dialog";

export const metadata: Metadata = {
  title: "Tableros · Uphotox",
  description: "Los flujos de trabajo del estudio.",
};

const BoardsPage = async () => {
  const context = await requirePermission("boards.view");
  const supabase = await createClient();
  const boards = await getBoardSummaries(supabase);
  const canManage = context.can("boards.manage");

  return (
    <>
      <Header page="Tableros" trail={[{ label: "Panel", href: "/" }]}>
        {canManage && <CreateBoardDialog />}
      </Header>
      <div className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-12 md:px-10">
        <div className="flex flex-col gap-2">
          <HudLabel align="start">
            Tableros · {String(boards.length).padStart(2, "0")}
          </HudLabel>
          <p className="max-w-prose text-muted-foreground text-sm">
            Cada tablero es un flujo completo para un tipo de sesión. Los
            clientes avanzan de etapa en etapa y reciben un aviso en cada una.
          </p>
        </div>

        {boards.length > 0 ? (
          <div className="grid gap-5">
            {boards.map((board, index) => (
              <BoardPipeline board={board} index={index} key={board.id} />
            ))}
          </div>
        ) : (
          <Panel className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
            <KanbanIcon className="size-8 text-signal-ink/60" />
            <p className="font-bold font-mono text-xs uppercase tracking-[0.25em]">
              Sin tableros
            </p>
            <p className="max-w-sm text-muted-foreground text-sm">
              {canManage
                ? "Crea el primero con el botón «Nuevo tablero»."
                : "Cuando la dueña del estudio cree un tablero aparecerá aquí."}
            </p>
          </Panel>
        )}
      </div>
    </>
  );
};

export default BoardsPage;
