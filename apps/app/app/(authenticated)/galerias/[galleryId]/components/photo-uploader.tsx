"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import { cn } from "@repo/design-system/lib/utils";
import { ImageUpIcon } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  confirmGalleryUploads,
  prepareGalleryUploads,
} from "@/app/actions/galleries";
import { isJpegName } from "@/lib/gallery";
import { mapLimit, type PreparedPhoto, preparePhoto } from "./prepare-photo";

/** Photos registered per server round trip. */
const CHUNK = 24;
/** Photos read in the browser at once (decoding is CPU-heavy). */
const DECODE_LIMIT = 3;
/** Parallel uploads to R2. */
const UPLOAD_LIMIT = 4;

interface UploadError {
  readonly name: string;
  readonly reason: string;
}

interface UploadProgress {
  readonly done: number;
  readonly total: number;
}

interface ChunkResult {
  readonly failed: UploadError[];
  readonly skipped: number;
  readonly uploaded: number;
}

const put = async (url: string, body: Blob) => {
  const response = await fetch(url, {
    method: "PUT",
    body,
    headers: { "content-type": "image/jpeg" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
};

/** JPGs not uploaded yet (once each), and what is left out and why. */
const sortSelection = (
  selected: readonly File[],
  uploadedNames: readonly string[]
) => {
  const known = new Set(uploadedNames);
  const files = new Map<string, File>();
  const failed: UploadError[] = [];
  let skipped = 0;

  for (const file of selected) {
    if (!isJpegName(file.name)) {
      failed.push({ name: file.name, reason: "No es una foto JPG" });
    } else if (known.has(file.name) || files.has(file.name)) {
      skipped += 1;
    } else {
      files.set(file.name, file);
    }
  }

  return { files: [...files.values()], failed, skipped };
};

/** Sends both files of each photo to R2 and returns the ids that arrived. */
const sendToStorage = async (
  targets: readonly {
    id: number;
    name: string;
    previewUrl: string;
    thumbnailUrl: string;
  }[],
  photos: readonly PreparedPhoto[],
  failed: UploadError[],
  advance: (count?: number) => void
) => {
  const byName = new Map(photos.map((photo) => [photo.name, photo]));
  const sent: number[] = [];

  await mapLimit(targets, UPLOAD_LIMIT, async (target) => {
    const photo = byName.get(target.name);

    try {
      if (!photo) {
        throw new Error("missing");
      }

      await Promise.all([
        put(target.previewUrl, photo.preview),
        put(target.thumbnailUrl, photo.thumbnail),
      ]);
      sent.push(target.id);
    } catch {
      failed.push({ name: target.name, reason: "No se pudo subir" });
    }

    advance();
  });

  return sent;
};

/** Reads, registers, uploads and confirms one chunk of photos. */
const uploadChunk = async (
  galleryId: number,
  chunk: readonly File[],
  advance: (count?: number) => void
): Promise<ChunkResult> => {
  const failed: UploadError[] = [];
  const prepared = (
    await mapLimit(chunk, DECODE_LIMIT, async (file) => {
      try {
        return await preparePhoto(file);
      } catch {
        failed.push({ name: file.name, reason: "No se pudo leer" });
        advance();
        return null;
      }
    })
  ).filter((photo): photo is PreparedPhoto => photo !== null);

  if (prepared.length === 0) {
    return { failed, skipped: 0, uploaded: 0 };
  }

  const registered = await prepareGalleryUploads(
    galleryId,
    prepared.map((photo) => ({
      name: photo.name,
      bytes: photo.preview.size,
      width: photo.width,
      height: photo.height,
    }))
  );

  if ("error" in registered) {
    advance(prepared.length);
    return {
      failed: [
        ...failed,
        ...prepared.map((photo) => ({
          name: photo.name,
          reason: registered.error,
        })),
      ],
      skipped: 0,
      uploaded: 0,
    };
  }

  advance(registered.skipped.length);
  const sent = await sendToStorage(
    registered.uploads,
    prepared,
    failed,
    advance
  );

  if (sent.length === 0) {
    return { failed, skipped: registered.skipped.length, uploaded: 0 };
  }

  const confirmed = await confirmGalleryUploads(galleryId, sent);

  if ("error" in confirmed) {
    failed.push({ name: `${sent.length} fotos`, reason: confirmed.error });
    return { failed, skipped: registered.skipped.length, uploaded: 0 };
  }

  const names = new Map(
    registered.uploads.map((target) => [target.id, target.name])
  );

  for (const photoId of confirmed.failed) {
    failed.push({
      name: names.get(photoId) ?? String(photoId),
      reason: "No llegó completa",
    });
  }

  return {
    failed,
    skipped: registered.skipped.length,
    uploaded: sent.length - confirmed.failed.length,
  };
};

const summary = (uploaded: number, skipped: number, failed: number) =>
  [
    uploaded > 0 && `${uploaded} ${uploaded === 1 ? "subida" : "subidas"}`,
    skipped > 0 && `${skipped} ${skipped === 1 ? "ya estaba" : "ya estaban"}`,
    failed > 0 && `${failed} con error`,
  ]
    .filter(Boolean)
    .join(" · ");

interface PhotoUploaderProperties {
  readonly galleryId: number;
  /** File names already uploaded: they are skipped. */
  readonly uploadedNames: readonly string[];
}

export const PhotoUploader = ({
  galleryId,
  uploadedNames,
}: PhotoUploaderProperties) => {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [errors, setErrors] = useState<UploadError[]>([]);
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
    const selection = sortSelection(selected, uploadedNames);
    const { files } = selection;
    const failed = [...selection.failed];
    let skipped = selection.skipped;
    let uploaded = 0;
    let done = 0;

    const advance = (count = 1) => {
      done += count;
      setProgress({ done, total: files.length });
    };

    setErrors([]);
    setProgress({ done, total: files.length });

    for (let index = 0; index < files.length; index += CHUNK) {
      const result = await uploadChunk(
        galleryId,
        files.slice(index, index + CHUNK),
        advance
      );
      failed.push(...result.failed);
      skipped += result.skipped;
      uploaded += result.uploaded;
    }

    setProgress(null);
    setErrors(failed);

    const message = summary(uploaded, skipped, failed.length);

    if (failed.length) {
      toast.error(message);
    } else if (message) {
      toast.success(message);
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
          Arrastra aquí las fotos
        </span>
        <span className="max-w-md text-muted-foreground text-sm">
          O pulsa para elegirlas. Los JPG exportados de Lightroom, con su nombre
          original; las que ya estén subidas se saltan.
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
            <span>Subiendo fotos…</span>
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
            No cierres esta página hasta que termine.
          </span>
        </output>
      )}

      {errors.length > 0 && (
        <div className="grid gap-2 border border-destructive/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-destructive uppercase tracking-[0.16em]">
              {errors.length} sin subir
            </span>
            <Button onClick={() => setErrors([])} size="sm" variant="ghost">
              Cerrar
            </Button>
          </div>
          <ul className="grid max-h-40 gap-1 overflow-y-auto text-sm">
            {errors.map((error) => (
              <li
                className="flex justify-between gap-3"
                key={`${error.name}·${error.reason}`}
              >
                <span className="truncate">{error.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {error.reason}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Vuelve a arrastrar esas fotos: las que ya subieron se saltan.
          </p>
        </div>
      )}
    </div>
  );
};
