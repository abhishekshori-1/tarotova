import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep AGENTS.md/CLAUDE.md as authored — this project's already carries
  // the project's own directory-restriction rule (see repo root CLAUDE.md).
  agentRules: false,
  // pglite's WASM loader breaks when the production bundler processes it
  // (works fine in `next dev`, which bundles differently) — load it
  // unmodified from node_modules instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
