import "./styles.css";
import { AnalyticsProvider } from "@repo/analytics/provider";
import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { rootMetadata } from "@/lib/metadata";

// Title, description and share image every page inherits (lib/metadata.ts).
export const metadata: Metadata = rootMetadata;

interface RootLayoutProperties {
  readonly children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html className={fonts} lang="es" suppressHydrationWarning>
    <body>
      <AnalyticsProvider>
        <DesignSystemProvider>{children}</DesignSystemProvider>
      </AnalyticsProvider>
    </body>
  </html>
);

export default RootLayout;
