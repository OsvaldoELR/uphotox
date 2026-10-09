import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Vercel builds with NODE_ENV=production, which loads React's production
    // bundle (no `act`) and breaks component tests. Tests always run as test.
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
      "@repo": path.resolve(import.meta.dirname, "../../packages"),
      // Server actions pull in server-only modules; tests run outside RSC.
      "server-only": path.resolve(
        import.meta.dirname,
        "../../node_modules/server-only/empty.js"
      ),
    },
  },
});
