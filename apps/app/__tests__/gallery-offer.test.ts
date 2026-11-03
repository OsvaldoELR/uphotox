import { describe, expect, test } from "vitest";
import { FULL_GALLERY_NOTE, fullGalleryOffer } from "../lib/gallery";

describe("fullGalleryOffer", () => {
  test("off without a price", () => {
    expect(fullGalleryOffer({ price: null, note: "Algo" })).toBeNull();
  });

  test("uses the studio's description, or the default one", () => {
    expect(fullGalleryOffer({ price: 100, note: null })).toEqual({
      price: 100,
      note: FULL_GALLERY_NOTE,
    });
    expect(fullGalleryOffer({ price: 100, note: "  " })?.note).toBe(
      FULL_GALLERY_NOTE
    );
    expect(fullGalleryOffer({ price: 80, note: "Todas, en bruto." })).toEqual({
      price: 80,
      note: "Todas, en bruto.",
    });
  });
});
