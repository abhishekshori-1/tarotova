import path from "node:path";
import { db, usingRealPostgres } from "./client";

let migratedPromise: Promise<void> | null = null;

/** Idempotent; safe to call on every cold start (dev server, first request, tests). */
export function ensureMigrated(): Promise<void> {
  if (!migratedPromise) {
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    migratedPromise = usingRealPostgres
      ? import("drizzle-orm/postgres-js/migrator").then(({ migrate }) => migrate(db as never, { migrationsFolder }))
      : import("drizzle-orm/pglite/migrator").then(({ migrate }) => migrate(db as never, { migrationsFolder }));
  }
  return migratedPromise;
}
