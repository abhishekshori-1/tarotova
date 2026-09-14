import Link from "next/link";

interface Props {
  variant: "night" | "parchment";
  children: React.ReactNode;
}

/** Header, main and footer on one of the two surfaces; each route group picks its variant. */
export function Shell({ variant, children }: Props) {
  const surface = variant === "night" ? "surface-night star-map" : "surface-parchment";
  return (
    <div className={`${surface} flex min-h-dvh flex-col`}>
      <header className="px-6 py-4">
        <Link href="/" className="font-[var(--font-fraunces)] text-lg font-semibold tracking-tight text-[var(--fg)]">
          Tarotova
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--line)] px-6 py-6 text-sm text-[var(--fg-soft)]">
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
    </div>
  );
}
