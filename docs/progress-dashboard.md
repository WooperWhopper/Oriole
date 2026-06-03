# Progress & Dashboard

> Read for the Progress screen, the speed curve, streak, the "words you can read" collection, and the session summary.  
> Always alongside `CLAUDE.md` and `docs/data-models.md`.

---

## The hero: reading speed

The dashboard leads with **reading speed**, never a vocabulary count. The point of the app is that the learner is getting *faster*, and the dashboard's job is to make that improvement visible and motivating.

- **Speed curve** (`SpeedChart.tsx`): plot `meta.speedHistory` — median correct-answer reaction time per session (or per day) — trending **down** over time. Down = faster = better; label the axis so that's obvious (e.g. invert it, or annotate "faster ↑").
- **Plain-language headline**: compute from the first vs. most recent points in `speedHistory`, e.g. "You now read common Korean about 2× faster than three weeks ago." This sentence is the emotional core of the screen.

`speedHistory` is appended to at the end of each session in `stats.ts`: take the median `reactionTimeMs` of the session's correct answers and push `{ date, medianReactionMs }`.

---

## Secondary metrics (below the speed curve)

- **Items at `automatic` per tier** — from `meta.automaticByTier`, shown as progress (e.g. "Geulja: 180 automatic"). A sense of territory conquered. Cache this in meta and update at session end; it's derivable from records if ever needed.
- **Streak** — consecutive days with at least one completed session, from `meta.currentStreakDays`.
- **Endgame history** — words-per-minute on connected text over time, from `meta.endgameHistory`. Reinforces the speed story on real text.

---

## "Words you can now read" (`WordsCollectionScreen`)

A passive, browsable collection that makes the **incidentally-learned vocabulary visible** — answering the "am I actually learning?" feeling without ever testing meaning (see `Oriole_v1_Spec.md` §9).

- **Derived, not stored**: filter `ItemRecord`s where `state === 'automatic'` and the item's `tier === 'word'`, then join to content for `hangul`, `romanization`, `meaning`.
- Each entry shows the word, its romanisation, and its meaning. Tapping it can play the audio.
- Optional: a search/filter field; grows naturally as the learner progresses.
- This is read-only celebration, not a study tool — no testing, no SRS interaction here.

---

## Streak logic (`stats.ts`)

```javascript
function updateStreak(meta) {
  const today = localDateString();              // 'YYYY-MM-DD'
  if (meta.lastActiveDate === today) return meta; // already counted today

  const yesterday = localDateString(-1);
  const streak = meta.lastActiveDate === yesterday
    ? meta.currentStreakDays + 1                 // consecutive day
    : 1;                                         // gap → reset

  return { ...meta, currentStreakDays: streak, lastActiveDate: today };
}
```

Call this once when a session completes (at least one answer given).

---

## Session summary (shown when a session ends)

After the drill queue empties, before returning Home, show a brief summary:

- Items reviewed; correct / incorrect counts.
- **Speed this session vs. your average** — the headline of the summary, keeping speed front and centre.
- Items newly reached `automatic` this session (a small win to celebrate).
- Streak after this session.

Then offer "Back to Home." Keep it short and positive; don't audit mistakes.

---

## What `stats.ts` computes vs. what's cached

- **Cached in `meta`** (updated at session end, cheap to read): `speedHistory`, `endgameHistory`, `automaticByTier`, `currentStreakDays`, `lastActiveDate`, `sessionsCompleted`, `currentTier`.
- **Derived on demand** (cheap at this scale): the "words you can read" list, session summary figures.

All reads/writes of `meta` go through `profile.ts` (`docs/architecture.md`); `stats.ts` stays pure (takes records/meta in, returns values out).

---

## Tone

Everything here is encouraging and speed-forward. Lead with "you're getting faster," surface the growing word collection as a bonus, keep streaks light. Never shame a miss, never lead with a raw vocabulary count, never imply the learner is behind.
