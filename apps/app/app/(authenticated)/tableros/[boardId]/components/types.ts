import type { Role } from "@/lib/permissions";

export interface BoardStage {
  readonly client_message: string | null;
  readonly id: number;
  readonly name: string;
  readonly notify_client: boolean;
  readonly position: number;
}

export interface BoardClient {
  readonly email: string | null;
  readonly full_name: string;
  readonly id: number;
  readonly phone: string | null;
}

export interface BoardCard {
  readonly assigned_to: string | null;
  readonly client: BoardClient | null;
  readonly gallery_url: string | null;
  readonly id: number;
  readonly notes: string | null;
  readonly position: number;
  readonly session_at: string | null;
  readonly stage_entered_at: string;
  readonly stage_id: number;
  readonly title: string;
}

export interface BoardMember {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
}

/** What the current member may do here (RLS enforces the same rules). */
export interface BoardAccess {
  readonly canCreate: boolean;
  readonly canDelete: boolean;
  readonly canEdit: boolean;
  readonly canManage: boolean;
  readonly canMove: boolean;
  readonly onlyAssigned: boolean;
}
