/**
 * Labelled inputs for the on-device model benchmark (`/dev/llm-bench`,
 * docs/research/ondevice-llm.md). Test data only: `src/test/` never reaches `dist/`.
 */

export interface SpoilerCase {
  id: string;
  work: string;
  /** A short, widely quoted line (under 15 words), as Wikiquote-style matching text. */
  line: string;
  /**
   * True when knowing the line (in this work) gives away a death, twist, identity or ending.
   * Labelled by the agent, 2026-11-16; the owner may relabel. "I see dead people" and similar
   * setup lines that are famous before the twist are left out rather than guessed.
   */
  spoiler: boolean;
}

export const SPOILER_CASES: readonly SpoilerCase[] = [
  { id: 'S1', work: 'The Empire Strikes Back', line: 'No, I am your father.', spoiler: true },
  { id: 'S2', work: 'Soylent Green', line: 'Soylent Green is people!', spoiler: true },
  { id: 'S3', work: 'Avengers: Endgame', line: 'I am Iron Man.', spoiler: true },
  {
    id: 'S4',
    work: 'Avengers: Infinity War',
    line: "Mr. Stark, I don't feel so good.",
    spoiler: true,
  },
  { id: 'S5', work: 'Game of Thrones', line: 'Hold the door!', spoiler: true },
  {
    id: 'S6',
    work: 'Planet of the Apes (1968)',
    line: 'You maniacs! You blew it up!',
    spoiler: true,
  },
  { id: 'S7', work: 'Fight Club', line: 'His name is Robert Paulson.', spoiler: true },
  { id: 'S8', work: 'Titanic', line: "I'll never let go, Jack.", spoiler: true },
  { id: 'S9', work: 'Game of Thrones', line: 'The Lannisters send their regards.', spoiler: true },
  { id: 'S10', work: 'Se7en', line: "What's in the box?", spoiler: true },
  {
    id: 'S11',
    work: 'Baahubali 2: The Conclusion',
    line: 'Kattappa ne Baahubali ko kyun maara?',
    spoiler: true,
  },
  { id: 'N1', work: 'Star Wars', line: 'May the Force be with you.', spoiler: false },
  { id: 'N2', work: 'The Terminator', line: "I'll be back.", spoiler: false },
  { id: 'N3', work: 'Jaws', line: "You're gonna need a bigger boat.", spoiler: false },
  { id: 'N4', work: 'Casablanca', line: "Here's looking at you, kid.", spoiler: false },
  {
    id: 'N5',
    work: 'The Wizard of Oz',
    line: "Toto, I've a feeling we're not in Kansas anymore.",
    spoiler: false,
  },
  { id: 'N6', work: 'Game of Thrones', line: 'Winter is coming.', spoiler: false },
  { id: 'N7', work: 'Taxi Driver', line: "You talkin' to me?", spoiler: false },
  { id: 'N8', work: 'Apollo 13', line: 'Houston, we have a problem.', spoiler: false },
  { id: 'N9', work: 'Forrest Gump', line: 'Life is like a box of chocolates.', spoiler: false },
  { id: 'N10', work: 'Sholay', line: 'Kitne aadmi the?', spoiler: false },
  { id: 'N11', work: '3 Idiots', line: 'All is well.', spoiler: false },
  { id: 'N12', work: 'Mean Girls', line: 'On Wednesdays we wear pink.', spoiler: false },
  { id: 'N13', work: 'Toy Story', line: 'To infinity and beyond!', spoiler: false },
  { id: 'N14', work: 'Finding Nemo', line: 'Just keep swimming.', spoiler: false },
  { id: 'N15', work: 'Breaking Bad', line: 'I am the one who knocks.', spoiler: false },
  { id: 'N16', work: 'Deewaar', line: 'Mere paas maa hai.', spoiler: false },
];

/** Comics characters whose Wikipedia article has a character-biography section (D38). */
export const STORY_TITLES: readonly { title: string; name: string }[] = [
  { title: 'Doctor Doom', name: 'Doctor Doom' },
  { title: 'Spider-Man', name: 'Spider-Man' },
  { title: 'Wolverine (character)', name: 'Wolverine' },
  { title: 'Joker (character)', name: 'the Joker' },
  { title: 'Harley Quinn', name: 'Harley Quinn' },
  { title: 'Thanos', name: 'Thanos' },
  { title: 'Deadpool', name: 'Deadpool' },
  { title: 'Black Panther (character)', name: 'Black Panther' },
  { title: 'Wonder Woman', name: 'Wonder Woman' },
  { title: 'Magneto (Marvel Comics)', name: 'Magneto' },
];
