import fs from 'node:fs';
import path from 'node:path';
import type { ContentFile, ContentItem } from '../src/types.js';

const CONTENT_PATH = path.resolve('assets/content/korean.json');
const OUTPUT_DIR   = path.resolve('content-review');
const OUTPUT_PATH  = path.join(OUTPUT_DIR, 'word-meanings-review.csv');
const TOP_N        = 200;

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsvRow(fields: string[]): string {
  return fields.map(quoteField).join(',');
}

function main(): void {
  const raw = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8')) as ContentFile;

  const wordItems: ContentItem[] = raw.items
    .filter(item => item.tier === 'word')
    .sort((a, b) => a.order - b.order)
    .slice(0, TOP_N);

  const header = toCsvRow(['id', 'hangul', 'romanization', 'current_meaning', 'corrected_meaning', 'notes']);
  const rows = wordItems.map(item =>
    toCsvRow([
      item.id,
      item.hangul,
      item.romanization,
      item.meaning ?? '',
      '',
      '',
    ]),
  );

  const csv = '﻿' + [header, ...rows].join('\r\n') + '\r\n';

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, csv, 'utf8');

  console.log(`Exported ${wordItems.length} word items → ${OUTPUT_PATH}`);
}

main();
