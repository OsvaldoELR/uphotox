"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useActionState } from "react";
import { createStudio, type StudioFormState } from "@/app/actions/studio";

export const OnboardingForm = () => {
  const [state, formAction, pending] = useActionState<
    StudioFormState,
    FormData
  >(createStudio, {});

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nombre del estudio</Label>
        <Input
          autoComplete="organization"
          autoFocus
          defaultValue={state.name}
          id="name"
          maxLength={120}
          name="name"
          placeholder="Ej.: Estudio Luz"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="whatsapp">WhatsApp del estudio (opcional)</Label>
        <Input
          autoComplete="tel"
          defaultValue={state.whatsapp}
          id="whatsapp"
          inputMode="tel"
          maxLength={24}
          name="whatsapp"
          placeholder="+34 612 345 678"
          type="tel"
        />
        <p className="text-muted-foreground text-xs">
          Con código de país. Tus clientes verán un botón para escribirte por
          WhatsApp en cada aviso.
        </p>
      </div>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      <Button disabled={pending} type="submit">
        {pending ? "Preparando tu estudio..." : "Crear estudio"}
      </Button>
      <p className="text-muted-foreground text-sm">
        Te dejamos listo un tablero «Sesiones» con el flujo completo: de la
        reserva a la entrega.
      </p>
    </form>
  );
};
