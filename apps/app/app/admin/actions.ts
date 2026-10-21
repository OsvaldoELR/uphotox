"use server";

import { log } from "@repo/observability/log";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toModules } from "@/lib/permissions";
import { requirePlatformAdmin } from "@/lib/platform";
import type { ActionResult } from "../actions/boards";

const MAX_AI_CAP = 100_000;
const MAX_REASON_LENGTH = 300;

const accessSchema = z.object({
  studioId: z.number().int().positive(),
  // Unknown keys are dropped; the order is the catalog's.
  modules: z.array(z.string()).max(10).transform(toModules),
  aiLimit: z.number().min(0).max(MAX_AI_CAP).nullable(),
  paused: z.boolean(),
  reason: z.string().trim().max(MAX_REASON_LENGTH),
});

export type StudioAccessInput = z.input<typeof accessSchema>;

/**
 * Platform panel: modules, AI cap and pause of one studio. The SQL function
 * updates the studio and logs the change (platform_audit) in one
 * transaction; a save that changes nothing logs nothing.
 */
export const updateStudioAccess = async (
  input: StudioAccessInput
): Promise<ActionResult> => {
  const { admin, userId } = await requirePlatformAdmin();
  const parsed = accessSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: `Revisa los datos: el tope va de 0 a ${MAX_AI_CAP} y el mensaje tiene como mucho ${MAX_REASON_LENGTH} caracteres.`,
    };
  }

  const { studioId, modules, aiLimit, paused, reason } = parsed.data;
  const { data, error } = await admin.rpc("platform_set_studio_access", {
    target_studio: studioId,
    actor: userId,
    new_modules: modules,
    // The generated types make every argument non-null; null = no cap.
    new_ai_limit: aiLimit as number,
    suspend: paused,
    reason,
  });

  if (error) {
    log.error("Platform access update failed", { studioId, error });
    return { error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  if (!data) {
    return { error: "No se encontró el estudio." };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/estudios/${studioId}`);
  return { ok: true };
};
