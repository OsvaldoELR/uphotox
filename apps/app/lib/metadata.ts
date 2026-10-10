import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { env } from "@/env";

/**
 * What WhatsApp, Instagram, Google… show when someone shares a link to the
 * app. Every URL without a session lands on /sign-in, so public pages must
 * carry it too.
 */
export const SHARE = {
  title: "Uphotox · Gestiona tu estudio de fotografía",
  description:
    "Lleva cada sesión de tu estudio en un tablero: clientes, etapas, avisos automáticos por correo y WhatsApp, y entregas en un solo lugar.",
  image: {
    url: "/brand/og.jpg",
    width: 1200,
    height: 630,
    alt: "Uphotox · Encuadra. Edita. Entrega.",
  },
} as const;

// Share links must be absolute. Always build them from the app's public URL
// (createMetadata's own base comes from VERCEL_PROJECT_PRODUCTION_URL).
const metadataBase = new URL(env.NEXT_PUBLIC_APP_URL);

const shared = {
  metadataBase,
  openGraph: {
    title: SHARE.title,
    description: SHARE.description,
    images: [SHARE.image],
    locale: "es_ES",
  },
  twitter: {
    title: SHARE.title,
    description: SHARE.description,
    images: [SHARE.image.url],
  },
};

/** Base metadata for the root layout (every page inherits it). */
export const rootMetadata: Metadata = {
  ...shared,
  title: SHARE.title,
  description: SHARE.description,
  applicationName: "Uphotox",
  appleWebApp: { capable: true, title: "Uphotox", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Uphotox", ...shared.openGraph },
  twitter: { card: "summary_large_image", ...shared.twitter },
};

/** Public pages (login, registro…): their own tab title, the brand preview. */
export const publicPageMetadata = ({
  title,
  description,
}: {
  title: string;
  description: string;
}): Metadata =>
  createMetadata({
    title,
    description,
    appleWebApp: { title: "Uphotox" },
    ...shared,
  });
