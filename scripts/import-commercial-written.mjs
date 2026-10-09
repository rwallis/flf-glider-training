/**
 * Fetch commercial written MC sheet → POST /api/import as commercial cards.
 *
 * Usage:
 *   node scripts/import-commercial-written.mjs
 *   GLIDER_BASE_URL=https://... GLIDER_IMPORT_PASSWORD=... node scripts/import-commercial-written.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/1I599yHMombddBxQNRjmcY42Vr381U-zJvcidvWLMIiA/export?format=csv';
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
    .toUpperCase();
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
  const d = String(row['choice d'] || '').trim();
  const choices = [a, b, c, d].filter(Boolean);
  const key = String(row['answer key'] || '').trim();
  let answer = String(row['correct answer'] || '').trim();
  if (!answer && key) {
    const idx = letterToIndex(key);
    if (idx >= 0 && choices[idx]) answer = choices[idx];
  }
  if (!question || !answer || choices.length < 2) return null;

  const no = String(row['no.'] || row.no || i + 1).trim();
  const page = String(row['printed page'] || '').trim();
  const pdf = String(row['source pdf'] || '').trim();
  const sourceParts = ['Commercial written', no ? `#${no}` : null, page ? `p.${page}` : null, pdf || null].filter(
    Boolean
  );

  return {
    id: `commercial_written_${String(no || i + 1).padStart(3, '0')}`,
    question,
    answer,
    choices,
    source: sourceParts.join(' · '),
    tags: ['imported', 'commercial_written', 'multiple_choice']
  };
}

async function main() {
  const res = await fetch(SHEET_CSV);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const csv = await res.text();
  const rows = parseCsv(csv);
  const cards = rows.map(rowToCard).filter(Boolean);

  const skipped = rows.length - cards.length;
  console.log(`Parsed ${rows.length} sheet rows → ${cards.length} cards (skipped ${skipped})`);
  if (!cards.length) throw new Error('No cards parsed');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(__dirname, '..', 'content', 'commercial-written-import.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        track_id: 'commercial',
        topic_title: 'Commercial written (ACS / written bank)',
        filename: 'google-sheet-1I599yHM',
        note: 'Imported from commercial written Google Sheet',
        cards
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outPath}`);

  const body = {
    track_id: 'commercial',
    topic_title: 'Commercial written (ACS / written bank)',
    filename: 'google-sheet-1I599yHM',
    note: `Imported ${cards.length} MC questions from Google Sheet`,
    cards,
    password: PASSWORD || undefined
  };

  const headers = { 'Content-Type': 'application/json' };
  if (PASSWORD) headers['x-glider-import-password'] = PASSWORD;

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
  const commercial = (tracks.tracks || []).find((t) => t.id === 'commercial');
  console.log('Commercial track card_count:', commercial?.card_count ?? commercial);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
