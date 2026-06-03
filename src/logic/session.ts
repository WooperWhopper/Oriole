// Builds the ordered drill queue for a session. See docs/srs.md.
import type { ContentItem } from '../types';

export function buildSessionQueue(_sessionLength: number): ContentItem[] {
  // TODO: pull due SRS items first, then new items from currentTier, capped at sessionLength
  return [];
}
