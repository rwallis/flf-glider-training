/**
 * Prints base64 chunks of cfi-g-import.json cards for browser CDP injection.
 * Usage: node scripts/_push-import-chunks.mjs [chunkIndex]
 *   no args → prints chunk count
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(path.join(root, 'content/cfi-g-import/cfi-g-import.json'), 'utf8'));
const CHUNK = 40;
const chunks = [];
for (let i = 0; i < data.cards.length; i += CHUNK) {
  chunks.push(data.cards.slice(i, i + CHUNK));
}

const arg = process.argv[2];
if (arg == null) {
  console.log(JSON.stringify({ chunks: chunks.length, cards: data.cards.length }));
} else {
  const idx = Number(arg);
  const payload = Buffer.from(JSON.stringify(chunks[idx]), 'utf8').toString('base64');
  process.stdout.write(payload);
}
