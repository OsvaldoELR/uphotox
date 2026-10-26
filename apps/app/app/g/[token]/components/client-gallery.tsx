"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { CircleHelpIcon, HeartIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  confirmSelection,
  setPhotoPicked,
  setProductPhoto,
} from "@/app/actions/client-gallery";
import { formatMoney, selectionTotals } from "@/lib/gallery";
import {
  type ChoicePhoto,
  type ChoiceSlot,
  choiceProblem,
  choiceSummary,
  type ProductChoice,
  productName,
} from "@/lib/gallery-products";
import type { ClientGallery, ClientPhoto } from "../data";
import { PhotoViewer } from "./photo-viewer";
import { choiceRules, ProductPicker } from "./product-picker";

const OFFLINE = "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";
const NAME_SPLIT = /\s+/;

const shortDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
});

const chip =
  "border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

const tab =
  "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors";

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

type Filter = "all" | "favorites";

interface Viewer {
  readonly index: number;
  /** The list the viewer was opened from, kept while it is open. */
  readonly photos: readonly ClientPhoto[];
}

/** Bottom bar line: what the counter means right now. */
const counterLine = (
  picked: number,
  includedCount: number | null,
  extras: string
) => {
  if (picked === 0) {
    return "Toca el corazón para elegir una foto";
  }

  if (includedCount === null) {
    return plural(picked, "foto elegida", "fotos elegidas");
  }

  if (picked < includedCount) {
    return `Te ${includedCount - picked === 1 ? "queda" : "quedan"} ${plural(includedCount - picked, "incluida", "incluidas")}`;
  }

  return picked === includedCount ? "¡Completaste tu paquete!" : extras;
};

const PhotoGrid = ({
  badges,
  onOpen,
  onToggle,
  photos,
  picked,
}: {
  /** «Portada», «Contraportada», «Canvas» on the photos chosen for them. */
  readonly badges: ReadonlyMap<number, string>;
  readonly onOpen: (index: number) => void;
  readonly onToggle?: (photoId: number) => void;
  readonly photos: readonly ClientPhoto[];
  readonly picked: ReadonlySet<number>;
}) => (
  // Justified rows: every photo whole, in file order, each row filling the
  // width (flex-grow by aspect ratio; the last item keeps the final row tidy).
  <ul className="flex flex-wrap gap-1.5 [--row:7rem] sm:[--row:11rem] lg:[--row:13rem]">
    {photos.map((photo, index) => {
      const ratio = photo.width / photo.height;
      const isPicked = picked.has(photo.id);

      return (
        <li
          className={cn(
            "relative overflow-hidden bg-secondary",
            isPicked &&
              "ring-2 ring-signal ring-offset-1 ring-offset-background"
          )}
          key={photo.id}
          style={{ flexGrow: ratio, flexBasis: `calc(var(--row) * ${ratio})` }}
        >
          <button
            aria-label={`Ver la foto ${photo.name} en grande`}
            className="block w-full"
            data-tour={index === 0 ? "photo" : undefined}
            onClick={() => onOpen(index)}
            type="button"
          >
            <Image
              alt=""
              className="block h-auto w-full"
              crossOrigin="anonymous"
              draggable={false}
              height={photo.height}
              loading={index < 12 ? "eager" : "lazy"}
              src={photo.thumbnailUrl}
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
              unoptimized
              width={photo.width}
            />
          </button>
          {badges.has(photo.id) ? (
            <span className="pointer-events-none absolute top-1.5 left-1.5 bg-signal px-1.5 py-0.5 font-bold font-mono text-[9px] text-primary-foreground uppercase tracking-[0.14em]">
              {badges.get(photo.id)}
            </span>
          ) : null}
          {onToggle ? (
            <button
              aria-label={
                isPicked
                  ? `Quitar ${photo.name} de mis favoritas`
                  : `Elegir ${photo.name}`
              }
              aria-pressed={isPicked}
              className={cn(
                "absolute right-1.5 bottom-1.5 flex size-10 items-center justify-center rounded-full transition-colors",
                isPicked
                  ? "bg-signal text-primary-foreground"
                  : "bg-black/40 text-white backdrop-blur-sm hover:bg-black/55"
              )}
              data-tour={index === 0 ? "heart" : undefined}
              onClick={() => onToggle(photo.id)}
              type="button"
            >
              <HeartIcon className={cn("size-5", isPicked && "fill-current")} />
            </button>
          ) : null}
        </li>
      );
    })}
    <li aria-hidden="true" className="grow-[10] basis-0" />
  </ul>
);

const ConfirmDialog = ({
  extras,
  includedCount,
  onClose,
  open,
  picked,
  productLines,
  token,
  whatsapp,
}: {
  readonly extras: { count: number; total: string };
  readonly includedCount: number | null;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly picked: number;
  /** One line per book/canvas with the photos chosen for it. */
  readonly productLines: readonly string[];
  readonly token: string;
  readonly whatsapp: boolean;
}) => {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await confirmSelection(token, note);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("¡Selección enviada!");
      onClose();
      router.refresh();
    });
  };

  let summary = "";

  if (includedCount !== null && picked < includedCount) {
    summary = `Tu paquete incluye ${includedCount}: aún puedes elegir ${includedCount - picked} más sin costo.`;
  } else if (includedCount !== null && extras.count > 0) {
    summary = `${includedCount} incluidas en tu paquete + ${plural(extras.count, "extra", "extras")} (${extras.total}). Las extras las coordinamos contigo${whatsapp ? " por WhatsApp" : ""}.`;
  }

  return (
    <Dialog
      onOpenChange={(next) => !(next || pending) && onClose()}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black font-mono uppercase tracking-wide">
            ¿Confirmar tu selección?
          </DialogTitle>
          <DialogDescription>
            Elegiste {plural(picked, "foto", "fotos")}. {summary}
          </DialogDescription>
        </DialogHeader>
        {productLines.length > 0 ? (
          <ul className="grid gap-1 border-signal-ink/40 border-l-2 pl-3 text-sm">
            {productLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="client-note">
            ¿Algo que debamos saber? (opcional)
          </Label>
          <Textarea
            className="min-h-24"
            id="client-note"
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Por ejemplo: en IMG_0012, quitar el chupete."
            value={note}
          />
          <p className="text-muted-foreground text-xs">
            Después de confirmar ya no podrás cambiarla
            {whatsapp ? ". Si necesitas algo, escríbenos por WhatsApp." : "."}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button disabled={pending} onClick={onClose} variant="ghost">
            Seguir eligiendo
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending ? "Enviando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const pickedIds = (photos: readonly ClientPhoto[]) =>
  new Set(photos.filter((photo) => photo.picked).map((photo) => photo.id));

/**
 * Favourites with optimistic taps: the heart changes at once and goes back
 * (with a message) if the server could not save it. The server stays the
 * truth: fresh props (another phone picking too) replace the local set.
 */
const usePicks = (token: string, photos: readonly ClientPhoto[]) => {
  const router = useRouter();
  const [picked, setPicked] = useState(() => pickedIds(photos));

  useEffect(() => {
    setPicked(pickedIds(photos));
  }, [photos]);

  // Coming back to the tab: pick up changes made on another device.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);

  const toggle = useCallback(
    (photoId: number) => {
      const next = !picked.has(photoId);
      const apply = (value: boolean) =>
        setPicked((current) => {
          const updated = new Set(current);
          if (value) {
            updated.add(photoId);
          } else {
            updated.delete(photoId);
          }
          return updated;
        });

      apply(next);
      setPhotoPicked(token, photoId, next)
        .then((result) => {
          if ("error" in result) {
            apply(!next);
            toast.error(result.error);
          }
        })
        .catch(() => {
          apply(!next);
          toast.error(OFFLINE);
        });
    },
    [token, picked]
  );

  return { picked, toggle };
};

/**
 * Covers and canvas photo, saved at once like the hearts (and put back with
 * a message if the server refuses). A new front cover drops a back cover
 * that no longer fits, as the server does.
 */
const useProductChoices = (
  token: string,
  products: readonly ProductChoice[]
) => {
  const [choices, setChoices] = useState(products);

  useEffect(() => {
    setChoices(products);
  }, [products]);

  const choose = useCallback(
    (
      productId: number,
      slot: ChoiceSlot,
      photoId: number | null,
      rules: ReadonlyMap<number, ChoicePhoto>
    ) => {
      const previous = choices;
      const apply = (product: ProductChoice): ProductChoice => {
        if (slot === "back") {
          return { ...product, backPhotoId: photoId };
        }

        const next = { ...product, photoId };
        const backFits =
          next.backPhotoId === null ||
          photoId === null ||
          choiceProblem({
            photoId: next.backPhotoId,
            photos: rules,
            product: next,
            slot: "back",
          }) === null;

        return backFits ? next : { ...next, backPhotoId: null };
      };

      setChoices((current) =>
        current.map((product) =>
          product.id === productId ? apply(product) : product
        )
      );
      setProductPhoto(token, productId, slot, photoId)
        .then((result) => {
          if ("error" in result) {
            setChoices(previous);
            toast.error(result.error);
          }
        })
        .catch(() => {
          setChoices(previous);
          toast.error(OFFLINE);
        });
    },
    [token, choices]
  );

  // A photo taken out of the favourites stops being a cover (the server
  // clears it too).
  const forgetPhoto = useCallback((photoId: number) => {
    setChoices((current) =>
      current.map((product) => ({
        ...product,
        photoId: product.photoId === photoId ? null : product.photoId,
        backPhotoId:
          product.backPhotoId === photoId ? null : product.backPhotoId,
      }))
    );
  }, []);

  return { choices, choose, forgetPhoto };
};

/** «Portada», «Contraportada», «Canvas» for the photos chosen for them. */
const choiceBadges = (choices: readonly ProductChoice[]) => {
  const badges = new Map<number, string[]>();
  const add = (photoId: number | null, label: string) => {
    if (photoId !== null) {
      badges.set(photoId, [...(badges.get(photoId) ?? []), label]);
    }
  };

  for (const product of choices) {
    add(product.photoId, product.kind === "book" ? "Portada" : "Canvas");
    add(product.backPhotoId, "Contraportada");
  }

  return new Map(
    [...badges].map(([photoId, labels]) => [photoId, labels.join(" · ")])
  );
};

interface TourInput {
  readonly extraPrice: string;
  readonly firstName: string;
  readonly includedCount: number | null;
}

/**
 * The first-visit guide starts on its own once per device; `replay` shows it
 * again (the «?» button). driver.js and its styles load only when needed.
 */
const useGalleryTour = (enabled: boolean, input: TourInput) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { startTour, tourSeen } = await import("./gallery-tour");

      if (!(cancelled || tourSeen())) {
        startTour(input);
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, input]);

  return async () => {
    const { startTour } = await import("./gallery-tour");
    startTour(input);
  };
};

const GalleryHeader = ({
  firstName,
  gallery,
  onHelp,
  readOnly,
}: {
  readonly firstName: string;
  readonly gallery: ClientGallery;
  readonly onHelp: () => void;
  readonly readOnly: boolean;
}) => (
  <header className="border-b bg-card">
    <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 pt-6 pb-4 md:px-8">
      <div className="min-w-0">
        <p className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
          {gallery.studioName}
        </p>
        <h1 className="mt-2 font-black font-mono text-2xl uppercase leading-tight tracking-[-0.01em] md:text-4xl">
          {gallery.cardTitle}
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {readOnly
            ? "Estas son las fotos que elegiste."
            : `Hola${firstName ? `, ${firstName}` : ""}. Elige tus fotos favoritas.`}
        </p>
      </div>
      {readOnly ? null : (
        <Button
          aria-label="Ver la guía otra vez"
          className="shrink-0"
          data-tour="help"
          onClick={onHelp}
          size="icon"
          variant="ghost"
        >
          <CircleHelpIcon className="size-5" />
        </Button>
      )}
    </div>
    {readOnly ? null : (
      <div className="mx-auto max-w-6xl px-4 pb-4 md:px-8">
        <ul className="flex flex-wrap gap-2" data-tour="package">
          <li className={cn(chip, "border-signal-ink/40 text-signal-ink")}>
            {gallery.includedCount === null
              ? "Elige las que quieras"
              : `Tu paquete · ${plural(gallery.includedCount, "foto", "fotos")}`}
          </li>
          {gallery.includedCount === null ? null : (
            <li className={cn(chip, "text-muted-foreground")}>
              Extra · {formatMoney(gallery.extraPrice)} c/u
            </li>
          )}
          {gallery.products.map((product) => (
            <li
              className={cn(chip, "border-signal-ink/40 text-signal-ink")}
              key={product.id}
            >
              {productName(product)}
            </li>
          ))}
          {gallery.expiresAt ? (
            <li className={cn(chip, "text-muted-foreground")}>
              Hasta el {shortDate.format(new Date(gallery.expiresAt))}
            </li>
          ) : null}
        </ul>
      </div>
    )}
  </header>
);

const FilterTabs = ({
  all,
  favorites,
  filter,
  onChange,
}: {
  readonly all: number;
  readonly favorites: number;
  readonly filter: Filter;
  readonly onChange: (filter: Filter) => void;
}) => {
  const style = (active: boolean) =>
    cn(
      tab,
      active
        ? "border-signal-ink bg-signal/15 text-signal-ink"
        : "bg-card text-muted-foreground hover:bg-accent"
    );

  return (
    <div className="mb-3 flex gap-2 px-2.5 md:px-0">
      <button
        aria-pressed={filter === "all"}
        className={style(filter === "all")}
        onClick={() => onChange("all")}
        type="button"
      >
        Todas · {all}
      </button>
      <button
        aria-pressed={filter === "favorites"}
        className={style(filter === "favorites")}
        data-tour="favorites"
        onClick={() => onChange("favorites")}
        type="button"
      >
        Mis favoritas · {favorites}
      </button>
    </div>
  );
};

const SubmittedNotice = ({
  extrasText,
  firstName,
  hasExtras,
  picked,
  productLines,
  whatsappUrl,
}: {
  readonly extrasText: string;
  readonly firstName: string;
  readonly hasExtras: boolean;
  readonly picked: number;
  readonly productLines: readonly string[];
  readonly whatsappUrl: string | null;
}) => (
  <section className="mx-2.5 mb-6 grid gap-3 border border-signal-ink/30 bg-card p-5 md:mx-0">
    <p className="font-bold font-mono text-sm uppercase tracking-[0.12em]">
      ¡Listo{firstName ? `, ${firstName}` : ""}! Recibimos tu selección
    </p>
    <p className="text-muted-foreground text-sm">
      Elegiste {plural(picked, "foto", "fotos")}
      {hasExtras ? ` (${extrasText}; las extras las coordinamos contigo)` : ""}.
      Ya estamos trabajando en ellas.
    </p>
    {productLines.length > 0 ? (
      <ul className="grid gap-1 border-signal-ink/40 border-l-2 pl-3 text-sm">
        {productLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    ) : null}
    {whatsappUrl ? (
      <Button asChild className="justify-self-start" variant="outline">
        <a href={whatsappUrl} rel="noopener" target="_blank">
          Escribir por WhatsApp
        </a>
      </Button>
    ) : null}
  </section>
);

const SelectionBar = ({
  extras,
  extrasText,
  hasProducts,
  includedCount,
  onConfirm,
  picked,
}: {
  readonly extras: number;
  readonly extrasText: string;
  /** Book or canvas to decide next: the button leads there first. */
  readonly hasProducts: boolean;
  readonly includedCount: number | null;
  readonly onConfirm: () => void;
  readonly picked: number;
}) => {
  // Package progress; without a package (or of 0) there is nothing to fill.
  const progress = includedCount
    ? Math.min(100, (picked / includedCount) * 100)
    : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-md">
      {progress === null ? null : (
        <div className="h-1 bg-secondary">
          <div
            className={cn(
              "h-full transition-[width] duration-300",
              extras > 0 ? "bg-flare" : "bg-signal"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
        <div className="min-w-0" data-tour="counter">
          <p className="font-black font-mono text-xl tabular-nums leading-none">
            {picked}
            {includedCount === null ? null : (
              <span className="text-muted-foreground"> / {includedCount}</span>
            )}
          </p>
          <p
            className={cn(
              "mt-1 truncate text-xs",
              extras > 0 ? "text-flare" : "text-muted-foreground"
            )}
          >
            {counterLine(picked, includedCount, extrasText)}
          </p>
        </div>
        <Button
          data-tour="confirm"
          disabled={picked === 0}
          onClick={onConfirm}
          size="lg"
        >
          {hasProducts ? (
            "Continuar"
          ) : (
            <>
              <span className="sm:hidden">Confirmar</span>
              <span className="hidden sm:inline">Confirmar selección</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export const ClientGalleryView = ({
  gallery,
}: {
  readonly gallery: ClientGallery;
}) => {
  const readOnly = gallery.state === "submitted";
  const { picked, toggle } = usePicks(gallery.token, gallery.photos);
  const { choices, choose, forgetPhoto } = useProductChoices(
    gallery.token,
    gallery.products
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [step, setStep] = useState<"products" | "confirm" | null>(null);
  const firstName = gallery.clientName.trim().split(NAME_SPLIT)[0] ?? "";
  const tourInput = useMemo(
    () => ({
      firstName,
      includedCount: gallery.includedCount,
      extraPrice: formatMoney(gallery.extraPrice),
    }),
    [firstName, gallery.includedCount, gallery.extraPrice]
  );
  const replayTour = useGalleryTour(
    !readOnly && gallery.photos.length > 0,
    tourInput
  );

  const favorites = gallery.photos.filter((photo) => picked.has(photo.id));
  const visible =
    readOnly || filter === "favorites" ? favorites : gallery.photos;
  const totals = selectionTotals({
    picked: picked.size,
    includedCount: gallery.includedCount,
    extraPrice: gallery.extraPrice,
  });
  const extrasText = `${plural(totals.extras, "extra", "extras")} · ${formatMoney(totals.extraTotal)}`;
  const rules = choiceRules(favorites);
  const productLines = choices.map((product) => choiceSummary(product, rules));
  const badges = choiceBadges(choices);
  const toggleFavorite = (photoId: number) => {
    if (picked.has(photoId)) {
      forgetPhoto(photoId);
    }
    toggle(photoId);
  };

  return (
    <div className="min-h-dvh bg-background">
      <GalleryHeader
        firstName={firstName}
        gallery={gallery}
        onHelp={() => {
          setFilter("all");
          replayTour();
        }}
        readOnly={readOnly}
      />

      <main
        className={cn(
          "mx-auto max-w-6xl px-1.5 pt-4 md:px-8",
          readOnly ? "pb-16" : "pb-36"
        )}
      >
        {readOnly ? (
          <SubmittedNotice
            extrasText={extrasText}
            firstName={firstName}
            hasExtras={totals.extras > 0}
            picked={picked.size}
            productLines={productLines}
            whatsappUrl={gallery.whatsappUrl}
          />
        ) : (
          <FilterTabs
            all={gallery.photos.length}
            favorites={picked.size}
            filter={filter}
            onChange={setFilter}
          />
        )}

        {visible.length > 0 ? (
          <PhotoGrid
            badges={badges}
            onOpen={(index) => setViewer({ index, photos: visible })}
            onToggle={readOnly ? undefined : toggleFavorite}
            photos={visible}
            picked={picked}
          />
        ) : (
          <p className="mx-2.5 border border-dashed px-4 py-12 text-center text-muted-foreground text-sm md:mx-0">
            Aún no marcaste ninguna. Toca el corazón de una foto para elegirla.
          </p>
        )}
      </main>

      {readOnly ? null : (
        <>
          <SelectionBar
            extras={totals.extras}
            extrasText={extrasText}
            hasProducts={choices.length > 0}
            includedCount={gallery.includedCount}
            onConfirm={() =>
              setStep(choices.length > 0 ? "products" : "confirm")
            }
            picked={picked.size}
          />
          {choices.length > 0 ? (
            <ProductPicker
              favorites={favorites}
              onChoose={(productId, slot, photoId) =>
                choose(productId, slot, photoId, rules)
              }
              onClose={() => setStep(null)}
              onContinue={() => setStep("confirm")}
              open={step === "products"}
              products={choices}
            />
          ) : null}
          <ConfirmDialog
            extras={{
              count: totals.extras,
              total: formatMoney(totals.extraTotal),
            }}
            includedCount={gallery.includedCount}
            onClose={() => setStep(null)}
            open={step === "confirm"}
            picked={picked.size}
            productLines={productLines}
            token={gallery.token}
            whatsapp={Boolean(gallery.whatsappUrl)}
          />
        </>
      )}

      {viewer ? (
        <PhotoViewer
          index={viewer.index}
          onClose={() => setViewer(null)}
          onIndexChange={(index) =>
            setViewer((current) => (current ? { ...current, index } : null))
          }
          onToggle={readOnly ? undefined : toggleFavorite}
          photos={viewer.photos}
          picked={picked}
        />
      ) : null}
    </div>
  );
};
