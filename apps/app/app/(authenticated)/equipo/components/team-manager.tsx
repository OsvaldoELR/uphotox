"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import {
  ALL_PERMISSIONS,
  type Permission,
  ROLES,
  type Role,
} from "@/lib/permissions";
import { MemberSheet } from "./member-sheet";

export interface TeamMember {
  readonly email: string | null;
  readonly id: string;
  readonly name: string;
  readonly onlyAssigned: boolean;
  readonly permissions: Permission[];
  readonly role: Role;
}

const NAME_SEPARATORS = /[\s@._-]+/;

const initials = (name: string) =>
  name
    .split(NAME_SEPARATORS)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

interface TeamManagerProperties {
  readonly currentUserId: string;
  readonly emailEnabled: boolean;
  readonly members: TeamMember[];
}

type SheetState =
  | { mode: "create" }
  | { mode: "edit"; member: TeamMember }
  | null;

export const TeamManager = ({
  currentUserId,
  emailEnabled,
  members,
}: TeamManagerProperties) => {
  const [sheet, setSheet] = useState<SheetState>(null);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setSheet({ mode: "create" })}>
          <PlusIcon />
          Añadir usuario
        </Button>
      </div>

      <ul className="divide-y border bg-card">
        {members.map((member) => {
          const isOwner = member.role === "owner";
          const editable = !isOwner && member.id !== currentUserId;
          const content = (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal/15 font-bold font-mono text-signal-ink text-xs">
                {initials(member.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-sm">
                  {member.name}
                  {member.id === currentUserId && (
                    <span className="text-muted-foreground"> (tú)</span>
                  )}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {member.email}
                </span>
              </span>
              <span className="hidden flex-col items-end gap-1 sm:flex">
                <span
                  className={cn(
                    "border px-2 py-0.5 font-bold font-mono text-[10px] uppercase tracking-[0.16em]",
                    isOwner
                      ? "border-signal-ink/40 text-signal-ink"
                      : "text-foreground"
                  )}
                >
                  {ROLES[member.role].label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                  {isOwner
                    ? "Todos los permisos"
                    : `${member.permissions.length}/${ALL_PERMISSIONS.length} permisos`}
                  {member.onlyAssigned && " · solo asignados"}
                </span>
              </span>
              {editable && (
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
            </>
          );

          return (
            <li key={member.id}>
              {editable ? (
                <button
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
                  onClick={() => setSheet({ mode: "edit", member })}
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-4 px-4 py-3">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {sheet && (
        <MemberSheet
          emailEnabled={emailEnabled}
          key={sheet.mode === "edit" ? sheet.member.id : "create"}
          member={sheet.mode === "edit" ? sheet.member : undefined}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
};
