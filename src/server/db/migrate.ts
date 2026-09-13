import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { db } from "./client";

let migrated = false;

/** Idempotent; safe to call on every cold start (dev server, first request, tests). */
export function ensureMigrated() {
  if (migrated) return;
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  migrated = true;
}
