import type { Metadata } from "next";

// The continuation gate is private to one browser; never indexable.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
