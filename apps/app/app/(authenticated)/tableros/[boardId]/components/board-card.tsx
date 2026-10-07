"use client";

import { Draggable } from "@hello-pangea/dnd";
import { cn } from "@repo/design-system/lib/utils";
import { CalendarIcon, LinkIcon, MailXIcon } from "lucide-react";
import { formatDateTime, initials, timeInStage } from "./format";
import type { BoardCard as BoardCardData, BoardMember } from "./types";

interface BoardCardProperties {
  readonly assignee: BoardMember | undefined;
  readonly card: BoardCardData;
  readonly dragDisabled: boolean;
  readonly index: number;
  readonly onOpen: (cardId: number) => void;
}

export const BoardCard = ({
  assignee,
  card,
  dragDisabled,
  index,
  onOpen,
}: BoardCardProperties) => {
  const client = card.client;

  return (
    <Draggable
      draggableId={String(card.id)}
      index={index}
      isDragDisabled={dragDisabled}
    >
      {(provided, snapshot) => (
        // biome-ignore lint/a11y/useSemanticElements: the drag handle holds block content (p, div), which a <button> cannot contain.
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          aria-label={`Abrir ${card.title}`}
          className={cn(
            "corner-notch flex cursor-pointer select-none flex-col gap-1 border bg-popover p-3 text-left outline-none [--notch:8px]",
            "transition-[border-color,box-shadow] duration-150 hover:border-signal-ink/40 focus-visible:border-signal-ink focus-visible:shadow-[0_0_0_3px_var(--glow-soft)]",
            snapshot.isDragging &&
              "rotate-2 border-signal-ink/60 shadow-[0_0_0_1px_var(--signal),0_16px_32px_-12px_var(--glow)]"
          )}
          onClick={() => onOpen(card.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onOpen(card.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <p className="font-medium text-sm leading-snug">{card.title}</p>
          {client && client.full_name !== card.title && (
            <p className="truncate text-muted-foreground text-xs">
              {client.full_name}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-muted-foreground">
            {card.session_at && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase">
                <CalendarIcon className="size-3" />
                <time dateTime={card.session_at} suppressHydrationWarning>
                  {formatDateTime(card.session_at)}
                </time>
              </span>
            )}
            {card.gallery_url && (
              <LinkIcon
                aria-label="Tiene enlace de entrega"
                className="size-3 text-signal-ink"
              />
            )}
            {!client?.email && (
              <MailXIcon
                aria-label="Sin correo: el cliente no recibirá avisos"
                className="size-3 text-flare"
              />
            )}
            <span
              className="tabular ml-auto font-mono text-[10px]"
              suppressHydrationWarning
              title="Tiempo en esta etapa"
            >
              {timeInStage(card.stage_entered_at)}
            </span>
            {assignee && (
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-signal/20 font-bold font-mono text-[9px] text-signal-ink"
                title={`Asignada a ${assignee.name}`}
              >
                {initials(assignee.name)}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};
