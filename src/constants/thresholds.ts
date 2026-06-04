import type { Tier } from '../types';

// Reaction time (ms) under which a correct answer counts toward "automatic."
// Placeholder values — tune from real data near release.
export const AUTOMATIC_THRESHOLD_MS: Record<Tier, number> = {
  jamo: 1200,
  geulja: 1500,
  word: 2500,
  phrase: 4000,
};

// Consecutive fast-correct reps required to reach the "automatic" state. Tunable.
export const AUTOMATIC_STREAK = 3;
