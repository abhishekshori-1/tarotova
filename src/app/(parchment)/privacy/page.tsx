export const metadata = { title: "Privacy — Tarotova" };

export default function PrivacyPage() {
  return (
    <div className="prose-measure mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold">Privacy</h1>
      <p className="mt-4 text-sm text-[var(--color-plum-soft)]">
        Draft placeholder — PLAN.md section 7. Replace before any public launch with the operator&apos;s
        actual name, jurisdiction, and a real support contact.
      </p>

      <h2 className="mt-8 text-lg font-semibold">What we collect</h2>
      <p className="mt-2">
        We ask for your email address only to send a one-time verification code and to let you return to
        an already-verified reading. We don&apos;t use it for marketing, and we don&apos;t require an
        account.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Cookies</h2>
      <p className="mt-2">
        A single session cookie identifies your browser so a verified reading can be shown back to you. It
        doesn&apos;t track you across other sites.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Retention</h2>
      <p className="mt-2">
        An unfinished reading and its unverified email expire 24 hours after it&apos;s started. A verified
        reading remains accessible in your browser for up to 30 days after verification, after which it is
        deleted. Delivery metadata is kept for 7 days; an address that hard-bounces or is marked as spam is
        kept on a separate, longer-lived suppression list so we stop emailing it.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Deletion requests</h2>
      <p className="mt-2">Contact support (footer link) to request deletion of your data ahead of the schedule above.</p>
    </div>
  );
}
