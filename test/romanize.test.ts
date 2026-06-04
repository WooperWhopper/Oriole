/**
 * Romaniser validation gate — ALL cases must pass before korean.json is generated.
 *
 * Two sets are tested:
 *   1. The required validation set from docs/content-pipeline.md — these are the
 *      hard gate: KOROMAN's known failures are fixed by the correction shim.
 *   2. Regression cases — KOROMAN already passes these; the shim must not break them.
 *
 * Additional cases beyond the 8 required ones are included only where the expected
 * value was verified against Wiktionary or the National Institute of Korean Language's
 * official romanisation (korean.go.kr).  No expected values are invented.
 *
 * Run with:  npx tsx --test test/romanize.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { romanize } from '../scripts/romanize.js';

// ── Gate: required validation set (docs/content-pipeline.md) ─────────────────
// The two marked ★ are KOROMAN failures fixed by the correction shim.
describe('required validation set', () => {
  it('있다 → itta   ★ (post-obstruent tensification after ᆻ cluster)', () => {
    assert.equal(romanize('있다'), 'itta');
  });
  it('국물 → gungmul  (nasal assimilation ᆨ+ᄆ)', () => {
    assert.equal(romanize('국물'), 'gungmul');
  });
  it('같이 → gachi    (palatalization ᆮ+이)', () => {
    assert.equal(romanize('같이'), 'gachi');
  });
  it('신라 → silla    (lateralisation ᆫ+ᄅ)', () => {
    assert.equal(romanize('신라'), 'silla');
  });
  it('학교 → hakgyo', () => {
    assert.equal(romanize('학교'), 'hakgyo');
  });
  it('독립문 → dongnimmun  (nasal assimilation + n-insertion)', () => {
    assert.equal(romanize('독립문'), 'dongnimmun');
  });
  it('좋다 → jota    (aspiration ㅎ+ᄃ)', () => {
    assert.equal(romanize('좋다'), 'jota');
  });
  it('십육 → simnyuk  ★ (Sino-Korean numeral n-insertion)', () => {
    assert.equal(romanize('십육'), 'simnyuk');
  });
});

// ── Regression: shim must not break KOROMAN's already-correct outputs ─────────
describe('regression — no regressions from shim', () => {
  it('국물  still gungmul', () => assert.equal(romanize('국물'), 'gungmul'));
  it('같이  still gachi',   () => assert.equal(romanize('같이'), 'gachi'));
  it('신라  still silla',   () => assert.equal(romanize('신라'), 'silla'));
  it('학교  still hakgyo',  () => assert.equal(romanize('학교'), 'hakgyo'));
  it('독립문 still dongnimmun', () => assert.equal(romanize('독립문'), 'dongnimmun'));
  it('좋다  still jota',    () => assert.equal(romanize('좋다'), 'jota'));
});

// ── Jamo tier: fixed table ─────────────────────────────────────────────────────
// All values are from the official Revised Romanisation standard (NIKL / NRR 2000).
describe('bare jamo — fixed table', () => {
  it('ㄱ → g',   () => assert.equal(romanize('ㄱ'), 'g'));
  it('ㄴ → n',   () => assert.equal(romanize('ㄴ'), 'n'));
  it('ㄷ → d',   () => assert.equal(romanize('ㄷ'), 'd'));
  it('ㄹ → r',   () => assert.equal(romanize('ㄹ'), 'r'));
  it('ㅁ → m',   () => assert.equal(romanize('ㅁ'), 'm'));
  it('ㅂ → b',   () => assert.equal(romanize('ㅂ'), 'b'));
  it('ㅅ → s',   () => assert.equal(romanize('ㅅ'), 's'));
  it('ㅇ → ng',  () => assert.equal(romanize('ㅇ'), 'ng'));
  it('ㅈ → j',   () => assert.equal(romanize('ㅈ'), 'j'));
  it('ㅊ → ch',  () => assert.equal(romanize('ㅊ'), 'ch'));
  it('ㅋ → k',   () => assert.equal(romanize('ㅋ'), 'k'));
  it('ㅌ → t',   () => assert.equal(romanize('ㅌ'), 't'));
  it('ㅍ → p',   () => assert.equal(romanize('ㅍ'), 'p'));
  it('ㅎ → h',   () => assert.equal(romanize('ㅎ'), 'h'));
  it('ㄲ → kk',  () => assert.equal(romanize('ㄲ'), 'kk'));
  it('ㄸ → tt',  () => assert.equal(romanize('ㄸ'), 'tt'));
  it('ㅃ → pp',  () => assert.equal(romanize('ㅃ'), 'pp'));
  it('ㅆ → ss',  () => assert.equal(romanize('ㅆ'), 'ss'));
  it('ㅉ → jj',  () => assert.equal(romanize('ㅉ'), 'jj'));
  it('ㅏ → a',   () => assert.equal(romanize('ㅏ'), 'a'));
  it('ㅓ → eo',  () => assert.equal(romanize('ㅓ'), 'eo'));
  it('ㅗ → o',   () => assert.equal(romanize('ㅗ'), 'o'));
  it('ㅜ → u',   () => assert.equal(romanize('ㅜ'), 'u'));
  it('ㅡ → eu',  () => assert.equal(romanize('ㅡ'), 'eu'));
  it('ㅣ → i',   () => assert.equal(romanize('ㅣ'), 'i'));
  it('ㅐ → ae',  () => assert.equal(romanize('ㅐ'), 'ae'));
  it('ㅔ → e',   () => assert.equal(romanize('ㅔ'), 'e'));
});
