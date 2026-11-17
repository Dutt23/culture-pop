# Query classifier experiment: rules vs a small embedding model (2026-11-17)

**Question.** Do the hand-written search-intent rules (`community.ts`, `rewrite.ts`) or a small
in-browser embedding model (`Xenova/all-MiniLM-L6-v2`) sort short search queries better?

**Answer.** Neither is good, but the model is not worth shipping. For intent the rules win
clearly (73% vs 46%). For the D50 "lean to stories" decision on questions the model scores
higher on this set (88% vs 54%), but it gets the owner's own example ("who committed the worst
genocides") wrong with high confidence, so it would undo the case D50 was made for.
**Recommendation: don't ship.** Details and reasons at the end.

Offline only. Nothing in `src/` or `api/` changed.

## Files

- `docs/eval/query-classifier/queries.json`: 143 labelled queries (29 Hinglish; 79 reused from
  `src/test/search-eval/`, 64 new).
- `scripts/query-classifier/classify.eval.ts`: scores the rules and the models.
  Writes `.cache/query-classifier/summary.md` and `results.json` (every prediction and margin).
- Run: `npx vitest run --config scripts/query-classifier/vitest.config.ts` (about 1.5 s once the
  models and vectors are cached; models load from `.cache/transformers`, already there from D42).

## Labels

Each query has an `intent` and a `lean`. Labels were written by hand before any scoring; a
`note` in the JSON explains the non-obvious ones.

**intent**, by what the searcher wants back:

- `phrase_or_quote`: the text is itself a line someone says: dialogue, catchphrase, slang, meme
  caption, song line. Test: could someone say or type this to another person? "how you doin",
  "rasode mein kaun tha", "who let the dogs out". A quote with its source added ("that was his
  mistake big hero 6") is still a quote.
- `lookup`: the name of a thing: a work, character, person, band, genre or meme image ("distracted
  boyfriend"). Titles shaped like questions are lookups ("who framed roger rabbit"). "What is" or
  "who is" plus a bare name is a lookup too ("what is the matrix"), since the answer is that page.
- `question`: asks something about a topic beyond naming it ("why are ferrari fans depressed"),
  in English or Hinglish ("joker ka origin kya hai").
- `request`: asks to be told or shown something about a topic ("give me history of gundam"),
  with or without an opening verb ("origin of the doge meme", "gundam ki history batao").

**lean**, by which kind of page should answer:

- `fiction_or_myth`: a character, story, fictional world, myth or legend.
- `real_world`: real people, events, history, science, nature, sport, companies.
- `either`: a phrase, meme, slang or title, where both kinds of page are fine, or a question
  about a meme (meme pages are never folded). All phrases and most titles are `either`; a lookup
  is `fiction_or_myth` only for a character or story event ("simba", "thanos snap") and
  `real_world` only for a real person, band or genre.

The lean only changes what the app shows for a question (D50 folds real-world pages and steers
the wider web), so the score that matters is the **fold decision** on the 24 questions whose
lean is not `either`: fold when the label is `fiction_or_myth`, keep when it is `real_world`.

## How the rules map to labels

- intent: `requestTopic(q)` defined → `request`; else `looksLikeQuestion(q)` → `question`; else
  `looksLikePhrase(q)` → `phrase_or_quote`; else `lookup`.
- lean: `looksLikeQuestion(q)` → `fiction_or_myth` (D50 with the default "Stories & myths" ticked),
  else `either`. The rules never say `real_world`.
- fold: `looksLikeQuestion(q)`.

In the app `requestTopic` only runs after a miss, so "show me the money" finds its own page first.
Here it is scored on the text alone, which costs the rules that one query.

## How the model maps to labels

Each label gets two one-sentence descriptions (in the script). Each description is embedded
once; a query takes the label whose nearer description has the highest cosine. Fold uses
`fiction_or_myth` vs `real_world` only. The "hybrid" keeps the rules' `request` and `question`
and asks the model only for queries the rules leave to the default, and folds only when the
rules say question **and** the model says fiction. Descriptions were written once and not tuned.

## Results

| measure | rules | MiniLM-L6 | hybrid |
|---|---|---|---|
| intent, all 143 | 105 (73%) | 66 (46%) | 72 (50%) |
| intent, 29 Hinglish | 21 (72%) | 16 (55%) | 16 (55%) |
| lean, all 143 | 109 (76%) | 89 (62%) | - |
| fold decision, 24 questions | 13 (54%) | 21 (88%) | 18 (75%) |

Hinglish with `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (already cached; used instead of
downloading e5-small): intent 13/29 (45%), lean 18/29 (62%). No better than the English model
(16/29 and 16/29).

"lean, all" mostly measures the `either` majority and says little; the fold row is the one that
matters.

### Intent confusion (rows true, columns predicted)

Rules:

| | lookup | question | request | phrase_or_quote |
|---|---|---|---|---|
| lookup | 28 | 3 | 0 | 13 |
| question | 0 | 22 | 0 | 4 |
| request | 0 | 0 | 8 | 4 |
| phrase_or_quote | 10 | 3 | 1 | 47 |

MiniLM-L6:

| | lookup | question | request | phrase_or_quote |
|---|---|---|---|---|
| lookup | 18 | 6 | 5 | 15 |
| question | 1 | 16 | 2 | 7 |
| request | 2 | 1 | 8 | 1 |
| phrase_or_quote | 20 | 14 | 3 | 24 |

## Where each wins and loses

**Rules lose on intent:**

- Word count decides lookup vs phrase, so long titles become phrases ("the legend of zelda breath
  of the wild", "ruler of everything tally hall", "post malone ozzy osbourne") and two-word lines
  become lookups ("touch grass", "skill issue", "hello clarice", "babu bhaiya"). In the app this
  only changes when community links are offered, so the cost is small.
- Question-shaped lines and titles: "who let the dogs out", "is this a pigeon", "who framed roger
  rabbit", "when harry met sally". "what's up doc", "how you doin", "why so serious" and "can you
  play wonderwall" are handled right.
- **Every Hinglish question and request is missed**: "joker ka origin kya hai", "sabse strong anime
  character kaun hai", "gundam ki history batao", "mahabharat ki kahani sunao". The word lists are
  English only.

**The model loses on intent, by more:** it sorts by topic, not by the shape of the sentence.
Short titles become requests or questions ("dune", "elden ring", "jujutsu kaisen"); quotes become
questions ("i choose you", "king of the world", "mods are asleep"); real questions become phrases
("what does rizz mean", "why is the joker so popular"). The hybrid makes rules worse (73% → 50%)
because the model is weakest exactly where the rules hand over: lookup vs phrase.

**Fold decision on questions:**

| query | label | rules | model | margin (fiction − real) |
|---|---|---|---|---|
| why are ferrari fans depressed | keep | fold ✗ | keep ✓ | −0.097 |
| why do cats knead blankets | keep | fold ✗ | keep ✓ | −0.057 |
| who was the first prime minister of india | keep | fold ✗ | keep ✓ | −0.075 |
| when did the berlin wall fall | keep | fold ✗ | keep ✓ | −0.175 |
| who is the most evil dictator in history | keep | fold ✗ | keep ✓ | −0.155 |
| **who committed the worst genocides** | fold | fold ✓ | **keep ✗** | **−0.151** |
| who killed dumbledore | fold | fold ✓ | keep ✗ | −0.041 |
| why did thanos snap | fold | fold ✓ | keep ✗ | −0.031 |
| who is the strongest anime character | fold | fold ✓ | fold ✓ | +0.316 |
| joker ka origin kya hai | fold | keep ✗ | fold ✓ | +0.102 |
| ravan ke kitne sir the | fold | keep ✗ | fold ✓ | +0.002 |

(Full list of 24 in `.cache/query-classifier/summary.md` after a run.)

- The rules fold every English question, so all 8 real-world questions are folded (the ferrari,
  bmw, cats, distracted-boyfriend, prime minister, berlin wall, dictator and titanic questions),
  and the 3 Hinglish fiction questions are never seen as questions.
- The model keeps all 8 real-world questions and catches the Hinglish ones, but misses 3 fiction
  questions. The genocides question scores −0.151, as "real" as the berlin wall (−0.175) and the
  dictator (−0.155). No threshold separates them. The text really is about real history; the
  fiction lean is the app's policy, not something in the words, so no embedding will learn it.
- Margins are small overall (most within ±0.1), and the two descriptions were written by the same
  person who wrote the labels, on 24 questions. Treat 88% as optimistic.

## Size and speed

Measured on this Mac (Apple silicon, Node 22, CPU, one query at a time, model already loaded).
**These are not phone numbers**; a mid-range phone in the browser (WASM) will be several times
slower, and the first load adds the download and model start-up, which were not measured.

| | download (q8 ONNX + tokenizer) | median per query | p95 |
|---|---|---|---|
| `Xenova/all-MiniLM-L6-v2` | 23.7 MB | 0.7 ms | 1.0 ms |
| `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | 135.4 MB | 1.4 ms | 2.7 ms |
| rules | 0 | 0.002 ms | - |

## Recommendation

**Don't ship**, not even as a backup.

1. For intent, the model is much worse than the rules, and worst on the queries the rules can't
   sort (lookup vs phrase), so a backup makes results worse (73% → 50%).
2. For the fold decision, the model's errors are the costly kind: it unfolds fiction questions,
   which turns D50 off for "who committed the worst genocides", the case D50 exists for. The rules'
   errors (folding real-world questions) cost one tap: the pages sit under "Other pages found" and
   the "Stories & myths" box can be unticked.
3. 24 MB extra download, English only, for a gain that is mostly on test questions I wrote myself.

Cheaper things the data points at, not done here:

- Hinglish question and request words ("kya hai", "kaun hai", "kab", "batao", "sunao") would catch
  the missed Hinglish questions and requests, but the most famous Hinglish lines use the same words
  ("rasode mein kaun tha", "kitne aadmi the", "bhai aap kya kehna chahte ho", "ye kya hai bhai"),
  so any such rule needs this set as its test before it ships.
- Revisit the fold only if real search history shows many real-world questions being folded.
