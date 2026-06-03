# Spaced Repetition (Automaticity-Tuned)

> Read for the scheduler, how speed feeds scoring, state transitions, and the session queue.  
> Always alongside `CLAUDE.md` and `docs/data-models.md`.

---

## What's different here

This is SM-2 (the algorithm behind Anki), with one twist: **speed feeds the quality score.** A correct-but-slow answer is treated as weaker than a correct-and-fast one, so items you recognise sluggishly come back sooner until they're automatic. The whole point of the app is speed, so the scheduler optimises for it, not just for correctness.

Everything in `src/logic/srs.ts` is **pure** — it takes an `ItemRecord` plus a result and returns an updated record. No storage, no UI.

---

## Quality score from correctness + speed

Each scored recognition rep produces `{ correct: bool, reactionTimeMs: int }`. Map it to a 0–5 SM-2 quality score using the item's tier threshold (`AUTOMATIC_THRESHOLD_MS[tier]` from `docs/data-models.md`):

```javascript
function qualityFrom(correct, reactionTimeMs, thresholdMs) {
  if (!correct) return 0;                       // wrong
  if (reactionTimeMs < thresholdMs) return 5;   // correct AND fast → automatic-grade
  return 3;                                     // correct but slow
}
```

For v1, three outcomes — 0 (wrong), 3 (correct-slow), 5 (correct-fast) — are enough. A finer gradation (e.g. a 4 for "moderately fast") can be added later by sub-dividing the threshold; mark it tunable.

---

## Updating the record (SM-2 core)

```javascript
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const AUTOMATIC_STREAK = 3;   // consecutive fast-correct reps to reach "automatic" (tunable)

function review(record, { correct, reactionTimeMs }, thresholdMs) {
  const q = qualityFrom(correct, reactionTimeMs, thresholdMs);

  let { interval = 0, easeFactor = DEFAULT_EASE, fastCorrectStreak = 0 } = record;
  const fast = correct && reactionTimeMs < thresholdMs;

  // Interval + ease (SM-2)
  let newInterval, newEase;
  if (q >= 3) {
    newInterval = interval === 0 ? 1 : interval === 1 ? 6 : Math.round(interval * easeFactor);
    newEase = Math.max(MIN_EASE, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  } else {
    newInterval = 1;                                  // wrong → see it tomorrow
    newEase = Math.max(MIN_EASE, easeFactor - 0.2);
  }

  // Speed streak — the gate to "automatic"
  const newStreak = fast ? fastCorrectStreak + 1 : 0;

  // State (milestones never regress; a miss just resets interval + streak so it returns sooner)
  let state = record.state ?? 'new';
  if (state !== 'automatic') {
    state = newStreak >= AUTOMATIC_STREAK ? 'automatic' : 'learning';
  }

  const now = new Date();
  const nextDue = new Date(now);
  nextDue.setDate(nextDue.getDate() + newInterval);

  return {
    ...record,
    state,
    reps: (record.reps ?? 0) + 1,
    correctCount: (record.correctCount ?? 0) + (correct ? 1 : 0),
    incorrectCount: (record.incorrectCount ?? 0) + (correct ? 0 : 1),
    fastCorrectStreak: newStreak,
    lastReactionTimeMs: correct ? reactionTimeMs : record.lastReactionTimeMs,
    bestReactionTimeMs: correct
      ? Math.min(reactionTimeMs, record.bestReactionTimeMs ?? Infinity)
      : record.bestReactionTimeMs,
    interval: newInterval,
    easeFactor: newEase,
    nextDue: nextDue.toISOString(),
    lastSeen: now.toISOString(),
  };
}
```

Note: `fastCorrectStreak` is added to the working record; it's fine to persist it on the `ItemRecord` (extend the schema in `docs/data-models.md` if you want it durable, or recompute — persisting is simpler).

---

## State transitions

```
new        → first scored rep        → learning
learning   → AUTOMATIC_STREAK fast-correct reps in a row → automatic
automatic  → stays automatic         (a later slow/wrong answer resets interval + streak,
                                       so it's reviewed sooner, but the milestone doesn't regress)
```

Speed is the gate: an item only becomes `automatic` by being recognised **quickly**, not merely correctly. This is what ties the SRS to the product's purpose. States not regressing keeps the experience encouraging while still resurfacing wobbly items via the reset interval.

(Words: the rep that counts toward this is the **whole-word** recognition rep, never an introduction step — see `docs/drill-engine.md`.)

---

## Building the session queue (`src/logic/session.ts`)

```
buildQueue(records, content, currentTier, sessionLength):
  now = Date.now()

  due      = records where nextDue <= now, sorted oldest-due first
  newItems = content items in currentTier with no record (or state 'new'),
             in `order`, that aren't already in `due`

  queue = [...due, ...newItems]
  return queue.slice(0, sessionLength)
```

Due reviews come first (retention), then fresh items from the learner's current tier. `currentTier` advances when enough items in the tier below are `automatic` (threshold tunable; see below). A learner who already knows their jamo will clear tier 0 in a session or two because those items hit the fast-correct streak almost immediately.

**Tier advancement (proposed, tunable):** unlock the next tier when, say, ~80% of the current tier's items are `automatic`. Keep earlier tiers in the review pool so they don't decay.

---

## Unit tests (`test/srs.test.ts`)

Cover before building anything on top:

- `qualityFrom`: wrong → 0; correct+slow → 3; correct+fast → 5.
- First correct rep → interval 1; second → 6; third → round(interval × ease).
- Wrong answer → interval resets to 1, ease drops, never below 1.3.
- `fastCorrectStreak` increments on fast-correct, resets on slow or wrong.
- Reaches `automatic` after `AUTOMATIC_STREAK` fast-correct reps.
- `automatic` does not regress on a later wrong/slow answer (but interval resets).
- `bestReactionTimeMs` tracks the minimum across correct reps.
