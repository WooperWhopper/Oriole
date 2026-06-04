import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import type { ContentFile } from '../src/types.js';

const CONTENT_PATH = path.resolve('assets/content/korean.json');
const CSV_PATH     = path.resolve('content-review/word-meanings-review.csv');

interface ReviewRow {
  id: string;
  corrected_meaning: string;
  [key: string]: string;
}

function main(): void {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const wb   = XLSX.readFile(CSV_PATH);
  const ws   = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<ReviewRow>(ws, { defval: '' });

  const contentRaw = fs.readFileSync(CONTENT_PATH, 'utf8');
  const content    = JSON.parse(contentRaw) as ContentFile;

  const idxById = new Map<string, number>(
    content.items.map((item, idx) => [item.id, idx]),
  );

  let updated = 0;
  const notFound: string[] = [];

  for (const row of rows) {
    const corrected = row.corrected_meaning.trim();
    if (!corrected) continue;

    const idx = idxById.get(row.id.trim());
    if (idx === undefined) {
      notFound.push(row.id);
      continue;
    }

    content.items[idx]!.meaning = corrected;
    updated++;
  }

  fs.writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2), 'utf8');

  console.log(`Updated ${updated} meaning(s) in ${CONTENT_PATH}`);
  if (notFound.length > 0) {
    console.warn(`IDs not found in korean.json (${notFound.length}):`);
    notFound.forEach(id => console.warn(`  ${id}`));
  }
}

main();
