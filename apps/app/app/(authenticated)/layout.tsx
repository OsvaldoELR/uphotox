import { currentUser } from "@repo/auth/server";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { secure } from "@repo/security";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { requireStudio } from "@/lib/studio";
import { GlobalSidebar } from "./components/sidebar";

interface AppLayoutProperties {
  readonly children: ReactNode;
}

const AppLayout = async ({ children }: AppLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await secure(["CATEGORY:PREVIEW"]);
  }

  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // No studio yet (first sign-in) → onboarding.
  const context = await requireStudio();

  return (
    <SidebarProvider>
      <GlobalSidebar
        permissions={context.permissions}
        studioName={context.studio.name}
        user={{
          name: context.member.fullName,
          email: user.email ?? null,
          avatarUrl: user.user_metadata.avatar_url ?? null,
        }}
      >
        {children}
      </GlobalSidebar>
    </SidebarProvider>
  );
};

export default AppLayout;
