/**
 * Export FOI Details to an Excel workbook for review.
 * Columns include Approved (TRUE/FALSE) for reviewer markup.
 *
 * Prerequisites: run `node scripts/build-foi-details.mjs` first (or any pass that
 * updates foi_written_* in content/card-details.json).
 *
 * Run: node scripts/export-foi-details-review.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewDir = path.join(root, 'content', 'foi-details-review');
const foiImport = JSON.parse(
  fs.readFileSync(path.join(root, 'content', 'foi-import', 'foi-import.json'), 'utf8')
);
const cardDetails = JSON.parse(
  fs.readFileSync(path.join(root, 'content', 'card-details.json'), 'utf8')
);

const detailById = Object.fromEntries(
  (cardDetails.details || [])
    .filter((d) => String(d.card_id || '').startsWith('foi_written_'))
    .map((d) => [d.card_id, d])
);

const rows = [];
for (const card of foiImport.cards || []) {
  if (!String(card.id || '').startsWith('foi_written_')) continue;
  const detail = detailById[card.id];
  if (!detail) {
    throw new Error(`Missing FOI detail for ${card.id} — run build-foi-details.mjs first`);
  }
  const links = Array.isArray(detail.links) ? detail.links : [];
  rows.push({
    card_id: card.id,
    topic_id: card.topic_id || '',
    question: card.question || '',
    answer: card.answer || '',
    choices: Array.isArray(card.choices) ? card.choices.join(' | ') : '',
    summary: detail.summary || '',
    links: links.map((l) => `${l.label} <${l.url}>`).join('\n'),
    links_json: JSON.stringify(links),
  });
}

fs.mkdirSync(reviewDir, { recursive: true });
fs.writeFileSync(
  path.join(reviewDir, 'foi-details-draft.json'),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      count: rows.length,
      details: rows.map((r) => ({
        card_id: r.card_id,
        summary: r.summary,
        links: JSON.parse(r.links_json),
        approved: false,
      })),
    },
    null,
    2
  )
);

const workbook = new ExcelJS.Workbook();
workbook.creator = 'FLF glider training';
workbook.created = new Date();

const sheet = workbook.addWorksheet('FOI Details Review', {
  views: [{ state: 'frozen', ySplit: 1 }],
});

sheet.columns = [
  { header: 'Approved', key: 'approved', width: 12 },
  { header: 'card_id', key: 'card_id', width: 22 },
  { header: 'topic_id', key: 'topic_id', width: 16 },
  { header: 'question', key: 'question', width: 48 },
  { header: 'answer', key: 'answer', width: 36 },
  { header: 'choices', key: 'choices', width: 44 },
  { header: 'summary', key: 'summary', width: 56 },
  { header: 'links', key: 'links', width: 44 },
  { header: 'notes', key: 'notes', width: 28 },
];

const header = sheet.getRow(1);
header.font = { bold: true };
header.alignment = { vertical: 'middle', wrapText: true };
header.height = 24;

for (const row of rows) {
  const excelRow = sheet.addRow({
    approved: false,
    card_id: row.card_id,
    topic_id: row.topic_id,
    question: row.question,
    answer: row.answer,
    choices: row.choices,
    summary: row.summary,
    links: row.links,
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
  to: { row: 1, column: 9 },
};

const instructions = workbook.addWorksheet('Instructions');
instructions.columns = [{ header: 'How to review', key: 'text', width: 100 }];
instructions.addRow({
  text: 'Set Approved=TRUE for rows you accept. Leave FALSE (or blank) if the summary needs a rewrite; put feedback in notes.',
});
instructions.addRow({
  text: 'Do not edit card_id. You may edit summary / links in place; import with scripts/import-foi-details-review.mjs when ready.',
});
instructions.addRow({
  text: 'Link format per line: Label <https://example.com/path>',
});
instructions.addRow({
  text: `Generated ${rows.length} FOI Details for review. Example fix target: foi_written_134 (MC distractor construction).`,
});

const outXlsx = path.join(reviewDir, 'foi-details-review.xlsx');
await workbook.xlsx.writeFile(outXlsx);

// Clean temp stem dump if present
const tmp = path.join(reviewDir, '_stems.tmp.txt');
if (fs.existsSync(tmp)) fs.unlinkSync(tmp);

console.log(
  JSON.stringify(
    {
      rows: rows.length,
      xlsx: path.relative(root, outXlsx).replace(/\\/g, '/'),
      draft_json: 'content/foi-details-review/foi-details-draft.json',
      sample_134: detailById.foi_written_134?.summary || null,
    },
    null,
    2
  )
);
