import type { CardContent } from "./types";

/**
 * The 22 Major Arcana, RWS meanings, upright only (see versions.ts: still
 * not reviewed by a practitioner). Symbolism follows Waite's numbering
 * (Strength VIII, Justice XI). A Challenge text names the upright card's
 * difficulty in that position, never a reversed meaning.
 *
 * Stance (docs/RELEASE-B-QUALITY-REVIEW.md, "The library needs a change of
 * stance"): every sentence here is a theme to consider, an angle, or a
 * question. None of it is a finding about the person reading it. The
 * library never says what they have, what they feel, why something
 * happened, whether a fear is imaginary, or whether a constraint is real.
 * The model that writes the personalized answer grounds itself on this
 * text, so any verdict written here becomes a verdict in someone's reading.
 *
 * Voice: plain words, short sentences, warm, no lecture. "Worth asking",
 * "one way to look at it", "if that fits" are the register.
 */
export const CARDS: CardContent[] = [
  {
    id: "major-00-fool",
    number: 0,
    name: "The Fool",
    numeral: "0",
    keywords: ["beginnings", "openness", "a first step"],
    coreMeaning: "A first step into something new, taken with curiosity rather than a finished plan.",
    position: {
      situation:
        "This card is about a beginning: an edge, a first step, a road that is not mapped yet. It may help to ask where in your question something is only starting, and how it feels to stand at that edge.",
      challenge:
        "The Fool's difficulty is moving before looking. Enthusiasm can run ahead of the practical checks a step deserves. One question to hold: what would you want to know before the next move, and what could wait?",
      guidance:
        "If it fits, let curiosity lead, and pair it with a check or two rather than none. The whole path does not need mapping. Enough footing for the next real step may be all this asks for.",
    },
    focus: {
      general: "A fresh start is one of the themes here. Whether it fits, and how big a step feels right, is yours to weigh.",
      relationships: "This card speaks to early, undefined stages. If that matches, it invites openness without deciding the outcome in advance.",
      work: "A new direction or role is a possible reading. If so, it can be treated as an experiment rather than a verdict on your worth.",
      growth: "Starting before feeling fully ready is worth considering. Readiness sometimes arrives during the walk, not before it.",
    },
  },
  {
    id: "major-01-magician",
    number: 1,
    name: "The Magician",
    numeral: "I",
    keywords: ["resourcefulness", "focus", "making it real"],
    coreMeaning: "Turning an idea into something real by choosing what to work with and where to point it.",
    position: {
      situation:
        "The Magician raises the theme of resources and focus: skill, timing, tools, people, and the act of choosing which to use. Worth taking stock of what is within reach, and just as honestly, what is not.",
      challenge:
        "The difficulty with this card is scattering: effort spread across too many directions, or planning that stands in for doing. If that rings true, the question is where a single, deliberate effort would count most.",
      guidance:
        "The card's suggestion is plain: pick one concrete action and follow it through before reaching for the next tool. That is an invitation, not a claim that every tool is already in hand. Naming what is missing is part of the same work.",
    },
    focus: {
      general: "Resourcefulness and focus are the themes. The card cannot know your resources; it asks what could be done with the ones you can name.",
      relationships: "Taken as advice, it says: say plainly what you want, rather than hinting. Clarity can do more work than charm, if that fits your situation.",
      work: "A skill or project may be ready for deliberate, focused effort. Which one, and whether the means are there, is yours to judge.",
      growth: "One intention, one visible action this week, if that is possible for you. Small and real beats large and imagined.",
    },
  },
  {
    id: "major-02-high-priestess",
    number: 2,
    name: "The High Priestess",
    numeral: "II",
    keywords: ["intuition", "quiet knowing", "what is not yet said"],
    coreMeaning: "Something sensed before it can be explained, and the patience to let it surface.",
    position: {
      situation:
        "This card turns the reading toward the unsaid: a hunch, a sense of something not fully on the table yet. A fair question is whether part of your question is being felt before it can be put into words.",
      challenge:
        "The High Priestess's difficulty is forcing an answer before it is ready, or dismissing a sense because it cannot yet be proved. Neither the hunch nor the facts settles this alone.",
      guidance:
        "One option: give it a little more time. Write down what you sense, keep gathering what you know, and let the fuller picture arrive rather than manufacturing one early.",
    },
    focus: {
      general: "A quiet instinct is worth noticing. The card does not say whether it is right, only that it deserves a hearing alongside the facts.",
      relationships: "Something unspoken may matter here. A direct, gentle question is one way to find out, rather than guessing.",
      work: "A sense about timing or people can be weighed next to the visible facts, not instead of them.",
      growth: "Quiet, unscheduled time is one thing to consider. Some understanding arrives in the gaps, not on the agenda.",
    },
  },
  {
    id: "major-03-empress",
    number: 3,
    name: "The Empress",
    numeral: "III",
    keywords: ["nurture", "growth", "giving things room"],
    coreMeaning: "Care and time given to something so it can grow, rather than pressure to make it hurry.",
    position: {
      situation:
        "The Empress brings the theme of growth that answers to tending rather than force: a relationship, a project, an idea. You might ask what in your question might be growing quietly, and what it needs.",
      challenge:
        "The difficulty here is giving past your own reserves: care that runs out because nothing refills it. If that sounds familiar, the question is where the limit of your giving sits right now.",
      guidance:
        "Read gently, this says: keep tending what matters, and decide how much you can give before you need refilling yourself. Care that includes you tends to last longer than care that leaves you out.",
    },
    focus: {
      general: "Nurturing what already exists, rather than starting something new, is one theme to weigh.",
      relationships: "Warmth and attention are the themes, and so is not losing yourself in giving them.",
      work: "A slower, cultivating approach, such as mentoring, refining, or building relationships, is one option this card puts on the table.",
      growth: "Receiving care as readily as you give it is a skill, not an indulgence. The card asks how that goes for you.",
    },
  },
  {
    id: "major-04-emperor",
    number: 4,
    name: "The Emperor",
    numeral: "IV",
    keywords: ["structure", "stability", "clear boundaries"],
    coreMeaning: "Structure and a clear boundary, the things that turn a good intention into something dependable.",
    position: {
      situation:
        "This card speaks to structure: a plan, a boundary, a decision that holds. One question to hold: whether some part of your question has stayed open-ended longer than serves you, and whether a firmer shape would help or would just feel safer.",
      challenge:
        "The Emperor's difficulty is rigidity: a boundary held so tightly it stops serving anyone, or control reached for where trust might work. Worth asking which of those, if either, is in play.",
      guidance:
        "Here is what it offers: set the structure you need, then check it now and then instead of treating it as permanent. A boundary is there to serve the goal, not to replace it.",
    },
    focus: {
      general: "Bringing a plan or a boundary to something left open is worth a thought.",
      relationships: "Clear expectations, said plainly, are one option here. Whether they are wanted, and by whom, is a conversation.",
      work: "Structure, such as a schedule, a scope, or a decision-maker, is one candidate for what is missing. More effort is another. Worth telling them apart.",
      growth: "One dependable routine may serve better than several ambitious ones. Only you know which routine, and what it costs.",
    },
  },
  {
    id: "major-05-hierophant",
    number: 5,
    name: "The Hierophant",
    numeral: "V",
    keywords: ["tradition", "shared method", "learning from others"],
    coreMeaning: "A known method, a teacher, or a shared understanding, useful when something has been worked out before.",
    position: {
      situation:
        "The Hierophant is about the tried path: an established approach, a mentor, a community that has faced this before. It may help to ask who or what has already worked out part of your question.",
      challenge:
        "The difficulty is following a convention without checking whether it fits. A method that served others may not serve this. The question is which parts to keep.",
      guidance:
        "As guidance: borrow what is genuinely useful from established practice or from someone experienced, and adapt the rest. Wholesale acceptance and wholesale rejection are both shortcuts.",
    },
    focus: {
      general: "A teacher, a mentor, or an established framework is one place to look. Whether they fit your situation is yours to judge.",
      relationships: "Shared values or a shared community may matter more here than has been said aloud. Worth asking.",
      work: "Process and precedent are one guide. Checking what worked before improvising is a reasonable step, not the only one.",
      growth: "Finding someone who has walked this path and asking them one specific question is a small, concrete option.",
    },
  },
  {
    id: "major-06-lovers",
    number: 6,
    name: "The Lovers",
    numeral: "VI",
    keywords: ["connection", "values", "a real choice"],
    coreMeaning: "A choice that asks what you value, not only what is easiest or keeps the peace.",
    position: {
      situation:
        "This card raises the theme of a meaningful choice, often about connection, and the values underneath it. It cannot tell you what anyone feels. It can ask what matters most to you in the decision your question holds.",
      challenge:
        "The Lovers' difficulty is choosing to please someone else, or not choosing at all. A fair question is whose wishes are shaping the decision, and whether yours are among them.",
      guidance:
        "The simplest reading: name what you value before deciding, and let that lead rather than obligation or fear of disappointing someone. The choice stays yours either way.",
    },
    focus: {
      general: "A choice in front of you may really be about values. Getting clear on those first is one approach.",
      relationships: "Alignment of values is the theme, more than compromise for its own sake. Whether they match is something to find out, not assume.",
      work: "A decision between paths can be a decision about what you want your work to stand for. That is one lens, not the only one.",
      growth: "Choosing on the basis of what you value, and saying that reason to yourself plainly, is a practice worth trying.",
    },
  },
  {
    id: "major-07-chariot",
    number: 7,
    name: "The Chariot",
    numeral: "VII",
    keywords: ["drive", "focused will", "holding two things together"],
    coreMeaning: "Forward motion held together by will, even when the pull comes from two directions.",
    position: {
      situation:
        "The Chariot turns the reading toward momentum under tension: moving with intent while different pressures pull in different ways. You might ask where in your question there is drive, and what it is being asked to hold together.",
      challenge:
        "The difficulty with this card is will used alone: pushing through when the direction itself, not the effort, is what needs a look. If that fits, the question is what a change of course would cost and what it would gain.",
      guidance:
        "If it fits, steer deliberately rather than grit through. Check the direction as often as the effort. Progress that is earned can still be pointed the wrong way, which is a reason to look, not a verdict.",
    },
    focus: {
      general: "Focused effort is the theme, with the reminder that it works best when steered rather than only forceful.",
      relationships: "Two different needs may be pulling here. Holding both in view is one possibility; letting one win by default is another.",
      work: "A push toward a goal is one reading. Whether it is the right goal is a question the card leaves with you.",
      growth: "Discipline after the first motivation fades is one thing this card puts on the table.",
    },
  },
  {
    id: "major-08-strength",
    number: 8,
    name: "Strength",
    numeral: "VIII",
    keywords: ["quiet courage", "patience", "steadiness"],
    coreMeaning: "A patient kind of courage, the sort that holds steady rather than forces.",
    position: {
      situation:
        "This card brings the theme of steadiness: courage that is quiet, patience under pressure, resolve kept up over time. The card asks where in your question that kind of strength is already being asked of you.",
      challenge:
        "Strength's difficulty is confusing force with courage, or being harder on yourself than the situation warrants. If that fits, the question is where a gentler firmness would look different.",
      guidance:
        "The card's suggestion is plain: meet the difficulty consistently rather than forcefully, and extend the same patience to yourself. This is about your own footing. It does not make you responsible for how anyone else behaves.",
    },
    focus: {
      general: "Patience and a steady hand are the themes. Whether they are what this calls for is yours to judge.",
      relationships: "Steadiness in yourself is the theme. It is not a promise that calm changes another person, and it is not a reason to stay in something unsafe.",
      work: "Consistency is one way to meet a difficult situation. Whether it is enough here is a fair question to keep asking.",
      growth: "Being steady with your own setbacks, rather than harsh about them, is one practice this card offers.",
    },
  },
  {
    id: "major-09-hermit",
    number: 9,
    name: "The Hermit",
    numeral: "IX",
    keywords: ["solitude", "reflection", "an inward light"],
    coreMeaning: "Stepping back from the noise to think clearly, and then stepping back in.",
    position: {
      situation:
        "The Hermit speaks to distance: from advice, from noise, from other people's opinions, so that your own read on things can be heard. One question to hold: whether your question has had that kind of quiet yet.",
      challenge:
        "The difficulty here is withdrawal that stops being useful, when outside perspective no longer reaches you at all. Only you can tell where that line sits for you.",
      guidance:
        "Taken as advice, it says: take the quiet time, and choose a point at which you will re-engage rather than leaving it open. Reflection and company are both part of this card, in that order.",
    },
    focus: {
      general: "Some solitude is one way to clarify this. More conversation is another. The card leans toward the first, and leaves the choice with you.",
      relationships: "A little space, used well, is an option to weigh against another conversation.",
      work: "Thinking this through alone before returning to the group is one approach this card suggests.",
      growth: "Protected time alone with the question, not just around it, is worth considering if you can make it.",
    },
  },
  {
    id: "major-10-wheel",
    number: 10,
    name: "Wheel of Fortune",
    numeral: "X",
    keywords: ["change", "cycles", "a turning point"],
    coreMeaning: "Circumstances turning on their own timeline, a turning point rather than a fixed state.",
    position: {
      situation:
        "This card is about change that is not entirely on your terms: a cycle turning, an outside factor shifting the shape of things. Worth asking what in your question is moving, and which parts of it are yours to steer.",
      challenge:
        "The Wheel's difficulty is treating the current state, good or bad, as permanent, or spending effort fighting a turn that is happening anyway. Which effort is worth it is a fair question.",
      guidance:
        "One option: work with the shift and look for the opening this particular turn creates. That is an invitation to look, not a promise that the opening is good.",
    },
    focus: {
      general: "Circumstances are one of the themes here. Working with change, rather than holding the old shape, is one approach.",
      relationships: "A relationship entering a different phase is one possible reading. Noticing it is the first step, whatever you decide.",
      work: "Timing and circumstance are themes here. Reading the moment, rather than assuming last month's rules apply, is one option.",
      growth: "A pattern that has cycled before is worth noticing. What you would do differently this time is yours to decide.",
    },
  },
  {
    id: "major-11-justice",
    number: 11,
    name: "Justice",
    numeral: "XI",
    keywords: ["fairness", "clear sight", "consequence"],
    coreMeaning: "An even-handed look at cause and effect, and at what would be fair to do next.",
    position: {
      situation:
        "Justice raises the theme of fairness and consequence: what led to what, who is responsible for which part, what a fair next step would be. It may help to ask what in your question is waiting for that kind of accounting.",
      challenge:
        "The difficulty with this card is that fairness can be uncomfortable: it may ask for a decision, or for a look at your own part. It does not presume dishonesty on anyone's side, including yours.",
      guidance:
        "Read gently, this says: look at the situation as evenly as you can, including your own share, before deciding what is fair to do. Fair does not always mean equal, and the weighing is yours.",
    },
    focus: {
      general: "An honest accounting of the facts, including your own role, is one approach this card invites.",
      relationships: "Being as fair to their side as you would want them to be to yours is one lens. It does not require you to carry more than your share.",
      work: "A decision or an agreement can be judged on its merits rather than on who is most persuasive. That is one standard to consider.",
      growth: "Taking stock of a pattern of your own is one thing this card puts forward, without harshness attached.",
    },
  },
  {
    id: "major-12-hanged-man",
    number: 12,
    name: "The Hanged Man",
    numeral: "XII",
    keywords: ["pause", "a different angle", "letting go of urgency"],
    coreMeaning: "A deliberate pause that lets the whole situation be seen from a different angle.",
    position: {
      situation:
        "This card turns the reading toward the pause: progress in the usual sense set aside so that something can be seen differently. A fair question is whether your question might look different from a stiller place.",
      challenge:
        "The Hanged Man's difficulty is treating a pause as failure, or acting just to feel like something is being done. If that fits, the question is what the stillness might be for.",
      guidance:
        "Here is what it offers: let the pause do its work, and use it to look from an angle that movement did not allow. A pause chosen is different from one imposed, and only you know which this is.",
    },
    focus: {
      general: "A pause is one of the themes here, offered as a way of seeing, not as wasted time.",
      relationships: "Stepping back from trying to fix something is one possibility. What needs fixing may look different from there.",
      work: "Some decisions improve with a deliberate wait. Whether this is one of them is a fair question.",
      growth: "Leaving a question unresolved for a while, on purpose, is one practice this card suggests.",
    },
  },
  {
    id: "major-13-death",
    number: 13,
    name: "Death",
    numeral: "XIII",
    keywords: ["ending", "transformation", "making room"],
    coreMeaning: "An ending that makes room for what comes after it. A symbol of change, not a prediction of harm.",
    position: {
      situation:
        "Death brings the theme of something running its course: a phase, a role, a way of doing things. It is a symbolic ending, not a forecast. You might ask what in your question may be closing, whether or not that has been said out loud.",
      challenge:
        "The difficulty with this card is holding on past the point of usefulness. It cannot tell you when that point is. It asks whether something is being kept out of habit rather than choice.",
      guidance:
        "As guidance: let an ending be an ending, and name what has finished, even briefly. Naming can make room for what comes after. Whether now is the time is yours to decide.",
    },
    focus: {
      general: "An ending is one of the themes. Treating it plainly, instead of around it, is one way to make space for what is next.",
      relationships: "A dynamic or a chapter may have run its course. That is a possibility to sit with, not a conclusion the card can draw for you.",
      work: "A role, a project, or a way of working may be finishing. If so, it is a transition to plan for rather than a setback to fear.",
      growth: "Letting go of a version of yourself you have outgrown, deliberately, is one thing this card offers.",
    },
  },
  {
    id: "major-14-temperance",
    number: 14,
    name: "Temperance",
    numeral: "XIV",
    keywords: ["balance", "patience", "blending, not choosing"],
    coreMeaning: "Slow, deliberate blending, finding the measure between two things rather than picking an extreme.",
    position: {
      situation:
        "Temperance speaks to two things present at once and the careful blend between them, rather than an either-or made in a hurry. The card asks which two things your question is holding.",
      challenge:
        "The difficulty here is impatience: reaching for an extreme or a quick fix when a slower mix might hold. Sometimes an extreme is right. The question is whether it is being chosen or grabbed.",
      guidance:
        "The simplest reading: one measured step at a time, mixing rather than choosing, and let the balance settle. Moderation is a method here, not a moral.",
    },
    focus: {
      general: "A patient, balanced approach is an option this card puts forward, against picking a side quickly.",
      relationships: "Middle ground between two real needs is one thing to look for, as opposed to one person simply yielding.",
      work: "Steady adjustments are one path; a dramatic overhaul is another. This card leans toward the first.",
      growth: "A middle-path habit, neither the extreme you are used to nor its opposite, is one practice to consider.",
    },
  },
  {
    id: "major-15-devil",
    number: 15,
    name: "The Devil",
    numeral: "XV",
    keywords: ["attachment", "restriction", "old patterns"],
    coreMeaning: "Attachment and restriction: a bond, a habit, or a circumstance that holds. A symbol, not a judgement.",
    position: {
      situation:
        "The Devil is about being held: by a habit, a dynamic, a way of thinking, or a circumstance. The card does not know whether what holds you is inside you or outside you, or how tight it is. Worth naming it plainly, whatever it is.",
      challenge:
        "The difficulty with this card is seeing the hold clearly at all. Some restrictions are chosen, some are imposed, some are real limits of money, health, or duty. Which is which is yours to say, not the card's.",
      guidance:
        "If it fits, name the attachment or restriction specifically, then look for any part of it that has some give. If there is none, knowing that clearly is also worth something.",
    },
    focus: {
      general: "A pattern with a hold on things is one of the themes. Naming it is the first move; what it is, and what can change, is yours to judge.",
      relationships: "A dynamic fallen into by habit rather than choice is one possibility to check for.",
      work: "This card can point to a belief about what is possible, or to a real constraint. Telling those apart is the work it invites.",
      growth: "One habit you have assumed is permanent is worth a direct look. Whether it can change is a test, not an assumption.",
    },
  },
  {
    id: "major-16-tower",
    number: 16,
    name: "The Tower",
    numeral: "XVI",
    keywords: ["sudden change", "disruption", "what comes after"],
    coreMeaning: "A sudden disruption and what it leaves standing. A symbol of upheaval, not a forecast of disaster.",
    position: {
      situation:
        "The Tower raises the theme of sudden change: something shaken, possibly without warning. The card does not say why it happened or what it means about what stood before. One question to hold: what in your question has been disrupted, and how you are doing with it.",
      challenge:
        "The difficulty here is the pull to rebuild the same shape immediately, before it is clear what was affected. There is no lesson attached. The question is what needs steadying first.",
      guidance:
        "The card's suggestion is plain: let the disruption be looked at before anything is rebuilt, and rebuild on ground you have checked. That is an invitation to look, not a claim that the change was for the best.",
    },
    focus: {
      general: "A sudden shift is one of the themes. What it reveals, and what is worth rebuilding, are questions only you can answer.",
      relationships: "Something coming to the surface suddenly is one reading. Addressing it directly is one option, at a pace you choose.",
      work: "A plan under sudden strain is one possibility here. An honest look before patching it is one approach.",
      growth: "Letting a disruptive realization change something, rather than smoothing it over, is one thing this card offers.",
    },
  },
  {
    id: "major-17-star",
    number: 17,
    name: "The Star",
    numeral: "XVII",
    keywords: ["hope", "quiet renewal", "a longer view"],
    coreMeaning: "Hope of a quiet kind, the sort that can follow something hard without needing to be dramatic.",
    position: {
      situation:
        "The Star turns the reading toward renewal after difficulty: room to breathe, and a reconnection with what is hoped for. Worth asking whether there is any such room in your question, without needing everything resolved.",
      challenge:
        "The difficulty with this card is that hope can feel unearned after a hard stretch, and impatience for results can crowd out the quieter kind. Hope is offered here as something to consider, not owed.",
      guidance:
        "Taken as advice, it says: let hope be modest and steady rather than large. Small, consistent care for the thing you hope for is a way to hold it. It is not a promise about how it turns out.",
    },
    focus: {
      general: "A quieter kind of hope is one of the themes. It does not need forcing into something bigger.",
      relationships: "Trust rebuilding is one possibility this card raises. Whether it is, and how fast, is something only the people involved can know.",
      work: "A stalled project or goal finding room to move is one reading. Gently and steadily is the pace it suggests.",
      growth: "Reconnecting with something you hope for, without needing it resolved today, is one practice here.",
    },
  },
  {
    id: "major-18-moon",
    number: 18,
    name: "The Moon",
    numeral: "XVIII",
    keywords: ["uncertainty", "the unclear", "what is not visible yet"],
    coreMeaning: "A stretch where things are not clear yet, and the work of telling what is known from what is not.",
    position: {
      situation:
        "The Moon brings the theme of uncertainty: part of the picture is not visible, and it may not be for a while. The card does not say whether your concern is founded. It may help to ask what in your question is confirmed, what is not, and what you need to find out.",
      challenge:
        "The difficulty here is deciding under low light: settling on one story, hopeful or fearful, before there is enough to go on. Caution in the dark is sensible. The question is what would bring more light.",
      guidance:
        "One option: sort what is known from what is assumed, and give the unclear parts time or a direct question. That is a method for seeing, not a claim that there is nothing to see.",
    },
    focus: {
      general: "Some of this is still unclear. Separating what is known from what is assumed is one approach; asking is another.",
      relationships: "A misunderstanding is one possibility among several. Asking directly is one way to find out which it is.",
      work: "Ambiguity here is real. Whether more information is coming, and from where, is worth finding out.",
      growth: "A recurring story you tell yourself is worth checking against what is actually known, in whichever direction that goes.",
    },
  },
  {
    id: "major-19-sun",
    number: 19,
    name: "The Sun",
    numeral: "XIX",
    keywords: ["clarity", "warmth", "plain good"],
    coreMeaning: "Clarity and warmth, a plain kind of good worth noticing when it is there.",
    position: {
      situation:
        "The Sun speaks to what is clear and good: warmth, energy, something straightforward. A fair question is what in your question is going well, and whether it has had its due attention.",
      challenge:
        "The difficulty with this card is that good things can be hard to trust, and easy to talk down. It does not say there is nothing to watch for. It asks whether the good part is being allowed to count.",
      guidance:
        "Read gently, this says: bring your energy to what is going well, openly. Enjoying something does not require ignoring the rest. Both can be true.",
    },
    focus: {
      general: "Letting something good be good, while it is here, is one thing this card invites.",
      relationships: "Warmth and openness are the themes. Whether this is a moment to enjoy rather than analyse is yours to feel out.",
      work: "Momentum and recognition are possibilities here. Using the energy while it lasts is one approach.",
      growth: "Noticing what is going well, and letting yourself feel good about it plainly, is a practice worth trying.",
    },
  },
  {
    id: "major-20-judgement",
    number: 20,
    name: "Judgement",
    numeral: "XX",
    keywords: ["reckoning", "a call to respond", "seeing it whole"],
    coreMeaning: "A clear look at where things stand, and the call to respond to what is seen.",
    position: {
      situation:
        "Judgement is about seeing something whole: a pattern, a result, a truth that has been circled. You might ask what in your question may be ready to be looked at directly, and what it would take to respond.",
      challenge:
        "The difficulty here is either not looking, or looking with too much harshness once you do. A reckoning without self-punishment is the balance this card asks about.",
      guidance:
        "Here is what it offers: acknowledge what an honest look shows, without adding blame, and let it inform the next real decision. What that decision is stays with you.",
    },
    focus: {
      general: "A clear look at where things stand is one theme here, offered without harshness.",
      relationships: "A pattern that both people have half-noticed may be ready to be named. Whether, and how, is a shared decision.",
      work: "An honest review of results so far is one step this card suggests before deciding what is next.",
      growth: "Taking stock of where you are, minus the self-judgement, is one practice worth trying.",
    },
  },
  {
    id: "major-21-world",
    number: 21,
    name: "The World",
    numeral: "XXI",
    keywords: ["completion", "wholeness", "arrival"],
    coreMeaning: "A cycle reaching completion. An arrival, not only an ending.",
    position: {
      situation:
        "The World raises the theme of completion: pieces coming together, a phase finishing, something arriving at its whole shape. The card asks what in your question may be close to complete, and whether it has been recognised as such.",
      challenge:
        "The difficulty with this card is rushing past a completion without marking it, which can leave a finished thing feeling unfinished. Not every ending gets its due. This asks whether one should.",
      guidance:
        "As guidance: take a real moment to recognise what has been completed before starting the next cycle. What form that takes is yours to choose.",
    },
    focus: {
      general: "Completion is one of the themes here. Acknowledging it before moving on is one possibility.",
      relationships: "A shared effort or chapter coming full circle is one possibility, worth marking together if it fits.",
      work: "A project near completion deserving a proper close, rather than an immediate pivot, is one reading.",
      growth: "Recognising a cycle you have completed, and letting that count, is a small practice this card offers.",
    },
  },
];

export function getCardById(id: string): CardContent | undefined {
  return CARDS.find((c) => c.id === id);
}
