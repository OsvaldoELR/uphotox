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
import { Switch } from "@repo/design-system/components/ui/switch";
import { CopyIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions/boards";
import {
  deleteWebhook,
  enableWebhook,
  regenerateWebhookToken,
  updateWebhook,
} from "@/app/actions/integrations";

export interface WebhookBoard {
  readonly id: number;
  readonly name: string;
  readonly stages: { id: number; name: string }[];
}

export interface WebhookState {
  readonly boardId: number | null;
  readonly enabled: boolean;
  readonly lastError: string | null;
  readonly lastReceivedAt: string | null;
  readonly stageId: number | null;
  readonly token: string;
}

interface WebhookSettingsProperties {
  /** Base URL of the API app (NEXT_PUBLIC_API_URL), if configured. */
  readonly apiUrl: string | null;
  readonly boards: WebhookBoard[];
  readonly webhook: WebhookState | null;
}

const EXAMPLE = `{
  "name": "{{Nombre}}",
  "email": "{{Email}}",
  "phone": "{{Teléfono}}",
  "title": "Sesión {{Tipo de sesión}}",
  "external_id": "{{Response ID}}",
  "answers": {
    "Tipo de sesión": "{{Tipo de sesión}}",
    "Fecha preferida": "{{Fecha preferida}}",
    "¿Cómo nos conociste?": "{{¿Cómo nos conociste?}}"
  }
}`;

const dateTime = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

const copy = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("No se pudo copiar; selecciónalo y cópialo a mano.");
  }
};

const MakeSteps = () => (
  <details className="group border">
    <summary className="cursor-pointer select-none px-4 py-3 font-bold font-mono text-[11px] uppercase tracking-[0.14em]">
      Cómo conectarlo con Make (Typeform)
    </summary>
    <div className="grid gap-4 border-t px-4 py-4 text-sm">
      <ol className="grid list-decimal gap-2 pl-5">
        <li>
          En Make crea un escenario con el módulo{" "}
          <b>Typeform → Watch Responses</b> y elige tu formulario.
        </li>
        <li>
          Añade <b>HTTP → Make a request</b>: método <b>POST</b>, la URL de
          arriba, <i>Body type</i> <b>Raw</b> y <i>Content type</i>{" "}
          <b>JSON (application/json)</b>.
        </li>
        <li>
          En <i>Request content</i> pega este JSON y cambia cada valor por el
          campo de Typeform correspondiente. Solo <code>name</code> es
          obligatorio; en <code>answers</code> pon todas las preguntas que
          quieras ver en la tarjeta.
        </li>
        <li>
          Usa el <b>Response ID</b> de Typeform como <code>external_id</code>:
          así un reintento nunca duplica al cliente.
        </li>
        <li>
          Activa el escenario y envía una respuesta de prueba: la tarjeta
          aparece en el tablero y etapa elegidos.
        </li>
      </ol>
      <div className="relative">
        <pre className="overflow-x-auto border bg-field p-3 font-mono text-xs leading-relaxed">
          {EXAMPLE}
        </pre>
        <Button
          aria-label="Copiar JSON de ejemplo"
          className="absolute top-2 right-2"
          onClick={() => copy(EXAMPLE, "JSON")}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <CopyIcon />
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        También vale para Google Forms, Jotform, Zapier o n8n: cualquier
        herramienta que pueda enviar un POST con este JSON. Al recibir un
        cliente no se le envía ningún correo; los avisos empiezan cuando lo
        mueves de etapa.
      </p>
    </div>
  </details>
);

export const WebhookSettings = ({
  apiUrl,
  boards,
  webhook,
}: WebhookSettingsProperties) => {
  const [pending, startTransition] = useTransition();
  const [boardId, setBoardId] = useState(webhook?.boardId ?? null);
  const [stageId, setStageId] = useState(webhook?.stageId ?? null);
  const stages = boards.find((board) => board.id === boardId)?.stages ?? [];

  const run = (action: () => Promise<ActionResult>, success?: string) => {
    startTransition(async () => {
      const result = await action();

      if ("error" in result) {
        toast.error(result.error);
      } else if (success) {
        toast.success(success);
      }
    });
  };

  if (!webhook) {
    return (
      <div className="grid gap-4">
        <p className="text-muted-foreground text-sm">
          Recibe los clientes que reservan desde un formulario (Typeform vía
          Make, Google Forms, Zapier…) directamente en un tablero, sin copiarlos
          a mano.
        </p>
        <Button
          className="w-fit"
          disabled={pending}
          onClick={() => run(enableWebhook, "Entrada de clientes activada")}
        >
          Activar
        </Button>
      </div>
    );
  }

  const url = apiUrl ? `${apiUrl}/webhooks/clients/${webhook.token}` : null;
  const isLocal = Boolean(apiUrl?.includes("localhost"));

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4 border p-3">
        <div className="grid gap-1">
          <Label htmlFor="webhook-enabled">Recibir clientes</Label>
          <p className="text-muted-foreground text-sm">
            Mientras esté apagado, la URL responde con un error y no crea nada.
          </p>
        </div>
        <Switch
          checked={webhook.enabled}
          disabled={pending}
          id="webhook-enabled"
          onCheckedChange={(enabled) =>
            run(() => updateWebhook({ enabled, boardId, stageId }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="webhook-url">URL del webhook</Label>
        {url ? (
          <div className="flex gap-2">
            <Input
              className="font-mono text-xs"
              id="webhook-url"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={url}
            />
            <Button
              aria-label="Copiar URL"
              onClick={() => copy(url, "URL")}
              size="icon"
              type="button"
              variant="outline"
            >
              <CopyIcon />
            </Button>
          </div>
        ) : (
          <p className="text-flare text-sm">
            Falta NEXT_PUBLIC_API_URL en la configuración de la app.
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          Es secreta: quien la tenga puede crear clientes en tu estudio. Si se
          filtra, genera una nueva.
          {isLocal &&
            " Ahora apunta a tu ordenador (localhost): Make no podrá usarla hasta desplegar la API."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="webhook-board">Tablero de destino</Label>
          <Select
            onValueChange={(value) => {
              const id = Number(value);
              setBoardId(id);
              setStageId(
                boards.find((board) => board.id === id)?.stages[0]?.id ?? null
              );
            }}
            value={boardId ? String(boardId) : undefined}
          >
            <SelectTrigger className="w-full" id="webhook-board">
              <SelectValue placeholder="Elige un tablero" />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.id} value={String(board.id)}>
                  {board.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="webhook-stage">Etapa de entrada</Label>
          <Select
            disabled={stages.length === 0}
            onValueChange={(value) => setStageId(Number(value))}
            value={stageId ? String(stageId) : undefined}
          >
            <SelectTrigger className="w-full" id="webhook-stage">
              <SelectValue placeholder="Primera etapa" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage, index) => (
                <SelectItem key={stage.id} value={String(stage.id)}>
                  {String(index + 1).padStart(2, "0")} · {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        className="w-fit"
        disabled={pending}
        onClick={() =>
          run(
            () => updateWebhook({ enabled: webhook.enabled, boardId, stageId }),
            "Destino guardado"
          )
        }
        size="sm"
        variant="outline"
      >
        Guardar destino
      </Button>

      <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
        {webhook.lastReceivedAt
          ? `Último cliente recibido: ${dateTime.format(new Date(webhook.lastReceivedAt))}`
          : "Todavía no ha llegado ningún cliente"}
      </p>
      {webhook.lastError && (
        <p className="text-destructive text-sm">
          Último error: {webhook.lastError}
        </p>
      )}

      <MakeSteps />

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={pending} size="sm" variant="ghost">
              Generar URL nueva
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Generar una URL nueva?</AlertDialogTitle>
              <AlertDialogDescription>
                La actual deja de funcionar al momento. Tendrás que pegar la
                nueva en Make.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(regenerateWebhookToken, "URL nueva generada")
                }
              >
                Generar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={pending} size="sm" variant="ghost">
              Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Eliminar la entrada de clientes?
              </AlertDialogTitle>
              <AlertDialogDescription>
                La URL deja de funcionar. Los clientes ya recibidos se
                conservan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => run(deleteWebhook)}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
