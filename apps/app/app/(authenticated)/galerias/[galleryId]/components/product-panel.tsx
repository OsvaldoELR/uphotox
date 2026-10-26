"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import { CopyIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addGalleryProduct,
  addProductsFromNotes,
  removeGalleryProduct,
} from "@/app/actions/galleries";
import { baseName, lightroomFilter } from "@/lib/gallery";
import {
  type ChoicePhoto,
  choiceSummary,
  MAX_GALLERY_PRODUCTS,
  missingChoices,
  PRODUCT_KINDS,
  type ProductChoice,
  type ProductKind,
  type ProductSpec,
  productName,
} from "@/lib/gallery-products";
import type { GalleryPhotoItem } from "./photo-grid";

const sectionLabel =
  "font-bold font-mono text-sm uppercase tracking-[0.12em] flex items-baseline gap-2";

const tab =
  "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors";

const copy = async (text: string, done: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.");
  }
};

/**
 * Package products in the «Paquete» column: what the client will decide
 * (book covers, canvas photo). Read from the card notes when the gallery was
 * created; the studio corrects it here.
 */
export const ProductsEditor = ({
  galleryId,
  products,
  suggestions,
}: {
  readonly galleryId: number;
  readonly products: readonly ProductChoice[];
  /** In the card notes but not added yet. */
  readonly suggestions: readonly ProductSpec[];
}) => {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<ProductKind>("book");
  const [size, setSize] = useState("");
  const full = products.length >= MAX_GALLERY_PRODUCTS;

  const run = (
    action: () => Promise<{ ok: true } | { error: string }>,
    done: string,
    after?: () => void
  ) => {
    startTransition(async () => {
      const result = await action();

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(done);
      after?.();
    });
  };

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(
      () => addGalleryProduct({ galleryId, kind, size }),
      `${PRODUCT_KINDS[kind]} añadido`,
      () => setSize("")
    );
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label>Libro y canvas del paquete</Label>
        <p className="text-muted-foreground text-xs">
          El cliente elige entre sus favoritas la portada y la contraportada de
          cada libro y la foto de cada canvas antes de confirmar.
        </p>
      </div>

      {products.length > 0 ? (
        <ul className="grid gap-1.5">
          {products.map((product) => (
            <li
              className="flex items-center justify-between gap-2 border bg-card py-1 pr-1 pl-3"
              key={product.id}
            >
              <span className="font-medium text-sm">
                {productName(product)}
              </span>
              <Button
                aria-label={`Quitar ${productName(product)}`}
                className="size-7"
                disabled={pending}
                onClick={() =>
                  run(
                    () => removeGalleryProduct(galleryId, product.id),
                    `${productName(product)} quitado`
                  )
                }
                size="icon"
                variant="ghost"
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Este paquete no lleva libro ni canvas.
        </p>
      )}

      {suggestions.length > 0 && !full ? (
        <Button
          className="justify-self-start"
          disabled={pending}
          onClick={() =>
            run(
              () => addProductsFromNotes(galleryId),
              "Añadido lo que dice la oferta"
            )
          }
          size="sm"
          variant="outline"
        >
          <PlusIcon className="size-4" />
          Añadir lo de la oferta: {suggestions.map(productName).join(" · ")}
        </Button>
      ) : null}

      {full ? null : (
        <form className="flex flex-wrap items-center gap-2" onSubmit={add}>
          <div className="flex gap-1">
            {(Object.keys(PRODUCT_KINDS) as ProductKind[]).map((option) => (
              <button
                aria-pressed={kind === option}
                className={cn(
                  tab,
                  kind === option
                    ? "border-signal-ink bg-signal/15 text-signal-ink"
                    : "bg-card text-muted-foreground hover:bg-accent"
                )}
                key={option}
                onClick={() => setKind(option)}
                type="button"
              >
                {PRODUCT_KINDS[option]}
              </button>
            ))}
          </div>
          <Input
            aria-label="Medida"
            className="w-24"
            onChange={(event) => setSize(event.target.value)}
            placeholder={kind === "book" ? "8x11" : "16x20"}
            value={size}
          />
          <Button
            disabled={pending || size.trim() === ""}
            size="sm"
            type="submit"
            variant="outline"
          >
            Añadir
          </Button>
        </form>
      )}
    </div>
  );
};

const Thumb = ({
  label,
  photo,
}: {
  readonly label: string;
  readonly photo: GalleryPhotoItem | undefined;
}) => (
  <figure className="grid w-24 gap-1">
    <div className="relative aspect-square overflow-hidden border bg-secondary">
      {photo?.thumbnailUrl ? (
        <Image
          alt={photo.fileName}
          className="size-full object-contain"
          crossOrigin="anonymous"
          draggable={false}
          height={200}
          src={photo.thumbnailUrl}
          unoptimized
          width={200}
        />
      ) : (
        <span className="absolute inset-1 grid place-items-center border border-dashed p-1 text-center font-mono text-[9px] text-muted-foreground uppercase tracking-[0.12em]">
          Sin elegir
        </span>
      )}
    </div>
    <figcaption className="truncate font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
      {label}
    </figcaption>
  </figure>
);

/**
 * What the client chose for each book and canvas, with the final size (a
 * horizontal cover makes an 8×11 book 11×8) and the file names to copy.
 */
export const ProductChoices = ({
  index,
  photos,
  products,
}: {
  readonly index: string;
  readonly photos: readonly GalleryPhotoItem[];
  readonly products: readonly ProductChoice[];
}) => {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const rules = new Map<number, ChoicePhoto>(
    photos.map((photo) => [
      photo.id,
      {
        name: baseName(photo.fileName),
        width: photo.width ?? 3,
        height: photo.height ?? 2,
        picked: photo.picked,
      },
    ])
  );
  const missing = missingChoices(products, rules);
  const chosen = products.flatMap((product) =>
    [product.photoId, product.backPhotoId]
      .map((photoId) => (photoId === null ? undefined : byId.get(photoId)))
      .filter((photo): photo is GalleryPhotoItem => photo !== undefined)
      .map((photo) => photo.fileName)
  );
  const list = lightroomFilter([...new Set(chosen)]);

  return (
    <section className="grid gap-3">
      <h2 className={sectionLabel}>
        <span className="text-signal-ink">{index}</span> Libro y canvas
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {products.map((product) => (
          <article className="grid gap-3 border bg-card p-4" key={product.id}>
            <p className="font-medium text-sm">
              {choiceSummary(product, rules)}
            </p>
            <div className="flex gap-3">
              <Thumb
                label={product.kind === "book" ? "Portada" : "Canvas"}
                photo={
                  product.photoId === null
                    ? undefined
                    : byId.get(product.photoId)
                }
              />
              {product.kind === "book" ? (
                <Thumb
                  label="Contraportada"
                  photo={
                    product.backPhotoId === null
                      ? undefined
                      : byId.get(product.backPhotoId)
                  }
                />
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {chosen.length > 0 ? (
          <Button
            onClick={() => copy(list, "Nombres copiados: pégalos en Lightroom")}
            size="sm"
            variant="outline"
          >
            <CopyIcon className="size-4" />
            Copiar portadas y canvas
          </Button>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {missing.length > 0
            ? `El cliente aún no eligió ${missing.join(", ")}.`
            : "Todo elegido."}
        </p>
      </div>
    </section>
  );
};
