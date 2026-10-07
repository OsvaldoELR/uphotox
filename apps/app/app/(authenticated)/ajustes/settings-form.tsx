"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { ExternalLinkIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type StudioFormState,
  updateStudioSettings,
} from "@/app/actions/studio";
import { normalizeWhatsapp, whatsappUrl } from "@/lib/whatsapp";

interface SettingsFormProperties {
  readonly name: string;
  /** "+34612345678" or "" when not set. */
  readonly whatsapp: string;
}

export const SettingsForm = ({ name, whatsapp }: SettingsFormProperties) => {
  const [state, formAction, pending] = useActionState<
    StudioFormState,
    FormData
  >(updateStudioSettings, { name, whatsapp });
  const savedDigits = state.saved
    ? normalizeWhatsapp(state.whatsapp ?? "")
    : normalizeWhatsapp(whatsapp);

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="studio-name">Nombre del estudio</Label>
        <Input
          defaultValue={state.name}
          id="studio-name"
          maxLength={120}
          name="name"
          required
        />
        <p className="text-muted-foreground text-xs">
          Aparece como remitente y encabezado de los correos a tus clientes.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="studio-whatsapp">WhatsApp del estudio</Label>
        <Input
          autoComplete="tel"
          defaultValue={state.whatsapp}
          id="studio-whatsapp"
          inputMode="tel"
          maxLength={24}
          name="whatsapp"
          placeholder="+34 612 345 678"
          type="tel"
        />
        <p className="text-muted-foreground text-xs">
          Con código de país. Cada aviso al cliente incluye un botón «Escribir
          por WhatsApp» con un mensaje ya escrito. Déjalo vacío para no
          mostrarlo.
        </p>
        {savedDigits && (
          <a
            className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] text-signal-ink uppercase tracking-[0.14em] underline-offset-4 hover:underline"
            href={whatsappUrl(savedDigits)}
            rel="noopener noreferrer"
            target="_blank"
          >
            Probar enlace
            <ExternalLinkIcon className="size-3" />
          </a>
        )}
      </div>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <output className="text-signal-ink text-sm">Ajustes guardados.</output>
      )}
      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
};
