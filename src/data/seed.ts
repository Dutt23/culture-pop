import { normalizePhrase } from '../domain/normalize';
import type {
  Alias,
  Category,
  Decade,
  Interpretation,
  Reference,
  SpoilerLevel,
} from '../domain/types';

/**
 * Original, editorially written DEMO content (provenance `seed_curated`).
 * No years are stored: none are backed by a source yet. `decade` is an editorial browse label.
 */
const SEED_TIMESTAMP = '2026-11-15T00:00:00.000Z';

interface SeedInterpretation {
  label: string;
  summary: string;
  context: string;
  usageExample: string;
  spoiler?: SpoilerLevel;
}

interface SeedDefinition {
  id: string;
  title: string;
  category: Category;
  decade?: Decade;
  origin?: string;
  tags: string[];
  aliases: string[];
  interpretations: SeedInterpretation[];
}

const SEED_DEFINITIONS: readonly SeedDefinition[] = [
  {
    id: 'hakuna-matata-lion-king',
    title: 'Hakuna Matata (The Lion King)',
    category: 'cartoon',
    decade: '1990s',
    origin: "Disney's animated film The Lion King",
    tags: ['disney', 'song', 'animation'],
    aliases: ['hakuna matata', 'timon and pumbaa'],
    interpretations: [
      {
        label: 'The song and its carefree attitude',
        summary:
          'A cheerful song in which a meerkat and a warthog teach a young lion to stop worrying about the past.',
        context:
          'Many people who grew up in the 1990s first heard the phrase here, so they link it to carefree, no-responsibilities living — sometimes jokingly, as in "happily avoiding your problems".',
        usageExample: '"Exams are next week, but it\'s Saturday — hakuna matata."',
      },
    ],
  },
  {
    id: 'hakuna-matata-swahili',
    title: 'Hakuna matata (Swahili phrase)',
    category: 'saying',
    origin: 'Swahili, spoken across East Africa',
    tags: ['language', 'reassurance'],
    aliases: ['hakuna matata'],
    interpretations: [
      {
        label: 'Everyday Swahili for "no problem"',
        summary: 'A real Swahili expression meaning roughly "no problems" or "no worries".',
        context:
          'It is ordinary speech that existed long before the film; the film made it famous worldwide. Hearing it does not automatically mean someone is quoting Disney.',
        usageExample: 'Someone reassuring you that a small mix-up is fine: "Hakuna matata."',
      },
    ],
  },
  {
    id: 'let-it-go-frozen',
    title: 'Let It Go (Frozen)',
    category: 'music',
    decade: '2010s+',
    origin: "Disney's animated film Frozen",
    tags: ['disney', 'song', 'animation'],
    aliases: ['let it go', 'frozen song'],
    interpretations: [
      {
        label: 'The giant hit song',
        summary:
          'The big song from Frozen, sung by a queen who finally stops hiding her ice powers.',
        context:
          'For years it was everywhere — school concerts, car singalongs, endless parodies. Saying "let it go" in a dramatic sing-song voice is usually a nod to this song.',
        usageExample: 'A friend is still upset about a parking ticket; you belt out "Let it gooo!"',
      },
    ],
  },
  {
    id: 'let-it-go-saying',
    title: 'Let it go (everyday saying)',
    category: 'saying',
    tags: ['advice'],
    aliases: ['let it go'],
    interpretations: [
      {
        label: 'Plain advice to stop dwelling',
        summary: 'Ordinary English advice to stop holding on to a grudge, mistake or worry.',
        context:
          'This meaning is much older than the song. If the tone is calm and serious, it is probably advice, not a Frozen joke.',
        usageExample: '"He apologised twice. Maybe it\'s time to let it go."',
      },
    ],
  },
  {
    id: 'king-of-the-world-titanic',
    title: "“I'm the king of the world!” (Titanic)",
    category: 'film',
    decade: '1990s',
    origin: "James Cameron's film Titanic",
    tags: ['romance', 'ship', 'quote'],
    aliases: ["I'm the king of the world", 'king of the world', 'titanic'],
    interpretations: [
      {
        label: 'Pure joy at the front of a ship',
        summary:
          'A young man yells it, arms spread wide at the front of the ship, feeling free and unstoppable.',
        context:
          'People shout it — often with arms outstretched — whenever they feel triumphant: on a boat, a hilltop or after a small win.',
        usageExample: 'Finishing your first 10K: arms up, "I\'m the king of the world!"',
      },
      {
        label: 'The floating-door debate',
        summary:
          'A long-running joke argues that both main characters could have fit on the floating door at the end, so one did not need to die.',
        context:
          'It refers directly to how the film ends. Saying "there was room on the door" means you think a sad outcome was avoidable.',
        usageExample: '"There was room on that door" — said about any unnecessary tragedy.',
        spoiler: 'major',
      },
    ],
  },
  {
    id: 'doh-simpsons',
    title: "D'oh! (The Simpsons)",
    category: 'cartoon',
    decade: '1990s',
    origin: 'The animated sitcom The Simpsons',
    tags: ['animation', 'sitcom', 'sound'],
    aliases: ["d'oh", 'homer simpson'],
    interpretations: [
      {
        label: "Homer's annoyed grunt",
        summary: 'The noise Homer Simpson makes the moment he realises he has messed up.',
        context:
          'It became so familiar that it is now a common word. People say it after an obvious, self-inflicted mistake.',
        usageExample: 'Realising you locked your keys in the car: "D\'oh!"',
      },
    ],
  },
  {
    id: 'how-you-doin-friends',
    title: "“How you doin'?” (Friends)",
    category: 'catchphrase',
    decade: '1990s',
    origin: 'The sitcom Friends',
    tags: ['sitcom', 'flirting'],
    aliases: ["how you doin'", 'how you doing', 'joey tribbiani'],
    interpretations: [
      {
        label: "Joey's pickup line",
        summary:
          'The flirty greeting used by Joey, a lovable actor who is far less smooth than he thinks.',
        context:
          'Said in an exaggerated low voice with a slight head tilt, it is a playful way to flirt — or to tease someone who is trying too hard.',
        usageExample: 'A friend shows up dressed for a date: "Well… how you doin\'?"',
      },
    ],
  },
  {
    id: 'bazinga-big-bang-theory',
    title: 'Bazinga! (The Big Bang Theory)',
    category: 'catchphrase',
    decade: '2000s',
    origin: 'The sitcom The Big Bang Theory',
    tags: ['sitcom', 'prank'],
    aliases: ['bazinga', 'sheldon cooper'],
    interpretations: [
      {
        label: 'Gotcha!',
        summary:
          'What the character Sheldon shouts after a prank or joke — his version of "gotcha!".',
        context: 'Using it signals you were joking all along, usually with a smug grin.',
        usageExample: '"I\'m quitting my job to become a mime. … Bazinga!"',
      },
    ],
  },
  {
    id: 'thats-what-she-said-office',
    title: "“That's what she said” (The Office)",
    category: 'tv',
    decade: '2000s',
    origin: 'The US sitcom The Office',
    tags: ['sitcom', 'innuendo', 'cringe comedy'],
    aliases: ["that's what she said", 'twss', 'michael scott'],
    interpretations: [
      {
        label: "Michael Scott's awkward joke",
        summary:
          'The boss in The Office keeps turning innocent sentences into innuendo by adding this line.',
        context:
          'It became one of the show\'s signature cringe moments. Quoting it usually means "that sounded accidentally rude".',
        usageExample: '"That was harder than I expected." / "That\'s what she said."',
      },
      {
        label: 'An older joke format',
        summary:
          'The line is an old innuendo joke that existed before the show; The Office popularised it for a new generation.',
        context:
          'So someone using it is not necessarily quoting the show — but most younger viewers will think of Michael Scott.',
        usageExample: 'Used among friends to break tension after an unfortunate choice of words.',
      },
    ],
  },
  {
    id: 'winter-is-coming-got',
    title: '“Winter is coming” (Game of Thrones)',
    category: 'tv',
    decade: '2010s+',
    origin: "The fantasy series Game of Thrones, adapted from George R. R. Martin's novels",
    tags: ['fantasy', 'motto'],
    aliases: ['winter is coming', 'game of thrones'],
    interpretations: [
      {
        label: 'A family motto turned warning',
        summary:
          'The grim motto of the Stark family: always prepare, because hard times are on the way.',
        context:
          'Fans use it for any approaching hardship, and literally when the weather turns cold.',
        usageExample: '"Finals start Monday. Winter is coming."',
      },
    ],
  },
  {
    id: 'this-is-fine-dog',
    title: 'This is fine (dog meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'A webcomic panel showing a cartoon dog in a burning room',
    tags: ['reaction image', 'denial'],
    aliases: ['this is fine', 'this is fine dog', 'dog in burning room'],
    interpretations: [
      {
        label: 'Calm denial in a crisis',
        summary:
          'A cartoon dog sips coffee calmly while the room burns around it, saying "This is fine."',
        context:
          'It describes pretending everything is okay when it clearly is not — work chaos, the news, your inbox.',
        usageExample: 'Posting the image when 47 emails arrive before 9 a.m.',
      },
    ],
  },
  {
    id: 'distracted-boyfriend',
    title: 'Distracted boyfriend (meme)',
    category: 'meme',
    decade: '2010s+',
    origin: 'A stock photograph',
    tags: ['reaction image', 'temptation'],
    aliases: ['distracted boyfriend', 'guy looking back meme'],
    interpretations: [
      {
        label: 'Tempted by something new',
        summary:
          'A stock photo of a man turning to look at a passer-by while his partner glares at him.',
        context:
          'People label the three figures to joke about being pulled away from something you should stay loyal to.',
        usageExample: 'Labels: man = "me", passer-by = "a new hobby", partner = "my unfinished projects".',
      },
    ],
  },
  {
    id: 'all-izz-well-3-idiots',
    title: '“All izz well” (3 Idiots)',
    category: 'film',
    decade: '2000s',
    origin: 'The Hindi film 3 Idiots',
    tags: ['bollywood', 'india', 'reassurance'],
    aliases: ['all izz well', 'aal izz well', 'all is well'],
    interpretations: [
      {
        label: 'A self-calming mantra',
        summary:
          'A phrase a student repeats while patting his chest to calm himself when things get scary.',
        context:
          'Hugely popular in India. People say (or sing) it to reassure themselves or friends before something stressful. The spelling copies how it is said in the film.',
        usageExample: 'Waiting for exam results, hand on heart: "All izz well."',
      },
    ],
  },
  {
    id: 'i-choose-you-pokemon',
    title: '“I choose you!” (Pokémon)',
    category: 'cartoon',
    decade: '1990s',
    origin: 'The Pokémon animated series',
    tags: ['animation', 'anime', 'games'],
    aliases: ['i choose you', 'pikachu i choose you', 'pokémon', 'pikachu'],
    interpretations: [
      {
        label: 'Sending in your champion',
        summary:
          'What a trainer shouts when sending a creature into battle — most famously Ash sending out Pikachu.',
        context: 'People say it jokingly when picking someone for a task or picking an item.',
        usageExample: 'Pointing at a friend when someone needs to call the restaurant: "I choose you!"',
      },
    ],
  },
  {
    id: 'ok-boomer',
    title: 'OK boomer',
    category: 'meme',
    decade: '2010s+',
    origin: 'Internet slang',
    tags: ['slang', 'generations'],
    aliases: ['ok boomer', 'okay boomer'],
    interpretations: [
      {
        label: 'A dismissive comeback',
        summary:
          'A short reply younger people use when an older person sounds condescending or out of touch.',
        context:
          '"Boomer" refers to the baby-boom generation but is often used loosely for anyone who sounds old-fashioned. It can come across as rude.',
        usageExample: '"Young people can\'t read a paper map." / "OK boomer."',
      },
    ],
  },
  {
    id: 'the-snap-avengers',
    title: 'The snap (Avengers)',
    category: 'film',
    decade: '2010s+',
    origin: "Marvel's Avengers films",
    tags: ['superheroes', 'marvel'],
    aliases: ['the snap', 'thanos snap', 'thanos', 'snap'],
    interpretations: [
      {
        label: "A villain's world-changing gesture",
        summary:
          'In the Avengers films, the villain Thanos plans to wipe out half of all life with a snap of his fingers.',
        context:
          'People mime a finger snap to joke about making something vanish — chores, bugs, Mondays.',
        usageExample: '"If I could snap my fingers and make meetings disappear…"',
      },
      {
        label: 'What happens after the snap',
        summary:
          'The snap actually happens: half of all living things — including many heroes — turn to dust.',
        context:
          'The shock ending became a cultural moment. Online "dusting" jokes and fading-away effects refer to it.',
        usageExample: 'Jokingly "dusting away" to escape an awkward conversation.',
        spoiler: 'major',
      },
    ],
  },
];

export interface SeedData {
  references: Reference[];
  interpretations: Interpretation[];
  aliases: Alias[];
}

export function buildSeed(): SeedData {
  const references = SEED_DEFINITIONS.map<Reference>((def) => ({
    id: def.id,
    title: def.title,
    normalizedTitle: normalizePhrase(def.title),
    category: def.category,
    decade: def.decade,
    origin: def.origin,
    tags: def.tags,
    editorialState: 'demo',
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }));

  const interpretations = SEED_DEFINITIONS.flatMap((def) =>
    def.interpretations.map<Interpretation>((item, index) => ({
      id: `${def.id}.${index + 1}`,
      referenceId: def.id,
      label: item.label,
      summary: item.summary,
      context: item.context,
      usageExample: item.usageExample,
      spoiler: item.spoiler ?? 'none',
      sourceIds: [],
      provenance: 'seed_curated',
      evidence: 'unverified',
      selection: null,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    })),
  );

  const aliases = SEED_DEFINITIONS.flatMap((def) =>
    def.aliases.map<Alias>((phrase) => {
      const normalizedPhrase = normalizePhrase(phrase);
      return { id: `${def.id}:${normalizedPhrase}`, phrase, normalizedPhrase, referenceId: def.id };
    }),
  );

  return { references, interpretations, aliases };
}
