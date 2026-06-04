/**
 * build-distractors.ts — precompute confusable distractors via jamo-level edit distance.
 *
 * Algorithm (per docs/content-pipeline.md):
 *   For each target item within its tier:
 *     1. Decompose target.hangul into a flat jamo sequence.
 *     2. For every other item in the same tier: compute Levenshtein edit distance
 *        on the jamo sequences.
 *     3. Sort ascending by distance; take the top 3 ids (smallest edit distance
 *        = most confusable).
 *     4. Guarantee: not the target itself; ids exist; exactly 3.
 *
 * Jamo tier special case:
 *   Bare jamo are single characters with no sub-components, so Levenshtein distance
 *   is always ≥ 1 for different items.  We impose the same-category constraint
 *   (consonant stays with consonants, vowel with vowels) to prevent showing a
 *   consonant as a distractor for a vowel question.  Within each category we rank
 *   by Unicode code point distance, which roughly reflects phonological proximity
 *   in the Korean jamo Unicode block (tense/aspirate variants of a consonant are
 *   adjacent in code point order).
 */

import type { ContentItem } from '../src/types.js';

// ── Korean syllable decomposition ─────────────────────────────────────────────

const INITIAL_CONSONANTS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS             = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
// Index 0 = no final consonant; indices 1-27 = the 27 possible batchim
const FINAL_CONSONANTS   = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

/** Decompose a Korean string into a flat array of jamo strings. */
function toJamo(text: string): string[] {
  const result: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0xac00 && cp <= 0xd7a3) {
      const offset = cp - 0xac00;
      const initIdx  = Math.floor(offset / (21 * 28));
      const vowelIdx = Math.floor((offset % (21 * 28)) / 28);
      const finalIdx = offset % 28;
      result.push(INITIAL_CONSONANTS[initIdx]!);
      result.push(VOWELS[vowelIdx]!);
      if (finalIdx > 0) result.push(FINAL_CONSONANTS[finalIdx]!);
    } else if (cp >= 0x3131 && cp <= 0x318e) {
      // Bare jamo (Hangul Compatibility Jamo block)
      result.push(ch);
    }
    // Non-Korean characters are skipped
  }
  return result;
}

// ── Levenshtein edit distance ─────────────────────────────────────────────────

function editDistance(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  // Single-row DP to save memory
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = new Array<number>(n + 1);
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]!;
      } else {
        curr[j] = 1 + Math.min(prev[j]!, curr[j - 1]!, prev[j - 1]!);
      }
    }
    prev = curr;
  }
  return prev[n]!;
}

// ── Jamo-tier category helpers ────────────────────────────────────────────────
// Hangul Compatibility Jamo block: U+3131–U+314E = consonants, U+314F–U+3163 = vowels

function jamoCategory(ch: string): 'consonant' | 'vowel' | 'other' {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp >= 0x3131 && cp <= 0x314e) return 'consonant';
  if (cp >= 0x314f && cp <= 0x3163) return 'vowel';
  return 'other';
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * For each item, find the 3 most confusable items in the same tier and set
 * `item.distractorIds`.  Mutates the items array in-place.
 */
export function buildDistractors(items: ContentItem[]): void {
  // Group by tier
  const byTier = new Map<string, ContentItem[]>();
  for (const item of items) {
    const list = byTier.get(item.tier) ?? [];
    list.push(item);
    byTier.set(item.tier, list);
  }

  for (const [tier, tierItems] of byTier) {
    if (tier === 'jamo') {
      assignJamoDistractors(tierItems);
    } else {
      assignLevenshteinDistractors(tierItems);
    }
  }
}

/** Jamo tier: same-category constraint + Unicode code point proximity. */
function assignJamoDistractors(items: ContentItem[]): void {
  for (const target of items) {
    const cat = jamoCategory(target.hangul);
    const candidates = items.filter(
      it => it.id !== target.id && jamoCategory(it.hangul) === cat,
    );

    // Sort by Unicode code point distance (roughly phonological proximity)
    const targetCp = target.hangul.codePointAt(0) ?? 0;
    candidates.sort((a, b) => {
      const da = Math.abs((a.hangul.codePointAt(0) ?? 0) - targetCp);
      const db = Math.abs((b.hangul.codePointAt(0) ?? 0) - targetCp);
      return da - db;
    });

    // Need exactly 3; if same category doesn't have 3 (shouldn't happen with 40 jamo),
    // fall back to items of any category.
    const pool = candidates.length >= 3
      ? candidates
      : items.filter(it => it.id !== target.id);

    target.distractorIds = pool.slice(0, 3).map(it => it.id);
  }
}

/** Geulja / word / phrase tiers: jamo-level Levenshtein distance. */
function assignLevenshteinDistractors(items: ContentItem[]): void {
  // Pre-compute jamo decompositions
  const jamoCache = new Map<string, string[]>(
    items.map(it => [it.id, toJamo(it.hangul)]),
  );

  for (const target of items) {
    const targetJamo = jamoCache.get(target.id)!;

    const scored = items
      .filter(it => it.id !== target.id)
      .map(it => ({
        id: it.id,
        dist: editDistance(targetJamo, jamoCache.get(it.id)!),
      }))
      .sort((a, b) => a.dist - b.dist);

    target.distractorIds = scored.slice(0, 3).map(s => s.id);
  }
}
