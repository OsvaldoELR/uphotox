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
  /** Card to open on arrival (?tarjeta=…), already checked to be here. */
  readonly initialCardId: number | null;
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
  initialCardId,
  members,
  stages,
  studioName,
}: KanbanBoardProperties) => {
  // Optimistic copy; replaced whenever the server sends fresh data.
  const [cards, setCards] = useState(serverCards);
  const [sheetOpen, setSheetOpen] = useState(initialCardId !== null);
  const [activeCardId, setActiveCardId] = useState(initialCardId);
  // Phones show one stage at a time (no drag needed); desktop shows all.
  const [mobileStageId, setMobileStageId] = useState<number | null>(
    () =>
      serverCards.find((card) => card.id === initialCardId)?.stage_id ??
      stages[0]?.id ??
      null
  );
  const visibleStageId = stages.some((stage) => stage.id === mobileStageId)
    ? mobileStageId
    : (stages[0]?.id ?? null);

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

  /**
   * Moves a card optimistically and rolls back if the server refuses.
   * Without an index the card goes to the end of the target stage.
   */
  const moveTo = async (cardId: number, toStageId: number, index?: number) => {
    const card = cards.find((item) => item.id === cardId);

    if (!card || (index === undefined && card.stage_id === toStageId)) {
      return;
    }

    const siblings = (cardsByStage.get(toStageId) ?? []).filter(
      (item) => item.id !== cardId
    );
    const at = index ?? siblings.length;
    const position = positionBetween(
      siblings[at - 1]?.position,
      siblings[at]?.position
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
        // On phones only one stage is visible: offer to follow the card.
        action: {
          label: "Ver etapa",
          onClick: () => setMobileStageId(toStageId),
        },
      });
    }
  };

  const onDragEnd = ({ destination, draggableId, source }: DropResult) => {
    if (
      !destination ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)
    ) {
      return;
    }

    moveTo(
      Number(draggableId),
      Number(destination.droppableId),
      destination.index
    );
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

      {stages.length > 0 && (
        <nav
          aria-label="Etapas"
          className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden"
        >
          {stages.map((stage, index) => {
            const selected = stage.id === visibleStageId;
            return (
              <button
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  selected
                    ? "border-signal-ink/60 bg-signal/15 text-foreground"
                    : "bg-secondary/80 text-muted-foreground"
                )}
                key={stage.id}
                onClick={() => setMobileStageId(stage.id)}
                type="button"
              >
                <span className="text-signal-ink">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {stage.name}
                <span className="tabular font-bold text-foreground">
                  {cardsByStage.get(stage.id)?.length ?? 0}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* One scroll container (both axes) for the whole board: nested
          scroll containers are not supported by the drag-and-drop library. */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 md:px-10">
          <div className="flex items-start gap-4 md:w-max">
            {stages.map((stage, index) => (
              <StageColumn
                access={access}
                boardId={boardId}
                cards={cardsByStage.get(stage.id) ?? []}
                hiddenOnMobile={stage.id !== visibleStageId}
                index={index}
                key={stage.id}
                members={memberById}
                onMoveCard={moveTo}
                onOpenCard={openCard}
                stage={stage}
                stages={stages}
                studioName={studioName}
              />
            ))}
            {access.canManage && (
              <div className="hidden md:block">
                <AddStage boardId={boardId} />
              </div>
            )}
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
        onMoveCard={moveTo}
        open={sheetOpen}
        stage={stages.find((stage) => stage.id === activeCard?.stage_id)}
        stages={stages}
      />
    </div>
  );
};
