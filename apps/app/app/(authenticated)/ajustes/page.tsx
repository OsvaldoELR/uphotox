import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Panel } from "@repo/design-system/components/hud/panel";
import type { Metadata } from "next";
import { env } from "@/env";
import { requirePermission } from "@/lib/studio";
import { formatWhatsapp } from "@/lib/whatsapp";
import { Header } from "../components/header";
import { SettingsForm } from "./settings-form";
import {
  type WebhookBoard,
  WebhookSettings,
  type WebhookState,
} from "./webhook-settings";

export const metadata: Metadata = {
  title: "Ajustes · Uphotox",
  description: "Ajustes del estudio.",
};

const SettingsPage = async () => {
  const context = await requirePermission("settings.manage");
  const supabase = await createClient();
  const [{ data: webhookRow }, { data: boardRows }] = await Promise.all([
    supabase
      .from("studio_integrations")
      .select(
        "token, enabled, board_id, stage_id, last_received_at, last_error"
      )
      .eq("provider", "webhook")
      .maybeSingle(),
    supabase
      .from("boards")
      .select("id, name, board_stages(id, name, position)")
      .order("created_at"),
  ]);

  const boards: WebhookBoard[] = (boardRows ?? []).map((board) => ({
    id: board.id,
    name: board.name,
    stages: [...board.board_stages]
      .sort((a, b) => a.position - b.position)
      .map(({ id, name }) => ({ id, name })),
  }));

  const webhook: WebhookState | null = webhookRow
    ? {
        token: webhookRow.token,
        enabled: webhookRow.enabled,
        boardId: webhookRow.board_id,
        stageId: webhookRow.stage_id,
        lastReceivedAt: webhookRow.last_received_at,
        lastError: webhookRow.last_error,
      }
    : null;

  return (
    <>
      <Header page="Ajustes" trail={[{ label: "Panel", href: "/" }]} />
      <div className="flex flex-1 flex-col gap-10 px-4 pt-4 pb-12 md:px-10">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <HudLabel align="start">Ajustes del estudio</HudLabel>
            <p className="max-w-prose text-muted-foreground text-sm">
              Cómo se presenta tu estudio en los avisos que reciben tus
              clientes.
            </p>
          </div>
          <Panel className="max-w-xl p-6">
            <SettingsForm
              name={context.studio.name}
              whatsapp={
                context.studio.whatsapp
                  ? formatWhatsapp(context.studio.whatsapp)
                  : ""
              }
            />
          </Panel>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <HudLabel align="start">Entrada de clientes</HudLabel>
            <p className="max-w-prose text-muted-foreground text-sm">
              Cada reserva que llega desde un formulario se convierte en un
              cliente con su tarjeta, con todas las respuestas en las notas.
            </p>
          </div>
          <Panel className="max-w-3xl p-6">
            <WebhookSettings
              apiUrl={env.NEXT_PUBLIC_API_URL ?? null}
              boards={boards}
              webhook={webhook}
            />
          </Panel>
        </section>
      </div>
    </>
  );
};

export default SettingsPage;
