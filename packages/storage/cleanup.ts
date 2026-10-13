import "server-only";

import { createAdminClient } from "@repo/database/admin";
import { deleteObjects, isStorageConfigured } from "./index";

const PAGE = 500;
const ID_CHUNK = 100;

/**
 * Deletes from R2 the objects queued in public.storage_deletions (filled by
 * triggers when photo rows go away) and empties the queue. Safe to run
 * concurrently: deleting an object twice is not an error. Returns how many
 * objects were removed.
 */
export const flushStorageDeletions = async () => {
  if (!isStorageConfigured()) {
    return 0;
  }

  const admin = createAdminClient();
  let total = 0;

  for (;;) {
    const { data, error } = await admin
      .from("storage_deletions")
      .select("id, object_key")
      .order("id")
      .limit(PAGE);

    if (error) {
      throw new Error(`Could not read storage_deletions: ${error.message}`);
    }

    if (data.length === 0) {
      return total;
    }

    await deleteObjects(data.map((row) => row.object_key));

    // By id list, not by range: identities can commit out of order.
    for (let index = 0; index < data.length; index += ID_CHUNK) {
      const ids = data.slice(index, index + ID_CHUNK).map((row) => row.id);
      const { error: deleteError } = await admin
        .from("storage_deletions")
        .delete()
        .in("id", ids);

      if (deleteError) {
        throw new Error(
          `Could not empty storage_deletions: ${deleteError.message}`
        );
      }
    }

    total += data.length;

    if (data.length < PAGE) {
      return total;
    }
  }
};
