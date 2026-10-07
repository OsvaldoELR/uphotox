"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { cn } from "@repo/design-system/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { moveCard } from "@/app/actions/cards";
import { AddStage } from "./add-stage";
import { BoardMenu } from "./board-menu";
import { CardSheet } from "./card-sheet";
import { positionBetween } from "./format";
import { StageColumn } from "./stage-column";
import type { BoardAccess, BoardCard, BoardMember, BoardStage } from "./types";

interface KanbanBoardProperties {
  readonly access: BoardAccess;
  readonly boardId: number;
  readonly boardName: string;
  readonly cards: BoardCard[];
  readonly emailEnabled: boolean;
  readonly members: BoardMember[];
  readonly stages: BoardStage[];
  readonly studioName: string;
}

const byPosition = (a: BoardCard, b: BoardCard) => a.position - b.position;

export const KanbanBoard = ({
  access,
  boardId,
  boardName,
  cards: serverCards,
  emailEnabled,
  members,
  stages,
  studioName,
}: KanbanBoardProperties) => {
  // Optimistic copy; replaced whenever the server sends fresh data.
  const [cards, setCards] = useState(serverCards);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeCardId, setActiveCardId] = useState<number | null>(null);

  useEffect(() => {
    setCards(serverCards);
  }, [serverCards]);

  const cardsByStage = useMemo(() => {
    const grouped = new Map<number, BoardCard[]>();

    for (const stage of stages) {
      grouped.set(stage.id, []);
    }

    for (const card of cards) {
      grouped.get(card.stage_id)?.push(card);
    }

    for (const list of grouped.values()) {
      list.sort(byPosition);
    }

    return grouped;
  }, [cards, stages]);

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const activeCard = cards.find((card) => card.id === activeCardId) ?? null;

  const openCard = (cardId: number) => {
    setActiveCardId(cardId);
    setSheetOpen(true);
  };

  const onDragEnd = async ({
    destination,
    draggableId,
    source,
  }: DropResult) => {
    if (
      !destination ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)
    ) {
      return;
    }

    const cardId = Number(draggableId);
    const toStageId = Number(destination.droppableId);
    const card = cards.find((item) => item.id === cardId);

    if (!card) {
      return;
    }

    const siblings = (cardsByStage.get(toStageId) ?? []).filter(
      (item) => item.id !== cardId
    );
    const position = positionBetween(
      siblings[destination.index - 1]?.position,
      siblings[destination.index]?.position
    );
    const stageChanged = card.stage_id !== toStageId;
    const previous = cards;

    setCards((current) =>
      current.map((item) =>
        item.id === cardId
          ? {
              ...item,
              stage_id: toStageId,
              position,
              stage_entered_at: stageChanged
                ? new Date().toISOString()
                : item.stage_entered_at,
            }
          : item
      )
    );

    const result = await moveCard({ cardId, toStageId, position });

    if ("error" in result) {
      setCards(previous);
      toast.error(result.error);
      return;
    }

    if (stageChanged) {
      const stage = stages.find((item) => item.id === toStageId);
      const willEmail =
        emailEnabled && stage?.notify_client && card.client?.email;

      toast.success(`${card.title} → ${stage?.name ?? ""}`, {
        description: willEmail
          ? `Avisamos a ${card.client?.full_name} por correo.`
          : undefined,
      });
    }
  };

  return (
    <div className="flex h-[calc(100svh-4rem)] min-h-0 flex-col md:h-[calc(100svh-5rem)]">
      <div className="flex flex-wrap items-center gap-3 px-4 pb-4 md:px-10">
        <HudLabel align="start" className="min-w-48 flex-1">
          {String(stages.length).padStart(2, "0")} etapas ·{" "}
          {String(cards.length).padStart(2, "0")} tarjetas
        </HudLabel>
        {access.onlyAssigned && (
          <span className="border px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
            Ves solo tus tarjetas
          </span>
        )}
        <span
          className={cn(
            "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
            emailEnabled
              ? "border-signal-ink/30 text-signal-ink"
              : "border-flare/30 text-flare"
          )}
          title={
            emailEnabled
              ? "Los clientes reciben un correo en las etapas con aviso."
              : "Configura Resend para enviar avisos por correo."
          }
        >
          {emailEnabled ? "Correos activos" : "Correos desactivados"}
        </span>
        {access.canManage && (
          <BoardMenu
            boardId={boardId}
            boardName={boardName}
            cardCount={cards.length}
          />
        )}
      </div>

      {/* One scroll container (both axes) for the whole board: nested
          scroll containers are not supported by the drag-and-drop library. */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 md:px-10">
          <div className="flex w-max items-start gap-4">
            {stages.map((stage, index) => (
              <StageColumn
                access={access}
                boardId={boardId}
                cards={cardsByStage.get(stage.id) ?? []}
                index={index}
                key={stage.id}
                members={memberById}
                onOpenCard={openCard}
                stage={stage}
                studioName={studioName}
              />
            ))}
            {access.canManage && <AddStage boardId={boardId} />}
            {stages.length === 0 && !access.canManage && (
              <p className="text-muted-foreground text-sm">
                Este tablero todavía no tiene etapas.
              </p>
            )}
          </div>
        </div>
      </DragDropContext>

      <CardSheet
        access={access}
        card={activeCard}
        members={members}
        onClose={() => setSheetOpen(false)}
        open={sheetOpen}
        stage={stages.find((stage) => stage.id === activeCard?.stage_id)}
      />
    </div>
  );
};
