// Resolves precomputed distractor ids to shuffled option sets at runtime.
import type { ContentItem } from '../types';
import { getItem } from '../data/content';

export function getOptions(item: ContentItem): ContentItem[] {
  // TODO: resolve distractorIds, shuffle, return exactly 4 options including correct
  const distractors = item.distractorIds
    .map((id) => getItem(id))
    .filter((d): d is ContentItem => d !== undefined)
    .slice(0, 3);
  return [item, ...distractors];
}
