"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { cn } from "@repo/design-system/lib/utils";
import { TriangleAlertIcon } from "lucide-react";
import {
  cleanHeader,
  columnValues,
  type DayOrder,
  IMPORT_FIELD_KEYS,
  IMPORT_FIELDS,
  type ImportField,
} from "@/lib/client-import";
import type { CsvTable } from "@/lib/csv";

const SAMPLE_COUNT = 3;
const SAMPLE_LENGTH = 40;

const ORDERS: { id: DayOrder; label: string; example: string }[] = [
  { id: "dmy", label: "Día / mes / año", example: "15/11/2026" },
  { id: "mdy", label: "Mes / día / año", example: "11/15/2026" },
];

const samples = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .slice(0, SAMPLE_COUNT)
    .map((value) =>
      value.length > SAMPLE_LENGTH
        ? `${value.slice(0, SAMPLE_LENGTH - 1)}…`
        : value
    );

const isKeyField = (field: ImportField) =>
  field !== "notes" && field !== "ignore";

interface ColumnMapperProperties {
  readonly dayOrder: DayOrder;
  readonly detectedOrder: DayOrder | null;
  readonly mapping: ImportField[];
  readonly onChange: (column: number, field: ImportField) => void;
  readonly onDayOrderChange: (order: DayOrder) => void;
  readonly table: CsvTable;
}

const DayOrderPicker = ({
  dayOrder,
  detectedOrder,
  onDayOrderChange,
}: Pick<
  ColumnMapperProperties,
  "dayOrder" | "detectedOrder" | "onDayOrderChange"
>) => (
  <div className="grid gap-2 border p-3">
    <span className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
      Formato de las fechas
    </span>
    <div className="flex flex-wrap gap-2">
      {ORDERS.map((order) => (
        <button
          aria-pressed={dayOrder === order.id}
          className={cn(
            "flex items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
            dayOrder === order.id
              ? "border-signal-ink/60 bg-signal/15 text-foreground"
              : "bg-secondary/80 text-muted-foreground hover:text-foreground"
          )}
          key={order.id}
          onClick={() => onDayOrderChange(order.id)}
          type="button"
        >
          {order.label}
          <span className="text-signal-ink">{order.example}</span>
        </button>
      ))}
    </div>
    <p className="text-muted-foreground text-xs">
      {detectedOrder
        ? `Detectado en el archivo: ${detectedOrder === "dmy" ? "día primero" : "mes primero"}.`
        : "El archivo no permite saberlo (ningún día pasa de 12): revisa las fechas en la vista previa."}
    </p>
  </div>
);

export const ColumnMapper = ({
  dayOrder,
  detectedOrder,
  mapping,
  onChange,
  onDayOrderChange,
  table,
}: ColumnMapperProperties) => {
  const columns = table.headers
    .map((header, column) => ({
      column,
      header: cleanHeader(header),
      samples: samples(columnValues(table, column)),
    }))
    .filter((entry) => entry.samples.length > 0);
  const hiddenCount = table.headers.length - columns.length;
  const hasName = mapping.includes("clientName");

  return (
    <div className="grid gap-4">
      {!hasName && (
        <p className="flex items-start gap-2 border border-flare/40 bg-flare/5 p-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-flare" />
          Indica qué columna tiene el nombre del cliente: es lo único
          obligatorio.
        </p>
      )}

      {mapping.includes("sessionDate") && (
        <DayOrderPicker
          dayOrder={dayOrder}
          detectedOrder={detectedOrder}
          onDayOrderChange={onDayOrderChange}
        />
      )}

      <ul className="divide-y border bg-card">
        {columns.map((entry) => {
          const field = mapping[entry.column] ?? "ignore";
          return (
            <li
              className={cn(
                "grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center sm:gap-4",
                isKeyField(field) && "shadow-[inset_2px_0_0_var(--signal-ink)]"
              )}
              key={entry.column}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium text-sm">
                  {entry.header}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {entry.samples.join(" · ")}
                </span>
              </div>
              <Select
                onValueChange={(value) =>
                  onChange(entry.column, value as ImportField)
                }
                value={field}
              >
                <SelectTrigger
                  aria-label={`Qué contiene «${entry.header}»`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_FIELD_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {IMPORT_FIELDS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
          {hiddenCount}{" "}
          {hiddenCount === 1 ? "columna vacía" : "columnas vacías"} no se
          muestran
        </p>
      )}
    </div>
  );
};
