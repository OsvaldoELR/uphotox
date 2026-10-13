import { galleryPhotoKeys } from "@repo/storage/gallery";
import { describe, expect, test } from "vitest";
import {
  baseName,
  compareFileNames,
  formatMoney,
  galleryState,
  isJpegName,
  lightroomFilter,
  packageCountFromNotes,
  selectionTotals,
} from "@/lib/gallery";

describe("packageCountFromNotes", () => {
  test("reads the package from the booking form answer", () => {
    expect(
      packageCountFromNotes(
        "• Qué tipo de sesión fotográfica desea?: Smash Cake\n• Qué oferta desea?: $345 - 12 FOTOS DIGITALES + 1 IMPRESA"
      )
    ).toBe(12);
  });

  test("ignores prices and accepts accents and singular", () => {
    expect(packageCountFromNotes("$250 - 1 fotografía impresa")).toBe(1);
    expect(packageCountFromNotes("Paquete de 25 imágenes")).toBe(25);
    expect(packageCountFromNotes("$345 fotos")).toBeNull();
  });

  test("returns null when there is no package", () => {
    expect(packageCountFromNotes(null)).toBeNull();
    expect(packageCountFromNotes("Llamar el lunes")).toBeNull();
    expect(packageCountFromNotes("0 fotos")).toBeNull();
  });
});

describe("lightroomFilter", () => {
  test("drops extensions, sorts naturally and removes repeats", () => {
    expect(
      lightroomFilter([
        "IMG_0045.jpg",
        "IMG_0012.JPG",
        "IMG_0012.jpeg",
        "DSC_9.jpg",
        "DSC_10.jpg",
      ])
    ).toBe("DSC_9, DSC_10, IMG_0012, IMG_0045");
  });

  test("keeps dots inside the name", () => {
    expect(baseName("Mateo.final.01.jpg")).toBe("Mateo.final.01");
    expect(baseName("sin-extension")).toBe("sin-extension");
  });

  test("is empty without picks", () => {
    expect(lightroomFilter([])).toBe("");
  });
});

describe("file names", () => {
  test("accepts only JPEG", () => {
    expect(isJpegName("IMG_1.jpg")).toBe(true);
    expect(isJpegName("IMG_1.JPEG")).toBe(true);
    expect(isJpegName("IMG_1.png")).toBe(false);
    expect(isJpegName("IMG_1.CR3")).toBe(false);
  });

  test("compares numbers by value", () => {
    expect(
      ["IMG_10.jpg", "IMG_2.jpg", "img_1.jpg"].sort(compareFileNames)
    ).toEqual(["img_1.jpg", "IMG_2.jpg", "IMG_10.jpg"]);
  });
});

describe("selectionTotals", () => {
  test("charges only the photos above the package", () => {
    expect(
      selectionTotals({ picked: 14, includedCount: 12, extraPrice: 20 })
    ).toEqual({ picked: 14, extras: 2, extraTotal: 40 });
    expect(
      selectionTotals({ picked: 9, includedCount: 12, extraPrice: 20 })
    ).toEqual({ picked: 9, extras: 0, extraTotal: 0 });
  });

  test("without a package nothing is extra", () => {
    expect(
      selectionTotals({ picked: 30, includedCount: null, extraPrice: 20 })
    ).toEqual({ picked: 30, extras: 0, extraTotal: 0 });
  });

  test("formats prices", () => {
    expect(formatMoney(40)).toBe("$40");
    expect(formatMoney(12.5)).toBe("$12.50");
  });
});

describe("galleryState", () => {
  const now = new Date("2026-10-13T12:00:00Z");

  test("open until the link expires", () => {
    expect(
      galleryState({ status: "open", expiresAt: "2026-12-12T12:00:00Z" }, now)
    ).toBe("open");
    expect(
      galleryState({ status: "open", expiresAt: "2026-10-13T11:59:59Z" }, now)
    ).toBe("expired");
  });

  test("draft and submitted ignore the date", () => {
    expect(galleryState({ status: "draft", expiresAt: null }, now)).toBe(
      "draft"
    );
    expect(
      galleryState(
        { status: "submitted", expiresAt: "2026-01-01T00:00:00Z" },
        now
      )
    ).toBe("submitted");
  });
});

describe("galleryPhotoKeys", () => {
  test("matches the layout the SQL trigger deletes", () => {
    expect(galleryPhotoKeys({ studioId: 24, galleryId: 7, id: 1503 })).toEqual({
      preview: "24/7/1503.jpg",
      thumbnail: "24/7/1503_t.jpg",
    });
  });
});
