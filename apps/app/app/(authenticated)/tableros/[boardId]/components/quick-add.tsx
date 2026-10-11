"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { PlusIcon } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { createCard } from "@/app/actions/cards";

interface QuickAddFormProperties {
  readonly boardId: number;
  readonly onClose: () => void;
  /** "start": on top of the stage (header «+»); "end": below the last card. */
  readonly placement: "start" | "end";
  readonly stageId: number;
}

/** Client name, email and title; stays open to add several in a row. */
export const QuickAddForm = ({
  boardId,
  onClose,
  placement,
  stageId,
}: QuickAddFormProperties) => {
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  const closeOnEscape = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      onClose();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await createCard({
        boardId,
        stageId,
        placement,
        clientName: String(data.get("clientName") ?? ""),
        clientEmail: String(data.get("clientEmail") ?? ""),
        title: String(data.get("title") ?? ""),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      form.reset();
      nameRef.current?.focus();
    });
  };

  return (
    <form
      className="grid gap-2 border border-signal-ink/30 bg-popover p-2"
      onSubmit={submit}
    >
      <Input
        aria-label="Nombre del cliente"
        autoFocus
        maxLength={120}
        name="clientName"
        onKeyDown={closeOnEscape}
        placeholder="Nombre del cliente"
        ref={nameRef}
        required
      />
      <Input
        aria-label="Correo del cliente"
        maxLength={320}
        name="clientEmail"
        onKeyDown={closeOnEscape}
        placeholder="Correo (para los avisos)"
        type="email"
      />
      <Input
        aria-label="Título de la tarjeta"
        maxLength={120}
        name="title"
        onKeyDown={closeOnEscape}
        placeholder="Título (opcional): Boda, Newborn…"
      />
      <div className="flex items-center gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? "Añadiendo..." : "Añadir"}
        </Button>
        <Button onClick={onClose} size="sm" type="button" variant="ghost">
          Cancelar
        </Button>
      </div>
    </form>
  );
};

interface QuickAddProperties {
  readonly boardId: number;
  readonly stageId: number;
}

/** «Añadir cliente» below the last card of a stage. */
export const QuickAdd = ({ boardId, stageId }: QuickAddProperties) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
        size="sm"
        variant="ghost"
      >
        <PlusIcon />
        Añadir cliente
      </Button>
    );
  }

  return (
    <QuickAddForm
      boardId={boardId}
      onClose={() => setOpen(false)}
      placement="end"
      stageId={stageId}
    />
  );
};
