"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { LogOutIcon } from "lucide-react";
import { useTransition } from "react";
import { signOut } from "../actions";

interface UserButtonProperties {
  readonly avatarUrl?: string | null;
  readonly email?: string | null;
  readonly name?: string | null;
}

const NAME_SEPARATORS = /[\s@._-]+/;

const getInitials = (value: string) =>
  value
    .split(NAME_SEPARATORS)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export const UserButton = ({
  name,
  email,
  avatarUrl,
}: UserButtonProperties) => {
  const [pending, startTransition] = useTransition();
  const label = name || email || "Cuenta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left text-sm outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-7">
          {avatarUrl && <AvatarImage alt={label} src={avatarUrl} />}
          <AvatarFallback className="text-xs">
            {getInitials(label)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" side="top">
        <DropdownMenuLabel className="font-normal">
          {name && <p className="truncate font-medium">{name}</p>}
          {email && (
            <p className="truncate text-muted-foreground text-xs">{email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={() => startTransition(() => signOut())}
        >
          <LogOutIcon />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
