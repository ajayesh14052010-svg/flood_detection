import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // Tests are DB-free: they exercise pure domain/validation/auth functions and
    // never open a connection. The datasource env vars are set to inert
    // PostgreSQL placeholders only so module-level `new PrismaClient()` (pulled
    // in transitively by ingest.ts) has the schema's referenced vars present.
    // No SQLite / local file is used anywhere.
    env: {
      DATABASE_URL: "postgresql://user:***@localhost:5432/floodguard_test?sslmode=require",
      DIRECT_URL: "postgresql://user:***@localhost:5432/floodguard_test?sslmode=require",
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
