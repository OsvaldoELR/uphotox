"use client";

import { Panel } from "@repo/design-system/components/hud/panel";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import {
  CircleCheckIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileUpIcon,
  KanbanIcon,
} from "lucide-react";
import Link from "next/link";
import {
  type DragEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { type ImportSummary, importClients } from "@/app/actions/clients";
import {
  batchRows,
  columnValues,
  type DayOrder,
  detectDayOrder,
  guessMapping,
  IMPORT_TEMPLATE,
  type ImportField,
  MAX_IMPORT_ROWS,
  normalizeText,
  prepareRows,
} from "@/lib/client-import";
import { type CsvTable, decodeCsv, parseCsv } from "@/lib/csv";
import { ColumnMapper } from "./column-mapper";
import { Destination, RowsPreview } from "./import-review";

export interface ImportBoard {
  readonly id: number;
  readonly name: string;
  readonly stages: { readonly id: number; readonly name: string }[];
}

interface LoadedFile {
  readonly name: string;
  readonly table: CsvTable;
}

const CSV_FILE = /\.(csv|txt)$/i;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Server actions accept ~1 MB per request; leave room for the envelope.
const BATCH_BYTES = 700_000;

const isBookedStage = (name: string) => normalizeText(name).includes("agendad");

const defaultBoard = (boards: ImportBoard[]) =>
  boards.find((board) =>
    board.stages.some((stage) => isBookedStage(stage.name))
  ) ?? boards[0];

const defaultStage = (board: ImportBoard | undefined) =>
  (board?.stages.find((stage) => isBookedStage(stage.name)) ?? board?.stages[0])
    ?.id ?? null;

const downloadTemplate = () => {
  // BOM so Excel opens the accents correctly.
  const blob = new Blob([`﻿${IMPORT_TEMPLATE}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-clientes-uphotox.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const Step = ({
  children,
  index,
  title,
}: {
  readonly children: ReactNode;
  readonly index: number;
  readonly title: string;
}) => (
  <section className="grid gap-4">
    <h2 className="flex items-center gap-3 font-bold font-mono text-xs uppercase tracking-[0.2em]">
      <span className="text-signal-ink">{String(index).padStart(2, "0")}</span>
      {title}
    </h2>
    {children}
  </section>
);

const mergeSummaries = (summaries: ImportSummary[]): ImportSummary => ({
  cardsCreated: summaries.reduce((sum, item) => sum + item.cardsCreated, 0),
  clientsCreated: summaries.reduce((sum, item) => sum + item.clientsCreated, 0),
  clientsMatched: summaries.reduce((sum, item) => sum + item.clientsMatched, 0),
  skippedLines: summaries.flatMap((item) => item.skippedLines),
});

interface ResultProperties {
  readonly board: ImportBoard | undefined;
  readonly onReset: () => void;
  readonly stageName: string;
  readonly summary: ImportSummary;
}

const Result = ({ board, onReset, stageName, summary }: ResultProperties) => (
  <Panel className="flex flex-col gap-5 border-signal-ink/30 p-6">
    <div className="flex items-center gap-3">
      <CircleCheckIcon className="size-6 text-signal-ink" />
      <p className="font-bold font-mono text-sm uppercase tracking-[0.18em]">
        Importación completada
      </p>
    </div>
    <ul className="grid gap-1.5 text-sm">
      <li>
        <strong className="tabular">{summary.cardsCreated}</strong>{" "}
        {summary.cardsCreated === 1 ? "tarjeta nueva" : "tarjetas nuevas"} en «
        {board?.name} › {stageName}».
      </li>
      <li>
        {summary.clientsCreated}{" "}
        {summary.clientsCreated === 1 ? "cliente nuevo" : "clientes nuevos"} ·{" "}
        {summary.clientsMatched === 1
          ? "1 ya estaba en Uphotox (mismo correo o teléfono) y se reutilizó."
          : `${summary.clientsMatched} ya estaban en Uphotox (mismo correo o teléfono) y se reutilizaron.`}
      </li>
      {summary.skippedLines.length > 0 && (
        <li className="text-muted-foreground">
          {summary.skippedLines.length} ya se habían importado antes y se
          omitieron (filas {summary.skippedLines.join(", ")}).
        </li>
      )}
      <li className="text-muted-foreground">
        No se envió ningún correo. Los avisos salen cuando muevas cada tarjeta a
        la siguiente etapa.
      </li>
    </ul>
    <div className="flex flex-wrap gap-2">
      {board && (
        <Button asChild>
          <Link href={`/tableros/${board.id}`}>
            <KanbanIcon />
            Ver el tablero
          </Link>
        </Button>
      )}
      <Button asChild variant="outline">
        <Link href="/clientes">Ver clientes</Link>
      </Button>
      <Button onClick={onReset} type="button" variant="ghost">
        Importar otro archivo
      </Button>
    </div>
  </Panel>
);

export const ClientImporter = ({
  boards,
}: {
  readonly boards: ImportBoard[];
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [orderOverride, setOrderOverride] = useState<DayOrder | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [boardId, setBoardId] = useState(defaultBoard(boards)?.id ?? null);
  const [stageId, setStageId] = useState(defaultStage(defaultBoard(boards)));
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  const board = boards.find((item) => item.id === boardId);
  const stageName =
    board?.stages.find((stage) => stage.id === stageId)?.name ?? "";

  const detectedOrder = useMemo(() => {
    if (!file) {
      return null;
    }

    const dates = mapping.flatMap((field, column) =>
      field === "sessionDate" ? columnValues(file.table, column) : []
    );
    return detectDayOrder(dates);
  }, [file, mapping]);
  const dayOrder = orderOverride ?? detectedOrder ?? "dmy";

  const rows = useMemo(
    () => (file ? prepareRows(file.table, mapping, { dayOrder, now }) : []),
    [file, mapping, dayOrder, now]
  );
  const importable = rows.flatMap((row) => (row.input ? [row.input] : []));

  const load = async (picked: File | undefined) => {
    if (!picked) {
      return;
    }

    if (!CSV_FILE.test(picked.name)) {
      toast.error("Elige un archivo .csv", {
        description: "En Google Sheets: Archivo → Descargar → CSV.",
      });
      return;
    }

    if (picked.size > MAX_FILE_BYTES) {
      toast.error("El archivo pesa más de 5 MB.");
      return;
    }

    const table = parseCsv(decodeCsv(await picked.arrayBuffer()));

    if (table.rows.length === 0) {
      toast.error("El archivo no tiene filas de clientes.");
      return;
    }

    if (table.rows.length > MAX_IMPORT_ROWS) {
      toast.error(`Máximo ${MAX_IMPORT_ROWS} filas por importación.`, {
        description: `Este archivo tiene ${table.rows.length}. Divídelo en varios.`,
      });
      return;
    }

    setFile({ name: picked.name, table });
    setMapping(guessMapping(table));
    setOrderOverride(null);
    setNow(new Date());
    setSummary(null);
  };

  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    load(event.dataTransfer.files[0]);
  };

  const changeBoard = (id: number) => {
    setBoardId(id);
    setStageId(defaultStage(boards.find((item) => item.id === id)));
  };

  const changeField = (column: number, field: ImportField) =>
    setMapping((current) =>
      current.map((value, index) => (index === column ? field : value))
    );

  const reset = () => {
    setFile(null);
    setMapping([]);
    setSummary(null);
  };

  const submit = () => {
    if (!(boardId && stageId) || importable.length === 0) {
      return;
    }

    startTransition(async () => {
      const done: ImportSummary[] = [];

      for (const batch of batchRows(importable, BATCH_BYTES)) {
        const result = await importClients({ boardId, stageId, rows: batch });

        if ("error" in result) {
          toast.error(result.error, {
            description: done.length
              ? "Una parte ya se importó. Pulsa Importar otra vez: lo ya importado se omite."
              : undefined,
          });
          return;
        }

        done.push(result.summary);
      }

      setSummary(mergeSummaries(done));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  if (boards.length === 0) {
    return (
      <Panel className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
        <KanbanIcon className="size-8 text-signal-ink/60" />
        <p className="font-bold font-mono text-xs uppercase tracking-[0.25em]">
          Primero crea un tablero
        </p>
        <p className="max-w-sm text-muted-foreground text-sm">
          Los clientes importados entran como tarjetas en una etapa de un
          tablero.
        </p>
        <Button asChild className="mt-2">
          <Link href="/tableros">Ir a Tableros</Link>
        </Button>
      </Panel>
    );
  }

  if (summary) {
    return (
      <Result
        board={board}
        onReset={reset}
        stageName={stageName}
        summary={summary}
      />
    );
  }

  return (
    <div className="grid max-w-5xl gap-10">
      <Step index={1} title="Archivo">
        <input
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            load(event.target.files?.[0]);
            event.target.value = "";
          }}
          ref={inputRef}
          tabIndex={-1}
          type="file"
        />
        {file ? (
          <div className="flex flex-wrap items-center gap-3 border bg-card px-4 py-3">
            <FileSpreadsheetIcon className="size-5 shrink-0 text-signal-ink" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-sm">{file.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                {file.table.rows.length} filas · {file.table.headers.length}{" "}
                columnas
              </span>
            </span>
            <Button
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              Cambiar archivo
            </Button>
          </div>
        ) : (
          <button
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 border border-dashed px-6 py-12 text-center transition-colors hover:border-signal-ink/40",
              dragging && "border-signal-ink bg-signal/10"
            )}
            onClick={() => inputRef.current?.click()}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDrop={drop}
            type="button"
          >
            <FileUpIcon className="size-8 text-signal-ink/70" />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Elige o arrastra el CSV
            </span>
            <span className="max-w-md text-muted-foreground text-xs">
              Desde Google Sheets: Archivo → Descargar → Valores separados por
              comas (.csv). Hasta {MAX_IMPORT_ROWS} filas.
            </span>
          </button>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-xs">
          <span>
            Solo es obligatorio el nombre del cliente. Conviene incluir
            teléfono, correo, niño/a, tipo de sesión, fecha y hora.
          </span>
          <Button
            className="h-auto p-0 text-xs"
            onClick={downloadTemplate}
            type="button"
            variant="link"
          >
            <DownloadIcon className="size-3.5" />
            Descargar plantilla
          </Button>
        </div>
      </Step>

      {file && (
        <>
          <Step index={2} title="Columnas">
            <p className="max-w-prose text-muted-foreground text-sm">
              Revisa qué es cada columna. Lo que marques como «Añadir a las
              notas» se guarda en la tarjeta como «Pregunta: respuesta».
            </p>
            <ColumnMapper
              dayOrder={dayOrder}
              detectedOrder={detectedOrder}
              mapping={mapping}
              onChange={changeField}
              onDayOrderChange={setOrderOverride}
              table={file.table}
            />
          </Step>

          <Step index={3} title="Revisión y destino">
            <Destination
              boardId={boardId}
              boards={boards}
              onBoardChange={changeBoard}
              onStageChange={setStageId}
              stageId={stageId}
            />
            <RowsPreview rows={rows} />
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
              <p className="max-w-prose text-muted-foreground text-xs">
                No se envía ningún correo a los clientes. Si alguien ya existe
                (mismo correo o teléfono) se reutiliza su ficha, y las filas
                importadas antes se omiten.
              </p>
              <Button
                disabled={pending || importable.length === 0 || !stageId}
                onClick={submit}
                size="lg"
                type="button"
              >
                {pending
                  ? "Importando..."
                  : `Importar ${importable.length} a «${stageName || "—"}»`}
              </Button>
            </div>
          </Step>
        </>
      )}
    </div>
  );
};
