/**
 * Export ONLY FOI Details that changed vs a before-snapshot into a review Excel.
 *
 * Expects:
 *   content/foi-details-review/_before-answer-pass.json  (snapshot)
 *   content/card-details.json                            (current)
 *
 * Run after build-foi-details.mjs:
 *   node scripts/export-foi-details-updates.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewDir = path.join(root, 'content', 'foi-details-review');
const beforePath = path.join(reviewDir, '_before-answer-pass.json');
const detailsPath = path.join(root, 'content', 'card-details.json');
const foiImportPath = path.join(root, 'content', 'foi-import', 'foi-import.json');

const beforeDoc = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
const beforeById = Object.fromEntries(
  (beforeDoc.details || []).map((d) => [d.card_id, d])
);
const detailsDoc = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
const afterById = Object.fromEntries(
  (detailsDoc.details || [])
    .filter((d) => String(d.card_id || '').startsWith('foi_written_'))
    .map((d) => [d.card_id, d])
);
const foiImport = JSON.parse(fs.readFileSync(foiImportPath, 'utf8'));
const cardById = Object.fromEntries((foiImport.cards || []).map((c) => [c.id, c]));

const changed = [];
for (const [id, after] of Object.entries(afterById)) {
  const before = beforeById[id];
  const oldSum = before?.summary || '';
  const newSum = after?.summary || '';
  if (oldSum === newSum) continue;
  const card = cardById[id] || {};
  const links = Array.isArray(after.links) ? after.links : [];
  changed.push({
    card_id: id,
    topic_id: card.topic_id || '',
    question: card.question || '',
    answer: card.answer || '',
    choices: Array.isArray(card.choices) ? card.choices.join(' | ') : '',
    old_summary: oldSum,
    new_summary: newSum,
    links: links.map((l) => `${l.label} <${l.url}>`).join('\n'),
  });
}

changed.sort((a, b) => a.card_id.localeCompare(b.card_id));

fs.writeFileSync(
  path.join(reviewDir, 'foi-details-updates.json'),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      count: changed.length,
      details: changed.map((r) => ({
        card_id: r.card_id,
        summary: r.new_summary,
        links: afterById[r.card_id]?.links || [],
      })),
    },
    null,
    2
  )
);

const workbook = new ExcelJS.Workbook();
workbook.creator = 'FLF glider training';
workbook.created = new Date();

const sheet = workbook.addWorksheet('FOI Details Updates', {
  views: [{ state: 'frozen', ySplit: 1 }],
});
sheet.columns = [
  { header: 'Approved', key: 'approved', width: 12 },
  { header: 'card_id', key: 'card_id', width: 22 },
  { header: 'topic_id', key: 'topic_id', width: 16 },
  { header: 'question', key: 'question', width: 48 },
  { header: 'answer', key: 'answer', width: 36 },
  { header: 'choices', key: 'choices', width: 40 },
  { header: 'old_summary', key: 'old_summary', width: 44 },
  { header: 'new_summary', key: 'new_summary', width: 56 },
  { header: 'links', key: 'links', width: 40 },
  { header: 'notes', key: 'notes', width: 24 },
];
const header = sheet.getRow(1);
header.font = { bold: true };
header.alignment = { vertical: 'middle', wrapText: true };

for (const row of changed) {
  const excelRow = sheet.addRow({
    approved: false,
    ...row,
    notes: '',
  });
  excelRow.alignment = { vertical: 'top', wrapText: true };
  excelRow.getCell('approved').dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"TRUE,FALSE"'],
    showErrorMessage: true,
    errorTitle: 'Approved',
    error: 'Use TRUE or FALSE',
  };
}

sheet.autoFilter = {
  from: { row: 1, column: 1 },
  to: { row: 1, column: 10 },
};

const instructions = workbook.addWorksheet('Instructions');
instructions.columns = [{ header: 'How to review', key: 'text', width: 100 }];
instructions.addRow({
  text: 'This workbook lists ONLY FOI Details that changed in the answer-alignment pass.',
});
instructions.addRow({
  text: 'Example fix: foi_written_137 now explains why matching reduces guessing (not a generic MC tip).',
});
instructions.addRow({
  text: 'Live card-details.json already includes these updates; this sheet is for review/markup.',
});
instructions.addRow({ text: `Changed rows: ${changed.length}` });

const outXlsx = path.join(reviewDir, 'foi-details-updates.xlsx');
await workbook.xlsx.writeFile(outXlsx);

console.log(
  JSON.stringify(
    {
      changed: changed.length,
      xlsx: path.relative(root, outXlsx).replace(/\\/g, '/'),
      sample_137: afterById.foi_written_137?.summary || null,
    },
    null,
    2
  )
);
