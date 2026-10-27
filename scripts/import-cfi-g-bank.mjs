/**
 * Import CFI-G written bank CSV → POST /api/import as cfi_g track.
 *
 * Usage:
 *   node scripts/import-cfi-g-bank.mjs [path/to/Importable.csv]
 *   GLIDER_BASE_URL=https://... GLIDER_IMPORT_PASSWORD=... node scripts/import-cfi-g-bank.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CSV = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  'Downloads',
  'cfi-g-question-bank.xlsx - Importable.csv'
);
const CSV_PATH = path.resolve(process.argv[2] || DEFAULT_CSV);
const BASE = (process.env.GLIDER_BASE_URL || 'https://flf-glider-training-production.up.railway.app').replace(
  /\/$/,
  ''
);
const PASSWORD = process.env.GLIDER_IMPORT_PASSWORD || '';

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

function letterToIndex(letter) {
  const L = String(letter || '')
    .trim()
    .toUpperCase()
    .replace(/\.$/, '');
  if (L === 'A') return 0;
  if (L === 'B') return 1;
  if (L === 'C') return 2;
  if (L === 'D') return 3;
  return -1;
}

function rowToCard(row, i) {
  const question = String(row.question || '').trim();
  const a = String(row['choice a'] || '').trim();
  const b = String(row['choice b'] || '').trim();
  const c = String(row['choice c'] || '').trim();
  const choices = [a, b, c].filter(Boolean);
  const key = String(row['answer key'] || '')
    .trim()
    .toUpperCase()
    .replace(/\.$/, '');
  if (key === 'X') return null;
  let answer = String(row['correct answer'] || '').trim();
  if (!answer && key) {
    const idx = letterToIndex(key);
    if (idx >= 0 && choices[idx]) answer = choices[idx];
  }
  if (!question || !answer || choices.length < 2) return null;

  const noRaw = String(row['no.'] || row.no || i + 1).trim();
  const noNum = Number.parseInt(noRaw, 10);
  const no = Number.isFinite(noNum) ? String(noNum) : noRaw;
  const pdf = String(row['source pdf'] || 'IMG_0001.pdf').trim();

  return {
    id: `cfi_g_bank_${String(no).padStart(3, '0')}`,
    question,
    answer,
    choices,
    source: `CFI-G bank #${no} · ${pdf}`,
    tags: ['imported', 'cfi_g', 'multiple_choice']
  };
}

async function main() {
  console.log(`Reading ${CSV_PATH}`);
  const csv = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csv);
  const cards = rows.map(rowToCard).filter(Boolean);
  const skipped = rows.length - cards.length;
  console.log(`Parsed ${rows.length} CSV rows → ${cards.length} cards (skipped ${skipped})`);
  if (!cards.length) throw new Error('No cards parsed');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(__dirname, '..', 'content', 'cfi-g-import', 'cfi-g-import.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        track_id: 'cfi_g',
        topic_title: 'CFI-G written question bank',
        filename: path.basename(CSV_PATH),
        note: `Imported ${cards.length} MC questions from ${path.basename(CSV_PATH)}`,
        cards
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath}`);

  const body = {
    track_id: 'cfi_g',
    topic_title: 'CFI-G written question bank',
    filename: path.basename(CSV_PATH),
    note: `Imported ${cards.length} MC questions from updated Importable CSV`,
    cards,
    password: PASSWORD || undefined
  };

  const headers = { 'Content-Type': 'application/json' };
  if (PASSWORD) headers['x-glider-import-password'] = PASSWORD;

  console.log(`POST ${BASE}/api/import (${cards.length} cards → cfi_g)`);
  const importRes = await fetch(`${BASE}/api/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await importRes.json().catch(() => ({}));
  if (!importRes.ok) {
    console.error('Import failed', importRes.status, data);
    process.exit(1);
  }
  console.log('Import OK', data);

  const tracks = await fetch(`${BASE}/api/tracks`).then((r) => r.json());
  const cfi = (tracks.tracks || []).find((t) => t.id === 'cfi_g');
  console.log('CFI-G track card_count:', cfi?.card_count ?? cfi);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
