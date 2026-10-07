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
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type CardHistoryEntry,
  deleteCard,
  getCardHistory,
  updateCard,
} from "@/app/actions/cards";
import { ROLES } from "@/lib/permissions";
import {
  formatDateTime,
  fromLocalInput,
  timeInStage,
  toLocalInput,
} from "./format";
import type { BoardAccess, BoardCard, BoardMember, BoardStage } from "./types";

const UNASSIGNED = "none";

interface CardSheetProperties {
  readonly access: BoardAccess;
  readonly card: BoardCard | null;
  readonly members: BoardMember[];
  readonly onClose: () => void;
  /** Separate from `card` so the content stays during the close animation. */
  readonly open: boolean;
  readonly stage: BoardStage | undefined;
}

const describeEvent = (event: CardHistoryEntry) => {
  const who = event.actor ?? "Alguien";

  switch (event.kind) {
    case "created":
      return `${who} la creó en «${event.to ?? "—"}»`;
    case "moved":
      return `${who} la movió de «${event.from ?? "—"}» a «${event.to ?? "—"}»`;
    case "email_sent":
      return `Correo enviado · ${event.detail ?? ""}`;
    default:
      return `Correo fallido · ${event.detail ?? ""}`;
  }
};

const History = ({ cardId }: { readonly cardId: number }) => {
  const [events, setEvents] = useState<CardHistoryEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    getCardHistory(cardId).then((result) => {
      if (active) {
        setEvents(result);
      }
    });
    return () => {
      active = false;
    };
  }, [cardId]);

  if (!events) {
    return <p className="text-muted-foreground text-sm">Cargando…</p>;
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">Sin movimientos.</p>;
  }

  return (
    <ol className="grid gap-3">
      {events.map((event) => (
        <li className="grid gap-0.5 border-l-2 pl-3" key={event.id}>
          <span
            className={cn(
              "text-sm",
              event.kind === "email_failed" && "text-destructive"
            )}
          >
            {describeEvent(event)}
          </span>
          <time
            className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]"
            dateTime={event.at}
          >
            {formatDateTime(event.at)}
          </time>
        </li>
      ))}
    </ol>
  );
};

export const CardSheet = ({
  access,
  card,
  members,
  onClose,
  open,
  stage,
}: CardSheetProperties) => {
  const [pending, startTransition] = useTransition();
  const [assignee, setAssignee] = useState(UNASSIGNED);

  useEffect(() => {
    setAssignee(card?.assigned_to ?? UNASSIGNED);
  }, [card?.assigned_to]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!card) {
      return;
    }

    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "");

    startTransition(async () => {
      const result = await updateCard(card.id, {
        title: field("title"),
        clientName: field("clientName"),
        clientEmail: field("clientEmail"),
        clientPhone: field("clientPhone"),
        sessionAt: fromLocalInput(field("sessionAt")),
        galleryUrl: field("galleryUrl"),
        notes: field("notes"),
        assignedTo: assignee === UNASSIGNED ? null : assignee,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Tarjeta guardada");
      onClose();
    });
  };

  const remove = () => {
    if (!card) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCard(card.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      onClose();
    });
  };

  const readOnly = !access.canEdit;

  return (
    <Sheet
      onOpenChange={(next) => !next && onClose()}
      open={open && card !== null}
    >
      <SheetContent
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
        // Details are read first; do not jump into (and select) the title.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {card && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="pr-6 font-black font-mono text-lg uppercase leading-tight tracking-wide">
                {card.title}
              </SheetTitle>
              <SheetDescription className="font-mono text-[11px] uppercase tracking-[0.16em]">
                <span className="text-signal-ink">{stage?.name}</span> · en esta
                etapa: {timeInStage(card.stage_entered_at)}
              </SheetDescription>
            </SheetHeader>

            <form className="grid gap-5 p-4" key={card.id} onSubmit={save}>
              <fieldset className="grid gap-4" disabled={readOnly}>
                <div className="grid gap-2">
                  <Label htmlFor="card-title">Título</Label>
                  <Input
                    defaultValue={card.title}
                    id="card-title"
                    maxLength={120}
                    name="title"
                    required
                  />
                </div>

                <div className="grid gap-3 border p-3">
                  <span className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
                    Cliente
                  </span>
                  <div className="grid gap-2">
                    <Label htmlFor="card-client">Nombre</Label>
                    <Input
                      defaultValue={card.client?.full_name ?? ""}
                      id="card-client"
                      maxLength={120}
                      name="clientName"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="card-email">Correo</Label>
                      <Input
                        defaultValue={card.client?.email ?? ""}
                        id="card-email"
                        maxLength={320}
                        name="clientEmail"
                        type="email"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="card-phone">Teléfono</Label>
                      <Input
                        defaultValue={card.client?.phone ?? ""}
                        id="card-phone"
                        maxLength={40}
                        name="clientPhone"
                        type="tel"
                      />
                    </div>
                  </div>
                  {!card.client?.email && (
                    <p className="text-flare text-xs">
                      Sin correo, el cliente no recibirá los avisos de cada
                      etapa.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="card-session">Fecha de la sesión</Label>
                    <Input
                      defaultValue={toLocalInput(card.session_at)}
                      id="card-session"
                      name="sessionAt"
                      type="datetime-local"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="card-assignee">Responsable</Label>
                    <Select
                      disabled={readOnly}
                      onValueChange={setAssignee}
                      value={assignee}
                    >
                      <SelectTrigger className="w-full" id="card-assignee">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name} · {ROLES[member.role].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="card-gallery">Enlace de entrega</Label>
                  <Input
                    defaultValue={card.gallery_url ?? ""}
                    id="card-gallery"
                    maxLength={2048}
                    name="galleryUrl"
                    placeholder="https://drive.google.com/…"
                    type="url"
                  />
                  <p className="text-muted-foreground text-xs">
                    Carpeta de Google Drive o galería. Se incluye en los correos
                    al cliente.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="card-notes">Notas</Label>
                  <Textarea
                    className="min-h-24"
                    defaultValue={card.notes ?? ""}
                    id="card-notes"
                    maxLength={5000}
                    name="notes"
                  />
                </div>
              </fieldset>

              {(access.canEdit || access.canDelete) && (
                <div className="flex items-center justify-between gap-3">
                  {access.canDelete ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={pending}
                          type="button"
                          variant="ghost"
                        >
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            ¿Eliminar «{card.title}»?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Se borra la tarjeta y su historial. El cliente se
                            conserva.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={remove}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <span />
                  )}
                  {access.canEdit && (
                    <Button disabled={pending} type="submit">
                      {pending ? "Guardando..." : "Guardar"}
                    </Button>
                  )}
                </div>
              )}
            </form>

            <section className="grid gap-3 border-t p-4">
              <span className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
                Historial
              </span>
              <History cardId={card.id} />
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
