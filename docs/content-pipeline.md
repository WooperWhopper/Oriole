# Content Pipeline (Build-Time)

> Read for the scripts that generate `assets/content/korean.json`.  
> Always alongside `CLAUDE.md` and `docs/data-models.md`.

**This runs once, on the developer's machine, before the app ships. None of it is in the app.** The app only ever reads the finished `korean.json`. Think of it as printing a phrasebook: all the lookup happens here, ahead of time, and the result is baked in. Run it with an npm script (e.g. `npm run build-content`).

---

## Inputs (all free)

- **A Korean word list** — the source of *which* words. Use a learner-graded list (TOPIK vocabulary lists, or the National Institute of Korean Language's graded learner vocabulary) because it's already ordered for learners; a frequency list (OpenSubtitles-derived, e.g. the hermitdave FrequencyWords project) is the alternative for a more colloquial slant. **Pin the exact source and check its licence** — "free" usually means attribution may be required.
- **A rule-applying romaniser** — produces **pronunciation-based** Revised Romanisation (sound-change rules applied). KOROMAN (JS) or `ko-pron` (Python) are the candidates. Since this is build-time, a Python tool is fine — the orchestrator can shell out to it. **Pin and verify the exact package** (the `fr-compromise` lesson), and validate it on the tricky-word set below before trusting it.
- **A free Korean–English dictionary** for meanings — kengdic or Wiktionary. Optional Papago cross-check (mind Papago's attribution requirement if its output is displayed). Meaning is optional per item and may be null.
- **A curated phrase list** (~100–150) — more curation than derivation; draft from a phrasebook source and have a native speaker validate naturalness.

---

## Steps

```
build-content.ts (orchestrator):

1. Load the word list → take the top ~500–1,000 by the list's order.
2. derive-geulja.ts:
     decompose every word into syllable blocks (geulja),
     count occurrences (weight by word frequency/order),
     take the most common ~300–500 unique blocks.
     Add the fixed jamo set (~40).
3. Assemble the phrase list (~100–150), curated + native-validated.
4. romanize.ts:
     for every item (jamo, geulja, word, phrase), get PRONUNCIATION-based
     Revised Romanisation from the rule-applying romaniser.
5. fetch-meanings.ts:
     for words (and optionally phrases), look up English meaning from the
     free dictionary; null if not found. (Optional Papago cross-check.)
6. build-distractors.ts:
     for every item, compute confusable distractors within the same tier
     (algorithm below); store the top 3 ids.
7. Emit assets/content/korean.json (flat items array; schema in data-models.md).
```

Each item written must match the `ContentItem` schema in `docs/data-models.md` (`id`, `tier`, `hangul`, `romanization`, optional `meaning`, `order`, word-only `geulja`, `distractorIds`).

---

## Romanisation — the critical correctness check

Revised Romanisation is **pronunciation-based**: sound changes must be applied (국물 → "gungmul", 같이 → "gachi", 있다 → "itta", 독립문 → "Dongnimmun"). A naive grapheme-by-grapheme mapper is **wrong** for the word and phrase tiers and unacceptable for a reading/pronunciation trainer.

Before trusting any romaniser, run it on this set and reject it if any come out as the mechanical (wrong) form:

```
있다 → itta      (not "issda"/"itda")
국물 → gungmul   (not "gukmul")
같이 → gachi     (not "gati")
신라 → silla     (not "sinra")
학교 → hakgyo
독립문 → dongnimmun (not "dokripmun")
좋다 → jota
십육 → simnyuk   (not "sibyuk")
```

Jamo and isolated geulja have no cross-syllable sound changes (just handle final-consonant neutralisation: 밖 → "bak", 꽃 → "kkot", 옷 → "ot"), so the romaniser is easy there — but use the same rule-applying tool throughout for consistency. Have the native-speaker reviewer spot-check the output.

---

## Distractor generation (`build-distractors.ts`)

The wrong options must be **confusable near-misses** so a learner can't coast by recognising one part of a unit (the principle that makes the multiple choice real).

```
for each target item (within its tier):
  decompose target.hangul into jamo
  for every other item in the same tier:
     compute jamo-level edit distance between the two decomposed forms
  rank the others by smallest edit distance
  take the top 3 as distractorIds (closest = most confusable)
  ensure: not the target itself; ids exist; exactly 3
```

This yields, for the geulja 정, neighbours like 종 / 전 / 점; for the word 정원, whole-word neighbours like 장원 / 정문 / 청원. Generated once here; the runtime just resolves the ids (`docs/drill-engine.md`).

For the word **introduction** step, each constituent geulja also needs confusable distractors — either precompute them for the geulja in the geulja tier (they're already geulja items) and reuse, or compute per-block here. Reusing the geulja-tier distractors is simplest.

---

## Output

A single `assets/content/korean.json` (see schema in `docs/data-models.md`), committed to the repo. The app loads it at startup; it is never regenerated at runtime. Re-running the pipeline (new words, better romanisation) just overwrites the file and ships in the next app update.

---

## Risks & mitigations (recap)

- **Wrong pronunciation** → rule-applying romaniser + the tricky-word test set + native spot-check. Highest-priority correctness item.
- **Wrong/ambiguous meaning** → low stakes (meaning is display-only, never tested); native review of common words.
- **List not perfectly ordered** → fine; only needs genuinely common words, roughly graded.
- **Licensing/attribution** → pin sources, prefer permissive licences, add a credits line if required; avoid Papago for displayed output unless you attribute it.
- **Wrong/misnamed package** → pin the exact romaniser package and verify on the test set before relying on it.

---

## What the pipeline must not become

- Not a runtime dependency — it never ships in `src/` or runs on a user's device.
- Not an LLM generating the word list from intuition — the list comes from a real source; an LLM at most drafts phrases or fills gaps, always native-validated.
- Not a source of grapheme-only romanisation — pronunciation-based only.
