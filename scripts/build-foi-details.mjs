/**
 * Build Details (summary + reference links) for FOI / Fundamentals of Instructing.
 * Regenerates foi_written_* entries in content/card-details.json.
 *
 * Rules:
 * - Match primarily on the question STEM (choices false-trigger too easily).
 * - Prefer CARD_OVERRIDES when a stem pattern would teach the wrong concept.
 * - Explain why the correct idea wins — do not paste the answer choice verbatim.
 *
 * Run: node scripts/build-foi-details.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const detailsPath = path.join(root, 'content', 'card-details.json');
const foiImportPath = path.join(root, 'content', 'foi-import', 'foi-import.json');

const AIH_URL =
  'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook';
const AIH_PDF =
  'https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook/aviation_instructors_handbook.pdf';

const LINKS = {
  aih: {
    label: 'Aviation Instructor’s Handbook (FAA-H-8083-9)',
    url: AIH_URL,
  },
  aihPdf: {
    label: 'AIH PDF (full handbook)',
    url: AIH_PDF,
  },
  aihLearning: {
    label: 'AIH — Learning Process',
    url: AIH_URL,
  },
  aihHuman: {
    label: 'AIH — Human Behavior & Effective Communication',
    url: AIH_URL,
  },
  aihTeaching: {
    label: 'AIH — The Teaching Process / Methods of Instruction',
    url: AIH_URL,
  },
  aihAssessment: {
    label: 'AIH — Assessment / Critique & Evaluation',
    url: AIH_URL,
  },
  aihPlanning: {
    label: 'AIH — Planning Instructional Activity',
    url: AIH_URL,
  },
  aihInstructor: {
    label: 'AIH — The Flight Instructor as a Professional',
    url: AIH_URL,
  },
  pts: {
    label: 'FAA Practical Test Standards / ACS',
    url: 'https://www.faa.gov/training_testing/testing/test_standards',
  },
  part61: {
    label: '14 CFR Part 61 — Certification: Instructors',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61',
  },
  ac6165: {
    label: 'AC 61-65 — Certification: Endorsements',
    url: 'https://www.faa.gov/regulations_policies/advisory_circulars',
  },
};

const TOPIC_LINKS = {
  foi_learning: [LINKS.aihLearning, LINKS.aihPdf],
  foi_human: [LINKS.aihHuman, LINKS.aihPdf],
  foi_teaching: [LINKS.aihTeaching, LINKS.aihPdf],
  foi_critique: [LINKS.aihAssessment, LINKS.aihPdf],
  foi_planning: [LINKS.aihPlanning, LINKS.aihPdf],
  foi_instructor: [LINKS.aihInstructor, LINKS.aihPdf],
  foi_misc: [LINKS.aih, LINKS.aihPdf],
};

const TOPIC_CONTEXT = {
  foi_learning:
    'Map the stem to the exact AIH learning term (principle, level, domain, memory, transfer). Nearby look-alikes are the usual trap.',
  foi_human:
    'Name the need layer, motivation type, or defense mechanism the stem describes before comparing choices.',
  foi_teaching:
    'Pick the method that fits the job: lecture for ideas, demo/performance for skills, guided discussion for shared reasoning.',
  foi_critique:
    'Critique and test items turn on purpose: improve performance, measure a standard, or write items that actually discriminate.',
  foi_planning:
    'Objectives and blocks of learning come first; syllabus and lesson plans only work when the student can see the path.',
  foi_instructor:
    'Professional instruction is measured by receiver understanding and behavior change — not by how much was transmitted.',
  foi_misc:
    'FOI misc items usually retest a nearby AIH definition. Prefer handbook wording over a casual synonym.',
};

/**
 * Per-card tips when stem keywords alone would teach the wrong concept.
 * Explain why the correct idea wins — avoid pasting the answer choice verbatim.
 */
const CARD_OVERRIDES = {
  foi_written_028:
    'An emergency scenario that forces the applicant to combine skills and adapt is probing correlation (highest learning level — connecting knowledge across new situations) — beyond single-procedure application.',
  foi_written_032:
    'Practice-session length is a primary planning constraint: too long breeds fatigue and sloppy habits; too short never reaches the objective.',
  foi_written_045:
    'Build habits with the building-block technique — each correct foundation before the next skill — so primacy (what is learned first sticks hardest) works for you, not against you.',
  foi_written_057:
    'Irrelevant questions and refusing to participate are aggression as a defense — acting out against the lesson when ego is threatened (not quiet repression).',
  foi_written_060:
    'Aggression often shows as refusing to participate, arguing, or attacking the activity when the student feels threatened.',
  foi_written_062:
    'When early gaps surface in advanced training, resignation (giving up / quitting effort) is the defense — the student stops trying rather than rebuild fundamentals.',
  foi_written_066:
    'Bluffing when unsure destroys student confidence — admit limits and look it up; students copy the honesty standard you model.',
  foi_written_082:
    'An introduction has three subparts, and the order is attention, then motivation, then overview. Attention comes first: a question, a short story, or a surprising fact that gets the learner listening. Until that happens, the rest of the opening is wasted. Motivation is next, and it has to be specific to this person — safer flying, the knowledge test, or the maneuver they are about to fly — so they have a reason to stay with the lesson. Overview is last in the opening. It names the objective and what will be covered. It is a roadmap, not the lesson itself. Development is the body of the lesson and starts only after the introduction is finished, so it is not an introduction subpart. Conclusion comes after development: it retraces the important points and ties them back to the objective, and it is the wrong place to open. Starting with the overview skips both the grab for attention and the reason to care.',
  foi_written_089:
    'Poor grammar and vulgar language undercut instructor dignity and insult student intelligence — lecture language must stay clean and correct.',
  foi_written_100:
    'Guided-discussion learning rides on skillful questioning — the instructor’s questions steer the interchange toward the objective.',
  foi_written_112:
    'Critique while the performance is fresh — immediately after — so details are accurate and the student can still connect feedback to what just happened.',
  foi_written_113:
    'A critique’s job is direction and guidance to improve the next try — not a score dump or a personality review.',
  foi_written_118:
    'PTS/ACS exist to certificate pilots at a high level of safety — the published standards are the safety bar, not a maneuver shopping list.',
  foi_written_119:
    'Oral quizzing’s payoff is spotting what needs more emphasis before the lesson ends — so you can reteach while it still matters.',
  foi_written_120:
    'Good oral quizzes also mirror back how well your training procedures are working — weak answers flag the teaching, not only the student.',
  foi_written_121:
    'Effective oral questions are brief and concise — one clear idea — so the student answers the point you meant to check.',
  foi_written_122:
    'Memory/recall checks are fact questions (rote). “Explain how/why” and scenario items climb to understanding and above.',
  foi_written_123:
    'Oral questions must match that stage’s difficulty — too hard breeds guessing and threat; too easy teaches nothing.',
  foi_written_131:
    'Supply-type (write-in) items’ main drawback is uneven grading — different instructors often score the same answer differently.',
  foi_written_132:
    'Supply-type answers are hard to grade uniformly: the same paper can get different marks from different instructors.',
  foi_written_133:
    'Selection-type items grade objectively — same key for every student and grader — which supply-type write-ins rarely match.',
  foi_written_135:
    'Higher-level MC items need several acceptable-looking options with only one clearly best — that forces judgment, not trivia lookup.',
  foi_written_136:
    'Keep MC alternatives about equal length so students cannot “guess the longest.” Equal length is a classic effective-item rule.',
  foi_written_077:
    'A skill such as the flight computer is taught by demonstration/performance: you explain the procedure, show it, then the student performs it while you supervise, and you evaluate that performance against the standard. “Performance” means the student does the skill — not that the lesson went well. Lecture/application mostly tells the idea and leaves the doing for later. Presentation/practice is not the handbook method for a hands-on procedure.',
  foi_written_104:
    'Demonstration/performance has five steps, in order. Explanation: what to do and what “done” looks like. Demonstration: you show the skill. Student performance: they do it. Instructor supervision: you coach while they do it. Evaluation: they perform it on their own and you judge that performance against the standard. The short lists drop explanation or supervision. Those steps are required, not optional.',
  foi_written_105:
    'In demonstration/performance, the two actions that happen at the same time are student performance and instructor supervision: the student does the skill while you watch and coach. Explanation comes first, then your demonstration. Those are earlier, separate steps, not the concurrent pair. The student does not demonstrate while you are still explaining.',
  foi_written_106:
    'The last step of demonstration/performance is evaluation. The student performs the skill independently, and you judge that performance against the way it was taught. A summary belongs to a discussion, not to the close of this method. Student performance comes before the judgment; it is not the last step.',
  foi_written_110:
    'A critique of performance should be constructive and objective. Constructive means you show how to do the next try better — praise for its own sake does not count. Objective means you judge the performance that happened, not the student’s personality. It should not treat every aspect in detail; a comprehensive critique still picks the points worth improving.',
  foi_written_111:
    'Students accept a critique of their performance only after they accept the instructor — confidence in competence and sincerity comes first. Charm or personality does not substitute for that. A critique that only emphasizes the positive is still not what makes the criticism acceptable.',
  foi_written_114:
    'A critique of performance should be constructive and objective. Constructive means you show how to do the next try better — praise for its own sake does not count. Objective means you judge the performance that happened, not the student’s personality. It should not treat every aspect in detail; a comprehensive critique still picks the points worth improving.',
  foi_written_117:
    'A practical test is criterion-referenced (scored against a fixed published standard, not a curve): every applicant is scored against the practical test standards, not ranked against the other people who tested that day. Norm-referenced (ranked against other students rather than a fixed standard) testing is a curve, and that is the wrong model for a certificate. “Evaluation-referenced” is not a test type. The practical exists so every successful pilot meets the same safety standard.',
  foi_written_125:
    'Validity means the test measures what it is supposed to measure. A stall-recovery quiz that actually checks stall recovery is valid; a trivia sheet that happens to mention airplanes is not, even if every instructor would score it the same way. “Yields consistent results” is reliability — the same score again, even if you measured the wrong thing. “Samples liberally” is comprehensiveness — broad coverage — not whether the items measure the objective.',
  foi_written_126:
    'Reliability means the test yields consistent results: repeat the measurement and the same student gets about the same score. Consistency is not the same as measuring the right thing. “Actually measures what it is supposed to measure” is validity. “Measures small differences in the achievement of students” is discrimination — separating high achievement from low — not reliability.',
  foi_written_127:
    'Discrimination is the characteristic that measures small differences in achievement between students. Masters score up, non-masters score down, and you can tell them apart. Validity only asks whether the test measures the objective at all. Reliability only asks whether it gives consistent results. A test can be perfectly consistent and still fail to separate high achievement from low.',
  foi_written_128:
    'A test with discrimination distinguishes students who are low in achievement from those who are high: scores spread out instead of everyone landing in the same pile. “Easy to give and easily graded” is usability — convenient to administer, not a measure of who mastered the objective. “A representative and comprehensive sampling of the course objectives” is comprehensiveness — breadth of coverage — not discrimination.',
  foi_written_129:
    'A written test is comprehensive when it samples liberally whatever is being measured: a wide cut across the objectives, not one favorite topic asked over and over. “Includes all levels of difficulty” describes how hard the items are, not how broadly they sample. “Measures knowledge of the same topic in many different ways” is still one topic. Liberal sampling means breadth.',
  foi_written_137:
    'Matching is a selection-type item: the student pairs each premise (left) with one response (right) from a shared list. Guessing is harder than on a single multiple-choice question because a wrong pair “uses up” a response and can spoil later pairs — random luck does not stay independent item-to-item. True/false is ~50% per item; one MC item is often 25–33% if you guess; a matching set compounds those odds downward. Essay is supply-type (write-in), so it is not in the selection-type family this stem asks about.',
  foi_written_138:
    'A performance test is the learner doing the operation, procedure, or process while you watch and score that doing against a standard — a stall recovery, a preflight, a weight-and-balance they actually complete. An oral test only asks them to explain the steps. Someone can describe a slip perfectly and still fly it wrong, so talk does not evaluate the operation. Proficiency is not a test type in this list: it is how well they can do the skill, or a later proficiency check. The handbook’s name for the test that evaluates an operation, procedure, or process is performance.',
  foi_written_148:
    'A pretest of the knowledge and skills needed to begin a course is a criterion-referenced (scored against a fixed published standard, not a curve) check: each student is scored against the start standard, “ready to begin,” not ranked against the other people in the room. A norm-referenced (ranked against other students rather than a fixed standard) pretest would only tell you who is ahead of whom. Virtual reality is a training device, not this test type.',
  foi_written_151:
    'An adequate standard of performance means an important item is learned, not half-learned. Letting a student move on with a partial grasp of a critical knowledge item or skill is a failure to instruct. Raising the relationship by refusing to enforce standards does the opposite. Continuous evaluation matters, but this item’s point is the standard itself: partial learning of something important is not competent instruction.',
  foi_written_154:
    'Judge demonstrated piloting ability against established standards of performance, then suit those standards to this student’s experience and to the conditions of the flight. The instructor’s own background is not the scale. Hours logged since the first lesson are not the scale either. “Performance” here is the flying you just watched, measured against the standard — not a general impression of progress.',
  foi_written_155:
    'Judge demonstrated piloting ability against established standards of performance. “How much progress” and “what the instructor thinks of the maneuver” are not the scale. The standard says what the performance had to look like; experience may change how you apply it, but opinion does not replace it.',
  foi_written_164:
    'Flight instruction’s telling-and-doing form of demonstration/performance runs in four steps. Instructor tells — instructor does: you narrate while you fly it. Student tells — instructor does: they talk the steps while you still fly. Student tells — student does: they narrate their own performance while they fly. Student does — instructor evaluates: they perform it and you judge that performance. The traps skip a step. You do not start with the student doing it, and you do not skip the rehearsal where they tell and do before you only watch.',
  foi_written_234:
    'Criterion-referenced (scored against a fixed published standard, not a curve) tests are built from performance-based objectives: a description of the skill or behavior the student must show, the conditions they do it under, and the criteria that say the performance met the standard. That is not a norm-based objective, which would compare students to each other. It is also not subjective — the criteria are written so any competent reader can tell whether the performance passed. “Performance” here means the observable skill, not a vague sense that the lesson went well.',
  foi_written_241:
    'Authentic assessment (evaluation using real-world tasks, not only paper quizzes) asks the student to use critical thinking on a real task and generate the solution — a scenario they have to decide or fly, with the standard known ahead of time. It checks application and correlation (highest learning level — connecting knowledge across new situations), not only recall. Traditional assessment is a written item with one memorized answer. “Practical assessment” sounds like a checkride, but it is not the handbook name for evaluating critical thinking on real-world tasks.',
  foi_written_251:
    'A performance-based objective has three parts, and all three are required. Description of the skill or behavior: the observable outcome, such as “plan and fly from A to B,” not an unmeasurable “awareness of navigation.” Conditions: the rules and tools, such as “using a sectional, a flight computer, and this glider.” Criteria: the standard that decides whether the performance passed, such as “arrive within five minutes and hold altitude within 200 feet.” Cognitive (knowledge / intellectual domain), affective (attitudes, beliefs, and values domain), and psychomotor (physical-skill domain of learning) are the learning domains, a different list. Scenarios and judgment checks are training tools, not the three parts of the objective.',
  foi_written_269:
    'Authentic assessment (evaluation using real-world tasks, not only paper quizzes) focuses on real-world skills: the learner performs a realistic task and is judged on that performance, not on picking a memorized answer. Traditional assessment is the written test with one correct answer. Collaborative grading is a way of scoring with the learner; it is not the assessment type that targets real-world skills.',
  foi_written_156:
    'While evaluating, keep the student informed of progress — feedback during/after the demo is part of teaching, not only scoring.',
  foi_written_181:
    'The four teaching steps are preparation, presentation, application, and review/evaluation — a complete lesson plan covers all four.',
  foi_written_195:
    'Rote items are selection-style recall (T/F, MC). Supply-type write-ins are a different animal — do not treat them as the rote example.',
  foi_written_196:
    'True/false is a classic rote (memorizing facts without real understanding) item — it checks recall, not explanation or application.',
  foi_written_198:
    'Selection-type items promote guessing because the options are listed; supply-type write-ins force the student to produce the answer.',
  foi_written_207:
    'Acute fatigue is the short-term tiredness after a stretch of strain: hard physical work, a heavy mental load, monotony, strong emotion, or lost sleep. A normal rest and a night of sleep usually clear it. In the lesson it shows up as errors in timing and neglect of secondary tasks — the late turn, the skipped checklist call, the traffic scan that drops — along with inattention, distractibility, sloppier control, irritability, and not noticing those errors stacking up. The learner often does not feel it until exhaustion, so fatigue can stay hidden until a serious mistake. Stop the lesson. Pushing through practices the bad timing. A combination of physiological problems and psychological issues is the definition of chronic fatigue, which builds when repeated acute episodes never get a full recovery and is not fixed by one night of sleep. A lack of physical robustness or mental acuity is the wear from ongoing stress such as money, home, or the job. That is not how one hard day shows up.',
  foi_written_216:
    'Chronic fatigue is what is left when repeated episodes of acute fatigue never get a full recovery. Sleep, rest, and a day off keep getting cut short, so the tiredness stacks. It is a mix of physical depletion and psychological load — money, home, or job stress — and one night of sleep does not clear it. The person may need a physician, not another early lesson. What you see is weakness, lasting tiredness, heart palpitations, breathlessness, headaches, irritability, and accepting unwarranted risks. Judgment is impaired. Tiredness after one long stretch of physical or mental strain and lost sleep is acute fatigue, and that kind usually yields to rest. The claim that fatigue hurts performance and ability but leaves judgment alone is the trap: unwarranted risk is a judgment failure, and the person often does not notice the fatigue until a serious mistake. Do not schedule “one more flight” on top of an unrecovered week.',
  foi_written_217:
    'The student-pilot clue for chronic fatigue is accepting unwarranted risks. Judgment is worn down, so a normally conservative student agrees to the gusty pattern, the skipped checklist, or the “we can make it” launch they would have refused last month. That is the evidence the handbook names, and it is easy to mistake for new confidence. Knowledge and skill retention do not go up. Fatigue degrades attention, timing, and memory, so “they are retaining more” is the opposite of what you are seeing. A need for sleep is the acute-fatigue picture: one hard day, and rest usually clears it. Acute fatigue in the lesson shows up as neglected secondary tasks, not as a taste for extra risk. Chronic fatigue has already stacked past that. One night of sleep does not clear it, and praising the bold call trains the bad judgment. Stop the lesson.',
  foi_written_218:
    'Acute fatigue shrinks the attention that is left, so the student spends all of it on the task that feels necessary to stay flying: pitch, bank, and the control input in their hand. A secondary task is anything that can wait a few seconds without the glider immediately departing — the radio call, a checklist item, the traffic scan, clearing the turn, the altimeter, the yaw string, the next leg of the pattern. Switching to those takes spare capacity. Fatigue removes that spare capacity, so the switch never happens and the secondary task is simply dropped. Timing slips for the same reason, and the student often does not notice the misses stacking up. Intense focus on the stick is easy to misread as sharper attention to detail. Detail is getting worse, not better. Accepting unwarranted risks is the chronic-fatigue clue, from judgment worn down across unrecovered days, not from one hard day. Rest and sleep usually clear acute fatigue. Stop the lesson before the dropped scan becomes the habit.',
  foi_written_224:
    'A lesson objective is the purpose of this hour: what the student will be able to do, and why that step matters on the way to solo or the certificate. Motivation is the reason to put in the effort. When the objective is missing, the student still wants to learn to fly. The desire is there. This hour just has no visible payoff, so the reason to work at this particular lesson gets weaker. They become less motivated. Apathy is a different failure. Apathy is indifference: the student stops caring about the lesson and about whether the instructor is trying. The handbook ties that to recognizing the instructor is unprepared, not to a missing objective. An unclear objective dulls the reason to try. An unprepared instructor makes the student give up on the hour. “Motivated to see the big picture” is what a clear objective produces. The objective is how you show where this maneuver sits in the larger goal. Without it, that boost never starts.',
  foi_written_243:
    'A normal reaction to stress is the trained one. The student responds rapidly and exactly, often automatically, within the limits of their experience: the rope breaks and the recovery they have practiced comes out. That choice on this card describes the normal reaction, so it is the wrong description of an abnormal one. An abnormal reaction is a response that does not meet the situation. The handbook’s name for that is inadequate or completely absent. Absent means they freeze. The tow breaks, they stay on the controls, and none of the recovery they have practiced comes out. Inadequate means something comes out, but it does not solve the problem: a random or illogical action, or more than the situation calls for. Extreme over-cooperation, painstaking self-control, inappropriate laughter or singing, and sudden anger are examples of an inadequate response. They look busy or emotional, and they still fail to do the thing the emergency requires. Slow learning is a rate across many lessons, not what the student does in the moment of stress. A slow learner can still fly the recovery correctly when something goes wrong. Get the glider safe first. A freeze is not “they are thinking it through.”',
  foi_written_047:
    'The affective domain is what the student feels, believes, and is willing to act on. Knowing the go-around procedure is knowledge, the cognitive domain. Flying the go-around with hands and feet is a physical skill, the psychomotor domain. Choosing to go around on an unstable approach, because the student values the standard more than saving the landing, is affective. Attitudes, beliefs, and values are that third piece: motivation, respect for the checklist, and whether safety is something they actually hold. The domain runs from merely hearing the instructor, up through responding and valuing, to the point where the value is part of who the pilot is. A student can recite the rule and fly the maneuver and still treat the standard as optional. That gap is affective, and more practice of the stick does not close it.',
  foi_written_262:
    'Denial refuses a fact that threatens the student’s picture of themselves, and the way that refusal shows up is minimizing the situation. The approach was unstable, and they say it was only a little fast. The glider was low on tow, and they say everyone does that. The event is still there. They have made it small enough that nothing has to change. That shrink is the defense. Becoming visibly angry, upset, or childish is the outburst people expect from aggression. Denial is usually quiet and dismissive, not a blow-up. Justifying the action by asking numerous questions is building a case. That is rationalization: an excuse that sounds reasonable so the real reason never has to be faced. Denial does not argue the case. It makes the problem too small to need one. Put the fact back at full size, gently, with the standard and what you both saw.',
  foi_written_226:
    'E-learning enhances learning because less time can be spent on instruction than in a traditional classroom: a well-designed program lets the learner move through what they already know and spend the time on what they do not. The learner controls the pace, not the instructor. Limited peer interaction and personal feedback is a drawback of some e-learning, not the reason it works. The software also does not replace the instructor when the objective is a hands-on skill.',
  foi_written_232:
    'Introduce PTS/ACS early in training — waiting until the last practical-test prep hour leaves no time to train to the standard.',
  foi_written_233:
    'The most common assessment is oral questioning (direct or indirect) by the instructor — quick, flexible checks during the lesson.',
  foi_written_235:
    'Oral quizzing’s desirable result is identifying points that need more emphasis so you can fix them in the same lesson block.',
  foi_written_236:
    'Effective oral questions stay brief and concise — one idea per question — during the lesson.',
  foi_written_239:
    'Commercial test-prep material often over-weights rote recall versus higher learning levels — use it as a supplement, not the syllabus.',
  foi_written_266:
    'Bring students to the practical-test standards early in the course — not only in the final few hours before the checkride.',
  foi_written_276:
    'Airplane performance, local airspace, and the regulations belong on the pre-solo knowledge test the instructor gives and reviews before first solo (§ 61.87(b)). The aeronautical knowledge test is the later FAA written, and the practical test is the checkride.',
};

/**
 * Stem-specific tips. Order matters: first match wins (then optional second).
 * Keep patterns tight to the question wording.
 */
const STEM_NOTES = [
  // ── Principles of learning ─────────────────────────────────────────────
  {
    re: /change in behavior as a result of experience/,
    note: 'FOI defines learning as a change in behavior from experience — mere exposure without usable change does not qualify.',
  },
  {
    re: /verbal, conceptual/,
    note: 'Learning has several elements (verbal, conceptual, perceptual, motor, problem solving, emotional). Do not shrink it to “memorizing words.”',
  },
  {
    re: /additional learning is called|learning other things as well/,
    note: 'Side learning that happens while the planned objective is taught is incidental — attitudes and habits often form there.',
  },
  {
    re: /clear objective.*principle|principle of readiness/,
    note: 'Principles map: clear objective/prepared learner → readiness; practice toward a goal → exercise; emotional result → effect; first-learned → primacy; vivid/real → intensity; last-practiced → recency.',
  },
  {
    re: /opportunities for a student to practice|principle of exercise/,
    note: 'Practice directed toward a goal is exercise. Undirected repetition is not the same principle.',
  },
  {
    re: /emotional reaction of the learner|principle of effect/,
    note: 'Effect ties learning to the learner’s emotional result — satisfying outcomes stick; threat and frustration work against retention.',
  },
  {
    re: /things most often repeated|often repeated are best remembered/,
    note: '“Most often repeated → best remembered” is exercise (use it or lose it), not recency or intensity.',
  },
  {
    re: /real thing than from a substitute|principle of intensity/,
    note: 'Intensity: vivid, realistic, or striking experiences beat dull substitutes. “Real thing vs substitute” is the intensity clue.',
  },
  {
    re: /sequence of lectures within a course|principle of recency/,
    note: 'Recency often drives course/lecture order — put what must be remembered last, and review critical items at the end.',
  },
  {
    re: /often creates a strong impression/,
    note: 'A “strong first impression” clue points to primacy: teach it correctly the first time; unlearning is expensive.',
  },
  {
    re: /basis of all learning/,
    note: 'Perception is the starting gate — all higher learning builds on how the student senses and interprets the situation.',
  },

  // ── Perception / insight ───────────────────────────────────────────────
  {
    re: /basic need that affects all of a person's perceptions|need to maintain|self.?image|self.?concept/,
    note: 'Self-concept filters perception: people protect a favorable picture of themselves, which can block new training.',
  },
  {
    re: /properly planned training syllabus/,
    note: 'Time and opportunity (via a planned syllabus) is a perception factor — unscheduled or cramped training never “clicks.”',
  },
  {
    re: /factor affecting perception has a great influence|total perceptual process/,
    note: 'Self-concept has outsized influence on the whole perceptual process — more than a single lesson gadget.',
  },
  {
    re: /perceptions result when a person/,
    note: 'Perceptions are meanings given to sensations from experience — not raw sensory data alone.',
  },
  {
    re: /failure to remain receptive|reject additional training/,
    note: 'Negative self-concept is the big receptivity killer; threatened ego rejects more training.',
  },
  {
    re: /mental grouping of affiliated perceptions/,
    note: 'Insights are grouped perceptions that suddenly “fit” — help students assemble the pieces, do not just pile facts.',
  },
  {
    re: /foster the development of insights|help develop student insights|insights, as applied/,
    note: 'Build insight by keeping a favorable self-concept and pointing out relationships — fear and threat shrink insight.',
  },
  {
    re: /fear or the element of threat will/,
    note: 'Threat narrows perception and blocks learning; keep standards clear without intimidation.',
  },

  // ── Motivation ─────────────────────────────────────────────────────────
  {
    re: /statement is true concerning motivations/,
    note: 'Motivations may be subtle and hard to spot; negative fear-based pushes are poor tools compared with positive, tangible ones.',
  },
  {
    re: /motivations that cause a student to react with fear/,
    note: 'Fear/anxiety motivations are negative — avoid them except in rare, carefully judged cases.',
  },
  {
    re: /efforts will be rewarded in a definite manner|type of motivation is/,
    note: 'When students must believe effort brings a definite reward, that motivation is tangible (positive and concrete).',
  },
  {
    re: /more effective way for an instructor to properly motivate/,
    note: 'Positive motivation beats reproof (harsh criticism or scolding). Make the reward/outcome visible and believable.',
  },
  {
    re: /reproof and threats should be avoided with all but/,
    note: 'Reproof (harsh criticism/scolding) and threats are almost always wrong; the rare exception is the overconfident, impulsive student — still use carefully.',
  },

  // ── Levels of learning ─────────────────────────────────────────────────
  {
    re: /maneuvering speed of the aircraft listed|level of knowledge is being tested if asked/,
    note: '“What is the book number?” is rote. Explaining relationships is understanding; using knowledge in a problem is application; connecting across domains is correlation.',
  },
  {
    re: /simulated engine fail|complete .ss of engine power/,
    note: 'An emergency scenario that forces combining skills and adapting probes correlation — beyond single-procedure application or rote recall.',
  },
  {
    re: /level of learning is being tested/,
    note: 'Match the verb in the stem to the level: name/list → rote; explain → understanding; use in a problem → application; adapt across situations → correlation.',
  },
  {
    re: /explain how gross weight affects/,
    note: '“Explain how/why” probes understanding. Naming a handbook number is rote; flying the scenario is application.',
  },
  {
    re: /level of learning do most instructors stop/,
    note: 'Many instructors stop at understanding. Push through application toward correlation so knowledge transfers to new situations.',
  },

  // ── Memory / forgetting / transfer ─────────────────────────────────────
  {
    re: /best way to prepare a student to perform a task/,
    note: 'Show a clear step-by-step example before the student tries — purpose talks and bare outlines leave the how-to fuzzy.',
  },
  {
    re: /primary consideration in planning for student performance/,
    note: 'Plan from the student’s present ability. Objectives must be reachable from where the learner actually is.',
  },
  {
    re: /learning plateau may be defined|regarding learning plateaus/,
    note: 'A plateau is a normal temporary leveling of the learning curve — not permanent failure. Vary practice and refresh goals.',
  },
  {
    re: /submerging an unpleasant experience/,
    note: 'Forcing unpleasant experience into the subconscious is repression (a forgetting theory), not ordinary disuse.',
  },
  {
    re: /learning of similar things overshadows|interference/,
    note: 'When similar learning crowds out other learning, that forgetting path is interference.',
  },
  {
    re: /difficulty recalling facts after several years|disuse/,
    note: 'Fading after long unused time is disuse — different from repression or interference.',
  },
  {
    re: /responses that produce a pleasurable return/,
    note: 'Pleasurable returns reinforce the behavior (effect / positive feedback). Make praise specific and timely.',
  },
  {
    re: /transfer of learning occurs when.*interferes|negative transfer/,
    note: 'When one maneuver hurts learning another, that is negative transfer — redesign practice so skills support each other.',
  },
  {
    re: /rectangular patterns helps a student fly traffic|positive transfer/,
    note: 'When early practice helps a later skill, that is positive transfer — design rectangular patterns → traffic patterns on purpose.',
  },
  {
    re: /memory system processes input from the environment/,
    note: 'Sensory memory is the first gate that takes environmental input before short-term encoding.',
  },
  {
    re: /rhymes or mnemonics|association, such as/,
    note: 'Mnemonics/associations help short-term encoding into longer retention — they are tools for the working-memory stage.',
  },
  {
    re: /how can encoding be described/,
    note: 'Encoding is the transform from short-term processing into a storeable long-term form.',
  },
  {
    re: /information for future use stored/,
    note: 'Long-term memory is the store for future use; short-term only holds briefly while you work with it.',
  },

  // ── Domains / taxonomy ─────────────────────────────────────────────────
  {
    re: /when has instruction taken place/,
    note: 'Instruction happened only when explanation plus the desired student response occurred — talking at someone is not enough.',
  },
  {
    re: /ensure proper habits and correct techniques/,
    note: 'Correct habits early (primacy). Tolerating sloppy practice trains the wrong habit permanently.',
  },
  {
    re: /domain of learning deals with knowledge/,
    note: 'Cognitive domain = knowledge. Affective = attitudes/values. Psychomotor = physical skill.',
  },
  {
    re: /affective domain/,
    note: 'Affective domain is attitudes, beliefs, and values — not stick-and-rudder skill.',
  },
  {
    re: /educational objective levels for the cognitive domain/,
    note: 'Cognitive levels climb from knowledge/recall up through increasingly complex intellectual skills — know the ladder order.',
  },
  {
    re: /hierarchy of objectives is often referred/,
    note: 'A ranked hierarchy of educational objectives is a taxonomy.',
  },
  {
    re: /most complex outcome in the affective domain/,
    note: 'Affective outcomes climb to characterization/internalizing a value system — far above simple awareness.',
  },
  {
    re: /least complex outcome in the psychomotor domain/,
    note: 'Psychomotor starts at simple perception/imitation and climbs to skilled, automatic performance.',
  },

  // ── Human needs / defense mechanisms ───────────────────────────────────
  {
    re: /before a student can concentrate on learning, which human needs/,
    note: 'Physiological and security needs come first. Hungry, cold, or scared students do not learn well.',
  },
  {
    re: /physically comfortable and have no fear for their safety/,
    note: 'After comfort and safety, belonging / social needs take the lead in Maslow’s stack.',
  },
  {
    re: /human needs offer the greatest challenge to an instructor/,
    note: 'Esteem and self-actualization usually challenge instructors most once basics are met.',
  },
  {
    re: /excuses to justify inadequate performance/,
    note: 'That excuse-making pattern is rationalization (making weak performance sound reasonable to protect ego).',
  },
  {
    re: /defense mechanisms can serve a useful purpose/,
    note: 'Defenses can blunt stress briefly, but they also distort reality and block learning if they become habitual.',
  },
  {
    re: /irrelevant questions or refuses to participate/,
    note: 'Irrelevant questions and refusing to participate are aggression as a defense — acting out when ego is threatened.',
  },
  {
    re: /physical or mental flight is a defense/,
    note: 'Flight (physical or mental escape) appears when the student cannot face the threatening situation.',
  },
  {
    re: /defense mechanism called rationalization/,
    note: 'Rationalization: subconscious excuses that make inadequate performance sound reasonable.',
  },
  {
    re: /defense mechanism called aggression/,
    note: 'Aggression as defense: blame, anger, or attacking others when ego is threatened.',
  },
  {
    re: /daydreaming, it is a defense mechanism/,
    note: 'Daydreaming as escape is fantasy — mental flight into a safer imagined world.',
  },
  {
    re: /bewildered and lost in the advanced phase|without grasping the fundamentals/,
    note: 'When early gaps surface in advanced work, resignation (giving up) is common — rebuild fundamentals instead of pushing ahead.',
  },
  {
    re: /students becoming frustrated/,
    note: 'Frustration spikes when goals are unclear, unfair, or unreachable — or when progress is invisible.',
  },
  {
    re: /unable to see the benefits or purpose of a lesson/,
    note: 'No visible purpose → apathy or rejection. Always tie the lesson to a benefit the student accepts.',
  },
  {
    re: /keeps the student informed of lesson objectives|minimizes the student's feelings/,
    note: 'Clear objectives and completion standards reduce insecurity and insecurity-driven defenses.',
  },
  {
    re: /student confidence tends to be destroyed/,
    note: 'Ridicule, moving goalposts, and unfair standards destroy confidence fast.',
  },

  // ── Communication ──────────────────────────────────────────────────────
  {
    re: /effectiveness of communication between instructor and student is measured/,
    note: 'Communication is measured by understanding and the resulting behavior change — not by volume transmitted.',
  },
  {
    re: /speak or write from a background of/,
    note: 'Speak from shared experience the student can hook onto; jargon without common ground fails.',
  },
  {
    re: /to communicate effectively, instructors must/,
    note: 'Reveal meaning in terms the student can experience — reveal, do not merely announce.',
  },
  {
    re: /effective communication has taken place when, and only when/,
    note: 'Success = receivers understand and change behavior accordingly. “I said it” is not enough.',
  },
  {
    re: /gaining and retaining the receiver's attention/,
    note: 'Vary the communicative approach to gain and hold attention — sameness loses the room.',
  },
  {
    re: /using abstractions in the communication process/,
    note: 'Abstractions rarely evoke the concrete experience you intend — listeners fill in the wrong picture.',
  },
  {
    re: /danger in using abstract words/,
    note: 'Abstract words let each listener invent a different meaning — prefer concrete, shared examples.',
  },
  {
    re: /greatest single barrier to effective communication/,
    note: 'The biggest teaching communication barrier is lack of common experience between instructor and student.',
  },
  {
    re: /words cannot communicate the desired meaning.*unless/,
    note: 'Words work only when they tie to the listener’s experience — otherwise they are empty sounds.',
  },

  // ── Teaching process / methods ─────────────────────────────────────────
  {
    re: /teaching process can be divided into which steps/,
    note: 'Teaching process: preparation → presentation → application → review/evaluation. Skipping application/evaluation only “covers” material.',
  },
  {
    re: /desirable for teaching a skill such as ground school lesson on the flight computer/,
    note: 'A skill such as the flight computer is taught by demonstration/performance: explain it, show it, then the student performs it while you supervise and you evaluate that performance. “Performance” means the student does the skill.',
  },
  {
    re: /statement is true regarding student evaluation/,
    note: 'Evaluate against the lesson’s stated objectives and standards — not personality or “better than yesterday.”',
  },
  {
    re: /suitable for presenting new material.*summarizing ideas|showing relationships between theo/,
    note: 'Lecture fits new ideas, summaries, and theory↔practice links when you need efficient one-to-many delivery.',
  },
  {
    re: /evaluation of student performance and accomplishment during a lesson should be based/,
    note: 'Base in-lesson evaluation on objectives and completion standards established for that lesson.',
  },
  {
    re: /acceptance of further instruction/,
    note: 'Keep the student informed of progress and standards — informed students accept the next lesson more readily.',
  },
  {
    re: /proper sequence for the subparts of an introduction/,
    note: 'Introduction subparts run attention, then motivation, then overview. Attention gets them listening, motivation gives a specific reason this lesson matters, and the overview is only the roadmap. Development is the body after the introduction. Conclusion closes the lesson after development.',
  },
  {
    re: /organizing lesson material, which step sets the stage/,
    note: 'The introduction sets the stage for everything that follows.',
  },
  {
    re: /simple to complex, past to present, and known to unknown/,
    note: 'Simple→complex, past→present, known→unknown is the classic organization that matches how people build understanding.',
  },
  {
    re: /teaching from the known to the unknown/,
    note: 'Known→unknown uses the student’s existing experience as the hook for new material.',
  },
  {
    re: /organize explanations and demonstrations to help the student/,
    note: 'Organize demos/explanations so the student sees relationships — connect new ideas to what they already know.',
  },
  {
    re: /first step in preparing a lecture/,
    note: 'Start lecture prep by establishing the objective and what the listener should leave knowing/doing.',
  },
  {
    re: /true statement regarding the teaching lecture/,
    note: 'Formal lectures are instructor-centered and efficient for coverage; they need support for application afterward.',
  },
  {
    re: /detract from an instructor's dignity/,
    note: 'Poor grammar and vulgar language undercut instructor dignity and insult student intelligence — keep lecture language clean and correct.',
  },
  {
    re: /one advantage of a lecture/,
    note: 'Lecture’s big advantage is time economy — lots of material to many people quickly.',
  },
  {
    re: /active student participation during informal lectures/,
    note: 'Informal lectures invite participation with questions — that is their distinguishing feature.',
  },
  {
    re: /distinguishing characteristic of an informal lecture/,
    note: 'Informal lecture = student participation / questions welcomed, unlike a pure formal lecture.',
  },
  {
    re: /most economical in terms of the time required/,
    note: 'Lecture is the most time-economical method for presenting a given amount of material.',
  },
  {
    re: /most significant characteristic of group learning/,
    note: 'Group learning’s key trait is students learning with and from each other, not only from the instructor.',
  },
  {
    re: /advantage\(s\) with heterogeneous groups/,
    note: 'Mixed-ability groups often raise peer teaching and expose students to more viewpoints.',
  },
  {
    re: /cooperative learning groups is so they|maximize their own and each other's learning/,
    note: 'Cooperative learning aims for mutual success — students help themselves and each other, not compete for one grade.',
  },
  {
    re: /question directed to an entire group to stimulate thought/,
    note: 'A question aimed at the whole group to spark thought is an overhead (or leadoff) question.',
  },
  {
    re: /guided discussion method of teaching is true|guided discussion, learning is achieved/,
    note: 'Guided discussion builds learning through controlled student interchange — instructor steers, students reason aloud.',
  },
  {
    re: /leadoff question for a guided discussion|leadoff questions should usually begin/,
    note: 'Leadoff questions are open (why/how/what) and aimed to start discussion, not yes/no closed ends.',
  },
  {
    re: /students have adequately discussed the ideas|guided discussion/,
    note: 'When discussion has run its course, summarize and tie ideas back to the objective before moving on.',
  },
  {
    re: /essential steps in the demonstration\/performance/,
    note: 'Demonstration/performance has five steps: explanation, demonstration, student performance, instructor supervision, and evaluation. The short lists drop a required step.',
  },
  {
    re: /computer-based training \(cbt\)|major advantage of computer-based/,
    note: 'CBT’s edge is interactivity and self-paced branching — it supplements instructor judgment, it does not replace it.',
  },
  {
    re: /instructional aids used in the teaching|use of instructional aids/,
    note: 'Aids support the instructor; they must not become the whole lesson or replace explanation and practice.',
  },
  {
    re: /integrated flight instruction/,
    note: 'Integrated flight instruction builds outside/inside attention habits from early lessons — habit pattern training, not an add-on IFR course.',
  },

  // ── Critique / tests / assessment ──────────────────────────────────────
  {
    re: /major difficulties encountered in the construction of multiple-choice/,
    note: 'The classic MC construction headache is inventing distractors (plausible wrong answers) that attract students who lack knowledge — not length-matching or stats work.',
  },
  {
    re: /instructor's critique of a student's performance|instructors' critiques|when an instructor critiques/,
    note: 'A critique must be constructive, objective, and forward-looking. Acceptance of the instructor usually comes before acceptance of the critique.',
  },
  {
    re: /to be effective, a critique should/,
    note: 'Effective critiques are flexible, well organized, and aimed at improvement — not praise-for-praise or a laundry list of every flaw.',
  },
  {
    re: /practical tests for pilot certification are/,
    note: 'A practical test is criterion-referenced: every applicant is scored against a fixed published standard, not ranked against the other people who tested that day.',
  },
  {
    re: /objective of the practical test standards|pts\) is to ensure/,
    note: 'PTS/ACS exist so certificated pilots meet a high level of safety — published standards are the safety bar.',
  },
  {
    re: /proper oral quizzing by the instructor during a lesson can have which result/,
    note: 'Oral quizzing’s payoff is spotting what needs more emphasis before the lesson ends.',
  },
  {
    re: /desirable result of proper oral quizzing/,
    note: 'Oral quizzes also show whether your training procedures are working — weak answers flag the teaching as well as the student.',
  },
  {
    re: /proper oral quizzing|oral quizzing by the instructor|orai quizzing|during oral quizzing/,
    note: 'Oral quizzing during the lesson reveals misunderstandings early; keep questions brief, concise, and matched to that stage’s difficulty.',
  },
  {
    re: /answer a student's question/,
    note: 'Answer the question asked, clearly, at the student’s level. Bluffing or burying the point kills trust.',
  },
  {
    re: /written test having the characteristic of discrimination/,
    note: 'Discrimination distinguishes low achievement from high: scores spread out. Easy-to-grade is usability. A broad sample of objectives is comprehensiveness.',
  },
  {
    re: /written test is said to be comprehensive/,
    note: 'Comprehensive means the test samples liberally whatever is being measured: a wide cut across the objectives, not one topic repeated and not “every difficulty level.”',
  },
  {
    re: /selection-type test items reduces the probability of guessing/,
    note: 'Matching cuts guessing among selection-type items: each prompt must pair correctly across the set, so random luck helps far less than on a single multiple-choice pick. Essay is supply-type, not selection-type.',
  },
  {
    re: /greatest probability of guessing/,
    note: 'True/false maximizes guessing (50% per item). Prefer items that demand real recognition or recall of the objective.',
  },
  {
    re: /type of test promotes guessing|what type of test promotes guessing/,
    note: 'Selection-type items (choose from listed options) promote guessing; supply-type items force the student to produce the answer.',
  },
  {
    re: /main disadvantage of supply-type/,
    note: 'Supply-type (write-in) items’ main drawback is uneven grading — different instructors often score the same answer differently.',
  },
  {
    re: /characteristic of supply-type test items/,
    note: 'Supply-type answers are hard to grade uniformly: the same paper can get different marks from different instructors.',
  },
  {
    re: /advantages of selection-type test items over supply-type/,
    note: 'Selection-type items grade objectively — same key for every student and grader — which supply-type write-ins rarely match.',
  },
  {
    re: /effective multiple-choice test items/,
    note: 'Strong MC items: clear stem, one best answer, plausible distractors (wrong answer choices written to look plausible), alternatives of similar length, no grammar giveaways.',
  },
  {
    re: /desirable for evaluating training that involves an operation, procedure/,
    note: 'A performance test is the learner doing the operation, procedure, or process while you score that doing against a standard. An oral test only checks whether they can explain it. Proficiency is how well they can do it, not the test type.',
  },
  {
    re: /faulty performance due to student overconfidence/,
    note: 'Correct overconfidence by raising the performance standard for each lesson — demand the next level, not more empty praise.',
  },
  {
    re: /student who assumes that correction of errors is unimportant/,
    note: 'Treat “errors don’t matter” as a dangerous attitude; require recognition and correction to standard.',
  },
  {
    re: /achievement of an adequate standard of performance/,
    note: 'An adequate standard of performance means the important item is learned. Letting a student move on with a partial grasp of a critical skill is a failure to instruct.',
  },
  {
    re: /positive approach in the first flight lesson/,
    note: 'First-lesson tone should emphasize what the student can do safely — not a catalog of disasters.',
  },
  {
    re: /evaluation of demonstrated ability during flight instruction/,
    note: 'Judge demonstrated ability against established standards of performance, suited to the student’s experience. Hours logged and the instructor’s opinion are not the scale.',
  },
  {
    re: /evaluating student demonstrations of piloting ability/,
    note: 'Weigh the complete performance for safety and standards; avoid personality impressions and single-mistake tunnel vision.',
  },
  {
    re: /most common means of assessment/,
    note: 'The most common assessment is oral questioning (direct or indirect) by the instructor — quick, flexible checks during the lesson.',
  },
  {
    re: /performance-based objectives consist/,
    note: 'A performance-based objective needs all three parts: the observable skill or behavior, the conditions, and the criteria that say the performance passed.',
  },
  {
    re: /type of assessment focuses on real-world skills|critical thinking sk/,
    note: 'Authentic assessment asks the learner to perform a real-world task and generate the solution. Traditional assessment is a written item with one memorized answer.',
  },
  {
    re: /electronic-based learning|how is learning enhanced by electronic/,
    note: 'E-learning’s enhancement is less instruction time than a traditional classroom: the learner moves past what they already know. Limited peer feedback is a drawback, not the benefit. The instructor still owns hands-on skills.',
  },
  {
    re: /training aids are interactive|computer-assisted learning|\bcal\b|commercially (?:produced|developed)|test preparation material/,
    note: 'Interactive/CAL and commercial prep tools help practice, but they may not match your course objectives — instructor judgment still rules.',
  },
  {
    re: /demonstrates a specific flight maneuver correctly; however/,
    note: 'Correct stick-and-rudder without understanding still needs teaching — performance alone is not mastery of the knowledge objective.',
  },
  {
    re: /assessment of student learning/,
    note: 'Assessment should mirror the objective: knowledge checks for facts, performance checks for skills, and both when both matter.',
  },

  // ── Planning / professionalism / ADM ───────────────────────────────────
  {
    re: /before endorsing a student for solo|endorsing a student/,
    note: 'Before solo endorsement, require demonstrated ability to handle realistic problems — not just a fair-weather circuit.',
  },
  {
    re: /examples of .*common endorsements|common endorsements can be found/,
    note: 'Current endorsement examples live in AC 61-65 — use the current issue, not memory or an old photocopy.',
  },
  {
    re: /refer to figure|section [a-e] is tit/,
    note: 'Read the figure/section title the stem asks for. FOI figure items track AIH lesson-plan / syllabus layout.',
  },
  {
    re: /length and frequency of flight instruction periods/,
    note: 'Lesson length/frequency must match fatigue and attention — overlong blocks create apathy, not mastery.',
  },
  {
    re: /students quickly become apathetic when/,
    note: 'Apathy follows pointless, endless, or disconnected work. Keep objectives visible and progress tangible.',
  },
  {
    re: /planning any instructional activity, the first consideration/,
    note: 'First: determine objectives. Blocks, syllabus, and lesson plans come after you know the destination.',
  },
  {
    re: /development and assembly of blocks of learning/,
    note: 'Assembled blocks of learning in proper relationship become a practical training syllabus.',
  },
  {
    re: /statement is true regarding lesson plans|true about lesson plans/,
    note: 'Lesson plans are living tools for this student and this hour — not rigid scripts that ignore progress.',
  },
  {
    re: /overlearning knowledge/,
    note: 'Overlearning = practice past first proficiency so the skill holds under stress and delay — useful for emergencies, not endless busywork.',
  },
  {
    re: /under stress, normal individuals usually react|abnormal reaction to stress|reacting abnormally to stress/,
    note: 'Normal stress response: faster automatic habits. Abnormal: extreme over-cooperation, anger, inappropriate laughter, or sharp mood change.',
  },
  {
    re: /\bfatigue can be either\b|detect fatigue|chronic fatigue can be defined|acute fatigue is characterized/,
    note: 'Fatigue is acute (short-term) or chronic (accumulated). Watch inattention and irritability — rest beats “push through.”',
  },
  {
    re: /stage of skill acquisition/,
    note: 'Skill stages: cognitive → associative → automatic. Early stages need focus and few distractions; later stages tolerate varied practice.',
  },
  {
    re: /distractions are avoided during what|type of practice includes repeating the same drill/,
    note: 'Early cognitive practice needs focus; blocked/repeated drills build the first groove before random/varied practice for transfer.',
  },
  {
    re: /true performance as a professional|improve the services they provide|sincere performance/,
    note: 'Professionals keep studying and refining service. Anything less than sincere performance undercuts instructor effectiveness.',
  },
  {
    re: /confusion, disinterest, and uneasiness|lesson objective is not clearly stated|instructor is inadequately prepared/,
    note: 'Unclear objectives and an unprepared instructor produce confusion, disinterest, and lost respect.',
  },
  {
    re: /student impatience|goals the student considers difficult/,
    note: 'Impatience often means goals feel too distant or too hard — assign intermediate, achievable steps and show why they matter.',
  },
  {
    re: /\badm\b|risk element of adm|mitigate risk|fundamental risk|pave acronym|decide model|mental process does the pilot/,
    note: 'ADM is a systematic decision process (e.g., DECIDE). PAVE elements are Pilot, Aircraft, enVironment, External pressures.',
  },
  {
    re: /capable of handling problems that might occur.*traffic pattern/,
    note: 'Before releasing more responsibility, confirm the student can handle realistic pattern problems, not only ideal circuits.',
  },
  {
    re: /during oral quizzing.*effective questions should|desirable results of oral quizzing/,
    note: 'Effective oral questions are clear, brief, and aimed at one idea — they reveal gaps and keep students thinking during the lesson.',
  },
  {
    re: /oral quizzes, what kind of question would be answered based on memory|rote question is not represented|example of a rote question/,
    note: 'Memory/recall items are rote. Higher-level items ask explain, apply, or relate — not just “what is the number.”',
  },
  {
    re: /written test has validity|test that has reliability|measures small differences in achievement|discrimination/,
    note: 'Validity measures the objective. Reliability yields consistent results. Discrimination separates small differences in achievement. Do not swap the three.',
  },
  {
    re: /multiple-choice test items that are intended to measure achievement at a higher level/,
    note: 'Higher-level MC items must force application or analysis — not a trivial fact lookup dressed up as a scenario.',
  },
  {
    re: /instructiona. aids should be based|first step in determining if and/,
    note: 'Pick aids only after the lesson objective is clear — the aid must support a specific point, not decorate the hour.',
  },
  {
    re: /true professionalism as an instructor/,
    note: 'Professionalism is sincere, consistent performance. Anything less undercuts effectiveness; no single slogan covers every duty.',
  },
  {
    re: /maintain a high level of student motivation/,
    note: 'Keep motivation high with attainable goals, visible progress, and positive, tangible reasons to keep working.',
  },
  {
    re: /pretest constructed to measure knowledge and skills necessary to begin/,
    note: 'An entry / diagnostic pretest checks prerequisites before the course — different from a final achievement test.',
  },
  {
    re: /positive or negative approaches in aviation instructional/,
    note: 'Positive approaches emphasize what to do and why it works; negative scare catalogs of disasters rarely build skill.',
  },
  {
    re: /counteract anxiety in a student|counteract anxiety in students|help a student cope with fear or anxiety|anxiety wi.l affect a student/,
    note: 'Treat anxiety with clear objectives, honest reassurance, and achievable steps — ridicule and surprise standards make it worse.',
  },
  {
    re: /acceptable procedure when using the integrated method|integrated method of flight instruction to be fully effective/,
    note: 'Integrated instruction starts outside/inside reference early and keeps both in the habit pattern — do not postpone instruments to “later.”',
  },
  {
    re: /grow impatient when .earning the basic elements|obstacle to learning is a greater deterrent/,
    note: 'Impatience and unrecognized attitudes are big learning obstacles. Students who want to skip basics need intermediate goals and a clear “why.”',
  },
  {
    re: /extraneous blocks of instruction/,
    note: 'Drop extraneous blocks — every block should support an objective. Extra side trips dilute the syllabus.',
  },
  {
    re: /planning instructional activity, the second step/,
    note: 'After objectives, the next planning step is identifying and organizing blocks of learning that lead there.',
  },
  {
    re: /each lesson of a training syllabus includes/,
    note: 'Syllabus lessons carry objectives, content, and completion standards — enough structure to teach and to check.',
  },
  {
    re: /impossible to conduct a scheduled lesson/,
    note: 'If a lesson cannot fly as scheduled, teach a productive alternate that still advances an objective — do not waste the slot.',
  },
  {
    re: /four steps of the teaching process|main concern in developing a lesson plan|well-planned lesson, each lesson should contain|lesson plan, if constructed properly/,
    note: 'A solid lesson plan supports the four teaching steps and stays flexible for this student — outline the objective, content, and standards.',
  },
  {
    re: /perceptions increase in number, the student develops insight/,
    note: 'Insight grows as perceptions group into meaningful relationships — help students assemble the pieces.',
  },
  {
    re: /regarding the overlearning of knowledge|regarding long term memory/,
    note: 'Overlearning and long-term store protect knowledge under delay and stress; short-term alone will not hold it.',
  },
  {
    re: /example of psychomotor domain|skill involving the psychomotor domain|skill involves the cognitive domain|skill involving the cognitive domain|domain of learning requires remembering specific facts|bloom's taxonomy of the cognitive domain/,
    note: 'Cognitive = knowledge/facts and intellectual skills (Bloom’s ladder). Psychomotor = physical performance. Match the domain to the objective.',
  },
  {
    re: /help students through a learning plateau/,
    note: 'Through a plateau: vary practice, refresh motivation, and show progress markers — do not just pile more of the same.',
  },
  {
    re: /practice mixes up the skills|random practice|drill and practice method.*principle/,
    note: 'Random/mixed practice aids transfer later; drill/practice leans on the exercise principle for early grooves.',
  },
  {
    re: /chronic fatigue$|chronic fatigue may be evidenced|acute fatigue may be evidenced/,
    note: 'Acute fatigue shows after a hard day; chronic fatigue accumulates and shows as lasting inattention/irritability. Rest is the fix.',
  },
  {
    re: /beliefs opposite to what they truly believe|reaction formation/,
    note: 'Presenting the opposite of true belief is reaction formation — a defense that masks the real attitude.',
  },
  {
    re: /blames the failure of a practical exam|unfair evaluation by the examiner/,
    note: 'Blaming the examiner for a failed checkride is classic projection (blaming others) — ego protection, not analysis.',
  },
  {
    re: /psychologically counterbalancing perceived weaknesses|emphasizing strength in other areas|disguise a weak or undesirable quality by emphasizing/,
    note: 'Emphasizing a strength to offset a perceived weakness is compensation.',
  },
  {
    re: /defense mechanism called repression|hidden fear of flying that inhibits learning/,
    note: 'Repression pushes threatening feelings out of awareness — including a hidden fear of flying that quietly blocks learning.',
  },
  {
    re: /defense mechanism of denial/,
    note: 'Denial refuses to accept an obvious truth about performance or risk — confront gently with facts and standards.',
  },
  {
    re: /in the teaching lecture,/,
    note: 'Teaching lectures stay instructor-led; keep dignity, structure, and a path to application afterward.',
  },
  {
    re: /practical test standards is to be used|practical test standards are an example|faa practical test standards$|introduce the practical test standards|acceptable standards for passing the practical test/,
    note: 'Introduce PTS/ACS early and use them as the criterion standard throughout — not a surprise on checkride day.',
  },
  {
    re: /as a professional pilot, you know that/,
    note: 'Professionals keep learning and hold themselves to standards — certificate level does not freeze skill or judgment.',
  },
  {
    re: /criterion-referenced tests/,
    note: 'Criterion-referenced tests are built from performance-based objectives and scored against a fixed published standard, not against other students.',
  },
  {
    re: /responding abnormally react to stress|reacting normally to stress/,
    note: 'Normal stress: sharper automatic habits. Abnormal: inappropriate laughter, extreme anger, or over-cooperation that looks “off.”',
  },
  {
    re: /memory system can be enhanced by practice and repetition|association such as rhymes or word patterns|describe .?encoding|short-term memory \(stm\)/,
    note: 'Practice/repetition and mnemonic association help move material through short-term encoding toward longer retention. STM is brief and capacity-limited.',
  },
  {
    re: /new events displace something that had been previously learned/,
    note: 'New learning crowding out old learning is interference (a forgetting path).',
  },
  {
    re: /instructor's assessment of a student's performance/,
    note: 'Assess against lesson objectives and standards — constructive, specific, and aimed at the next improvement.',
  },
  {
    re: /airplane performance, airspace and regulations/,
    note: 'Those topics are the pre-solo knowledge test (§ 61.87(b)), which the instructor gives and reviews before first solo. The FAA written and the practical test come later.',
  },
];

/**
 * Uncommon FOI / AIH terms → plain-English gloss.
 * Longer phrases first so they match before shorter fragments.
 * Applied once per term on first use when not already defined inline.
 */
const GLOSSARY = [
  { re: /\breaction formation\b/i, term: 'reaction formation', def: 'acting the opposite of what you truly feel' },
  { re: /\bcriterion-referenced\b/i, term: 'criterion-referenced', def: 'scored against a fixed published standard, not a curve' },
  { re: /\bnorm-referenced\b/i, term: 'norm-referenced', def: 'ranked against other students rather than a fixed standard' },
  { re: /\bselection-type\b/i, term: 'selection-type', def: 'choose-from-options items such as multiple-choice or true/false' },
  { re: /\bsupply-type\b/i, term: 'supply-type', def: 'write-in / short-answer items the student must produce' },
  { re: /\bincidental learning\b/i, term: 'incidental learning', def: 'side learning that happens while the planned objective is taught' },
  { re: /\boverhead question\b/i, term: 'overhead question', def: 'a question aimed at the whole group, not one person' },
  { re: /\bleadoff questions?\b/i, term: 'leadoff question', def: 'open starter question that kicks off a guided discussion' },
  { re: /\bblocks of learning\b/i, term: 'blocks of learning', def: 'related chunks of training content that build toward objectives' },
  { re: /\bcompletion standards\b/i, term: 'completion standards', def: 'how well the student must perform to finish the lesson' },
  { re: /\bnegative transfer\b/i, term: 'negative transfer', def: 'prior learning that interferes with a new skill' },
  { re: /\bpositive transfer\b/i, term: 'positive transfer', def: 'prior learning that helps a new skill' },
  { re: /\bshort-term memory\b|\bSTM\b/, term: 'short-term memory', def: 'brief working store with limited capacity' },
  { re: /\blong-term memory\b/i, term: 'long-term memory', def: 'durable store for later use' },
  { re: /\bsensory memory\b/i, term: 'sensory memory', def: 'first brief register of sights/sounds from the environment' },
  { re: /\breproof\b/i, term: 'reproof', def: 'harsh criticism or scolding' },
  { re: /\bprimacy\b/i, term: 'primacy', def: 'what is learned first sticks hardest' },
  { re: /\brecency\b/i, term: 'recency', def: 'what was practiced most recently is remembered best' },
  { re: /\breadiness\b/i, term: 'readiness', def: 'learner is prepared and has a clear objective' },
  { re: /\boverlearning\b/i, term: 'overlearning', def: 'practice past first proficiency so the skill holds under stress' },
  { re: /\brepression\b/i, term: 'repression', def: 'pushing unpleasant feelings or memories out of awareness' },
  { re: /\brationalization\b/i, term: 'rationalization', def: 'making excuses that sound reasonable for weak performance' },
  { re: /\bcompensation\b/i, term: 'compensation', def: 'covering a weakness by stressing a strength elsewhere' },
  { re: /\bprojection\b/i, term: 'projection', def: 'blaming others or attributing your own feelings to them' },
  { re: /\bdisplacement\b/i, term: 'displacement', def: 'shifting emotion onto a safer person or object' },
  { re: /\bdenial\b/i, term: 'denial', def: 'refusing to accept an obvious truth' },
  { re: /\bfantasy\b/i, term: 'fantasy', def: 'daydreaming escape from a threatening situation' },
  { re: /\bdistractors?\b/i, term: 'distractors', def: 'wrong answer choices written to look plausible' },
  { re: /\btaxonomy\b/i, term: 'taxonomy', def: 'ranked classification of educational objectives' },
  { re: /\bencoding\b/i, term: 'encoding', def: 'converting information so it can move into longer-term memory' },
  { re: /\binterference\b/i, term: 'interference', def: 'similar learning crowding out other learning' },
  { re: /\bdisuse\b/i, term: 'disuse', def: 'forgetting from lack of practice over time' },
  { re: /\binsight\b/i, term: 'insight', def: 'perceptions suddenly grouping into understanding' },
  { re: /\bpsychomotor\b/i, term: 'psychomotor', def: 'physical-skill domain of learning' },
  { re: /\baffective\b/i, term: 'affective', def: 'attitudes, beliefs, and values domain' },
  { re: /\bcognitive\b/i, term: 'cognitive', def: 'knowledge / intellectual domain' },
  { re: /\bcorrelation\b/i, term: 'correlation', def: 'highest learning level — connecting knowledge across new situations' },
  { re: /\brote\b/i, term: 'rote', def: 'memorizing facts without real understanding' },
  { re: /\btangible\b/i, term: 'tangible', def: 'concrete and definite — student can see the reward' },
  { re: /\bheterogeneous\b/i, term: 'heterogeneous', def: 'mixed-ability' },
  { re: /\bapathy\b/i, term: 'apathy', def: 'not caring; disengagement' },
  { re: /\bmnemonics?\b/i, term: 'mnemonic', def: 'memory aid such as a rhyme or pattern' },
  { re: /\bsyllabus\b/i, term: 'syllabus', def: 'course roadmap sequencing lessons and objectives' },
  { re: /\bauthentic assessment\b/i, term: 'authentic assessment', def: 'evaluation using real-world tasks, not only paper quizzes' },
  { re: /\bBloom'?s?\b/i, term: "Bloom’s", def: 'classic ladder of thinking skills from recall up to create/evaluate' },
  { re: /\bPAVE\b/, term: 'PAVE', def: 'Pilot, Aircraft, enVironment, External pressures' },
  { re: /\bDECIDE\b/, term: 'DECIDE', def: 'Detect, Estimate, Choose, Identify, Do, Evaluate' },
  { re: /\bADM\b/, term: 'ADM', def: 'Aeronautical Decision Making' },
  { re: /\bPTS\b/, term: 'PTS', def: 'Practical Test Standards' },
  { re: /\bACS\b/, term: 'ACS', def: 'Airman Certification Standards' },
  { re: /\bCBT\b/, term: 'CBT', def: 'computer-based training' },
  { re: /\bCAL\b/, term: 'CAL', def: 'computer-assisted learning' },
];

function alreadyGlossed(text, term, def) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Already has a parenthetical right after the term.
  if (new RegExp(`${esc}\\s*\\(`, 'i').test(text)) return true;
  // Gloss idea already appears in the sentence (e.g. PAVE spelled out).
  const tip = String(def)
    .split(/[—,(]/)[0]
    .trim()
    .slice(0, 28)
    .toLowerCase();
  if (tip.length >= 10 && text.toLowerCase().includes(tip)) return true;
  return false;
}

/** Insert plain-English parentheticals for uncommon FOI terms on first use. */
function withInlineDefs(text) {
  let out = String(text || '');
  for (const { re, term, def } of GLOSSARY) {
    if (!re.test(out)) continue;
    if (alreadyGlossed(out, term, def)) continue;
    out = out.replace(re, (match) => `${match} (${def})`);
  }
  return out;
}

function stemText(card) {
  return String(card.question || '').toLowerCase();
}

function buildSummary(card) {
  if (CARD_OVERRIDES[card.id]) {
    return withInlineDefs(CARD_OVERRIDES[card.id]);
  }

  const stem = stemText(card);
  const notes = [];
  for (const row of STEM_NOTES) {
    if (row.re.test(stem)) {
      notes.push(row.note);
      if (notes.length >= 2) break;
    }
  }
  if (!notes.length) {
    const topicNote = TOPIC_CONTEXT[card.topic_id];
    if (topicNote) notes.push(topicNote);
  }
  if (!notes.length) {
    notes.push(
      'Use the Aviation Instructor’s Handbook wording for the “why.” FOI items often turn on a nearby definition or look-alike principle.'
    );
  }
  // One focused tip beats two that may pull in an unrelated second match.
  return withInlineDefs(notes.slice(0, 1).join(' '));
}

function linksFor(card) {
  const topicLinks = TOPIC_LINKS[card.topic_id] || [LINKS.aih, LINKS.aihPdf];
  const stem = stemText(card);
  const extra = [];

  if (/practical test|\bpts\b|completion standards|certification of pilots/.test(stem)) {
    extra.push(LINKS.pts);
  }
  if (/endorsement|solo|part 61|flight instructor/.test(stem)) {
    extra.push(LINKS.part61);
    extra.push(LINKS.ac6165);
  }
  if (/critique|evaluation|oral quiz|written test|multiple-choice|assessment|test item/.test(stem)) {
    extra.push(LINKS.aihAssessment);
  }
  if (/lesson plan|syllabus|introduction|blocks of learning|instructional activity/.test(stem)) {
    extra.push(LINKS.aihPlanning);
  }
  if (/lecture|guided discussion|demonstration|cbt|cooperative|instructional aid|integrated flight/.test(stem)) {
    extra.push(LINKS.aihTeaching);
  }
  if (/defense mechanism|motivation|human needs|anxiety|fear|fatigue|stress|self-concept/.test(stem)) {
    extra.push(LINKS.aihHuman);
  }
  if (/principle of|levels? of learning|transfer|memory|domain|perception|insight|overlearning|skill acquisition/.test(stem)) {
    extra.push(LINKS.aihLearning);
  }

  const seen = new Set();
  const out = [];
  for (const link of [...topicLinks, ...extra, LINKS.aih]) {
    if (!link?.url) continue;
    const key = `${link.label}::${link.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: link.label, url: link.url });
    if (out.length >= 3) break;
  }
  return out;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const detailsDoc = loadJson(detailsPath);
  const existingAll = Array.isArray(detailsDoc.details) ? [...detailsDoc.details] : [];
  const existing = existingAll.filter((d) => !String(d.card_id || '').startsWith('foi_written_'));
  const have = new Set(existing.map((d) => String(d.card_id || '').trim()).filter(Boolean));

  const foiImport = loadJson(foiImportPath);
  const importCards = Array.isArray(foiImport.cards) ? foiImport.cards : [];

  const generated = [];
  let stemHit = 0;
  for (const card of importCards) {
    if (!card?.id || have.has(card.id)) continue;
    if (!String(card.id).startsWith('foi_written_')) continue;
    const summary = buildSummary(card);
    if (!Object.values(TOPIC_CONTEXT).some((t) => summary.startsWith(t.slice(0, 40))) &&
        !summary.startsWith('Use the Aviation Instructor')) {
      stemHit += 1;
    }
    generated.push({
      card_id: card.id,
      summary,
      links: linksFor(card),
    });
    have.add(card.id);
  }

  const merged = [...existing, ...generated];
  merged.sort((a, b) => String(a.card_id).localeCompare(String(b.card_id)));
  fs.writeFileSync(detailsPath, `${JSON.stringify({ details: merged }, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        kept_non_foi_written: existing.length,
        generated: generated.length,
        total: merged.length,
        stem_specific: stemHit,
        topic_or_generic: generated.length - stemHit,
      },
      null,
      2
    )
  );
}

main();
