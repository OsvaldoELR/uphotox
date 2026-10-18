/**
 * Pure rules of the Editor module (background clean-up of the photos the
 * client picked), tested in __tests__/editor.test.ts.
 */

import { baseName, isJpegName } from "./gallery";

export type EditStatus =
  | "uploading"
  | "queued"
  | "processing"
  | "done"
  | "failed";

/** What the studio sees: a finished photo the reviewer flagged reads «Revisar». */
export type EditState = EditStatus | "review";

/** Largest full-size export accepted (40 MP at quality 95 is ~20 MB). */
export const MAX_ORIGINAL_BYTES = 80 * 1024 * 1024;

export const EDIT_STATE_LABELS: Record<EditState, string> = {
  uploading: "Sin subir",
  queued: "En cola",
  processing: "Limpiando",
  done: "Lista",
  review: "Revisar",
  failed: "Falló",
};

const LONG_TEXT = 2000;

export const editState = (photo: {
  readonly needsReview: boolean;
  readonly status: EditStatus;
}): EditState =>
  photo.status === "done" && photo.needsReview ? "review" : photo.status;

/** Sent to the service and not finished yet. */
export const isInProgress = (status: EditStatus) =>
  status === "queued" || status === "processing";

const matchKey = (fileName: string) => baseName(fileName).toLowerCase();

/**
 * Pairs the dropped full-size exports with the photos the client picked, by
 * name without extension and ignoring case (DSCF7325.jpg ↔ DSCF7325.JPG).
 * Returns the pairs, the picks without a file, and the files left out: not
 * a JPG, not a pick, or a second file for the same pick.
 */
export const matchOriginals = <
  P extends { readonly fileName: string },
  F extends { readonly name: string },
>(
  picked: readonly P[],
  files: readonly F[]
) => {
  const picks = new Map(
    picked.map((photo) => [matchKey(photo.fileName), photo])
  );
  const used = new Set<string>();
  const pairs: { file: F; photo: P }[] = [];
  const notPicked: F[] = [];
  const notJpeg: F[] = [];

  for (const file of files) {
    const key = matchKey(file.name);
    const photo = picks.get(key);

    if (!isJpegName(file.name)) {
      notJpeg.push(file);
    } else if (!photo || used.has(key)) {
      notPicked.push(file);
    } else {
      used.add(key);
      pairs.push({ file, photo });
    }
  }

  return {
    pairs,
    missing: picked.filter((photo) => !used.has(matchKey(photo.fileName))),
    notPicked,
    notJpeg,
  };
};

/** status.json written by the Cloudflare service next to each photo. */
export interface EngineStatus {
  readonly at?: string;
  readonly cost?: number;
  readonly error?: string;
  readonly info?: {
    readonly costs?: { readonly total?: number };
    readonly needsReview?: boolean;
    readonly review?: { readonly comment?: string; readonly score?: number };
  };
  readonly state?: string;
}

export type EditUpdate =
  | { readonly status: "queued" }
  | { readonly status: "processing" }
  | {
      readonly comment: string | null;
      readonly cost: number;
      readonly finishedAt: string;
      readonly needsReview: boolean;
      readonly score: number | null;
      readonly status: "done";
    }
  | {
      readonly cost: number;
      readonly error: string;
      readonly finishedAt: string;
      readonly status: "failed";
    };

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? Math.round(amount * 10_000) / 10_000
    : 0;
};

const score = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 10
    ? number
    : null;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, LONG_TEXT)
    : null;

/** The service's status as a row update, or null when it says nothing new. */
export const statusUpdate = (
  status: EngineStatus,
  now: Date = new Date()
): EditUpdate | null => {
  const finishedAt = status.at ?? now.toISOString();

  switch (status.state) {
    case "queued":
    case "processing":
      return { status: status.state };
    case "done":
      return {
        status: "done",
        score: score(status.info?.review?.score),
        needsReview: Boolean(status.info?.needsReview),
        comment: text(status.info?.review?.comment),
        cost: money(status.info?.costs?.total),
        finishedAt,
      };
    case "failed":
      return {
        status: "failed",
        error: text(status.error) ?? "El servicio no pudo limpiar la foto.",
        cost: money(status.cost),
        finishedAt,
      };
    default:
      return null;
  }
};

/** Start of the current month (UTC), for the month's consumption. */
export const monthStart = (now: Date = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

export const formatCost = (amount: number) => `$${amount.toFixed(2)}`;
