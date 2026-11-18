import type { SeedDefinition } from './seed';

/**
 * "Before The Chainsmokers live": who they are, the songs a crowd sings back, and fan-favourite
 * deep cuts (owner request 2026-11-18; facts checked that day, see docs/PACK_CHAINSMOKERS.md).
 * Editor-written like the demo entries: no years stored, no sources, no lyrics quoted.
 */
export const CHAINSMOKERS_DEFINITIONS: readonly SeedDefinition[] = [
  {
    id: 'the-chainsmokers',
    kind: 'other',
    title: 'The Chainsmokers (who they are)',
    category: 'music',
    decade: '2010s+',
    origin: 'An American DJ and production duo from New York',
    tags: ['music', 'edm', 'chainsmokers'],
    aliases: ['the chainsmokers', 'chainsmokers', 'alex pall', 'drew taggart'],
    interpretations: [
      {
        label: 'The duo behind the 2010s dance-pop hits',
        gist: 'A New York DJ duo behind some of the biggest dance-pop songs of the 2010s.',
        socialMove: "They're talking about the act, or asking if you know who's playing.",
        reply: "Wait, they did Closer? I'm in.",
        summary:
          'Alex Pall and Drew Taggart started working together in New York in 2012, first remixing indie songs. Drew sings on many of their tracks; Alex mostly DJs and produces. They won a Grammy, have made five albums, released the Love Is Kind EP with Oaks in 2026, and went independent that October after 11 years with their label.',
        context:
          'Their shows mix their own hits, big drops and remixes, so even casual fans know more songs than they think.',
        usageExample: '"The Chainsmokers are playing Mumbai in December, want to go?"',
      },
    ],
  },
  {
    id: 'selfie-chainsmokers',
    kind: 'work',
    title: '#Selfie (The Chainsmokers)',
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers, 2014',
    tags: ['music', 'chainsmokers', 'breakthrough'],
    aliases: ['#selfie', 'selfie song', 'let me take a selfie'],
    interpretations: [
      {
        label: 'The joke song that made their name',
        gist: 'Their tongue-in-cheek breakout song, poking fun at club selfie culture.',
        socialMove: "They're about to take a selfie, ironically.",
        reply: 'But first…',
        summary:
          'Released free at the end of 2013 and re-released in 2014, it became their breakthrough: a spoken, eye-rolling monologue of a girl at a club, over a dance beat.',
        context:
          "Its spoken hook still gets said before group selfies. It's a joke, and everyone knows it.",
        usageExample: 'Holding up the phone at dinner: "Let me take a selfie."',
      },
    ],
  },
  {
    id: 'roses-chainsmokers',
    kind: 'work',
    title: 'Roses (The Chainsmokers)',
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers featuring Rozes, 2015',
    tags: ['music', 'chainsmokers', 'hit'],
    aliases: ['roses chainsmokers', 'roses rozes'],
    interpretations: [
      {
        label: 'Their first real hit',
        gist: 'The dreamy love song that turned them from a joke act into hitmakers.',
        socialMove: "They're mentioning the song that first made people take them seriously.",
        reply: 'Still a great song.',
        summary:
          'Sung by Rozes, Roses (2015) was their first top-10 hit in the US, from their first EP, Bouquet.',
        context: 'A slower, warm-up song at shows; long-time fans cheer when it starts.',
        usageExample: '"They opened with Roses and I knew every word."',
      },
    ],
  },
  {
    id: 'dont-let-me-down-chainsmokers',
    kind: 'work',
    title: "Don't Let Me Down (The Chainsmokers)",
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers featuring Daya, 2016',
    tags: ['music', 'chainsmokers', 'grammy'],
    aliases: ["don't let me down chainsmokers", 'dont let me down daya'],
    interpretations: [
      {
        label: 'The Grammy winner with the huge drop',
        gist: 'Their Grammy-winning hit, famous for its big drop.',
        socialMove: "They're bracing for the moment the beat drops.",
        reply: 'Wait for the drop.',
        summary:
          "Sung by Daya, it won the Grammy for Best Dance Recording (2017). A plea for help from someone who's running out of strength, before a heavy electronic drop.",
        context:
          'At a show, it is one of the loudest moments: everyone waits for the drop together.',
        usageExample: 'When the intro starts: "Here it comes, here it comes…"',
      },
    ],
  },
  {
    id: 'closer-chainsmokers',
    kind: 'work',
    title: 'Closer (The Chainsmokers)',
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers featuring Halsey, 2016',
    tags: ['music', 'chainsmokers', 'number one'],
    aliases: ['closer chainsmokers', 'closer halsey', 'hotel room in boulder'],
    interpretations: [
      {
        label: 'Their biggest song',
        gist: 'Their biggest hit: two exes running into each other years later.',
        socialMove: "They're being nostalgic, or teasing someone about an old flame.",
        reply: 'Never getting older.',
        summary:
          'A duet between Drew Taggart and Halsey, released in July 2016. It went to No. 1 in the US and the UK and spent 12 weeks at the top of the US chart. The story: two old flames meet again and fall back into old habits, with a famous nod to a Blink-182 album.',
        context: 'The song most people know them for, and the biggest sing-along of the night.',
        usageExample:
          'Running into a school friend at the airport: "So, we meet again… like Closer."',
      },
    ],
  },
  {
    id: 'something-just-like-this-chainsmokers',
    kind: 'work',
    title: 'Something Just Like This (The Chainsmokers & Coldplay)',
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers and Coldplay, 2017',
    tags: ['music', 'chainsmokers', 'coldplay'],
    aliases: ['something just like this', 'chainsmokers coldplay'],
    interpretations: [
      {
        label: 'Ordinary love beats superheroes',
        gist: "You don't need a superhero, just someone real.",
        socialMove: "They're saying they want something simple and genuine, not a fairy tale.",
        reply: 'Just like this.',
        summary:
          'Their 2017 collaboration with Coldplay, sung by Chris Martin. It lists legends and superheroes, then says all the singer wants is an ordinary, real kind of love.',
        context: 'A crowd favourite that Coldplay fans know too, so it gets everyone singing.',
        usageExample: 'Choosing a cosy night in over a big party: "Something just like this."',
      },
    ],
  },
  {
    id: 'paris-chainsmokers',
    kind: 'work',
    title: 'Paris (The Chainsmokers)',
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers, 2017',
    tags: ['music', 'chainsmokers', 'fan favourite'],
    aliases: ['paris chainsmokers', 'we were in paris'],
    interpretations: [
      {
        label: 'Escaping somewhere together',
        gist: 'A dreamy song about running away together to start over.',
        socialMove: "They're dreaming of escaping somewhere with someone.",
        reply: "Let's go to Paris.",
        summary:
          'Released in early 2017, ahead of their first album, Memories...Do Not Open. Two people imagine leaving everything behind to make it work somewhere new. Fans often call it one of their best.',
        context: 'Used for trip plans and fresh starts, and a mellow moment at shows.',
        usageExample: 'Planning a weekend getaway: "We were in Paris… well, Goa."',
      },
    ],
  },
  {
    id: 'high-chainsmokers',
    kind: 'work',
    title: 'High (The Chainsmokers)',
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers, 2022',
    tags: ['music', 'chainsmokers', 'comeback'],
    aliases: ['high chainsmokers', 'so far so good'],
    interpretations: [
      {
        label: 'Their 2022 comeback',
        gist: 'Their 2022 comeback single: guitar-led, sung by Drew.',
        socialMove: "They're talking about the newer, more band-like Chainsmokers.",
        reply: 'So far so good.',
        summary:
          "The lead single from their fourth album, So Far So Good (2022), after a break from releasing music. It leans on guitars and Drew's own singing.",
        context: 'Newer fans may know this before the 2016 hits.',
        usageExample: '"They played High and the new stuff, then all the classics."',
      },
    ],
  },
  {
    id: 'inside-out-chainsmokers',
    kind: 'work',
    title: 'Inside Out (The Chainsmokers, a fan-favourite deep cut)',
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers featuring Charlee',
    tags: ['music', 'chainsmokers', 'hidden gem'],
    aliases: ['inside out chainsmokers', 'inside out charlee'],
    interpretations: [
      {
        label: 'A deep cut fans swear by',
        gist: 'An early track fans call underrated: knowing someone inside out.',
        socialMove: "They're showing they're a real fan, not just a radio listener.",
        reply: 'Underrated, honestly.',
        summary:
          'An early song sung by Charlee, from their Collage EP period. It never became a big radio hit, but it comes up again and again when fans list their most underrated tracks.',
        context: "Mentioning it to a fan is a quick way to show you've gone past the hits.",
        usageExample: '"Everyone knows Closer. Have you heard Inside Out?"',
      },
    ],
  },
  {
    id: 'everybody-hates-me-chainsmokers',
    kind: 'work',
    title: 'Everybody Hates Me (The Chainsmokers, a fan-favourite deep cut)',
    category: 'music',
    decade: '2010s+',
    origin: 'The Chainsmokers, from Sick Boy (2018)',
    tags: ['music', 'chainsmokers', 'hidden gem'],
    aliases: ['everybody hates me chainsmokers', 'sick boy album'],
    interpretations: [
      {
        label: 'Their honest, self-aware side',
        gist: "A self-aware song about feeling disliked once you're famous.",
        socialMove: "They're joking about feeling like the odd one out.",
        reply: 'Not everybody.',
        summary:
          'From their second album, Sick Boy (2018), a darker, more personal record. Drew sings about anxiety and how fame changes how people see you. Fans often name it as underrated.',
        context: "Shows a side of them that the party hits don't.",
        usageExample: 'After a group chat goes quiet on your idea: "Everybody hates me."',
      },
    ],
  },
];

/** The ready-made pack: who they are, the big sing-alongs, then the deep cuts. */
export const CHAINSMOKERS_PACK = {
  id: 'pack:before-the-chainsmokers-live',
  name: 'Before The Chainsmokers live',
  referenceIds: [
    'the-chainsmokers',
    'closer-chainsmokers',
    'dont-let-me-down-chainsmokers',
    'something-just-like-this-chainsmokers',
    'roses-chainsmokers',
    'paris-chainsmokers',
    'selfie-chainsmokers',
    'high-chainsmokers',
    'inside-out-chainsmokers',
    'everybody-hates-me-chainsmokers',
  ],
} as const;
