# Oriole — v1 Product Spec

**Korean Reading-Automaticity Trainer**
*(Brand name provisional. "Oriole" with a per-language bird identity; Korean is the first bird.)*

---

## 1. What it is, and who it's for

A mobile app that takes a learner who already knows the Korean alphabet but reads it **slowly** — decoding syllable by syllable — and trains them to recognise Hangul at natural speed. The skill being trained is **automaticity**: the shift from effortful, conscious decoding to instant recognition. Meaning and grammar are deliberately *not* the focus; this is about reading speed and sound recognition.

**Target user:** the post-jamo, pre-fluent Korean learner — someone who has finished a "learn Hangul" app and hit the wall where they can sound out letters but can't read words fluently. This is an underserved gap; almost every tool stops at teaching the alphabet.

**Core promise:** "You'll go from sounding out Korean letter by letter to reading it at a glance — and you'll see your speed climb."

---

## 2. The core loop — the drill

The universal mechanic, used at every tier:

1. A Hangul unit appears on screen (a jamo, a geulja, a word, or a short phrase).
2. The learner taps the matching sound from **4 romanisation options**.
3. Instant feedback — a sound effect and a screen flash signal correct or incorrect.
4. A brief **reveal**: romanisation, **audio** (ko-KR TTS), and — as an optional, untested extra — the English meaning.
5. The next unit appears.

**Stimulus is always Hangul; the answer space is sound (romanisation).** This trains the reading direction (script → sound), which is the goal. Romanisation never appears in the prompt — only in the reveal — so it can't give the answer away.

### Introducing a new word — the two-step word tier

By the time a learner reaches the word tier, they have already drilled the constituent geulja on the rung below. A word should therefore be the *next* challenge — recognising it as a whole — not a rerun of geulja decoding. So words work in two phases:

- **Introduction (scaffold).** A word new to the learner is shown decomposed. The active geulja is highlighted; each correct geulja turns **green** with its romanisation fading in beneath it; upcoming geulja are **greyed**. The learner works through the blocks one at a time. This bridges cleanly from the geulja tier.
- **Automatisation (the real skill).** Once introduced, the word is drilled as a **whole unit** — the full word shown, confusable whole-word options — and only reaches "automatic" on fast recognition of the *whole word*. This trains reading the word as a single shape, which is the actual target and the thing that separates fluent reading from sequential decoding.

Phrases (tier 3) extend whole-unit recognition: the phrase is shown and recognised at speed.

**Why multiple choice (not typing or self-rating):** typing romanisation makes typing speed the bottleneck instead of reading speed, corrupting the metric. Self-rating is subjective and unmeasurable. Multiple choice is fast, objective, mobile-native, and yields reaction-time data.

---

## 3. Distractors (what makes the multiple choice real)

The wrong options are **confusable near-misses**, not random items, so answering requires genuine discrimination rather than elimination — and so a learner can't coast by recognising only one part of a unit.

**Auto-generation (AI-free):** decompose each unit into jamo, then select distractors with the smallest jamo-level edit distance from the target — items sharing an initial, medial, or final, or differing by one component. For the geulja 정, that yields options like 종 / 전 / 점; for the jamo ㅈ, sound-adjacent jamo; for whole words, confusable whole-word readings (정원 against 장원 / 정문 / 청원). Generated once at build time from the content lists; no per-item hand-authoring.

**Option count: 4 at every tier.** More options lower the guess rate but add scanning time to the reaction-time measurement (our hero metric); four is the balance point. Tunable later from real data.

---

## 4. Scoring and the hero metric

Every response yields `{ correct: bool, reactionTimeMs: int }`.

- **Automatic** = correct **and** under a per-tier speed threshold (thresholds to be set from real data; faster for jamo, longer for words/phrases). At the word tier, "automatic" means fast recognition of the **whole word**, not of its individual geulja.
- Correct-but-slow = recognised, not yet automatic → resurfaces sooner.
- Incorrect → resurfaces very soon, progress drops.

**The headline number is reading speed, not "words learned."** This is the differentiator — every competitor shows a vocabulary count; we show the skill itself. The dashboard leads with **median recognition time trending down over time** and **count of items at "automatic" level**, framed motivationally ("you're recognising common geulja ~40% faster than your first week"). Streak and daily-minutes are secondary.

---

## 5. The automaticity SRS

Spaced repetition tuned for *speed*, not just recall. Mechanically SM-2-like, but the per-rep quality score folds in reaction time:

- Fast + correct → high quality → interval expands (you won't see it for a while).
- Slow + correct → medium quality → shorter interval (comes back to build speed).
- Incorrect → low quality → interval resets, item resurfaces quickly.

Each item moves through `new → learning → automatic`, with `automatic` items reviewed rarely to confirm retention. The scheduler always interleaves due review items with new items from the current tier.

*(Implementation detail — exact quality formula, intervals, ease factors — to be specified in the build docs, adapting the SM-2 work already drafted.)*

---

## 6. Content staircase

One mechanic, four tiers, increasing unit size. The learner climbs as items reach `automatic`; the SRS keeps earlier tiers fresh. (Words use the two-step introduction → whole-word recognition flow described in §2.)

| Tier | Content | v1 volume (proposed) |
|---|---|---|
| 0 — Jamo | Individual consonants & vowels | Full set (~40) |
| 1 — Geulja | High-frequency syllable blocks | Most frequent ~300–500 |
| 2 — Words | High-frequency whole words, read as units | Top ~500–1,000 by frequency |
| 3 — Phrases | Common short phrases / collocations, read at speed | ~100–150 |

**Content requirement is small and clean:** frequency-ordered lists of jamo, geulja, words, and phrases, each with romanisation and (optional) meaning. **No translation dictionary needed** — meaning is a bonus reveal, not a tested field — which sidesteps dictionary-licensing entirely for v1. Audio is ko-KR TTS to start, with native recordings as a later upgrade.

---

## 7. Session & progression structure

- **5-minute sessions** by default — short, repeatable, mobile-native, habit-forming.
- A session is a queue built by the SRS: due review items first, then new items from the learner's current tier, capped at a session length.
- Tiers unlock as the learner accumulates `automatic` items in the tier below (threshold tunable). A learner who already knows jamo cold will clear tier 0 in one or two sessions.
- Natural session end with a summary: items seen, accuracy, **speed this session vs. your average**, items newly reached `automatic`.

### Endgame test (periodic capstone)

A milestone assessment, not a daily drill — unlocked at the end of a tier or offered as a weekly "fluency check." The learner reads a **larger body of connected text** (up to a full paragraph) to test endurance, accuracy, and speed together. Measured by **tapping through the text as you read** to produce a real **words-per-minute** figure on connected text — no speech recognition required. This is the most tangible proof of progress (you can *see* you can now read a real paragraph) and a natural preview of stage two. *(Open question for later: whether to attach a light "gist" comprehension check so people read rather than tap-race — lean is minimal or none for v1.)*

---

## 8. Progress dashboard

The motivational core of the app. Shows:

- **Reading-speed curve** over time (median recognition time, trending down) — the hero visual.
- **Items at `automatic`** per tier (a sense of territory conquered).
- **Endgame results** — words-per-minute on connected text over time.
- **"Words you can now read"** — a passive, browsable collection of the words the learner has taken to `automatic`, with meanings. This surfaces the vocabulary picked up *incidentally* (see §9), so the learner can see and feel it accumulating — without us ever testing it.
- **Streak** and minutes practised.
- A plain-language headline: e.g. "You now read common Korean ~2× faster than three weeks ago."

---

## 9. Vocabulary — incidental, surfaced, never tested

Vocabulary is not the product's purpose and we hold that line, because competing on vocab means entering a crowded, SRS-saturated field and forfeiting the reading-speed wedge that nobody else owns. But we address the *feeling* of "am I actually learning?" three ways, none of which add a vocab-testing system:

1. **Meaning in the reveal** — every rep is a moment of passive exposure.
2. **High-frequency exposure** — because we drill the most common words, learners are repeatedly hammered with exactly the most useful vocabulary, with meaning shown each time, so they genuinely absorb a lot of it incidentally.
3. **The "words you can read" collection** (§8) — makes that incidental gain visible and tangible.

The honest framing throughout: fast reading is the *foundation* that makes vocabulary stick. Vocabulary is a welcome side effect, surfaced lightly; it is never the tested core.

---

## 10. Brand, platform, technical notes

- **Brand:** Oriole (provisional), built on a per-language bird identity with plumage drawn from the country's flag — Korean is the first bird (red / white / blue / black). The bird system gives users ownership and gives future languages a built-in launch ritual.
- **Platform:** mobile app on React Native / Expo (the existing stack).
- **Principles:** free, offline, local, no AI, no accounts required for core use. Nothing the learner does leaves the device.

---

## 11. Explicitly out of scope for v1 (the fence)

Kept here on purpose, so they stop leaking into the build:

- **Handwriting / drawing recognition** — off-mission (production, not reading speed) and a technical rabbit hole. Cut.
- **Jamo *instruction*** — we don't teach the alphabet; jamo appears only as tier 0 of the speed drill.
- **Listening / speech segmentation** — a possible future *sibling* product, not part of this one.
- **The mixed-language reading assistant** (the original Oriole extension) — this is the graduation destination, **stage two**, not v1.
- **Vocabulary as a tested skill** — surfaced via reveal and the collection only (see §9).
- **Multiple languages** — Korean only. Keep the content layer separable so a second script (Japanese kana is the natural next) isn't a rewrite, but build no multi-language abstractions yet.
- **Speech-recognition pronunciation scoring** — deferred; v1 uses model audio + the learner's own ear.

---

## 12. Roadmap / north star (vision, not build plan)

The unifying thesis across the whole family is **automaticity** — closing the gap between "I studied it" and "I process it in real time."

- **Stage 1 (this spec):** Korean reading-automaticity trainer — jamo → geulja → words → phrases, at speed, with an endgame paragraph capstone.
- **Stage 2:** the reading assistant for authentic web content (the original Oriole concept) — where fluent readers graduate to real material. This also answers the trainer's one structural weakness: users who outgrow the trainer move *up* into stage two rather than leaving.
- **Later / sibling family:** a listening-segmentation trainer (harder — needs real audio + alignment, possibly AI); additional scripts, each earning its own bird (Japanese kana first).

Build the staircase one step at a time, sequenced by buildability and wedge-sharpness — not by excitement.
