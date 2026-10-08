import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Panel } from "@repo/design-system/components/hud/panel";
import { Button } from "@repo/design-system/components/ui/button";
import { KanbanIcon, MailWarningIcon, MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getBoardSummaries } from "@/lib/board-summary";
import { isEmailEnabled } from "@/lib/email";
import { ROLES } from "@/lib/permissions";
import { requireStudio } from "@/lib/studio";
import { BoardPipeline } from "./components/board-pipeline";
import { Header } from "./components/header";

export const metadata: Metadata = {
  title: "Panel · Uphotox",
  description: "Panel del estudio.",
};

const Dashboard = async () => {
  const context = await requireStudio();
  const canViewBoards = context.can("boards.view");
  const supabase = await createClient();
  const boards = canViewBoards ? await getBoardSummaries(supabase) : [];
  const firstName = context.member.fullName?.split(" ")[0];
  const showEmailNotice = context.can("settings.manage") && !isEmailEnabled();
  const showWhatsappNotice =
    context.can("settings.manage") && !context.studio.whatsapp;

  return (
    <>
      <Header page="Panel" />
      <div className="flex flex-1 flex-col gap-12 px-4 pt-4 pb-12 md:px-10">
        <section className="flex animate-fade-in-up flex-col gap-3">
          <HudLabel align="start" className="max-w-sm">
            {context.studio.name}
          </HudLabel>
          <h1 className="font-black font-mono text-4xl uppercase tracking-[-0.02em] md:text-5xl">
            {firstName ? "Hola, " : "Hola"}
            {firstName && (
              <span className="text-glow text-signal-ink">{firstName}</span>
            )}
          </h1>
          <p className="max-w-prose text-muted-foreground">
            <span className="font-mono text-[11px] text-foreground uppercase tracking-[0.2em]">
              {ROLES[context.member.role].label}
            </span>{" "}
            · {ROLES[context.member.role].description}
          </p>
        </section>

        {showEmailNotice && (
          <Panel className="flex items-start gap-3 border-flare/30 p-4">
            <MailWarningIcon className="mt-0.5 size-5 shrink-0 text-flare" />
            <div className="flex flex-col gap-1">
              <p className="font-bold font-mono text-xs uppercase tracking-[0.18em]">
                Correos desactivados
              </p>
              <p className="text-muted-foreground text-sm">
                Los tableros funcionan, pero los clientes y tú no recibiréis
                avisos hasta conectar Resend.
              </p>
            </div>
          </Panel>
        )}

        {showWhatsappNotice && (
          <Panel className="flex flex-wrap items-center gap-3 border-signal-ink/30 p-4">
            <MessageCircleIcon className="size-5 shrink-0 text-signal-ink" />
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <p className="font-bold font-mono text-xs uppercase tracking-[0.18em]">
                Añade tu WhatsApp
              </p>
              <p className="text-muted-foreground text-sm">
                Así tus clientes pueden escribirte desde cada aviso por correo.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/ajustes">Ir a Ajustes</Link>
            </Button>
          </Panel>
        )}

        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <HudLabel align="start" className="flex-1">
              Tableros
            </HudLabel>
            {canViewBoards && boards.length > 0 && (
              <Button asChild size="sm" variant="outline">
                <Link href="/tableros">Ver todos</Link>
              </Button>
            )}
          </div>

          {canViewBoards && boards.length > 0 && (
            <div className="grid gap-5">
              {boards.map((board, index) => (
                <BoardPipeline board={board} index={index} key={board.id} />
              ))}
            </div>
          )}

          {canViewBoards && boards.length === 0 && (
            <Panel className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
              <KanbanIcon className="size-8 text-signal-ink/60" />
              <p className="font-bold font-mono text-xs uppercase tracking-[0.25em]">
                Mesa vacía
              </p>
              <p className="max-w-sm text-muted-foreground text-sm">
                {context.can("boards.manage")
                  ? "Crea un tablero para empezar a mover a tus clientes por el flujo."
                  : "Todavía no hay tableros en el estudio."}
              </p>
              {context.can("boards.manage") && (
                <Button asChild className="mt-2">
                  <Link href="/tableros">Crear tablero</Link>
                </Button>
              )}
            </Panel>
          )}

          {!canViewBoards && (
            <Panel className="px-6 py-10 text-center text-muted-foreground text-sm">
              Tu rol todavía no tiene acceso a los tableros. Pídele permiso a la
              dueña del estudio.
            </Panel>
          )}
        </section>
      </div>
    </>
  );
};

export default Dashboard;
