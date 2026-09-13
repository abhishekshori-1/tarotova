import path from "node:path";
import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

/**
 * Two backends behind one `db` export:
 *
 * - DATABASE_URL set → real Postgres via postgres.js (Supabase in
 *   production, or any Postgres locally/in CI).
 * - DATABASE_URL unset → embedded pglite (WASM Postgres, Postgres-wire
 *   compatible) so `npm run dev` and `npm test` need no external account —
 *   file-backed under ./data/pglite for dev, in-memory for tests (Vitest
 *   sets VITEST=true).
 *
 * Both paths run the same SQL migrations in ./drizzle (see migrate.ts) —
 * pglite is real enough Postgres for that to just work.
 *
 * The connection itself is created lazily (on first query, via the Proxy
 * below), not at module import time: `next build` loads every route module
 * in several parallel workers just to inspect its exports, and file-backed
 * pglite can't handle several processes opening the same directory at once
 * — instantiating it eagerly here crashed those build workers even though
 * no query was ever run.
 */

// Both drivers implement the same drizzle-orm pg-core query builder at
// runtime; the postgres-js type is used as the single canonical type for
// callers so `.returning()`/`.onConflictDoUpdate()` etc. resolve to one
// consistent (and fully capable) overload set instead of the narrower
// intersection TS would infer from a real union type.
type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;

export const usingRealPostgres = !!process.env.DATABASE_URL;

let instance: Db | undefined;
let closeFn: () => Promise<void> | void = () => {};

function connect(): Db {
  if (instance) return instance;

  if (usingRealPostgres) {
    // Small pool + Supabase's transaction pooler are the serverless-friendly
    // defaults PLAN.md section 5 calls for; a low `max` keeps this safe for
    // a free-tier connection cap.
    const sql = postgres(process.env.DATABASE_URL!, { max: 5, prepare: false });
    instance = drizzlePostgres(sql, { schema });
    closeFn = () => sql.end();
  } else {
    const isTest = !!process.env.VITEST;
    const dataDir = isTest ? undefined : path.join(process.cwd(), "data", "pglite");
    const client = new PGlite(dataDir);
    instance = drizzlePglite(client, { schema }) as unknown as Db;
    closeFn = () => client.close();
  }
  return instance;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(connect() as object, prop, receiver);
  },
});

export const closeDb = () => closeFn();
