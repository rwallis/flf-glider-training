#!/usr/bin/env node
/**
 * Audit MC cards: answer must exactly match one choice (after trim/whitespace normalize).
 * Writes content/answer-selection-audit.json
 * Exit 1 if any mismatches remain.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const BANKS = [
  ['private', 'content/private-import/private-import.json'],
  ['foi', 'content/foi-import/foi-import.json'],
  ['commercial', 'content/commercial-import/commercial-import.json'],
  ['cfi_g', 'content/cfi-g-import/cfi-g-import.json'],
  ['seed', 'content/seed.json']
];

function normalize(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function auditCards(source, cards) {
  const bad = [];
  let mc = 0;
  for (const c of cards || []) {
    const choices = Array.isArray(c.choices) ? c.choices.map((x) => String(x ?? '')) : [];
    const usable = choices.filter((x) => x.trim());
    if (usable.length < 2) continue;
    mc += 1;
    const answer = String(c.answer ?? '').trim();
    const issues = [];
    if (!answer) issues.push('empty_answer');
    if (choices.some((x) => !String(x).trim() || /\[missing\]|\[truncated\]/i.test(x))) {
      issues.push('bad_choice_text');
    }
    if (answer && !choices.some((ch) => normalize(ch) === normalize(answer))) {
      issues.push('answer_not_in_choices');
    }
    if (!String(c.question || '').trim()) issues.push('empty_question');
    if (issues.length) {
      bad.push({
        source,
        id: c.id,
        track_id: c.track_id || source,
        topic_id: c.topic_id || null,
        issues,
        question: String(c.question || '').slice(0, 200),
        answer,
        choices
      });
    }
  }
  return { mc, bad };
}

async function main() {
  const allBad = [];
  const summary = [];
  for (const [name, rel] of BANKS) {
    const raw = JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));
    const cards = Array.isArray(raw.cards) ? raw.cards : [];
    const { mc, bad } = auditCards(name, cards);
    summary.push({ name, total_cards: cards.length, mc_cards: mc, bad: bad.length });
    allBad.push(...bad);
  }
  const report = {
    generated_at: new Date().toISOString(),
    summary,
    bad_count: allBad.length,
    cards: allBad
  };
  const out = path.join(ROOT, 'content', 'answer-selection-audit.json');
  await writeFile(out, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`bad=${allBad.length} -> ${out}`);
  if (allBad.length) {
    for (const b of allBad.slice(0, 30)) {
      console.log(`- ${b.source}/${b.id}: ${b.issues.join(',')}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
