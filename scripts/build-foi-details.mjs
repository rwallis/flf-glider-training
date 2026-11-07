/**
 * Build Details (summary + reference links) for FOI / Fundamentals of Instructing questions.
 * Merges into content/card-details.json; regenerates foi_written_* entries only.
 *
 * Summaries add teaching context / traps — they never restate the question or keyed answer.
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
const PTS_URL = 'https://www.faa.gov/training_testing/testing/test_standards';
const PART61_URL = 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61';

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
    url: PTS_URL,
  },
  part61: {
    label: '14 CFR Part 61 — Certification: Instructors',
    url: PART61_URL,
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
    'FOI learning items turn on definitions (behavior change, principles, levels, domains, memory, transfer). Match the stem to the exact AIH term — look-alike principles are the usual trap.',
  foi_human:
    'Human-behavior questions mix Maslow needs, motivation type, and defense mechanisms. Name the mechanism or need layer before picking the look-alike option.',
  foi_teaching:
    'Teaching-process answers hinge on method fit: lecture for ideas, demo/performance for skills, guided discussion for shared reasoning — not “whatever feels interactive.”',
  foi_critique:
    'A useful critique is constructive, objective, and forward-looking. Oral quizzes check understanding during the lesson; practical tests measure certification standards.',
  foi_planning:
    'Syllabus, lesson plan, and introduction sequence set readiness and objectives before presentation. Plateaus and threat kill progress faster than weak content.',
  foi_instructor:
    'Professional instructors communicate so receivers change behavior with understanding — abstractions, common experience, and sincerity decide whether instruction actually happened.',
  foi_misc:
    'FOI miscellaneous items usually retest a nearby AIH definition (levels, domains, organization of material, group learning). Use the handbook wording, not a casual synonym.',
};

/**
 * Keyword → extra teaching note. Matched against question+choices for relevance.
 * Keep regexes tight so neighboring FOI terms do not false-trigger.
 */
const KEYWORD_NOTES = [
  {
    re: /\bchange in behavior\b|\bdefined as\b.*\blearning\b|learning can be defined/,
    note: 'Learning, in FOI terms, is a change in behavior from experience — knowing a fact without a usable change does not meet the definition.',
  },
  {
    re: /verbal, conceptual|elements such as verbal|problem solving/,
    note: 'Learning includes multiple elements (verbal, conceptual, perceptual, motor, problem solving, emotional). Do not collapse “learning” into memorizing words alone.',
  },
  {
    re: /\bincidental\b|additional learning|learning other things as well/,
    note: 'Incidental learning is the side learning that happens while the planned objective is taught — attitudes and habits often form here.',
  },
  {
    re: /best way to prepare a student|step-by-step example|clear, step-by-step/,
    note: 'Prepare a student for a task with a clear step-by-step example — purpose alone or a bare outline leaves the how-to fuzzy.',
  },
  {
    re: /proper habits and correct techniques|ensure proper habits/,
    note: 'Correct habits form early: insist on right technique from the start (primacy). Tolerating sloppy practice trains the wrong habit.',
  },
  {
    re: /\bprinciple of readiness\b|\breadiness\b/,
    note: 'Readiness: learners advance faster when they have a clear objective and are prepared (physically, mentally, emotionally) for the lesson.',
  },
  {
    re: /\bprinciple of exercise\b|\bopportunities for a student to practice\b/,
    note: 'Exercise: things practiced toward a goal are learned and retained; undirected repetition is not the same principle.',
  },
  {
    re: /\bprinciple of effect\b|emotional reaction of the learner/,
    note: 'Effect: learning sticks when it produces a satisfying emotional result; frustration and threat work against retention.',
  },
  {
    re: /\bprinciple of primacy\b|\bprimacy\b/,
    note: 'Primacy: what is learned first creates a strong, lasting impression — teach it right the first time; unlearning bad habits is expensive.',
  },
  {
    re: /\bprinciple of intensity\b|\bstrong impression\b|real thing than from a substitute/,
    note: 'Intensity: vivid, realistic, or emotionally striking experiences teach better than dull or abstract substitutes.',
  },
  {
    re: /\bprinciple of recency\b|\brecency\b|sequence of lectures/,
    note: 'Recency: things most recently practiced are best remembered — end lessons with the critical skill or review you need retained.',
  },
  {
    re: /\bperceptions?\b|perceptual process|mental grouping|insights?\b/,
    note: 'Perceptions are meanings given to sensations; insights group those perceptions into understanding. Self-concept, goals, and threat filter what the student “sees.”',
  },
  {
    re: /\bself-?concept\b|remain receptive|reject additional training/,
    note: 'A negative self-concept is the biggest barrier to staying open to new experience — instructors protect receptivity by building a fair, achievable self-image.',
  },
  {
    re: /\bmotivations?\b/,
    note: 'Positive, tangible motivations (students believe effort will be rewarded in a definite way) outperform fear, reproof, and vague appeals — except rarely with the overconfident/impulsive student.',
  },
  {
    re: /\blevels? of (?:learning|knowledge)\b|\brote\b.*\bunderstanding\b|\bcorrelation\b|stop teaching\b|maneuvering speed of the aircraft listed/,
    note: 'Levels of learning ascend rote → understanding → application → correlation. Most instructors stop too early at understanding; teach toward correlation.',
  },
  {
    re: /\bcognitive domain\b|\baffective domain\b|\bpsychomotor domain\b|\bdomain of learning\b|\btaxonomy\b|hierarchy of objectives|educational objective/,
    note: 'Bloom-style domains: cognitive = knowledge, affective = attitudes/values, psychomotor = physical skill. A taxonomy ranks objectives from simple to complex inside a domain.',
  },
  {
    re: /\btransfer of learning\b|\bpositive transfer\b|\bnegative transfer\b|interferes with the learning|rectangular patterns helps/,
    note: 'Positive transfer helps a related task; negative transfer interferes. Design practice so early skills support, not fight, later maneuvers.',
  },
  {
    re: /\bmemory system\b|\bencoding\b|\bsensory\b|\bshort-?term\b|\blong-?term\b|mnemonics|rhymes|forgetting|repression|disuse|interference/,
    note: 'Memory moves sensory → short-term → long-term via encoding. Forgetting theories include disuse, interference, and repression of unpleasant experience.',
  },
  {
    re: /\blearning plateau\b|\bplateau\b/,
    note: 'A learning plateau is a normal temporary leveling of progress — not permanent failure. Vary practice, clarify goals, and reduce threat to restart the curve.',
  },
  {
    re: /\bdefense mechanisms?\b|\brationalization\b|\brepression\b|\bdenial\b|\bfantasy\b|\bcompensation\b|\bprojection\b|\bdisplacement\b|\baggression\b|\bflight\b.*defense|daydreaming|reaction formation/,
    note: 'Defense mechanisms protect ego under stress (rationalization, repression, denial, fantasy, compensation, projection, displacement, aggression, flight). They can help briefly but block learning if they become habitual.',
  },
  {
    re: /unable to see the benefits|purpose of a lesson|acceptance of further instruction|keeps the student informed/,
    note: 'Show benefits and keep objectives/standards visible. Students who cannot see purpose disengage; informed students accept further instruction more readily.',
  },
  {
    re: /primary consideration in planning for student performance|student performance is the/,
    note: 'Plan performance around the student’s current ability and progress — objectives must be reachable from where the learner actually is.',
  },
  {
    re: /\bhuman needs\b|\bmaslow\b|physically comfortable|greatest challenge to an instructor|safety.*need|belonging/,
    note: 'Lower Maslow needs (physiological, security) must be met before belonging, esteem, and self-actualization. Esteem / self-actualization usually challenge the instructor most in training.',
  },
  {
    re: /\banxiety\b|\bfear\b|\belement of threat\b|frustrated|confidence tends to be destroyed/,
    note: 'Threat and unexplained standards raise anxiety and shrink perception. Keep objectives and completion standards visible; avoid ridicule and moving goalposts.',
  },
  {
    re: /\bcommunication\b|\bbarrier\b|\babstraction|\babstract words\b|\bcommon experience\b|effective communication has taken place|communicate effectively|communicator's words|background of/,
    note: 'Communication succeeds only when receivers understand and change behavior. The biggest teaching barrier is lack of common experience; abstractions rarely evoke the intended concrete meaning.',
  },
  {
    re: /\binstruction taken place\b|when has instruction/,
    note: 'Instruction has taken place when the procedure is explained and the desired student response occurs — transmission alone is not instruction.',
  },
  {
    re: /\bteaching process\b|preparation, presentation|preparation, demonstration/,
    note: 'Classic teaching process: preparation → presentation → application → review and evaluation. Skip application/evaluation and you only “covered” material.',
  },
  {
    re: /\blectures?\b|informal lecture|active student participation/,
    note: 'Lecture is efficient for new ideas, summaries, and theory-to-practice links. Informal lectures invite participation; dignity and respect still matter — sarcasm destroys both.',
  },
  {
    re: /\bguided discussion\b|\bleadoff question\b|question directed to an entire group|overhead question|relay question/,
    note: 'Guided discussion builds learning through student interchange under instructor control. Strong leadoff questions are open (why/how/what) and aimed at the whole group.',
  },
  {
    re: /\binstructional aids?\b/,
    note: 'Instructional aids support — they do not replace — the instructor. Use them to clarify relationships and hold attention; never let the aid become the whole lesson.',
  },
  {
    re: /\bdemonstration\/performance\b|\bdemonstration.performance\b|essential steps in the demonstration/,
    note: 'Demo/performance steps: explanation → instructor demo → student performance → instructor supervision → evaluation. Explanation and demo often run together; evaluation closes the loop.',
  },
  {
    re: /\bcomputer-?based training\b|\bcbt\b/,
    note: 'CBT’s main advantage is interactivity and self-paced branching — it supplements, not replaces, instructor judgment on skill and judgment items.',
  },
  {
    re: /\bcooperative learning\b|\bheterogeneous groups\b|group learning|small groups so that they can work together/,
    note: 'Cooperative groups maximize shared learning: heterogeneous mix often raises peer teaching; the goal is mutual success, not competition for a single grade.',
  },
  {
    re: /\bcritiques?\b/,
    note: 'Critiques should be constructive, objective, and flexible — give direction to improve, not praise-for-praise or a laundry list of every flaw. Acceptance of the instructor precedes acceptance of the critique.',
  },
  {
    re: /\borai?\s*quizzing\b|\boral quiz|\bquizzing\b/,
    note: 'Oral quizzing during a lesson reveals misunderstandings early, keeps students alert, and reviews without waiting for a formal test. Good questions are clear, brief, and aimed at one idea.',
  },
  {
    re: /answer a student's question|student's question/,
    note: 'Answer the question that was asked — clearly and at the student’s level. Bluffing or burying the point in a speech kills trust.',
  },
  {
    re: /\bpractical test\b|\bpts\b|practical test standards|completion standards/,
    note: 'Practical tests are criterion-referenced to published standards (PTS/ACS), not curved against other applicants. Lesson evaluation should use the same idea: objectives and standards, not “better than yesterday.”',
  },
  {
    re: /\bwritten test\b|supply-?type|selection-?type|multiple-?choice test|test item|discrimination|comprehensive when|probability of guessing/,
    note: 'Test design: comprehensive coverage, discrimination between masters and non-masters, clear stems, and plausible distractors. Selection items grade fast; supply items cut guessing but cost scoring time.',
  },
  {
    re: /student evaluation|evaluation of student|evaluating training|evaluation of demonstrated ability|adequate standard of performance/,
    note: 'Evaluate against lesson objectives and published standards — established criteria, not personality or comparison to another student. Performance in context beats isolated “gotcha” questions.',
  },
  {
    re: /overconfidence|correction of errors is unimportant|faulty performance|positive approach|first flight lesson/,
    note: 'Correct overconfidence and “errors don’t matter” early with facts and standards. A positive first-lesson approach emphasizes what the student can do safely, not a catalog of disasters.',
  },
  {
    re: /\bsolo\b|before endorsing|endorsing a student/,
    note: 'Before solo endorsement, require demonstrated ability to handle realistic problems (pattern, traffic, judgment) — not just a fair-weather circuit.',
  },
  {
    re: /confusion, disinterest|improve the services|true performance as a professional|based on study/,
    note: 'Professionals keep studying and refining service. Unclear objectives produce student confusion and disinterest; sincerity plus preparation prevent that slide.',
  },
  {
    re: /\blesson plans?\b|\bintroduction\b|organize lesson|known to the unknown|simple to complex|past to present|sets the stage/,
    note: 'Organize from known→unknown, simple→complex, past→present. The introduction (attention, motivation, overview) sets the stage; a written lesson plan is a living tool for this student and hour — not a rigid script.',
  },
  {
    re: /\bsyllabus\b|training syllabus|course of training|blocks of learning|first consideration should be to|planning any instructional activity/,
    note: 'Plan instructional activity around clear objectives first, then assemble related blocks of learning. The syllabus is the course roadmap the lesson plan executes day to day.',
  },
  {
    re: /\bprofessionalism\b|sincere performance|code of ethics/,
    note: 'Professionalism is sincere, consistent performance — anything less undercuts instructor effectiveness. No single slogan covers every duty; ethics and preparation show up in every lesson.',
  },
  {
    re: /\bpositive feedback\b|\breward\b|\breinforcement\b|pleasurable return/,
    note: 'Responses that produce a pleasurable return reinforce the behavior (effect/reward). Timely, specific positive feedback beats vague “good job.”',
  },
  {
    re: /\bvalidity\b|\breliability\b|\bnorm[- ]referenced\b|\bcriterion[- ]referenced\b|\bdistractor\b|\bstem\b/,
    note: 'Good tests: valid (measure the objective), reliable (consistent), with clear stems and plausible distractors. Criterion-referenced checks a standard; norm-referenced ranks against peers.',
  },
  {
    re: /\bstress\b|abnormal reaction|react abnormally|normal individuals usually react/,
    note: 'Under stress, normal students usually respond with faster thinking and automatic habits; abnormal reactions include extreme over-cooperation, anger, inappropriate laughter, or marked change in mood.',
  },
  {
    re: /\bfatigue\b|acute fatigue|chronic fatigue/,
    note: 'Fatigue is acute (short-term, from a long day) or chronic (accumulated). Watch for inattention, irritability, and slowing standards — rest beats “push through.”',
  },
  {
    re: /\bintegrated flight instruction\b|\bintegrated method\b/,
    note: 'Integrated flight instruction builds habit patterns of dividing attention outside/inside from early lessons — habit formation, not an add-on instrument rating syllabus.',
  },
  {
    re: /length and frequency of flight|apathetic when they/,
    note: 'Lesson length and frequency must match fatigue and attention. Students go apathetic when work feels pointless, endless, or disconnected from a clear objective.',
  },
  {
    re: /refer to figure|section [a-e] is tit|common endorsements|ac 61-65|advisory circular/,
    note: 'FOI figures and endorsement items track AIH / AC 61-65 layout. Read the section title asked for; endorsement examples live in the current AC 61-65.',
  },
  {
    re: /\boverlearning\b/,
    note: 'Overlearning is practice beyond initial proficiency so the skill holds under stress and delay — useful for emergency and habit items, not busywork forever.',
  },
  {
    re: /promotes guessing|type of test promotes/,
    note: 'True/false items maximize guessing (50%). Prefer items that demand recognition or recall of the objective, not coin-flip odds.',
  },
  {
    re: /stage of skill acquisition|cognitive stage|associative stage|automatic stage|distractions? during what|type of practice|deliberate practice|blocked practice|random practice/,
    note: 'Skill stages run cognitive → associative → automatic. Early (cognitive) practice needs focus and few distractions; later stages tolerate varied/random practice for transfer.',
  },
  {
    re: /evaluating student demonstrations|piloting ability, it is important/,
    note: 'When judging demonstrated ability, weigh the whole performance against standards and safety — not a single memorable error or a personality impression.',
  },
  {
    re: /organize explanations and demonstrations/,
    note: 'Build explanations and demos so the student sees relationships — connect new material to what they already know instead of a disconnected dump of facts.',
  },
  {
    re: /lesson objective is not clearly stated|inadequately prepared|recognize that the instructor/,
    note: 'Unclear objectives and an unprepared instructor produce apathy, confusion, and lost respect. State the objective; show up ready.',
  },
  {
    re: /electronic-?based learning|computer-assisted learning|\bcal\b|commercially (?:produced|developed)|test preparation material|training aids are interactive/,
    note: 'E-learning / CAL and commercial prep materials can individualize pace and interactivity, but they do not replace instructor judgment — and commercial banks may not match your course objectives.',
  },
  {
    re: /most common means of assessment|type of assessment|performance-based objectives|real-world skills|critical thinking|assessment of student learning|demonstrates a specific flight maneuver correctly/,
    note: 'Assessment should match the objective: knowledge checks for facts, performance/authentic assessment for real-world and critical-thinking skills. Correct stick-and-rudder without understanding still needs teaching.',
  },
  {
    re: /\badm\b|\bpave\b|risk element|mitigate risk|fundamental risk|mental process|best course of action|decide model/,
    note: 'ADM is a systematic decision process (e.g., DECIDE). PAVE risk elements are Pilot, Aircraft, enVironment, External pressures — experience in a condition is pilot-related risk data, not a free pass.',
  },
  {
    re: /student impatience|correcting student impatience|assignment of goals|goals the student considers difficult/,
    note: 'Impatience often means goals feel too distant or too hard. Assign intermediate, achievable goals and explain why the current step matters.',
  },
  {
    re: /learning plateaus?\b/,
    note: 'Learning plateaus are normal temporary leveling — vary the practice, refresh motivation, and confirm the student still sees progress markers.',
  },
];

function corpus(card) {
  const choices = Array.isArray(card.choices)
    ? card.choices
        .map((c) => (typeof c === 'string' ? c : c?.text || c?.label || ''))
        .join(' ')
    : '';
  return `${card.question || ''} ${card.answer || ''} ${choices}`.toLowerCase();
}

function buildSummary(card) {
  const text = corpus(card);
  const notes = [];

  for (const row of KEYWORD_NOTES) {
    if (row.re.test(text)) notes.push(row.note);
    if (notes.length >= 2) break;
  }

  const topicNote = TOPIC_CONTEXT[card.topic_id];
  if (!notes.length && topicNote) notes.push(topicNote);

  if (!notes.length) {
    notes.push(
      'Use the Aviation Instructor’s Handbook wording for the “why,” not a casual synonym. FOI written items often turn on a nearby definition or a look-alike principle.'
    );
  }

  return notes.slice(0, 2).join(' ');
}

function linksFor(card) {
  const topicLinks = TOPIC_LINKS[card.topic_id] || [LINKS.aih, LINKS.aihPdf];
  const q = corpus(card);
  const extra = [];

  if (/\bpractical test\b|\bpts\b|acs\b|completion standards|certification of pilots/.test(q)) {
    extra.push(LINKS.pts);
  }
  if (/\binstructor certificate\b|\bendorsement\b|part 61|flight instructor/.test(q)) {
    extra.push(LINKS.part61);
  }
  if (/common endorsements|ac 61-65|endorsing a student|\bsolo\b/.test(q)) {
    extra.push(LINKS.ac6165);
  }
  if (/\bcritique\b|\bevaluation\b|\boral quizz|\btest\b|\bassessment\b/.test(q)) {
    extra.push(LINKS.aihAssessment);
  }
  if (/\blesson plan\b|\bsyllabus\b|introduction|organize lesson/.test(q)) {
    extra.push(LINKS.aihPlanning);
  }
  if (/\blecture\b|\bguided discussion\b|\bdemonstration|\bcbt\b|\bcooperative/.test(q)) {
    extra.push(LINKS.aihTeaching);
  }
  if (/\bdefense mechanism\b|\bmotivation\b|\bhuman needs\b|\banxiety\b|\bfear\b/.test(q)) {
    extra.push(LINKS.aihHuman);
  }
  if (
    /\bprinciple of\b|\blevels? of learning\b|\btransfer\b|\bmemory\b|\bdomain\b|\bperception/.test(q)
  ) {
    extra.push(LINKS.aihLearning);
  }

  // Allow multiple handbook section labels that share the AIH landing URL,
  // but never duplicate the exact same label+url pair.
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
  // Regenerate FOI written details; keep every other track untouched.
  const existing = existingAll.filter((d) => !String(d.card_id || '').startsWith('foi_written_'));
  const have = new Set(existing.map((d) => String(d.card_id || '').trim()).filter(Boolean));

  const foiImport = loadJson(foiImportPath);
  const importCards = Array.isArray(foiImport.cards) ? foiImport.cards : [];

  const generated = [];
  for (const card of importCards) {
    if (!card?.id || have.has(card.id)) continue;
    if (!String(card.id).startsWith('foi_written_')) continue;
    generated.push({
      card_id: card.id,
      summary: buildSummary(card),
      links: linksFor(card),
    });
    have.add(card.id);
  }

  const merged = [...existing, ...generated];
  merged.sort((a, b) => String(a.card_id).localeCompare(String(b.card_id)));
  fs.writeFileSync(detailsPath, `${JSON.stringify({ details: merged }, null, 2)}\n`, 'utf8');

  const foiCount = merged.filter((d) => String(d.card_id || '').startsWith('foi_')).length;
  const keywordHit = generated.filter((d) => {
    const topicFallback = Object.values(TOPIC_CONTEXT).some((t) => d.summary.startsWith(t.slice(0, 40)));
    const generic = d.summary.startsWith('Use the Aviation Instructor');
    return !topicFallback && !generic;
  }).length;

  console.log(
    JSON.stringify(
      {
        kept_non_foi_written: existing.length,
        generated: generated.length,
        total: merged.length,
        foi_details: foiCount,
        import_cards: importCards.length,
        keyword_primary_summaries: keywordHit,
        topic_or_generic_fallbacks: generated.length - keywordHit,
      },
      null,
      2
    )
  );
}

main();
