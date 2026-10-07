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

interface QuickAddProperties {
  readonly boardId: number;
  readonly stageId: number;
}

/** Adds a client to a stage without leaving the board. */
export const QuickAdd = ({ boardId, stageId }: QuickAddProperties) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const closeOnEscape = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  };
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await createCard({
        boardId,
        stageId,
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
        <Button
          onClick={() => setOpen(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};
