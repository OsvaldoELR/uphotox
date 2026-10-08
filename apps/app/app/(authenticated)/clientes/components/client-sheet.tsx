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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useTransition } from "react";
import { toast } from "sonner";
import { deleteClient, updateClient } from "@/app/actions/clients";
import { formatSessionDate } from "@/lib/session-date";
import { normalizeWhatsapp, whatsappUrl } from "@/lib/whatsapp";
import type { ClientListItem, ClientsAccess } from "./types";

// wa.me needs the country code: 11+ digits ("+1 786…", "+34 612…").
const INTERNATIONAL_NUMBER = /^[1-9]\d{10,14}$/;

const sectionLabel =
  "font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]";

const since = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });

const ContactLinks = ({ client }: { readonly client: ClientListItem }) => {
  const digits = client.phone ? normalizeWhatsapp(client.phone) : "";

  if (!(client.phone || client.email)) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {INTERNATIONAL_NUMBER.test(digits) && (
        <Button asChild size="sm">
          <a href={whatsappUrl(digits)} rel="noopener" target="_blank">
            <MessageCircleIcon />
            WhatsApp
          </a>
        </Button>
      )}
      {client.phone && (
        <Button asChild size="sm" variant="outline">
          <a href={`tel:${client.phone}`}>
            <PhoneIcon />
            Llamar
          </a>
        </Button>
      )}
      {client.email && (
        <Button asChild size="sm" variant="outline">
          <a href={`mailto:${client.email}`}>
            <MailIcon />
            Correo
          </a>
        </Button>
      )}
    </div>
  );
};

const Sessions = ({ client }: { readonly client: ClientListItem }) => {
  if (client.sessions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No tiene tarjetas en ningún tablero que puedas ver.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {client.sessions.map((session) => (
        <li
          className="corner-notch flex items-center gap-3 border bg-popover p-3 [--notch:8px]"
          key={session.id}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-medium text-sm">
              {session.title}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
              {session.boardName} ·{" "}
              <span className="text-signal-ink">{session.stageName}</span>
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.12em]"
              suppressHydrationWarning
            >
              {session.sessionAt
                ? formatSessionDate(session.sessionAt)
                : "Sin fecha"}
            </span>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/tableros/${session.boardId}?tarjeta=${session.id}`}>
              Abrir
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
};

interface ClientSheetProperties {
  readonly access: ClientsAccess;
  readonly client: ClientListItem;
  readonly onClose: () => void;
}

export const ClientSheet = ({
  access,
  client,
  onClose,
}: ClientSheetProperties) => {
  const [pending, startTransition] = useTransition();
  const cardCount = client.sessions.length;
  const canDelete =
    access.canManage && (cardCount === 0 || access.canDeleteCards);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "");

    startTransition(async () => {
      const result = await updateClient(client.id, {
        fullName: field("fullName"),
        email: field("email"),
        phone: field("phone"),
        notes: field("notes"),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Cliente guardado");
      onClose();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteClient(client.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`${client.fullName} eliminado`);
      onClose();
    });
  };

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open>
      <SheetContent
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-b">
          <SheetTitle className="pr-6 font-black font-mono text-lg uppercase leading-tight tracking-wide">
            {client.fullName}
          </SheetTitle>
          <SheetDescription className="font-mono text-[11px] uppercase tracking-[0.16em]">
            Cliente desde {since.format(new Date(client.createdAt))} ·{" "}
            <span className="text-signal-ink">
              {cardCount} {cardCount === 1 ? "sesión" : "sesiones"}
            </span>
          </SheetDescription>
        </SheetHeader>

        <section className="grid gap-4 border-b p-4">
          <ContactLinks client={client} />
          <span className={sectionLabel}>Sesiones</span>
          <Sessions client={client} />
        </section>

        <form className="grid gap-5 p-4" onSubmit={save}>
          <fieldset className="grid gap-4" disabled={!access.canManage}>
            <span className={sectionLabel}>Datos</span>
            <div className="grid gap-2">
              <Label htmlFor="client-name">Nombre</Label>
              <Input
                defaultValue={client.fullName}
                id="client-name"
                maxLength={120}
                name="fullName"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="client-phone">Teléfono</Label>
                <Input
                  defaultValue={client.phone ?? ""}
                  id="client-phone"
                  maxLength={40}
                  name="phone"
                  placeholder="+1 786 555 0100"
                  type="tel"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-email">Correo</Label>
                <Input
                  defaultValue={client.email ?? ""}
                  id="client-email"
                  maxLength={320}
                  name="email"
                  type="email"
                />
              </div>
            </div>
            {!client.email && (
              <p className="text-flare text-xs">
                Sin correo, el cliente no recibirá los avisos de cada etapa.
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="client-notes">Notas del cliente</Label>
              <Textarea
                className="min-h-20"
                defaultValue={client.notes ?? ""}
                id="client-notes"
                maxLength={2000}
                name="notes"
                placeholder="Lo que sirve para todas sus sesiones: hijos, gustos, cómo prefiere que le escribamos…"
              />
            </div>
          </fieldset>

          {access.canManage && (
            <div className="flex items-center justify-between gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={pending || !canDelete}
                    title={
                      canDelete
                        ? undefined
                        : "Tiene tarjetas y no puedes eliminar tarjetas."
                    }
                    type="button"
                    variant="ghost"
                  >
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      ¿Eliminar a {client.fullName}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {cardCount > 0
                        ? `También se borran sus ${cardCount} tarjetas, con su historial y fotos. No se puede deshacer.`
                        : "No se puede deshacer."}
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
              <Button disabled={pending} type="submit">
                {pending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};
