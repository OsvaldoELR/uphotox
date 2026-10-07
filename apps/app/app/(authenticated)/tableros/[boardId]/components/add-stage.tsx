"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { PlusIcon } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { createStage } from "@/app/actions/boards";

export const AddStage = ({ boardId }: { readonly boardId: number }) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const closeOnEscape = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");

    startTransition(async () => {
      const result = await createStage(boardId, name);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      form.reset();
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        className="flex h-12 w-72 shrink-0 items-center justify-center gap-2 border border-dashed font-bold font-mono text-[11px] text-muted-foreground uppercase tracking-[0.14em] transition-colors hover:border-signal-ink/40 hover:text-signal-ink"
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlusIcon className="size-4" />
        Nueva etapa
      </button>
    );
  }

  return (
    <form
      className="grid w-72 shrink-0 gap-2 border border-signal-ink/30 bg-popover p-2"
      onSubmit={submit}
    >
      <Input
        aria-label="Nombre de la etapa"
        autoFocus
        maxLength={60}
        name="name"
        onKeyDown={closeOnEscape}
        placeholder="Ej.: Álbum impreso"
        required
      />
      <div className="flex items-center gap-2">
        <Button disabled={pending} size="sm" type="submit">
          Añadir
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
