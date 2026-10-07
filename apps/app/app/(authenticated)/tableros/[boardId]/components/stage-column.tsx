"use client";

import { Droppable } from "@hello-pangea/dnd";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { MailIcon, Settings2Icon } from "lucide-react";
import { useState } from "react";
import { BoardCard } from "./board-card";
import { QuickAdd } from "./quick-add";
import { StageDialog } from "./stage-dialog";
import type {
  BoardAccess,
  BoardCard as BoardCardData,
  BoardMember,
  BoardStage,
} from "./types";

interface StageColumnProperties {
  readonly access: BoardAccess;
  readonly boardId: number;
  readonly cards: BoardCardData[];
  readonly index: number;
  readonly members: Map<string, BoardMember>;
  readonly onOpenCard: (cardId: number) => void;
  readonly stage: BoardStage;
  readonly studioName: string;
}

export const StageColumn = ({
  access,
  boardId,
  cards,
  index,
  members,
  onOpenCard,
  stage,
  studioName,
}: StageColumnProperties) => {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <section
      aria-label={stage.name}
      className="flex w-72 shrink-0 flex-col border bg-secondary/90"
    >
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-secondary px-3 py-2.5">
        <span className="tabular font-mono text-[10px] text-signal-ink">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h2 className="flex-1 truncate font-bold font-mono text-[11px] uppercase tracking-[0.14em]">
          {stage.name}
        </h2>
        {stage.notify_client && (
          <MailIcon
            aria-label="El cliente recibe un correo en esta etapa"
            className="size-3.5 text-signal-ink/70"
          />
        )}
        <span className="tabular font-mono text-[11px] text-muted-foreground">
          {cards.length}
        </span>
        {access.canManage && (
          <Button
            aria-label={`Configurar ${stage.name}`}
            className="-mr-1.5 size-7"
            onClick={() => setConfigOpen(true)}
            size="icon"
            variant="ghost"
          >
            <Settings2Icon className="size-3.5" />
          </Button>
        )}
      </header>

      <Droppable droppableId={String(stage.id)}>
        {(provided, snapshot) => (
          <div
            className={cn(
              "flex min-h-20 flex-col gap-2 p-2 transition-colors",
              snapshot.isDraggingOver && "bg-signal/10"
            )}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {cards.map((card, cardIndex) => (
              <BoardCard
                assignee={
                  card.assigned_to ? members.get(card.assigned_to) : undefined
                }
                card={card}
                dragDisabled={!access.canMove}
                index={cardIndex}
                key={card.id}
                onOpen={onOpenCard}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {access.canCreate && (
        <div className="px-2 pb-2">
          <QuickAdd boardId={boardId} stageId={stage.id} />
        </div>
      )}

      {/* Mounted only while open so it always starts from fresh data. */}
      {access.canManage && configOpen && (
        <StageDialog
          cardCount={cards.length}
          onOpenChange={setConfigOpen}
          open={configOpen}
          stage={stage}
          studioName={studioName}
        />
      )}
    </section>
  );
};
