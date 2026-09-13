export {};

// Runs before every test file. Must set env vars before any test imports
// src/server/db/client.ts, since that module opens the database as a
// side effect of being imported. Vitest already sets NODE_ENV=test and
// VITEST=true — with DATABASE_URL left unset, client.ts picks in-memory
// pglite specifically because VITEST is set (see db/client.ts).
delete process.env.DATABASE_URL;
process.env.OTP_HMAC_SECRET ??= "test-otp-secret";
process.env.OTP_HMAC_KEY_VERSION ??= "1";
process.env.SESSION_HASH_SECRET ??= "test-session-secret";

// Each test file gets its own module registry (and so its own in-memory
// database) under Vitest's default isolation — migrate it once per file.
const { ensureMigrated } = await import("@/server/db/migrate");
await ensureMigrated();
