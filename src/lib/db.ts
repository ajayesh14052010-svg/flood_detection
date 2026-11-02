// Prisma client singleton — Prisma 6 + Next.js safe pattern.
//
// Next.js dev hot-reload re-evaluates modules, which would otherwise create a
// new PrismaClient (and a new connection pool) on every reload. Caching the
// instance on globalThis in dev prevents connection exhaustion; in production
// a single instance is created once.
//
// This module intentionally does NOT read or print DATABASE_URL. If the
// variable is missing, the first query fails with Prisma's own error, which the
// route handlers / error boundary translate into a safe, generic message — the
// connection string (and its credentials) is never surfaced to the browser.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    // Only surface warn/error from Prisma; never log queries with parameters
    // in production (they could contain device tokens or coordinates).
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
