import type { SeedDefinition } from './seed';

/**
 * "You'll hear this" pack, batch 2 (owner-approved 2026-11-17, docs/PACK_BATCH_2_DRAFT.md).
 * Editor-written like the demo entries: no years stored, no sources.
 */
export const PACK_2_DEFINITIONS: readonly SeedDefinition[] = [
  {
    id: 'phenomenal-cosmic-powers-aladdin',
    kind: 'quote',
    title: '“Phenomenal cosmic powers… itty bitty living space” (Aladdin)',
    category: 'film',
    decade: '1990s',
    origin: "Disney's animated film Aladdin",
    tags: ['disney', 'genie', 'big dreams'],
    aliases: [
      'phenomenal cosmic powers itty bitty living space',
      'phenomenal cosmic powers',
      'itty bitty living space',
      'genie aladdin',
    ],
    interpretations: [
      {
        label: 'Big plans in a tiny space',
        gist: 'Huge talent, tiny space.',
        socialMove: "They're joking that big plans are squeezed into a very small place.",
        reply: 'Three wishes, please.',
        summary:
          'The Genie, just out of his magic lamp, jokes that he has enormous powers but a very small home.',
        context: 'Said about tiny flats, cramped desks and big dreams in small rooms.',
        usageExample:
          'Showing off a one-room flat with a huge gaming setup: "Phenomenal cosmic powers... itty bitty living space."',
      },
    ],
  },
  {
    id: 'fish-are-friends-finding-nemo',
    kind: 'quote',
    title: '“Fish are friends, not food” (Finding Nemo)',
    category: 'film',
    decade: '2000s',
    origin: "Pixar's Finding Nemo",
    tags: ['pixar', 'refusal'],
    aliases: ['fish are friends not food', 'fish are friends', 'bruce the shark'],
    interpretations: [
      {
        label: 'Refusing food, nicely, on principle',
        gist: "I'm refusing on principle, and I'm being nice about it.",
        socialMove: "They're turning down food (or a bad temptation) with a joke.",
        reply: 'Good shark.',
        summary:
          'Bruce, a very large and surprisingly friendly shark, leads a group of sharks who promise not to eat fish. This is their motto.',
        context:
          'Said by vegetarians at a seafood buffet, or by anyone trying to resist something tempting.',
        usageExample: 'Passing on the prawns at a wedding: "Fish are friends, not food."',
      },
    ],
  },
  {
    id: 'ka-chow-cars',
    kind: 'quote',
    title: '“Ka-chow!” (Cars)',
    category: 'film',
    decade: '2000s',
    origin: "Pixar's Cars",
    tags: ['pixar', 'showing off'],
    aliases: ['ka chow', 'kachow', 'lightning mcqueen'],
    interpretations: [
      {
        label: 'Showing off with a wink',
        gist: 'Look how cool I am.',
        socialMove: "They're showing off, with a wink and a finger-gun.",
        reply: 'Easy, McQueen.',
        summary:
          "Lightning McQueen, a hotshot race car, says it with a wink and a finger-gun whenever he's feeling himself.",
        context: 'Said after a smooth move, a good outfit or a perfect parking job.',
        usageExample: 'Parking in one go, in a tight spot: "Ka-chow!"',
      },
    ],
  },
  {
    id: 'hi-im-olaf-frozen',
    kind: 'quote',
    title: "“Hi, I'm Olaf and I like warm hugs” (Frozen)",
    category: 'film',
    decade: '2010s+',
    origin: "Disney's animated film Frozen",
    tags: ['disney', 'friendly'],
    aliases: ["i'm olaf and i like warm hugs", 'i like warm hugs', 'olaf', 'warm hugs olaf'],
    interpretations: [
      {
        label: 'A sweet, friendly introduction',
        gist: 'A sweet, innocent hello.',
        socialMove: "They're introducing themselves in a very friendly, slightly silly way.",
        reply: 'Hello, Olaf. Hug accepted.',
        summary: 'Olaf, a cheerful snowman who comes to life, introduces himself this way to Anna.',
        context: 'Said when meeting a new group, or when someone is being extra wholesome.',
        usageExample: 'Joining a new class group chat: "Hi, I\'m Rohan and I like warm hugs."',
      },
    ],
  },
  {
    id: 'i-am-iron-man-iron-man',
    kind: 'quote',
    title: '“I am Iron Man” (Iron Man)',
    category: 'film',
    decade: '2000s',
    origin: "Marvel's Iron Man film",
    tags: ['marvel', 'pride'],
    aliases: ['i am iron man', 'tony stark', 'iron man'],
    interpretations: [
      {
        label: 'Owning up with a big flourish',
        gist: "Yes, that was me, and I'm proud of it.",
        socialMove: "They're owning up to something with a big flourish.",
        reply: 'Mic drop.',
        summary:
          'Tony Stark, a billionaire inventor who builds a metal suit, says it in front of a room full of reporters in the first Iron Man film.',
        context:
          'Said when someone proudly admits they made the playlist, finished the project or ate the last slice.',
        usageExample: '"Who made this amazing playlist?" / "I am Iron Man."',
      },
      {
        label: 'What the line means later on',
        gist: 'A big, emotional heroic moment.',
        socialMove:
          "They're quoting the film's most emotional high point. It's from Avengers: Endgame (2019): save the scene until you've seen it.",
        reply: "Okay, now I'm emotional.",
        summary:
          'Near the end of Endgame, Tony says it again, just before the act that costs him his life.',
        context:
          "For fans, the line now carries Tony's sacrifice, so it's often shared with a sad emoji.",
        usageExample: "Fans posting it on the film's anniversary.",
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'with-great-power-spider-man',
    kind: 'quote',
    title: '“With great power comes great responsibility” (Spider-Man)',
    category: 'film',
    decade: '2000s',
    origin: 'the Spider-Man films',
    tags: ['marvel', 'responsibility'],
    aliases: [
      'with great power comes great responsibility',
      'great power great responsibility',
      'peter parker',
    ],
    interpretations: [
      {
        label: 'Using big power wisely',
        gist: 'If you can do something big, use it wisely.',
        socialMove:
          "They're giving serious advice, or joking about someone who just got a tiny bit of power.",
        reply: "Noted. I'll be responsible.",
        summary:
          'Peter Parker, a teenager who suddenly gets spider powers, is given this advice by a wise older relative in the Spider-Man films.',
        context:
          'Said to a friend who just got the Wi-Fi admin password, a promotion or the TV remote.',
        usageExample:
          'Handing a friend the aux cable: "With great power comes great responsibility."',
      },
      {
        label: 'What the line means much later',
        gist: 'The moment a hero is made.',
        socialMove:
          "They're quoting the heartbreaking turning point in Peter's story. It's from Spider-Man (2002): save the scene until you've seen it.",
        reply: 'He took it to heart.',
        summary:
          "The advice comes from Peter's Uncle Ben. Soon after, Ben is killed, and Peter decides to spend his life helping people.",
        context: "For fans, the line is tied to Ben's loss, so it's said softly, not as a joke.",
        usageExample: "A fan's quiet answer when asked why Spider-Man keeps going.",
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'im-always-angry-avengers',
    kind: 'quote',
    title: "“I'm always angry” (The Avengers)",
    category: 'film',
    decade: '2010s+',
    origin: "Marvel's The Avengers",
    tags: ['marvel', 'grumpy'],
    aliases: ["i'm always angry", "that's my secret captain", 'bruce banner'],
    interpretations: [
      {
        label: 'Permanently irritated, and joking about it',
        gist: "I'm cross all the time, and I make it work.",
        socialMove:
          "They're joking that they're permanently irritated, usually about something small.",
        reply: 'Same, Bruce.',
        summary:
          "Bruce Banner, a quiet scientist who turns into the Hulk when he's angry, answers Captain America's question about how he stays calm.",
        context:
          'Said with a calm face when something small goes wrong: a slow lift, a full inbox, a long traffic jam.',
        usageExample:
          'Stuck in traffic for the second hour: "That\'s my secret. I\'m always angry."',
      },
    ],
  },
  {
    id: 'wingardium-leviosa-harry-potter',
    kind: 'quote',
    title: '“Wingardium Leviosa” (Harry Potter)',
    category: 'film',
    decade: '2000s',
    origin: 'the Harry Potter films',
    tags: ['harry potter', 'spells'],
    aliases: ['wingardium leviosa', 'leviosa not leviosar', 'hermione granger'],
    interpretations: [
      {
        label: 'A spell to make things float',
        gist: 'Make it float! (or: say it properly)',
        socialMove:
          "They're pretending to cast a spell, or correcting someone's pronunciation like a strict friend.",
        reply: 'Do it like Hermione.',
        summary:
          "In their first charms class, Ron struggles to lift a feather. Hermione tells him he's saying the spell wrong, then lifts it herself.",
        context:
          'Said when lifting a pillow, a charger or anything light, or as a gentle correction.',
        usageExample: 'Picking up the TV remote with a flourish: "Wingardium Leviosa."',
      },
    ],
  },
  {
    id: 'dobby-is-a-free-elf-harry-potter',
    kind: 'quote',
    title: '“Dobby is a free elf” (Harry Potter)',
    category: 'film',
    decade: '2010s+',
    origin: 'the Harry Potter films',
    tags: ['harry potter', 'freedom'],
    aliases: ['dobby is a free elf', 'dobby is free', 'free elf dobby', 'dobby'],
    interpretations: [
      {
        label: 'Free of a boss, and proud',
        gist: "I'm my own boss now, and I'm proud of it.",
        socialMove: "They're celebrating being free of a job, a boss or a duty.",
        reply: 'Free at last.',
        summary: 'Dobby, a house-elf freed from a cruel family, says it proudly.',
        context: 'Said on the last day at a job, or after the last exam paper.',
        usageExample: 'Handing in a resignation letter: "Dobby is a free elf."',
      },
      {
        label: 'A quieter moment later on',
        gist: 'A gentle goodbye to a loyal friend.',
        socialMove:
          "They're quoting an emotional farewell. It's from Harry Potter and the Deathly Hallows – Part 1 (2010): save the scene until you've seen it.",
        reply: 'Thank you for everything, Dobby.',
        summary:
          'Dobby dies saving Harry and his friends. Harry digs his grave by hand, and the stone reads "Here lies Dobby, a free elf."',
        context:
          "For fans it's one of the saddest moments in the series, so the line is said quietly.",
        usageExample: "A fan posting the gravestone line on the film's anniversary.",
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'could-i-be-any-more-friends',
    kind: 'quote',
    title: '“Could I BE any more…?” (Friends)',
    category: 'tv',
    decade: '1990s',
    origin: 'the TV show Friends',
    tags: ['sitcom', 'sarcasm'],
    aliases: ['could i be any more', 'chandler bing'],
    interpretations: [
      {
        label: 'Heavy sarcasm, one stressed word',
        gist: 'Sarcasm: the word that follows is the opposite of what I mean.',
        socialMove: "They're teasing someone, or themselves, with heavy sarcasm.",
        reply: 'Could you be any more dramatic?',
        summary:
          'Chandler, the group\'s sarcastic friend, stresses the word "be" and adds a word that makes his point. It\'s his catchphrase.',
        context:
          'Said when someone states the obvious, arrives very late or complains about something small.',
        usageExample: 'A friend turns up 40 minutes late: "Could you BE any later?"',
      },
    ],
  },
  {
    id: 'unagi-friends',
    kind: 'quote',
    title: '“Unagi” (Friends)',
    category: 'tv',
    decade: '2000s',
    origin: 'the TV show Friends',
    tags: ['sitcom', 'alertness'],
    aliases: ['unagi', 'state of total awareness', 'ross unagi'],
    interpretations: [
      {
        label: 'Total awareness, with a serious face',
        gist: "I'm super alert, and nothing can surprise me.",
        socialMove: "They're boasting about their awareness, with a very serious face.",
        reply: 'Okay, Ross. Eyes open.',
        summary:
          'Ross tells his friends that "unagi" is a state of total awareness that keeps you ready for any surprise. They don\'t take it very seriously.',
        context:
          'Said while pretending to be a ninja, or while checking behind you in a quiet corridor.',
        usageExample: 'Walking into a dark kitchen at night: "Unagi."',
      },
    ],
  },
  {
    id: 'not-superstitious-little-stitious-the-office',
    kind: 'quote',
    title: "“I'm not superstitious, but I am a little stitious” (The Office)",
    category: 'tv',
    decade: '2000s',
    origin: 'the US sitcom The Office',
    tags: ['sitcom', 'superstition'],
    aliases: [
      "i'm not superstitious but i am a little stitious",
      'a little stitious',
      'little stitious',
    ],
    interpretations: [
      {
        label: 'A small, silly superstition',
        gist: "I know it's silly, but I still believe a bit.",
        socialMove: "They're admitting to a small, silly superstition.",
        reply: 'Touch wood, then.',
        summary:
          'Michael Scott, the clueless boss, says it to admit, in his own muddled way, that he believes in bad luck.',
        context:
          'Said before an exam, a match or a trip, when someone avoids a black cat or touches wood.',
        usageExample:
          'Wearing the same lucky shirt for the final: "I\'m not superstitious, but I am a little stitious."',
      },
    ],
  },
  {
    id: 'cool-cool-cool-brooklyn-nine-nine',
    kind: 'quote',
    title: '“Cool cool cool” (Brooklyn Nine-Nine)',
    category: 'tv',
    decade: '2010s+',
    origin: 'the TV show Brooklyn Nine-Nine',
    tags: ['sitcom', 'nerves'],
    aliases: ['cool cool cool', 'cool cool cool cool', 'jake peralta', 'brooklyn nine nine'],
    interpretations: [
      {
        label: 'Nervous, pretending to be fine',
        gist: "I'm nervous, but I'm pretending I'm fine.",
        socialMove: "They're covering a worry with fake calm.",
        reply: 'You okay, Jake?',
        summary:
          'Jake Peralta, a goofy detective, mutters it when he\'s nervous, often several times in a row and sometimes followed by "no doubt, no doubt, no doubt".',
        context: 'Said after hearing bad news, or when a boss says "we need to talk".',
        usageExample: '"Can we talk after lunch?" / "Cool cool cool cool cool."',
      },
    ],
  },
  {
    id: 'treat-yo-self-parks-and-recreation',
    kind: 'quote',
    title: '“Treat yo self” (Parks and Recreation)',
    category: 'tv',
    decade: '2010s+',
    origin: 'the TV show Parks and Recreation',
    tags: ['sitcom', 'treats'],
    aliases: ['treat yo self', 'parks and rec', 'tom and donna'],
    interpretations: [
      {
        label: 'Permission to splurge on yourself',
        gist: 'Spoil yourself today, with no guilt.',
        socialMove: "They're giving themselves (or a friend) permission to splurge.",
        reply: 'Yes, you deserve it.',
        summary:
          'Tom and Donna take one day a year to spend on whatever they like, and they call it "Treat Yo Self".',
        context:
          'Said at the end of a hard month, before a shopping trip, a spa visit or a big dessert.',
        usageExample: 'Salary day, outside the mall: "Treat yo self."',
      },
    ],
  },
  {
    id: 'drake-yes-and-no-meme',
    kind: 'meme',
    title: 'Drake yes and no (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'two stills from a Drake music video',
    tags: ['reaction image', 'preferences'],
    aliases: ['drake meme', 'drake disapproves', 'drake approves', 'hotline bling meme'],
    interpretations: [
      {
        label: 'Preferring one small thing over another',
        gist: "I don't like this one, I like that one.",
        socialMove: "They're showing a clear preference, usually between two small things.",
        reply: 'Obviously the second one.',
        summary:
          'Two stills from a music video by the rapper Drake. In the first he turns away with a hand up. In the second he points and smiles. People put what they reject on top and what they prefer below.',
        context: 'Used for any "no to this, yes to that" joke, from food to study plans.',
        usageExample: 'Top: "Sleeping at 11 p.m." Bottom: "One more episode."',
      },
    ],
  },
  {
    id: 'galaxy-brain-meme',
    kind: 'meme',
    title: 'Galaxy brain (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a multi-panel brain meme',
    tags: ['reaction image', 'overthinking'],
    aliases: ['galaxy brain', 'expanding brain', 'galaxy brain meme'],
    interpretations: [
      {
        label: 'Overcomplicated logic, going too far',
        gist: 'An idea that sounds super clever but is really silly.',
        socialMove: "They're mocking (or praising) logic that goes a bit too far.",
        reply: 'Big brain energy.',
        summary:
          'A picture of a brain that glows bigger and brighter across several panels. Each panel has a "smarter" idea than the one before, and the last one is usually the silliest.',
        context:
          'Used when someone has a wildly overcomplicated plan, or a surprisingly smart shortcut.',
        usageExample: 'Panel one: "Save money." Panel four: "Never check your bank balance."',
      },
    ],
  },
  {
    id: 'hide-the-pain-harold-meme',
    kind: 'meme',
    title: 'Hide the Pain Harold (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a stock photo of an older man',
    tags: ['reaction image', 'politeness'],
    aliases: ['hide the pain harold', 'pain harold', 'harold meme'],
    interpretations: [
      {
        label: 'Smiling while quietly struggling',
        gist: 'Smiling while quietly struggling.',
        socialMove: "They're joking about staying polite while something bothers them.",
        reply: 'Same, Harold.',
        summary:
          'Stock photos of an older man with a warm smile and tired eyes. People caption them with moments where you smile on the outside and wince on the inside.',
        context: 'Used for awkward meetings, small disasters and "I\'m fine" moments.',
        usageExample: 'A message at 6:55 p.m.: "Quick call before you leave?"',
      },
    ],
  },
  {
    id: 'doge-meme',
    kind: 'meme',
    title: 'Doge (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a photo of a Shiba Inu dog',
    tags: ['reaction image', 'cute'],
    aliases: ['doge', 'much wow', 'such wow', 'shiba inu meme'],
    interpretations: [
      {
        label: 'Silly, excited wow in broken English',
        gist: 'Wow, how nice! (in cute, broken English)',
        socialMove: 'They\'re reacting with silly excitement, in the "such X, very Y" style.',
        reply: 'Such nice. Very wow.',
        summary:
          'A photo of a Shiba Inu dog giving a sideways look, surrounded by colourful captions in broken English like "such wow" and "very snack".',
        context: 'Used for cute pets, good food and anything that makes you happy for no reason.',
        usageExample: 'Seeing a puppy at the park: "Much wow. Very fluff."',
      },
    ],
  },
  {
    id: 'two-buttons-meme',
    kind: 'meme',
    title: 'Two buttons (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a cartoon panel of a sweating man',
    tags: ['reaction image', 'dilemma'],
    aliases: ['two buttons', 'two buttons meme', 'sweating guy two buttons'],
    interpretations: [
      {
        label: 'Torn between two tough choices',
        gist: "I can't choose between these two things.",
        socialMove: "They're showing they're torn, and a bit stressed about it.",
        reply: 'Just pick one.',
        summary:
          "A cartoon panel of a man sweating over two red buttons. Each button is labelled with a choice that's hard to give up.",
        context: 'Used for any dilemma, from two good offers to two bad snacks.',
        usageExample: 'Buttons labelled "Sleep" and "Watch the match".',
      },
    ],
  },
  {
    id: 'evil-kermit-meme',
    kind: 'meme',
    title: 'Evil Kermit (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a picture of Kermit the Frog',
    tags: ['reaction image', 'temptation'],
    aliases: ['evil kermit', 'me to me meme', 'dark side kermit'],
    interpretations: [
      {
        label: 'The tempting voice in my head',
        gist: 'The voice in my head is talking me into a bad idea.',
        socialMove: "They're admitting a temptation they know they shouldn't give in to.",
        reply: "Don't listen to him, Kermit.",
        summary:
          'Kermit the Frog, a calm and kind puppet, faces a hooded, darker version of himself that talks him into bad ideas. The caption is usually "Me to me".',
        context: 'Used for late-night snacks, impulse purchases and "just one more" decisions.',
        usageExample: '"Me to me: order biryani again."',
      },
    ],
  },
  {
    id: 'mocking-spongebob-meme',
    kind: 'meme',
    title: 'Mocking SpongeBob (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a picture of SpongeBob SquarePants',
    tags: ['reaction image', 'teasing'],
    aliases: [
      'mocking spongebob',
      'spongebob mocking',
      'sarcastic spongebob',
      'alternating caps meme',
    ],
    interpretations: [
      {
        label: 'Mocking someone by repeating them',
        gist: "That's what you sound like.",
        socialMove: "They're repeating someone's words in a silly voice, to tease them.",
        reply: "I didn't say it like that.",
        summary:
          'A picture of SpongeBob bent over in a silly pose. People pair it with a sentence typed in aLtErNaTiNg cApS to mimic what someone just said.',
        context: "Used in chats to gently tease a friend's excuse or a boast.",
        usageExample:
          'Friend: "I\'ll start the diet on Monday." / "i\'Ll sTaRt tHe dIeT oN mOnDaY."',
      },
    ],
  },
  {
    id: 'ye-baburao-ka-style-hera-pheri',
    kind: 'quote',
    title: '“Ye Baburao ka style hai” (Hera Pheri)',
    category: 'film',
    decade: '2000s',
    origin: 'the Hindi film Hera Pheri',
    tags: ['bollywood', 'quirks'],
    aliases: [
      'ye baburao ka style hai',
      'yeh baburao ka style hai',
      'baburao ka style',
      'babu rao ka style',
    ],
    interpretations: [
      {
        label: 'Doing things in my own odd way',
        gist: "That's just my way of doing things.",
        socialMove: "They're defending an odd habit with a straight face.",
        reply: 'Okay, Baburao, your way.',
        summary:
          'Babu Rao, the fussy, grumpy and lovable character in Hera Pheri, says it to explain why he does things his own odd way.',
        context:
          'Said about a strange outfit, a quirky routine or any habit that nobody else shares.',
        usageExample: 'Wearing socks with chappals: "Ye Baburao ka style hai."',
      },
    ],
  },
  {
    id: 'teja-main-hoon-andaz-apna-apna',
    kind: 'quote',
    title: '“Teja main hoon, mark idhar hai” (Andaz Apna Apna)',
    category: 'film',
    decade: '1990s',
    origin: 'the cult Hindi comedy Andaz Apna Apna',
    tags: ['bollywood', 'comedy'],
    aliases: [
      'teja main hoon mark idhar hai',
      'teja main hun mark idhar hai',
      'teja main hoon',
      'mark idhar hai',
    ],
    interpretations: [
      {
        label: 'Proving who I am, loudly',
        gist: "It's really me, and I can prove it.",
        socialMove: "They're loudly insisting they are who they say they are, as a joke.",
        reply: 'Okay, Teja, we see you.',
        summary:
          'Teja is the loud, over-confident gangster in the cult comedy Andaz Apna Apna. The line is how he announces who he is, pointing to a mark on his cheek as proof.',
        context: 'Said when owning up to something, or proving it was you all along.',
        usageExample: '"Who made this playlist?" / "Teja main hoon, mark idhar hai."',
      },
    ],
  },
  {
    id: 'jaadu-ki-jhappi-munna-bhai',
    kind: 'quote',
    title: '“Jaadu ki jhappi” (Munna Bhai M.B.B.S.)',
    category: 'film',
    decade: '2000s',
    origin: 'the Hindi film Munna Bhai M.B.B.S.',
    tags: ['bollywood', 'hugs'],
    aliases: ['jaadu ki jhappi', 'jadu ki jhappi', 'jadoo ki jhappi', 'munna bhai mbbs'],
    interpretations: [
      {
        label: 'A magic hug that helps',
        gist: 'A magic hug that makes things better.',
        socialMove: "They're offering a hug to someone who's sad or stressed.",
        reply: 'Haan, abhi chahiye.',
        summary:
          'Munna, a lovable gangster who ends up in a medical college, hugs patients and friends to cheer them up. He calls it the "jaadu ki jhappi".',
        context: 'Said to a friend after a bad day, a failed exam or a breakup.',
        usageExample: 'A friend gets a low mark: "Come here. Jaadu ki jhappi."',
      },
    ],
  },
  {
    id: 'main-apni-favourite-hoon-jab-we-met',
    kind: 'quote',
    title: '“Main apni favourite hoon” (Jab We Met)',
    category: 'film',
    decade: '2000s',
    origin: 'the Hindi film Jab We Met',
    tags: ['bollywood', 'self-care'],
    aliases: [
      'main apni favourite hoon',
      'main apni favorite hoon',
      'mai apni favourite hoon',
      'jab we met geet',
    ],
    interpretations: [
      {
        label: 'Putting myself first, proudly',
        gist: "I look out for myself first, and I'm proud of it.",
        socialMove: "They're picking themselves over a plan that doesn't suit them.",
        reply: 'Good for you, Geet.',
        summary:
          'Geet, a chatty, fearless girl in Jab We Met, says it to explain why she does what she wants.',
        context:
          'Said when skipping a boring event, taking the last slice or saying no without guilt.',
        usageExample:
          'Skipping a long family function for a quiet evening: "Main apni favourite hoon."',
      },
    ],
  },
  {
    id: 'rahul-naam-toh-suna-hoga-dtph',
    kind: 'quote',
    title: '“Rahul, naam toh suna hoga” (Dil To Pagal Hai)',
    category: 'film',
    decade: '1990s',
    origin: 'the Hindi film Dil To Pagal Hai',
    tags: ['bollywood', 'introductions'],
    aliases: [
      'rahul naam toh suna hoga',
      'rahul naam to suna hoga',
      'rahul naam suna hoga',
      'dil to pagal hai',
      'dil toh pagal hai',
    ],
    interpretations: [
      {
        label: 'Surely you have heard of me',
        gist: "Surely you've heard of me.",
        socialMove: "They're introducing themselves with big, joking confidence.",
        reply: 'Haan haan, sab jaante hain.',
        summary:
          'Rahul, the charming stage-show director in Dil To Pagal Hai, introduces himself this way, sure that everyone knows him.',
        context:
          'Said when introducing yourself to a new group, or when someone acts like a big star.',
        usageExample: 'Joining a new group chat: "Hi, Karan here. Rahul, naam toh suna hoga."',
      },
    ],
  },
  {
    id: 'kattappa-question-baahubali',
    kind: 'meme',
    title: 'The Kattappa question (Baahubali)',
    category: 'film',
    decade: '2010s+',
    origin: 'the Telugu epic Baahubali',
    tags: ['telugu', 'mystery'],
    aliases: [
      'kattappa ne baahubali ko kyun maara',
      'kattappa ne bahubali ko kyun mara',
      'why did kattappa kill baahubali',
      'kattappa',
    ],
    interpretations: [
      {
        label: 'A joke about any unanswered question',
        gist: 'The biggest mystery ever (said as a joke about a very small one).',
        socialMove: "They're teasing a small mystery, or asking for gossip with fake desperation.",
        reply: 'Some secrets stay secret.',
        summary:
          'The Baahubali films are a Telugu epic that was also released in Hindi. This question became the most talked-about question from them and then a joke used all over India.',
        context: 'Used as a punchline for any question nobody can answer.',
        usageExample: '"Who ate my leftover biryani?" / "Bigger mystery than Baahubali."',
      },
      {
        label: 'What the question means later on',
        gist: "The film's biggest shock.",
        socialMove:
          "They're recalling the moment the whole country was talking about. It's from Baahubali: The Beginning (2015): save the scene until you've seen it.",
        reply: 'No spoilers, please.',
        summary:
          "At the end of the first film, Kattappa, a loyal commander, kills the hero Baahubali. The reason isn't explained until the second film, Baahubali 2 (2017).",
        context: 'For fans it means the wait. Everyone argued about the answer for two years.',
        usageExample: 'Fans remembering the long wait between the two films.',
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'hey-maa-mataji-taarak-mehta',
    kind: 'quote',
    title: '“Hey Maa Mataji!” (Taarak Mehta Ka Ooltah Chashmah)',
    category: 'tv',
    decade: '2000s',
    origin: 'the TV comedy Taarak Mehta Ka Ooltah Chashmah',
    tags: ['indian tv', 'drama'],
    aliases: [
      'hey maa mataji',
      'hey ma mataji',
      'dayaben',
      'daya ben',
      'daya bhabhi',
      'taarak mehta ka ooltah chashmah',
    ],
    interpretations: [
      {
        label: 'Dramatic reaction to a small disaster',
        gist: 'Oh my, what now?',
        socialMove: "They're reacting to a small disaster with big drama.",
        reply: 'Arre, relax, Daya.',
        summary:
          "Daya, Jethalal's cheerful, excitable wife in the long-running TV comedy Taarak Mehta Ka Ooltah Chashmah, cries it out when she is surprised or flustered.",
        context: 'Said when the Wi-Fi dies, a bill arrives or the auto driver says "no meter".',
        usageExample: 'Power cut in the middle of the match: "Hey Maa Mataji!"',
      },
    ],
  },
  {
    id: 'pushpa-jhukega-nahi-pushpa',
    kind: 'quote',
    title: '“Pushpa… jhukega nahi” (Pushpa)',
    category: 'film',
    decade: '2010s+',
    origin: 'the Telugu film Pushpa',
    tags: ['telugu', 'defiance'],
    aliases: ['pushpa jhukega nahi', 'flower nahi fire hai', 'pushpa raj'],
    interpretations: [
      {
        label: 'Refusing to back down, with pride',
        gist: "I won't back down.",
        socialMove: "They're showing stubborn pride, often with a hand brushed under the chin.",
        reply: 'Okay, Pushpa. No bending.',
        summary:
          "Pushpa Raj, a daring labourer who rises in the sandalwood trade in the Telugu film Pushpa, says it with a brush under his chin. It's best known from the Hindi-dubbed version.",
        context: 'Said when sticking to an opinion, a seat or a food order, with the chin gesture.',
        usageExample: 'Refusing to change seats at the cinema: "Jhukega nahi."',
      },
    ],
  },
  {
    id: 'binod-meme',
    kind: 'meme',
    title: 'Binod (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a YouTube comment-section joke',
    tags: ['internet', 'comments'],
    aliases: ['binod', 'binod comment', 'binod meme'],
    interpretations: [
      {
        label: 'A random word everyone repeats',
        gist: "Nothing, it's just the joke word everyone repeats.",
        socialMove: "They're dropping a random name to be silly and join the crowd.",
        reply: 'Binod!',
        summary:
          'Around 2020, people began leaving the single word "Binod" as a comment under YouTube videos. Others copied it until it showed up everywhere.',
        context: 'Used as a comment-section joke, often under very serious or very popular videos.',
        usageExample: 'Under a serious news video: "Binod".',
      },
    ],
  },
];
