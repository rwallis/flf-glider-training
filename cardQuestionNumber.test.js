import test from 'node:test';
import assert from 'node:assert/strict';
import { cardQuestionNumber } from './src/routes.js';

test('cardQuestionNumber reads trailing id digits', () => {
  assert.equal(cardQuestionNumber({ id: 'commercial_written_042' }), 42);
  assert.equal(cardQuestionNumber({ id: 'foi_written_276' }), 276);
  assert.equal(cardQuestionNumber({ id: 'cfi_g_bank_009' }), 9);
});

test('cardQuestionNumber falls back to source #N', () => {
  assert.equal(cardQuestionNumber({ id: 'comm_priv_133', source: 'PTS · #133' }), 133);
  assert.equal(cardQuestionNumber({ id: 'odd', source: 'Bank Ref #7 · p.2' }), 7);
});

test('cardQuestionNumber sorts missing numbers last', () => {
  assert.equal(cardQuestionNumber({ id: 'comm_slip' }), Number.POSITIVE_INFINITY);
});
