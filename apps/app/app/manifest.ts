import type { MetadataRoute } from "next";
import { SHARE } from "@/lib/metadata";

// Lets studios add Uphotox to the phone's home screen like an app.
const manifest = (): MetadataRoute.Manifest => ({
  name: "Uphotox",
  short_name: "Uphotox",
  description: SHARE.description,
  lang: "es",
  start_url: "/",
  display: "standalone",
  background_color: "#f5fafc",
  theme_color: "#f5fafc",
  icons: [
    { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "/brand/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
});

export default manifest;
