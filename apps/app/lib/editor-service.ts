import "server-only";

import { isStorageConfigured } from "@repo/storage";
import { env } from "@/env";

/**
 * The Editor service on Cloudflare (services/editor): a Worker with a queue
 * and the clean-up engine. The app only queues photos; the service reads
 * the original from R2 and writes the results and a status.json next to it.
 */

const QUEUE_TIMEOUT_MS = 20_000;

export const isEditorConfigured = () =>
  Boolean(env.EDITOR_URL && env.EDITOR_TOKEN && isStorageConfigured());

export interface EditOptions {
  /** Also straighten and crop in the studio's usual style. */
  readonly framing?: boolean;
  /** false keeps a helper's hand holding the child. */
  readonly helpers?: boolean;
  /** 1 one model, 2 both (the best is kept), 3 plus a second pass. */
  readonly level?: number;
  /** «fondo» (backdrop and floor) or «completa» (all but the faces). */
  readonly mode?: string;
  /** With level 1, «gpt» or «nbpro». */
  readonly model?: string;
  /** Extra instruction for a redo («quita también el cable»). */
  readonly note?: string;
}

/** The service refused a request; `status` tells a bad key (401) apart. */
export class EditorServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Queues one photo. Throws when the service does not accept it. */
export const queueEditPhoto = async (job: {
  readonly key: string;
  readonly options?: EditOptions;
  readonly prefix: string;
}) => {
  if (!(env.EDITOR_URL && env.EDITOR_TOKEN)) {
    throw new Error("Editor service is not configured");
  }

  const response = await fetch(new URL("/photos", env.EDITOR_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.EDITOR_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(QUEUE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new EditorServiceError(
      response.status,
      `Editor service answered ${response.status}: ${await response.text()}`
    );
  }
};
