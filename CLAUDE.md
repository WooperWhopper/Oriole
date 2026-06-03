# Oriole — Claude Code Root Context

## What This Project Is

Oriole ("Oriole — Read Korean Faster") is a **mobile app** that trains Korean reading **automaticity**: the shift from sounding out Hangul slowly, syllable by syllable, to recognising it at a glance. The learner already knows the Korean alphabet; the app drills recognition *speed* and *sound*, climbing a staircase of jamo → syllable blocks (geulja) → whole words → short phrases. Meaning and grammar are deliberately not the focus.

The hero metric is **reading speed**, not "words learned." Everything serves that.

**Language (v1):** Korean only. (Future: Japanese kana first; each language gets its own bird.)
**Source of truth:** `Oriole_v1_Spec.md` — the product spec. This doc set is *how to build it*; the spec is *what and why*.

---

## Tech Stack

| Concern | Solution |
|---|---|
| Language | **TypeScript** (strict mode) — types are enforced, so Claude Code makes fewer mistakes and errors surface at compile time, not as runtime crashes |
| Framework | React Native via **Expo** |
| Navigation | React Navigation (bottom tabs + stack) |
| Audio | **expo-speech** — the device's built-in Korean TTS (ko-KR), works offline once the OS Korean voice is installed |
| Local storage | **AsyncStorage** (`@react-native-async-storage/async-storage`) for user progress + settings (small scale; expo-sqlite is the upgrade path if ever needed) |
| Bundled content | Static JSON in `assets/content/`, generated once at build time (see below) |
| Charts | a lightweight RN chart approach (`react-native-svg`, or `react-native-chart-kit`) for the speed curve |
| Romaniser & dictionary | **build-time only** — NOT shipped in the app. Used by `scripts/` to generate content. |
| Unit testing | Jest |

**Runtime principle:** the shipped app makes **no network calls**, needs **no accounts**, and uses **no AI**. Everything runs locally and offline.

---

## File Structure

```
oriole/
├── CLAUDE.md                          ← you are here
├── Oriole_v1_Spec.md                  ← product spec (source of truth)
├── docs/                              ← build specs (read per task — see below)
│   ├── architecture.md
│   ├── data-models.md
│   ├── drill-engine.md
│   ├── srs.md
│   ├── content-pipeline.md
│   └── progress-dashboard.md
├── app.json                           ← Expo config
├── package.json
├── App.tsx                             ← entry point, navigation root
├── assets/
│   └── content/
│       └── korean.json                ← bundled content (jamo, geulja, words, phrases). Read-only at runtime.
├── scripts/                           ← BUILD-TIME content pipeline. NOT shipped in the app.
│   ├── build-content.ts               ← orchestrator: list → derive → romanise → meanings → write korean.json
│   ├── derive-geulja.ts               ← extract common syllable blocks from the word list
│   ├── romanize.ts                    ← rule-applying romaniser wrapper
│   ├── fetch-meanings.ts              ← free dictionary lookup (optional Papago cross-check)
│   └── build-distractors.ts           ← precompute confusable distractors per item
├── src/
│   ├── types.ts                       ← shared TypeScript types (the enforced source of truth; see docs/data-models.md)
│   ├── screens/
│   │   ├── HomeScreen.tsx              ← start a session, see streak + speed headline
│   │   ├── DrillScreen.tsx             ← the core drill loop
│   │   ├── EndgameScreen.tsx           ← paragraph capstone (tap-through WPM)
│   │   ├── ProgressScreen.tsx          ← speed curve, items automatic, stats
│   │   └── WordsCollectionScreen.tsx   ← "words you can now read"
│   ├── components/
│   │   ├── DrillCard.tsx               ← presents one item + options
│   │   ├── WordIntroduction.tsx        ← the geulja-by-geulja decomposition view (new words)
│   │   ├── OptionButton.tsx
│   │   ├── Feedback.tsx                ← correct/incorrect flash + sound
│   │   └── SpeedChart.tsx
│   ├── logic/
│   │   ├── srs.ts                     ← automaticity-tuned scheduler (see docs/srs.md)
│   │   ├── session.ts                 ← builds the per-session drill queue
│   │   ├── drill.ts                   ← drill state machine (present → answer → score → reveal → next)
│   │   ├── distractors.ts             ← select precomputed distractors for an item at runtime
│   │   └── stats.ts                   ← reading-speed metric, streak, progress aggregates
│   ├── data/
│   │   ├── content.ts                 ← loads + indexes bundled korean.json
│   │   └── profile.ts                 ← read/write user progress (AsyncStorage)
│   ├── constants/
│   │   ├── tiers.ts                   ← tier enum + order
│   │   └── thresholds.ts              ← per-tier speed thresholds (tunable)
│   └── audio/
│       └── speech.ts                  ← expo-speech wrapper, ko-KR, graceful fallback if no voice
└── test/
    ├── srs.test.ts
    └── distractors.test.ts
```

---

## Which Docs to Read Per Task

Always read `CLAUDE.md` (this file) and skim `Oriole_v1_Spec.md` first. Then read only what the task needs:

| Task | Read these |
|---|---|
| Any code task | `docs/architecture.md` |
| The drill loop / word two-step / feedback / options | `docs/drill-engine.md` + `docs/data-models.md` |
| Spaced repetition / scheduling / speed scoring | `docs/srs.md` + `docs/data-models.md` |
| Generating the content (build scripts) | `docs/content-pipeline.md` + `docs/data-models.md` |
| Progress screen / speed curve / streak / collection | `docs/progress-dashboard.md` + `docs/data-models.md` |
| Data shapes / storage / content JSON schema | `docs/data-models.md` |
| Audio / speech | `docs/architecture.md` (Audio section) |

---

## Core Principles

- **TypeScript, strict mode.** All shared data shapes live as types in `src/types.ts` and are imported everywhere — the schemas in `docs/data-models.md` are *enforced*, not just documented. Prefer fixing type errors over loosening types (`any` is a last resort).
- **Offline, local, free, no accounts, no AI at runtime.** The shipped app never calls the network. Content is prepared at build time and baked in.
- **Speed is the hero metric.** Lead with reading speed / recognition time, never a vocabulary count.
- **One drill mechanic across all tiers.** A word, however, uses a **two-step** flow: a geulja-by-geulja *introduction* the first time, then **whole-word recognition** thereafter. "Automatic" for a word means fast recognition of the *whole word*, not its pieces. (See `docs/drill-engine.md`.)
- **Vocabulary is incidental.** Meaning is shown in the reveal and surfaced in a "words you can read" collection, but **never tested**. Do not build vocab-testing.
- **Content prep is build-time only.** The romaniser, dictionary, and any API live in `scripts/`, never in `src/`. Nothing the user does touches them.
- **Respect the scope fence** in `Oriole_v1_Spec.md` §11 — no handwriting, no jamo instruction, no listening, no reading-assistant, no multi-language abstractions yet.
