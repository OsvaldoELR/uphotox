import { currentUser } from "@repo/auth/server";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { secure } from "@repo/security";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { isPlatformAdmin } from "@/lib/platform";
import { PlatformSidebar } from "./components/platform-sidebar";

interface AdminLayoutProperties {
  readonly children: ReactNode;
}

// Platform panel (superadmin). Outside (authenticated) on purpose: that
// layout needs a studio, and the platform admin account has none. Each page
// checks requirePlatformAdmin() again before reading anything.
const AdminLayout = async ({ children }: AdminLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await secure(["CATEGORY:PREVIEW"]);
  }

  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!(await isPlatformAdmin())) {
    notFound();
  }

  return (
    <SidebarProvider>
      <PlatformSidebar
        user={{
          name: user.user_metadata.full_name ?? null,
          email: user.email ?? null,
          avatarUrl: user.user_metadata.avatar_url ?? null,
        }}
      >
        {children}
      </PlatformSidebar>
    </SidebarProvider>
  );
};

export default AdminLayout;
