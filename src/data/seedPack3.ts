import type { SeedDefinition } from './seed';

/**
 * "You'll hear this" pack, batch 3 (owner-approved 2026-11-18, docs/PACK_BATCH_3_DRAFT.md).
 * Editor-written like the demo entries: no years stored, no sources.
 */
export const PACK_3_DEFINITIONS: readonly SeedDefinition[] = [
  {
    id: 'mine-mine-mine-finding-nemo',
    kind: 'quote',
    title: '“Mine! Mine! Mine!” (Finding Nemo)',
    category: 'film',
    decade: '2000s',
    origin: "Pixar's Finding Nemo",
    tags: ['pixar', 'claiming'],
    aliases: ['mine mine mine', 'finding nemo seagulls', 'seagulls mine mine'],
    interpretations: [
      {
        label: 'Claiming it loudly, like a seagull',
        gist: 'This is mine, hands off.',
        socialMove: "They're claiming food or a seat very loudly, as a joke.",
        reply: 'Fine, take it, seagull.',
        summary:
          'A flock of seagulls in Finding Nemo shout "Mine!" at anything they want, over and over.',
        context: 'Said when someone grabs the last samosa, the window seat or the good charger.',
        usageExample: 'Reaching for the last slice: "Mine! Mine! Mine!"',
      },
    ],
  },
  {
    id: 'squirrel-dug-up',
    kind: 'quote',
    title: '“Squirrel!” (Up)',
    category: 'film',
    decade: '2000s',
    origin: "Pixar's Up",
    tags: ['pixar', 'distraction'],
    aliases: ['dug squirrel', 'dug the dog', 'up movie squirrel'],
    interpretations: [
      {
        label: 'Distracted by something small',
        gist: 'Sorry, I got distracted.',
        socialMove: "They're joking that something small just stole their attention.",
        reply: 'Focus, Dug.',
        summary:
          'Dug, a friendly dog in Up whose collar lets him talk, stops mid-sentence and shouts it every time he spots a squirrel.',
        context: 'Said when someone loses their train of thought in a meeting or while studying.',
        usageExample: 'Phone buzzes mid-sentence: "Squirrel!"',
      },
    ],
  },
  {
    id: 'sad-strange-little-man-toy-story',
    kind: 'quote',
    title: '“You are a sad, strange little man” (Toy Story)',
    category: 'film',
    decade: '1990s',
    origin: "Pixar's Toy Story",
    tags: ['pixar', 'teasing'],
    aliases: ['you are a sad strange little man', 'sad strange little man', 'buzz lightyear pity'],
    interpretations: [
      {
        label: 'Teasing someone who is far too serious',
        gist: "You're being odd, and I feel a bit sorry for you.",
        socialMove: "They're teasing someone who is taking something far too seriously.",
        reply: 'Pity accepted.',
        summary:
          "Buzz Lightyear, a toy spaceman who believes he's a real space ranger, says it to Woody, the cowboy toy, in a very grand voice.",
        context:
          'Said to a friend with a very strict routine, a very serious hobby or a very long rant.',
        usageExample:
          'A friend explains his 14-step morning routine: "You are a sad, strange little man."',
      },
    ],
  },
  {
    id: 'flash-hundred-yard-dash-zootopia',
    kind: 'quote',
    title: '“Flash, Flash, Hundred-Yard Dash” (Zootopia)',
    category: 'film',
    decade: '2010s+',
    origin: "Disney's animated film Zootopia",
    tags: ['disney', 'slow'],
    aliases: ['flash flash hundred yard dash', 'flash the sloth', 'zootopia sloth dmv'],
    interpretations: [
      {
        label: 'Mocking something painfully slow',
        gist: 'Wow, this is slow.',
        socialMove: "They're joking about someone or something that is painfully slow.",
        reply: 'Please. Hurry. Up.',
        summary:
          'In Zootopia, a fox and a rabbit visit an office where the clerk is a sloth named Flash. The fox greets him with this nickname as a joke, then tells him a riddle and waits through his extremely slow laugh.',
        context:
          'Said about slow Wi-Fi, a slow lift, a government-office queue or a friend who types one word a minute.',
        usageExample:
          'Waiting for a one-word reply for ten minutes: "Flash, Flash, Hundred-Yard Dash."',
      },
    ],
  },
  {
    id: 'i-understood-that-reference-avengers',
    kind: 'quote',
    title: '“I understood that reference” (The Avengers)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel's The Avengers",
    tags: ['marvel', 'pop culture'],
    aliases: [
      'i understood that reference',
      'understood that reference',
      'captain america reference',
    ],
    interpretations: [
      {
        label: 'Proudly catching a reference',
        gist: "I got the joke, and I'm proud of it.",
        socialMove: "They're showing off that they finally caught a pop-culture reference.",
        reply: 'Welcome to the club.',
        summary:
          'Captain America, a soldier from the 1940s who is still catching up on modern life, says it with a proud little smile.',
        context: 'Said when someone gets a meme, a film line or a new slang word.',
        usageExample:
          'An uncle laughs at the right moment in a meme: "I understood that reference."',
      },
    ],
  },
  {
    id: 'we-have-a-hulk-avengers',
    kind: 'quote',
    title: '“We have a Hulk” (The Avengers)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel's The Avengers",
    tags: ['marvel', 'confidence'],
    aliases: ['we have a hulk', 'i have an army we have a hulk', 'tony stark hulk'],
    interpretations: [
      {
        label: 'Pointing at your secret weapon',
        gist: "Our side has a secret weapon, so we're fine.",
        socialMove: "They're calmly answering a big threat by pointing at their own best player.",
        reply: "Then we're fine.",
        summary:
          'Loki, a villain, boasts that he has an army. Tony Stark, a billionaire hero in a metal suit, answers with this short line.',
        context:
          'Said when the other team shows up with ten players and you have one very good one.',
        usageExample: 'The other group brings five people to the quiz: "We have a Hulk."',
      },
    ],
  },
  {
    id: 'friend-from-work-thor-ragnarok',
    kind: 'quote',
    title: "“He's a friend from work!” (Thor: Ragnarok)",
    category: 'film',
    decade: '2010s+',
    origin: "Marvel's Thor: Ragnarok",
    tags: ['marvel', 'introductions'],
    aliases: ["he's a friend from work", 'friend from work thor', 'thor ragnarok hulk'],
    interpretations: [
      {
        label: 'Introducing an alarming friend casually',
        gist: "Don't worry, he's with me.",
        socialMove: "They're introducing a very big, very alarming friend as if it's normal.",
        reply: 'Good friend to have.',
        summary:
          'Thor, a hero from another world, is thrown into a gladiator arena. His opponent turns out to be the Hulk, an old teammate, and Thor cheerfully explains him to the crowd with this line.',
        context:
          'Said when bringing a loud cousin, a famous friend or a large dog to a quiet event.',
        usageExample: 'Walking into a party with six friends: "He\'s a friend from work!"',
      },
    ],
  },
  {
    id: 'follow-the-butterflies-chamber-of-secrets',
    kind: 'quote',
    title:
      "“Why couldn't it be 'follow the butterflies'?” (Harry Potter and the Chamber of Secrets)",
    category: 'film',
    decade: '2000s',
    origin: 'Harry Potter and the Chamber of Secrets',
    tags: ['harry potter', 'grumbling'],
    aliases: [
      'follow the butterflies',
      "why couldn't it be follow the butterflies",
      'ron weasley spiders',
    ],
    interpretations: [
      {
        label: 'Grumbling at the scary task',
        gist: "Why does the scary task have to be the one we're given?",
        socialMove: "They're grumbling that the plan involves exactly what they hate.",
        reply: "It's only spiders, Ron.",
        summary:
          "Ron, who is terrified of spiders, is told to follow some into a dark forest. He groans that it couldn't have been something nice like butterflies.",
        context: 'Said about a cold shower, a long queue or a dentist visit.',
        usageExample:
          "Told the meeting is on the ninth floor and the lift is broken: \"Why couldn't it be 'follow the butterflies'?\"",
      },
    ],
  },
  {
    id: 'constant-vigilance-harry-potter',
    kind: 'quote',
    title: '“Constant vigilance!” (Harry Potter books)',
    category: 'catchphrase',
    decade: '2000s',
    origin: 'the Harry Potter books',
    tags: ['harry potter', 'warning'],
    aliases: ['constant vigilance', 'mad eye moody', 'alastor moody'],
    interpretations: [
      {
        label: 'A dramatic warning to stay alert',
        gist: 'Stay alert, always.',
        socialMove:
          "They're giving a dramatic warning to be careful, usually over something silly.",
        reply: 'Always, Professor.',
        summary:
          'Mad-Eye Moody, a gruff, one-eyed wizard teacher in the Goblet of Fire book, barks it as his motto.',
        context: 'Said about guarding your snacks, your phone or your seat from a sibling.',
        usageExample: 'Leaving the office fridge: "Constant vigilance! Someone eats your lunch."',
      },
    ],
  },
  {
    id: 'expecto-patronum-harry-potter',
    kind: 'quote',
    title: '“Expecto Patronum” (Harry Potter)',
    category: 'film',
    decade: '2000s',
    origin: 'the Harry Potter films and books',
    tags: ['harry potter', 'bad mood'],
    aliases: ['expecto patronum', 'expecto patronus', 'patronus charm'],
    interpretations: [
      {
        label: 'Casting a spell against a bad mood',
        gist: 'Go away, bad mood.',
        socialMove: "They're pretending to cast a spell against something gloomy.",
        reply: 'Think of a happy memory.',
        summary:
          "It's a spell that calls up a bright, protective light against dark, joyless creatures. To cast it, you have to hold on to a happy memory.",
        context: 'Said before opening exam results, a Monday inbox or a bank statement.',
        usageExample: 'Opening the credit-card bill: "Expecto Patronum."',
      },
    ],
  },
  {
    id: 'oh-my-god-janice-friends',
    kind: 'quote',
    title: '“Oh. My. God!” (Janice, Friends)',
    category: 'tv',
    decade: '1990s',
    origin: 'the TV show Friends',
    tags: ['sitcom', 'gossip'],
    aliases: ['janice oh my god', 'oh my god janice', 'oh my gawd janice', 'janice friends'],
    interpretations: [
      {
        label: 'A loud, nasal wow',
        gist: 'A very loud, very nasal "wow".',
        socialMove: "They're doing an over-the-top, squeaky reaction to small gossip.",
        reply: 'Please stop, Janice.',
        summary:
          "Janice, Chandler's on-off girlfriend in Friends, has a loud nasal voice and a laugh. She says it with each word separate.",
        context:
          'Said in a high voice when a friend shares gossip, or as a joke when someone arrives with big news about something small.',
        usageExample: 'A friend reveals the new colleague\'s first name: "Oh. My. God!"',
      },
    ],
  },
  {
    id: 'legen-wait-for-it-dary-how-i-met-your-mother',
    kind: 'quote',
    title: '“Legen… wait for it… dary” (How I Met Your Mother)',
    category: 'tv',
    decade: '2000s',
    origin: 'the US sitcom How I Met Your Mother',
    tags: ['sitcom', 'suspense'],
    aliases: ['legen wait for it dary', 'legendary barney', 'wait for it barney'],
    interpretations: [
      {
        label: 'Building up a big reveal',
        gist: 'Something amazing is coming, just wait.',
        socialMove: "They're building up a big reveal on purpose, with a long pause.",
        reply: "I'm waiting. Say it.",
        summary:
          'Barney, a smooth, over-confident friend, stretches out the word "legendary" with a dramatic pause in the middle.',
        context: 'Said before announcing a plan, a party or a surprise, to make everyone wait.',
        usageExample: '"Tonight\'s plan is going to be legen… wait for it… dary."',
      },
    ],
  },
  {
    id: 'few-word-do-trick-the-office',
    kind: 'quote',
    title: '“Why waste time say lot word when few word do trick” (The Office)',
    category: 'tv',
    decade: '2010s+',
    origin: 'the US sitcom The Office',
    tags: ['sitcom', 'short replies'],
    aliases: ['why waste time say lot word', 'few word do trick', 'kevin malone'],
    interpretations: [
      {
        label: 'Keeping it short',
        gist: 'Keep it short.',
        socialMove:
          "They're explaining why they use so few words, or teasing someone who talks a lot.",
        reply: 'Fair. Few word.',
        summary:
          'Kevin, an accountant, decides to save time by cutting out "extra" words, and explains his new idea with this line.',
        context:
          'Said in chat when someone replies "ok" to a long message, or when a long email needs trimming.',
        usageExample: 'Replying "k" to a ten-paragraph message: "Why waste time say lot word."',
      },
    ],
  },
  {
    id: 'noice-brooklyn-nine-nine',
    kind: 'quote',
    title: '“Noice” (Brooklyn Nine-Nine)',
    category: 'tv',
    decade: '2010s+',
    origin: 'the sitcom Brooklyn Nine-Nine',
    tags: ['sitcom', 'approval'],
    aliases: ['noice jake peralta', 'noice brooklyn nine nine', 'jake noice'],
    interpretations: [
      {
        label: 'Smug, cheerful approval',
        gist: 'Nice! (said in a smug, cheerful way)',
        socialMove: "They're approving of something small, with a cool tone and a slow nod.",
        reply: 'Smooth.',
        summary:
          'Jake Peralta, a goofy detective, says "noice" instead of "nice" with a little head tilt.',
        context: 'Said about a good score, a good deal or a lucky seat.',
        usageExample: 'Seeing "free delivery" at checkout: "Noice."',
      },
    ],
  },
  {
    id: 'knock-knock-knock-penny-big-bang-theory',
    kind: 'quote',
    title: '“Knock, knock, knock, Penny” (The Big Bang Theory)',
    category: 'tv',
    decade: '2000s',
    origin: 'the sitcom The Big Bang Theory',
    tags: ['sitcom', 'habits'],
    aliases: ['knock knock knock penny', 'sheldon knocks', 'sheldon penny knock'],
    interpretations: [
      {
        label: 'A very odd, very polite request',
        gist: "I'm about to ask for something, politely and a bit oddly.",
        socialMove: "They're knocking on a door (or a chat) three times in a row, on purpose.",
        reply: 'Come in, Sheldon.',
        summary:
          'Sheldon, a fussy genius, knocks three times on his neighbour\'s door and says "Penny", then repeats that whole round three times. It\'s his habit every time he visits.',
        context:
          "Said while knocking on a flatmate's door or sending a message three times in a row.",
        usageExample: 'Knocking on the room door: "Knock, knock, knock, Priya."',
      },
    ],
  },
  {
    id: 'roll-safe-meme',
    kind: 'meme',
    title: '“Roll Safe” (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a still of a man tapping his head',
    tags: ['reaction image', 'bad ideas'],
    aliases: ['tapping head meme', 'roll safe', 'roll safe meme', 'think about it meme'],
    interpretations: [
      {
        label: 'A clever plan that is not clever',
        gist: 'A "clever" plan that isn\'t clever at all.',
        socialMove: "They're making fun of a bad idea that sounds smart.",
        reply: "Can't argue with that logic.",
        summary:
          "A still of a man tapping the side of his head with a knowing smile, as if he's solved everything. People caption it with \"you can't fail the exam if you don't take it\" style jokes.",
        context: 'Used for "smart" shortcuts that are really excuses.',
        usageExample: 'Caption: "You can\'t be late if you don\'t check the time."',
      },
    ],
  },
  {
    id: 'grus-plan-meme',
    kind: 'meme',
    title: "“Gru's plan” (meme)",
    category: 'meme',
    decade: '2010s+',
    origin: 'a four-panel image from the Despicable Me films',
    tags: ['reaction image', 'plans'],
    aliases: ["gru's plan", 'gru board meme', 'gru plan meme'],
    interpretations: [
      {
        label: 'A plan that goes wrong at the end',
        gist: 'My plan had a flaw, and I just noticed it.',
        socialMove: "They're sharing a plan that goes wrong at the end.",
        reply: 'Oh no. Read it again.',
        summary:
          'Four panels of Gru, a cartoon villain from the Despicable Me films, showing a plan on a board. In the last panel, which repeats the third step, he does a double-take.',
        context: 'Used for plans where the last step undoes the first one.',
        usageExample:
          'Panels: "Set five alarms." "Sleep early." "Switch off all alarms in my sleep." "Switch off all alarms in my sleep."',
      },
    ],
  },
  {
    id: 'panik-kalm-panik-meme',
    kind: 'meme',
    title: '“Panik Kalm Panik” (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a three-panel image',
    tags: ['reaction image', 'panic'],
    aliases: ['panik kalm panik', 'panik kalm', 'panik meme'],
    interpretations: [
      {
        label: 'Panic, calm, panic again',
        gist: 'I panicked, calmed down, then panicked again.',
        socialMove: "They're describing a moment that keeps flipping from fine to not fine.",
        reply: 'Deep breath.',
        summary:
          'A three-panel picture: the first says "Panik", the second "Kalm", and the third "Panik" again, with a bald cartoon head clutching his face for "Panik" and looking blank for "Kalm".',
        context: 'Used for exam papers, deadlines and "is the stove off?" moments.',
        usageExample:
          'Panel one: "Lost my wallet." Panel two: "Found it." Panel three: "It\'s empty."',
      },
    ],
  },
  {
    id: 'press-f-to-pay-respects-meme',
    kind: 'meme',
    title: '“Press F to pay respects” (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'the game Call of Duty: Advanced Warfare',
    tags: ['gaming', 'sympathy'],
    aliases: ['press f to pay respects', 'f in the chat', 'press f'],
    interpretations: [
      {
        label: 'A joke salute to a small loss',
        gist: 'Sorry for your loss (said as a joke).',
        socialMove: "They're teasing a friend about a small, silly loss.",
        reply: 'F.',
        summary:
          'A funeral scene in the 2014 game Call of Duty: Advanced Warfare told players to press the F key to pay their respects. Players turned it into a joke and began typing "F" in chats for any loss.',
        context: 'Used for a dropped samosa, a dead phone or a failed attempt.',
        usageExample: 'A friend\'s phone falls in the tea: "Press F."',
      },
    ],
  },
  {
    id: 'shut-up-and-take-my-money-meme',
    kind: 'meme',
    title: '“Shut up and take my money” (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'the cartoon Futurama',
    tags: ['shopping', 'reaction image'],
    aliases: ['shut up and take my money', 'fry take my money', 'futurama take my money'],
    interpretations: [
      {
        label: 'Wanting something right now',
        gist: 'I want this right now.',
        socialMove: "They're reacting to something they instantly want to buy.",
        reply: 'Add to cart.',
        summary:
          "Fry, a delivery boy from the past in the cartoon Futurama, shouts it at a gadget he can't resist. The still of him holding cash became a meme.",
        context: 'Said about a new phone, a sale or a food-delivery offer.',
        usageExample: 'Seeing a Maggi-flavoured ice cream: "Shut up and take my money."',
      },
    ],
  },
  {
    id: 'sus-among-us',
    kind: 'meme',
    title: '“Sus” (Among Us)',
    category: 'meme',
    decade: '2010s+',
    origin: 'the multiplayer game Among Us',
    tags: ['gaming', 'suspicion'],
    aliases: ['among us sus', "that's sus", 'impostor sus', 'imposter sus'],
    interpretations: [
      {
        label: 'That looks suspicious',
        gist: 'That looks suspicious.',
        socialMove: "They're jokingly accusing a friend of lying or acting strange.",
        reply: "Trust me, I'm not the impostor.",
        summary:
          'In the multiplayer game Among Us, players try to work out which of them is secretly an impostor, and call a suspect "sus".',
        context: "Said when someone's excuse doesn't add up or someone goes quiet.",
        usageExample: 'Friend says "I was asleep" at 2 a.m., online: "That\'s sus."',
      },
    ],
  },
  {
    id: 'picture-abhi-baaki-hai-om-shanti-om',
    kind: 'quote',
    title: '“Picture abhi baaki hai mere dost” (Om Shanti Om)',
    category: 'film',
    decade: '2000s',
    origin: 'the Hindi film Om Shanti Om',
    tags: ['bollywood', 'suspense'],
    aliases: [
      'picture abhi baaki hai mere dost',
      'picture abhi baki hai',
      'picture abhi baaki hai',
    ],
    interpretations: [
      {
        label: 'The best part is still to come',
        gist: "This isn't over, and the best part is still to come.",
        socialMove: "They're teasing that there's more to the story, with dramatic timing.",
        reply: 'Toh popcorn le aate hain.',
        summary:
          'A big dialogue from Om Shanti Om, a Hindi film about film-world dreams, said by its hero to promise that the story is far from finished.',
        context: 'Said in the middle of a match, a party or an argument when more is coming.',
        usageExample: 'Down at half-time: "Picture abhi baaki hai mere dost."',
      },
    ],
  },
  {
    id: 'risk-hai-toh-ishq-hai-scam-1992',
    kind: 'quote',
    title: '“Risk hai toh ishq hai” (Scam 1992)',
    category: 'tv',
    decade: '2010s+',
    origin: 'the Hindi web series Scam 1992',
    tags: ['web series', 'risk'],
    aliases: ['risk hai toh ishq hai', 'risk hai to ishq hai', 'scam 1992 risk hai'],
    interpretations: [
      {
        label: 'Justifying a bold choice',
        gist: 'No risk, no thrill.',
        socialMove: "They're justifying a bold choice with a web-series-hero swagger.",
        reply: 'Okay, but wear a helmet.',
        summary:
          'Scam 1992 is a Hindi series about a real stock-market scandal in the 1990s. Its lead character is shown loving risk, and this line followed him everywhere online.',
        context:
          'Said when ordering the spiciest dish, taking a chance on a plan or booking a last-minute trip.',
        usageExample: 'Ordering the "extra extra spicy" option: "Risk hai toh ishq hai."',
      },
    ],
  },
  {
    id: 'apun-hi-bhagwan-hai-sacred-games',
    kind: 'quote',
    title: '“Kabhi kabhi lagta hai apun hi bhagwan hai” (Sacred Games)',
    category: 'tv',
    decade: '2010s+',
    origin: 'the Hindi crime series Sacred Games',
    tags: ['web series', 'bragging'],
    aliases: [
      'kabhi kabhi lagta hai apun hi bhagwan hai',
      'apun hi bhagwan hai',
      'apun hi bhagwaan hai',
      'kabhi kabhi lagta hai ki apun hi bhagwan hai',
      'ganesh gaitonde',
    ],
    interpretations: [
      {
        label: 'Bragging after a small win',
        gist: "Sometimes I feel like I'm in charge of everything.",
        socialMove: "They're bragging after a small win, with a straight face.",
        reply: 'Calm down, bhagwan.',
        summary:
          'Ganesh Gaitonde, a powerful gangster in the Hindi crime series Sacred Games, says it in his Mumbai street style. The series is for adults, but the line is everywhere online.',
        context: 'Said after winning a game, getting a good seat or finishing a tough task.',
        usageExample:
          'After solving the bug everyone ignored: "Kabhi kabhi lagta hai apun hi bhagwan hai."',
      },
    ],
  },
  {
    id: 'sattar-minute-chak-de-india',
    kind: 'quote',
    title: '“Sattar minute” (Chak De! India)',
    category: 'film',
    decade: '2000s',
    origin: 'the Hindi film Chak De! India',
    tags: ['bollywood', 'deadlines'],
    aliases: [
      'sattar minute',
      'sattar minute hain tumhare paas',
      'sattar minute hai tumhare paas',
      '70 minute chak de',
    ],
    interpretations: [
      {
        label: 'A deadline with a big speech',
        gist: 'You have seventy minutes, so make them count.',
        socialMove: "They're giving a deadline with a big, dramatic speech.",
        reply: 'Clock started.',
        summary:
          'Kabir Khan, a hockey coach played by Shah Rukh Khan, tells his team in a locker-room speech that a match lasts seventy minutes and they must make those minutes count.',
        context: 'Said before an exam, a presentation or a quick clean-up.',
        usageExample: 'Ten minutes before guests arrive: "Sattar minute hain tumhare paas."',
      },
    ],
  },
  {
    id: 'pyaar-dosti-hai-kuch-kuch-hota-hai',
    kind: 'quote',
    title: '“Pyaar dosti hai” (Kuch Kuch Hota Hai)',
    category: 'film',
    decade: '1990s',
    origin: 'the Hindi film Kuch Kuch Hota Hai',
    tags: ['bollywood', 'friendship'],
    aliases: ['pyaar dosti hai', 'pyar dosti hai', 'pyaar dosti hai rahul'],
    interpretations: [
      {
        label: 'A big lecture on friendship and love',
        gist: 'Love begins with friendship.',
        socialMove: "They're giving a big, dramatic lecture on friendship and love.",
        reply: 'Okay, Rahul.',
        summary:
          'Rahul, a college star in Kuch Kuch Hota Hai, says it in class when a teacher asks what love is.',
        context:
          'Said when a friend asks about a crush, or when someone gets very philosophical about friendship.',
        usageExample: 'A friend asks how to confess: "Pyaar dosti hai."',
      },
    ],
  },
  {
    id: 'jaa-simran-jaa-ddlj',
    kind: 'quote',
    title: '“Jaa Simran, jaa” (Dilwale Dulhania Le Jayenge)',
    category: 'film',
    decade: '1990s',
    origin: 'the Hindi film Dilwale Dulhania Le Jayenge',
    tags: ['bollywood', 'encouragement'],
    aliases: ['jaa simran jaa', 'ja simran ja', 'jee le apni zindagi'],
    interpretations: [
      {
        label: 'Cheering on a friend to take a chance',
        gist: 'Go, chase what you want.',
        socialMove: "They're pushing a friend to take a chance they're scared of.",
        reply: 'Going, going.',
        summary:
          "A famous line from Dilwale Dulhania Le Jayenge, one of Hindi cinema's best-loved romances. People use it to cheer someone on.",
        context: 'Said when a friend hesitates before a job interview, a trip or a confession.',
        usageExample: 'A friend nervous about applying abroad: "Jaa Simran, jaa."',
      },
      {
        label: "What the line means at the film's end",
        gist: "The film's emotional high point.",
        socialMove:
          "They're quoting the film's final, much-loved moment. It's from Dilwale Dulhania Le Jayenge (1995): save the scene until you've seen it.",
        reply: "I'm crying, not you.",
        summary:
          "Near the end, Simran's strict father says it, letting her run to the train and join the man she loves.",
        context:
          "For fans, it's the line where a strict parent finally lets go, so it's said warmly.",
        usageExample: "Fans sharing it on the film's anniversary.",
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'pawri-ho-rahi-hai-meme',
    kind: 'meme',
    title: '“Pawri ho rahi hai” (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'a viral video clip from a hill trip',
    tags: ['viral video', 'party'],
    aliases: ['pawri ho rahi hai', 'pawri hori hai', 'yeh hamari car hai', 'pawri meme'],
    interpretations: [
      {
        label: 'Announcing a party, viral-clip style',
        gist: "We're having a party!",
        socialMove:
          "They're announcing a get-together, copying the viral clip, camera sweep and all.",
        reply: 'Hum bhi aa rahe hain.',
        summary:
          'In 2021, Pakistani content creator Dananeer Mobeen filmed a few seconds of her friends on a hill trip, saying "party" as "pawri". It went viral in Pakistan and India, helped by a remix.',
        context: 'Used under group photos, hostel parties and Instagram stories.',
        usageExample:
          'Caption: "Yeh hum hain, yeh hamari chai hai, aur yeh hamari pawri ho rahi hai."',
      },
    ],
  },
  {
    id: 'o-stree-kal-aana-stree',
    kind: 'quote',
    title: '“O Stree, kal aana” (Stree)',
    category: 'film',
    decade: '2010s+',
    origin: 'the Hindi horror-comedy Stree',
    tags: ['bollywood', 'putting off'],
    aliases: ['o stree kal aana', 'oh stree kal aana', 'stree kal aana'],
    interpretations: [
      {
        label: 'Politely putting someone off',
        gist: 'Come back tomorrow.',
        socialMove: "They're politely (and dramatically) putting someone off.",
        reply: 'Kal pakka?',
        summary:
          'In the Hindi horror-comedy Stree, homes in a small town have these words painted on their walls to keep a legendary female spirit away.',
        context:
          'Said (or written on a note) to put off salespeople, relatives who want favours or anyone who knocks at a bad time.',
        usageExample: 'A note on the flat door: "O Stree, kal aana."',
      },
    ],
  },
  {
    id: 'hows-the-josh-uri',
    kind: 'quote',
    title: "“How's the josh?” (Uri: The Surgical Strike)",
    category: 'film',
    decade: '2010s+',
    origin: 'the Hindi war film Uri: The Surgical Strike',
    tags: ['bollywood', 'energy'],
    aliases: ["how's the josh", 'hows the josh high sir', 'how is the josh', 'uri high sir'],
    interpretations: [
      {
        label: 'Getting a group fired up',
        gist: 'Are you pumped up?',
        socialMove: "They're asking a group to shout back that their energy is high.",
        reply: 'High, sir!',
        summary:
          'In the Hindi war film Uri: The Surgical Strike, an army officer played by Vicky Kaushal asks his team this, and they answer together at full volume.',
        context:
          'Said before a match, a presentation, a trek or a long shift, to get a group fired up.',
        usageExample: 'Before the office cricket final: "How\'s the josh?"',
      },
    ],
  },
];
