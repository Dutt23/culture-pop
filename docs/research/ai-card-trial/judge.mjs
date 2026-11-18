// Throwaway: scores each AI draft against our own hand-written card (the answer key).
// Run: node --env-file=<project>/.env judge.mjs   (reads OPENAI_API_KEY; never prints it)
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.OPENAI_API_KEY;
const JUDGE = 'gpt-6.2-sol';
const PRICE = [2, 10]; // $ per 1M input, output tokens for the judge (same table as run.mjs)
// EVIDENCE_GRADE=1: the judge also sees the evidence the writer got and adds scores that count only
// the key points that evidence states (meaning_match_ev, overall_ev). Shows sources vs writing.
const WITH_EVIDENCE = process.env.EVIDENCE_GRADE === '1';

// Our cards from src/data/seed.ts and src/data/seedPack1.ts (copied 2026-11-18).
export const KEYS = {
  bazinga: {
    label: 'Gotcha!', gist: 'Gotcha, I was joking.', means: "They've just pranked you, or said something untrue to get a reaction.", reply: 'Okay, Sheldon, you got me.',
    summary: 'What the character Sheldon shouts after a prank or joke — his version of "gotcha!". From the sitcom The Big Bang Theory.',
    context: 'Using it signals you were joking all along, usually with a smug grin.',
  },
  'winter is coming': {
    label: 'A family motto turned warning', gist: 'Hard times are on the way.', means: "They're being dramatic about something unpleasant coming up, like exams or a deadline.", reply: "Then I'd better find my fur cloak.",
    summary: "The grim motto of the Stark family: always prepare, because hard times are on the way. From Game of Thrones, adapted from George R. R. Martin's novels.",
    context: 'Fans use it for any approaching hardship, and literally when the weather turns cold.',
  },
  'ok boomer': {
    label: 'A dismissive comeback', gist: "You're out of touch, and I'm not going to argue.", means: "They're brushing off an older person's opinion, sometimes rudely.", reply: 'Wow, okay. Rude.',
    summary: 'A short reply younger people use when an older person sounds condescending or out of touch.',
    context: '"Boomer" refers to the baby-boom generation but is often used loosely for anyone who sounds old-fashioned. It can come across as rude.',
  },
  stonks: {
    label: "A dodgy 'smart' money move", gist: 'A "smart" money move that clearly isn\'t.', means: "They're joking about a terrible bet or a tiny win.", reply: 'Financial genius.',
    summary: 'A deliberately misspelled "stocks" next to a crude 3D man in a suit, in front of a rising graph.',
    context: 'Said about any money decision, good or awful, with irony.',
  },
  'kitne aadmi the': {
    label: 'A demand for a headcount', gist: 'How many were there? (asked like a scary boss)', means: "They're demanding a headcount, with mock menace.", reply: 'Sirf do, sardar.',
    summary: 'The bandit Gabbar Singh asks his men how many people beat them, and is furious at the answer. From the Hindi film Sholay.',
    context: 'Used to ask how many are coming, or who was involved, in a dramatic Gabbar voice.',
  },
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    key_points: { type: 'array', items: { type: 'string' } },
    covered: { type: 'array', items: { type: 'string' } },
    missed: { type: 'array', items: { type: 'string' } },
    wrong_or_invented: { type: 'array', items: { type: 'string' } },
    meaning_match: { type: 'integer' },
    voice_match: { type: 'integer' },
    overall: { type: 'integer' },
    comment: { type: 'string' },
  },
  required: ['key_points', 'covered', 'missed', 'wrong_or_invented', 'meaning_match', 'voice_match', 'overall', 'comment'],
};

const SCHEMA_EV = {
  ...SCHEMA,
  properties: {
    ...SCHEMA.properties,
    key_points: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { point: { type: 'string' }, in_evidence: { type: 'boolean' }, covered: { type: 'boolean' } },
        required: ['point', 'in_evidence', 'covered'],
      },
    },
    not_in_evidence: { type: 'array', items: { type: 'string' } },
    meaning_match_ev: { type: 'integer' },
    overall_ev: { type: 'integer' },
  },
  required: [...SCHEMA.required, 'not_in_evidence', 'meaning_match_ev', 'overall_ev'],
};

const INSTRUCTIONS_EV = `
You also get the evidence the writer was given (the only facts it was allowed to use).
6. For each key point set in_evidence: true only when an evidence item states it or plainly says the same thing; covered: true when the draft gets it across.
7. meaning_match_ev and overall_ev: score the draft the same way, but only against key points with in_evidence true. A point the evidence lacks is not a miss here. voice_match is the same for both.
8. not_in_evidence: claims in the draft that no evidence item supports, even if true.`;

const INSTRUCTIONS = `You grade an AI-drafted card for a pop-culture explainer app against the editor's own card (the answer key) for the same reference.
1. List the answer key's key points: what it is, where it comes from, what someone means by it, how it's used. 3 to 6 short points. Ignore its example line and its exact wording.
2. covered: key points the draft gets across, even in other words. missed: key points the draft lacks.
3. wrong_or_invented: anything in the draft that contradicts the answer key or is a clearly wrong fact. Extra true detail is fine and not listed.
4. Scores from 1 to 5: meaning_match (does a reader come away understanding the same thing), voice_match (plain, warm, short, friendly lines like the key; the reply is something a person would really say), overall.
5. comment: one sentence.
Answer with JSON only.`;

// Messy versions of the same searches are graded against the same card.
const ALIAS = process.env.ALIAS ? JSON.parse(process.env.ALIAS) : {};
const results = JSON.parse(readFileSync(new URL(`./${process.env.RESULTS ?? 'results-key.json'}`, import.meta.url), 'utf8'));
const graded = [];
let spent = 0;
const evidenceOf = (q) =>
  (results.searches?.find((s) => (s.label ?? s.q) === q)?.evidence ?? []).map(({ id, from, title, text }) => ({ id, from, title, text }));
for (const row of results.rows) {
  const key = KEYS[row.q] ?? KEYS[ALIAS[row.q]];
  if (!key || row.error) continue;
  const c = row.card;
  const kept = (part) => row.checks.sentences.filter((s) => s.part === part && !s.problem).map((s) => s.t).join(' ');
  // The draft as the reader would see it: only what passed the checks.
  const draft = { main_use: c.main_use, label: c.label, gist: c.gist, means: c.means, reply: c.reply, summary: kept('summary'), context: kept('context') };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: JUDGE,
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: 2000,
      text: { format: { type: 'json_schema', name: 'grade', schema: WITH_EVIDENCE ? SCHEMA_EV : SCHEMA, strict: true } },
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: WITH_EVIDENCE ? INSTRUCTIONS + INSTRUCTIONS_EV : INSTRUCTIONS }] },
        { role: 'user', content: [{ type: 'input_text', text: `Reference: ${row.q}\n\nAnswer key:\n${JSON.stringify(key, null, 1)}\n\nDraft:\n${JSON.stringify(draft, null, 1)}${WITH_EVIDENCE ? `\n\nEvidence:\n${JSON.stringify(evidenceOf(row.q), null, 1)}` : ''}` }] },
      ],
    }),
  });
  const json = await response.json();
  const text = (json.output ?? []).flatMap((i) => i.content ?? []).filter((p) => p.type === 'output_text').map((p) => p.text).join('');
  const grade = response.ok ? JSON.parse(text) : { error: json.error?.message };
  const cost = ((json.usage?.input_tokens ?? 0) * PRICE[0] + (json.usage?.output_tokens ?? 0) * PRICE[1]) / 1e6;
  spent += cost;
  graded.push({ model: row.model, q: row.q, draft, key, grade, cost });
  console.log(`${row.model.replace(/^.*\//, '').slice(0, 12).padEnd(12)} |${row.q.padEnd(17)} | meaning ${grade.meaning_match} voice ${grade.voice_match} overall ${grade.overall}${WITH_EVIDENCE ? ` (ev: meaning ${grade.meaning_match_ev} overall ${grade.overall_ev}, not-in-ev ${grade.not_in_evidence?.length})` : ''} | missed ${grade.missed?.length} wrong ${grade.wrong_or_invented?.length} | ${grade.comment ?? grade.error}`);
}
writeFileSync(new URL(`./${process.env.GRADED ?? 'graded.json'}`, import.meta.url), JSON.stringify(graded, null, 2));
console.log(`judge $${spent.toFixed(4)}`);
