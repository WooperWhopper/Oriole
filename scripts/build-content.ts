/**
 * build-content.ts — orchestrates the full content pipeline and writes korean.json.
 *
 * Sources (all in scripts/sources/, not committed):
 *   nikl_vocab.xls  — NIKL 한국어 학습용 어휘 목록 (KOGL Type 1, attribution required)
 *   kengdic.tsv     — kengdic Korean–English dictionary (MPL-2.0 / LGPL)
 *
 * Run with:  npm run build:content
 *
 * OUTPUT: assets/content/korean.json  (ContentFile shape, src/types.ts)
 *
 * ── Phrase tier note ──────────────────────────────────────────────────────────
 * NIKL is a word list, not a phrase list.  The ~12 phrases below are a PROVISIONAL
 * set drafted from standard Korean learner resources.  They are NOT native-speaker
 * validated.  Before shipping, a native speaker MUST review and approve (or replace)
 * every phrase, its romanisation, and its English gloss.  They are flagged with
 * the literal string "PROVISIONAL" in the source code and in the JSON meaning field.
 */

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import type { ContentFile, ContentItem, Geulja } from '../src/types.js';
import { romanize } from './romanize.js';
import { deriveGeulja, decomposeToGeulja, type NiklWord } from './derive-geulja.js';
import { lookupMeaning, kengdicSize } from './fetch-meanings.js';
import { buildDistractors } from './build-distractors.js';

const SOURCES    = path.resolve('scripts/sources');
const NIKL_PATH  = path.join(SOURCES, 'nikl_vocab.xls');
const OUTPUT     = path.resolve('assets/content/korean.json');

// ── 1. Load and clean the NIKL word list ─────────────────────────────────────

function loadNIKL(): NiklWord[] {
  const wb = XLSX.readFile(NIKL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];

  const seen = new Map<string, NiklWord>(); // deduplicate by cleaned hangul

  for (const row of rows.slice(1)) {
    const rawWord = String((row as unknown[])[1] ?? '').trim();
    const pos     = String((row as unknown[])[2] ?? '').trim();
    const grade   = String((row as unknown[])[4] ?? '').trim() as 'A' | 'B' | 'C';
    const rawRank = Number((row as unknown[])[0]) || 0;

    if (!rawWord || !['A', 'B', 'C'].includes(grade)) continue;

    // Strip numeric disambiguation suffix (e.g. "있다01" → "있다", "가구03" → "가구")
    const hangul = rawWord.replace(/\d+$/, '').trim();
    if (!hangul) continue;

    // Skip words containing spaces (multi-word entries, not suitable for word tier)
    if (hangul.includes(' ')) continue;

    // Keep only pure Korean (no Latin / Arabic / etc.)
    if (!/^[가-힣ㄱ-ㅣ]+$/.test(hangul)) continue;

    // Deduplicate: keep the entry with the lowest rank (most frequent)
    const existing = seen.get(hangul);
    if (!existing || (rawRank > 0 && (existing.rank === 0 || rawRank < existing.rank))) {
      seen.set(hangul, { hangul, rank: rawRank, grade, pos });
    }
  }

  return [...seen.values()];
}

/** Select ~1000 words: all grade A, then grade B in rank order, trimmed to 1000. */
function selectWords(words: NiklWord[], limit = 1000): NiklWord[] {
  // Sort: A first, then B, then by rank (0-rank = proper nouns, pushed to end)
  const gradeOrder: Record<string, number> = { A: 0, B: 1, C: 2 };
  const sorted = [...words].sort((a, b) => {
    const gd = (gradeOrder[a.grade] ?? 2) - (gradeOrder[b.grade] ?? 2);
    if (gd !== 0) return gd;
    // Within grade: ranked words first (ascending rank), then unranked
    if (a.rank === 0 && b.rank === 0) return 0;
    if (a.rank === 0) return 1;
    if (b.rank === 0) return -1;
    return a.rank - b.rank;
  });
  return sorted.filter(w => w.grade === 'A' || w.grade === 'B').slice(0, limit);
}

// ── 2. Jamo set (fixed, ~40 items) ───────────────────────────────────────────

interface JamoSpec { hangul: string; meaning: string | null }

const JAMO_SET: JamoSpec[] = [
  // Basic consonants
  { hangul: 'ㄱ', meaning: 'consonant g/k' }, { hangul: 'ㄴ', meaning: 'consonant n'   },
  { hangul: 'ㄷ', meaning: 'consonant d/t' }, { hangul: 'ㄹ', meaning: 'consonant r/l' },
  { hangul: 'ㅁ', meaning: 'consonant m'   }, { hangul: 'ㅂ', meaning: 'consonant b/p' },
  { hangul: 'ㅅ', meaning: 'consonant s'   }, { hangul: 'ㅇ', meaning: 'consonant ng'  },
  { hangul: 'ㅈ', meaning: 'consonant j'   }, { hangul: 'ㅊ', meaning: 'consonant ch'  },
  { hangul: 'ㅋ', meaning: 'consonant k'   }, { hangul: 'ㅌ', meaning: 'consonant t'   },
  { hangul: 'ㅍ', meaning: 'consonant p'   }, { hangul: 'ㅎ', meaning: 'consonant h'   },
  // Tense consonants
  { hangul: 'ㄲ', meaning: 'tense g (kk)'  }, { hangul: 'ㄸ', meaning: 'tense d (tt)'  },
  { hangul: 'ㅃ', meaning: 'tense b (pp)'  }, { hangul: 'ㅆ', meaning: 'tense s (ss)'  },
  { hangul: 'ㅉ', meaning: 'tense j (jj)'  },
  // Basic vowels
  { hangul: 'ㅏ', meaning: 'vowel a'  }, { hangul: 'ㅑ', meaning: 'vowel ya' },
  { hangul: 'ㅓ', meaning: 'vowel eo' }, { hangul: 'ㅕ', meaning: 'vowel yeo'},
  { hangul: 'ㅗ', meaning: 'vowel o'  }, { hangul: 'ㅛ', meaning: 'vowel yo' },
  { hangul: 'ㅜ', meaning: 'vowel u'  }, { hangul: 'ㅠ', meaning: 'vowel yu' },
  { hangul: 'ㅡ', meaning: 'vowel eu' }, { hangul: 'ㅣ', meaning: 'vowel i'  },
  // Compound vowels
  { hangul: 'ㅐ', meaning: 'vowel ae' }, { hangul: 'ㅒ', meaning: 'vowel yae'},
  { hangul: 'ㅔ', meaning: 'vowel e'  }, { hangul: 'ㅖ', meaning: 'vowel ye' },
  { hangul: 'ㅘ', meaning: 'vowel wa' }, { hangul: 'ㅙ', meaning: 'vowel wae'},
  { hangul: 'ㅚ', meaning: 'vowel oe' }, { hangul: 'ㅝ', meaning: 'vowel wo' },
  { hangul: 'ㅞ', meaning: 'vowel we' }, { hangul: 'ㅟ', meaning: 'vowel wi' },
  { hangul: 'ㅢ', meaning: 'vowel ui' },
];

// ── 3. Provisional phrase set ─────────────────────────────────────────────────
// PROVISIONAL — not native-speaker validated. See file-level note.

interface PhraseSpec { hangul: string; meaning: string }

const PROVISIONAL_PHRASES: PhraseSpec[] = [
  { hangul: '안녕하세요',  meaning: 'hello (formal) [PROVISIONAL]'            },
  { hangul: '감사합니다',  meaning: 'thank you (formal) [PROVISIONAL]'         },
  { hangul: '미안합니다',  meaning: "I'm sorry (formal) [PROVISIONAL]"         },
  { hangul: '괜찮아요',    meaning: "it's okay [PROVISIONAL]"                   },
  { hangul: '주세요',      meaning: 'please give me [PROVISIONAL]'              },
  { hangul: '모르겠어요',  meaning: "I don't know [PROVISIONAL]"                },
  { hangul: '알겠습니다',  meaning: 'I understand (formal) [PROVISIONAL]'       },
  { hangul: '반갑습니다',  meaning: 'nice to meet you [PROVISIONAL]'            },
  { hangul: '어서오세요',  meaning: 'welcome! (to a shop) [PROVISIONAL]'        },
  { hangul: '고맙습니다',  meaning: 'thank you (formal, softer) [PROVISIONAL]'  },
  { hangul: '실례합니다',  meaning: 'excuse me [PROVISIONAL]'                   },
  { hangul: '잘부탁드립니다', meaning: 'I look forward to working with you [PROVISIONAL]' },
];

// ── 4. ID generation ──────────────────────────────────────────────────────────

function slugify(roman: string): string {
  return roman.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function makeId(prefix: string, roman: string, used: Set<string>): string {
  const base = `${prefix}${slugify(roman)}`;
  if (!used.has(base)) { used.add(base); return base; }
  for (let i = 2; ; i++) {
    const cand = `${base}_${i}`;
    if (!used.has(cand)) { used.add(cand); return cand; }
  }
}

// ── 5. Assemble ContentItems ──────────────────────────────────────────────────

function buildJamoItems(usedIds: Set<string>): ContentItem[] {
  return JAMO_SET.map((spec, idx) => ({
    id:            makeId('j_', romanize(spec.hangul), usedIds),
    tier:          'jamo' as const,
    hangul:        spec.hangul,
    romanization:  romanize(spec.hangul),
    meaning:       spec.meaning,
    order:         idx + 1,
    distractorIds: [], // filled later
  }));
}

function buildGeuljaItems(
  geuljaList: { hangul: string; weight: number }[],
  usedIds: Set<string>,
): ContentItem[] {
  return geuljaList.map((entry, idx) => ({
    id:            makeId('g_', romanize(entry.hangul), usedIds),
    tier:          'geulja' as const,
    hangul:        entry.hangul,
    romanization:  romanize(entry.hangul),
    meaning:       null,
    order:         idx + 1,
    distractorIds: [],
  }));
}

function buildWordItems(
  words: NiklWord[],
  usedIds: Set<string>,
): ContentItem[] {
  return words.map((word, idx) => {
    const roman   = romanize(word.hangul);
    const geulja: Geulja[] = decomposeToGeulja(word.hangul).map(ch => ({
      hangul:       ch,
      romanization: romanize(ch),
    }));
    const meaning = lookupMeaning(word.hangul);

    return {
      id:            makeId('w_', roman, usedIds),
      tier:          'word' as const,
      hangul:        word.hangul,
      romanization:  roman,
      meaning,
      order:         idx + 1,
      geulja,
      distractorIds: [],
    };
  });
}

function buildPhraseItems(usedIds: Set<string>): ContentItem[] {
  return PROVISIONAL_PHRASES.map((spec, idx) => ({
    id:            makeId('p_', romanize(spec.hangul), usedIds),
    tier:          'phrase' as const,
    hangul:        spec.hangul,
    romanization:  romanize(spec.hangul),
    meaning:       spec.meaning,
    order:         idx + 1,
    distractorIds: [],
  }));
}

// ── 6. Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Oriole content pipeline ===\n');

  // Load NIKL
  console.log('Loading NIKL vocabulary list…');
  const allWords   = loadNIKL();
  const wordsSel   = selectWords(allWords, 1000);
  const gradeACnt  = wordsSel.filter(w => w.grade === 'A').length;
  const gradeBCnt  = wordsSel.filter(w => w.grade === 'B').length;
  console.log(`  Selected ${wordsSel.length} words  (A: ${gradeACnt}, B: ${gradeBCnt})\n`);

  console.log('Sample of selected words (first 10):');
  wordsSel.slice(0, 10).forEach((w, i) =>
    console.log(`  ${i + 1}. ${w.hangul}  (rank ${w.rank}, grade ${w.grade}, pos ${w.pos})`),
  );
  console.log();

  // Load kengdic
  console.log('Loading kengdic meanings…');
  const kSize = kengdicSize();
  console.log(`  kengdic entries: ${kSize}\n`);

  // Derive geulja
  console.log('Deriving geulja…');
  const geuljaList = deriveGeulja(wordsSel, 500);
  console.log(`  Geulja count: ${geuljaList.length}\n`);

  // Build all items
  console.log('Building content items…');
  const usedIds = new Set<string>();
  const jamoItems   = buildJamoItems(usedIds);
  const geuljaItems = buildGeuljaItems(geuljaList, usedIds);
  const wordItems   = buildWordItems(wordsSel, usedIds);
  const phraseItems = buildPhraseItems(usedIds);

  const allItems: ContentItem[] = [
    ...jamoItems,
    ...geuljaItems,
    ...wordItems,
    ...phraseItems,
  ];

  const meaningsFound = wordItems.filter(w => w.meaning !== null).length;
  console.log(`  Jamo:   ${jamoItems.length}`);
  console.log(`  Geulja: ${geuljaItems.length}`);
  console.log(`  Words:  ${wordItems.length}  (${meaningsFound} with kengdic meaning)`);
  console.log(`  Phrases: ${phraseItems.length}  [PROVISIONAL — needs native-speaker review]`);
  console.log(`  Total:  ${allItems.length}\n`);

  // Build distractors
  console.log('Building distractors (jamo edit distance)…');
  buildDistractors(allItems);
  const missingDist = allItems.filter(it => it.distractorIds.length < 3);
  if (missingDist.length > 0) {
    console.error(`ERROR: ${missingDist.length} items have < 3 distractors:`);
    missingDist.forEach(it => console.error(`  ${it.id}  ${it.hangul}`));
    process.exit(1);
  }
  console.log('  All items have ≥ 3 distractors ✓\n');

  // Assemble ContentFile
  const contentFile: ContentFile = {
    version:  '1.0.0',
    language: 'ko',
    items:    allItems,
  };

  // Write output
  fs.writeFileSync(OUTPUT, JSON.stringify(contentFile, null, 2), 'utf8');
  const kbSize = Math.round(fs.statSync(OUTPUT).size / 1024);
  console.log(`Written → ${OUTPUT}  (${kbSize} KB)\n`);

  // ── Sample output for native-speaker review ───────────────────────────────
  console.log('=== Sample for review (5 per tier) ===\n');

  function sampleTier(items: ContentItem[], label: string) {
    console.log(`${label}:`);
    items.slice(0, 5).forEach(it => {
      const distHangul = it.distractorIds
        .map(id => allItems.find(x => x.id === id)?.hangul ?? '?')
        .join(' / ');
      console.log(`  ${it.hangul.padEnd(8)} ${it.romanization.padEnd(20)} ${String(it.meaning ?? '').slice(0, 30).padEnd(32)} distractors: ${distHangul}`);
    });
    console.log();
  }

  sampleTier(jamoItems,   'JAMO');
  sampleTier(geuljaItems, 'GEULJA');
  sampleTier(wordItems,   'WORDS');
  sampleTier(phraseItems, 'PHRASES [PROVISIONAL]');

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
