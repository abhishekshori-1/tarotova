import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

// ":memory:" (used by the test suite) bypasses the ./data resolution below —
// there's no file to place under a project directory.
const isMemory = process.env.DATABASE_FILE === ":memory:";

// Otherwise scoped to ./data statically (rather than resolving DATABASE_FILE's
// full path) so bundlers don't trace the whole project as a filesystem
// dependency of this module.
const filename = path.basename(process.env.DATABASE_FILE ?? "tarotova.db");
const dataDir = path.join(process.cwd(), "data");
const resolved = isMemory ? ":memory:" : path.join(dataDir, filename);
if (!isMemory) fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(resolved);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
