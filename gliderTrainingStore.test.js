import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextProgress,
  normalizeCardPatch,
  normalizeStudySchedule,
  parseImportPayload,
  createMemoryStore,
  activityDateKey,
  displayNameFromProfile,
  resolveStudyCorrect,
  xpForCorrectness,
  correctPercent,
  computeCourseReadiness,
  weekStartMonday,
  weekDateKeys,
  pickWeeklyQuizCardIds,
  normalizeWeeklyQuizSize,
  WEEKLY_QUIZ_TRACKS,
  DEFAULT_STUDY_SCHEDULE
} from './src/store.js';
import { normalizeCardDetails } from './src/seed.js';

test('nextProgress again schedules soon and lowers ease', () => {
  const prev = { ease: 2.5, interval_days: 5, reps: 3, lapses: 0 };
  const out = nextProgress(prev, 'again');
  assert.equal(out.reps, 0);
  assert.equal(out.lapses, 1);
  assert.ok(out.ease < 2.5);
  assert.ok(new Date(out.due_at) - Date.now() < 15 * 60 * 1000);
});

test('nextProgress uses grade schedule defaults', () => {
  const hard = nextProgress(null, 'hard');
  assert.equal(hard.reps, 1);
  assert.ok(Math.abs(hard.interval_days - 1) < 0.001);
  const dueHard = new Date(hard.due_at) - Date.now();
  assert.ok(dueHard > 20 * 60 * 60 * 1000 && dueHard < 26 * 60 * 60 * 1000);

  const good = nextProgress(null, 'good');
  assert.ok(Math.abs(good.interval_days - 7) < 0.001);

  const easy = nextProgress(null, 'easy');
  assert.equal(new Date(easy.due_at).getUTCFullYear(), 9999);

  const custom = nextProgress(null, 'good', {
    ...DEFAULT_STUDY_SCHEDULE,
    good: { value: 2, unit: 'hours' }
  });
  const dueCustom = new Date(custom.due_at) - Date.now();
  assert.ok(dueCustom > 90 * 60 * 1000 && dueCustom < 150 * 60 * 1000);
});

test('normalizeStudySchedule fills defaults and accepts never', () => {
  const s = normalizeStudySchedule({ easy: { unit: 'never' }, hard: { value: 3, unit: 'days' } });
  assert.equal(s.again.unit, 'minutes');
  assert.equal(s.again.value, 10);
  assert.equal(s.hard.value, 3);
  assert.equal(s.easy.unit, 'never');
});

test('memory store persists study schedule', async () => {
  const store = createMemoryStore({ tracks: [], topics: [], cards: [] });
  const saved = await store.setStudySchedule({
    again: { value: 5, unit: 'minutes' },
    hard: { value: 2, unit: 'days' },
    good: { value: 14, unit: 'days' },
    easy: { value: 0, unit: 'never' }
  });
  assert.equal(saved.again.value, 5);
  const got = await store.getStudySchedule();
  assert.equal(got.good.value, 14);
});

test('flagCard stores open flags for review', async () => {
  const store = createMemoryStore({
    tracks: [{ id: 'private', title: 'Private', sort_order: 1, status: 'ready' }],
    topics: [{ id: 't1', track_id: 'private', title: 'T', sort_order: 1 }],
    cards: [
      {
        id: 'c1',
        track_id: 'private',
        topic_id: 't1',
        question: 'Q?',
        answer: 'A',
        choices: ['A', 'B', 'C']
      }
    ]
  });
  const flag = await store.flagCard('g:newuser', 'c1', 'wrong answer');
  assert.equal(flag.card_id, 'c1');
  assert.equal(flag.note, 'wrong answer');
  const flags = await store.listCardFlags({ status: 'open' });
  assert.equal(flags.length, 1);
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

test('memory store updateCard can move course and topic', async () => {
  const store = createMemoryStore({
    tracks: [
      { id: 'cfi_g', title: 'CFI-G', sort_order: 1, status: 'ready' },
      { id: 'foi', title: 'FOI', sort_order: 2, status: 'ready' }
    ],
    topics: [
      { id: 'cfi_t1', track_id: 'cfi_g', title: 'Old topic' },
      { id: 'foi_1', track_id: 'foi', title: 'Learning' }
    ],
    cards: [{
      id: 'c1',
      track_id: 'cfi_g',
      topic_id: 'cfi_t1',
      question: 'Q',
      answer: 'A'
    }]
  });
  const updated = await store.updateCard('c1', { track_id: 'foi', topic_id: 'foi_1' });
  assert.equal(updated.track_id, 'foi');
  assert.equal(updated.topic_id, 'foi_1');
  await assert.rejects(
    () => store.updateCard('c1', { track_id: 'foi', topic_id: 'cfi_t1' }),
    /not in course/
  );
});

test('normalizeCardPatch and updateCard persist manual details', async () => {
  const patch = normalizeCardPatch({
    details: {
      summary: ' Teach rollout aileron drag. ',
      links: [{ label: 'PHAK', url: 'https://www.faa.gov/phak' }, { label: 'bad', url: 'ftp://x' }]
    }
  });
  assert.equal(patch.details.summary, 'Teach rollout aileron drag.');
  assert.equal(patch.details.source, 'manual');
  assert.equal(patch.details.links.length, 1);
  assert.throws(() => normalizeCardPatch({ details: { summary: '', links: [] } }));

  const store = createMemoryStore({
    tracks: [],
    topics: [],
    cards: [{
      id: 'c1',
      track_id: 'cfi_g',
      topic_id: 't1',
      question: 'Q',
      answer: 'A',
      details: null
    }]
  });
  const updated = await store.updateCard('c1', {
    details: {
      summary: 'Manual note',
      links: [{ label: 'AIM', url: 'https://www.faa.gov/aim' }]
    }
  });
  assert.equal(updated.details.summary, 'Manual note');
  assert.equal(updated.details.source, 'manual');
  assert.equal(updated.details.links[0].label, 'AIM');
});

test('memory store listCards supports q hasFigure track and limit', async () => {
  const store = createMemoryStore({
    tracks: [],
    topics: [],
    cards: [
      {
        id: 'a',
        track_id: 'cfi_g',
        topic_id: 'stalls',
        question: 'What causes a stall?',
        answer: 'Critical AOA',
        figure: { number: 1, url: '/figures/cfi-g/01.png' }
      },
      {
        id: 'b',
        track_id: 'cfi_g',
        topic_id: 'weather',
        question: 'What is virga?',
        answer: 'Precip that evaporates',
        figure: null
      },
      {
        id: 'c',
        track_id: 'commercial',
        topic_id: 'regs',
        question: 'NTSB notification?',
        answer: 'Substantial damage',
        figure: { number: 2, url: '/figures/commercial/02.png' }
      }
    ]
  });
  const byQ = await store.listCards({ q: 'stall' });
  assert.equal(byQ.length, 1);
  assert.equal(byQ[0].id, 'a');
  const figs = await store.listCards({ hasFigure: true, trackId: 'cfi_g' });
  assert.equal(figs.length, 1);
  assert.equal(figs[0].id, 'a');
  const limited = await store.listCards({ limit: 1 });
  assert.equal(limited.length, 1);
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
  await store.recordAnswer('g:you', 2);
  await store.recordAnswer('g:you', 1);
  await store.recordAnswer('g:peer', 2);
  const summary = await store.leagueSummary('g:you', { days: 7 });
  assert.equal(summary.you.today, 3);
  assert.equal(summary.you.week_total, 3);
  assert.equal(summary.you.display_name, 'You');
  assert.ok(summary.chart.some((p) => p.display_name === 'Pat'));
  assert.ok(summary.leaderboard[0].today >= 1);
});

test('xpForCorrectness awards 2 for correct and 1 for wrong', () => {
  assert.equal(xpForCorrectness(true), 2);
  assert.equal(xpForCorrectness(false), 1);
});

test('resolveStudyCorrect uses choice match then grade fallback', () => {
  const card = { answer: 'stability.' };
  assert.equal(resolveStudyCorrect({ card, choice: 'stability' }), true);
  assert.equal(resolveStudyCorrect({ card, choice: 'controllability' }), false);
  assert.equal(resolveStudyCorrect({ card, grade: 'again' }), false);
  assert.equal(resolveStudyCorrect({ card, grade: 'good' }), true);
});

test('correctPercent rounds answer accuracy', () => {
  assert.equal(correctPercent(0, 0), null);
  assert.equal(correctPercent(1, 2), 50);
  assert.equal(correctPercent(2, 3), 67);
});

test('normalizeCardDetails keeps summary and https links only', () => {
  const details = normalizeCardDetails({
    summary: '  NTSB notification rules.  ',
    links: [
      { label: 'Part 830', url: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-VIII/part-830' },
      { label: 'bad', url: 'javascript:alert(1)' },
      { title: 'NTSB report', url: 'https://www.ntsb.gov/Pages/Report.aspx' }
    ]
  });
  assert.equal(details.summary, 'NTSB notification rules.');
  assert.equal(details.links.length, 2);
  assert.equal(details.links[0].label, 'Part 830');
  assert.equal(details.links[1].label, 'NTSB report');
});

test('computeCourseReadiness requires full coverage and 80% score', () => {
  const halfDeck = computeCourseReadiness({
    cardCount: 100,
    studied: 50,
    cardsCorrect: 50
  });
  assert.equal(halfDeck.coverage_pct, 50);
  assert.equal(halfDeck.accuracy_pct, 100);
  assert.equal(halfDeck.readiness_pct, 50);
  assert.equal(halfDeck.ready, false);
  assert.equal(halfDeck.blocker, 'coverage');

  const weakFull = computeCourseReadiness({
    cardCount: 10,
    studied: 10,
    cardsCorrect: 7
  });
  assert.equal(weakFull.accuracy_pct, 70);
  assert.equal(weakFull.ready, false);
  assert.equal(weakFull.blocker, 'accuracy');
  assert.ok(weakFull.readiness_pct < 100);

  const ready = computeCourseReadiness({
    cardCount: 10,
    studied: 10,
    cardsCorrect: 8
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.readiness_pct, 100);
  assert.equal(ready.blocker, null);
});

test('progressByTrack topic percent uses last answer; hover keeps history', async () => {
  const store = createMemoryStore({
    tracks: [{ id: 'commercial', title: 'Commercial', sort_order: 1, status: 'ready' }],
    topics: [
      { id: 'comm_weather', track_id: 'commercial', title: 'Weather', sort_order: 10 },
      { id: 'comm_aero', track_id: 'commercial', title: 'Principles of flight', sort_order: 20 }
    ],
    cards: [
      { id: 'c1', track_id: 'commercial', topic_id: 'comm_weather', question: 'Q1', answer: 'A1' },
      { id: 'c2', track_id: 'commercial', topic_id: 'comm_weather', question: 'Q2', answer: 'A2' },
      { id: 'c3', track_id: 'commercial', topic_id: 'comm_aero', question: 'Q3', answer: 'A3' }
    ]
  });
  await store.upsertProgress('u1', 'c1', nextProgress(null, 'again'), { correct: false });
  await store.upsertProgress('u1', 'c1', nextProgress(null, 'good'), { correct: true });
  await store.upsertProgress('u1', 'c2', nextProgress(null, 'again'), { correct: false });
  await store.upsertProgress('u1', 'c3', nextProgress(null, 'easy'), { correct: true });
  const rows = await store.progressByTrack('u1');
  assert.equal(rows.length, 1);
  const weather = rows[0].topics.find((t) => t.id === 'comm_weather');
  const aero = rows[0].topics.find((t) => t.id === 'comm_aero');
  // Hover history still counts every graded attempt on the topic.
  assert.equal(weather.answers_total, 3);
  assert.equal(weather.answers_correct, 1);
  // Displayed % uses last answer per card only (c1 correct, c2 wrong → 50%).
  assert.equal(weather.correct_pct, 50);
  assert.equal(aero.correct_pct, 100);
  assert.equal(rows[0].readiness.coverage_pct, 100);
  assert.equal(rows[0].readiness.accuracy_pct, 67);
  assert.equal(rows[0].readiness.ready, false);
});

test('normalizeWeeklyQuizSize clamps to 1–100', () => {
  assert.equal(normalizeWeeklyQuizSize(20), 20);
  assert.equal(normalizeWeeklyQuizSize(0), 1);
  assert.equal(normalizeWeeklyQuizSize(999), 100);
  assert.equal(normalizeWeeklyQuizSize('15'), 15);
  assert.equal(normalizeWeeklyQuizSize('nope'), 20);
});

test('memory store resetWeeklyQuizScores clears answers and XP for the week', async () => {
  const store = createMemoryStore({
    tracks: [
      { id: 'commercial', title: 'Commercial', sort_order: 1, status: 'ready' },
      { id: 'cfi_g', title: 'CFI-G', sort_order: 2, status: 'ready' }
    ],
    topics: [
      { id: 'comm_a', track_id: 'commercial', title: 'Weather' },
      { id: 'cfi_a', track_id: 'cfi_g', title: 'FOI' }
    ],
    cards: [
      { id: 'c1', track_id: 'commercial', topic_id: 'comm_a', question: 'Q1', answer: 'A', choices: ['A', 'B'] },
      { id: 'c2', track_id: 'cfi_g', topic_id: 'cfi_a', question: 'Q2', answer: 'A', choices: ['A', 'B'] }
    ]
  });
  await store.setWeeklyQuizSize(2);
  const quiz = await store.getWeeklyQuizForUser('u1');
  await store.submitWeeklyQuizAnswer('u1', { cardId: quiz.cards[0].id, choice: 'A' });
  await store.submitWeeklyQuizAnswer('u2', { cardId: quiz.cards[0].id, choice: 'B' });
  assert.equal((await store.getWeeklyQuizForUser('u1')).answered_count, 1);
  assert.ok((await store.weeklyQuizLeagueSummary('u1')).you.week_total > 0);
  const reset = await store.resetWeeklyQuizScores();
  assert.equal(reset.answers_cleared, 2);
  assert.equal(reset.members_cleared, 2);
  assert.equal((await store.getWeeklyQuizForUser('u1')).answered_count, 0);
  assert.equal((await store.weeklyQuizLeagueSummary('u1')).you.week_total, 0);
  assert.equal((await store.getWeeklyQuizForUser('u1')).question_count, 2);
});

test('memory store weekly quiz size setting drives newly generated quizzes', async () => {
  const store = createMemoryStore({
    tracks: [
      { id: 'commercial', title: 'Commercial', sort_order: 1, status: 'ready' },
      { id: 'cfi_g', title: 'CFI-G', sort_order: 2, status: 'ready' }
    ],
    topics: [
      { id: 'comm_a', track_id: 'commercial', title: 'Weather' },
      { id: 'cfi_a', track_id: 'cfi_g', title: 'FOI' }
    ],
    cards: Array.from({ length: 12 }, (_, i) => ({
      id: `q${i}`,
      track_id: i % 2 === 0 ? 'commercial' : 'cfi_g',
      topic_id: i % 2 === 0 ? 'comm_a' : 'cfi_a',
      question: `Q${i}`,
      answer: 'A',
      choices: ['A', 'B']
    }))
  });
  assert.equal(await store.getWeeklyQuizSize(), 20);
  assert.equal(await store.setWeeklyQuizSize(5), 5);
  const quiz = await store.getWeeklyQuizForUser('u1');
  assert.equal(quiz.question_count, 5);
});

test('weekStartMonday and weekDateKeys cover Mon–Sun in Chicago', () => {
  // Wednesday Nov 25, 2026 CT → week starts Monday Nov 23
  const week = weekStartMonday(new Date('2026-11-25T18:00:00Z'));
  assert.equal(week, '2026-11-23');
  const days = weekDateKeys(week);
  assert.deepEqual(days, [
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
    '2026-11-27',
    '2026-11-28',
    '2026-11-29'
  ]);
});

test('pickWeeklyQuizCardIds spreads across topics and only uses commercial/cfi_g', () => {
  const cards = [
    { id: 'p1', track_id: 'private', topic_id: 'priv_a' },
    { id: 'c1', track_id: 'commercial', topic_id: 'comm_a' },
    { id: 'c2', track_id: 'commercial', topic_id: 'comm_a' },
    { id: 'c3', track_id: 'commercial', topic_id: 'comm_b' },
    { id: 'f1', track_id: 'cfi_g', topic_id: 'cfi_a' },
    { id: 'f2', track_id: 'cfi_g', topic_id: 'cfi_b' },
    { id: 'foi1', track_id: 'foi', topic_id: 'foi_a' }
  ];
  let i = 0;
  const seq = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.15, 0.85];
  const random = () => seq[i++ % seq.length];
  const picked = pickWeeklyQuizCardIds(cards, { count: 4, random });
  assert.equal(picked.length, 4);
  assert.ok(picked.every((id) => !['p1', 'foi1'].includes(id)));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const topics = new Set(picked.map((id) => byId.get(id).topic_id));
  assert.ok(topics.size >= 3);
  assert.deepEqual(WEEKLY_QUIZ_TRACKS, ['commercial', 'cfi_g']);
});

test('memory weekly quiz locks cards for the week and tracks quiz-only XP', async () => {
  const store = createMemoryStore({
    tracks: [
      { id: 'commercial', title: 'Commercial', sort_order: 1, status: 'ready' },
      { id: 'cfi_g', title: 'CFI-G', sort_order: 2, status: 'ready' },
      { id: 'private', title: 'Private', sort_order: 3, status: 'ready' }
    ],
    topics: [
      { id: 'comm_a', track_id: 'commercial', title: 'Weather' },
      { id: 'comm_b', track_id: 'commercial', title: 'Aero' },
      { id: 'cfi_a', track_id: 'cfi_g', title: 'FOI basics' },
      { id: 'priv_a', track_id: 'private', title: 'Private topic' }
    ],
    cards: [
      {
        id: 'c1',
        track_id: 'commercial',
        topic_id: 'comm_a',
        question: 'Q1',
        answer: 'A',
        choices: ['A', 'B'],
        figure: { number: 21, title: 'Sectional', url: 'https://example.com/fig21.png' },
        details: { summary: 'Teach sectional scale.', links: [{ label: 'PHAK', url: 'https://example.com/phak' }] }
      },
      { id: 'c2', track_id: 'commercial', topic_id: 'comm_b', question: 'Q2', answer: 'B', choices: ['A', 'B'] },
      { id: 'c3', track_id: 'cfi_g', topic_id: 'cfi_a', question: 'Q3', answer: 'A', choices: ['A', 'B'] },
      { id: 'p1', track_id: 'private', topic_id: 'priv_a', question: 'QP', answer: 'A', choices: ['A', 'B'] }
    ]
  });
  const quiz1 = await store.getWeeklyQuizForUser('u1');
  assert.equal(quiz1.question_count, 3);
  assert.ok(quiz1.cards.every((c) => c.track_id === 'commercial' || c.track_id === 'cfi_g'));
  assert.equal(quiz1.answered_count, 0);
  const figured = quiz1.cards.find((c) => c.id === 'c1');
  assert.equal(figured?.figure?.number, 21);
  assert.equal(figured?.figure?.url, 'https://example.com/fig21.png');
  assert.equal(figured?.has_details, true);
  assert.equal(figured?.details ?? null, null);
  assert.equal(quiz1.cards.find((c) => c.id === 'c2')?.figure ?? null, null);
  const quiz2 = await store.getWeeklyQuizForUser('u2');
  assert.deepEqual(
    quiz2.cards.map((c) => c.id),
    quiz1.cards.map((c) => c.id)
  );
  const first = quiz1.cards[0];
  const result = await store.submitWeeklyQuizAnswer('u1', {
    cardId: first.id,
    choice: first.choices[0]
  });
  assert.equal(typeof result.correct, 'boolean');
  assert.ok(result.xp === 1 || result.xp === 2);
  assert.equal(result.answered_count, 1);
  const again = await store.getWeeklyQuizForUser('u1');
  assert.equal(again.your_xp, result.xp);
  assert.ok(again.cards[0].answered);
  assert.equal(again.league.you.week_total, result.xp);
  const answeredFirst = again.cards.find((c) => c.id === first.id);
  if (first.id === 'c1') {
    assert.equal(answeredFirst?.details?.summary, 'Teach sectional scale.');
  }
  await assert.rejects(
    () => store.submitWeeklyQuizAnswer('u1', { cardId: first.id, choice: 'A' }),
    /already answered/
  );
  // Study XP path must not feed weekly quiz league.
  await store.recordAnswer('u1', 50);
  const league = await store.weeklyQuizLeagueSummary('u1');
  assert.equal(league.you.week_total, result.xp);
});
