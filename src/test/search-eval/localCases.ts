/**
 * Local-only cases for the MiniSearch trial (docs/SEARCH_RANKING.md). The 14 original local cases
 * are all exact or near-exact queries, so the tier ranker scores 100% and cannot show a gain. These
 * add typos and misspellings of seeded references, plus controls the tiers already answer, so a
 * candidate engine is checked for both gains and regressions. No live (QID) answers: they never
 * run against Wikimedia. IDs are seed reference IDs (`src/data/seed.ts`).
 */
import type { EvalCase } from './queries';

const SEED = {
  lionKing: { label: 'Hakuna Matata (The Lion King)', local: 'hakuna-matata-lion-king' },
  swahili: { label: 'Hakuna matata (Swahili phrase)', local: 'hakuna-matata-swahili' },
  frozen: { label: 'Let It Go (Frozen)', local: 'let-it-go-frozen' },
  saying: { label: 'Let it go (everyday saying)', local: 'let-it-go-saying' },
  titanic: { label: 'King of the world (Titanic)', local: 'king-of-the-world-titanic' },
  doh: { label: "D'oh! (The Simpsons)", local: 'doh-simpsons' },
  friends: { label: 'How you doin? (Friends)', local: 'how-you-doin-friends' },
  bazinga: { label: 'Bazinga! (The Big Bang Theory)', local: 'bazinga-big-bang-theory' },
  twss: { label: "That's what she said (The Office)", local: 'thats-what-she-said-office' },
  winter: { label: 'Winter is coming (Game of Thrones)', local: 'winter-is-coming-got' },
  fine: { label: 'This is fine (dog meme)', local: 'this-is-fine-dog' },
  boyfriend: { label: 'Distracted boyfriend (meme)', local: 'distracted-boyfriend' },
  izzWell: { label: 'All izz well (3 Idiots)', local: 'all-izz-well-3-idiots' },
  pokemon: { label: 'I choose you! (Pokémon)', local: 'i-choose-you-pokemon' },
  boomer: { label: 'OK boomer', local: 'ok-boomer' },
  snap: { label: 'The snap (Avengers)', local: 'the-snap-avengers' },
};

type Meaning = (typeof SEED)[keyof typeof SEED];
type Category = EvalCase['category'];

function localCase(
  id: string,
  query: string,
  meanings: readonly Meaning[],
  category: Category,
  note: string,
): EvalCase {
  return {
    id,
    query,
    reference: meanings.map((m) => m.label).join(' / '),
    meanings: meanings.map((m) => ({ label: m.label, local: [m.local] })),
    category,
    // Controls are exact queries; everything else is a misspelling.
    misremembered: !note.startsWith('Control'),
    ambiguous: meanings.length > 1,
    indian: false,
    origin: 'local_only',
    status: 'scored',
    note,
  };
}

export const LOCAL_ONLY_CASES: readonly EvalCase[] = [
  localCase('LT1', 'hakuna matatta', [SEED.lionKing, SEED.swahili], 'quote', 'Typo: doubled t.'),
  localCase('LT2', 'hakuna matata lion kng', [SEED.lionKing], 'quote', 'Typo in the work name.'),
  localCase('LT3', 'bazingaa', [SEED.bazinga], 'quote', 'Typo: extra letter.'),
  localCase('LT4', 'bazzinga', [SEED.bazinga], 'quote', 'Common misspelling.'),
  localCase('LT5', 'ok bomer', [SEED.boomer], 'slang', 'Typo: dropped letter.'),
  localCase('LT6', 'okey boomer', [SEED.boomer], 'slang', 'Misspelling of okay.'),
  localCase('LT7', 'winter is comming', [SEED.winter], 'quote', 'Typo: doubled m.'),
  localCase(
    'LT8',
    'winter comming game of thrones',
    [SEED.winter],
    'quote',
    'Typo plus extra words.',
  ),
  localCase('LT9', 'homer simson', [SEED.doh], 'quote', 'Typo in an alias (homer simpson).'),
  localCase('LT10', 'this is fien', [SEED.fine], 'meme', 'Typo: swapped letters.'),
  localCase('LT11', 'distracted boyfreind', [SEED.boyfriend], 'meme', 'Typo: swapped letters.'),
  localCase('LT12', 'all izz wel', [SEED.izzWell], 'quote', 'Typo: dropped letter.'),
  localCase(
    'LT13',
    'aal is wel',
    [SEED.izzWell],
    'quote',
    'Misspelling of the alias aal izz well.',
  ),
  localCase('LT14', 'pickachu i choose you', [SEED.pokemon], 'quote', 'Typo in the alias pikachu.'),
  localCase('LT15', 'thanos snapp', [SEED.snap], 'meme', 'Typo: doubled p.'),
  localCase('LT16', 'thats what she sad', [SEED.twss], 'quote', 'Typo: dropped letter.'),
  localCase('LT17', 'king of the wrld', [SEED.titanic], 'quote', 'Typo: dropped letter.'),
  localCase('LT18', 'lte it go', [SEED.frozen, SEED.saying], 'music', 'Typo: swapped letters.'),
  localCase('LT19', 'let it goo', [SEED.frozen, SEED.saying], 'music', 'Typo: extra letter.'),
  localCase('LT25', 'bzainga', [SEED.bazinga], 'quote', 'Swapped letters.'),
  localCase('LT26', 'distarcted boyfriend', [SEED.boyfriend], 'meme', 'Swapped letters.'),
  localCase('LT27', 'wintre is coming', [SEED.winter], 'quote', 'Swapped letters.'),
  localCase('LT28', 'thnaos snap', [SEED.snap], 'meme', 'Swapped letters.'),
  localCase(
    'LT20',
    'how you doin joey',
    [SEED.friends],
    'quote',
    'Control: tiers already find it.',
  ),
  localCase(
    'LT21',
    'frozen let it go song',
    [SEED.frozen],
    'music',
    'Control: tiers already find it.',
  ),
  localCase(
    'LT22',
    'hakuna matata',
    [SEED.lionKing, SEED.swahili],
    'quote',
    'Control: exact, two meanings.',
  ),
  localCase('LT23', 'ok boomer', [SEED.boomer], 'slang', 'Control: exact title.'),
  localCase('LT24', "d'oh", [SEED.doh], 'quote', 'Control: exact title.'),
];
