/**
 * Correct obvious OCR/typos in CFI-G import bank (questions, choices, answers).
 *
 * Usage:
 *   node scripts/fix-cfi-g-typos.mjs
 *   node scripts/fix-cfi-g-typos.mjs --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IN_PATH = path.join(ROOT, 'content', 'cfi-g-import', 'cfi-g-import.json');
const OUT_PATH = path.join(ROOT, 'content', 'cfi-g-import', 'cfi-g-import.json');
const REPORT_PATH = path.join(ROOT, 'content', 'cfi-g-import', 'typo-fix-report.json');
const WRITE = process.argv.includes('--write');

/** Ordered replacements: longer / more specific first. */
const REPLACEMENTS = [
  // Multi-word / spaced OCR
  [/control lability/gi, 'controllability'],
  [/instructor certiryin\w*/gi, 'instructor certifying'],
  [/certiryin\w*/gi, 'certifying'],
  [/air traftic/gi, 'air traffic'],
  [/within a horimntal/gi, 'within a horizontal'],
  [/horimntal/gi, 'horizontal'],
  [/atrnospheric/gi, 'atmospheric'],
  [/steepbanked/gi, 'steep banked'],
  [/tailing edge/gi, 'trailing edge'],
  [/tendenry/gi, 'tendency'],
  [/whith/gi, 'which'],
  [/Aaveling/gi, 'traveling'],
  [/airGaft/gi, 'aircraft'],
  [/slability/gi, 'stability'],
  [/\bcaLn\b/g, 'can'],
  [/dLectives/gi, 'directives'],
  [/headinB/gi, 'heading'],
  [/takeofL/gi, 'takeoff'],
  [/\bAcL\b/g, 'Act'],
  [/\boF\b/g, 'of'],
  [/\boO\b/g, 'of'],
  [/\blLS\b/g, 'lbs'],

  // Missing space after common words (OCR glued tokens)
  [/\bofthese\b/gi, 'of these'],
  [/\bofthis\b/gi, 'of this'],
  [/\bofthat\b/gi, 'of that'],
  [/\bofthe\b/gi, 'of the'],
  [/\bofan\b/gi, 'of an'],
  [/\bofattack\b/gi, 'of attack'],
  [/\bofgravity\b/gi, 'of gravity'],
  [/\bofpressure\b/gi, 'of pressure'],
  [/\bofrising\b/gi, 'of rising'],
  [/\bofanalyzing\b/gi, 'of analyzing'],
  [/\bofat\b/gi, 'of at'],
  [/\bofCorpus\b/g, 'of Corpus'],
  [/\binthe\b/gi, 'in the'],
  [/\bonthe\b/gi, 'on the'],
  [/\bfromthe\b/gi, 'from the'],
  [/\bandthe\b/gi, 'and the'],
  [/\bwiththe\b/gi, 'with the'],
  [/\bbythe\b/gi, 'by the'],
  [/\batthe\b/gi, 'at the'],
  [/\bforthe\b/gi, 'for the'],
  [/\btothe\b/gi, 'to the'],
  [/\baswell\b/gi, 'as well'],
  [/\bcanbe\b/gi, 'can be'],
  [/\bwillbe\b/gi, 'will be'],
  [/\bshouldbe\b/gi, 'should be'],
  [/\bisknown\b/gi, 'is known'],
  [/\bcenterof\b/gi, 'center of'],
  [/\bangleof\b/gi, 'angle of'],
  [/\bamountof\b/gi, 'amount of'],
  [/\brelativewind\b/gi, 'relative wind'],

  // Classic OCR letter swaps (word-boundary safe)
  [/\bdmg\b/gi, 'drag'],
  [/\boftum\b/gi, 'of turn'],
  [/\btuming\b/gi, 'turning'],
  [/\bretum\b/gi, 'return'],
  [/\btums\b/gi, 'turns'],
  [/\btum\b/gi, 'turn'],
  [/\btrafiic\b/gi, 'traffic'],
  [/\btraftic\b/gi, 'traffic'],
  [/\baircrafi\b/gi, 'aircraft'],
  [/\baircrafl\b/gi, 'aircraft'],
  [/\blability\b/gi, 'ability'],

  // Spacing / punctuation cleanup
  [/\s{2,}/g, ' '],
  [/\s+([,.?;:])/g, '$1'],
  [/([(\[])\s+/g, '$1'],
  [/\s+([)\]])/g, '$1']
];

function fixText(input) {
  let text = String(input ?? '');
  const before = text;
  for (const [re, to] of REPLACEMENTS) {
    text = text.replace(re, to);
  }
  text = text.trim().replace(/\s+([.!?])$/g, '$1');
  return { text, changed: text !== before };
}

function fixCard(card) {
  const changes = [];
  const next = { ...card };
  const q = fixText(card.question);
  if (q.changed) {
    changes.push({ field: 'question', from: card.question, to: q.text });
    next.question = q.text;
  }
  const a = fixText(card.answer);
  if (a.changed) {
    changes.push({ field: 'answer', from: card.answer, to: a.text });
    next.answer = a.text;
  }
  if (Array.isArray(card.choices)) {
    next.choices = card.choices.map((c, i) => {
      const fixed = fixText(c);
      if (fixed.changed) {
        changes.push({ field: `choice_${i}`, from: c, to: fixed.text });
      }
      return fixed.text;
    });
    // Keep answer aligned to a choice when it matched before / after normalization
    if (next.choices.includes(next.answer) === false) {
      const norm = (s) => String(s || '').trim().replace(/[.?]+$/, '').toLowerCase();
      const match = next.choices.find(
        (c) =>
          c === next.answer ||
          c === card.answer ||
          norm(c) === norm(next.answer) ||
          norm(c) === norm(card.answer)
      );
      if (match && match !== next.answer) {
        changes.push({ field: 'answer_align', from: next.answer, to: match });
        next.answer = match;
      }
    }
  }
  return { card: next, changes };
}

/** Manual obvious content fixes beyond OCR (wrong pasted answer key, etc.). */
const MANUAL_FIXES = {
  cfi_g_bank_140: {
    // "Tropopause." is not a landing-performance choice — standard mountain airport answer.
    answer: 'Higher true airspeed and longer landing distance.'
  }
};

const data = JSON.parse(readFileSync(IN_PATH, 'utf8'));
const cards = [];
const report = [];
let changedCards = 0;
let changeCount = 0;

for (const card of data.cards || []) {
  let { card: fixed, changes } = fixCard(card);
  const manual = MANUAL_FIXES[card.id];
  if (manual) {
    for (const [field, value] of Object.entries(manual)) {
      if (fixed[field] !== value) {
        changes = [...changes, { field: `manual_${field}`, from: fixed[field], to: value }];
        fixed = { ...fixed, [field]: value };
      }
    }
  }
  cards.push(fixed);
  if (changes.length) {
    changedCards += 1;
    changeCount += changes.length;
    report.push({ id: card.id, changes });
  }
}

const out = {
  ...data,
  note: `${data.note || ''} · Typo pass ${new Date().toISOString().slice(0, 10)} (${changedCards} cards)`.trim(),
  cards
};

console.log(`Cards: ${cards.length}`);
console.log(`Cards changed: ${changedCards}`);
console.log(`Field edits: ${changeCount}`);
console.log(`Sample:`);
for (const row of report.slice(0, 12)) {
  console.log(`- ${row.id}: ${row.changes[0].from.slice(0, 70)} → ${row.changes[0].to.slice(0, 70)}`);
}

writeFileSync(REPORT_PATH, JSON.stringify({ changedCards, changeCount, report }, null, 2));
if (WRITE) {
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${OUT_PATH}`);
} else {
  console.log('Dry run only. Re-run with --write to save.');
}
