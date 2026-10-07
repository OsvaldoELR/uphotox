import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import type { Metadata } from "next";
import { isEmailEnabled } from "@/lib/email";
import { isPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/studio";
import { Header } from "../components/header";
import { TeamManager, type TeamMember } from "./components/team-manager";

export const metadata: Metadata = {
  title: "Equipo · Uphotox",
  description: "Usuarios del estudio, roles y permisos.",
};

const TeamPage = async () => {
  const context = await requirePermission("team.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_members")
    .select(
      "user_id, role, permissions, only_assigned, created_at, profiles(full_name, email)"
    )
    .order("created_at");

  const members: TeamMember[] = (data ?? [])
    .map((member) => ({
      id: member.user_id,
      name:
        member.profiles?.full_name ?? member.profiles?.email ?? "Sin nombre",
      email: member.profiles?.email ?? null,
      role: member.role,
      permissions: member.permissions.filter(isPermission),
      onlyAssigned: member.only_assigned,
    }))
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));

  return (
    <>
      <Header page="Equipo" trail={[{ label: "Panel", href: "/" }]} />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-12 md:px-10">
        <div className="flex flex-col gap-2">
          <HudLabel align="start">
            Equipo · {String(members.length).padStart(2, "0")}
          </HudLabel>
          <p className="max-w-prose text-muted-foreground text-sm">
            Crea los usuarios de tu estudio y decide qué puede ver y hacer cada
            uno. Cada persona entra con su correo y la contraseña que le
            asignes.
          </p>
        </div>
        <TeamManager
          currentUserId={context.userId}
          emailEnabled={isEmailEnabled()}
          members={members}
        />
      </div>
    </>
  );
};

export default TeamPage;
