import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextProgress,
  parseImportPayload
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
