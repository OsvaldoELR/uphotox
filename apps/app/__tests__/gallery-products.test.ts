import { describe, expect, test } from "vitest";
import {
  type ChoicePhoto,
  choiceProblem,
  choiceSummary,
  madeSize,
  missingChoices,
  type ProductChoice,
  parseProductSize,
  photoOrientation,
  productsFromNotes,
  productsIntro,
  shapeLabel,
} from "../lib/gallery-products";

const photos = new Map<number, ChoicePhoto>([
  [1, { name: "IMG_0001", width: 3000, height: 2000, picked: true }],
  [2, { name: "IMG_0002", width: 3000, height: 2000, picked: true }],
  [3, { name: "IMG_0003", width: 2000, height: 3000, picked: true }],
  [4, { name: "IMG_0004", width: 3000, height: 2000, picked: false }],
]);

const book = (over: Partial<ProductChoice> = {}): ProductChoice => ({
  id: 10,
  kind: "book",
  short: 8,
  long: 11,
  photoId: null,
  backPhotoId: null,
  ...over,
});

describe("productsFromNotes", () => {
  test("reads the real offers", () => {
    expect(
      productsFromNotes(
        "Oferta: $385 - 12 FOTOS *impresas en un libro 6x6'*, una hora y media"
      )
    ).toEqual([{ kind: "book", short: 6, long: 6 }]);
    expect(
      productsFromNotes(
        "• Notas: Paquete: $725- 24 FOTOS impresas en un libro 8x11 y una de ellas en un canva 16x20 | Lugar: Estudio"
      )
    ).toEqual([
      { kind: "book", short: 8, long: 11 },
      { kind: "canvas", short: 16, long: 20 },
    ]);
    expect(
      productsFromNotes(
        "pastel incluido + Sesión de bañera + *Libro impreso 8x8*'"
      )
    ).toEqual([{ kind: "book", short: 8, long: 8 }]);
  });

  test("the same product twice counts once, and nothing is invented", () => {
    expect(
      productsFromNotes(
        "Oferta: $485- 12 FOTOS + libro 6x6\n• Notas: Paquete: $485- 12 FOTOS + libro 6X6"
      )
    ).toHaveLength(1);
    expect(productsFromNotes("$345 - 12 FOTOS DIGITALES")).toEqual([]);
    expect(productsFromNotes(null)).toEqual([]);
  });
});

describe("sizes and orientation", () => {
  test("parses what the studio types", () => {
    expect(parseProductSize("8x11")).toEqual({ short: 8, long: 11 });
    expect(parseProductSize(" 11 × 8 ")).toEqual({ short: 8, long: 11 });
    expect(parseProductSize("8,5x11")).toEqual({ short: 8.5, long: 11 });
    expect(parseProductSize("8x")).toBeNull();
    expect(parseProductSize("0x10")).toBeNull();
  });

  test("a horizontal photo turns 8×11 into 11×8; square ones stay", () => {
    expect(madeSize({ short: 8, long: 11 }, "horizontal")).toBe("11×8");
    expect(madeSize({ short: 8, long: 11 }, "vertical")).toBe("8×11");
    expect(madeSize({ short: 6, long: 6 }, "horizontal")).toBe("6×6");
    expect(photoOrientation({ width: 2000, height: 2000 })).toBe("vertical");
    expect(shapeLabel({ short: 8, long: 11 }, null)).toBeNull();
    expect(shapeLabel({ short: 6, long: 6 }, null)).toBe("Cuadrado");
  });
});

describe("choices", () => {
  test("covers come from the favourites", () => {
    expect(
      choiceProblem({ photoId: 4, photos, product: book(), slot: "photo" })
    ).toContain("favoritas");
    expect(
      choiceProblem({ photoId: 1, photos, product: book(), slot: "photo" })
    ).toBeNull();
  });

  test("the back cover follows the front on a rectangular book", () => {
    const withFront = book({ photoId: 1 });
    expect(
      choiceProblem({ photoId: 2, photos, product: withFront, slot: "back" })
    ).toBeNull();
    expect(
      choiceProblem({ photoId: 3, photos, product: withFront, slot: "back" })
    ).toContain("horizontal");
    expect(
      choiceProblem({ photoId: 1, photos, product: withFront, slot: "back" })
    ).toContain("otra foto");
    expect(
      choiceProblem({ photoId: 2, photos, product: book(), slot: "back" })
    ).toContain("primero la portada");
  });

  test("a square book takes any back cover", () => {
    expect(
      choiceProblem({
        photoId: 3,
        photos,
        product: book({ short: 6, long: 6, photoId: 1 }),
        slot: "back",
      })
    ).toBeNull();
  });

  test("lists what is missing and is empty when ready", () => {
    const canvas: ProductChoice = {
      id: 11,
      kind: "canvas",
      short: 16,
      long: 20,
      photoId: null,
      backPhotoId: null,
    };
    expect(missingChoices([book({ photoId: 1 }), canvas], photos)).toEqual([
      "la contraportada del libro 8×11",
      "la foto del canvas 16×20",
    ]);
    expect(
      missingChoices(
        [book({ photoId: 1, backPhotoId: 2 }), { ...canvas, photoId: 3 }],
        photos
      )
    ).toEqual([]);
    // A back cover that no longer matches is missing again.
    expect(
      missingChoices([book({ photoId: 3, backPhotoId: 2 })], photos)
    ).toEqual(["la contraportada del libro 8×11"]);
  });

  test("summary for the studio", () => {
    expect(choiceSummary(book({ photoId: 1, backPhotoId: 2 }), photos)).toBe(
      "Libro 11×8 horizontal · portada IMG_0001 · contraportada IMG_0002"
    );
    expect(
      choiceSummary(
        {
          id: 11,
          kind: "canvas",
          short: 16,
          long: 20,
          photoId: 3,
          backPhotoId: null,
        },
        photos
      )
    ).toBe("Canvas 16×20 vertical · IMG_0003");
    expect(choiceSummary(book({ short: 6, long: 6 }), photos)).toBe(
      "Libro 6×6 · portada sin elegir · contraportada sin elegir"
    );
  });
});

describe("productsIntro", () => {
  test("explains what the client will choose", () => {
    expect(productsIntro([])).toBeNull();
    expect(productsIntro([{ kind: "book", short: 6, long: 6 }])).toBe(
      "Tu paquete incluye un libro 6×6: al terminar de elegir tus favoritas escogerás entre ellas la portada y la contraportada."
    );
    expect(
      productsIntro([
        { kind: "book", short: 8, long: 11 },
        { kind: "canvas", short: 16, long: 20 },
      ])
    ).toBe(
      "Tu paquete incluye un libro 8×11 y un canvas 16×20: al terminar de elegir tus favoritas escogerás entre ellas la portada y la contraportada del libro y la foto del canvas. La portada decide si el libro sale vertical u horizontal."
    );
  });
});
