"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import { PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { type CreateBoardState, createBoard } from "@/app/actions/boards";
import {
  BOARD_TEMPLATE_IDS,
  BOARD_TEMPLATES,
  type BoardTemplateId,
} from "@/lib/board-templates";

export const CreateBoardDialog = () => {
  const [template, setTemplate] = useState<BoardTemplateId>("session");
  const [state, formAction, pending] = useActionState<
    CreateBoardState,
    FormData
  >(createBoard, {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          Nuevo tablero
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-black font-mono uppercase tracking-wider">
            Nuevo tablero
          </DialogTitle>
          <DialogDescription>
            Un tablero por tipo de sesión: bodas, familia, comercial…
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="board-name">Nombre</Label>
            <Input
              autoFocus
              id="board-name"
              maxLength={80}
              name="name"
              placeholder="Ej.: Bodas 2027"
              required
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
              Plantilla
            </legend>
            <input name="template" type="hidden" value={template} />
            {BOARD_TEMPLATE_IDS.map((id) => {
              const option = BOARD_TEMPLATES[id];
              const selected = template === id;

              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    "flex flex-col gap-1 border p-4 text-left transition-colors",
                    selected
                      ? "border-signal-ink/60 bg-signal/10"
                      : "hover:border-signal-ink/30"
                  )}
                  key={id}
                  onClick={() => setTemplate(id)}
                  type="button"
                >
                  <span className="font-bold font-mono text-xs uppercase tracking-[0.14em]">
                    {option.label}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {option.description}
                  </span>
                  <span className="mt-1 font-mono text-[10px] text-signal-ink uppercase tracking-[0.12em]">
                    {option.stages.map((stage) => stage.name).join(" → ")}
                  </span>
                </button>
              );
            })}
          </fieldset>
          {state.error && (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          )}
          <Button disabled={pending} type="submit">
            {pending ? "Creando..." : "Crear tablero"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
