export const metadata = { title: "Privacy — Tarotova" };

export default function PrivacyPage() {
  return (
    <div className="prose-measure mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold">Privacy</h1>
      <p className="mt-4 text-sm text-[var(--color-plum-soft)]">
        Questions about your privacy? Contact <a className="underline" href="mailto:support@tarotova.com">support@tarotova.com</a>.
      </p>

      <h2 className="mt-8 text-lg font-semibold">What we collect</h2>
      <p className="mt-2">
        Your first reading needs nothing from you. From the second reading on we ask for an email address,
        only to send a one-time code and remember this browser for 30 days. We don&apos;t use it for
        marketing, and we don&apos;t require an account.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Your question</h2>
      <p className="mt-2">
        If you type a question, it is stored with your reading and used to write the part of the reading
        that responds to it. To do that, the question, the focus you chose and the meanings of your three
        cards are processed by third-party service providers on our behalf, under terms that do not allow
        it to be used for any other purpose. Your email address, your session and your other readings are
        never sent with it. Follow-up messages you send about a reading are stored with it and processed the
        same way, together with your earlier messages about that reading. Some questions, such as those
        describing a crisis or asking for medical or legal instruction, are not read against the cards; you
        see a written note and resources instead.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Guided journeys</h2>
      <p className="mt-2">
        A guided journey saves its starting question, its chosen reading, the journey text and your
        progress so you can return in this browser. The starting question is also kept with the journey
        if you edit the reading question later. Journey progress expires with the reading, and its records
        are deleted with it. Closing reflections are for you to consider privately; we do not collect
        a written answer. Moving between journey stages does not send anything to a service provider.
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
