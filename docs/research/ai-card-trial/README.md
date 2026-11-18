# AI card draft trial (2026-11-18)

Throwaway scripts behind `docs/superpowers/specs/2026-11-18-ai-card-drafts-design.md`. Not part
of the app. `prompt.mjs` holds `card-draft-v3`: the instructions, six worked examples, the request
builder (TOON) and the answer schema. It's the source to copy into `api/_lib/cardPrompt.ts`.

Run from this folder (keys are read from `.env` and never printed):

```bash
node --env-file=../../../.env gather.mjs
```

```bash
node --env-file=../../../.env run.mjs
```

```bash
node report.mjs
```

`ONLY=luna,llama` before `run.mjs` limits the models. The gathered evidence, results and report
aren't kept here: they contain Parallel's page text, which its terms let us keep only for the
person who searched. Re-run `gather.mjs` to recreate them (a few cents of Parallel credit).
