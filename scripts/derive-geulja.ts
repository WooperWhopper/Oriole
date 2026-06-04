/**
 * derive-geulja.ts — extract the most common syllable blocks from the word list.
 *
 * Each word is decomposed into its constituent geulja (individual Korean syllable
 * blocks, each a single Unicode character in U+AC00–U+D7A3).  Geulja are counted
 * weighted by the word's rank: weight = 1 / rank (more-frequent words contribute
 * more).  The top weightedCount unique geulja are returned, sorted descending by
 * weight, plus ALL geulja that appear in the word list (since the word-introduction
 * view needs every geulja from every word to have a valid geulja-tier entry).
 */

export interface NiklWord {
  hangul: string;   // cleaned hangul form (no numeric suffix)
  rank: number;     // corpus frequency rank (lower = more frequent)
  grade: 'A' | 'B' | 'C';
  pos: string;      // part of speech (품사)
}

export interface GeuljaEntry {
  hangul: string;   // the syllable block, e.g. "가"
  weight: number;   // accumulated frequency weight
}

const SYLLABLE_START = 0xac00;
const SYLLABLE_END   = 0xd7a3;

/** True if the character is a Korean syllable block. */
function isHangulSyllable(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= SYLLABLE_START && cp <= SYLLABLE_END;
}

/**
 * Decompose a Korean word into its constituent geulja (syllable blocks).
 * Non-Korean characters are ignored.
 */
export function decomposeToGeulja(word: string): string[] {
  const result: string[] = [];
  for (const ch of word) {
    if (isHangulSyllable(ch)) result.push(ch);
  }
  return result;
}

/**
 * Derive the geulja set from a word list.
 *
 * Guarantees that every geulja appearing in any word is included (needed for the
 * word-introduction view).  Beyond that, fills up to `targetCount` with the
 * highest-weight remaining geulja.
 */
export function deriveGeulja(
  words: NiklWord[],
  targetCount = 500,
): GeuljaEntry[] {
  const weights = new Map<string, number>();

  for (const word of words) {
    const w = word.rank > 0 ? 1 / word.rank : 0.001; // small weight for unranked
    for (const geulja of decomposeToGeulja(word.hangul)) {
      weights.set(geulja, (weights.get(geulja) ?? 0) + w);
    }
  }

  // All entries sorted by weight descending
  const sorted: GeuljaEntry[] = [...weights.entries()]
    .map(([hangul, weight]) => ({ hangul, weight }))
    .sort((a, b) => b.weight - a.weight);

  // Always include all geulja appearing in the word list (for the introduction view)
  const fromWords = new Set(words.flatMap(w => decomposeToGeulja(w.hangul)));

  const result: GeuljaEntry[] = [];
  const seen = new Set<string>();

  // First pass: all geulja from the word list (required)
  for (const entry of sorted) {
    if (fromWords.has(entry.hangul)) {
      result.push(entry);
      seen.add(entry.hangul);
    }
  }

  // Second pass: fill to targetCount with highest-weight remaining geulja
  for (const entry of sorted) {
    if (result.length >= targetCount) break;
    if (!seen.has(entry.hangul)) {
      result.push(entry);
      seen.add(entry.hangul);
    }
  }

  return result;
}
