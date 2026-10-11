"use client";

import {
  DragDropContext,
  Draggable,
  type DraggableProvided,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  MailIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reorderStages } from "@/app/actions/boards";
import type { BoardStage } from "./types";

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) {
    next.splice(to, 0, item);
  }
  return next;
};

interface StageRowProperties {
  readonly count: number;
  readonly dragging: boolean;
  readonly index: number;
  readonly onMove: (from: number, to: number) => void;
  readonly provided: DraggableProvided;
  readonly stage: BoardStage;
}

const StageRow = ({
  count,
  dragging,
  index,
  onMove,
  provided,
  stage,
}: StageRowProperties) => (
  <li
    ref={provided.innerRef}
    {...provided.draggableProps}
    className={cn(
      "flex items-center gap-2 border bg-popover py-1.5 pr-1.5 pl-1",
      dragging &&
        "border-signal-ink/60 shadow-[0_0_0_1px_var(--signal),0_12px_24px_-12px_var(--glow)]"
    )}
  >
    {/* dragHandleProps adds role="button", tabIndex and keyboard dragging. */}
    <span
      {...provided.dragHandleProps}
      className="flex size-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
    >
      <GripVerticalIcon aria-hidden className="size-4" />
      <span className="sr-only">Arrastrar {stage.name}</span>
    </span>
    <span className="tabular w-5 shrink-0 font-mono text-[10px] text-signal-ink">
      {String(index + 1).padStart(2, "0")}
    </span>
    <span className="min-w-0 flex-1 truncate font-medium text-sm">
      {stage.name}
    </span>
    {stage.notify_client && (
      <MailIcon
        aria-label="Avisa al cliente"
        className="size-3.5 shrink-0 text-signal-ink/70"
      />
    )}
    <Button
      aria-label={`Subir ${stage.name}`}
      className="size-7 shrink-0"
      disabled={index === 0}
      onClick={() => onMove(index, index - 1)}
      size="icon"
      variant="ghost"
    >
      <ChevronUpIcon className="size-4" />
    </Button>
    <Button
      aria-label={`Bajar ${stage.name}`}
      className="size-7 shrink-0"
      disabled={index === count - 1}
      onClick={() => onMove(index, index + 1)}
      size="icon"
      variant="ghost"
    >
      <ChevronDownIcon className="size-4" />
    </Button>
  </li>
);

interface StageOrderDialogProperties {
  readonly boardId: number;
  readonly onOpenChange: (open: boolean) => void;
  readonly stages: BoardStage[];
}

/**
 * Reorders a board's stages: drag a row or use the arrows (handy on phones),
 * then save. Mounted only while open, so it starts from the current order.
 */
export const StageOrderDialog = ({
  boardId,
  onOpenChange,
  stages,
}: StageOrderDialogProperties) => {
  const [order, setOrder] = useState(stages);
  const [pending, startTransition] = useTransition();
  const changed = order.some((stage, index) => stage.id !== stages[index]?.id);

  const moveRow = (from: number, to: number) =>
    setOrder((current) => move(current, from, to));

  const onDragEnd = ({ source, destination }: DropResult) => {
    if (destination && destination.index !== source.index) {
      moveRow(source.index, destination.index);
    }
  };

  const save = () => {
    startTransition(async () => {
      const result = await reorderStages({
        boardId,
        stageIds: order.map((stage) => stage.id),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Orden de etapas guardado");
      onOpenChange(false);
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black font-mono uppercase tracking-wider">
            Ordenar etapas
          </DialogTitle>
          <DialogDescription>
            Arrastra cada etapa o usa las flechas. El orden se aplica al tablero
            y a todos los sitios donde se elige una etapa.
          </DialogDescription>
        </DialogHeader>

        <DragDropContext onDragEnd={onDragEnd}>
          {/* The dragged row renders in a portal (renderClone): the dialog is
              centred with a transform, which would offset a fixed-position
              drag item. */}
          <Droppable
            droppableId="stage-order"
            renderClone={(provided, _snapshot, rubric) => {
              const stage = order[rubric.source.index];
              return stage ? (
                <StageRow
                  count={order.length}
                  dragging
                  index={rubric.source.index}
                  onMove={moveRow}
                  provided={provided}
                  stage={stage}
                />
              ) : (
                <li ref={provided.innerRef} />
              );
            }}
          >
            {(provided) => (
              <ol
                className="grid max-h-[60vh] gap-1.5 overflow-y-auto"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {order.map((stage, index) => (
                  <Draggable
                    draggableId={String(stage.id)}
                    index={index}
                    key={stage.id}
                  >
                    {(draggable) => (
                      <StageRow
                        count={order.length}
                        dragging={false}
                        index={index}
                        onMove={moveRow}
                        provided={draggable}
                        stage={stage}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ol>
            )}
          </Droppable>
        </DragDropContext>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button disabled={pending || !changed} onClick={save} type="button">
            {pending ? "Guardando..." : "Guardar orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
