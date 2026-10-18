"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import { DownloadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  type EditDownload,
  editDownloads,
  markEditDownloaded,
} from "@/app/actions/editor";
import { mapLimit } from "../../components/prepare-photo";

/** Photos saved at once (each one is ~5–20 MB). */
const SAVE_LIMIT = 2;

// File System Access API (Chrome, Edge): not in TypeScript's DOM types yet.
interface PickedFolder {
  getFileHandle(
    name: string,
    options: { create: boolean }
  ): Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;
}

type FolderPicker = (options: {
  id?: string;
  mode?: "read" | "readwrite";
}) => Promise<PickedFolder>;

const folderPicker = () =>
  (window as unknown as { showDirectoryPicker?: FolderPicker })
    .showDirectoryPicker;

/** Streams one photo into the chosen folder. */
const saveToFolder = async (folder: PickedFolder, file: EditDownload) => {
  const response = await fetch(file.url);

  if (!(response.ok && response.body)) {
    throw new Error(`HTTP ${response.status}`);
  }

  const handle = await folder.getFileHandle(file.name, { create: true });
  await response.body.pipeTo(await handle.createWritable());
};

/** Without folder access (Firefox, Safari): the browser's Downloads. */
const saveToDownloads = async (file: EditDownload) => {
  const response = await fetch(file.url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

interface DownloadPanelProperties {
  readonly approved: number;
  readonly downloaded: number;
  readonly galleryId: number;
}

export const DownloadPanel = ({
  approved,
  downloaded,
  galleryId,
}: DownloadPanelProperties) => {
  const router = useRouter();
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const save = async () => {
    const picker = folderPicker();
    let folder: PickedFolder | null = null;

    if (picker) {
      try {
        folder = await picker({ id: "uphotox-session", mode: "readwrite" });
      } catch {
        // Closed the folder dialog.
        return;
      }
    }

    const result = await editDownloads(galleryId);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const { files } = result;
    const saved: number[] = [];
    const failed: string[] = [];
    let done = 0;
    setProgress({ done, total: files.length });

    await mapLimit(files, folder ? SAVE_LIMIT : 1, async (file) => {
      try {
        await (folder ? saveToFolder(folder, file) : saveToDownloads(file));
        saved.push(file.id);
      } catch {
        failed.push(file.name);
      } finally {
        done += 1;
        setProgress({ done, total: files.length });
      }
    });

    if (saved.length) {
      await markEditDownloaded(galleryId, saved);
    }

    setProgress(null);
    router.refresh();

    if (failed.length) {
      toast.error(`No se pudieron guardar: ${failed.join(", ")}`);
    } else {
      toast.success(
        `${saved.length} ${saved.length === 1 ? "foto guardada" : "fotos guardadas"}`
      );
    }
  };

  return (
    <section className="grid gap-3 border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-prose gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
            {approved} {approved === 1 ? "aprobada" : "aprobadas"}
            {downloaded > 0 && ` · ${downloaded} ya descargadas`}
          </span>
          <p className="text-muted-foreground text-sm">
            Elige la <b>carpeta de la sesión</b> (donde están los RAF): se
            guardan al lado, como{" "}
            <span className="font-mono">DSCF7325-fondo.jpg</span>. Después, en
            Lightroom, clic derecho en esa carpeta →{" "}
            <em>Sincronizar carpeta…</em> → importar fotos nuevas.
          </p>
        </div>
        <Button disabled={approved === 0 || progress !== null} onClick={save}>
          <DownloadIcon className="size-4" />
          Descargar aprobadas
        </Button>
      </div>
      {progress && (
        <output className="grid gap-2">
          <span className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em]">
            <span>Guardando…</span>
            <span className="tabular-nums">
              {progress.done} / {progress.total}
            </span>
          </span>
          <Progress
            value={
              progress.total ? (progress.done / progress.total) * 100 : 100
            }
          />
        </output>
      )}
    </section>
  );
};
