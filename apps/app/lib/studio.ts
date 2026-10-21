import "server-only";

import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  ALL_PERMISSIONS,
  isPermission,
  type Module,
  type Permission,
  type Role,
  toModules,
  withModules,
} from "./permissions";
import { isPlatformAdmin } from "./platform";

export interface StudioContext {
  readonly can: (permission: Permission) => boolean;
  readonly member: {
    readonly email: string | null;
    readonly fullName: string | null;
    readonly onlyAssigned: boolean;
    readonly role: Role;
  };
  /**
   * Effective permissions: owners get all of them, minus the modules the
   * platform switched off (none while the studio is paused). Mirrors
   * private.has_permission.
   */
  readonly permissions: Permission[];
  readonly studio: {
    readonly id: number;
    /** Modules the platform left on for this studio. */
    readonly modules: Module[];
    readonly name: string;
    /** Set when the platform paused the studio. */
    readonly paused: {
      readonly at: string;
      readonly reason: string | null;
    } | null;
    /** Digits only (international format), or null when not set. */
    readonly whatsapp: string | null;
  };
  readonly userId: string;
}

/**
 * The signed-in user's studio membership, or null when they have no studio
 * yet. RLS is the real gate; this drives redirects and what the UI offers.
 */
export const getStudioContext = cache(
  async (): Promise<StudioContext | null> => {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    const supabase = await createClient();
    const { data } = await supabase
      .from("studio_members")
      .select(
        "role, permissions, only_assigned, studios(id, name, whatsapp, modules, suspended_at, suspended_reason), profiles(full_name, email)"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (!data?.studios) {
      return null;
    }

    const { suspended_at, suspended_reason, ...studio } = data.studios;
    const modules = toModules(studio.modules);
    const granted =
      data.role === "owner"
        ? ALL_PERMISSIONS
        : data.permissions.filter(isPermission);
    const permissions = suspended_at ? [] : withModules(granted, modules);

    return {
      userId,
      studio: {
        id: studio.id,
        name: studio.name,
        whatsapp: studio.whatsapp,
        modules,
        paused: suspended_at
          ? { at: suspended_at, reason: suspended_reason }
          : null,
      },
      member: {
        role: data.role,
        onlyAssigned: data.role !== "owner" && data.only_assigned,
        fullName: data.profiles?.full_name ?? null,
        email: data.profiles?.email ?? null,
      },
      permissions,
      can: (permission) => permissions.includes(permission),
    };
  }
);

/**
 * For pages inside the app: no studio yet means onboarding, except for
 * platform admins, whose account has no studio and lives in /admin. A paused
 * studio only sees the notice (RLS already hides its data).
 */
export const requireStudio = async () => {
  const context = await getStudioContext();

  if (!context) {
    redirect((await isPlatformAdmin()) ? "/admin" : "/onboarding");
  }

  if (context.studio.paused) {
    redirect("/estudio-pausado");
  }

  return context;
};

/** Pages for one module: a member without access gets a 404. */
export const requirePermission = async (permission: Permission) => {
  const context = await requireStudio();

  if (!context.can(permission)) {
    notFound();
  }

  return context;
};
