/**
 * romanize.ts — build-time romanisation wrapper
 *
 * Wraps KOROMAN (v1.0.16, MIT) with:
 *  1. A fixed jamo → romanisation table for bare jamo (KOROMAN is syllable-block only).
 *  2. An explicit corrections map for the two known KOROMAN failures confirmed by
 *     live testing against the authoritative validation set (see test/romanize.test.ts):
 *       - 있다 → itta  (post-obstruent tensification after ᆻ cluster simplification)
 *       - 십육 → simnyuk (Sino-Korean numeral n-insertion, confirmed by Wiktionary)
 *
 * KOROMAN is called with usePronunciationRules: true (the default) and casingOption:
 * 'lowercase'. The corrections map is registered as the module-level custom dictionary
 * so it takes priority and is applied before any pronunciation rules.
 *
 * This file is BUILD-TIME ONLY.  It is never imported by src/.
 */

import { romanize as _koromanRomanize, setCustomDictionary } from 'koroman';

// ── Corrections map ───────────────────────────────────────────────────────────
// Each entry was verified against an authoritative source before being added.
// Source column:
//   W = Wiktionary (https://en.wiktionary.org/wiki/<word>)
//   T = live test result (see test/romanize.test.ts)
const CORRECTIONS: Record<string, string> = {
  '있다': 'itta',    // T: KOROMAN→itda; W+standard: itta (POT after ᆻ cluster simplification)
  '십육': 'simnyuk', // T: KOROMAN→sibyuk; W: simnyuk (Sino-Korean numeral n-insertion)
};

// Register corrections as KOROMAN's module-level custom dictionary.
// KOROMAN applies these before pronunciation rules; exact-match, longest-first.
setCustomDictionary(CORRECTIONS);

// ── Jamo romanisation table ────────────────────────────────────────────────────
// Revised Romanisation initial-position values (the learner-relevant sound).
// ㅇ → "ng" because the learner needs to know its sound as a final consonant;
// the silent initial ㅇ is a writing convention, not a sound to learn.
export const JAMO_ROMAN: Record<string, string> = {
  // Basic consonants
  'ㄱ': 'g',  'ㄴ': 'n',  'ㄷ': 'd',  'ㄹ': 'r',  'ㅁ': 'm',
  'ㅂ': 'b',  'ㅅ': 's',  'ㅇ': 'ng', 'ㅈ': 'j',  'ㅊ': 'ch',
  'ㅋ': 'k',  'ㅌ': 't',  'ㅍ': 'p',  'ㅎ': 'h',
  // Tense consonants
  'ㄲ': 'kk', 'ㄸ': 'tt', 'ㅃ': 'pp', 'ㅆ': 'ss', 'ㅉ': 'jj',
  // Basic vowels
  'ㅏ': 'a',   'ㅑ': 'ya',  'ㅓ': 'eo',  'ㅕ': 'yeo', 'ㅗ': 'o',
  'ㅛ': 'yo',  'ㅜ': 'u',   'ㅠ': 'yu',  'ㅡ': 'eu',  'ㅣ': 'i',
  // Compound vowels
  'ㅐ': 'ae',  'ㅒ': 'yae', 'ㅔ': 'e',   'ㅖ': 'ye',
  'ㅘ': 'wa',  'ㅙ': 'wae', 'ㅚ': 'oe',
  'ㅝ': 'wo',  'ㅞ': 'we',  'ㅟ': 'wi',  'ㅢ': 'ui',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if every codepoint in the string is in the Hangul Compatibility Jamo block. */
function isBareJamo(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    // Hangul Compatibility Jamo: U+3131–U+318E
    if (cp < 0x3131 || cp > 0x318e) return false;
  }
  return true;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Romanise a Korean string (syllable block, word, phrase, or bare jamo).
 * Returns pronunciation-based Revised Romanisation, lowercase.
 */
export function romanize(hangul: string): string {
  if (!hangul) return '';

  // Bare jamo (e.g. ㄱ, ㅏ) — KOROMAN doesn't handle these
  if (isBareJamo(hangul)) {
    return JAMO_ROMAN[hangul] ?? hangul;
  }

  // Syllable blocks and words — KOROMAN with corrections pre-registered
  return _koromanRomanize(hangul, {
    usePronunciationRules: true,
    casingOption: 'lowercase',
  });
}
