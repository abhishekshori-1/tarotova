import type { InterpretationOutput } from "../../src/server/generation/types";

// Authored layout specimen, not an eval result or a published reading. Keep
// real paragraph lengths so a one-line stub cannot stand in for the experience.
export const question = "I have two job offers: one is familiar work and the other is a new field. I want to compare them without deciding today.";
export const answer: InterpretationOutput = {
  perspective: "Comparing the two offers can have a purpose of its own, separate from choosing. The Fool brings the unfamiliar field into view; The Chariot asks how different priorities might pull against one another; The Hermit makes room for an opinion that is yours. Together they offer a way to examine the choice without treating novelty as a virtue or familiarity as a failure of courage. The useful distinction is between what each offer actually contains and what its being familiar or new has come to represent for you.",
  cards: [
    { position: "situation", relevance: "The Fool gives the unfamiliar offer a place in the reading without ranking it above the other. A beginning contains things that can be investigated and things that remain unknown. You might separate a specific question about the role from a general feeling about entering a different field. Neither needs to stand in for the other.\n\nFor example, the work itself, the induction arrangements and the expectations for a first month are different subjects. If any matter to you, they are possible points of comparison. The familiar offer also deserves that attention: familiarity with a kind of work does not establish the details of this particular job. Curiosity can face both offers." },
    { position: "challenge", relevance: "The Chariot introduces the effort of holding a direction when there is more than one pull. Beside your two offers, this is a question about priorities, not evidence that you are torn or that one choice is secretly preferred. Which considerations belong in the comparison, and are any difficult to weigh on the same scale?\n\nA role might appeal for its subject matter while another has a practical feature you value. Those are examples, not facts about these offers. You can leave unlike considerations unlike for a while. A comparison does not have to produce one tidy score, and a preference does not have to erase an inconvenient detail to count as a preference." },
    { position: "guidance", relevance: "The Hermit favours quiet reflection before further conversation. Here it offers space to notice your own questions about the two roles, without assigning you a need to withdraw or prescribing time alone. You have already said that a decision is not today's aim. Understanding what you want to compare is a worthwhile focus for this stage.\n\nIf an approach would be useful, you could give each offer the same unfinished sentence: 'What I would still like to understand about this work is…' There is no need to answer it immediately. The question could be practical, personal, or still hard to name. What matters for this reading is that neither offer gets to skip the questions the other must face." },
  ],
  synthesis: "The cards connect around a distinction between exploration and commitment. The Fool makes space for the unfamiliar, The Chariot considers how you weigh what matters, and The Hermit brings attention back to your own view. None requires the comparison to end in a decision today. A practical detail and a personal preference can both belong on the page without being the same kind of information. You might finish this stage with a clearer question rather than a chosen offer. That would still be something specific to bring into the next conversation.",
  reflection: "What would you want to understand about each offer before trying to name a preference, even if that question has no immediate answer?",
  beyondSpread: null,
};

export const reply = {
  paragraphs: [
    "The unfamiliar part can be considered on its own, without making it a test of courage. The Fool offers curiosity as a theme. That leaves room to be interested in the new field and still want specific information about the work. Interest and readiness to accept an offer are different things.",
    "One distinction is between a question about the role and a question about your response to it. 'What would I be doing?' belongs to the first. 'Which part interests me?' belongs to the second. Those are examples of different questions, not a suggestion that either has already been answered in your situation.",
    "The Chariot brings the comparison back to what you want it to include. You do not have to give an unfamiliar detail more weight merely because it catches your attention. Equally, a familiar feature can matter without needing a dramatic explanation. The comparison can include both without turning either into a verdict.",
    "The Hermit leaves space for your view to remain unfinished. If a question about the work is still open, you can keep it visible instead of replacing it with an assumption. That continues the exploration you described. It does not require choosing the new offer, choosing the familiar one, or deciding before you intended to.",
  ],
  reflection: "Which detail would you like to understand more clearly, and which part is already clear enough to leave alone for now?",
  beyondSpread: null,
};
