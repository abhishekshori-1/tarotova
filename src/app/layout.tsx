import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["500", "600"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tarotova — Free Three-Card Tarot Reading",
  description:
    "A calm, free three-card tarot reading — Situation, Challenge, Guidance — from the Major Arcana. Confirm your email once to reveal your cards.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--color-ivory)] text-[var(--color-plum)] antialiased">
        <header className="border-b border-[var(--color-border)] px-6 py-4">
          <Link href="/" className="font-[var(--font-fraunces)] text-lg font-semibold tracking-tight">
            Tarotova
          </Link>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--color-border)] px-6 py-6 text-sm text-[var(--color-plum-soft)]">
          <nav className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <a href="mailto:support@tarotova.example" className="hover:underline">
              Support
            </a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
