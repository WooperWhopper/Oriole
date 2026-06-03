# Architecture Reference

> Read for any code task. Always alongside `CLAUDE.md` and `Oriole_v1_Spec.md`.

---

## Shape of the App

A small React Native / Expo app with a handful of screens and a clean separation between **content** (read-only, bundled), **user progress** (mutable, local), and **logic** (pure where possible). The build-time content pipeline (`scripts/`) is entirely separate from the running app and is covered in `docs/content-pipeline.md`.

### Navigation

Bottom-tab navigation with three primary tabs, plus stacked screens pushed from them:

- **Home** (`HomeScreen`) — the default. Shows the reading-speed headline and streak, and a big "Start session" button. Pushes `DrillScreen`. Offers the `EndgameScreen` when a capstone is available.
- **Progress** (`ProgressScreen`) — the speed curve over time, items reached "automatic" per tier, streak, endgame history. Pushes `WordsCollectionScreen`.
- **(Optional) Settings** — minimal for v1 (sound on/off, session length). Can live as a stack screen rather than a tab.

`DrillScreen`, `EndgameScreen`, and `WordsCollectionScreen` are stack screens, not tabs.

---

## The Three Data Layers

1. **Content (read-only).** `assets/content/korean.json` — every item the app can show (jamo, geulja, words, phrases) with romanisation, optional meaning, precomputed distractors, and (for words) constituent geulja for the introduction view. Loaded once at startup and indexed in memory by `src/data/content.ts`. Never written to at runtime.
2. **User progress (mutable, local).** One `ItemRecord` per item the learner has encountered, plus aggregate progress/stats. Persisted to AsyncStorage via `src/data/profile.ts`. This is the only thing that changes at runtime. (Schemas in `docs/data-models.md`.)
3. **Logic (mostly pure).** `src/logic/` — the SRS scheduler, session-queue builder, drill state machine, distractor selection, and stats aggregation. These take content + progress as inputs and return results; keep them free of UI and storage side-effects where practical so they're unit-testable.

---

## Core Runtime Flow

```
App launch
  └── load korean.json into memory (content.ts)
  └── load user progress from AsyncStorage (profile.ts)
          │
          ▼
Home screen — show speed headline + streak
          │
   "Start session"
          ▼
session.ts builds a drill queue:
   due review items first (from SRS), then new items from the current tier, capped at session length
          ▼
DrillScreen runs the queue via drill.ts (state machine):
   present item → capture answer + reaction time → score (srs.ts) → reveal (romanisation, audio, optional meaning) → next
          │
   (a new word's first encounter is the geulja-by-geulja introduction; see drill-engine.md)
          ▼
Session ends → write updated ItemRecords + stats to AsyncStorage → summary screen
```

Periodically (tier milestone or weekly), the Home screen offers the **endgame capstone** (`EndgameScreen`): read a paragraph by tapping through it, producing a words-per-minute figure on connected text. See `docs/drill-engine.md` (Endgame section).

---

## Module Responsibilities

### `src/data/content.ts`
Loads `assets/content/korean.json` at startup, builds in-memory indexes: by id, by tier, and any lookup the drill needs (e.g. an item's precomputed distractor ids → full items). Exposes read-only getters. No mutation.

### `src/data/profile.ts`
The only module that touches AsyncStorage. Reads/writes `ItemRecord`s and aggregate progress. Exposes:
```
loadProfile()                         // hydrate all records + meta at startup
getRecord(itemId)                     // ItemRecord | null
upsertRecords(records[])              // batch write (end of session)
getMeta() / setMeta(meta)             // streak, speed history, etc.
```
Batch writes at session end rather than per-item to keep things fast.

### `src/logic/session.ts`
Builds the drill queue for a session. Pulls due items from the SRS schedule and new items from the learner's current tier, capped at the configured session length. (Algorithm in `docs/srs.md`.)

### `src/logic/drill.ts`
The drill state machine for a single session: holds the queue, current item, and phase (`presenting → answered → revealing → next`). Records reaction time (timestamp when the item is shown vs. when an option is tapped). Delegates scoring to `srs.ts` and asks `profile.ts` to persist at the end. For a new word, it routes to the introduction flow before the recognition drill (see `docs/drill-engine.md`).

### `src/logic/srs.ts`
The automaticity-tuned spaced-repetition scheduler. Pure functions: given an `ItemRecord` plus `{ correct, reactionTimeMs }`, returns the updated record (state, interval, ease, nextDue). Full spec in `docs/srs.md`.

### `src/logic/distractors.ts`
At runtime, given an item, returns the option set: the correct answer plus its precomputed confusable distractors (resolved from `distractorIds` in the content). Shuffles order. Ensures exactly 4 options. (Distractors are *generated* at build time — see `docs/content-pipeline.md`.)

### `src/logic/stats.ts`
Aggregates progress for the dashboard: median recognition time over time (the hero metric), count of items at `automatic` per tier, streak bookkeeping, endgame WPM history, and the "words you can read" list (derived from word items in `automatic`). See `docs/progress-dashboard.md`.

### `src/audio/speech.ts`
Wraps `expo-speech`. Speaks a Hangul string in Korean (`ko-KR`) at a slightly slowed rate for clarity. See Audio below.

---

## Audio (device TTS)

Audio uses the phone's built-in speech engine via `expo-speech` — no audio files are bundled and nothing is fetched, so it stays offline.

```javascript
import * as Speech from 'expo-speech';

export function speak(hangul) {
  Speech.speak(hangul, { language: 'ko-KR', rate: 0.85 });
}
```

**Korean voice availability:** the device must have a Korean TTS voice installed. On both iOS and Android this is a one-time setup (the OS may need to download the Korean voice once), after which it works offline. The app must handle the case where no Korean voice is present:

- On startup or first audio use, check available voices (`Speech.getAvailableVoicesAsync()`); if none start with `ko`, treat audio as unavailable.
- When audio is unavailable, **don't show a broken speaker button** — hide or disable it and lean on the on-screen romanisation, optionally with a one-time hint pointing the user to their phone's text-to-speech settings to add the Korean voice.
- Never block a drill on audio. Audio is reinforcement, not a gate.

Audio plays in the **reveal** (after the learner answers), pairing the correct sound with the Hangul they just read.

---

## Key Constraints to Never Violate

1. **No network at runtime.** Nothing in `src/` calls out. The romaniser, dictionary, and any translation API live only in `scripts/`.
2. **Content is read-only.** `korean.json` is never written to. User progress is the only mutable data.
3. **Logic stays pure where practical.** `srs.ts`, `session.ts`, `distractors.ts`, `stats.ts` take inputs and return outputs — no UI, no direct storage. This keeps them unit-testable.
4. **`profile.ts` is the sole storage gateway.** No other module reads/writes AsyncStorage.
5. **One mechanic, four tiers.** Don't invent per-tier UIs. The only tier-specific behaviour is the word **introduction** step (`docs/drill-engine.md`); everything else is the shared drill.
6. **Speed is the headline.** Any progress UI leads with recognition speed, not counts of words.
7. **No vocab testing, ever.** Meaning is shown and collected, never quizzed.
