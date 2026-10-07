"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ImagePlusIcon } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, useRef, useTransition } from "react";
import { toast } from "sonner";
import { removeCardCover, uploadCardCover } from "@/app/actions/cards";
import { compressImage } from "./compress-image";

interface CoverFieldProperties {
  readonly cardId: number;
  readonly coverUrl: string | null;
  readonly editable: boolean;
}

const kilobytes = (bytes: number) =>
  `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Card photo: compressed in the browser, shown as the card's thumbnail. */
export const CoverField = ({
  cardId,
  coverUrl,
  editable,
}: CoverFieldProperties) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const choose = () => inputRef.current?.click();

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    startTransition(async () => {
      let thumbnail: File;

      try {
        thumbnail = await compressImage(file);
      } catch {
        toast.error("No se pudo leer esa imagen. Prueba con un JPG o PNG.");
        return;
      }

      const data = new FormData();
      data.set("cover", thumbnail);
      const result = await uploadCardCover(cardId, data);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Foto añadida", {
        description: `${kilobytes(file.size)} → ${kilobytes(thumbnail.size)}`,
      });
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await removeCardCover(cardId);

      if ("error" in result) {
        toast.error(result.error);
      }
    });
  };

  if (!(coverUrl || editable)) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <span className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
        Foto
      </span>
      <input
        accept="image/*"
        className="hidden"
        onChange={upload}
        ref={inputRef}
        type="file"
      />
      {coverUrl ? (
        <div className="grid gap-2">
          <Image
            alt="Foto de la tarjeta"
            className="aspect-[16/9] w-full border object-cover"
            crossOrigin="anonymous"
            height={360}
            src={coverUrl}
            unoptimized
            width={640}
          />
          {editable && (
            <div className="flex gap-2">
              <Button
                disabled={pending}
                onClick={choose}
                size="sm"
                type="button"
                variant="outline"
              >
                {pending ? "Subiendo..." : "Cambiar"}
              </Button>
              <Button
                disabled={pending}
                onClick={remove}
                size="sm"
                type="button"
                variant="ghost"
              >
                Quitar
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 border border-dashed text-muted-foreground transition-colors hover:border-signal-ink/40 hover:text-signal-ink disabled:opacity-60"
          disabled={pending}
          onClick={choose}
          type="button"
        >
          <ImagePlusIcon className="size-6" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
            {pending ? "Comprimiendo y subiendo..." : "Añadir foto"}
          </span>
          <span className="text-xs">
            Se guarda una miniatura ligera para el tablero.
          </span>
        </button>
      )}
    </div>
  );
};
