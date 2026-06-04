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
  return {
    queue,
    currentIndex: 0,
    phase: queue.length > 0 ? 'presenting' : 'done',
    presentedAt: null,
    lastResult: null,
  };
}

export function currentItem(state: DrillState): ContentItem | null {
  return state.queue[state.currentIndex] ?? null;
}

export function markPresented(state: DrillState, timestamp: number): DrillState {
  return { ...state, presentedAt: timestamp };
}

/** Transition to answered: compute RT, record result, fire feedback. */
export function recordAnswer(
  state: DrillState,
  correct: boolean,
  tappedAt: number,
): DrillState {
  const reactionTimeMs =
    state.presentedAt !== null ? tappedAt - state.presentedAt : 0;
  return {
    ...state,
    phase: 'answered',
    lastResult: { correct, reactionTimeMs },
  };
}

export function startReveal(state: DrillState): DrillState {
  return { ...state, phase: 'revealing' };
}

/** Advance to the next item, or mark the session done. */
export function advanceDrill(state: DrillState): DrillState {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.queue.length) {
    return { ...state, phase: 'done', currentIndex: nextIndex };
  }
  return {
    ...state,
    currentIndex: nextIndex,
    phase: 'presenting',
    presentedAt: null,
    lastResult: null,
  };
}
