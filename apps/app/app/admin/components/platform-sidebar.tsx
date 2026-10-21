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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { Building2Icon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

interface PlatformSidebarProperties {
  readonly children: ReactNode;
  readonly user: {
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

const items: { title: string; url: string; icon: LucideIcon }[] = [
  { title: "Estudios", url: "/admin", icon: Building2Icon },
];

// Same shell as the studio app (GlobalSidebar), with the platform menu.
export const PlatformSidebar = ({
  children,
  user,
}: PlatformSidebarProperties) => {
  const pathname = usePathname();

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
                <Link href="/admin">
                  <BrandLogo />
                  <span className="w-full truncate font-mono text-[10px] text-flare uppercase tracking-[0.2em]">
                    Superadmin
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="font-mono text-[10px] text-signal-ink/80 uppercase tracking-[0.3em]">
              Plataforma
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className="data-[active=true]:font-semibold data-[active=true]:shadow-[inset_2px_0_0_var(--signal-ink)]"
                      isActive={
                        pathname === item.url ||
                        pathname.startsWith("/admin/estudios")
                      }
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
