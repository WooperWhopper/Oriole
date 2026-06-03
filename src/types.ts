// Shared TypeScript types — enforced source of truth. Import from here everywhere.

export type Tier = 'jamo' | 'geulja' | 'word' | 'phrase';
export type ItemState = 'new' | 'learning' | 'automatic';

// ── Content (read-only, from korean.json) ───────────────────────────────
export interface Geulja {
  hangul: string;
  romanization: string;
}

export interface ContentItem {
  id: string;
  tier: Tier;
  hangul: string;
  romanization: string;
  meaning: string | null;
  order: number;
  geulja?: Geulja[];
  distractorIds: string[];
}

export interface ContentFile {
  version: string;
  language: 'ko';
  items: ContentItem[];
}

// ── User progress (mutable, AsyncStorage) ───────────────────────────────
export interface ItemRecord {
  itemId: string;
  state: ItemState;
  reps: number;
  correctCount: number;
  incorrectCount: number;
  introduced: boolean;
  lastReactionTimeMs: number | null;
  bestReactionTimeMs: number | null;
  fastCorrectStreak: number;
  interval: number;
  easeFactor: number;
  nextDue: string | null;
  lastSeen: string | null;
}

export interface SpeedPoint {
  date: string;
  medianReactionMs: number;
}

export interface EndgamePoint {
  date: string;
  wpm: number;
  tier: Tier;
}

export type AutomaticByTier = Record<Tier, number>;

export interface ProgressMeta {
  currentStreakDays: number;
  lastActiveDate: string | null;
  sessionsCompleted: number;
  speedHistory: SpeedPoint[];
  endgameHistory: EndgamePoint[];
  automaticByTier: AutomaticByTier;
  currentTier: Tier;
}

export interface Settings {
  soundEnabled: boolean;
  sessionLength: number;
}

// ── Runtime value (not persisted) ───────────────────────────────────────
export interface DrillResult {
  correct: boolean;
  reactionTimeMs: number;
}
