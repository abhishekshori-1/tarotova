import type { CardContent } from "./types";

/**
 * The 22 Major Arcana, RWS meanings, upright only (see versions.ts: still
 * not reviewed by a practitioner). Symbolism follows Waite's numbering
 * (Strength VIII, Justice XI). A Challenge text names the upright card's
 * difficulty in that position, never a reversed meaning.
 *
 * Stance (docs/RELEASE-B-QUALITY-REVIEW.md): every sentence is about the
 * card's theme, never a finding about the person reading. The library does
 * not say what they have, what they feel, why something happened, whether a
 * fear is founded, or whether a constraint is real. The model that writes
 * the personalized answer grounds itself on this text, so a verdict here
 * becomes a verdict in someone's reading.
 *
 * Texture (content.v6): short declarative sentences carry each text. At
 * most one question per text. The exploration (content.v9) describes the
 * Rider–Waite–Smith image and develops the theme in the same stance: about
 * the picture and its symbols, never about the reader. No permission language ("if it fits", "yours
 * to weigh", "one option is"); the stance is held by keeping the subject on
 * the theme, not by hedging every line.
 */
export const CARDS: CardContent[] = [
  {
    id: "major-00-fool",
    number: 0,
    name: "The Fool",
    numeral: "0",
    keywords: ["beginnings", "openness", "a first step"],
    coreMeaning: "A first step into something new, taken with curiosity rather than a finished plan.",
    exploration:
      "A young figure stands at the edge of a cliff, face lifted to the sky, a small bundle on a stick over one shoulder. A white dog leaps at the heels. The sun is high and the mountains are far off. The card shows a step about to be taken with almost nothing carried: a rose in one hand, a light pack, no map. Beginnings hold both the freshness of not knowing and the risk of not looking. The dog is company and a warning at once. The Fool is numbered zero, the point before counting starts.",
    position: {
      situation:
        "A beginning. An edge, a first step, a road not mapped yet. Somewhere in what you brought, something may be only starting, and the ground there is still soft.",
      challenge:
        "The Fool's trouble is moving before looking. Enthusiasm runs ahead of the checks a step deserves. What would you want to know before the next move, and what can wait?",
      guidance:
        "Let curiosity lead, with a check or two rather than none. The whole path does not need a map. Enough footing for the next real step is enough.",
    },
    focus: {
      general: "A fresh start is on the table. How big a step feels right is a matter for you, not the card.",
      relationships: "Early, undefined stages belong to this card. They ask for openness, with the outcome left open too.",
      work: "A new direction or role can be treated as an experiment rather than a verdict on your worth.",
      growth: "Starting before you feel ready is one of this card's themes. Readiness sometimes arrives during the walk.",
    },
  },
  {
    id: "major-01-magician",
    number: 1,
    name: "The Magician",
    numeral: "I",
    keywords: ["resourcefulness", "focus", "making it real"],
    coreMeaning: "Turning an idea into something real by choosing what to work with and where to point it.",
    exploration:
      "One hand is raised to the sky, the other points to the ground. On the table lie a cup, a sword, a wand and a pentacle, the four tools of the deck. Above the figure's head is the sign of infinity. The image is about connecting an idea with the means to make it. The tools are ordinary things put to deliberate use. The raised hand and the lowered hand describe one movement: what is imagined, brought down into what can be done. Focus is the card's discipline, and the table is where it happens.",
    position: {
      situation:
        "Resources and focus. Skill, timing, tools, people, and the act of choosing which to use. The card does not know what is within your reach. Taking stock of that, including what is missing, is where it begins.",
      challenge:
        "The Magician's trouble is scattering: effort spread across too many directions, or planning that stands in for doing. The card favours a single deliberate effort over several half ones.",
      guidance:
        "Pick one concrete action and see it through before reaching for the next tool. Name what it needs in time, money or help, and whether that is available. The card's preference is a step the means can support over a plan they cannot.",
    },
    focus: {
      general: "Resourcefulness is the theme. What could be made with the resources you can actually name?",
      relationships: "Saying plainly what you want, rather than hinting, is this card's suggestion. It favours clarity over charm.",
      work: "A skill or project may be ready for focused effort. Which one, and with what means, is the practical question.",
      growth: "One intention, one visible action. The card favours small and real over large and imagined.",
    },
  },
  {
    id: "major-02-high-priestess",
    number: 2,
    name: "The High Priestess",
    numeral: "II",
    keywords: ["intuition", "quiet knowing", "what is not yet said"],
    coreMeaning: "Something sensed before it can be explained, and the patience to let it surface.",
    exploration:
      "A seated figure rests between two pillars, one dark and one light, marked B and J. A veil of pomegranates hangs behind her. A crescent moon lies at her feet, and a scroll sits half hidden in her lap. The image is about what is known but not yet spoken. The scroll is partly rolled, so only part of it can be read. The card's theme is receptive knowing: listening before deciding, and letting something surface in its own time. Stillness is its posture. Silence is part of its method.",
    position: {
      situation:
        "The unsaid. A hunch, a sense of something not fully on the table yet. Part of your question may be felt before it can be put into words, and that is a normal place for a question to be.",
      challenge:
        "The High Priestess's trouble is forcing an answer before it is ready, or dismissing a sense because it cannot be proved. A hunch says where to look. It is not evidence about another person, and it does not replace the facts.",
      guidance:
        "Give it a little more time. Write down what you sense and keep gathering what you know. This card treats the fuller picture as something that arrives on its own schedule, not on demand.",
    },
    focus: {
      general: "A quiet instinct deserves a hearing alongside the facts. The card does not say which of them is right.",
      relationships: "Something unspoken may matter here. The card favours a direct, gentle question over guessing.",
      work: "A sense about timing or people can sit next to the visible facts. Not instead of them.",
      growth: "Quiet, unscheduled time is this card's suggestion. Some understanding arrives in the gaps.",
    },
  },
  {
    id: "major-03-empress",
    number: 3,
    name: "The Empress",
    numeral: "III",
    keywords: ["nurture", "growth", "giving things room"],
    coreMeaning: "Care and time given to something so it can grow, rather than pressure to make it hurry.",
    exploration:
      "A crowned figure reclines on cushions in a field of ripening wheat. A river runs through trees behind her, and a heart-shaped shield bearing the sign of Venus rests at her side. Everything in the image grows. The wheat is nearly ready. The water keeps moving. The card is about abundance that comes from tending rather than forcing, and about care given time. The Empress sits rather than works, which is part of the point. Growth has its own pace. Nurture includes rest, for the one who gives as well as for what is given.",
    position: {
      situation:
        "Growth that answers to tending rather than force. A relationship, a project, an idea. Something in your question may be growing quietly, and quiet growth is easy to miss.",
      challenge:
        "The Empress's trouble is giving past your own reserves: care that runs out because nothing refills it. Where the limit of your giving sits right now is worth knowing.",
      guidance:
        "Keep tending what matters, and decide how much you can give before you need refilling yourself. This card counts your own reserves as part of the care.",
    },
    focus: {
      general: "Nurturing what already exists, rather than starting something new, is the theme.",
      relationships: "Warmth and attention are the themes here. So is not losing yourself in giving them.",
      work: "A slower, cultivating approach suits this card: mentoring, refining, building relationships.",
      growth: "Receiving care as readily as you give it is a skill, not an indulgence. How that goes for you is a fair thing to notice.",
    },
  },
  {
    id: "major-04-emperor",
    number: 4,
    name: "The Emperor",
    numeral: "IV",
    keywords: ["structure", "stability", "clear boundaries"],
    coreMeaning: "Structure and a clear boundary, the things that turn a good intention into something dependable.",
    exploration:
      "A bearded ruler sits on a stone throne carved with rams' heads. He holds an ankh-shaped sceptre and a globe. Behind him rise bare mountains. Armour shows beneath his robe. The image is about structure held firm. The stone throne does not move. The card's theme is order: rules, boundaries and the authority that keeps them. The rams belong to Aries, the sign of initiative. The ankh is a sign of life, held by a figure of law. Structure exists to protect something living. The throne is only as good as what it serves.",
    position: {
      situation:
        "Structure. A plan, a boundary, a decision that holds. This card raises the question of whether some part of what you brought has stayed open-ended longer than it serves you, or whether a firmer shape would only feel safer.",
      challenge:
        "The Emperor's trouble is rigidity: a boundary held so tightly it stops serving anyone, or control reached for where trust might work. Both can look like strength from the inside.",
      guidance:
        "Set the structure you need, then check it now and then instead of treating it as permanent. A boundary is there to serve the goal, not to replace it.",
    },
    focus: {
      general: "Bringing a plan or a boundary to something left open is this card's theme.",
      relationships: "Clear expectations, said plainly, belong to this card. Whether they are wanted, and by whom, is a conversation.",
      work: "Structure, such as a schedule, a scope or a decision-maker, may be what is missing rather than more effort. Telling the two apart is the work.",
      growth: "One dependable routine over several ambitious ones. Which routine, and what it costs in your week, is the practical part.",
    },
  },
  {
    id: "major-05-hierophant",
    number: 5,
    name: "The Hierophant",
    numeral: "V",
    keywords: ["tradition", "shared method", "learning from others"],
    coreMeaning: "A known method, a teacher, or a shared understanding, useful when something has been worked out before.",
    exploration:
      "A robed figure sits between two pillars, one hand raised in blessing, the other holding a triple cross. Two crossed keys lie at his feet. Two acolytes kneel before him. The image is about teaching passed down: a tradition, an institution, a body of practice. The keys stand for what has been unlocked before and can be unlocked again. The space between the pillars is open and public. The card's theme is shared method. Learning from those who came before is one of its gifts. Knowing what to keep and what to leave is the other.",
    position: {
      situation:
        "The tried path. An established approach, a mentor, a community that has faced this before. The card points to what others have worked out about questions like this one. Finding that is different from copying it.",
      challenge:
        "The Hierophant's trouble is following a convention without checking whether it fits. A method that served others may not serve this. Which parts to keep is the question.",
      guidance:
        "Borrow what is genuinely useful from established practice or from someone experienced, and adapt the rest. Wholesale acceptance and wholesale rejection are both shortcuts.",
    },
    focus: {
      general: "A teacher, a mentor or an established framework is where this card points. Whether they fit your situation is a separate question.",
      relationships: "Shared values or a shared community may matter more here than has been said aloud.",
      work: "Process and precedent are a guide. Checking what worked before improvising is a reasonable first step.",
      growth: "Find someone who has walked this path and ask them one specific question. Small and concrete.",
    },
  },
  {
    id: "major-06-lovers",
    number: 6,
    name: "The Lovers",
    numeral: "VI",
    keywords: ["connection", "values", "a real choice"],
    coreMeaning: "A choice that asks what you value, not only what is easiest or keeps the peace.",
    exploration:
      "A man and a woman stand beneath a great angel whose wings fill the sky. Behind the woman grows a tree with a serpent. Behind the man stands a tree of flames. A mountain rises between them, and the sun blazes overhead. The image is about a choice made in the open, with everything visible. The two trees stand for knowing and for passion. The card's theme is a decision that reveals what someone values. Connection is part of it. So is the honesty of choosing with eyes open.",
    position: {
      situation:
        "A meaningful choice, often about connection, and the values underneath it. The card cannot tell you what anyone else feels. It can ask what matters most to you in the decision your question holds.",
      challenge:
        "The Lovers' trouble is choosing to please someone else, or not choosing at all. Whose wishes are shaping the decision, and are yours among them?",
      guidance:
        "Name what you value before deciding, alongside the responsibilities and limits involved, and let that lead rather than obligation or the fear of disappointing someone. The choice stays yours.",
    },
    focus: {
      general: "A choice in front of you may really be a choice about values. Getting clear on those comes first.",
      relationships: "Alignment of values is the theme, more than compromise for its own sake. Whether they match is something to find out, not assume.",
      work: "A decision between paths can be a decision about what you want your work to stand for.",
      growth: "Choose on the basis of what you value, and say that reason to yourself plainly. It is a practice.",
    },
  },
  {
    id: "major-07-chariot",
    number: 7,
    name: "The Chariot",
    numeral: "VII",
    keywords: ["drive", "focused will", "holding two things together"],
    coreMeaning: "Forward motion held together by will, even when the pull comes from two directions.",
    exploration:
      "A crowned figure stands in a stone chariot beneath a starry canopy. Two sphinxes, one black and one white, rest in front, facing slightly apart. The charioteer holds no reins. A walled city lies behind. The image is about motion held together by will. The sphinxes pull in different directions, and the figure keeps them moving as one. The canopy of stars suggests a purpose larger than the road. The card's theme is drive with direction: effort that knows where it is going. The chariot protects while it moves.",
    position: {
      situation:
        "Momentum under tension. Moving with intent while different pressures pull in different ways. Where in your question there is drive, and what it is being asked to hold together, is the shape this card offers.",
      challenge:
        "The Chariot's trouble is will used alone: pushing through when the direction, not the effort, is what needs a look. A change of course costs something. So does staying on a wrong one.",
      guidance:
        "Steer deliberately rather than grit through. Check the direction as often as the effort. Earned progress can still be pointed the wrong way, which is a reason to look, not a verdict.",
    },
    focus: {
      general: "Focused effort is the theme. It works best steered, not only forceful.",
      relationships: "Two different needs may be pulling here. Giving each a hearing is this card's suggestion. Agreement does not have to mean wanting the same thing.",
      work: "A push toward a goal is the theme. Whether it is the right goal is the question the card leaves with you.",
      growth: "Discipline after the first motivation fades. That is the part this card is about.",
    },
  },
  {
    id: "major-08-strength",
    number: 8,
    name: "Strength",
    numeral: "VIII",
    keywords: ["quiet courage", "patience", "steadiness"],
    coreMeaning: "A patient kind of courage, the sort that holds steady rather than forces.",
    exploration:
      "A woman in a white robe closes the jaws of a lion with her bare hands. Her touch is gentle. The lion's tail curls between its legs. Above her head is the sign of infinity, and a garland of flowers circles her waist. The image is about courage without force. Nothing in it strains. The lion is not defeated, only met. The card's theme is patience that holds its ground: firmness that does not need to shout. What tames the lion is composure. The mountains behind are far off, and the sky is clear.",
    position: {
      situation:
        "Steadiness. Courage that is quiet, patience under pressure, resolve kept up over time. Somewhere in what you brought, that kind of strength may already be in use, unnoticed because it is quiet.",
      challenge:
        "Strength's trouble is confusing force with courage, or being harder on yourself than the situation warrants. A gentler firmness looks different from both.",
      guidance:
        "Meet the difficulty consistently rather than forcefully, and extend the same patience to yourself. This is about your own footing. It does not make you responsible for how anyone else behaves.",
    },
    focus: {
      general: "Patience and a steady hand are the themes. Whether they are what this calls for is a judgement only you can make.",
      relationships: "Steadiness in yourself is the theme. It is not a promise that calm changes another person, and never a reason to stay in something unsafe.",
      work: "Consistency is one way to meet a hard situation. Whether it is enough here is a question worth keeping open.",
      growth: "Being steady with your own setbacks, rather than harsh about them, is the practice this card offers.",
    },
  },
  {
    id: "major-09-hermit",
    number: 9,
    name: "The Hermit",
    numeral: "IX",
    keywords: ["solitude", "reflection", "an inward light"],
    coreMeaning: "Stepping back from the noise to think clearly, and then stepping back in.",
    exploration:
      "An old figure in a grey cloak stands on a snowy peak, holding a lantern out into the dark. Inside the lantern burns a six-pointed star. In the other hand is a staff. The image is about light carried into solitude. The peak is high and empty. The card's theme is reflection: stepping away to see clearly, with a small light of one's own. The Hermit looks down the mountain, which suggests the light is also held for someone else who may be climbing.",
    position: {
      situation:
        "Distance. From advice, from noise, from other people's opinions, so that your own read on things can be heard. Your question may not have had that kind of quiet yet.",
      challenge:
        "The Hermit's trouble is the line between useful solitude and isolation. Time alone can sharpen the view or narrow it. Someone you trust may notice which is happening before you do.",
      guidance:
        "Take the quiet time, and choose a point at which you will come back rather than leaving it open. Reflection and company are both part of this card, in that order.",
    },
    focus: {
      general: "The Hermit favours quiet reflection before further conversation.",
      relationships: "A little space before the next conversation is this card's suggestion.",
      work: "Think it through alone before returning to the group. That is the order this card proposes.",
      growth: "Protected time alone with the question, not just around it. When that is possible, this card recommends it.",
    },
  },
  {
    id: "major-10-wheel",
    number: 10,
    name: "Wheel of Fortune",
    numeral: "X",
    keywords: ["change", "cycles", "a turning point"],
    coreMeaning: "Circumstances turning on their own timeline, a turning point rather than a fixed state.",
    exploration:
      "A great wheel turns in the sky, marked with letters and alchemical signs. A sphinx sits on top with a sword. A serpent descends on one side, and a jackal-headed figure rises on the other. In the corners, four winged creatures read books. The image is about cycles: what rises, what falls, and what stays at the centre. The wheel moves without a hand on it. The card's theme is change that arrives on its own timing. The readers in the corners suggest that a turn can be studied even when it cannot be steered.",
    position: {
      situation:
        "Change that is not entirely on your terms. A cycle turning, an outside factor shifting the shape of things. Some of what is moving in your question is yours to steer and some is not, and telling them apart matters.",
      challenge:
        "The Wheel's trouble is treating the current state, good or bad, as permanent, or spending effort fighting a turn that is happening anyway. Not every effort against change is wasted. Some are.",
      guidance:
        "Take stock of what has changed before choosing a response. There may be an opening, a loss to attend to, or something that needs protecting. Change does not owe you an opportunity.",
    },
    focus: {
      general: "Circumstances are the theme. Working with change, rather than holding the old shape, is the card's suggestion.",
      relationships: "A relationship entering a different phase is one of this card's readings. Noticing it comes before deciding anything about it.",
      work: "Timing and circumstance are the themes. Last month's rules may not apply. Reading the moment is the work.",
      growth: "A pattern that has cycled before is worth noticing. What you would do differently this time is the useful question.",
    },
  },
  {
    id: "major-11-justice",
    number: 11,
    name: "Justice",
    numeral: "XI",
    keywords: ["fairness", "clear sight", "consequence"],
    coreMeaning: "An even-handed look at cause and effect, and at what would be fair to do next.",
    exploration:
      "A crowned figure sits between two pillars, holding a raised sword in one hand and a set of scales in the other. A purple veil hangs behind. One foot steps forward from beneath the red robe. The image is about weighing and deciding. The scales are level. The sword points straight up. Nothing in the composition tilts. The card's theme is fairness: looking at cause and consequence squarely and choosing what follows. The crown carries a small square, a sign of clear thought.",
    position: {
      situation:
        "Fairness and consequence. What led to what, who is responsible for which part, what a fair next step would be. Something in your question may be waiting for that kind of accounting.",
      challenge:
        "Justice's trouble is that fairness is uncomfortable. It may ask for a decision, or for a look at your own share. It presumes no dishonesty on anyone's side, including yours.",
      guidance:
        "Look at the situation as evenly as you can, your own part included, before deciding what is fair to do. Fair does not always mean equal, and the weighing is yours.",
    },
    focus: {
      general: "An honest accounting of the facts, your own role included, is what this card invites.",
      relationships: "Being as fair to their side as you would want them to be to yours. That does not mean carrying more than your share.",
      work: "A decision or an agreement judged on its merits rather than on who is most persuasive. That is this card's standard.",
      growth: "Taking stock of a pattern of your own, without harshness attached. The card asks for the look, not the punishment.",
    },
  },
  {
    id: "major-12-hanged-man",
    number: 12,
    name: "The Hanged Man",
    numeral: "XII",
    keywords: ["pause", "a different angle", "letting go of urgency"],
    coreMeaning: "A deliberate pause that lets the whole situation be seen from a different angle.",
    exploration:
      "A young man hangs by one foot from a living tree shaped like a T. His free leg is bent behind the other. His hands are held behind his back, and his face is calm. Around his head is a bright halo. The image is about suspension chosen on purpose. The tree is green, so what holds him is alive. The card's theme is a pause that changes the angle of sight. Seen upside down, a situation shows different edges. The halo says that this stillness has its own light. Waiting, here, is a way of looking rather than a loss of time.",
    position: {
      situation:
        "The pause. Progress in the usual sense set aside so that something can be seen differently. Your question may look different from a stiller place than the one it was asked from.",
      challenge:
        "The Hanged Man's trouble is treating a pause as failure, or acting just to feel like something is being done. A pause chosen is different from one imposed. Being made to wait is frustrating, and it does not have to become a lesson.",
      guidance:
        "Let the pause do its work. Sort what can wait from what needs attention now, and use the stillness to look from an angle that movement did not allow.",
    },
    focus: {
      general: "A pause is the theme, offered as a way of seeing, not as wasted time.",
      relationships: "Stepping back from trying to fix something. What needs fixing may look different from there.",
      work: "Some decisions improve with a deliberate wait. Whether this is one of them is the question.",
      growth: "Leaving a question unresolved for a while, on purpose. That is the practice this card suggests.",
    },
  },
  {
    id: "major-13-death",
    number: 13,
    name: "Death",
    numeral: "XIII",
    keywords: ["ending", "transformation", "making room"],
    coreMeaning: "An ending that makes room for what comes after it. A symbol of change, not a prediction of harm.",
    exploration:
      "A skeleton in black armour rides a white horse, carrying a black banner with a white rose. Before it, a king has fallen. A bishop, a woman and a child wait. In the distance, between two towers, the sun rises over water. The image is about an ending with something beyond it. The rose on the banner is the sign of life continuing. The card's theme is transformation: a phase that closes so another can begin. Each figure responds differently, and each response is allowed. The rising sun is small and far. It is still there.",
    position: {
      situation:
        "Something running its course. A phase, a role, a way of doing things. This is a symbolic ending, not a forecast. Something in your question may be closing, whether or not that has been said out loud.",
      challenge:
        "Death's trouble is holding on past the point of usefulness. The card cannot tell you where that point is. It asks whether something is being kept out of habit rather than choice.",
      guidance:
        "If something has ended, give it a name before deciding what comes next. There may be practical loose ends, feelings, or both to attend to. Nobody has to find a new beginning in it today.",
    },
    focus: {
      general: "An ending is the theme. Acknowledging one, and tending what still needs care, is the card's suggestion.",
      relationships: "A dynamic or a chapter that has run its course is one of this card's readings. A possibility to sit with, not a conclusion the card can draw for you.",
      work: "A role, a project or a way of working that is finishing. Planning the transition can sit alongside grief, worry or relief about it.",
      growth: "An old expectation of yourself you no longer want to carry. Setting it down, deliberately, is what this card is about.",
    },
  },
  {
    id: "major-14-temperance",
    number: 14,
    name: "Temperance",
    numeral: "XIV",
    keywords: ["balance", "patience", "blending, not choosing"],
    coreMeaning: "Slow, deliberate blending, finding the measure between two things rather than picking an extreme.",
    exploration:
      "A winged angel stands with one foot on land and one in water, pouring liquid between two cups. A path leads from the pool toward distant mountains, where a crown of light shows above the peaks. The image is about mixing rather than choosing. The liquid flows at an angle that seems impossible, which is part of its meaning: balance is an art, not a formula. The card's theme is patient blending, the measure found between two things. One foot on each surface holds both at once. The path is long, and the light at the end is calm.",
    position: {
      situation:
        "Two things present at once and the careful blend between them, rather than an either-or made in a hurry. Which two things your question is holding is the first thing this card asks.",
      challenge:
        "Temperance's trouble is pace: gradual adjustment can be wisdom or it can be avoidance. Sometimes a decisive change is right. A measured approach includes noticing when the middle ground will not do.",
      guidance:
        "One measured step at a time, mixing rather than choosing, and let the balance settle. Moderation is a method here, not a moral.",
    },
    focus: {
      general: "A patient, balanced approach is the theme, against picking a side quickly.",
      relationships: "Middle ground between two real needs, as opposed to one person simply yielding. That is the distinction this card draws.",
      work: "Steady adjustments over a dramatic overhaul. That is where this card leans.",
      growth: "A sustainable version of a habit, sized to the time and energy your actual week has. That is the practice.",
    },
  },
  {
    id: "major-15-devil",
    number: 15,
    name: "The Devil",
    numeral: "XV",
    keywords: ["attachment", "restriction", "old patterns"],
    coreMeaning: "Attachment and restriction: a bond, a habit, or a circumstance that holds. A symbol, not a judgement.",
    exploration:
      "A horned figure sits on a black pedestal, one hand raised and the other holding a torch pointed down. Two figures stand chained at its base. Their chains are loose enough to lift off. The image is about being held. The chains are the centre of the picture, and so is their slackness. The card's theme is attachment and restriction: a habit, a bond or a circumstance that keeps something in place. The figures wear small horns of their own, a sign that a hold can become familiar. Naming the chain is where the card looks.",
    position: {
      situation:
        "Being held. By a habit, a dynamic, a way of thinking, or a circumstance. The card does not know whether what holds you is inside you or outside you, or how tight it is. Naming it plainly, whatever it is, is where this card begins.",
      challenge:
        "The Devil's trouble is seeing the hold clearly at all. Some restrictions are chosen, some are imposed, some are real limits of money, health or duty. Which is which is for you to say, not the card.",
      guidance:
        "Name the attachment or restriction specifically, then look for any part of it that has some give. If there is none, knowing that clearly is also worth something.",
    },
    focus: {
      general: "A pattern with a hold on things is the theme. Naming it is the first move. What it is, and what can change, is yours to judge.",
      relationships: "A dynamic fallen into by habit rather than choice. That is the thing this card suggests checking for.",
      work: "This card can point to a belief about what is possible, or to a real constraint. Telling those apart is the work it invites.",
      growth: "A habit worth examining: what keeps it in place, and what support changing it would need.",
    },
  },
  {
    id: "major-16-tower",
    number: 16,
    name: "The Tower",
    numeral: "XVI",
    keywords: ["sudden change", "disruption", "what comes after"],
    coreMeaning: "A sudden disruption and what it leaves standing. A symbol of upheaval, not a forecast of disaster.",
    exploration:
      "Lightning strikes a tower built on a rocky peak, throwing its crown from the top. Flames burst from the windows. Two figures fall through the dark air. The image is about sudden disruption and what it reveals. The tower was built on a narrow summit with no room to widen. The crown, a sign of false authority, is the first thing to go. The card's theme is upheaval: a structure breaking that could not bend. The lightning is over in an instant. What it lit up remains to be seen by daylight. The ground beneath is still rock.",
    position: {
      situation:
        "Sudden change. Something shaken, possibly without warning. The card does not say why it happened or what it means about what stood before. How you are doing with it counts for as much as what fell.",
      challenge:
        "The Tower's trouble is the pull to rebuild immediately, before taking stock of what was affected. There is no lesson you have to find in it. What needs steadying first comes before any rebuilding.",
      guidance:
        "Look at the disruption before anything is rebuilt, and rebuild on ground you have checked. Help, where it is available, comes before deciding what to rebuild.",
    },
    focus: {
      general: "A sudden shift is the theme. What needs steadying, and what is worth rebuilding, are the questions that follow.",
      relationships: "Something coming to the surface suddenly. Addressing it directly, at a pace you choose, is this card's suggestion.",
      work: "A plan under sudden strain. An honest look before patching it is the approach this card offers.",
      growth: "A disruptive realization allowed to change something, rather than smoothed over. That is what this card is about.",
    },
  },
  {
    id: "major-17-star",
    number: 17,
    name: "The Star",
    numeral: "XVII",
    keywords: ["hope", "quiet renewal", "a longer view"],
    coreMeaning: "Hope of a quiet kind, the sort that can follow something hard without needing to be dramatic.",
    exploration:
      "A woman kneels by a pool, one knee on land and one foot on the water, pouring from two jugs. One stream feeds the pool and the other runs onto the earth. Above her burns a large star ringed by seven smaller ones. The image is about renewal after difficulty. She is unclothed, with nothing to hide and nothing to protect. The water she pours returns to its source and nourishes the ground. The card's theme is hope of a quiet kind, the sort that follows something hard. The stars are steady rather than bright.",
    position: {
      situation:
        "Renewal after difficulty. Room to breathe, and a reconnection with what is hoped for. There may or may not be such room in your question yet, and the card does not require everything to be resolved first.",
      challenge:
        "The Star's trouble is making room for hope without turning it into a demand to feel better. Hope after a hard stretch can feel unearned. It is not owed, and it is all right if none comes to mind today.",
      guidance:
        "Let hope be modest and steady rather than large. Small, consistent care for the thing you hope for is a way to hold it. It is not a promise about how things turn out.",
    },
    focus: {
      general: "A quieter kind of hope is the theme. It does not need forcing into something bigger.",
      relationships: "Trust rebuilding is one of this card's readings. Whether it is, and how fast, only the people involved can know.",
      work: "A stalled project or goal finding room to move. Gently and steadily is the pace this card suggests.",
      growth: "Reconnecting with something you hope for, without needing it resolved today. That is the practice here.",
    },
  },
  {
    id: "major-18-moon",
    number: 18,
    name: "The Moon",
    numeral: "XVIII",
    keywords: ["uncertainty", "the unclear", "what is not visible yet"],
    coreMeaning: "A stretch where things are not clear yet, and the work of telling what is known from what is not.",
    exploration:
      "A full moon with a face looks down between two towers. A dog and a wolf howl toward it. A crayfish climbs out of a pool onto a winding path that leads into far hills. Drops of light fall from the sky. The image is about seeing by uncertain light. The path is there, but its distance cannot be judged. The dog and the wolf stand for what is tame and what is wild in the same instinct. The card's theme is the unclear: what is sensed, feared or imagined before it is known. Something is surfacing, slowly.",
    position: {
      situation:
        "Uncertainty. Part of the picture is not visible, and it may not be for a while. The card does not say whether your concern is founded. It asks what in your question is confirmed, what is not, and what you need to find out.",
      challenge:
        "The Moon's trouble is deciding under low light: settling on one story, hopeful or fearful, before there is enough to go on. Caution in the dark is sensible. More light, where it can be had, is the alternative.",
      guidance:
        "Sort what is known from what is assumed, and give the unclear parts time or a direct question. This is a method for seeing. It is not a claim that there is nothing to see.",
    },
    focus: {
      general: "What is known, what is assumed, and what is still unanswered. Separating those is where this card points. There may already be enough for the next step.",
      relationships: "A misunderstanding is one possibility among several. The card favours asking directly over guessing.",
      work: "What is confirmed, and what still needs a direct question. That is the sorting this card asks for.",
      growth: "A story you tell about yourself, checked against the facts. Look for what supports it as well as what challenges it.",
    },
  },
  {
    id: "major-19-sun",
    number: 19,
    name: "The Sun",
    numeral: "XIX",
    keywords: ["clarity", "warmth", "plain good"],
    coreMeaning: "Clarity and warmth, a plain kind of good worth noticing when it is there.",
    exploration:
      "A naked child rides a white horse beneath a huge sun with a calm face and straight rays. Sunflowers grow over a garden wall behind. The child carries a red banner and wears a wreath of flowers. The image is about clarity and open warmth. Nothing is hidden; the child has no need for clothing or reins. The sunflowers turn toward the light. The card's theme is plain good: joy, vitality, and the simple fact of a clear day. What the sun shows is shown fully. The picture asks nothing except to be seen.",
    position: {
      situation:
        "What is clear and good. Warmth, energy, something straightforward. Something in the situation you asked about may be going well, and good things often get less attention than trouble.",
      challenge:
        "The Sun's trouble is that good things can be hard to trust and easy to talk down. The card does not say there is nothing to watch for. It asks whether the good part is being allowed to count.",
      guidance:
        "Bring your energy to what is going well, openly. Enjoying something does not require ignoring the rest. Both can be true at once.",
    },
    focus: {
      general: "Letting something good be good, while it is here. That is what this card invites.",
      relationships: "Warmth and openness are the themes. A moment to enjoy rather than analyse, if that is what it is.",
      work: "Something at work that deserves recognition, and what would help sustain it. That is where this card looks.",
      growth: "Noticing what is going well, and letting yourself feel good about it plainly. A practice, and a rarer one than it sounds.",
    },
  },
  {
    id: "major-20-judgement",
    number: 20,
    name: "Judgement",
    numeral: "XX",
    keywords: ["reckoning", "a call to respond", "seeing it whole"],
    coreMeaning: "A clear look at where things stand, and the call to respond to what is seen.",
    exploration:
      "An angel with a trumpet appears from the clouds, a banner with a red cross hanging from the horn. Below, grey figures rise from open coffins that float on water, arms lifted. The image is about a call heard and answered. The figures rise together, adults and a child. The water lies flat and reflects the sky. The card's theme is reckoning: seeing where things stand and responding to it. The trumpet is a summons, not a verdict. The coffins open outward. The card is about waking to something whole, and the willingness to stand up when the sound comes.",
    position: {
      situation:
        "Seeing something whole. A pattern, a result, a truth that has been circled. Something in your question may be ready to be looked at directly, and looking is the first response.",
      challenge:
        "Judgement's trouble is either not looking, or looking with too much harshness once you do. A reckoning without self-punishment is the balance this card is about.",
      guidance:
        "Acknowledge what an honest look shows, without adding blame, and let it inform the next real decision. What that decision is stays with you.",
    },
    focus: {
      general: "A clear look at where things stand, offered without harshness. That is the theme.",
      relationships: "A pattern that may be worth naming between two people. Start with what you have seen, and leave room for how the other person sees it.",
      work: "An honest review of results so far, before deciding what is next. That is the step this card suggests.",
      growth: "Taking stock of where you are, minus the self-judgement. That is the practice.",
    },
  },
  {
    id: "major-21-world",
    number: 21,
    name: "The World",
    numeral: "XXI",
    keywords: ["completion", "wholeness", "arrival"],
    coreMeaning: "A cycle reaching completion. An arrival, not only an ending.",
    exploration:
      "A dancer moves inside a wreath of laurel, holding a wand in each hand. In the four corners, a man, an eagle, a lion and a bull watch from clouds. The image is about completion. The wreath is closed. The dancer is in motion inside it, so the ending is alive rather than still. The four figures stand for the fixed signs and the four elements: the whole picture, present at once. The card's theme is arrival: a cycle finished and recognised. Wholeness includes what it took to get here.",
    position: {
      situation:
        "Completion. Pieces coming together, a phase finishing, something arriving at its whole shape. Something in your question may be close to complete, and completions are easy to walk past.",
      challenge:
        "The World's trouble is rushing past a completion without marking it, which can leave a finished thing feeling unfinished. Not every ending gets its due. This card asks whether one should.",
      guidance:
        "Take a real moment to recognise what has been completed before starting the next cycle. What form that takes is yours to choose.",
    },
    focus: {
      general: "Completion is the theme. Acknowledging it before moving on is the card's suggestion.",
      relationships: "A shared effort or chapter coming full circle, worth marking together.",
      work: "A project near completion deserves a proper close rather than an immediate pivot.",
      growth: "A cycle you have completed, recognised and allowed to count. That is the small practice this card offers.",
    },
  },
];

export function getCardById(id: string): CardContent | undefined {
  return CARDS.find((c) => c.id === id);
}
