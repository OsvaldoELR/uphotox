"use client";

import { UserButton } from "@repo/auth/components/user-button";
import { StudioBackdrop } from "@repo/design-system/components/hud/backdrop";
import { CropMarks } from "@repo/design-system/components/hud/crop-marks";
import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import {
  ApertureIcon,
  KanbanIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import type { Permission } from "@/lib/permissions";
import { Search } from "./search";

interface GlobalSidebarProperties {
  readonly children: ReactNode;
  readonly permissions: Permission[];
  readonly studioName: string;
  readonly user: {
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

interface NavItem {
  readonly icon: LucideIcon;
  /** Hidden unless the member has this permission. */
  readonly permission?: Permission;
  readonly title: string;
  /** Without a url the module is planned but not built yet. */
  readonly url?: string;
}

const studio: NavItem[] = [
  { title: "Panel", url: "/", icon: LayoutDashboardIcon },
  {
    title: "Tableros",
    url: "/tableros",
    icon: KanbanIcon,
    permission: "boards.view",
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: UsersIcon,
    permission: "clients.view",
  },
  { title: "Editor", icon: ApertureIcon, permission: "editor.access" },
];

const admin: NavItem[] = [
  {
    title: "Equipo",
    url: "/equipo",
    icon: ShieldCheckIcon,
    permission: "team.manage",
  },
  {
    title: "Ajustes",
    url: "/ajustes",
    icon: Settings2Icon,
    permission: "settings.manage",
  },
];

const groupLabel =
  "font-mono text-[10px] text-signal-ink/80 uppercase tracking-[0.3em]";

// Active item: cyan rail on the left edge, like a lit HUD indicator.
const menuButton =
  "data-[active=true]:font-semibold data-[active=true]:shadow-[inset_2px_0_0_var(--signal-ink)]";

const isActive = (pathname: string, url: string) =>
  url === "/"
    ? pathname === "/"
    : pathname === url || pathname.startsWith(`${url}/`);

const NavGroup = ({
  items,
  label,
  pathname,
}: {
  readonly items: NavItem[];
  readonly label: string;
  readonly pathname: string;
}) => (
  <SidebarGroup>
    <SidebarGroupLabel className={groupLabel}>{label}</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            {item.url ? (
              <SidebarMenuButton
                asChild
                className={menuButton}
                isActive={isActive(pathname, item.url)}
                tooltip={item.title}
              >
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            ) : (
              <>
                <SidebarMenuButton aria-disabled tooltip={item.title}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
                  Pronto
                </SidebarMenuBadge>
              </>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

export const GlobalSidebar = ({
  children,
  permissions,
  studioName,
  user,
}: GlobalSidebarProperties) => {
  const pathname = usePathname();
  const visible = (items: NavItem[]) =>
    items.filter(
      (item) => !item.permission || permissions.includes(item.permission)
    );
  const adminItems = visible(admin);

  return (
    <>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="h-auto flex-col items-start gap-1.5 py-2"
                size="lg"
              >
                <Link href="/">
                  <BrandLogo />
                  <span className="w-full truncate font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                    {studioName}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        {permissions.includes("boards.view") && <Search />}
        <SidebarContent>
          <NavGroup
            items={visible(studio)}
            label="Estudio"
            pathname={pathname}
          />
          {adminItems.length > 0 && (
            <NavGroup
              items={adminItems}
              label="Administración"
              pathname={pathname}
            />
          )}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <UserButton
                avatarUrl={user.avatarUrl}
                email={user.email}
                name={user.name}
              />
              <ModeToggle />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="isolate overflow-hidden md:peer-data-[variant=inset]:shadow-[0_0_0_1px_var(--border)]">
        <StudioBackdrop variant="calm" />
        <CropMarks className="inset-3 hidden md:block" />
        {children}
      </SidebarInset>
    </>
  );
};
