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

export type ReviewStatus = "pending" | "approved" | "discarded";

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending: "Sin revisar",
  approved: "Aprobada",
  discarded: "Descartada",
};

/** Longest studio note for a redo. */
export const MAX_NOTE_LENGTH = 500;

/** What the studio sees: a finished photo the reviewer flagged reads «Revisar». */
export type EditState = EditStatus | "review";

/** Largest full-size export accepted (40 MP at quality 95 is ~20 MB). */
export const MAX_ORIGINAL_BYTES = 80 * 1024 * 1024;
/** Smaller files are web copies, not full-size exports. */
export const MIN_ORIGINAL_BYTES = 512 * 1024;
/** A long edge below this is a small copy (e.g. the gallery's watermarked one). */
export const MIN_ORIGINAL_EDGE = 3000;
/** Bytes read from the start of a JPEG to find its size (EXIF can be long). */
export const JPEG_HEADER_BYTES = 512 * 1024;

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

const SOI = 0xd8;
const MARKER = 0xff;
const FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const STANDALONE_MARKERS = new Set([
  0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
]);

const word = (bytes: Uint8Array, at: number) =>
  (bytes[at] ?? 0) * 256 + (bytes[at + 1] ?? 0);

/**
 * Width and height of a JPEG from its first bytes (the frame header), or
 * null when they are not there. Cheap: no decoding.
 */
export const jpegSize = (bytes: Uint8Array) => {
  if (bytes[0] !== MARKER || bytes[1] !== SOI) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== MARKER) {
      return null;
    }

    const marker = bytes[offset + 1] ?? 0;

    if (marker === MARKER) {
      offset += 1;
    } else if (STANDALONE_MARKERS.has(marker)) {
      offset += 2;
    } else if (FRAME_MARKERS.has(marker)) {
      return {
        height: word(bytes, offset + 5),
        width: word(bytes, offset + 7),
      };
    } else {
      offset += 2 + word(bytes, offset + 2);
    }
  }

  return null;
};

/**
 * Name of a cleaned photo when downloaded next to the original in the
 * session folder: DSCF7325.jpg → DSCF7325-fondo.jpg.
 */
export const downloadName = (fileName: string) =>
  `${baseName(fileName)}-fondo.jpg`;

/** Share of the monthly limit at which the studio is warned. */
export const LIMIT_WARNING = 0.8;

/**
 * Where the month's consumption stands against the optional limit: no new
 * photos once it is reached, a warning from 80 %.
 */
export const limitState = (used: number, limit: number | null) => {
  if (limit === null) {
    return { reached: false, warning: false, left: null };
  }

  return {
    reached: used >= limit,
    warning: used >= limit * LIMIT_WARNING,
    left: Math.max(0, limit - used),
  };
};

const DAY_MS = 86_400_000;
/** Registered photos whose upload never finished are dropped after this. */
export const ABANDONED_UPLOAD_DAYS = 2;

/**
 * Whether the daily clean-up deletes an Editor photo (row and files): its
 * keep days are over since it finished, or its upload was abandoned. Never
 * one the service is working on.
 */
export const isExpiredEditPhoto = (
  photo: {
    readonly createdAt: string;
    readonly finishedAt: string | null;
    readonly keepDays: number;
    readonly status: string;
  },
  now: Date = new Date()
) => {
  if (photo.status === "queued" || photo.status === "processing") {
    return false;
  }

  if (photo.status === "uploading") {
    return (
      now.getTime() - new Date(photo.createdAt).getTime() >
      ABANDONED_UPLOAD_DAYS * DAY_MS
    );
  }

  const since = new Date(photo.finishedAt ?? photo.createdAt).getTime();
  return now.getTime() - since > photo.keepDays * DAY_MS;
};
