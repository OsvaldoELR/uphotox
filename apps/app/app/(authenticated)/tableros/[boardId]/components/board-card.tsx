"use client";

import { Draggable } from "@hello-pangea/dnd";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowRightLeftIcon,
  CalendarIcon,
  CheckIcon,
  LinkIcon,
  MailXIcon,
} from "lucide-react";
import Image from "next/image";
import type { SyntheticEvent } from "react";
import { formatDateTime, initials, timeInStage } from "./format";
import type {
  BoardCard as BoardCardData,
  BoardMember,
  BoardStage,
} from "./types";

interface BoardCardProperties {
  readonly assignee: BoardMember | undefined;
  readonly canMove: boolean;
  readonly card: BoardCardData;
  readonly index: number;
  readonly onMove: (cardId: number, stageId: number) => void;
  readonly onOpen: (cardId: number) => void;
  readonly stages: BoardStage[];
}

// The menu lives in a portal, but React events still bubble to the card:
// stop them so choosing a stage does not also open the card sheet.
const stop = (event: SyntheticEvent) => event.stopPropagation();

/** "Mover a…" — the way to change stage without dragging (phones). */
const MoveMenu = ({
  card,
  onMove,
  stages,
}: Pick<BoardCardProperties, "card" | "onMove" | "stages">) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild onClick={stop} onKeyDown={stop}>
      <Button
        aria-label={`Mover ${card.title} a otra etapa`}
        className="size-7 shrink-0 md:opacity-0 md:data-[state=open]:opacity-100 md:group-hover/card:opacity-100 md:focus-visible:opacity-100"
        size="icon"
        variant="ghost"
      >
        <ArrowRightLeftIcon className="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className="w-60"
      onClick={stop}
      onKeyDown={stop}
    >
      <DropdownMenuLabel className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.25em]">
        Mover a
      </DropdownMenuLabel>
      {stages.map((stage, index) => {
        const current = stage.id === card.stage_id;
        return (
          <DropdownMenuItem
            disabled={current}
            key={stage.id}
            onSelect={() => onMove(card.id, stage.id)}
          >
            <span className="w-5 font-mono text-[10px] text-signal-ink">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 truncate">{stage.name}</span>
            {current && <CheckIcon className="size-3.5" />}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);

export const BoardCard = ({
  assignee,
  canMove,
  card,
  index,
  onMove,
  onOpen,
  stages,
}: BoardCardProperties) => {
  const client = card.client;

  return (
    <Draggable
      draggableId={String(card.id)}
      index={index}
      isDragDisabled={!canMove}
    >
      {(provided, snapshot) => (
        // biome-ignore lint/a11y/useSemanticElements: the drag handle holds block content (p, div), which a <button> cannot contain.
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          aria-label={`Abrir ${card.title}`}
          className={cn(
            "group/card corner-notch flex cursor-pointer select-none flex-col overflow-hidden border bg-popover text-left outline-none [--notch:8px]",
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
          {card.cover_url && (
            <Image
              alt=""
              className="aspect-[16/9] w-full border-b object-cover"
              crossOrigin="anonymous"
              draggable={false}
              height={270}
              src={card.cover_url}
              unoptimized
              width={480}
            />
          )}
          <div className="flex flex-col gap-1 p-3">
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
                  aria-label="Tiene álbum de entrega"
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
              {canMove && stages.length > 1 && (
                <MoveMenu card={card} onMove={onMove} stages={stages} />
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
