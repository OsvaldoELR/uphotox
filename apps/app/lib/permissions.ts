import type { Enums } from "@repo/database";

// Keep in sync with the studio_members.permissions check constraint.
export const PERMISSION_GROUPS = [
  {
    id: "boards",
    label: "Tableros",
    permissions: [
      { key: "boards.view", label: "Ver tableros y tarjetas" },
      { key: "boards.manage", label: "Crear y configurar tableros y etapas" },
    ],
  },
  {
    id: "cards",
    label: "Tarjetas",
    permissions: [
      { key: "cards.create", label: "Añadir clientes a un tablero" },
      { key: "cards.edit", label: "Editar los datos de una tarjeta" },
      { key: "cards.move", label: "Mover tarjetas entre etapas" },
      { key: "cards.delete", label: "Eliminar tarjetas" },
    ],
  },
  {
    id: "clients",
    label: "Clientes",
    permissions: [
      { key: "clients.view", label: "Ver la lista de clientes" },
      { key: "clients.manage", label: "Crear, editar y borrar clientes" },
    ],
  },
  {
    id: "editor",
    label: "Editor de imágenes",
    permissions: [{ key: "editor.access", label: "Usar el editor" }],
  },
  {
    id: "team",
    label: "Equipo",
    permissions: [
      { key: "team.manage", label: "Crear usuarios y asignar permisos" },
    ],
  },
  {
    id: "settings",
    label: "Ajustes del estudio",
    permissions: [
      { key: "settings.manage", label: "Cambiar los ajustes del estudio" },
    ],
  },
] as const;

export type Permission =
  (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap(
  (group) => group.permissions.map((permission) => permission.key)
);

export const isPermission = (value: string): value is Permission =>
  (ALL_PERMISSIONS as string[]).includes(value);

export type Role = Enums<"studio_role">;
export type MemberRole = Exclude<Role, "owner">;

// Role names stay in English (product decision); descriptions are UI copy.
export const ROLES: Record<Role, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Dueña del estudio. Tiene todos los permisos.",
  },
  photographer: {
    label: "Photographer",
    description: "Agenda sesiones y mueve a los clientes por el flujo.",
  },
  editor: {
    label: "Editor",
    description: "Edita las fotos y avanza las etapas de edición.",
  },
  assistant: {
    label: "Assistant",
    description: "Gestiona clientes y el día a día del tablero.",
  },
};

export const MEMBER_ROLES: MemberRole[] = [
  "photographer",
  "editor",
  "assistant",
];

// Starting point when the owner picks a role; every toggle stays editable.
export const ROLE_DEFAULTS: Record<MemberRole, Permission[]> = {
  photographer: [
    "boards.view",
    "cards.create",
    "cards.edit",
    "cards.move",
    "clients.view",
  ],
  editor: ["boards.view", "cards.move", "editor.access"],
  assistant: [
    "boards.view",
    "cards.create",
    "cards.edit",
    "cards.move",
    "clients.view",
    "clients.manage",
  ],
};
