import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextProgress,
  normalizeCardPatch,
  parseImportPayload,
  createMemoryStore,
  activityDateKey,
  displayNameFromProfile
} from './src/store.js';

test('nextProgress again schedules soon and lowers ease', () => {
  const prev = { ease: 2.5, interval_days: 5, reps: 3, lapses: 0 };
  const out = nextProgress(prev, 'again');
  assert.equal(out.reps, 0);
  assert.equal(out.lapses, 1);
  assert.ok(out.ease < 2.5);
  assert.ok(new Date(out.due_at) - Date.now() < 15 * 60 * 1000);
});

test('nextProgress good increases interval after first reps', () => {
  const first = nextProgress(null, 'good');
  assert.equal(first.reps, 1);
  const second = nextProgress(first, 'good');
  assert.equal(second.reps, 2);
  assert.ok(second.interval_days >= 1);
});

test('parseImportPayload accepts csv', () => {
  const parsed = parseImportPayload({
    track_id: 'cfi_g',
    topic_title: 'FOI',
    csv: 'question,answer\nWhat is rote?,Memorizing facts\n'
  });
  assert.equal(parsed.trackId, 'cfi_g');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].question, 'What is rote?');
});

test('parseImportPayload accepts commercial written MC csv', () => {
  const parsed = parseImportPayload({
    track_id: 'commercial',
    topic_title: 'Written',
    csv:
      'Question,Choice A,Choice B,Choice C,Answer Key,Correct Answer\n' +
      'When is NTSB notice required?,landing gear,engine fail,structure strength,C,structure strength\n'
  });
  assert.equal(parsed.rows.length, 1);
  assert.deepEqual(parsed.rows[0].choices, ['landing gear', 'engine fail', 'structure strength']);
  assert.equal(parsed.rows[0].answer, 'structure strength');
});

test('parseImportPayload rejects bad track', () => {
  assert.throws(() => parseImportPayload({ track_id: 'nope', cards: [{ question: 'q', answer: 'a' }] }));
});

test('normalizeCardPatch requires non-empty question/answer when provided', () => {
  assert.throws(() => normalizeCardPatch({ question: '  ' }));
  const patch = normalizeCardPatch({
    question: ' Updated Q ',
    answer: ' Updated A ',
    choices: ['A', 'B', '']
  });
  assert.equal(patch.question, 'Updated Q');
  assert.equal(patch.answer, 'Updated A');
  assert.deepEqual(patch.choices, ['A', 'B']);
});

test('memory store updateCard edits question answer and choices', async () => {
  const store = createMemoryStore({
    tracks: [{ id: 'cfi_g', title: 'CFI-G', sort_order: 1, status: 'ready' }],
    topics: [],
    cards: [{
      id: 'c1',
      track_id: 'cfi_g',
      topic_id: 't1',
      question: 'Old Q',
      answer: 'Old A',
      choices: ['Old A', 'Wrong'],
      source: 'stub'
    }]
  });
  const updated = await store.updateCard('c1', {
    question: 'New Q',
    answer: 'New A',
    choices: ['New A', 'Wrong']
  });
  assert.equal(updated.question, 'New Q');
  assert.equal(updated.answer, 'New A');
  assert.deepEqual(updated.choices, ['New A', 'Wrong']);
  const got = await store.getCard('c1');
  assert.equal(got.question, 'New Q');
});

test('activityDateKey returns YYYY-MM-DD', () => {
  assert.match(activityDateKey(new Date('2026-10-14T12:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
});

test('displayNameFromProfile prefers first name', () => {
  assert.equal(displayNameFromProfile({ name: 'Ron Wallis', email: 'ron@example.com' }), 'Ron');
});

test('leagueSummary tracks daily answers across users', async () => {
  const store = createMemoryStore({
    tracks: [{ id: 'commercial', title: 'Commercial', sort_order: 1, status: 'ready' }],
    topics: [],
    cards: []
  });
  await store.setUserProfile({ userKey: 'g:you', name: 'You Person', email: 'you@x.com' });
  await store.setUserProfile({ userKey: 'g:peer', name: 'Pat Pilot', email: 'pat@x.com' });
  await store.recordAnswer('g:you');
  await store.recordAnswer('g:you');
  await store.recordAnswer('g:peer');
  const summary = await store.leagueSummary('g:you', { days: 7 });
  assert.equal(summary.you.today, 2);
  assert.equal(summary.you.week_total, 2);
  assert.equal(summary.you.display_name, 'You');
  assert.ok(summary.chart.some((p) => p.display_name === 'Pat'));
  assert.ok(summary.leaderboard[0].today >= 1);
});
