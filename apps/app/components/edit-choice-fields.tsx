"use client";

import { Slider } from "@repo/design-system/components/ui/slider";
import { cn } from "@repo/design-system/lib/utils";
import {
  EDIT_LEVEL_LABELS,
  EDIT_LEVELS,
  EDIT_MODE_HINTS,
  EDIT_MODE_LABELS,
  EDIT_MODEL_HINTS,
  EDIT_MODEL_LABELS,
  EDIT_MODELS,
  EDIT_MODES,
  type EditChoice,
  type EditLevel,
  estimatedCost,
  formatCost,
} from "@/lib/editor";

const legend =
  "mb-2 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.16em]";

/** Buttons that work as one choice: the pressed one is the value. */
const Options = <T extends string>({
  hints,
  labels,
  onChange,
  options,
  title,
  value,
}: {
  readonly hints: Record<T, string>;
  readonly labels: Record<T, string>;
  readonly onChange: (value: T) => void;
  readonly options: readonly T[];
  readonly title: string;
  readonly value: T;
}) => (
  <fieldset>
    <legend className={legend}>{title}</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <button
          aria-pressed={option === value}
          className={cn(
            "grid gap-1 border px-3 py-2 text-left transition-colors",
            option === value
              ? "border-signal-ink bg-signal/10"
              : "hover:border-signal-ink/40 hover:bg-accent"
          )}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          <span className="font-bold font-mono text-xs uppercase tracking-[0.12em]">
            {labels[option]}
          </span>
          <span className="text-muted-foreground text-xs">{hints[option]}</span>
        </button>
      ))}
    </div>
  </fieldset>
);

const costLine = (choice: EditChoice) =>
  `Unos ${formatCost(estimatedCost(choice))} por foto`;

/**
 * How a photo is edited: mode, demand (a bar from 1 to 3) and, with one
 * model, which one. Shows what each photo costs with that choice.
 */
export const EditChoiceFields = ({
  idPrefix,
  onChange,
  value,
}: {
  readonly idPrefix: string;
  readonly onChange: (value: EditChoice) => void;
  readonly value: EditChoice;
}) => (
  <div className="grid gap-5">
    <Options
      hints={EDIT_MODE_HINTS}
      labels={EDIT_MODE_LABELS}
      onChange={(mode) => onChange({ ...value, mode })}
      options={EDIT_MODES}
      title="Qué se edita"
      value={value.mode}
    />

    <fieldset>
      <legend className={legend}>Exigencia</legend>
      <Slider
        aria-label="Exigencia"
        id={`${idPrefix}-level`}
        max={3}
        min={1}
        onValueChange={([level]) =>
          onChange({ ...value, level: (level ?? 1) as EditLevel })
        }
        step={1}
        value={[value.level]}
      />
      <ol className="mt-2 grid grid-cols-3 gap-2 text-xs">
        {EDIT_LEVELS.map((level) => (
          <li
            className={cn(
              "first:text-left last:text-right [&:nth-child(2)]:text-center",
              level === value.level
                ? "text-foreground"
                : "text-muted-foreground"
            )}
            key={level}
          >
            <span className="font-bold font-mono">{level}</span>{" "}
            {EDIT_LEVEL_LABELS[level]}
          </li>
        ))}
      </ol>
    </fieldset>

    {value.level === 1 ? (
      <Options
        hints={EDIT_MODEL_HINTS}
        labels={EDIT_MODEL_LABELS}
        onChange={(model) => onChange({ ...value, model })}
        options={EDIT_MODELS}
        title="Modelo"
        value={value.model}
      />
    ) : (
      <p className="text-muted-foreground text-xs">
        Trabajan los dos modelos ({EDIT_MODEL_LABELS.gpt} y{" "}
        {EDIT_MODEL_LABELS.nbpro}) y el revisor se queda con el mejor
        {value.level === 3 &&
          "; después, una segunda pasada sobre lo que aún vea mal"}
        .
      </p>
    )}

    <p className="font-mono text-[11px] uppercase tracking-[0.14em]">
      <span className="text-signal-ink">{costLine(value)}</span>
      {value.mode === "completa" && (
        <span className="text-muted-foreground">
          {" "}
          · tarda unos minutos por foto
        </span>
      )}
    </p>
  </div>
);
