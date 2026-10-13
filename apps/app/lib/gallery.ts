/**
 * Pure rules of the galleries module, shared by the studio pages and the
 * client page (and tested in __tests__/gallery.test.ts).
 */

export type GalleryStatus = "draft" | "open" | "submitted";
export type GalleryState = GalleryStatus | "expired";

/** Days the client has to pick, and days photos stay after that. */
export const GALLERY_LINK_DAYS = 60;
export const GALLERY_RETENTION_DAYS = 60;

/** Most photos one gallery may hold. */
export const MAX_GALLERY_PHOTOS = 1000;

/** Largest preview accepted (they arrive at ~200 KB from Lightroom). */
export const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

export const GALLERY_STATE_LABELS: Record<GalleryState, string> = {
  draft: "Sin enviar",
  open: "Esperando al cliente",
  expired: "Enlace caducado",
  submitted: "Selección recibida",
};

export const galleryState = (
  gallery: { readonly expiresAt: string | null; readonly status: string },
  now: Date = new Date()
): GalleryState => {
  if (gallery.status === "submitted") {
    return "submitted";
  }

  if (gallery.status === "open") {
    return gallery.expiresAt && new Date(gallery.expiresAt) <= now
      ? "expired"
      : "open";
  }

  return "draft";
};

const DIACRITICS = /\p{Diacritic}/gu;
const JPEG_NAME = /\.jpe?g$/i;
const EXTENSION = /\.[^./\\]+$/;

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(DIACRITICS, "");

const PACKAGE_COUNT =
  /(?<!\$)\b(\d{1,4})\s*(?:fotos?|fotografias?|imagenes)\b/i;

/**
 * Photos included in the package, read from the card notes (the booking form
 * answer looks like «$345 - 12 FOTOS DIGITALES…»). Null when not found.
 */
export const packageCountFromNotes = (notes: string | null) => {
  const match = stripAccents(notes ?? "").match(PACKAGE_COUNT);
  const count = match ? Number(match[1]) : Number.NaN;

  return Number.isInteger(count) && count > 0 ? count : null;
};

export const isJpegName = (name: string) => JPEG_NAME.test(name);

/** IMG_1234.jpg → IMG_1234 (the name of the original in the catalogue). */
export const baseName = (fileName: string) => fileName.replace(EXTENSION, "");

/** File-name order that puts IMG_2 before IMG_10. */
export const compareFileNames = (a: string, b: string) =>
  a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

/**
 * Text to paste into Lightroom Classic: Library → Text filter → Filename →
 * Contains. Names without extension (so the RAW/DNG matches), separated by
 * commas, in file order, without repeats.
 */
export const lightroomFilter = (fileNames: readonly string[]) =>
  [...new Set(fileNames.map(baseName))].sort(compareFileNames).join(", ");

export const selectionTotals = ({
  extraPrice,
  includedCount,
  picked,
}: {
  readonly extraPrice: number;
  readonly includedCount: number | null;
  readonly picked: number;
}) => {
  const extras =
    includedCount === null ? 0 : Math.max(0, picked - includedCount);

  return { picked, extras, extraTotal: extras * extraPrice };
};

export const formatMoney = (amount: number) =>
  Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
