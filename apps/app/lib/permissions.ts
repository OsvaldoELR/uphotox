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
    id: "galleries",
    label: "Galerías",
    permissions: [
      {
        key: "galleries.view",
        label: "Ver galerías y copiar la selección para Lightroom",
      },
      {
        key: "galleries.manage",
        label: "Crear galerías, subir fotos y enviarlas al cliente",
      },
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

// Modules the platform can switch off per studio (studios.modules). A
// module's key is the prefix of its permissions. Keep in sync with the
// studios.modules check constraint and private.has_permission. Boards,
// clients, team and settings are always on.
export const MODULES = [
  {
    key: "galleries",
    label: "Galerías",
    short: "Galerías",
    description: "Selección de fotos por el cliente con su enlace privado.",
  },
  {
    key: "editor",
    label: "Editor de imágenes",
    short: "Editor",
    description: "Limpieza de fondos y edición con IA (gasta en modelos).",
  },
] as const;

export type Module = (typeof MODULES)[number]["key"];

export const ALL_MODULES: Module[] = MODULES.map((module) => module.key);

export const isModule = (value: string): value is Module =>
  (ALL_MODULES as string[]).includes(value);

/** Stored modules made safe, in catalog order (so lists compare equal). */
export const toModules = (stored: readonly string[] | null | undefined) =>
  ALL_MODULES.filter((module) => stored?.includes(module));

/** The module a permission belongs to, or null when it is always on. */
export const moduleOf = (permission: Permission): Module | null => {
  const prefix = permission.split(".")[0] ?? "";
  return isModule(prefix) ? prefix : null;
};

/**
 * For service-role code, which skips RLS (client gallery, notifications):
 * whether the studio can use a module right now (on and not paused).
 */
export const moduleAvailable = (
  studio:
    | {
        readonly modules: readonly string[] | null;
        readonly suspended_at: string | null;
      }
    | null
    | undefined,
  module: Module
) =>
  Boolean(studio && !studio.suspended_at && studio.modules?.includes(module));

/** Drops the permissions of modules the studio does not have. */
export const withModules = (
  permissions: readonly Permission[],
  modules: readonly Module[]
) =>
  permissions.filter((permission) => {
    const module = moduleOf(permission);
    return module === null || modules.includes(module);
  });

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
    "galleries.view",
    "galleries.manage",
  ],
  editor: [
    "boards.view",
    "cards.move",
    "galleries.view",
    "galleries.manage",
    "editor.access",
  ],
  assistant: [
    "boards.view",
    "cards.create",
    "cards.edit",
    "cards.move",
    "clients.view",
    "clients.manage",
  ],
};
