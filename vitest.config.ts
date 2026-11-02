import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // Ingest tests use a throwaway SQLite file; keep the app's dev.db clean.
    env: {
      DATABASE_URL: "file:./tests/test.db",
      AUTH_SECRET: "test-auth-secret-please-change",
      DEVICE_TOKEN_SECRET: "test-device-secret-please-change",
      DEMO_MODE: "false",
      STALE_SECONDS: "900",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
