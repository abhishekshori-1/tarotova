import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Only used by `drizzle-kit generate` to introspect types; the app
    // itself falls back to pglite when this is unset (see db/client.ts).
    url: process.env.DATABASE_URL ?? "postgres://placeholder/placeholder",
  },
});
