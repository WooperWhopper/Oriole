// Automaticity-tuned spaced-repetition scheduler. See docs/srs.md.
import type { ItemRecord, DrillResult } from '../types';
import { AUTOMATIC_STREAK } from '../constants/thresholds';

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

/** Maps a drill result to an SM-2 quality score: 0 (wrong), 3 (correct-slow), 5 (correct-fast). */
export function qualityFrom(
  correct: boolean,
  reactionTimeMs: number,
  thresholdMs: number,
): 0 | 3 | 5 {
  if (!correct) return 0;
  if (reactionTimeMs < thresholdMs) return 5;
  return 3;
}

/**
 * Returns an updated ItemRecord after a single recognition rep.
 * Pure — takes existing record + result and returns new record; no side effects.
 */
export function reviewItem(
  record: ItemRecord,
  result: DrillResult,
  thresholdMs: number,
): ItemRecord {
  const { correct, reactionTimeMs } = result;
  const q = qualityFrom(correct, reactionTimeMs, thresholdMs);

  const { interval, easeFactor, fastCorrectStreak } = record;
  const fast = correct && reactionTimeMs < thresholdMs;

  // SM-2 interval + ease
  let newInterval: number;
  let newEase: number;
  if (q >= 3) {
    newInterval =
      interval === 0 ? 1 : interval === 1 ? 6 : Math.round(interval * easeFactor);
    newEase = Math.max(
      MIN_EASE,
      easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
    );
  } else {
    newInterval = 1;
    newEase = Math.max(MIN_EASE, easeFactor - 0.2);
  }

  // Speed streak — the gate to "automatic"
  const newStreak = fast ? fastCorrectStreak + 1 : 0;

  // State: milestones never regress; a miss just resets interval + streak so it resurfaces sooner
  let state = record.state;
  if (state !== 'automatic') {
    state = newStreak >= AUTOMATIC_STREAK ? 'automatic' : 'learning';
  }

  const now = new Date();
  const nextDue = new Date(now);
  nextDue.setDate(nextDue.getDate() + newInterval);

  return {
    ...record,
    state,
    reps: record.reps + 1,
    correctCount: record.correctCount + (correct ? 1 : 0),
    incorrectCount: record.incorrectCount + (correct ? 0 : 1),
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
