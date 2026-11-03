"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { XIcon } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addBookFormat,
  removeBookFormat,
  setBookFormatBackCover,
  updateGallerySettings,
} from "@/app/actions/gallery-settings";
import { FULL_GALLERY_NOTE } from "@/lib/gallery";
import { soldSize } from "@/lib/gallery-products";

type Result = { ok: true } | { error: string };

const run = async (action: () => Promise<Result>, done: string) => {
  const result = await action();

  if ("error" in result) {
    toast.error(result.error);
    return false;
  }

  toast.success(done);
  return true;
};

const amount = (text: string) =>
  text.trim() === "" ? Number.NaN : Number(text.replace(",", "."));

export const GallerySettingsForm = ({
  extraPhotoPrice,
  fullGalleryNote,
  fullGalleryPrice,
}: {
  readonly extraPhotoPrice: number;
  readonly fullGalleryNote: string | null;
  /** Null when the studio does not offer the full unedited gallery. */
  readonly fullGalleryPrice: number | null;
}) => {
  const [pending, startTransition] = useTransition();
  const [extra, setExtra] = useState(String(extraPhotoPrice));
  const [offer, setOffer] = useState(fullGalleryPrice !== null);
  const [price, setPrice] = useState(
    fullGalleryPrice === null ? "" : String(fullGalleryPrice)
  );
  const [note, setNote] = useState(fullGalleryNote ?? "");

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      await run(
        () =>
          updateGallerySettings({
            extraPhotoPrice: amount(extra),
            fullGalleryPrice: offer ? amount(price) : null,
            fullGalleryNote: note,
          }),
        "Ajustes de galerías guardados"
      );
    });
  };

  return (
    <form className="grid gap-6" onSubmit={save}>
      <div className="grid gap-2">
        <Label htmlFor="extra-photo-price">Precio por foto extra</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">$</span>
          <Input
            className="w-28"
            id="extra-photo-price"
            inputMode="decimal"
            onChange={(event) => setExtra(event.target.value)}
            value={extra}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Lo que cuesta cada foto que el cliente elige por encima de su paquete.
          Se aplica a las galerías nuevas.
        </p>
      </div>

      <div className="grid gap-4 border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <Label htmlFor="full-gallery">
              Ofrecer la galería completa sin editar
            </Label>
            <p className="text-muted-foreground text-xs">
              Cuando el cliente confirma su selección, ve la oferta con un botón
              para pedirla por WhatsApp (y también en el correo de confirmación,
              si esa etapa avisa al cliente).
            </p>
          </div>
          <Switch
            checked={offer}
            id="full-gallery"
            onCheckedChange={setOffer}
          />
        </div>
        {offer ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="full-gallery-price">Precio</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">$</span>
                <Input
                  className="w-28"
                  id="full-gallery-price"
                  inputMode="decimal"
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="100"
                  value={price}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full-gallery-note">Qué incluye</Label>
              <Textarea
                className="min-h-20"
                id="full-gallery-note"
                maxLength={300}
                onChange={(event) => setNote(event.target.value)}
                placeholder={FULL_GALLERY_NOTE}
                value={note}
              />
              <p className="text-muted-foreground text-xs">
                Vacío = «{FULL_GALLERY_NOTE}»
              </p>
            </div>
          </>
        ) : null}
      </div>

      <Button className="justify-self-start" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
};

export interface BookFormatRow {
  readonly backCover: boolean;
  readonly id: number;
  readonly long: number;
  readonly short: number;
}

/**
 * The studio's book sizes and whether each has a back cover. Changes apply
 * at once, also to the galleries the client can still change.
 */
export const BookFormatsEditor = ({
  formats,
}: {
  readonly formats: readonly BookFormatRow[];
}) => {
  const [pending, startTransition] = useTransition();
  const [size, setSize] = useState("");
  const [backCover, setBackCover] = useState(true);

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      if (await run(() => addBookFormat(size, backCover), "Medida añadida")) {
        setSize("");
        setBackCover(true);
      }
    });
  };

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        El cliente elige la contraportada solo en los libros que la llevan. Las
        medidas que no estén en la lista llevan contraportada. Los cambios se
        aplican también a las galerías que el cliente aún no ha confirmado.
      </p>

      {formats.length > 0 ? (
        <ul className="grid gap-1.5">
          {formats.map((format) => (
            <li
              className="flex items-center justify-between gap-3 border bg-card py-1.5 pr-1 pl-3"
              key={format.id}
            >
              <span className="font-medium font-mono text-sm">
                Libro {soldSize(format)}
              </span>
              <div className="flex items-center gap-3">
                <Label
                  className="font-normal text-muted-foreground text-xs"
                  htmlFor={`back-cover-${format.id}`}
                >
                  Lleva contraportada
                </Label>
                <Switch
                  checked={format.backCover}
                  disabled={pending}
                  id={`back-cover-${format.id}`}
                  onCheckedChange={(checked) =>
                    startTransition(async () => {
                      await run(
                        () => setBookFormatBackCover(format.id, checked),
                        checked
                          ? `El libro ${soldSize(format)} lleva contraportada`
                          : `El libro ${soldSize(format)} va sin contraportada`
                      );
                    })
                  }
                />
                <Button
                  aria-label={`Quitar el libro ${soldSize(format)}`}
                  className="size-7"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await run(
                        () => removeBookFormat(format.id),
                        "Medida quitada"
                      );
                    })
                  }
                  size="icon"
                  variant="ghost"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="flex flex-wrap items-center gap-3" onSubmit={add}>
        <Input
          aria-label="Medida del libro"
          className="w-24"
          onChange={(event) => setSize(event.target.value)}
          placeholder="6x6"
          value={size}
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={backCover}
            id="new-back-cover"
            onCheckedChange={setBackCover}
          />
          <Label className="font-normal text-sm" htmlFor="new-back-cover">
            Lleva contraportada
          </Label>
        </div>
        <Button
          disabled={pending || size.trim() === ""}
          size="sm"
          type="submit"
          variant="outline"
        >
          Añadir medida
        </Button>
      </form>
    </div>
  );
};
