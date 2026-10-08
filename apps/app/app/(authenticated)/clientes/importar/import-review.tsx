"use client";

import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { cn } from "@repo/design-system/lib/utils";
import { useState } from "react";
import type { PreparedRow, RowStatus } from "@/lib/client-import";
import { formatSessionDate } from "@/lib/session-date";
import type { ImportBoard } from "./client-importer";

type Filter = "all" | "warning" | "skip";

const STATUS: Record<RowStatus, { label: string; className: string }> = {
  ready: { label: "Lista", className: "border-signal-ink/40 text-signal-ink" },
  warning: { label: "Revisar", className: "border-flare/40 text-flare" },
  skip: { label: "Se omite", className: "text-muted-foreground" },
};

const chip =
  "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors";

interface DestinationProperties {
  readonly boardId: number | null;
  readonly boards: ImportBoard[];
  readonly onBoardChange: (boardId: number) => void;
  readonly onStageChange: (stageId: number) => void;
  readonly stageId: number | null;
}

export const Destination = ({
  boardId,
  boards,
  onBoardChange,
  onStageChange,
  stageId,
}: DestinationProperties) => {
  const stages = boards.find((board) => board.id === boardId)?.stages ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="import-board">Tablero</Label>
        <Select
          onValueChange={(value) => onBoardChange(Number(value))}
          value={boardId ? String(boardId) : undefined}
        >
          <SelectTrigger className="w-full" id="import-board">
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
        <Label htmlFor="import-stage">Etapa</Label>
        <Select
          disabled={stages.length === 0}
          onValueChange={(value) => onStageChange(Number(value))}
          value={stageId ? String(stageId) : undefined}
        >
          <SelectTrigger className="w-full" id="import-stage">
            <SelectValue placeholder="Ese tablero no tiene etapas" />
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
  );
};

const RowItem = ({ row }: { readonly row: PreparedRow }) => (
  <li className="grid gap-1 px-4 py-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_13rem_5.5rem] sm:items-start sm:gap-3">
    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] sm:pt-0.5">
      Fila {row.line}
    </span>
    <span className="flex min-w-0 flex-col">
      <span
        className={cn(
          "truncate font-medium text-sm",
          row.status === "skip" && "text-muted-foreground line-through"
        )}
      >
        {row.title}
      </span>
      <span className="truncate text-muted-foreground text-xs">
        {[row.clientName, row.contact].filter(Boolean).join(" · ")}
      </span>
      {row.issues.length > 0 && (
        <ul className="mt-1 grid gap-0.5">
          {row.issues.map((issue) => (
            <li
              className={cn(
                "text-xs",
                row.status === "skip" ? "text-destructive" : "text-flare"
              )}
              key={issue}
            >
              {issue}
            </li>
          ))}
        </ul>
      )}
    </span>
    <span className="font-mono text-[10px] uppercase tracking-[0.12em] sm:pt-0.5">
      {row.sessionAt ? formatSessionDate(row.sessionAt) : "Sin fecha"}
    </span>
    <span
      className={cn(
        "w-fit border px-2 py-0.5 font-bold font-mono text-[10px] uppercase tracking-[0.14em]",
        STATUS[row.status].className
      )}
    >
      {STATUS[row.status].label}
    </span>
  </li>
);

export const RowsPreview = ({ rows }: { readonly rows: PreparedRow[] }) => {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = {
    all: rows.length,
    warning: rows.filter((row) => row.status === "warning").length,
    skip: rows.filter((row) => row.status === "skip").length,
  };
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: `Todas · ${counts.all}` },
    { id: "warning", label: `Revisar · ${counts.warning}` },
    { id: "skip", label: `Se omiten · ${counts.skip}` },
  ];
  const visible =
    filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((option) => (
          <button
            aria-pressed={filter === option.id}
            className={cn(
              chip,
              filter === option.id
                ? "border-signal-ink/60 bg-signal/15 text-foreground"
                : "bg-secondary/80 text-muted-foreground hover:text-foreground"
            )}
            key={option.id}
            onClick={() => setFilter(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {visible.length > 0 ? (
        <ul className="max-h-[36rem] divide-y overflow-y-auto border bg-card">
          {visible.map((row) => (
            <RowItem key={row.line} row={row} />
          ))}
        </ul>
      ) : (
        <p className="border bg-card px-4 py-6 text-center text-muted-foreground text-sm">
          Ninguna fila en este grupo.
        </p>
      )}
    </div>
  );
};
