import "server-only";

import type { createClient } from "@repo/database/server";
import { StageMovedTemplate } from "@repo/email/templates/stage-moved";
import { StageUpdateTemplate } from "@repo/email/templates/stage-update";
import { env } from "@/env";
import { defaultStageMessage } from "./board-templates";
import { isEmailEnabled, type SendEmailResult, sendEmail } from "./email";
import type { StudioContext } from "./studio";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

interface StageEntryInput {
  readonly cardId: number;
  readonly context: StudioContext;
  /** null when the card was just created. */
  readonly fromStageId: number | null;
  readonly supabase: ServerClient;
  readonly toStageId: number;
}

const logResult = async (
  supabase: ServerClient,
  input: { cardId: number; studioId: number; toStageId: number },
  recipient: string,
  result: SendEmailResult
) => {
  if (result.status === "disabled") {
    return;
  }

  await supabase.from("card_events").insert({
    studio_id: input.studioId,
    card_id: input.cardId,
    to_stage_id: input.toStageId,
    kind: result.status === "sent" ? "email_sent" : "email_failed",
    detail:
      result.status === "sent"
        ? recipient
        : `${recipient}: ${result.message}`.slice(0, 500),
  });
};

/**
 * Emails the client (if the stage notifies) and the studio owner (unless they
 * made the change) when a card enters a stage, and records each result in
 * the card's history. Runs after the response, so it never blocks the board.
 */
export const notifyStageEntry = async ({
  cardId,
  context,
  fromStageId,
  supabase,
  toStageId,
}: StageEntryInput) => {
  if (!isEmailEnabled()) {
    return;
  }

  const stageIds = fromStageId ? [toStageId, fromStageId] : [toStageId];
  const [cardResult, stagesResult, eventResult, ownerResult] =
    await Promise.all([
      supabase
        .from("cards")
        .select(
          "title, gallery_url, board_id, boards(name), clients(full_name, email)"
        )
        .eq("id", cardId)
        .single(),
      supabase
        .from("board_stages")
        .select("id, name, notify_client, client_message")
        .in("id", stageIds),
      supabase
        .from("card_events")
        .select("id")
        .eq("card_id", cardId)
        .in("kind", ["created", "moved"])
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("studios")
        .select("owner:profiles!studios_owner_id_fkey(id, full_name, email)")
        .eq("id", context.studio.id)
        .single(),
    ]);

  const card = cardResult.data;
  const toStage = stagesResult.data?.find((stage) => stage.id === toStageId);
  const fromStage = stagesResult.data?.find(
    (stage) => stage.id === fromStageId
  );
  const eventId = eventResult.data?.id;

  if (!(card && toStage && eventId)) {
    return;
  }

  const studioName = context.studio.name;
  const owner = ownerResult.data?.owner;
  const logInput = { cardId, studioId: context.studio.id, toStageId };
  let clientNotified = false;

  const client = card.clients;

  if (toStage.notify_client && client?.email) {
    const result = await sendEmail({
      fromName: studioName,
      to: client.email,
      replyTo: owner?.email,
      subject: `${toStage.name} · ${studioName}`,
      idempotencyKey: `stage-email/${eventId}/client`,
      react: (
        <StageUpdateTemplate
          clientName={client.full_name}
          galleryUrl={card.gallery_url}
          message={
            toStage.client_message?.trim() ||
            defaultStageMessage(toStage.name, studioName)
          }
          stageName={toStage.name}
          studioName={studioName}
        />
      ),
    });

    clientNotified = result.status === "sent";
    await logResult(supabase, logInput, `Cliente ${client.email}`, result);
  }

  if (owner?.email && owner.id !== context.userId) {
    const actorName =
      context.member.fullName ?? context.member.email ?? "Alguien del equipo";
    const result = await sendEmail({
      fromName: "Uphotox",
      to: owner.email,
      subject: `${card.title} → ${toStage.name}`,
      idempotencyKey: `stage-email/${eventId}/owner`,
      react: (
        <StageMovedTemplate
          actorName={actorName}
          boardName={card.boards?.name ?? "Tablero"}
          boardUrl={`${env.NEXT_PUBLIC_APP_URL}/tableros/${card.board_id}`}
          cardTitle={card.title}
          clientName={client?.full_name}
          clientNotified={clientNotified}
          fromStage={fromStage?.name}
          studioName={studioName}
          toStage={toStage.name}
        />
      ),
    });

    await logResult(supabase, logInput, `Dueña ${owner.email}`, result);
  }
};
