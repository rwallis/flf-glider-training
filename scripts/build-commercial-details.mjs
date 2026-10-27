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

const TOPIC_TIP = {
  comm_certs:
    'Know privilege vs limitation wording on the commercial certificate and what 61.133 does (and does not) authorize in gliders.',
  comm_airworthy:
    'Airworthiness is continuous: inspections, ADs, and required documents must be current before every flight.',
  comm_aeromedical:
    'Fitness to fly and recognition of hypoxia, fatigue, and hazardous attitudes are part of commercial judgment.',
  comm_scan:
    'See-and-avoid is active: organized scanning beats staring at one spot or relying on the other pilot.',
  comm_aero:
    'Relate the force balance and airfoil behavior to what you feel on the stick in the glider.',
  comm_controls:
    'Name the primary effect of each control and how spoilers/dive brakes change both lift and drag.',
  comm_wb:
    'CG and weight must stay inside the envelope — empty weight alone is not a loading check.',
  comm_nav:
    'Pilotage and planning still matter in gliders: know where you are and where you can land.',
  comm_regs:
    'Match the regulation to the action — NTSB notification, Part 91 operating rules, and definitions are frequent written traps.',
  comm_airspace:
    'Class, weather minimums, and communication requirements change together — memorize the basic VFR table.',
  comm_preflight:
    'A commercial preflight is systematic: documents, weather, assembly, and a walk-around that catches real defects.',
  comm_airport:
    'Signs, markings, and pattern discipline prevent runway incursions and midairs at busy fields.',
  comm_tow:
    'Tow is a two-aircraft system: positions, signals, weak link, and rope-break plans are non-negotiable.',
  comm_landings:
    'Energy management on final (spoilers, slips, aim point) is the commercial landing skill.',
  comm_perf:
    'Min sink, best L/D, and speed-to-fly are different numbers for different jobs — do not mix them up.',
  comm_soaring:
    'Thermal, ridge, and wave each have entry, centering, and exit discipline tied to weather.',
  comm_maneuvers:
    'Commercial maneuvers are precision tasks: set-up, tolerances, and lookout before every break.',
  comm_stalls:
    'Stalls are AOA events. Teach recognition and recovery before airspeed myths.',
  comm_emergency:
    'Decide early: landable field, rope-break plan, and fly the aircraft first.',
  comm_weather:
    'Soaring weather is about stability, moisture, and wind structure — not just “clear and sunny.”',
  comm_systems:
    'Know how the glider’s systems fail and what the POH requires before flight.',
};

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

function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function endsWithPunct(text) {
  return /[.!?]$/.test(text.trim());
}

function buildSummary(card) {
  const question = String(card.question || '').replace(/\s+/g, ' ').trim();
  const answer = String(card.answer || '').replace(/\s+/g, ' ').trim();
  const tip =
    TOPIC_TIP[card.topic_id] ||
    'Know why the correct choice is right and what trap the wrong choices set.';

  if (!answer) {
    return `${question} Review the commercial glider references for this item. ${tip}`;
  }

  const stem = question.replace(/\?+$/, '').trim();
  const ans = answer.replace(/^\s+/, '');
  const continuation =
    /^[a-z]/.test(ans) ||
    /^(which|that|to|for|when|by|in|of|a|an|the|and|or|with|from|as|if|because)\b/i.test(ans);
  const incompleteStem =
    /\b(which of the following|which is true|which is|which means|defined as|required when|required if|means that|best described as)\b/i.test(
      stem
    ) || /[:—–-]\s*$/.test(stem);

  let core;
  if (continuation && stem) {
    core = `${stem} ${ans}`;
  } else if (incompleteStem && stem) {
    // Multiple-choice stem + complete choice text → one teaching sentence.
    core = `${stem}: ${ans}`;
  } else if (stem && !ans.toLowerCase().includes(stem.slice(0, 24).toLowerCase())) {
    const cleanStem = stem
      .replace(
        /\b(which of the following|which is true|which is correct|which is|as a result of which incident|which means|means that)\b.*$/i,
        ''
      )
      .replace(/[:—–-]\s*$/, '')
      .trim();
    const choice =
      /^[A-Z][a-z]/.test(ans) ? ans.charAt(0).toLowerCase() + ans.slice(1) : ans;
    core = cleanStem ? `${cleanStem} — ${choice}` : ans;
  } else if (/[.!?]$/.test(ans)) {
    core = ans;
  } else {
    core = `${ans}.`;
  }

  core = capitalize(core.replace(/\s+/g, ' ').trim());
  if (!endsWithPunct(core)) core += '.';
  return `${core} ${tip}`;
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
