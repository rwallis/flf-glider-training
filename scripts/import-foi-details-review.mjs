/**
 * Import FOI Details from the review spreadsheet into content/card-details.json.
 * Uses summary + links for every foi_written_* row (all rows with a summary).
 *
 * Run: node scripts/import-foi-details-review.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const xlsxPath = path.join(root, 'content', 'foi-details-review', 'foi-details-review.xlsx');
const draftPath = path.join(root, 'content', 'foi-details-review', 'foi-details-draft.json');
const detailsPath = path.join(root, 'content', 'card-details.json');

function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
  }
  return String(value);
}

function parseLinks(raw) {
  const out = [];
  const text = cellText(raw).replace(/\r/g, '');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(.*?)\s*<(https?:\/\/[^>\s]+)>\s*$/);
    if (m) {
      out.push({ label: m[1].trim(), url: m[2].trim() });
      continue;
    }
    const pipe = trimmed.split('|').map((s) => s.trim());
    if (pipe.length === 2 && /^https?:\/\//i.test(pipe[1])) {
      out.push({ label: pipe[0], url: pipe[1] });
    }
  }
  return out;
}

function headerIndex(sheet) {
  const map = {};
  sheet.getRow(1).eachCell((cell, col) => {
    const key = cellText(cell.value).trim();
    if (key) map[key] = col;
  });
  return map;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const sheet = wb.getWorksheet('FOI Details Review') || wb.worksheets[0];
  if (!sheet) throw new Error('No worksheet found');
  const cols = headerIndex(sheet);
  const summaryCol = cols.summary || cols.new_summary;
  if (!cols.card_id || !summaryCol || !cols.links) {
    throw new Error('Missing column: need card_id, summary (or new_summary), links');
  }

  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  const draftById = Object.fromEntries((draft.details || []).map((d) => [d.card_id, d]));

  const imported = [];
  let usedDraftLinks = 0;
  let emptySummary = 0;
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const cardId = cellText(row.getCell(cols.card_id).value).trim();
    if (!cardId.startsWith('foi_written_')) continue;
    const summary = cellText(row.getCell(summaryCol).value).trim();
    if (!summary) {
      emptySummary += 1;
      continue;
    }
    let links = parseLinks(row.getCell(cols.links).value);
    if (!links.length && draftById[cardId]?.links?.length) {
      links = draftById[cardId].links;
      usedDraftLinks += 1;
    }
    imported.push({
      card_id: cardId,
      summary,
      links: links.slice(0, 5),
    });
  }

  const detailsDoc = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
  const existing = Array.isArray(detailsDoc.details) ? detailsDoc.details : [];
  const kept = existing.filter((d) => !String(d.card_id || '').startsWith('foi_written_'));
  const byId = new Map(kept.map((d) => [d.card_id, d]));
  let replaced = 0;
  let added = 0;
  for (const row of imported) {
    if (byId.has(row.card_id)) replaced += 1;
    else added += 1;
    byId.set(row.card_id, row);
  }
  const merged = [...byId.values()].sort((a, b) =>
    String(a.card_id).localeCompare(String(b.card_id))
  );
  fs.writeFileSync(detailsPath, `${JSON.stringify({ details: merged }, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        imported: imported.length,
        empty_summary: emptySummary,
        used_draft_links: usedDraftLinks,
        replaced_or_updated: replaced,
        added,
        foi_details: merged.filter((d) => String(d.card_id).startsWith('foi_')).length,
        total_details: merged.length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
