import type { CardContent } from "./types";

/**
 * Draft-quality RWS Major Arcana content (see versions.ts — not yet
 * reviewed by an RWS practitioner). Upright only, per PLAN.md section 1/4:
 * a Challenge-position text names the upright card's difficulty or tension
 * in that context rather than switching to a reversed meaning. Symbolism
 * follows Waite's own numbering (Strength VIII, Justice XI).
 */
export const CARDS: CardContent[] = [
  {
    id: "major-00-fool",
    number: 0,
    name: "The Fool",
    numeral: "0",
    keywords: ["beginnings", "trust", "an open road"],
    coreMeaning: "A step into the unknown, taken with curiosity rather than a fixed plan.",
    position: {
      situation:
        "You're standing at the edge of something new, with more openness than certainty about where it leads. The details aren't fixed yet, and that's part of what makes this moment feel light and a little exposed at once.",
      challenge:
        "The pull here is to move before you've looked, or to mistake momentum for direction. Enthusiasm can outrun preparation, leaving loose ends that a little more looking-before-leaping would have caught.",
      guidance:
        "Let curiosity lead, but pair it with one or two grounding checks rather than none at all. You don't need the whole path mapped — just enough footing to take the next real step.",
    },
    focus: {
      general: "A fresh start is available if you're willing to walk toward it without every answer in hand.",
      relationships: "An early, undefined stage — worth entering with openness, not with the outcome already decided.",
      work: "A new direction or role is on the table; treat it as an experiment, not a verdict on your worth.",
      growth: "Practice starting before you feel fully ready — readiness often arrives during the walk, not before it.",
    },
  },
  {
    id: "major-01-magician",
    number: 1,
    name: "The Magician",
    numeral: "I",
    keywords: ["resourcefulness", "focus", "making it real"],
    coreMeaning: "The tools you already have are enough to begin turning an idea into something real.",
    position: {
      situation:
        "You have more resources at hand than you may be crediting — skill, timing, or people willing to help. The question is less what's available and more what you choose to do with it.",
      challenge:
        "It's easy to scatter effort across too many directions, or to talk about a plan more than act on it. Focus, not more inputs, is what this moment is actually short on.",
      guidance:
        "Pick one concrete action and follow it through before reaching for the next tool. A single well-used resource outperforms a pile of unused ones.",
    },
    focus: {
      general: "You have what you need to act; the missing piece is a decision to start, not another resource.",
      relationships: "Say plainly what you want rather than hinting — clarity here does more work than charm.",
      work: "A skill or project you've been circling is ready for deliberate, focused effort.",
      growth: "Translate one intention into one visible action this week, and let that be the whole goal.",
    },
  },
  {
    id: "major-02-high-priestess",
    number: 2,
    name: "The High Priestess",
    numeral: "II",
    keywords: ["intuition", "quiet knowing", "what's not yet said"],
    coreMeaning: "Something is known beneath the surface before it's ready to be explained out loud.",
    position: {
      situation:
        "There's more going on than what's been said outright — a sense, a hunch, information that hasn't fully surfaced yet. Patience with the not-knowing is part of what this moment asks of you.",
      challenge:
        "The temptation is to force an answer before it's ready, or to talk yourself out of a hunch because it isn't provable yet. Rushing past intuition here tends to cost you the very thing it was pointing at.",
      guidance:
        "Give it a little more time before deciding. Notice what you already sense, write it down, and let the fuller picture arrive rather than manufacturing one early.",
    },
    focus: {
      general: "Trust a quiet instinct enough to sit with it before acting on or dismissing it.",
      relationships: "Something unspoken matters here; a direct, gentle question may surface it faster than guessing.",
      work: "A hunch about timing or people is worth weighing alongside the visible facts, not instead of them.",
      growth: "Build in quiet, unscheduled time — insight here tends to arrive in the gaps, not the agenda.",
    },
  },
  {
    id: "major-03-empress",
    number: 3,
    name: "The Empress",
    numeral: "III",
    keywords: ["abundance", "nurturing", "letting things grow"],
    coreMeaning: "Something is ready to be tended and given room to grow, rather than forced or hurried.",
    position: {
      situation:
        "There's a sense of things ripening — a relationship, a project, an idea — that responds better to steady care than to pressure. Growth is happening, even if it's not dramatic yet.",
      challenge:
        "Overgiving or overextending is the risk: pouring so much into something (or someone) that your own reserves run thin. Generosity without limits stops being sustainable.",
      guidance:
        "Keep tending what matters, but set a boundary on how much you give before refilling your own cup. Care that includes yourself lasts longer than care that doesn't.",
    },
    focus: {
      general: "Nurture what's already growing rather than starting something new right now.",
      relationships: "Warmth and attentiveness go a long way here — and so does not losing yourself in giving it.",
      work: "A slower, cultivating approach — mentoring, refining, building relationships — suits this moment better than a hard push.",
      growth: "Practice receiving care as readily as you give it; it's a skill, not an indulgence.",
    },
  },
  {
    id: "major-04-emperor",
    number: 4,
    name: "The Emperor",
    numeral: "IV",
    keywords: ["structure", "stability", "clear boundaries"],
    coreMeaning: "Structure and a clear boundary are what turn a good intention into something dependable.",
    position: {
      situation:
        "Things need a firmer shape — a plan, a boundary, a decision that holds — rather than staying open-ended indefinitely. Structure is what's being called for, not more flexibility.",
      challenge:
        "The risk is rigidity: holding a boundary so tightly it stops serving anyone, including you, or leading with control where trust would work better.",
      guidance:
        "Set the structure you actually need, then check it periodically instead of treating it as permanent. A boundary should serve the goal, not replace it.",
    },
    focus: {
      general: "Bring a plan or a boundary into a situation that's been left too open-ended.",
      relationships: "Clear expectations, stated plainly, will serve this better than hoping things settle on their own.",
      work: "Structure — a schedule, a scope, a decision-maker — is what's missing more than additional effort.",
      growth: "Build one dependable routine rather than several ambitious ones you won't keep.",
    },
  },
  {
    id: "major-05-hierophant",
    number: 5,
    name: "The Hierophant",
    numeral: "V",
    keywords: ["tradition", "shared method", "learning from others"],
    coreMeaning: "An established method, mentor, or shared understanding is more useful here than reinventing things alone.",
    position: {
      situation:
        "There's value in a known approach or a more experienced perspective, rather than working this out entirely from scratch. Some part of this has been figured out before.",
      challenge:
        "Following convention without checking whether it fits can leave you attached to a method that no longer serves the actual situation.",
      guidance:
        "Borrow what's genuinely useful from established practice or a mentor's advice, and adapt the rest rather than accepting or rejecting it wholesale.",
    },
    focus: {
      general: "A teacher, mentor, or established framework has something worth learning right now.",
      relationships: "Shared values or a shared community may matter more here than either of you has said aloud.",
      work: "Process and precedent are useful guides here — check what's worked before you improvise.",
      growth: "Find someone who has already walked this path and ask them a specific question.",
    },
  },
  {
    id: "major-06-lovers",
    number: 6,
    name: "The Lovers",
    numeral: "VI",
    keywords: ["connection", "values", "a real choice"],
    coreMeaning: "A meaningful choice is in front of you, one that asks what you actually value, not just what's easiest.",
    position: {
      situation:
        "A connection or a decision is asking you to be honest about what you want, rather than what looks good or keeps the peace. The stakes feel personal, not abstract.",
      challenge:
        "Avoiding the choice, or making it to please someone else, tends to cost more later than making it clearly now.",
      guidance:
        "Name what you actually value before deciding, and let that — not obligation or fear of disappointing someone — lead the choice.",
    },
    focus: {
      general: "A choice in front of you is really about values; get clear on those first.",
      relationships: "Alignment matters more here than compromise for its own sake — check that your values actually match.",
      work: "A decision between two paths is really a decision about what you want your work to stand for.",
      growth: "Practice choosing based on what you value, and naming that reason to yourself out loud.",
    },
  },
  {
    id: "major-07-chariot",
    number: 7,
    name: "The Chariot",
    numeral: "VII",
    keywords: ["drive", "focused will", "holding two things together"],
    coreMeaning: "Forward motion, held together by focus and will even when the pull is coming from two directions.",
    position: {
      situation:
        "You're moving, and moving with intent — but it's taking real effort to keep opposing pressures pointed the same way. Progress here is earned, not coasted into.",
      challenge:
        "Pushing through on will alone can tip into forcing things, or ignoring signs that the direction itself needs adjusting, not just more effort.",
      guidance:
        "Keep steering deliberately rather than gritting through — check the direction as often as you check your effort.",
    },
    focus: {
      general: "Determined, focused effort will move this forward — as long as it stays steered, not just forceful.",
      relationships: "Two different needs are pulling here; hold them both in view rather than letting one win by default.",
      work: "A push toward a goal is working, but confirm you're still driving toward the right one.",
      growth: "Build the discipline to keep going after the initial motivation fades.",
    },
  },
  {
    id: "major-08-strength",
    number: 8,
    name: "Strength",
    numeral: "VIII",
    keywords: ["quiet courage", "patience", "gentleness that holds"],
    coreMeaning: "A steady, patient kind of courage — the strength that persuades rather than forces.",
    position: {
      situation:
        "Something here responds better to patience and steadiness than to force. It may look like a hard, urgent problem, but it's actually asking for calm persistence.",
      challenge:
        "Reaching for control or confrontation when patience would work better tends to make this harder, not easier.",
      guidance:
        "Meet the difficulty gently and consistently rather than forcefully. Quiet resolve, kept up over time, is the more effective move here.",
    },
    focus: {
      general: "Patience and a steady hand will do more here than pushing harder.",
      relationships: "Meet friction with calm rather than control — it tends to soften rather than escalate.",
      work: "A difficult colleague or situation responds better to consistency than confrontation.",
      growth: "Practice staying calm with your own setbacks rather than being harsh with yourself about them.",
    },
  },
  {
    id: "major-09-hermit",
    number: 9,
    name: "The Hermit",
    numeral: "IX",
    keywords: ["solitude", "reflection", "an inward light"],
    coreMeaning: "Stepping back from the noise to think clearly, before stepping back in.",
    position: {
      situation:
        "This calls for some distance — from advice, from noise, from other people's opinions — so you can hear your own read on things clearly.",
      challenge:
        "Too much withdrawal can tip into isolation, where useful outside perspective stops reaching you at all.",
      guidance:
        "Take the quiet time you need, but set a point where you'll re-engage rather than staying withdrawn indefinitely.",
    },
    focus: {
      general: "Some solitude will clarify this faster than more conversation about it would.",
      relationships: "A little space, used well, may help more right now than another conversation would.",
      work: "Step back from the group chat and think this through on your own first.",
      growth: "Schedule real, protected time alone with the question, not just around it.",
    },
  },
  {
    id: "major-10-wheel",
    number: 10,
    name: "Wheel of Fortune",
    numeral: "X",
    keywords: ["change", "cycles", "a turning point"],
    coreMeaning: "Circumstances are shifting on their own timeline — a turning point rather than a fixed state.",
    position: {
      situation:
        "Things are moving, and not entirely on your terms — a cycle turning, an outside factor changing the shape of things. What felt fixed a while ago may not be fixed now.",
      challenge:
        "Fighting the turn, or assuming the current state (good or bad) is permanent, works against you here.",
      guidance:
        "Adapt to the shift rather than resisting it, and look for the opening this particular turn creates.",
    },
    focus: {
      general: "Circumstances are turning; work with the change rather than trying to hold the old shape in place.",
      relationships: "A relationship may be entering a different phase — notice it rather than expecting things to stay as they were.",
      work: "Timing and circumstance are shifting in your favor or against it; read the moment rather than assuming last month's rules still apply.",
      growth: "Notice a pattern that's cycled before, and ask what you'd do differently this time round.",
    },
  },
  {
    id: "major-11-justice",
    number: 11,
    name: "Justice",
    numeral: "XI",
    keywords: ["fairness", "clear-eyed truth", "consequence"],
    coreMeaning: "An honest, even-handed look at cause and effect, without spin in either direction.",
    position: {
      situation:
        "Something here needs a clear-eyed, fair accounting — of facts, of responsibility, of what actually led to what — more than it needs a favorable story.",
      challenge:
        "Bending the facts to protect your own side of it, or avoiding a decision because fairness feels uncomfortable, tends to backfire later.",
      guidance:
        "Look at the situation as evenly as you can, including your own part in it, before deciding what's fair to do next.",
    },
    focus: {
      general: "An honest accounting of the facts — including your own role — will serve you better than a comfortable story.",
      relationships: "Be as fair to their side of it as you want them to be to yours.",
      work: "A decision or agreement needs to be evaluated on its actual merits, not on who's more persuasive.",
      growth: "Take stock honestly of a pattern of your own before asking anyone else to change theirs.",
    },
  },
  {
    id: "major-12-hanged-man",
    number: 12,
    name: "The Hanged Man",
    numeral: "XII",
    keywords: ["pause", "a different angle", "letting go of urgency"],
    coreMeaning: "A deliberate pause that changes how the whole situation looks from a new angle.",
    position: {
      situation:
        "Progress, in the usual sense, isn't the point right now — a pause is. Something looks different once you stop pushing at it the same way.",
      challenge:
        "Treating the pause as failure, or forcing action just to feel like you're doing something, defeats the point of it.",
      guidance:
        "Let the pause do its work. Use the stillness to see the situation from an angle you couldn't reach while moving.",
    },
    focus: {
      general: "A pause here isn't wasted time — it's what lets you see this differently.",
      relationships: "Stepping back from trying to fix it may reveal what actually needs fixing.",
      work: "Delay isn't always the enemy; some decisions genuinely improve with a deliberate wait.",
      growth: "Practice sitting with an unresolved question instead of rushing to close it.",
    },
  },
  {
    id: "major-13-death",
    number: 13,
    name: "Death",
    numeral: "XIII",
    keywords: ["ending", "transformation", "making room for what's next"],
    coreMeaning:
      "In the RWS tradition this card is read as symbolic transformation and ending, not a literal or predictive event — a phase concluding so another can begin.",
    position: {
      situation:
        "Something here has run its course, whether or not that's been acknowledged yet. This reads as an ending that clears space, not a warning of harm.",
      challenge:
        "Holding onto a phase, a role, or a way of doing things after it's finished tends to cost more than letting it close.",
      guidance:
        "Let the ending be an ending. Naming what's finished, even briefly, tends to make room for what comes after it faster.",
    },
    focus: {
      general: "Something is ending; treating it plainly, instead of avoiding it, opens the next stage sooner.",
      relationships: "A dynamic or a chapter may have run its course — worth naming rather than prolonging out of habit.",
      work: "A role, project, or way of working may be finished; that's a transition to plan for, not a setback to fear.",
      growth: "Let go of a version of yourself you've outgrown, deliberately rather than by accident.",
    },
  },
  {
    id: "major-14-temperance",
    number: 14,
    name: "Temperance",
    numeral: "XIV",
    keywords: ["balance", "patience", "blending, not choosing"],
    coreMeaning: "Slow, deliberate blending — finding the measure between two things rather than picking one extreme.",
    position: {
      situation:
        "Two competing needs or approaches are both present, and the resolution is a careful blend, not an either/or choice made in a hurry.",
      challenge:
        "Impatience is the main risk — reaching for an extreme or a quick fix when a slower, more balanced approach would actually hold.",
      guidance:
        "Take this one measured step at a time, mixing rather than choosing, and let the balance settle gradually.",
    },
    focus: {
      general: "A patient, balanced approach will serve this better than picking a side quickly.",
      relationships: "Look for the middle ground between two real needs, rather than one person simply yielding.",
      work: "Moderate, steady adjustments will outperform a dramatic overhaul right now.",
      growth: "Practice a middle-path habit — neither the extreme you're used to nor its opposite.",
    },
  },
  {
    id: "major-15-devil",
    number: 15,
    name: "The Devil",
    numeral: "XV",
    keywords: ["attachment", "old patterns", "a chain you can see"],
    coreMeaning:
      "In this tradition, a symbol of attachment and restriction to an old pattern — one that's usually more loosely bound than it feels.",
    position: {
      situation:
        "A familiar pattern — a habit, a dynamic, a way of thinking — has more grip than it probably deserves. It's worth naming plainly rather than around.",
      challenge:
        "The real difficulty is believing the pattern is fixed and unchangeable, which is usually the part that isn't true.",
      guidance:
        "Name the pattern specifically, and look for the one place it's actually loosely tied, not iron-bound. That's usually where change becomes possible.",
    },
    focus: {
      general: "A familiar pattern has more hold over this than it needs to; naming it is the first real move.",
      relationships: "Check for a dynamic you've both fallen into out of habit rather than choice.",
      work: "A limiting belief about what's possible here may be doing more damage than the actual constraint.",
      growth: "Identify one habit you've assumed is permanent, and test that assumption directly.",
    },
  },
  {
    id: "major-16-tower",
    number: 16,
    name: "The Tower",
    numeral: "XVI",
    keywords: ["sudden change", "a hard truth surfacing", "rebuilding"],
    coreMeaning:
      "A sudden, clarifying disruption — read here as an overdue truth breaking through, not a forecast of disaster.",
    position: {
      situation:
        "Something built on shaky ground is being tested, possibly suddenly. It's uncomfortable, and it's also honest — what wasn't solid is being shown for what it is.",
      challenge:
        "Trying to hold up a structure — a plan, a belief, a relationship — that's already cracked tends to cost more than letting it fall and rebuilding deliberately.",
      guidance:
        "Let the disruption reveal what it's revealing, and use the clearer ground afterward to rebuild something sturdier.",
    },
    focus: {
      general: "A sudden shift is clarifying, not catastrophic — use what it reveals to rebuild on firmer ground.",
      relationships: "An uncomfortable truth may be surfacing; better addressed directly than patched over again.",
      work: "A plan that wasn't as solid as it looked may need an honest rebuild, not a quick patch.",
      growth: "Let a disruptive realization actually change something, instead of smoothing it over.",
    },
  },
  {
    id: "major-17-star",
    number: 17,
    name: "The Star",
    numeral: "XVII",
    keywords: ["hope", "quiet renewal", "restored faith"],
    coreMeaning: "A calm return of hope after something difficult — renewal that doesn't need to be dramatic to be real.",
    position: {
      situation:
        "After a harder stretch, there's room to breathe and reconnect with what you actually hope for, without needing every answer resolved yet.",
      challenge:
        "Cynicism or impatience for immediate results can crowd out the quieter renewal that's actually available right now.",
      guidance:
        "Let hope be modest and steady rather than dramatic. Small, consistent acts of care for the goal are enough for now.",
    },
    focus: {
      general: "A quieter, steadier kind of hope is available here — no need to force it into something bigger.",
      relationships: "Trust is rebuilding gradually; let it, rather than demanding proof all at once.",
      work: "A project or goal that felt stalled has renewed room to move, gently and steadily.",
      growth: "Reconnect with something you hope for, without needing it to be resolved today.",
    },
  },
  {
    id: "major-18-moon",
    number: 18,
    name: "The Moon",
    numeral: "XVIII",
    keywords: ["uncertainty", "imagination", "what's not fully visible yet"],
    coreMeaning: "Things aren't fully clear yet, and imagination or anxiety can fill the gaps faster than facts can.",
    position: {
      situation:
        "Some part of this is genuinely unclear right now, and it's easy for worry or assumption to fill in the missing pieces before you actually have them.",
      challenge:
        "Treating an imagined worst case as settled fact, instead of as one possibility among several, is the trap here.",
      guidance:
        "Notice what's assumption versus what's confirmed, and give it time to become clearer before reacting to the story you've built.",
    },
    focus: {
      general: "Some of this is still unclear; be careful not to treat your worry as settled fact.",
      relationships: "A misunderstanding may be more assumption than truth — ask before you conclude.",
      work: "Ambiguity here is real, but it's temporary; more information is likely still coming.",
      growth: "Notice a recurring anxious story you tell yourself, and check it against what's actually known.",
    },
  },
  {
    id: "major-19-sun",
    number: 19,
    name: "The Sun",
    numeral: "XIX",
    keywords: ["clarity", "vitality", "uncomplicated joy"],
    coreMeaning: "A clear, warm, uncomplicated kind of good — clarity and energy without needing a catch.",
    position: {
      situation:
        "Something here is more straightforwardly good than it might feel comfortable admitting — clear, warm, and worth simply enjoying.",
      challenge:
        "Second-guessing a good thing, or waiting for a catch that isn't actually there, can get in the way of appreciating it.",
      guidance:
        "Let this be as good as it looks. Bring your energy to it openly rather than bracing for a downside.",
    },
    focus: {
      general: "Let something good be simply good, without immediately looking for the catch.",
      relationships: "Warmth and openness are well placed here — this is a moment to enjoy, not overanalyze.",
      work: "Momentum and recognition are available; use the energy while it's here.",
      growth: "Notice what's actually going well, and let yourself feel good about it plainly.",
    },
  },
  {
    id: "major-20-judgement",
    number: 20,
    name: "Judgement",
    numeral: "XX",
    keywords: ["reckoning", "a call to act", "waking up to it"],
    coreMeaning: "A clear-eyed reckoning with where things actually stand, and a call to respond to it.",
    position: {
      situation:
        "Something you've half-known is asking to be fully acknowledged now — a pattern, a result, a truth you've been circling.",
      challenge:
        "Staying in denial, or judging yourself harshly for what the reckoning reveals, both get in the way of actually responding to it.",
      guidance:
        "Acknowledge what the honest look shows you, without over-punishing yourself for it, and let it inform your next real decision.",
    },
    focus: {
      general: "A clear look at where things stand is calling for a response, not more avoidance.",
      relationships: "A pattern you've both half-noticed may be ready to be named plainly.",
      work: "The results so far are worth an honest review before deciding what's next.",
      growth: "Take stock of where you actually are, without the harsh self-judgment layered on top.",
    },
  },
  {
    id: "major-21-world",
    number: 21,
    name: "The World",
    numeral: "XXI",
    keywords: ["completion", "wholeness", "arrival"],
    coreMeaning: "A cycle reaching genuine completion — arrival, not just an ending.",
    position: {
      situation:
        "Something is coming together into a whole — a project finishing, a phase completing, pieces that have been separate finally fitting.",
      challenge:
        "Rushing straight into the next thing without acknowledging the completion can leave it feeling unfinished even once it's done.",
      guidance:
        "Take a real moment to recognize what's been completed before starting the next cycle. Closure deserves its own attention.",
    },
    focus: {
      general: "Something is reaching real completion; let yourself acknowledge it before moving straight to the next thing.",
      relationships: "A shared effort or chapter is coming full circle — worth marking together.",
      work: "A project nearing completion deserves a proper close, not an immediate pivot to the next one.",
      growth: "Recognize a cycle you've completed, and let that recognition be part of what comes next.",
    },
  },
];

export function getCardById(id: string): CardContent | undefined {
  return CARDS.find((c) => c.id === id);
}
