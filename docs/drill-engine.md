# Drill Engine

> Read for the core drill loop, the word two-step, distractor selection, feedback, and the endgame capstone.  
> Always alongside `CLAUDE.md`, `docs/data-models.md`, and `docs/srs.md`.

---

## The universal drill (jamo, geulja, phrase, and word-recognition)

One mechanic, used everywhere:

1. **Present** — show the Hangul unit as the stimulus, with **4 romanisation options** below it (the correct sound + 3 confusable distractors). Start the reaction-time clock once the card has finished rendering/animating, not before.
2. **Answer** — the learner taps an option. Record `{ correct, reactionTimeMs }`. Reaction time = first-tap timestamp − card-ready timestamp.
3. **Feedback** — immediate: a sound effect and a screen flash, **green for correct, red for incorrect**.
4. **Reveal** — briefly show the romanisation, play the Korean **audio** (device TTS, see `docs/architecture.md`), and the **optional meaning**. On an incorrect answer, make the correct option clearly visible here.
5. **Next** — auto-advance: ~**1.2s** after a correct answer, ~**2s** after an incorrect one (longer so the correct answer can be read). These are tunable.

**Scoring is single-attempt.** A recognition item is scored on the first tap — correct or not, with its reaction time — and that result feeds the SRS (`docs/srs.md`). No retries on recognition items; a missed item simply resurfaces soon via the scheduler. (The one place retries exist is the word *introduction*, below, which is teaching, not scoring.)

**Correctness is trivial here.** Because answers are multiple-choice taps, "correct" is just whether the tapped option is the right one — a simple id equality. There is no free-text answer-checking anywhere in the app.

---

## The two-step word tier

By the time a learner reaches words they have already drilled the constituent geulja, so a word is the *next* challenge — recognising it whole — not a rerun of geulja decoding. A word's `ItemRecord` carries an `introduced` flag that routes its next encounter:

### Step 1 — Introduction (only when `introduced === false`)

The first time a learner meets a word, run the decomposition view (`WordIntroduction.tsx`):

- Show the whole word with its geulja laid out (from the item's `geulja` array).
- **Highlight the active geulja**; geulja already completed are **green** with their romanisation faded in beneath; geulja still to come are **greyed**.
- For the active geulja, present the same 4-option choice (its sound + 3 confusable geulja distractors). The learner taps.
- **Retries are allowed here** — wrong answer shows it's wrong and lets them try again; this step is teaching, so it does **not** feed the SRS.
- On correct, that geulja turns green, its romanisation fades in, and the active highlight advances to the next block.
- When all blocks are done, briefly show the assembled whole word and play its audio, then set `introduced = true`.

The introduction is a one-time bridge per word. It does not produce an SRS score (it only flips `introduced`). The word's first *recognition* rep happens on its next appearance.

### Step 2 — Whole-word recognition (whenever `introduced === true`)

From then on, the word runs the **universal drill** above as a single unit: the full word shown, confusable **whole-word** options, one scored attempt. A word reaches `automatic` only through fast recognition of the **whole word** — never via its individual geulja. This is the actual target skill.

---

## Distractor selection (runtime)

Distractors are **precomputed at build time** (see `docs/content-pipeline.md`) and stored on each item as `distractorIds`. At runtime, `src/logic/distractors.ts`:

1. Takes the target item.
2. Resolves its `distractorIds` to full items (for their romanisations).
3. Returns the correct romanisation plus 3 distractor romanisations, **shuffled**, as exactly 4 options.

For the **introduction step**, the active geulja is itself a geulja-tier unit, so its options come from confusable geulja distractors the same way (resolved from the geulja pool / precomputed for that block).

Guard rails: never include the correct answer twice; if an item somehow has fewer than 3 resolvable distractors, fall back to nearest others in the same tier so there are always 4 options.

---

## Drill state machine (`src/logic/drill.ts`)

Holds the session queue (from `src/logic/session.ts`) and steps one item at a time:

```
phase: 'presenting' → 'answered' → 'revealing' → 'next'
```

- `presenting`: render card, start RT clock. For a word with `introduced === false`, branch into the introduction sub-flow instead.
- `answered`: capture tap + RT, compute correctness, fire feedback (sound + flash).
- `revealing`: show romanisation + audio + optional meaning; correct answer visible if they missed.
- `next`: after the auto-advance delay, pop the next item; if the queue is empty, end the session.

At session end, hand the accumulated results to `srs.ts` for record updates and to `profile.ts` to persist (batch write), then show the **session summary** (see `docs/progress-dashboard.md`).

---

## Endgame capstone (`EndgameScreen`)

A periodic milestone, **not** a daily drill — offered at the end of a tier or as a weekly "fluency check" (the Home screen surfaces it when available).

- The learner reads a **larger body of connected text** (up to a paragraph) drawn from items/phrases they've largely reached `automatic` on, so it's readable.
- They **tap through the text as they read** — tapping each word (or line) as they recognise it — which yields a **words-per-minute** figure on connected text without any speech recognition.
- Record the result to `meta.endgameHistory` (`{ date, wpm, tier }`). This is the most tangible proof of progress and a preview of stage two (the future reading assistant).
- **Open question, deferred:** whether to attach a light "gist" comprehension check so people read rather than tap-race. Lean is none for v1; revisit if tap-racing proves a problem.

The endgame does not alter SRS state; it's an assessment, not a drill.

---

## What the drill engine must not do

- No free-text input, no typing answers (multiple choice only).
- No retries on scored recognition items (retries exist only in the word introduction).
- No per-geulja scoring of words once introduced — words are scored whole.
- No blocking on audio — if the device has no Korean voice, the drill proceeds and the speaker control is hidden (see `docs/architecture.md`).
- No meaning testing — meaning appears only in the reveal.
