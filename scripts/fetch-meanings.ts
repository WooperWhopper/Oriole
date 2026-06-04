/**
 * fetch-meanings.ts — kengdic TSV lookup (build-time only)
 *
 * Loads kengdic.tsv (Joe Speigle, MPL-2.0/LGPL), builds a Map keyed on the
 * Korean surface form, and returns the English gloss for a word.
 * Returns null if the word is not found.
 *
 * kengdic columns (TSV, UTF-8):
 *   id | surface | hanja | gloss | level | created | source
 *
 * Strategy: multiple entries may share the same surface form (homonyms).
 * We take the first (lowest id) entry, which in kengdic reflects the most
 * common/primary sense of a word.  Gloss is trimmed; empty string → null.
 */

import fs from 'node:fs';
import path from 'node:path';

let glossMap: Map<string, string> | null = null;

function ensureLoaded(tsvPath: string): Map<string, string> {
  if (glossMap) return glossMap;

  const raw = fs.readFileSync(tsvPath, { encoding: 'utf8' });
  const lines = raw.split('\n');
  glossMap = new Map<string, string>();

  for (const line of lines.slice(1)) { // skip header
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 4) continue;
    const surface = cols[1]?.trim();
    const gloss   = cols[3]?.trim();
    if (!surface || !gloss) continue;
    // Keep first occurrence only (lowest id = most primary sense)
    if (!glossMap.has(surface)) {
      glossMap.set(surface, gloss);
    }
  }

  return glossMap;
}

/**
 * Look up the English gloss for a Korean word.
 * @param hangul  The Korean word (exact surface form, e.g. "가족")
 * @param tsvPath Path to kengdic.tsv (default: scripts/sources/kengdic.tsv)
 */
export function lookupMeaning(
  hangul: string,
  tsvPath = path.resolve('scripts/sources/kengdic.tsv'),
): string | null {
  const map = ensureLoaded(tsvPath);
  return map.get(hangul) ?? null;
}

/** Returns the number of entries loaded (useful for logging). */
export function kengdicSize(tsvPath = path.resolve('scripts/sources/kengdic.tsv')): number {
  return ensureLoaded(tsvPath).size;
}
