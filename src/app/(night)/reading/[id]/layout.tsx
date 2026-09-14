import type { Metadata } from "next";

// Private per-reading pages must never become indexable (PLAN.md section 7/11).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ReadingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
