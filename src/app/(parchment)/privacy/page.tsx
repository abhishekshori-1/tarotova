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
        Your first reading needs nothing from you. From the second reading on we ask for an email address,
        only to send a one-time code and remember this browser for 30 days. We don&apos;t use it for
        marketing, and we don&apos;t require an account.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Your question and the personalized reflection</h2>
      <p className="mt-2">
        If you type a question, it is stored with your reading and used to write the reflection that
        appears under &ldquo;For your question&rdquo;. That reflection is written by an AI model run by
        Anthropic: we send it your question, the focus you chose and the meanings of your three cards —
        never your email address, your session or any other reading. Before that, a separate model call
        checks whether the question is one a card reading should not answer (a crisis, or a request for
        medical or legal instruction); in that case you see a written note and resources instead. Questions
        are processed under Anthropic&apos;s API terms and are not used to train their models.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Cookies</h2>
      <p className="mt-2">
        A single session cookie identifies your browser so a verified reading can be shown back to you. It
        doesn&apos;t track you across other sites.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Retention</h2>
      <p className="mt-2">
        An unfinished reading, including any question typed for it, expires 24 hours after it&apos;s
        started. A completed reading — the cards, your question and the reflection written for it — stays
        readable in this browser for up to 30 days and is then deleted. Delivery metadata is kept for 7 days; an address that hard-bounces or is marked as spam is
        kept on a separate, longer-lived suppression list so we stop emailing it.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Deletion requests</h2>
      <p className="mt-2">Contact support (footer link) to request deletion of your data ahead of the schedule above.</p>
    </div>
  );
}
