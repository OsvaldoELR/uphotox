"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteStage, updateStage } from "@/app/actions/boards";
import type { BoardStage } from "./types";

interface StageDialogProperties {
  readonly cardCount: number;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly stage: BoardStage;
  readonly studioName: string;
}

export const StageDialog = ({
  cardCount,
  onOpenChange,
  open,
  stage,
  studioName,
}: StageDialogProperties) => {
  const [notify, setNotify] = useState(stage.notify_client);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateStage(stage.id, {
        name: String(data.get("name") ?? ""),
        notifyClient: notify,
        clientMessage: String(data.get("clientMessage") ?? ""),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Etapa guardada");
      onOpenChange(false);
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteStage(stage.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-black font-mono uppercase tracking-wider">
            Configurar etapa
          </DialogTitle>
          <DialogDescription>
            Qué ve el cliente cuando su tarjeta llega a esta etapa.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" key={stage.id} onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="stage-name">Nombre</Label>
            <Input
              defaultValue={stage.name}
              id="stage-name"
              maxLength={60}
              name="name"
              required
            />
          </div>
          <div className="flex items-start justify-between gap-4 border p-3">
            <div className="grid gap-1">
              <Label htmlFor="stage-notify">Avisar al cliente</Label>
              <p className="text-muted-foreground text-sm">
                Envía un correo al cliente al entrar en esta etapa (si tiene
                correo).
              </p>
            </div>
            <Switch
              checked={notify}
              id="stage-notify"
              onCheckedChange={setNotify}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stage-message">Mensaje al cliente</Label>
            <Textarea
              className="min-h-28"
              defaultValue={stage.client_message ?? ""}
              disabled={!notify}
              id="stage-message"
              maxLength={2000}
              name="clientMessage"
              placeholder={`Tu sesión con ${studioName} pasó a la etapa «${stage.name}».`}
            />
            <p className="text-muted-foreground text-xs">
              Si la tarjeta tiene álbum de entrega, el correo incluye el botón
              «Ver mi álbum»; si el estudio tiene WhatsApp, también uno para
              escribirte. Es un aviso automático: no pidas que respondan.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={pending} type="button" variant="ghost">
                  Eliminar etapa
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar «{stage.name}»?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {cardCount > 0
                      ? `Tiene ${cardCount} tarjeta(s). Muévelas a otra etapa antes de eliminarla.`
                      : "Esta acción no se puede deshacer."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction disabled={cardCount > 0} onClick={remove}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button disabled={pending} type="submit">
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
