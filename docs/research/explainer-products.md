# How other products explain references, and whether we need an LLM (2026-11-16)

Owner question after the Mac benchmark (`docs/eval/llm-bench-2026-11-16-mac-qwen3-0.6b.md`): what
do people actually do here, and is an LLM required or overkill? Web research by a subagent; claims it
could not confirm on a primary page are marked unverified.

## What existing products do

| Product                                                                                 | Who writes it                          | Notes                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Know Your Meme](https://knowyourmeme.com/about)                                        | People, staff-vetted                   | Staff research each entry; review takes hours to months ([FAQ](https://knowyourmeme.com/forums/general/topics/3937-frequently-asked-questions)). Slow, accurate |
| Genius annotations                                                                      | People, editors, verified artists      | No primary source on AI use found                                                                                                                               |
| Urban Dictionary                                                                        | Crowd                                  | Process not verifiable                                                                                                                                          |
| r/OutOfTheLoop                                                                          | Crowd                                  | Rules ask for "genuine, unbiased, coherent" answers; no sourcing rule found                                                                                     |
| [Google AI Overviews](https://support.google.com/websearch/answer/14901683)             | AI over search results                 | Google warns they "may include mistakes"                                                                                                                        |
| Perplexity, [Kagi Quick Answer](https://help.kagi.com/kagi/ai/quick-answer.html), Brave | AI over search results, with citations | Kagi runs only on a button or a trailing "?"                                                                                                                    |
| Memling, LingoMojo, GenZ Decoder                                                        | AI, small indie apps                   | No accuracy data; user counts unverified                                                                                                                        |

The explainers people trust are written by people and cite sources. The AI ones are fast but
unproven.

## Accuracy of AI answer engines

- Google AI Overviews: about 91% accurate, but about 56% of correct answers had citations that did
  not support them; Reddit and Facebook among the most-cited sources (Oumi analysis for the NYT,
  April 2026, via [PopSci](https://www.popsci.com/technology/ai-overview-inaccuracy-google/); Google
  disputes it).
- Tow Center (March 2025): eight AI search tools failed over 60% of citation tests
  ([Nieman Lab](https://www.niemanlab.org/2025/03/ai-search-engines-fail-to-produce-accurate-citations-in-over-60-of-tests/)).
- No study found for "why are fans upset"-style community questions.

## Without an LLM

- Extractive answers (picking real sentences) are more faithful than generated ones
  ([paper](https://arxiv.org/pdf/2108.13684)), though not automatically
  ([paper](https://arxiv.org/pdf/2209.03549)).
- People trust snippet-style answers strongly, even wrong ones
  ([TU Delft](https://repository.tudelft.nl/record/uuid:ffdff336-3201-40b3-8800-0f90c365dabe)), so
  choosing good sources matters more than wording.

## On-device and server options

- Chrome's built-in Gemini Nano: desktop only, not Android
  ([Chrome docs](https://developer.chrome.com/docs/ai/get-started)).
- WebLLM on Android: no production users or battery measurements found.
- The [Vectara hallucination leaderboard](https://github.com/vectara/hallucination-leaderboard) has
  nothing under ~3B; the smallest (3–4B) hallucinate about 6–7%. Our 0.6B is below anything measured.
- Server prices per 1M tokens, input/output: Gemini 2.5 Flash-Lite $0.10/$0.40 with a free API tier
  ([Google](https://aistudio.google.com/docs/pricing)); Claude Haiku 5.5 $0.10/$0.50
  ([Anthropic](https://platform.claude.com/docs/en/about-claude/pricing)); Groq gpt-oss-20b
  $0.075/$0.30 at about 1,000 tokens/s ([Groq](https://console.groq.com/docs/models)). Latency for
  Haiku and Gemini not independently measured.

## What it means for us

1. An LLM is **not required** for "what is this": the cited, template-based curator is the same
   pattern as Know Your Meme and Wikipedia.
2. On-device is **overkill** for one phone: too weak at 0.6B, too heavy at 1.5B+, nothing in
   production to learn from.
3. If an LLM is added, it belongs on the **server**, only for "why is X happening" questions, **behind
   a button** (Kagi pattern), given only the retrieved snippets, with the real snippets shown next to
   it.
4. Extractive best-sentence selection stays the default.
