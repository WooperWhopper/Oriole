// Drill state machine: presenting → answered → revealing → next. See docs/drill-engine.md.
import type { ContentItem, DrillResult } from '../types';

export type DrillPhase = 'presenting' | 'answered' | 'revealing' | 'done';

export interface DrillState {
  queue: ContentItem[];
  currentIndex: number;
  phase: DrillPhase;
  presentedAt: number | null;
  lastResult: DrillResult | null;
}

export function initDrill(queue: ContentItem[]): DrillState {
  return { queue, currentIndex: 0, phase: 'presenting', presentedAt: null, lastResult: null };
}

export function currentItem(state: DrillState): ContentItem | null {
  return state.queue[state.currentIndex] ?? null;
}
