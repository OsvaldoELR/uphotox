"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { cn } from "@repo/design-system/lib/utils";
import { CheckIcon } from "lucide-react";
import Image from "next/image";
import {
  type ChoicePhoto,
  type ChoiceSlot,
  choiceProblem,
  isSquare,
  madeSize,
  missingChoices,
  PRODUCT_KINDS,
  type ProductChoice,
  photoOrientation,
  productsIntro,
  shapeLabel,
  soldSize,
} from "@/lib/gallery-products";
import type { ClientPhoto } from "../data";

const chip =
  "border border-signal-ink/40 px-2.5 py-1 font-mono text-[10px] text-signal-ink uppercase tracking-[0.16em]";

const stepLabel =
  "font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]";

/** The favourites as the rules see them (anything else is not allowed). */
export const choiceRules = (favorites: readonly ClientPhoto[]) =>
  new Map<number, ChoicePhoto>(
    favorites.map((photo) => [
      photo.id,
      {
        name: photo.name,
        width: photo.width,
        height: photo.height,
        picked: true,
      },
    ])
  );

const pickerTitle = (products: readonly ProductChoice[]) => {
  const kinds = new Set(products.map((product) => product.kind));

  if (kinds.size > 1) {
    return "Tu libro y tu canvas";
  }

  return kinds.has("book") ? "Tu libro" : "Tu canvas";
};

const Face = ({
  label,
  photo,
  ratio,
}: {
  readonly label: string;
  readonly photo: ClientPhoto | undefined;
  readonly ratio: number;
}) => (
  <figure className="grid content-end gap-1.5">
    <div
      className="relative w-28 overflow-hidden border bg-secondary shadow-[0_10px_24px_-14px_rgb(0_0_0/0.45)] sm:w-36"
      style={{ aspectRatio: String(ratio) }}
    >
      {photo ? (
        <Image
          alt=""
          className="object-cover"
          crossOrigin="anonymous"
          fill
          sizes="9rem"
          src={photo.thumbnailUrl}
          unoptimized
        />
      ) : (
        <span className="absolute inset-1.5 grid place-items-center border border-dashed font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
          {label}
        </span>
      )}
    </div>
    <figcaption className={stepLabel}>{label}</figcaption>
  </figure>
);

const ChoiceGrid = ({
  badge,
  onSelect,
  photos,
  problemFor,
  selectedId,
}: {
  readonly badge: string;
  readonly onSelect: (photoId: number | null) => void;
  readonly photos: readonly ClientPhoto[];
  readonly problemFor: (photoId: number) => string | null;
  readonly selectedId: number | null;
}) => (
  <ul className="flex flex-wrap gap-1.5 [--row:4.5rem] sm:[--row:6rem]">
    {photos.map((photo) => {
      const ratio = photo.width / photo.height;
      const selected = photo.id === selectedId;
      const problem = selected ? null : problemFor(photo.id);

      return (
        <li
          key={photo.id}
          style={{ flexGrow: ratio, flexBasis: `calc(var(--row) * ${ratio})` }}
        >
          <button
            aria-label={
              selected
                ? `Quitar ${photo.name} como ${badge.toLowerCase()}`
                : `Elegir ${photo.name} como ${badge.toLowerCase()}`
            }
            aria-pressed={selected}
            className={cn(
              "relative block w-full overflow-hidden bg-secondary transition-opacity",
              selected &&
                "ring-2 ring-signal ring-offset-1 ring-offset-background",
              problem && "cursor-not-allowed opacity-30 grayscale"
            )}
            disabled={problem !== null}
            onClick={() => onSelect(selected ? null : photo.id)}
            title={problem ?? undefined}
            type="button"
          >
            <Image
              alt=""
              className="block h-auto w-full"
              crossOrigin="anonymous"
              draggable={false}
              height={photo.height}
              src={photo.thumbnailUrl}
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
              unoptimized
              width={photo.width}
            />
            {selected ? (
              <span className="absolute top-1 left-1 flex items-center gap-1 bg-signal px-1.5 py-0.5 font-bold font-mono text-[9px] text-primary-foreground uppercase tracking-[0.14em]">
                <CheckIcon className="size-3" />
                {badge}
              </span>
            ) : null}
          </button>
        </li>
      );
    })}
    <li aria-hidden="true" className="grow-[10] basis-0" />
  </ul>
);

const BackCoverStep = ({
  favorites,
  front,
  onChoose,
  product,
  rules,
}: {
  readonly favorites: readonly ClientPhoto[];
  readonly front: ClientPhoto | undefined;
  readonly onChoose: (photoId: number | null) => void;
  readonly product: ProductChoice;
  readonly rules: ReadonlyMap<number, ChoicePhoto>;
}) => {
  const problemFor = (photoId: number) =>
    choiceProblem({ photoId, photos: rules, product, slot: "back" });
  const square = isSquare(product);
  const orientation = front ? photoOrientation(front) : null;

  if (!(square || front)) {
    return (
      <p className="text-muted-foreground text-sm">Elige primero la portada.</p>
    );
  }

  if (!favorites.some((photo) => problemFor(photo.id) === null)) {
    return (
      <p className="text-flare text-sm">
        {square || orientation === null
          ? "Necesitas otra foto entre tus favoritas para la contraportada."
          : `Entre tus favoritas no hay otra foto ${orientation}.`}{" "}
        Vuelve a tus fotos y marca una más.
      </p>
    );
  }

  return (
    <>
      <ChoiceGrid
        badge="Contraportada"
        onSelect={onChoose}
        photos={favorites}
        problemFor={problemFor}
        selectedId={product.backPhotoId}
      />
      {square || orientation === null ? null : (
        <p className="text-muted-foreground text-xs">
          Tiene que ser{" "}
          {orientation === "horizontal" ? "horizontal" : "vertical"}, como la
          portada.
        </p>
      )}
    </>
  );
};

const ProductSection = ({
  favorites,
  onChoose,
  product,
  rules,
}: {
  readonly favorites: readonly ClientPhoto[];
  readonly onChoose: (slot: ChoiceSlot, photoId: number | null) => void;
  readonly product: ProductChoice;
  readonly rules: ReadonlyMap<number, ChoicePhoto>;
}) => {
  const byId = new Map(favorites.map((photo) => [photo.id, photo]));
  const front =
    product.photoId === null ? undefined : byId.get(product.photoId);
  const back =
    product.backPhotoId === null ? undefined : byId.get(product.backPhotoId);
  const orientation = front ? photoOrientation(front) : null;
  const shape = shapeLabel(product, orientation);
  const isBook = product.kind === "book";
  const portrait = product.short / product.long;
  let ratio = 1;

  if (!isSquare(product)) {
    ratio = orientation === "horizontal" ? 1 / portrait : portrait;
  }

  return (
    <section className="grid gap-4 border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold font-mono text-sm uppercase tracking-[0.12em]">
          Tu {PRODUCT_KINDS[product.kind].toLowerCase()} {soldSize(product)}
        </h3>
        {shape ? (
          <span className={chip}>
            {shape} · {madeSize(product, orientation)}
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <Face
          label={isBook ? "Portada" : "Tu foto"}
          photo={front}
          ratio={ratio}
        />
        {isBook ? (
          <Face label="Contraportada" photo={back} ratio={ratio} />
        ) : null}
        {isBook && orientation === "horizontal" && !isSquare(product) ? (
          <p className="max-w-56 text-sm">
            Con esta portada tu libro será{" "}
            <strong>horizontal ({madeSize(product, orientation)})</strong>.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <p className={stepLabel}>
          {isBook ? "1 · Portada" : "Foto del canvas"}
        </p>
        <ChoiceGrid
          badge={isBook ? "Portada" : "Canvas"}
          onSelect={(photoId) => onChoose("photo", photoId)}
          photos={favorites}
          problemFor={() => null}
          selectedId={product.photoId}
        />
      </div>

      {isBook ? (
        <div className="grid gap-2">
          <p className={stepLabel}>2 · Contraportada</p>
          <BackCoverStep
            favorites={favorites}
            front={front}
            onChoose={(photoId) => onChoose("back", photoId)}
            product={product}
            rules={rules}
          />
        </div>
      ) : null}
    </section>
  );
};

/**
 * The step between the favourites and confirming, when the package has a
 * book or a canvas: covers and canvas photo are chosen among the favourites
 * and saved at once (the parent handles saving).
 */
export const ProductPicker = ({
  favorites,
  onChoose,
  onClose,
  onContinue,
  open,
  products,
}: {
  readonly favorites: readonly ClientPhoto[];
  readonly onChoose: (
    productId: number,
    slot: ChoiceSlot,
    photoId: number | null
  ) => void;
  readonly onClose: () => void;
  readonly onContinue: () => void;
  readonly open: boolean;
  readonly products: readonly ProductChoice[];
}) => {
  const rules = choiceRules(favorites);
  const missing = missingChoices(products, rules);

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-[90dvh] sm:max-w-3xl sm:rounded-lg">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="font-black font-mono uppercase tracking-wide">
            {pickerTitle(products)}
          </DialogTitle>
          <DialogDescription>{productsIntro(products)}</DialogDescription>
        </DialogHeader>
        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-4 py-4 sm:px-6">
          {products.map((product) => (
            <ProductSection
              favorites={favorites}
              key={product.id}
              onChoose={(slot, photoId) => onChoose(product.id, slot, photoId)}
              product={product}
              rules={rules}
            />
          ))}
        </div>
        {/* Phones: the message on its own line, buttons below it. */}
        <footer className="flex flex-col gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
          <p
            className={cn(
              "min-w-0 text-xs sm:flex-1",
              missing.length > 0 ? "text-flare" : "text-muted-foreground"
            )}
          >
            {missing.length > 0
              ? `Falta elegir ${missing.join(", ")}.`
              : "¡Listo! Ya puedes confirmar tu selección."}
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} variant="ghost">
              Volver a mis fotos
            </Button>
            <Button disabled={missing.length > 0} onClick={onContinue}>
              Continuar
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
};
