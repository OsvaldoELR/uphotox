"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Switch } from "@repo/design-system/components/ui/switch";
import { WandSparklesIcon } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { createMember, removeMember, updateMember } from "@/app/actions/team";
import {
  MEMBER_ROLES,
  type MemberRole,
  PERMISSION_GROUPS,
  type Permission,
  ROLE_DEFAULTS,
  ROLES,
} from "@/lib/permissions";
import type { TeamMember } from "./team-manager";

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

const generatePassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(
    bytes,
    (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]
  ).join("");
};

interface MemberSheetProperties {
  readonly emailEnabled: boolean;
  /** Absent when creating a new user. */
  readonly member?: TeamMember;
  readonly onClose: () => void;
}

export const MemberSheet = ({
  emailEnabled,
  member,
  onClose,
}: MemberSheetProperties) => {
  const editing = Boolean(member);
  const initialRole: MemberRole =
    member && member.role !== "owner" ? member.role : "photographer";
  const [role, setRole] = useState<MemberRole>(initialRole);
  const [permissions, setPermissions] = useState<Set<Permission>>(
    new Set(member ? member.permissions : ROLE_DEFAULTS[initialRole])
  );
  const [onlyAssigned, setOnlyAssigned] = useState(
    member?.onlyAssigned ?? false
  );
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  const changeRole = (value: string) => {
    const next = value as MemberRole;
    setRole(next);
    setPermissions(new Set(ROLE_DEFAULTS[next]));
  };

  const toggle = (keys: Permission[], enabled: boolean) => {
    setPermissions((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (enabled) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const access = {
      fullName: String(data.get("fullName") ?? ""),
      role,
      permissions: [...permissions],
      onlyAssigned,
    };

    startTransition(async () => {
      const result = member
        ? await updateMember(member.id, access)
        : await createMember({
            ...access,
            email: String(data.get("email") ?? ""),
            password,
          });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(member ? "Usuario actualizado" : "Usuario creado", {
        description:
          !member && emailEnabled
            ? "Le enviamos un correo de bienvenida."
            : undefined,
      });
      onClose();
    });
  };

  const remove = () => {
    if (!member) {
      return;
    }

    startTransition(async () => {
      const result = await removeMember(member.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Usuario eliminado");
      onClose();
    });
  };

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-black font-mono text-lg uppercase tracking-wide">
            {member ? member.name : "Nuevo usuario"}
          </SheetTitle>
          <SheetDescription>
            {member
              ? "Cambia su rol y lo que puede hacer en el estudio."
              : "Crea su cuenta y elige qué puede ver y hacer."}
          </SheetDescription>
        </SheetHeader>

        <form className="grid gap-6 p-4" onSubmit={submit}>
          <section className="grid gap-4">
            <span className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
              Datos del usuario
            </span>
            <div className="grid gap-2">
              <Label htmlFor="member-name">Nombre</Label>
              <Input
                defaultValue={member?.name ?? ""}
                id="member-name"
                maxLength={120}
                name="fullName"
                placeholder="Ej.: Laura Méndez"
                required
              />
            </div>
            {editing ? (
              <p className="text-muted-foreground text-sm">
                Correo: <span className="text-foreground">{member?.email}</span>
              </p>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="member-email">Correo</Label>
                  <Input
                    autoComplete="off"
                    id="member-email"
                    maxLength={320}
                    name="email"
                    placeholder="laura@tuestudio.com"
                    required
                    type="email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="member-password">Contraseña inicial</Label>
                  <div className="flex gap-2">
                    <Input
                      autoComplete="new-password"
                      id="member-password"
                      maxLength={72}
                      minLength={8}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      type="text"
                      value={password}
                    />
                    <Button
                      aria-label="Generar contraseña"
                      onClick={() => setPassword(generatePassword())}
                      size="icon"
                      title="Generar contraseña"
                      type="button"
                      variant="outline"
                    >
                      <WandSparklesIcon />
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Compártela con la persona; podrá cambiarla desde «¿Olvidaste
                    tu contraseña?». Nunca se envía por correo.
                  </p>
                </div>
              </>
            )}
          </section>

          <section className="grid gap-4">
            <span className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
              Roles y permisos
            </span>
            <div className="grid gap-2">
              <Label htmlFor="member-role">Rol</Label>
              <Select onValueChange={changeRole} value={role}>
                <SelectTrigger className="w-full" id="member-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ROLES[option].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {ROLES[role].description} Al cambiar de rol se cargan sus
                permisos por defecto; después puedes ajustarlos.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 border p-3">
              <div className="grid gap-1">
                <Label htmlFor="member-only-assigned">
                  Solo datos asignados
                </Label>
                <p className="text-muted-foreground text-sm">
                  Solo verá las tarjetas en las que sea responsable (y sus
                  clientes).
                </p>
              </div>
              <Switch
                checked={onlyAssigned}
                id="member-only-assigned"
                onCheckedChange={setOnlyAssigned}
              />
            </div>

            <div className="grid gap-2">
              {PERMISSION_GROUPS.map((group) => {
                const keys = group.permissions.map(
                  (permission) => permission.key
                ) as Permission[];
                const granted = keys.filter((key) => permissions.has(key));

                return (
                  <div className="border" key={group.id}>
                    <div className="flex items-center gap-3 bg-secondary/60 px-3 py-2.5">
                      <Switch
                        aria-label={`Todo ${group.label}`}
                        checked={granted.length > 0}
                        onCheckedChange={(checked) => toggle(keys, checked)}
                      />
                      <span className="flex-1 font-bold font-mono text-[11px] uppercase tracking-[0.14em]">
                        {group.label}
                      </span>
                      <span className="tabular font-mono text-[11px] text-muted-foreground">
                        {granted.length}/{keys.length}
                      </span>
                    </div>
                    <div className="grid divide-y">
                      {group.permissions.map((permission) => {
                        const id = `perm-${permission.key}`;
                        return (
                          <div
                            className="flex items-center justify-between gap-3 px-3 py-2 pl-14"
                            key={permission.key}
                          >
                            <label className="text-sm" htmlFor={id}>
                              {permission.label}
                            </label>
                            <Switch
                              checked={permissions.has(permission.key)}
                              id={id}
                              onCheckedChange={(checked) =>
                                toggle([permission.key], checked)
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            {member ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={pending} type="button" variant="ghost">
                    Eliminar usuario
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      ¿Eliminar a {member.name}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borra su cuenta y pierde el acceso al estudio. Sus
                      tarjetas quedan sin responsable.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button disabled={pending} type="submit">
              {pending && "Guardando..."}
              {!pending && (member ? "Guardar cambios" : "Crear usuario")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
