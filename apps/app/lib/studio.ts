import "server-only";

import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  ALL_PERMISSIONS,
  isPermission,
  type Permission,
  type Role,
} from "./permissions";

export interface StudioContext {
  readonly can: (permission: Permission) => boolean;
  readonly member: {
    readonly email: string | null;
    readonly fullName: string | null;
    readonly onlyAssigned: boolean;
    readonly role: Role;
  };
  /** Effective permissions (owners get all of them). */
  readonly permissions: Permission[];
  readonly studio: {
    readonly id: number;
    readonly name: string;
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
        "role, permissions, only_assigned, studios(id, name, whatsapp), profiles(full_name, email)"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (!data?.studios) {
      return null;
    }

    const permissions =
      data.role === "owner"
        ? ALL_PERMISSIONS
        : data.permissions.filter(isPermission);

    return {
      userId,
      studio: data.studios,
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

/** For pages inside the app: no studio yet means onboarding. */
export const requireStudio = async () => {
  const context = await getStudioContext();

  if (!context) {
    redirect("/onboarding");
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
