/**
 * Products of a package that the client has to decide in the gallery: a
 * printed book (front and back cover) and a canvas (one photo), both chosen
 * among the favourites. Pure rules shared by the client page, the studio
 * page, the server actions and the emails (the database checks the same
 * rules again when the selection is confirmed).
 *
 * Sizes are in inches as sold, short side first («libro 8x11», «canva
 * 16x20»). A rectangular product follows its photo: a horizontal front cover
 * turns an 8×11 book into 11×8, and the back cover must match it. Square ones
 * (6×6, 8×8) take any photo.
 */

export type ProductKind = "book" | "canvas";

export type Orientation = "horizontal" | "vertical";

export interface ProductSize {
  readonly long: number;
  readonly short: number;
}

export interface ProductSpec extends ProductSize {
  readonly kind: ProductKind;
}

export interface ProductChoice extends ProductSpec {
  /** Book: back cover. Always null for a canvas. */
  readonly backPhotoId: number | null;
  readonly id: number;
  /** Book: front cover. Canvas: the photo. */
  readonly photoId: number | null;
}

export interface ChoicePhoto {
  readonly height: number;
  readonly name: string;
  readonly picked: boolean;
  readonly width: number;
}

export const PRODUCT_KINDS: Record<ProductKind, string> = {
  book: "Libro",
  canvas: "Canvas",
};

export const MAX_GALLERY_PRODUCTS = 6;

const MIN_SIZE = 1;
const MAX_SIZE = 99.5;

const DIACRITICS = /[̀-ͯ]/g;
const NUMBER = String.raw`(\d{1,2}(?:[.,]\d)?)`;
const SIZE = new RegExp(String.raw`^\s*${NUMBER}\s*[x×*]\s*${NUMBER}\s*$`, "i");
// «libro 6x6», «libro impreso 8x8», «*libro 8x11*», «un canva 16x20»: the
// word, at most a few words of text, then the size.
const IN_NOTES: Record<ProductKind, RegExp> = {
  book: new RegExp(
    String.raw`\b(?:fotolibro|libro|album|photobook|book)\b[^\d\n]{0,25}?${NUMBER}\s*[x×]\s*${NUMBER}`,
    "gi"
  ),
  canvas: new RegExp(
    String.raw`\b(?:canvas|canva|lienzo)\b[^\d\n]{0,25}?${NUMBER}\s*[x×]\s*${NUMBER}`,
    "gi"
  ),
};

const toNumber = (text: string) => Number(text.replace(",", "."));

const sized = (a: number, b: number): ProductSize | null => {
  const valid = [a, b].every(
    (side) => Number.isFinite(side) && side >= MIN_SIZE && side <= MAX_SIZE
  );

  return valid ? { short: Math.min(a, b), long: Math.max(a, b) } : null;
};

/** «8x11», «8 × 11», «8.5x11» → { short: 8, long: 11 }; null if unreadable. */
export const parseProductSize = (text: string): ProductSize | null => {
  const match = SIZE.exec(text);
  return match
    ? sized(toNumber(match[1] ?? ""), toNumber(match[2] ?? ""))
    : null;
};

/**
 * Books and canvases named in the card notes (the booking form answer, e.g.
 * «24 FOTOS impresas en un libro 8x11 y una de ellas en un canva 16x20»).
 * The same product written twice (form answer and imported notes) counts
 * once.
 */
export const productsFromNotes = (notes: string | null): ProductSpec[] => {
  const text = (notes ?? "").normalize("NFD").replace(DIACRITICS, "");
  const found = new Map<string, ProductSpec>();

  for (const kind of Object.keys(IN_NOTES) as ProductKind[]) {
    for (const match of text.matchAll(IN_NOTES[kind])) {
      const size = sized(toNumber(match[1] ?? ""), toNumber(match[2] ?? ""));

      if (size) {
        found.set(`${kind}:${size.short}x${size.long}`, { kind, ...size });
      }
    }
  }

  return [...found.values()].slice(0, MAX_GALLERY_PRODUCTS);
};

export const isSquare = (size: ProductSize) => size.short === size.long;

/** A square photo counts as vertical: the product keeps its sold size. */
export const photoOrientation = (photo: {
  readonly height: number;
  readonly width: number;
}): Orientation => (photo.width > photo.height ? "horizontal" : "vertical");

const inches = (side: number) => String(side);

/** As written in the offer: «8×11», «16×20», «6×6». */
export const soldSize = (size: ProductSize) =>
  `${inches(size.short)}×${inches(size.long)}`;

/** As it will be made: a horizontal photo turns «8×11» into «11×8». */
export const madeSize = (size: ProductSize, orientation: Orientation | null) =>
  orientation === "horizontal" && !isSquare(size)
    ? `${inches(size.long)}×${inches(size.short)}`
    : soldSize(size);

export const productName = (product: ProductSpec) =>
  `${PRODUCT_KINDS[product.kind]} ${soldSize(product)}`;

/** «Horizontal», «Vertical» or «Cuadrado», once the photo is known. */
export const shapeLabel = (
  size: ProductSize,
  orientation: Orientation | null
) => {
  if (isSquare(size)) {
    return "Cuadrado";
  }

  if (orientation === null) {
    return null;
  }

  return orientation === "horizontal" ? "Horizontal" : "Vertical";
};

export type ChoiceSlot = "photo" | "back";

/**
 * Why a photo cannot go in a slot, or null if it can. Covers and the canvas
 * photo come from the favourites; the back cover is another photo, chosen
 * after the front, with the same orientation on a rectangular book.
 */
export const choiceProblem = ({
  photoId,
  photos,
  product,
  slot,
}: {
  readonly photoId: number;
  readonly photos: ReadonlyMap<number, ChoicePhoto>;
  readonly product: ProductChoice;
  readonly slot: ChoiceSlot;
}): string | null => {
  const photo = photos.get(photoId);

  if (!photo?.picked) {
    return "Elige la foto entre tus favoritas.";
  }

  if (slot === "photo") {
    return null;
  }

  if (product.kind !== "book") {
    return "Este producto lleva una sola foto.";
  }

  if (photoId === product.photoId) {
    return "La contraportada tiene que ser otra foto.";
  }

  if (isSquare(product)) {
    return null;
  }

  const frontPhoto =
    product.photoId === null ? undefined : photos.get(product.photoId);

  if (!frontPhoto) {
    return "Elige primero la portada.";
  }

  return photoOrientation(frontPhoto) === photoOrientation(photo)
    ? null
    : `La contraportada tiene que ser ${photoOrientation(frontPhoto)}, como la portada.`;
};

/** What is still missing, in the client's words (empty = ready). */
export const missingChoices = (
  products: readonly ProductChoice[],
  photos: ReadonlyMap<number, ChoicePhoto>
): string[] => {
  const missing: string[] = [];

  for (const product of products) {
    const name = productName(product);
    const frontOk =
      product.photoId !== null &&
      choiceProblem({
        photoId: product.photoId,
        photos,
        product,
        slot: "photo",
      }) === null;

    if (!frontOk) {
      missing.push(
        product.kind === "book"
          ? `la portada del ${name.toLowerCase()}`
          : `la foto del ${name.toLowerCase()}`
      );
    }

    if (product.kind !== "book") {
      continue;
    }

    const backOk =
      frontOk &&
      product.backPhotoId !== null &&
      choiceProblem({
        photoId: product.backPhotoId,
        photos,
        product,
        slot: "back",
      }) === null;

    if (!backOk) {
      missing.push(`la contraportada del ${name.toLowerCase()}`);
    }
  }

  return missing;
};

/**
 * One line per product for the studio, its emails and the card history:
 * «Libro 11×8 horizontal · portada IMG_1234 · contraportada IMG_1250».
 */
export const choiceSummary = (
  product: ProductChoice,
  photos: ReadonlyMap<number, ChoicePhoto>
) => {
  const front =
    product.photoId === null ? undefined : photos.get(product.photoId);
  const back =
    product.backPhotoId === null ? undefined : photos.get(product.backPhotoId);
  const orientation = front ? photoOrientation(front) : null;
  const shape = shapeLabel(product, orientation);
  const title = [
    PRODUCT_KINDS[product.kind],
    madeSize(product, orientation),
    shape && shape !== "Cuadrado" ? shape.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(" ");
  const none = "sin elegir";

  if (product.kind === "canvas") {
    return `${title} · ${front?.name ?? none}`;
  }

  return `${title} · portada ${front?.name ?? none} · contraportada ${back?.name ?? none}`;
};

const joinWords = (items: readonly string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`
    : (items[0] ?? "");

/**
 * What the client will decide, for the gallery email and page: «Tu paquete
 * incluye un libro 8×11 y un canvas 16×20: al terminar de elegir tus
 * favoritas escogerás entre ellas la portada y la contraportada del libro y
 * la foto del canvas. La portada decide si el libro sale vertical u
 * horizontal.» Null without products.
 */
export const productsIntro = (products: readonly ProductSpec[]) => {
  if (products.length === 0) {
    return null;
  }

  const books = products.filter((product) => product.kind === "book");
  const canvases = products.filter((product) => product.kind === "canvas");
  const both = books.length > 0 && canvases.length > 0;
  const tasks = [
    books.length > 0
      ? `la portada y la contraportada${both || books.length > 1 ? ` ${books.length > 1 ? "de cada libro" : "del libro"}` : ""}`
      : null,
    canvases.length > 0
      ? `la foto${both || canvases.length > 1 ? ` ${canvases.length > 1 ? "de cada canvas" : "del canvas"}` : ""}`
      : null,
  ].filter((task): task is string => task !== null);
  const items = products.map(
    (product) =>
      `un ${PRODUCT_KINDS[product.kind].toLowerCase()} ${soldSize(product)}`
  );
  const rectangular = books.some((book) => !isSquare(book));

  return `Tu paquete incluye ${joinWords(items)}: al terminar de elegir tus favoritas escogerás entre ellas ${joinWords(tasks)}.${rectangular ? " La portada decide si el libro sale vertical u horizontal." : ""}`;
};
