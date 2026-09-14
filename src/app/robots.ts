import type { MetadataRoute } from "next";

// Index only the public homepage/policy pages; private reading routes are
// additionally marked noindex in their own layout (PLAN.md section 7/11).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/privacy", "/terms"], disallow: ["/reading/", "/verify", "/api/"] },
  };
}
