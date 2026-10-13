import "server-only";

import { log } from "@repo/observability/log";
import { flushStorageDeletions } from "@repo/storage/cleanup";
import { after } from "next/server";

/**
 * After the response, removes from R2 the photos whose rows were just
 * deleted (a trigger queued them in storage_deletions). If it fails, the
 * daily job retries.
 */
export const scheduleStorageCleanup = () => {
  after(async () => {
    try {
      await flushStorageDeletions();
    } catch (error) {
      log.error("Storage cleanup failed", { error: String(error) });
    }
  });
};
