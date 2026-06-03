// Loads korean.json at startup and exposes read-only indexed getters.
import type { ContentFile, ContentItem, Tier } from '../types';
import raw from '../../assets/content/korean.json';

const data = raw as ContentFile;

const byId = new Map<string, ContentItem>(data.items.map((item) => [item.id, item]));

const byTier = new Map<Tier, ContentItem[]>();
for (const item of data.items) {
  const list = byTier.get(item.tier) ?? [];
  list.push(item);
  byTier.set(item.tier, list);
}

export function getItem(id: string): ContentItem | undefined {
  return byId.get(id);
}

export function getItemsByTier(tier: Tier): ContentItem[] {
  return byTier.get(tier) ?? [];
}

export function getAllItems(): ContentItem[] {
  return data.items;
}
