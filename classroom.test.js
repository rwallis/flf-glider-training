import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveSessionManager } from './src/classroom/liveSessions.js';
import {
  collectSessionSeedContent,
  getSessionPackage,
  listSessionPackageSummaries
} from './src/classroom/packages.js';

test('weather-for-soaring package loads with quizzes and homework', async () => {
  const summaries = await listSessionPackageSummaries();
  assert.ok(summaries.some((p) => p.id === 'weather-for-soaring'));
  const pkg = await getSessionPackage('weather-for-soaring');
  assert.equal(pkg.title, 'Weather for Soaring');
  assert.equal(pkg.quizzes.warmup.cards.length, 5);
  assert.equal(pkg.quizzes.check.cards.length, 10);
  assert.equal(pkg.homework.cards.length, 12);
  assert.ok(pkg.outline.length >= 7);
  assert.equal(pkg.max_students, 10);
});

test('session seed content includes private_ground track and cards', async () => {
  const seed = await collectSessionSeedContent();
  assert.ok(seed.tracks.some((t) => t.id === 'private_ground'));
  assert.ok(seed.topics.some((t) => t.id === 'wx_warmup'));
  assert.ok(seed.cards.some((c) => c.id === 'wx_w1' && c.details?.summary));
  assert.ok(seed.cards.some((c) => c.id === 'wx_c10'));
  assert.ok(seed.cards.some((c) => c.id === 'wx_hw_12'));
});

test('live session open/join enforces code auth and 10-student cap', async () => {
  const live = createLiveSessionManager();
  const opened = await live.open({
    packageId: 'weather-for-soaring',
    instructor: { userKey: 'ron', name: 'Ron', email: 'ron@example.com' }
  });
  assert.equal(opened.phase, 'open');
  assert.match(opened.code, /^[A-Z0-9]{6}$/);
  assert.equal(opened.roster_count, 0);

  const student = await live.join({
    code: opened.code,
    user: { userKey: 'g:student1', name: 'Sam', email: 'sam@example.com' }
  });
  assert.equal(student.you.role, 'student');
  assert.equal(student.roster_count, 1);

  await assert.rejects(
    () => live.join({ code: 'NOPE12', user: { userKey: 'g:x', name: 'X' } }),
    /No open live session/
  );

  for (let i = 2; i <= 10; i += 1) {
    await live.join({
      code: opened.code,
      user: { userKey: `g:student${i}`, name: `S${i}` }
    });
  }
  await assert.rejects(
    () =>
      live.join({
        code: opened.code,
        user: { userKey: 'g:student11', name: 'TooMany' }
      }),
    /full/
  );
});

test('live session quiz answers and heat map', async () => {
  const live = createLiveSessionManager();
  const opened = await live.open({
    packageId: 'weather-for-soaring',
    instructor: { userKey: 'ron', name: 'Ron' }
  });
  await live.patch(opened.id, 'ron', { phase: 'warmup' }, { isAdmin: true });
  await live.join({
    code: opened.code,
    user: { userKey: 'g:sam', name: 'Sam' }
  });

  const wrong = await live.submitAnswer(opened.id, 'g:sam', {
    cardId: 'wx_w1',
    choice: '2 °C per 1,000 feet'
  });
  assert.equal(wrong.ok, true);
  assert.equal(wrong.correct, null);

  const heat = await live.heatMap(opened.id, 'ron', { isAdmin: true });
  assert.ok(heat.cards.some((c) => c.card_id === 'wx_w1' && c.wrong === 1));
  assert.ok(heat.tags.some((t) => t.tag === 'lapse-rate' && t.wrong >= 1));

  await live.patch(opened.id, 'ron', { answers_frozen: true }, { isAdmin: true });
  await assert.rejects(
    () =>
      live.submitAnswer(opened.id, 'g:sam', {
        cardId: 'wx_w2',
        choice: 'Cloud base must be below 5,000 feet'
      }),
    /frozen/
  );
});
