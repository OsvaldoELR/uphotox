"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateStudioAccess } from "@/app/admin/actions";
import { formatCost } from "@/lib/editor";
import { MODULES, type Module } from "@/lib/permissions";

export interface StudioAccess {
  readonly aiLimit: number | null;
  readonly modules: Module[];
  readonly paused: boolean;
  readonly reason: string;
}

const Toggle = ({
  checked,
  description,
  id,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
    <Switch checked={checked} id={id} onCheckedChange={onChange} />
  </div>
);

const sameAccess = (a: StudioAccess, b: StudioAccess) =>
  a.aiLimit === b.aiLimit &&
  a.paused === b.paused &&
  a.reason.trim() === b.reason.trim() &&
  a.modules.join() === b.modules.join();

/** Platform panel: what one studio has access to. */
export const AccessForm = ({
  access,
  monthUsed,
  studioId,
}: {
  readonly access: StudioAccess;
  /** AI spent this month, to set the cap against. */
  readonly monthUsed: number;
  readonly studioId: number;
}) => {
  const [pending, startTransition] = useTransition();
  const [modules, setModules] = useState<Module[]>(access.modules);
  const [limit, setLimit] = useState(
    access.aiLimit === null ? "" : String(access.aiLimit)
  );
  const [paused, setPaused] = useState(access.paused);
  const [reason, setReason] = useState(access.reason);

  const aiLimit = limit.trim() === "" ? null : Number(limit);
  const draft: StudioAccess = {
    modules: MODULES.map((module) => module.key).filter((key) =>
      modules.includes(key)
    ),
    aiLimit,
    paused,
    reason: paused ? reason : "",
  };
  const changed = !sameAccess(draft, {
    ...access,
    reason: access.paused ? access.reason : "",
  });
  const pausing = paused && !access.paused;

  const toggleModule = (key: Module, on: boolean) =>
    setModules((current) =>
      on ? [...current, key] : current.filter((module) => module !== key)
    );

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (aiLimit !== null && !(aiLimit >= 0)) {
      toast.error("El tope tiene que ser un número igual o mayor que 0.");
      return;
    }

    startTransition(async () => {
      const result = await updateStudioAccess({ studioId, ...draft });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(pausing ? "Estudio pausado" : "Acceso guardado");
    });
  };

  return (
    <form className="grid gap-6 border bg-card p-5" onSubmit={save}>
      <div className="grid gap-4">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
          Módulos
        </p>
        {MODULES.map((module) => (
          <Toggle
            checked={modules.includes(module.key)}
            description={module.description}
            id={`module-${module.key}`}
            key={module.key}
            label={module.label}
            onChange={(on) => toggleModule(module.key, on)}
          />
        ))}
        <p className="text-muted-foreground text-xs">
          Apagado: desaparece del menú y la base de datos lo bloquea. Lo que ya
          tenía se guarda y vuelve al activarlo. Si se apagan las Galerías, sus
          clientes tampoco pueden abrir su enlace.
        </p>
      </div>

      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="ai-limit">Tope de IA al mes (USD)</Label>
        <Input
          id="ai-limit"
          inputMode="decimal"
          min={0}
          onChange={(event) => setLimit(event.target.value)}
          placeholder="Sin tope"
          step="1"
          type="number"
          value={limit}
        />
        <p className="text-muted-foreground text-xs">
          Este mes lleva {formatCost(monthUsed)}. El estudio puede ponerse un
          límite más bajo en Ajustes, nunca uno más alto. Vacío = sin tope.
        </p>
      </div>

      <div
        className={cn(
          "grid gap-3 border p-4",
          paused ? "border-flare/40 bg-flare/10" : "border-dashed"
        )}
      >
        <Toggle
          checked={paused}
          description="Nadie del equipo puede entrar, sus clientes no pueden abrir las galerías y el formulario de reservas deja de crear tarjetas. No se borra nada."
          id="studio-paused"
          label="Pausar el estudio"
          onChange={setPaused}
        />
        {paused && (
          <div className="grid gap-2">
            <Label htmlFor="pause-reason">Mensaje para el estudio</Label>
            <Textarea
              id="pause-reason"
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Opcional. Ej.: Tu prueba terminó. Escríbenos a … para seguir."
              rows={2}
              value={reason}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button disabled={!changed || pending} type="submit">
          {pausing ? "Guardar y pausar" : "Guardar cambios"}
        </Button>
        {changed && !pending && (
          <span className="text-muted-foreground text-xs">
            Cambios sin guardar
          </span>
        )}
      </div>
    </form>
  );
};
