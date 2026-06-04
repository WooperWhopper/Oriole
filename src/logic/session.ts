// Builds the ordered drill queue for a session. See docs/srs.md.
import type { ContentItem, ItemRecord, Tier } from '../types';

/**
 * Returns the session queue: due review items first (oldest-due first),
 * then new items from currentTier in order, capped at sessionLength.
 */
export function buildSessionQueue(
  records: Record<string, ItemRecord>,
  content: ContentItem[],
  currentTier: Tier,
  sessionLength: number,
): ContentItem[] {
  const now = Date.now();

  const contentById = new Map<string, ContentItem>(
    content.map((item) => [item.id, item]),
  );

  // Due review items: have a record with nextDue <= now, sorted oldest-due first
  const dueItems = Object.values(records)
    .filter((r) => r.nextDue !== null && new Date(r.nextDue).getTime() <= now)
    .sort((a, b) => new Date(a.nextDue!).getTime() - new Date(b.nextDue!).getTime())
    .map((r) => contentById.get(r.itemId))
    .filter((item): item is ContentItem => item !== undefined);

  const dueIds = new Set(dueItems.map((item) => item.id));

  // New items: currentTier, no record or state 'new', not already due, ascending order
  const newItems = content
    .filter(
      (item) =>
        item.tier === currentTier &&
        !dueIds.has(item.id) &&
        (!(item.id in records) || records[item.id].state === 'new'),
    )
    .sort((a, b) => a.order - b.order);

  return [...dueItems, ...newItems].slice(0, sessionLength);
}
