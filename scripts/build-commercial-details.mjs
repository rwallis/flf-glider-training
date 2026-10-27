/**
 * Build Details (summary + reference links) for all commercial questions.
 * Merges into content/card-details.json without overwriting existing entries.
 *
 * Run: node scripts/build-commercial-details.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const detailsPath = path.join(root, 'content', 'card-details.json');
const commercialImportPath = path.join(
  root,
  'content',
  'commercial-import',
  'commercial-import.json'
);
const seedPath = path.join(root, 'content', 'seed.json');

const LINKS = {
  phak: {
    label: 'Pilot’s Handbook of Aeronautical Knowledge (PHAK)',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
  },
  gfh: {
    label: 'Glider Flying Handbook',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/glider_handbook',
  },
  afh: {
    label: 'Airplane Flying Handbook',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook',
  },
  aim: {
    label: 'Aeronautical Information Manual (AIM)',
    url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
  },
  part61: {
    label: '14 CFR Part 61 — Certification',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61',
  },
  part91: {
    label: '14 CFR Part 91 — General Operating Rules',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91',
  },
  part43: {
    label: '14 CFR Part 43 — Maintenance',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-C/part-43',
  },
  ntsb830: {
    label: '49 CFR Part 830 — NTSB Notification and Reporting',
    url: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-VIII/part-830',
  },
  chartSupp: {
    label: 'Chart Supplement / Airport data',
    url: 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/',
  },
  ac9048: {
    label: 'AC 90-48 — Pilots’ Role in Collision Avoidance',
    url: 'https://www.faa.gov/regulations_policies/advisory_circulars',
  },
  weather: {
    label: 'Aviation Weather Handbook',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation',
  },
  acs: {
    label: 'Commercial Pilot ACS / PTS (Glider)',
    url: 'https://www.faa.gov/training_testing/testing/acs',
  },
};

const TOPIC_LINKS = {
  comm_certs: [LINKS.part61, LINKS.acs],
  comm_airworthy: [LINKS.part91, LINKS.part43],
  comm_aeromedical: [LINKS.phak, LINKS.aim],
  comm_scan: [LINKS.ac9048, LINKS.aim],
  comm_aero: [LINKS.phak, LINKS.gfh],
  comm_controls: [LINKS.gfh, LINKS.phak],
  comm_wb: [LINKS.phak, LINKS.gfh],
  comm_nav: [LINKS.phak, LINKS.aim],
  comm_regs: [LINKS.part91, LINKS.ntsb830],
  comm_airspace: [LINKS.aim, LINKS.part91],
  comm_preflight: [LINKS.gfh, LINKS.phak],
  comm_airport: [LINKS.aim, LINKS.chartSupp],
  comm_tow: [LINKS.gfh, LINKS.part91],
  comm_landings: [LINKS.gfh, LINKS.acs],
  comm_perf: [LINKS.gfh, LINKS.phak],
  comm_soaring: [LINKS.gfh, LINKS.weather],
  comm_maneuvers: [LINKS.gfh, LINKS.acs],
  comm_stalls: [LINKS.gfh, LINKS.afh],
  comm_emergency: [LINKS.gfh, LINKS.acs],
  comm_weather: [LINKS.weather, LINKS.aim],
  comm_systems: [LINKS.gfh, LINKS.phak],
};

/** Topic backdrop — added only when keyword tips are thin. Does not restate Q/A. */
const TOPIC_CONTEXT = {
  comm_certs:
    'Commercial privileges are category-specific: a glider rating does not borrow airplane commercial privileges, and Part 61 tables control add-on vs initial paths.',
  comm_airworthy:
    'Airworthiness is continuous after the annual — ADs, 100-hour (when for hire), and required equipment status all matter before launch.',
  comm_aeromedical:
    'Commercial judgment includes fitness to fly: hypoxia, fatigue, dehydration, and hazardous attitudes show up before the weather does.',
  comm_scan:
    'Collision avoidance is a scan pattern plus clearing turns — not a quick peek. Time-share near/far and left/right instead of fixating.',
  comm_aero:
    'In steady flight the force pairs balance; when you change bank, pitch, or speed, lift/drag/weight/thrust (or tow tension) rearrange immediately.',
  comm_controls:
    'Primary effects first, then secondary (adverse yaw, pitch with spoiler). Spoilers dump lift and add drag — they are not “flaps in reverse.”',
  comm_wb:
    'Empty weight and empty CG come from this glider’s records; seat arms and ballast stations come from the Flight Manual. Both must be current.',
  comm_nav:
    'Glider XC is energy and landability: plan conservative glide ratios and always know the next landable field, not just the destination.',
  comm_regs:
    'Written traps mix adjacent rules (NTSB vs Part 91, privilege vs limitation, required vs optional equipment). Name the part before you pick.',
  comm_airspace:
    'Airspace answers usually need class + altitude + visibility/cloud clearance together. Chart depictions change when the tower closes.',
  comm_preflight:
    'Treat assembly, positive control checks, and document review as launch-critical — most glider accidents start on the ground.',
  comm_airport:
    'Holding-position markings, runway signs, and right-of-way on the gliderport keep towplanes, gliders, and cars from occupying the same asphalt.',
  comm_tow:
    'Brief rope-break altitudes and signals before takeoff. Weak-link placement protects the glider; boxing/wake work stays high enough to recover.',
  comm_landings:
    'Aim point, energy dump (spoilers/slip), and a planned stop point beat a long float. Commercial tolerances reward precision, not heroic saves.',
  comm_perf:
    'Min sink maximizes time; best L/D maximizes distance in still air; speed-to-fly trades glide ratio against wind and sink. Pick the job first.',
  comm_soaring:
    'Lift type drives tactics: thermals need centering, ridge needs terrain clearance and wind, wave needs rotor awareness and oxygen planning.',
  comm_maneuvers:
    'Set altitude/airspeed/bank references before entry, clear the area, then fly to published commercial tolerances — not “about right.”',
  comm_stalls:
    'Critical AOA is the stall, not a particular airspeed. Recover by reducing AOA first; altitude is the margin you buy with entry height.',
  comm_emergency:
    'Aviate, navigate, communicate: fly a landable speed toward a field before troubleshooting releases, radios, or instruments.',
  comm_weather:
    'Soaring forecasts hinge on stability, moisture, and wind shear aloft. Virga, fronts, and convective cloud are clues to lift and to hazards.',
  comm_systems:
    'Know normal and failure modes for release, spoilers, instruments, and oxygen — and what the POH says you must have working.',
};

/**
 * Keyword → extra teaching note. Matched against question+answer+choices for relevance,
 * but the note itself must add context (regs, traps, related numbers) — never restate the key.
 */
const KEYWORD_NOTES = [
  {
    re: /substantial damage/,
    note: '“Substantial damage” is about structural strength, performance, or flight characteristics needing major repair — paint scratches and tire changes do not qualify.',
  },
  {
    re: /ntsb|part 830|immediate notification/,
    note: 'Part 830 separates accidents from listed incidents; when notification is required, do it immediately by the fastest means, then follow up with the written report as specified.',
  },
  {
    re: /airworthiness directive|\bads?\b/,
    note: 'ADs are legally binding under Part 39. Compliance is an owner/operator duty before further flight unless an AMOC is approved.',
  },
  {
    re: /100-?hour|annual inspection/,
    note: 'Annual is always on the calendar; 100-hour is driven by for-hire use (instruction or paid rides). One does not replace the other.',
  },
  {
    re: /inoperative|mel\b|91\.213/,
    note: 'Without an MEL, 91.213(d) means deactivate or remove, placard, and confirm the airplane/glider is still safe. Required instruments listed in the POH cannot be deferred.',
  },
  {
    re: /commercial operator|compensation or hire|61\.133/,
    note: 'Commercial operator / privilege questions turn on whether persons or property are carried for compensation or hire — and in which category the certificate authorizes that work.',
  },
  {
    re: /class [bcd]|basic vfr|cloud clearance|visibility/,
    note: 'Below 10,000 MSL in C/D/E the classic memory aid is 3-152: 3 SM visibility, 1,000 above, 500 below, 2,000 horizontal — then adjust for class and altitude band.',
  },
  {
    re: /class d|tower.*closed|part-time tower/,
    note: 'When a part-time Class D tower closes, the airspace typically reverts to Class E (or G) as charted — weather minimums and radio requirements change with it.',
  },
  {
    re: /\bwinch\b|\bauto-?tow\b|pitch oscillation/,
    note: 'Winch launches punish over-rotation: ease back-pressure and shallow the climb if the glider starts porpoising; a cable break on a steep winch climb needs an immediate nose-down.',
  },
  {
    re: /\bweak link\b|\btowline\b|91\.309|\baerotow\b|\btow rope\b|\btowplane\b/,
    note: '91.309 cares about towline length, breaking strength vs glider MGW, and which end gets the weaker safety link when the rope is too strong.',
  },
  {
    re: /oxygen|91\.211|hypoxia/,
    note: 'Supplemental oxygen rules are time-and-altitude based for the required crew; passengers have a higher altitude trigger. Hypoxia sneaks up — use oxygen before you “feel fine.”',
  },
  {
    re: /\bcg\b|center of gravity|weight and balance|ballast/,
    note: 'Aft CG reduces pitch stability and can worsen stall/spin recovery; forward CG raises stall speed and makes the flare heavier. Stay inside the published envelope.',
  },
  {
    re: /stall|critical angle|spin|autorotation/,
    note: 'Stall is AOA, not airspeed. A spin needs stall plus yaw; a steep spiral is not stalled and builds speed/G quickly — different recoveries.',
  },
  {
    re: /min(?:imum)? sink|best l\/d|l\/d|speed to fly|maccready|mac cready/,
    note: 'Min sink ≠ best L/D ≠ MacCready speed-to-fly. Using the wrong one wastes either altitude or distance, especially in sink or headwind.',
  },
  {
    re: /virga|thunderstorm|front|stability|thermal|wave|ridge/,
    note: 'Lift and hazards travel together: virga hints at evaporative cooling/outflow, fronts change stability, and wave/rotor demand terrain and oxygen discipline.',
  },
  {
    re: /scan|collision|see and avoid|traffic/,
    note: 'Effective traffic scan is short eye movements across sectors with periodic distant focus — not a slow sweep that parks on the panel or the other seat.',
  },
  {
    re: /wake turbulence|boxing the wake/,
    note: 'Stay outside the towplane’s wake when boxing; give yourself altitude to recover if you get spit out. Jet/heavy wake is a separate landing/takeoff hazard.',
  },
  {
    re: /density altitude|\bhigh da\b|pressure altitude.*temperature|takeoff distance|performance chart/,
    note: 'High density altitude thins air: true airspeed reads higher for the same IAS, and both towplane and glider performance suffer — plan longer rolls and weaker climb.',
  },
  {
    re: /v-?speed|\bvs\b|\bvne\b|\bva\b|maneuvering/,
    note: 'V-speeds are defined terms. VS is stall / minimum steady flight speed in a defined configuration — do not confuse it with approach or min-sink speeds.',
  },
  {
    re: /flight manual|afm|poh|limitations/,
    note: 'The approved Flight Manual / POH is the controlling document for limitations, loading, and required equipment for that serial-number aircraft.',
  },
  {
    re: /right of way|converging|head-on|overtaking/,
    note: 'Right-of-way rules prevent midairs when radio fails: head-on both alter right, converging yield to the right, overtaking keep clear of the one ahead — gliders still follow 91.113.',
  },
  {
    re: /holding position|runway.*marking|taxiway/,
    note: 'Surface painted holding-position markings and red/white runway signs are hard stops without clearance — chart supplement and AIM figures are worth a quick review.',
  },
  {
    re: /slip|forward slip|side slip/,
    note: 'Slips trade altitude for track without adding much airspeed when spoilers are already out or unavailable — recover to coordinated flight with enough height left to flare.',
  },
  {
    re: /medical|basicmed|fitness|alcohol|drug/,
    note: 'Glider commercial ops still need a medical path that matches the operation. Impairments (alcohol, meds, fatigue) are judgment failures before they are regulatory ones.',
  },
  {
    re: /notam|chart supplement|sectional|tf?r\b/,
    note: 'Preflight data is layered: sectional for structure, Chart Supplement for local procedures, NOTAMs/TFRs for what changed today — skip one layer and you miss a closure.',
  },
];

/** Seed commercial practical cards (short IDs) — hand-tuned teaching notes. */
const SEED_DETAILS = [
  {
    card_id: 'comm_priv_133',
    summary:
      '14 CFR 61.133 lets a commercial pilot act as PIC of a glider carrying persons or property for compensation or hire and otherwise exercise commercial privileges in that category. Airplane commercial privileges do not automatically transfer into a glider — you need the glider rating and operate within glider privileges.',
    links: [LINKS.part61, LINKS.acs],
  },
  {
    card_id: 'comm_129_f2',
    summary:
      'Under 61.129(f)(2), if you already have 200 hours in heavier-than-air aircraft, the commercial glider path requires 20 glider PIC flights; 3 hours dual (or 10 training flights) including 3 practical-test prep flights in the 2 calendar months before the test month; and 5 solo flights covering the 61.127(b)(6) areas of operation.',
    links: [LINKS.part61, LINKS.acs],
  },
  {
    card_id: 'comm_addon_kt',
    summary:
      'Adding a glider category rating to an existing commercial airplane certificate generally does not require a new commercial knowledge test under 61.63. You still complete the commercial glider practical test using the additional-rating requirements in the PTS/ACS.',
    links: [LINKS.part61, LINKS.acs],
  },
  {
    card_id: 'comm_119',
    summary:
      'Club/demo sightseeing in a glider can avoid Part 119 because 119.1(e)(5) excepts nonstop commercial air tours in an airplane or glider that begin and end at the same airport and stay within 25 SM of the takeoff airport. Part 91.147 / Part 136 sightseeing rules do not apply to gliders, but 91.409(b) 100-hour inspection still applies when carrying persons for hire.',
    links: [
      {
        label: '14 CFR 119.1 — Applicability / exceptions',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-119',
      },
      LINKS.part91,
    ],
  },
  {
    card_id: 'comm_100hr',
    summary:
      'A 100-hour inspection is required under 91.409(b) when the glider is carrying persons for hire (flight instruction for hire or paid sightseeing). An annual inspection is still required in addition to the 100-hour.',
    links: [LINKS.part91, LINKS.part43],
  },
  {
    card_id: 'comm_inop',
    summary:
      'Without an MEL, inoperative equipment is handled under 91.213(d): remove or deactivate the item, placard it, and determine the aircraft is still safe. Required instruments (for example airspeed per the POH) must work — you cannot placard away a required ASI.',
    links: [LINKS.part91, LINKS.gfh],
  },
  {
    card_id: 'comm_rope_pts',
    summary:
      'Towline / rope-break is on the commercial glider practical test. FAA-S-8081-23B Area IV Task G (Aerotow — Abnormal Occurrences) includes towline break and related abnormals; the evaluator may simulate the failure.',
    links: [LINKS.acs, LINKS.gfh],
  },
  {
    card_id: 'comm_box_wake',
    summary:
      'Boxing the wake means maneuvering on tow in a rectangular pattern slightly outside the towplane’s wake while staying coordinated and in control (PTS IV.E). The Glider Flying Handbook cautions not to practice it below about 1,000 ft AGL.',
    links: [LINKS.gfh, LINKS.acs],
  },
  {
    card_id: 'comm_91_309',
    summary:
      '14 CFR 91.309: towline at least 200 ft; breaking strength 80–200% of glider max certificated operating weight. If the rope is stronger than twice MGW, install a glider-end safety (weak) link rated 80–200% MGW and a stronger towplane-end link (not more than 25% greater than the glider-end link and not more than 2× MGW).',
    links: [LINKS.part91, LINKS.gfh],
  },
  {
    card_id: 'comm_dual_release',
    summary:
      'If both glider and towplane fail to release, the commercial PTS covers it as oral only (IV.G): discuss signals, low-tow on final, and the glider landing first while the towplane stays high enough to clear.',
    links: [LINKS.acs, LINKS.gfh],
  },
  {
    card_id: 'comm_landing_100',
    summary:
      'Commercial landing standard: touch down in the designated area and stop short of — and within 100 ft of — the designated point without rolling past it (light-to-medium braking).',
    links: [LINKS.acs, LINKS.gfh],
  },
  {
    card_id: 'comm_slip',
    summary:
      'On the slips task the evaluator picks forward, side, or turning slip. Demonstrate the slip without drag devices, hold track, and for the 2-33 initiate recovery so you are out of the slip by 50 ft remaining (POH guidance).',
    links: [LINKS.acs, LINKS.gfh],
  },
  {
    card_id: 'comm_stall_1500',
    summary:
      'Commercial stall recognition/recovery: choose an entry altitude that lets you finish no lower than 1,500 ft AGL. Recover at the first buffet or when control effectiveness decays rapidly — do not wait for a deep stall.',
    links: [LINKS.acs, LINKS.gfh],
  },
  {
    card_id: 'comm_steep',
    summary:
      'Commercial steep turn: 720° of turn at 45° ±5° bank, airspeed ±5 kt, and rollout on the entry heading ±10°.',
    links: [LINKS.acs, LINKS.gfh],
  },
  {
    card_id: 'comm_controls',
    summary:
      'PTS three-way exchange: “You have the flight controls” / “I have the flight controls” / “You have the flight controls,” followed by a visual check that the other pilot has the stick.',
    links: [LINKS.acs, LINKS.gfh],
  },
  {
    card_id: 'comm_minsink',
    summary:
      'Minimum sink and speed-to-fly are separate performance speeds. On the commercial test you must know the concepts and hold each selected speed within ±5 knots (PTS Area V).',
    links: [LINKS.gfh, LINKS.acs],
  },
  {
    card_id: 'comm_xc_glide',
    summary:
      'A 2-33’s published L/D is about 23:1, but XC planning should use roughly half of that (about 11:1, or ~2 NM per 1,000 ft) so you still make a field with margin for sink and wind.',
    links: [LINKS.gfh, LINKS.acs],
  },
  {
    card_id: 'comm_off_airport',
    summary:
      'Simulated off-airport landing on the commercial test is flown at an established airport without using the altimeter. Field-selection knowledge is covered orally.',
    links: [LINKS.acs, LINKS.gfh],
  },
  {
    card_id: 'comm_addon_table',
    summary:
      'Airplane commercial → glider add-on required table: Navigation (VIII) is NONE. You typically also skip I.A Certificates, II.D Flight Deck Management, and III.A/C — but the evaluator may still sample skipped tasks, so prepare them.',
    links: [LINKS.acs, LINKS.part61],
  },
];

function corpus(card) {
  // Match on stem/choices only. Omit the answer (so Details never echoes the key)
  // and omit topic titles/ids (e.g. “Aerotow & abnormals”) that false-trigger tips.
  const parts = [card.question, ...(Array.isArray(card.choices) ? card.choices : [])];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Build Details text that adds teaching value only — never restates the
 * question stem or the correct-answer wording.
 */
function buildSummary(card) {
  const text = corpus(card);
  const notes = [];

  for (const row of KEYWORD_NOTES) {
    if (row.re.test(text)) notes.push(row.note);
    if (notes.length >= 2) break;
  }

  const topicNote = TOPIC_CONTEXT[card.topic_id];
  if (topicNote && notes.length < 2) notes.push(topicNote);

  if (!notes.length) {
    notes.push(
      'Use the linked references to deepen the “why,” not just memorize the letter. Commercial written items often turn on a nearby rule or a look-alike definition.'
    );
  }

  return notes.slice(0, 2).join(' ');
}

function linksFor(card) {
  const topicLinks = TOPIC_LINKS[card.topic_id] || [LINKS.gfh, LINKS.phak];
  const q = `${card.question || ''} ${card.answer || ''}`.toLowerCase();
  const extra = [];
  if (/\bntsb\b|part 830|substantial damage|immediate notification/.test(q)) extra.push(LINKS.ntsb830);
  if (/\b61\.\d+|commercial privilege|certificate|rating\b/.test(q)) extra.push(LINKS.part61);
  if (/\b91\.\d+|vfr|oxygen|aerotow|weak link|airworthiness directive|\bad\b/.test(q)) {
    extra.push(LINKS.part91);
  }
  if (/\bclass [a-g]\b|airspace|tfr|sua\b/.test(q)) extra.push(LINKS.aim);
  if (/\bstall|spin|aspect ratio|lift|drag|cg\b|weight and balance/.test(q)) extra.push(LINKS.phak);
  if (/\bthermal|ridge|wave|soaring|tow|spoiler|winch|min sink|l\/d|maccready/.test(q)) {
    extra.push(LINKS.gfh);
  }
  if (/\bweather|front|virga|stability|cloud|wind shear|thunderstorm/.test(q)) {
    extra.push(LINKS.weather);
  }

  const seen = new Set();
  const out = [];
  for (const link of [...topicLinks, ...extra]) {
    if (!link?.url || seen.has(link.url)) continue;
    seen.add(link.url);
    out.push({ label: link.label, url: link.url });
    if (out.length >= 3) break;
  }
  return out;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Hand-authored commercial_written details already in the file — never replace. */
const PRESERVE_WRITTEN = new Set([
  'commercial_written_001',
  'commercial_written_003',
  'commercial_written_007',
  'commercial_written_008',
  'commercial_written_009',
  'commercial_written_026',
  'commercial_written_032',
  'commercial_written_034',
  'commercial_written_047',
  'commercial_written_050',
]);

function main() {
  const detailsDoc = loadJson(detailsPath);
  const existingAll = Array.isArray(detailsDoc.details) ? detailsDoc.details : [];

  // Drop prior auto commercial details so this script can rebuild them cleanly.
  // Keep CFI/other tracks, preserved written notes, and non-seed commercial only if preserved.
  const seedIds = new Set(SEED_DETAILS.map((d) => d.card_id));
  const existing = existingAll.filter((d) => {
    const id = String(d.card_id || '');
    if (PRESERVE_WRITTEN.has(id)) return true;
    if (seedIds.has(id)) return false; // replace with hand SEED_DETAILS
    if (id.startsWith('commercial_written_')) return false;
    if (id.startsWith('comm_')) return false;
    return true;
  });

  const have = new Set(existing.map((d) => String(d.card_id || '').trim()).filter(Boolean));

  const commercialImport = loadJson(commercialImportPath);
  const importCards = Array.isArray(commercialImport.cards) ? commercialImport.cards : [];

  const seed = loadJson(seedPath);
  const seedCards = (seed.cards || []).filter((c) => c.track_id === 'commercial');

  const generated = [];

  for (const hand of SEED_DETAILS) {
    if (have.has(hand.card_id)) continue;
    generated.push(hand);
    have.add(hand.card_id);
  }

  for (const card of seedCards) {
    if (!card?.id || have.has(card.id)) continue;
    generated.push({
      card_id: card.id,
      summary: buildSummary(card),
      links: linksFor(card),
    });
    have.add(card.id);
  }

  for (const card of importCards) {
    if (!card?.id || have.has(card.id)) continue;
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

  const commercialCount = merged.filter((d) => {
    const id = String(d.card_id || '');
    return id.startsWith('commercial_') || id.startsWith('comm_');
  }).length;

  console.log(
    JSON.stringify(
      {
        kept_non_commercial_or_preserved: existing.length,
        generated: generated.length,
        total: merged.length,
        commercial_details: commercialCount,
        import_cards: importCards.length,
        seed_commercial: seedCards.length,
      },
      null,
      2
    )
  );
}

main();
