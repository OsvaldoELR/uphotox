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
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  CopyIcon,
  ExternalLinkIcon,
  MessageCircleIcon,
  SendIcon,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { reopenGallery, sendGallery } from "@/app/actions/galleries";
import { type GalleryState, lightroomFilter } from "@/lib/gallery";

export interface ClientShareProperties {
  readonly canManage: boolean;
  readonly client: {
    readonly email: string | null;
    readonly firstName: string;
    /** wa.me link to the client with the gallery link, if the phone allows. */
    readonly whatsappUrl: string | null;
  };
  /** Public link of the client page. */
  readonly clientUrl: string;
  readonly emailEnabled: boolean;
  readonly expiresAt: string | null;
  readonly galleryId: number;
  readonly hasPhotos: boolean;
  readonly pickedFileNames: readonly string[];
  /** Board stage the card moves to when the gallery is sent. */
  readonly sentStageName: string | null;
  readonly state: GalleryState;
  readonly submittedAt: string | null;
}

const longDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
});

const copy = async (text: string, done: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.");
  }
};

const SendButton = ({
  client,
  emailEnabled,
  galleryId,
  hasPhotos,
  label,
  sentStageName,
}: Pick<
  ClientShareProperties,
  "client" | "emailEnabled" | "galleryId" | "hasPhotos" | "sentStageName"
> & { readonly label: string }) => {
  const [pending, startTransition] = useTransition();
  const willEmail = emailEnabled && Boolean(client.email);

  const send = () => {
    startTransition(async () => {
      const result = await sendGallery(galleryId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.emailed
          ? `Galería enviada a ${client.email}`
          : "Galería abierta: comparte el enlace con el cliente"
      );
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending || !hasPhotos}>
          <SendIcon className="size-4" />
          {pending ? "Enviando…" : label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>
            {willEmail
              ? `${client.firstName || "El cliente"} recibirá un correo en ${client.email} con el enlace para elegir sus fotos.`
              : "La tarjeta no tiene correo del cliente (o los correos están desactivados): después, comparte el enlace por WhatsApp."}{" "}
            Tendrá 60 días para elegir
            {sentStageName ? ` y la tarjeta pasará a «${sentStageName}».` : "."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={send}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const ShareLinks = ({
  client,
  clientUrl,
}: Pick<ClientShareProperties, "client" | "clientUrl">) => (
  <>
    <Button
      onClick={() => copy(clientUrl, "Enlace copiado")}
      size="sm"
      variant="outline"
    >
      <CopyIcon className="size-4" />
      Copiar enlace
    </Button>
    {client.whatsappUrl ? (
      <Button asChild size="sm" variant="outline">
        <a href={client.whatsappUrl} rel="noopener" target="_blank">
          <MessageCircleIcon className="size-4" />
          WhatsApp
        </a>
      </Button>
    ) : null}
    <Button asChild size="sm" variant="ghost">
      <a href={clientUrl} rel="noopener" target="_blank">
        <ExternalLinkIcon className="size-4" />
        Ver como cliente
      </a>
    </Button>
  </>
);

const LightroomBlock = ({
  fileNames,
}: {
  readonly fileNames: readonly string[];
}) => {
  const list = lightroomFilter(fileNames);

  return (
    <div className="grid gap-2">
      <Textarea
        aria-label="Lista para Lightroom"
        className="min-h-20 font-mono text-xs"
        readOnly
        value={list}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => copy(list, "Lista copiada: pégala en Lightroom")}
          size="sm"
        >
          <CopyIcon className="size-4" />
          Copiar para Lightroom
        </Button>
        <p className="text-muted-foreground text-xs">
          En Lightroom Classic: Biblioteca → barra de filtros (tecla \) → Texto
          → «Nombre de archivo» · «Contiene» → pega la lista.
        </p>
      </div>
    </div>
  );
};

const ReopenButton = ({ galleryId }: { readonly galleryId: number }) => {
  const [pending, startTransition] = useTransition();

  const reopen = () => {
    startTransition(async () => {
      const result = await reopenGallery(galleryId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Selección reabierta: el cliente ya puede cambiarla");
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending} size="sm" variant="ghost">
          Reabrir selección
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Reabrir la selección?</AlertDialogTitle>
          <AlertDialogDescription>
            El cliente podrá cambiar sus favoritas con el mismo enlace durante
            60 días más y la tarjeta vuelve a la etapa de envío. No se le manda
            correo: avísale por WhatsApp.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={reopen}>Reabrir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/** What the studio does with the client, depending on the gallery state. */
export const ClientShare = (props: ClientShareProperties) => {
  const { canManage, expiresAt, state, submittedAt } = props;
  const date = (iso: string | null) =>
    iso ? longDate.format(new Date(iso)) : "—";

  return (
    <section className="grid gap-4 border bg-card p-4">
      <span className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
        Cliente
      </span>

      {state === "draft" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-sm">
            {props.hasPhotos
              ? "Cuando termines de subir las fotos, envíale la galería para que elija."
              : "Sube las fotos y después envíale la galería para que elija."}
          </p>
          {canManage && <SendButton {...props} label="Enviar al cliente" />}
        </div>
      )}

      {state === "open" && (
        <div className="grid gap-3">
          <p className="text-sm">
            Esperando a que elija · el enlace caduca el {date(expiresAt)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <ShareLinks client={props.client} clientUrl={props.clientUrl} />
            {canManage && <SendButton {...props} label="Enviar de nuevo" />}
          </div>
        </div>
      )}

      {state === "expired" && (
        <div className="grid gap-3">
          <p className="text-flare text-sm">
            El enlace caducó el {date(expiresAt)} sin que el cliente confirmara.
          </p>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <SendButton {...props} label="Renovar y enviar de nuevo" />
            )}
            <ShareLinks client={props.client} clientUrl={props.clientUrl} />
          </div>
        </div>
      )}

      {state === "submitted" && (
        <div className="grid gap-4">
          <p className="text-sm">
            Selección recibida el {date(submittedAt)}:{" "}
            {props.pickedFileNames.length}{" "}
            {props.pickedFileNames.length === 1 ? "foto" : "fotos"}.
          </p>
          <LightroomBlock fileNames={props.pickedFileNames} />
          <div className="flex flex-wrap gap-2">
            <ShareLinks client={props.client} clientUrl={props.clientUrl} />
            {canManage && <ReopenButton galleryId={props.galleryId} />}
          </div>
        </div>
      )}
    </section>
  );
};
