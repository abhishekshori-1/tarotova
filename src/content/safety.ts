/**
 * Sensitive-intent taxonomy and the authored responses that replace a
 * generated answer (docs/REVIEW-V2.md finding 1 and "Sensitive intent" in
 * the adopted adjustments; eval/RUBRIC.md "Safety routing"). Routing is by
 * intent, decided by a model classifier — never by keyword — and these
 * responses deliberately do not read the cards.
 */
export const SAFETY_CATEGORIES = ["none", "stressful", "crisis", "medical", "legal", "abuse"] as const;
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export const REFUSAL_CATEGORIES = ["crisis", "medical", "legal", "abuse"] as const;
export type RefusalCategory = (typeof REFUSAL_CATEGORIES)[number];

export function isRefusalCategory(category: SafetyCategory): category is RefusalCategory {
  return (REFUSAL_CATEGORIES as readonly string[]).includes(category);
}

export interface SafetyResponse {
  heading: string;
  body: string[];
  resources: { label: string; detail: string; href?: string }[];
}

export const SAFETY_CONTENT_VERSION = "safety.v2";

export const SAFETY_RESPONSES: Record<RefusalCategory, SafetyResponse> = {
  crisis: {
    heading: "This is bigger than a card reading, and you matter more than any spread.",
    body: [
      "What you wrote sounds like real pain, and cards aren't the right thing to answer it with. We're not going to read them for this question — not because it isn't welcome here, but because you deserve a person, not a pattern.",
      "If you're in danger right now, please contact your local emergency number. If you can, reach out to someone you trust and tell them what you told us. Talking to a trained listener is free, confidential and available at any hour in most countries.",
    ],
    resources: [
      { label: "Find a helpline", href: "https://findahelpline.com/", detail: "findahelpline.com lists free, confidential crisis lines by country." },
      { label: "Immediate danger", detail: "Call your local emergency number." },
    ],
  },
  medical: {
    heading: "A reading can't answer a medical question — a clinician can.",
    body: [
      "Decisions about medication, treatment or symptoms need someone who knows your history and can examine you. Tarot doesn't, and we won't offer it as a stand-in for that.",
      "If it helps, you can bring the cards back to something they can hold: how you feel about the appointment, what you want to ask, or how to look after yourself while you wait for an answer.",
    ],
    resources: [
      { label: "Talk to a clinician", detail: "Your doctor, a pharmacist, or a nurse advice line can answer this safely." },
      { label: "Urgent symptoms", detail: "Contact emergency services or an urgent-care service." },
    ],
  },
  legal: {
    heading: "A reading can't tell you your rights or what to file — a lawyer can.",
    body: [
      "Custody, housing, immigration, employment and contract questions turn on facts and deadlines that cards can't see. Getting this wrong has real consequences, so we won't read them for this question.",
      "The cards can still sit with the part that's yours: how you're holding up, what you need from the people around you, and how to steady yourself through the process.",
    ],
    resources: [
      { label: "Legal aid", detail: "Many countries have free or low-cost legal-aid services and tenant or worker advice lines." },
      { label: "Deadlines", detail: "If something is due soon, ask about it first — timing often matters more than anything else." },
    ],
  },
  abuse: {
    heading: "We're not going to read the cards for this one.",
    body: [
      "If someone is hurting, controlling or frightening you, that is not something a spread should weigh in on — your safety comes first, and people who do this for a living can help you think it through privately and at your pace.",
      "If what you wrote is about wanting to hurt someone else, that's also outside what this reading can help with. Talking to someone you trust, or a counsellor, is a better next step than any card.",
    ],
    resources: [
      { label: "Find a helpline", href: "https://findahelpline.com/", detail: "findahelpline.com lists domestic-abuse and support lines by country." },
      { label: "Immediate danger", detail: "Call your local emergency number." },
    ],
  },
};
