"use client";

import { UserButton } from "@repo/auth/components/user-button";
import { StudioBackdrop } from "@repo/design-system/components/hud/backdrop";
import { CropMarks } from "@repo/design-system/components/hud/crop-marks";
import { Wordmark } from "@repo/design-system/components/hud/wordmark";
import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import { Button } from "@repo/design-system/components/ui/button";
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
import { NotificationsTrigger } from "@repo/notifications/components/trigger";
import {
  AnchorIcon,
  ApertureIcon,
  KanbanIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Search } from "./search";

interface GlobalSidebarProperties {
  readonly children: ReactNode;
  readonly user: {
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

interface NavItem {
  readonly icon: LucideIcon;
  readonly title: string;
  /** Without a url the module is planned but not built yet. */
  readonly url?: string;
}

const studio: NavItem[] = [
  { title: "Panel", url: "/", icon: LayoutDashboardIcon },
  { title: "Tablero", icon: KanbanIcon },
  { title: "Editor", icon: ApertureIcon },
  { title: "Clientes", icon: UsersIcon },
];

const system: NavItem[] = [
  { title: "Webhooks", url: "/webhooks", icon: AnchorIcon },
];

const groupLabel =
  "font-mono text-[10px] text-signal-ink/80 uppercase tracking-[0.3em]";

// Active item: cyan rail on the left edge, like a lit HUD indicator.
const menuButton =
  "data-[active=true]:font-semibold data-[active=true]:shadow-[inset_2px_0_0_var(--signal-ink)]";

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
                isActive={pathname === item.url}
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

export const GlobalSidebar = ({ children, user }: GlobalSidebarProperties) => {
  const pathname = usePathname();

  return (
    <>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-auto py-2" size="lg">
                <Link href="/">
                  <Wordmark kanji />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <Search />
        <SidebarContent>
          <NavGroup items={studio} label="Estudio" pathname={pathname} />
          <div className="mt-auto">
            <NavGroup items={system} label="Sistema" pathname={pathname} />
          </div>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <UserButton
                avatarUrl={user.avatarUrl}
                email={user.email}
                name={user.name}
              />
              <div className="flex shrink-0 items-center gap-px">
                <ModeToggle />
                <Button
                  asChild
                  className="shrink-0"
                  size="icon"
                  variant="ghost"
                >
                  <div className="h-4 w-4">
                    <NotificationsTrigger />
                  </div>
                </Button>
              </div>
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
