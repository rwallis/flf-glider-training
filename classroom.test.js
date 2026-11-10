import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveSessionManager } from './src/classroom/liveSessions.js';
import {
  collectSessionSeedContent,
  getSessionPackage,
  listCourseCatalog,
  listSessionPackageSummaries
} from './src/classroom/packages.js';
import { createMemoryScheduledClassStore } from './src/classroom/scheduledClasses.js';

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

test('course catalog groups Private Pilot Glider with 8 sessions', async () => {
  const courses = await listCourseCatalog();
  const ppg = courses.find((c) => c.id === 'private-pilot-glider');
  assert.ok(ppg);
  assert.equal(ppg.title, 'Private Pilot Glider');
  assert.equal(ppg.sessions.length, 8);
  assert.equal(ppg.sessions[0].week, 1);
  assert.equal(ppg.sessions[2].id, 'weather-for-soaring');
  assert.equal(ppg.sessions[7].week, 8);
});

test('session seed content includes private_ground track and cards', async () => {
  const seed = await collectSessionSeedContent();
  assert.ok(seed.tracks.some((t) => t.id === 'private_ground'));
  assert.ok(seed.topics.some((t) => t.id === 'wx_warmup'));
  assert.ok(seed.cards.some((c) => c.id === 'wx_w1' && c.details?.summary));
  assert.ok(seed.cards.some((c) => c.id === 'wx_c10'));
  assert.ok(seed.cards.some((c) => c.id === 'wx_hw_12'));
});

test('schedule class then enroll without code; honors student limit', async () => {
  const store = createMemoryScheduledClassStore();
  const startsAt = new Date(Date.now() + 86400000).toISOString();
  const scheduled = await store.schedule({
    packageId: 'weather-for-soaring',
    startsAt,
    studentLimit: 2,
    instructor: { userKey: 'ron', name: 'Ron', email: 'ron@example.com' }
  });
  assert.equal(scheduled.title, 'Weather for Soaring');
  assert.equal(scheduled.student_limit, 2);
  assert.equal(scheduled.enrolled_count, 0);
  assert.equal(scheduled.full, false);

  const listed = await store.listClasses({ viewerKey: 'g:sam' });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, scheduled.id);

  const e1 = await store.enroll(scheduled.id, { userKey: 'g:sam', name: 'Sam' });
  assert.equal(e1.you_enrolled, true);
  assert.equal(e1.enrolled_count, 1);
  assert.equal(e1.full, false);

  const e2 = await store.enroll(scheduled.id, { userKey: 'g:pat', name: 'Pat' });
  assert.equal(e2.enrolled_count, 2);
  assert.equal(e2.full, true);
  assert.equal(e2.status, 'full');

  await assert.rejects(
    () => store.enroll(scheduled.id, { userKey: 'g:too', name: 'Too' }),
    /full/i
  );

  const detail = await store.getClass(scheduled.id, {
    viewerKey: 'ron',
    includeRoster: true
  });
  assert.equal(detail.roster.filter((r) => r.role === 'student').length, 2);
});

test('live session enter by scheduled class admits enrolled student', async () => {
  const live = createLiveSessionManager();
  const opened = await live.open({
    packageId: 'weather-for-soaring',
    instructor: { userKey: 'ron', name: 'Ron' },
    scheduledClassId: 'sched-1'
  });
  assert.equal(opened.scheduled_class_id, 'sched-1');

  const found = await live.getForScheduledClass('sched-1', 'g:sam');
  assert.ok(found);
  assert.equal(found.id, opened.id);

  const admitted = await live.admitEnrolled({
    sessionId: opened.id,
    user: { userKey: 'g:sam', name: 'Sam' }
  });
  assert.equal(admitted.you.role, 'student');
  assert.equal(admitted.roster_count, 1);
});

test('live session quiz answers and heat map still work', async () => {
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

  const heat = await live.heatMap(opened.id, 'ron', { isAdmin: true });
  assert.ok(heat.cards.some((c) => c.card_id === 'wx_w1' && c.wrong === 1));
});
