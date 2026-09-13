import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep AGENTS.md/CLAUDE.md as authored — this project's already carries
  // the project's own directory-restriction rule (see repo root CLAUDE.md).
  agentRules: false,
};

export default nextConfig;
