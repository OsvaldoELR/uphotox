"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import { cn } from "@repo/design-system/lib/utils";
import { ImageUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  confirmEditUploads,
  type PreparedOriginal,
  prepareEditUploads,
} from "@/app/actions/editor";
import {
  JPEG_HEADER_BYTES,
  jpegSize,
  MAX_ORIGINAL_BYTES,
  MIN_ORIGINAL_EDGE,
  matchOriginals,
} from "@/lib/editor";
import { mapLimit } from "../../components/prepare-photo";

/** Photos registered and queued per server round trip. */
const CHUNK = 10;
/** Parallel uploads to R2 (each one is ~20 MB). */
const UPLOAD_LIMIT = 3;
/** A cut upload is tried again this many times, after a short pause. */
const UPLOAD_RETRIES = 2;
const RETRY_PAUSE_MS = 3000;

export interface PickToClean {
  readonly fileName: string;
  /** Already sent to the service (in progress or finished). */
  readonly sent: boolean;
}

interface Problem {
  readonly name: string;
  readonly reason: string;
}

interface Summary {
  readonly missing: string[];
  readonly problems: Problem[];
  readonly queued: number;
  readonly skipped: number;
}

const pause = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

/** Uploads one file to its presigned URL, retrying cut connections. */
const put = async (url: string, file: File) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "content-type": "image/jpeg" },
      });

      if (response.ok) {
        return;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt >= UPLOAD_RETRIES) {
        throw error;
      }

      await pause(RETRY_PAUSE_MS * (attempt + 1));
    }
  }
};

/** Long edge of a JPEG in pixels, read from its header (null if unknown). */
const longEdge = async (file: File) => {
  const header = new Uint8Array(
    await file.slice(0, JPEG_HEADER_BYTES).arrayBuffer()
  );
  const size = jpegSize(header);
  return size ? Math.max(size.width, size.height) : null;
};

/** Full-size exports only: a small copy (the gallery's) would be cleaned small. */
const keepFullSize = async (files: readonly File[], problems: Problem[]) => {
  const edges = await Promise.all(files.map(longEdge));

  return files.filter((file, index) => {
    const edge = edges[index];

    if (edge !== null && edge !== undefined && edge < MIN_ORIGINAL_EDGE) {
      problems.push({
        name: file.name,
        reason: `Es una copia pequeña (${edge} px): expórtala a tamaño completo`,
      });
      return false;
    }

    return true;
  });
};

/** Uploads one chunk to R2 and queues what arrived. */
const sendChunk = async (
  galleryId: number,
  chunk: readonly File[],
  problems: Problem[],
  advance: (count?: number) => void
) => {
  const prepared = await prepareEditUploads(
    galleryId,
    chunk.map((file) => ({ name: file.name, bytes: file.size }))
  );

  if ("error" in prepared) {
    for (const file of chunk) {
      problems.push({ name: file.name, reason: prepared.error });
      advance();
    }

    return { queued: 0, skipped: 0 };
  }

  for (const name of prepared.rejected) {
    problems.push({ name, reason: "No es una foto elegida" });
    advance();
  }

  // Already in storage from an earlier try: straight to the queue.
  advance(prepared.skipped.length + prepared.ready.length);

  const byName = new Map(chunk.map((file) => [file.name, file]));
  const sent = (
    await mapLimit(
      prepared.uploads,
      UPLOAD_LIMIT,
      async (target: PreparedOriginal) => {
        const file = byName.get(target.name);

        try {
          if (!file) {
            throw new Error("missing");
          }

          await put(target.uploadUrl, file);
          return target.id;
        } catch {
          problems.push({ name: target.name, reason: "No se pudo subir" });
          return null;
        } finally {
          advance();
        }
      }
    )
  ).filter((value): value is number => value !== null);
  sent.push(...prepared.ready.map((target) => target.id));

  if (sent.length === 0) {
    return { queued: 0, skipped: prepared.skipped.length };
  }

  const confirmed = await confirmEditUploads(galleryId, sent);

  if ("error" in confirmed) {
    problems.push({ name: `${sent.length} fotos`, reason: confirmed.error });
    return { queued: 0, skipped: prepared.skipped.length };
  }

  const names = new Map(
    [...prepared.uploads, ...prepared.ready].map((target) => [
      target.id,
      target.name,
    ])
  );

  for (const photo of confirmed.failed) {
    problems.push({
      name: names.get(photo.id) ?? String(photo.id),
      reason: photo.reason,
    });
  }

  return {
    queued: sent.length - confirmed.failed.length,
    skipped: prepared.skipped.length,
  };
};

interface OriginalUploaderProperties {
  readonly galleryId: number;
  readonly picks: readonly PickToClean[];
}

export const OriginalUploader = ({
  galleryId,
  picks,
}: OriginalUploaderProperties) => {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dragging, setDragging] = useState(false);
  const working = progress !== null;

  // Leaving the page would cut the uploads in progress.
  useEffect(() => {
    if (!working) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [working]);

  const upload = async (selected: File[]) => {
    const match = matchOriginals(picks, selected);
    // Exports of picks already sent are skipped, not an error.
    const toSend = match.pairs.filter((pair) => !pair.photo.sent);
    const problems: Problem[] = [
      ...match.notJpeg.map((file) => ({
        name: file.name,
        reason: "No es una foto JPG",
      })),
      ...match.notPicked.map((file) => ({
        name: file.name,
        reason: "No es una foto elegida",
      })),
      ...toSend
        .filter((pair) => pair.file.size > MAX_ORIGINAL_BYTES)
        .map((pair) => ({ name: pair.file.name, reason: "Pesa más de 80 MB" })),
    ];
    setSummary(null);
    const files = await keepFullSize(
      toSend
        .map((pair) => pair.file)
        .filter((file) => file.size <= MAX_ORIGINAL_BYTES),
      problems
    );
    let done = 0;
    let queued = 0;
    let skipped = match.pairs.length - toSend.length;

    const advance = (count = 1) => {
      done += count;
      setProgress({ done, total: files.length });
    };

    setProgress({ done, total: files.length });

    for (let index = 0; index < files.length; index += CHUNK) {
      const result = await sendChunk(
        galleryId,
        files.slice(index, index + CHUNK),
        problems,
        advance
      );
      queued += result.queued;
      skipped += result.skipped;
      router.refresh();
    }

    setProgress(null);
    setSummary({
      queued,
      skipped,
      problems,
      missing: match.missing
        .filter((pick) => !pick.sent)
        .map((pick) => pick.fileName),
    });

    if (queued > 0) {
      toast.success(
        `${queued} ${queued === 1 ? "foto enviada" : "fotos enviadas"} al editor`
      );
    } else if (problems.length) {
      toast.error("No se envió ninguna foto");
    }
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";

    if (files.length) {
      upload(files);
    }
  };

  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);

    if (!working) {
      upload([...event.dataTransfer.files]);
    }
  };

  return (
    <div className="grid gap-3">
      <button
        className={cn(
          "flex flex-col items-center gap-2 border border-dashed bg-card px-6 py-10 text-center transition-colors",
          dragging
            ? "border-signal-ink bg-signal/10"
            : "hover:border-signal-ink/50 hover:bg-accent",
          working && "pointer-events-none opacity-60"
        )}
        disabled={working}
        onClick={() => input.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={drop}
        type="button"
      >
        <ImageUpIcon className="size-7 text-signal-ink/70" />
        <span className="font-bold font-mono text-xs uppercase tracking-[0.2em]">
          Arrastra aquí las elegidas a tamaño completo
        </span>
        <span className="max-w-md text-muted-foreground text-sm">
          Expórtalas de Lightroom en JPEG (calidad 95, sRGB) con su nombre
          original. Uphotox las empareja con la selección del cliente; las que
          ya se enviaron se saltan.
        </span>
      </button>
      <input
        accept="image/jpeg"
        className="hidden"
        multiple
        onChange={pick}
        ref={input}
        type="file"
      />

      {progress && (
        <output className="grid gap-2">
          <span className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em]">
            <span>Subiendo originales…</span>
            <span className="tabular-nums">
              {progress.done} / {progress.total}
            </span>
          </span>
          <Progress
            value={
              progress.total ? (progress.done / progress.total) * 100 : 100
            }
          />
          <span className="text-muted-foreground text-xs">
            No cierres esta página hasta que termine de subir. Después la
            limpieza sigue sola en la nube.
          </span>
        </output>
      )}

      {summary && (
        <div className="grid gap-2 border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
              {[
                `${summary.queued} enviadas`,
                summary.skipped > 0 && `${summary.skipped} ya estaban`,
                summary.problems.length > 0 &&
                  `${summary.problems.length} con problemas`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <Button onClick={() => setSummary(null)} size="sm" variant="ghost">
              Cerrar
            </Button>
          </div>
          {summary.missing.length > 0 && (
            <p className="text-muted-foreground">
              Faltan por subir {summary.missing.length}:{" "}
              <span className="font-mono text-xs">
                {summary.missing.join(", ")}
              </span>
            </p>
          )}
          {summary.problems.length > 0 && (
            <ul className="grid max-h-40 gap-1 overflow-y-auto">
              {summary.problems.map((problem) => (
                <li
                  className="flex justify-between gap-3"
                  key={`${problem.name}·${problem.reason}`}
                >
                  <span className="truncate">{problem.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {problem.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
