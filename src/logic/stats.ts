// Aggregates progress for the dashboard. See docs/progress-dashboard.md.
import type {
  ContentItem,
  ItemRecord,
  ProgressMeta,
  SpeedPoint,
  AutomaticByTier,
  Tier,
} from '../types';
import { TIERS } from '../constants/tiers';

const TIER_ADVANCE_THRESHOLD = 0.8;

function localDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Update the streak: increment if consecutive day, reset if gap. */
export function updateStreak(meta: ProgressMeta): ProgressMeta {
  const today = localDateString();
  if (meta.lastActiveDate === today) return meta;
  const yesterday = localDateString(-1);
  const streak =
    meta.lastActiveDate === yesterday ? meta.currentStreakDays + 1 : 1;
  return { ...meta, currentStreakDays: streak, lastActiveDate: today };
}

/** Compute the speed-history point for this session (median correct RT). */
export function computeSessionSpeedPoint(
  correctReactionTimes: number[],
): SpeedPoint | null {
  if (correctReactionTimes.length === 0) return null;
  const sorted = [...correctReactionTimes].sort((a, b) => a - b);
  return { date: localDateString(), medianReactionMs: Math.round(median(sorted)) };
}

/**
 * Recompute per-tier automatic counts from the full record map.
 * Needs getItemById to look up each record's tier.
 */
export function recomputeAutomaticByTier(
  records: Record<string, ItemRecord>,
  getItemById: (id: string) => ContentItem | undefined,
): AutomaticByTier {
  const counts: AutomaticByTier = { jamo: 0, geulja: 0, word: 0, phrase: 0 };
  for (const r of Object.values(records)) {
    if (r.state === 'automatic') {
      const item = getItemById(r.itemId);
      if (item) counts[item.tier]++;
    }
  }
  return counts;
}

/**
 * If ≥80% of the current tier's items are automatic, returns the next tier.
 * Returns null if no advancement should occur.
 */
export function checkTierAdvancement(
  records: Record<string, ItemRecord>,
  allItems: ContentItem[],
  currentTier: Tier,
): Tier | null {
  const nextIdx = TIERS.indexOf(currentTier) + 1;
  if (nextIdx >= TIERS.length) return null;

  const tierItems = allItems.filter((i) => i.tier === currentTier);
  if (tierItems.length === 0) return null;

  const automaticCount = tierItems.filter(
    (i) => records[i.id]?.state === 'automatic',
  ).length;

  return automaticCount / tierItems.length >= TIER_ADVANCE_THRESHOLD
    ? TIERS[nextIdx]
    : null;
}

/** Average medianReactionMs over an array of SpeedPoints. Returns null if empty. */
export function averageSpeedMs(history: SpeedPoint[]): number | null {
  if (history.length === 0) return null;
  return Math.round(
    history.reduce((sum, p) => sum + p.medianReactionMs, 0) / history.length,
  );
}
