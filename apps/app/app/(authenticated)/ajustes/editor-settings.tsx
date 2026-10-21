"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type EditorSettings,
  updateEditorSettings,
} from "@/app/actions/editor";
import { EditChoiceFields } from "@/components/edit-choice-fields";
import { formatCost } from "@/lib/editor";

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

export const EditorSettingsForm = ({
  platformLimit,
  settings,
}: {
  /** Monthly AI cap set by Uphotox (USD), or null when there is none. */
  readonly platformLimit: number | null;
  readonly settings: EditorSettings;
}) => {
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState(settings.choice);
  const [helpers, setHelpers] = useState(settings.helpers);
  const [framing, setFraming] = useState(settings.framing);
  const [limit, setLimit] = useState(
    settings.monthlyLimit === null ? "" : String(settings.monthlyLimit)
  );
  const [keepDays, setKeepDays] = useState(String(settings.keepDays));

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateEditorSettings({
        choice,
        helpers,
        framing,
        monthlyLimit: limit.trim() === "" ? null : Number(limit),
        keepDays: Number(keepDays),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Ajustes del editor guardados");
    });
  };

  return (
    <form className="grid gap-6" onSubmit={save}>
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs">
          Lo que viene marcado al subir fotos; se puede cambiar en cada envío y
          al rehacer una foto.
        </p>
        <EditChoiceFields
          idPrefix="editor-default"
          onChange={setChoice}
          value={choice}
        />
      </div>
      <Toggle
        checked={helpers}
        description="La mano o el brazo de quien sujeta al niño (cuando el resto de esa persona no sale en la foto). Las caras nunca se tocan."
        id="editor-helpers"
        label="Quitar manos de ayuda"
        onChange={setHelpers}
      />
      <Toggle
        checked={framing}
        description="Endereza con las líneas del fondo y recorta como sueles hacerlo (sobre todo arriba, sin cortar cabezas ni brazos). Se descarga la versión encuadrada; la otra también se guarda."
        id="editor-framing"
        label="Enderezar y encuadrar"
        onChange={setFraming}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="editor-limit">Límite de gasto al mes (USD)</Label>
          <Input
            id="editor-limit"
            inputMode="decimal"
            min={0}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="Sin límite"
            step="1"
            type="number"
            value={limit}
          />
          <p className="text-muted-foreground text-xs">
            Aviso al 80 %; al llegar, no se envían más fotos hasta el mes
            siguiente o hasta subirlo. Vacío = sin límite.
          </p>
          {platformLimit !== null && (
            <p className="text-flare text-xs">
              Tu plan incluye hasta {formatCost(platformLimit)} al mes: si pones
              más (o lo dejas vacío), se aplica ese tope.
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="editor-keep">Días que se guardan las fotos</Label>
          <Input
            id="editor-keep"
            inputMode="numeric"
            max={365}
            min={7}
            onChange={(event) => setKeepDays(event.target.value)}
            type="number"
            value={keepDays}
          />
          <p className="text-muted-foreground text-xs">
            Originales y fotos limpias se borran de la nube pasados estos días
            (descárgalas antes). Lo gastado se sigue viendo en el consumo.
          </p>
        </div>
      </div>
      <div>
        <Button disabled={pending} type="submit">
          Guardar
        </Button>
      </div>
    </form>
  );
};
