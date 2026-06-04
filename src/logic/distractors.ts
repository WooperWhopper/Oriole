// Resolves precomputed distractor ids to shuffled option sets at runtime.
import type { ContentItem } from '../types';
import { getItem, getItemsByTier } from '../data/content';

/** Fisher-Yates in-place shuffle. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Returns exactly 4 options: the correct item plus 3 distractors, shuffled.
 * Falls back to nearest same-tier items by order if distractorIds resolve to fewer than 3.
 */
export function getOptions(item: ContentItem): ContentItem[] {
  // Resolve distractors from precomputed ids, excluding the correct item
  const resolved = item.distractorIds
    .map((id) => getItem(id))
    .filter((d): d is ContentItem => d !== undefined && d.id !== item.id)
    .slice(0, 3);

  let distractors = resolved;

  // Fallback: fill remaining slots with nearest same-tier items by order
  if (distractors.length < 3) {
    const usedIds = new Set([item.id, ...distractors.map((d) => d.id)]);
    const fallbacks = getItemsByTier(item.tier)
      .filter((t) => !usedIds.has(t.id))
      .sort((a, b) => Math.abs(a.order - item.order) - Math.abs(b.order - item.order));
    const needed = 3 - distractors.length;
    distractors = [...distractors, ...fallbacks.slice(0, needed)];
  }

  return shuffle([item, ...distractors.slice(0, 3)]);
}
