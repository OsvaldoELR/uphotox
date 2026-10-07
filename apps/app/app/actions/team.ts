"use server";

import { createAdminClient } from "@repo/database/admin";
import { createClient } from "@repo/database/server";
import { TeamWelcomeTemplate } from "@repo/email/templates/team-welcome";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createElement } from "react";
import { z } from "zod";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import {
  ALL_PERMISSIONS,
  MEMBER_ROLES,
  type MemberRole,
  type Permission,
  ROLES,
} from "@/lib/permissions";
import { requireStudio } from "@/lib/studio";
import type { ActionResult } from "./boards";

const NO_ACCESS = "No tienes permiso para gestionar el equipo.";

const firstIssue = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Revisa los datos.";

const accessSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Escribe el nombre.")
    .max(120, "Máximo 120 caracteres."),
  role: z.enum(MEMBER_ROLES as [MemberRole, ...MemberRole[]]),
  permissions: z
    .array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]]))
    .transform((permissions) => [...new Set(permissions)]),
  onlyAssigned: z.boolean(),
});

const createMemberSchema = accessSchema.extend({
  email: z.email("El correo no es válido.").max(320),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(72, "Máximo 72 caracteres."),
});

export type MemberAccessInput = z.input<typeof accessSchema>;
export type CreateMemberInput = z.input<typeof createMemberSchema>;

/**
 * Like GoHighLevel: the owner creates the account and sets a first password.
 * The admin client is only used for the auth user; the membership row goes
 * through RLS so team.manage is enforced by the database too.
 */
export const createMember = async (
  input: CreateMemberInput
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("team.manage")) {
    return { error: NO_ACCESS };
  }

  const parsed = createMemberSchema.safeParse(input);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { email, password, fullName, role, permissions, onlyAssigned } =
    parsed.data;
  const admin = createAdminClient();
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (createError || !created.user) {
    const taken =
      createError?.code === "email_exists" ||
      createError?.message.toLowerCase().includes("already");

    return {
      error: taken
        ? "Ese correo ya tiene una cuenta en Uphotox."
        : "No se pudo crear el usuario.",
    };
  }

  const userId = created.user.id;
  const supabase = await createClient();
  const { error: memberError } = await supabase.from("studio_members").insert({
    user_id: userId,
    studio_id: context.studio.id,
    role,
    permissions,
    only_assigned: onlyAssigned,
  });

  if (memberError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "No se pudo añadir el usuario al estudio." };
  }

  const invitedBy =
    context.member.fullName ?? context.member.email ?? context.studio.name;

  after(() =>
    sendEmail({
      fromName: context.studio.name,
      to: email,
      replyTo: context.member.email,
      subject: `Tu acceso a ${context.studio.name} en Uphotox`,
      idempotencyKey: `team-welcome/${userId}`,
      react: createElement(TeamWelcomeTemplate, {
        email,
        invitedBy,
        name: fullName,
        role: ROLES[role].label,
        signInUrl: `${env.NEXT_PUBLIC_APP_URL}/sign-in`,
        studioName: context.studio.name,
      }),
    })
  );

  revalidatePath("/equipo");
  return { ok: true };
};

export const updateMember = async (
  userId: string,
  input: MemberAccessInput
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("team.manage")) {
    return { error: NO_ACCESS };
  }

  const parsed = accessSchema.safeParse(input);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  // RLS limits this to members of the caller's studio and never the owner.
  const { data, error } = await supabase
    .from("studio_members")
    .update({
      role: parsed.data.role,
      permissions: parsed.data.permissions,
      only_assigned: parsed.data.onlyAssigned,
    })
    .eq("user_id", userId)
    .select("user_id");

  if (error || !data?.length) {
    return { error: "No se pudo guardar el usuario." };
  }

  // Profiles are self-editable only, so the name goes through the admin
  // client — safe because the update above proved the user is our member.
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", userId);

  revalidatePath("/equipo");
  return { ok: true };
};

export const removeMember = async (userId: string): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("team.manage")) {
    return { error: NO_ACCESS };
  }

  if (userId === context.userId) {
    return { error: "No puedes eliminar tu propio usuario." };
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("studio_members")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!member || member.role === "owner") {
    return { error: "Ese usuario no se puede eliminar." };
  }

  // Each person belongs to one studio, so removing them deletes the account.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return { error: "No se pudo eliminar el usuario." };
  }

  revalidatePath("/equipo");
  return { ok: true };
};
