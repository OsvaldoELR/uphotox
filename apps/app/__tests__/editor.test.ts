import { editPhotoKeys } from "@repo/storage/editor";
import { describe, expect, test } from "vitest";
import {
  editState,
  formatCost,
  isInProgress,
  matchOriginals,
  monthStart,
  statusUpdate,
} from "@/lib/editor";

const picks = [
  { id: 1, fileName: "DSCF7325.jpg" },
  { id: 2, fileName: "DSCF7330.jpg" },
  { id: 3, fileName: "DSCF7341.jpg" },
];

describe("matchOriginals", () => {
  test("pairs exports with picks by name, ignoring extension case", () => {
    const result = matchOriginals(picks, [
      { name: "DSCF7325.JPG" },
      { name: "dscf7330.jpeg" },
    ]);

    expect(result.pairs.map((pair) => pair.photo.id)).toEqual([1, 2]);
    expect(result.missing.map((photo) => photo.fileName)).toEqual([
      "DSCF7341.jpg",
    ]);
    expect(result.notPicked).toEqual([]);
  });

  test("leaves out photos the client did not pick, repeats and non-JPGs", () => {
    const result = matchOriginals(picks, [
      { name: "DSCF7325.jpg" },
      { name: "DSCF7325.jpeg" },
      { name: "DSCF9999.jpg" },
      { name: "DSCF7330.tif" },
    ]);

    expect(result.pairs).toHaveLength(1);
    expect(result.notPicked.map((file) => file.name)).toEqual([
      "DSCF7325.jpeg",
      "DSCF9999.jpg",
    ]);
    expect(result.notJpeg.map((file) => file.name)).toEqual(["DSCF7330.tif"]);
    expect(result.missing).toHaveLength(2);
  });
});

describe("statusUpdate", () => {
  test("reads a finished photo", () => {
    expect(
      statusUpdate({
        state: "done",
        at: "2026-10-18T18:00:00.000Z",
        info: {
          review: { score: 6, comment: "  Falta la línea del suelo. " },
          needsReview: false,
          costs: { total: 0.186_123 },
        },
      })
    ).toEqual({
      status: "done",
      score: 6,
      needsReview: false,
      comment: "Falta la línea del suelo.",
      cost: 0.1861,
      finishedAt: "2026-10-18T18:00:00.000Z",
    });
  });

  test("reads a failure with what it cost", () => {
    const update = statusUpdate(
      { state: "failed", error: "La IA no devolvió una imagen", cost: 0.37 },
      new Date("2026-10-18T18:00:00Z")
    );

    expect(update).toEqual({
      status: "failed",
      error: "La IA no devolvió una imagen",
      cost: 0.37,
      finishedAt: "2026-10-18T18:00:00.000Z",
    });
  });

  test("never trusts odd values", () => {
    const update = statusUpdate({
      state: "done",
      info: { review: { score: 42 }, costs: { total: -1 } },
    });

    expect(update).toMatchObject({ score: null, cost: 0, comment: null });
    expect(statusUpdate({ state: "failed" })).toMatchObject({
      error: "El servicio no pudo limpiar la foto.",
      cost: 0,
    });
    expect(statusUpdate({ state: "queued" })).toEqual({ status: "queued" });
    expect(statusUpdate({ state: "mystery" })).toBeNull();
  });
});

describe("editState", () => {
  test("a flagged finished photo reads «review»", () => {
    expect(editState({ status: "done", needsReview: true })).toBe("review");
    expect(editState({ status: "done", needsReview: false })).toBe("done");
    expect(editState({ status: "failed", needsReview: true })).toBe("failed");
  });

  test("in progress only once sent", () => {
    expect(isInProgress("uploading")).toBe(false);
    expect(isInProgress("queued")).toBe(true);
    expect(isInProgress("processing")).toBe(true);
    expect(isInProgress("done")).toBe(false);
  });
});

test("monthStart and formatCost", () => {
  expect(monthStart(new Date("2026-10-18T02:00:00Z"))).toBe(
    "2026-10-01T00:00:00.000Z"
  );
  expect(formatCost(5.7)).toBe("$5.70");
});

test("editPhotoKeys matches the SQL clean-up layout", () => {
  const keys = editPhotoKeys({ studioId: 4, galleryId: 9, id: 21 });

  expect(keys.prefix).toBe("editor/4/9/21/");
  expect(keys.original).toBe("editor/4/9/21/original.jpg");
  expect(keys.status).toBe("editor/4/9/21/status.json");
});
