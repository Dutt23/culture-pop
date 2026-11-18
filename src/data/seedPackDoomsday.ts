import type { SeedDefinition } from './seed';

/**
 * "Before Avengers: Doomsday": what to know before the film (owner request 2026-11-18; facts
 * checked against news coverage that day, see docs/PACK_DOOMSDAY.md). Editor-written like the
 * demo entries: no years stored, no sources. Anything that gives away an earlier film's ending is
 * a second, spoiler meaning.
 */
export const DOOMSDAY_DEFINITIONS: readonly SeedDefinition[] = [
  {
    id: 'avengers-doomsday-film',
    kind: 'work',
    title: 'Avengers: Doomsday (2026)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel Studios' Avengers films",
    tags: ['marvel', 'avengers', 'doomsday'],
    aliases: ['avengers doomsday', 'doomsday', 'avengers 5'],
    interpretations: [
      {
        label: 'The next big Avengers film',
        gist: 'The next giant Avengers team-up, out in December 2026.',
        socialMove: "They're asking whether you're going, or counting down to it.",
        reply: 'First show, or wait for the reviews?',
        summary:
          "Marvel's next Avengers film, in cinemas from 18 December 2026 (16 December in the UK). It's directed by the Russo brothers, who made Infinity War and Endgame, and it's the first half of a two-part finale.",
        context:
          'Expect group chats planning the first show, spoiler bans, and lists of what to watch first.',
        usageExample: '"Booking Doomsday tickets for the 18th, who\'s in?"',
      },
    ],
  },
  {
    id: 'doctor-doom-marvel',
    kind: 'character',
    title: 'Doctor Doom (Marvel)',
    category: 'film',
    decade: '2010s+',
    origin: 'Marvel comics, the Fantastic Four',
    tags: ['marvel', 'villain', 'doomsday'],
    aliases: ['doctor doom', 'dr doom', 'victor von doom', 'von doom', 'latveria'],
    interpretations: [
      {
        label: 'The masked villain the film is named after',
        gist: "Marvel's grandest villain: a genius in iron armour and a green cloak.",
        socialMove:
          "They're talking about the film's villain, or calling someone a scheming mastermind.",
        reply: 'Doom has a plan. Doom always has a plan.',
        summary:
          "Victor von Doom, the masked ruler of the small European country of Latveria in Marvel's comics: a brilliant scientist and sorcerer, and the Fantastic Four's oldest enemy. In Avengers: Doomsday he's played by Robert Downey Jr.",
        context:
          'He speaks about himself as "Doom", so fans say "Doom" for anyone grandly sure of their own plan.',
        usageExample: 'A friend with a 12-step plan for the weekend: "Okay, Doctor Doom."',
      },
    ],
  },
  {
    id: 'new-mask-same-task-rdj',
    kind: 'quote',
    title: '“New mask, same task” (Robert Downey Jr., Comic-Con 2024)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel Studios' panel at San Diego Comic-Con, July 2024",
    tags: ['marvel', 'doomsday', 'comeback'],
    aliases: ['new mask same task', 'rdj doctor doom', 'iron man is doctor doom', 'rdj doom'],
    interpretations: [
      {
        label: 'Back, in a whole new role',
        gist: "I'm back, but in a different role.",
        socialMove: "They're announcing a comeback with a twist: same person, new part to play.",
        reply: 'Same task, eh?',
        summary:
          'Robert Downey Jr., who played Iron Man for over a decade, pulled off a Doctor Doom mask at Comic-Con in July 2024 to reveal he was returning to Marvel as Doom, the villain, and said this line.',
        context: 'Said when someone returns to a team, a job or a group in a new role.',
        usageExample:
          'Rejoining the cricket team as captain instead of player: "New mask, same task."',
      },
    ],
  },
  {
    id: 'fantastic-four-first-family',
    kind: 'work',
    title: 'The Fantastic Four (Marvel)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel comics, and Marvel Studios' The Fantastic Four: First Steps (2025)",
    tags: ['marvel', 'team', 'doomsday'],
    aliases: [
      'fantastic four',
      'first steps',
      'fantastic four first steps',
      'marvels first family',
      'reed richards',
      'mister fantastic',
      'invisible woman',
      'human torch',
      'the thing',
      'its clobberin time',
    ],
    interpretations: [
      {
        label: "Marvel's first family of heroes",
        gist: "Marvel's first family: four relatives with very different powers.",
        socialMove:
          "They're talking about the team who clash with Doctor Doom, or a close, chaotic family.",
        reply: "It's clobberin' time.",
        summary:
          'Reed Richards stretches, Sue Storm turns invisible, her brother Johnny bursts into flame, and their friend Ben Grimm is made of rock. In The Fantastic Four: First Steps (2025) they live in a retro-futuristic 1960s-style world and are played by Pedro Pascal, Vanessa Kirby, Joseph Quinn and Ebon Moss-Bachrach.',
        context:
          '"Clobberin\' time" is the Thing\'s catchphrase before a fight, and "first family" gets used for any tight family group.',
        usageExample: 'Siblings arriving together at a party: "Make way, the Fantastic Four."',
      },
    ],
  },
  {
    id: 'the-multiverse-marvel',
    kind: 'other',
    title: 'The multiverse (Marvel)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel Studios' films and shows since Loki and Spider-Man: No Way Home",
    tags: ['marvel', 'multiverse', 'doomsday'],
    aliases: ['multiverse', 'multiverse saga', 'another universe', 'alternate universe'],
    interpretations: [
      {
        label: 'Many universes side by side',
        gist: 'Endless other universes, each with its own versions of everyone.',
        socialMove: "They're joking that things went differently somewhere else.",
        reply: 'In another universe, I said yes.',
        summary:
          "Marvel's recent films and shows say there isn't one universe but countless ones. Characters can cross between them, which is how heroes from other film series (like the old X-Men films) can meet the Avengers.",
        context: '"In another universe…" has become the go-to way to imagine a different outcome.',
        usageExample: 'After missing the bus by seconds: "In some universe, I caught that."',
      },
    ],
  },
  {
    id: 'variant-loki',
    kind: 'phrase',
    title: 'A variant (Loki)',
    category: 'tv',
    decade: '2010s+',
    origin: "Marvel Studios' Loki (2021–2023)",
    tags: ['marvel', 'multiverse', 'doomsday'],
    aliases: ['variant', 'variants', 'my variant', 'loki variant'],
    interpretations: [
      {
        label: 'Another version of the same person',
        gist: 'Another version of someone, from another timeline.',
        socialMove: "They're saying someone is a slightly different copy of a person they know.",
        reply: 'Which variant are we getting today?',
        summary:
          "In the series Loki, a variant is a version of a person who split off from the main timeline: same person, different life. The show is full of Lokis, including one who's a crocodile.",
        context: 'Used for look-alikes, or a friend who acts totally different in a new mood.',
        usageExample: 'Your sleepy Monday self versus your Friday self: "Different variant."',
      },
    ],
  },
  {
    id: 'tva-sacred-timeline-loki',
    kind: 'phrase',
    title: 'The TVA and the Sacred Timeline (Loki)',
    category: 'tv',
    decade: '2010s+',
    origin: "Marvel Studios' Loki (2021–2023)",
    tags: ['marvel', 'multiverse', 'doomsday'],
    aliases: ['tva', 'time variance authority', 'sacred timeline', 'nexus event'],
    interpretations: [
      {
        label: 'The office that keeps time in line',
        gist: 'A bureaucracy that keeps time on one approved path.',
        socialMove: "They're joking about rules, paperwork or a plan that mustn't change.",
        reply: 'Is this a nexus event?',
        summary:
          'In Loki, the Time Variance Authority is a very boring-looking office that guards the "Sacred Timeline", the one approved version of history. Anything that splits off is a "nexus event" and gets cleaned up.',
        context: 'Said about strict schedules, or office bureaucracy that feels outside time.',
        usageExample:
          'When someone moves the team meeting again: "Call the TVA, that\'s a nexus event."',
      },
      {
        label: 'How the series ends',
        gist: 'Loki chooses to hold all the timelines together himself.',
        socialMove:
          "They're quoting the series' ending. It's from Loki season 2 (2023): save the scene until you've seen it.",
        reply: 'Glorious purpose.',
        summary:
          'At the end of season 2, Loki gives up his own freedom to hold the branching timelines together, letting the multiverse grow instead of being pruned.',
        context:
          "For fans it's Loki's big act of sacrifice, and it shapes the multiverse after it.",
        usageExample: 'Fans calling it the best ending in recent Marvel.',
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'incursion-multiverse-of-madness',
    kind: 'phrase',
    title: 'An incursion (Doctor Strange in the Multiverse of Madness)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel Studios' Doctor Strange in the Multiverse of Madness (2022)",
    tags: ['marvel', 'multiverse', 'doomsday'],
    aliases: ['incursion', 'incursions', 'universes collide', 'multiverse of madness'],
    interpretations: [
      {
        label: 'Two universes crashing into each other',
        gist: 'When two universes collide and both are destroyed.',
        socialMove: "They're saying two things that should stay apart have collided, badly.",
        reply: 'Keep your universes apart.',
        summary:
          'Doctor Strange in the Multiverse of Madness (2022) explains that when two universes run into each other, both can be wiped out. Guides to Doomsday point to it as the threat hanging over the new films.',
        context:
          'Said jokingly when two friend groups, or work and family, meet for the first time.',
        usageExample: 'Your school friends meeting your office friends: "Incursion incoming."',
      },
    ],
  },
  {
    id: 'sam-wilson-captain-america',
    kind: 'character',
    title: 'Sam Wilson, the new Captain America',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel Studios' films and The Falcon and the Winter Soldier (2021)",
    tags: ['marvel', 'avengers', 'doomsday'],
    aliases: [
      'sam wilson captain america',
      'new captain america',
      'falcon captain america',
      'brave new world',
      'anthony mackie captain america',
    ],
    interpretations: [
      {
        label: "Who's Captain America now",
        gist: "Today's Captain America is Sam Wilson, who used to be the Falcon.",
        socialMove: "They're pointing out that someone has stepped into a big role.",
        reply: 'The shield fits.',
        summary:
          'Sam Wilson (Anthony Mackie), the winged Falcon in earlier films, now carries the shield as Captain America, most recently in Captain America: Brave New World (2025). He returns in Avengers: Doomsday.',
        context:
          'Used when someone takes over from a legend: a new captain, a new head of the family.',
        usageExample: 'The new team lead on day one: "Captain America now, are we?"',
      },
      {
        label: 'How he got the shield',
        gist: 'Steve Rogers hands him the shield.',
        socialMove:
          "They're quoting the moment Steve passes it on. It's from Avengers: Endgame (2019): save the scene until you've seen it.",
        reply: "It's yours, Sam.",
        summary:
          'At the end of Endgame, an old Steve Rogers, who went back in time to live his life, gives Sam the shield and asks him to carry it.',
        context: "Fans quote it when someone's trusted with a family heirloom or a big job.",
        usageExample: 'Handing over the house keys to a younger sibling: "How does it feel?"',
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'thunderbolts-new-avengers',
    kind: 'work',
    title: 'Thunderbolts* (2025)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel Studios' Thunderbolts* (2025)",
    tags: ['marvel', 'team', 'doomsday'],
    aliases: ['thunderbolts', 'thunderbolts asterisk', 'new avengers', 'yelena belova'],
    interpretations: [
      {
        label: 'A team of misfits',
        gist: 'A team of misfits and former villains, thrown together.',
        socialMove: "They're describing a group nobody expected to work, that somehow does.",
        reply: 'Misfits assemble.',
        summary:
          "Thunderbolts* (2025) puts together leftover antiheroes: Yelena Belova (Florence Pugh), Bucky Barnes (Sebastian Stan), Red Guardian (David Harbour), John Walker (Wyatt Russell) and Ghost. They're back in Avengers: Doomsday.",
        context: 'Used for any scrappy group project team or office five-a-side side.',
        usageExample: 'The last four people picked for the quiz team: "The Thunderbolts."',
      },
      {
        label: 'What the asterisk means',
        gist: 'The team is renamed the New Avengers.',
        socialMove:
          "They're explaining the title's asterisk. It's from Thunderbolts* (2025): save the scene until you've seen it.",
        reply: 'Sam would like a word.',
        summary:
          'At the end of the film the team is publicly named "the New Avengers", without asking anyone. The asterisk in the title hints the name is about to change, and the real Avengers aren\'t pleased.',
        context: 'Fans add an asterisk to anything with a name that might not last.',
        usageExample: 'A group chat renamed for the third time this week.',
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'x-men-return-doomsday',
    kind: 'other',
    title: 'The original X-Men in Avengers: Doomsday',
    category: 'film',
    decade: '2000s',
    origin:
      "Fox's X-Men films (2000–2014) and Marvel's Avengers: Doomsday cast reveal (March 2025)",
    tags: ['marvel', 'x-men', 'doomsday'],
    aliases: [
      'x-men doomsday',
      'professor x magneto doomsday',
      'patrick stewart ian mckellen',
      'old x-men',
      'gambit channing tatum',
    ],
    interpretations: [
      {
        label: 'The X-Men from the 2000s films are back',
        gist: 'Stars from the 2000s X-Men films return, alongside the Avengers.',
        socialMove: "They're excited (or nostalgic) about old favourites coming back.",
        reply: 'Nostalgia, assemble.',
        summary:
          "When Marvel revealed the cast in March 2025 (names on director's chairs, in a long livestream), it included Patrick Stewart (Professor X), Ian McKellen (Magneto), James Marsden (Cyclops), Alan Cumming (Nightcrawler) and Rebecca Romijn (Mystique) from the old X-Men films, plus Channing Tatum as Gambit.",
        context:
          'The multiverse is how characters from other film series can meet the Avengers, so fans expect big reunions.',
        usageExample: 'Your old school friends turning up at a reunion: "The X-Men are back."',
      },
    ],
  },
  {
    id: 'avengers-secret-wars-film',
    kind: 'work',
    title: 'Avengers: Secret Wars (2027)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel Studios' Avengers films",
    tags: ['marvel', 'avengers', 'doomsday'],
    aliases: ['secret wars', 'avengers secret wars', 'avengers 6'],
    interpretations: [
      {
        label: 'The film after Doomsday',
        gist: 'The second half of the finale, due a year after Doomsday.',
        socialMove: "They're looking ahead to how the whole story ends.",
        reply: 'See you in December 2027.',
        summary:
          "Avengers: Secret Wars is set for 17 December 2027 and finishes the story Doomsday starts. It's named after Marvel's huge crossover comics of the same name, from 1984 and 2015.",
        context: 'People mention it to say Doomsday may end on a cliffhanger.',
        usageExample: '"Don\'t expect an ending, it\'s part one. Secret Wars wraps it up."',
      },
    ],
  },
];

/** The ready-made pack, in reading order: new cards plus Marvel cards already in the app. */
export const DOOMSDAY_PACK = {
  id: 'pack:before-avengers-doomsday',
  name: 'Before Avengers: Doomsday',
  referenceIds: [
    'avengers-doomsday-film',
    'doctor-doom-marvel',
    'new-mask-same-task-rdj',
    'fantastic-four-first-family',
    'the-multiverse-marvel',
    'variant-loki',
    'tva-sacred-timeline-loki',
    'incursion-multiverse-of-madness',
    'sam-wilson-captain-america',
    'thunderbolts-new-avengers',
    'x-men-return-doomsday',
    'the-snap-avengers',
    'avengers-assemble',
    'i-can-do-this-all-day-captain-america',
    'i-am-iron-man-iron-man',
    'i-love-you-3000-endgame',
    'i-am-groot-guardians',
    'avengers-secret-wars-film',
  ],
} as const;
