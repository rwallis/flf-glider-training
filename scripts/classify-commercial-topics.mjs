/**
 * Assign each Commercial written-bank card to a Commercial Glider PTS / knowledge topic.
 *
 * Usage:
 *   node scripts/classify-commercial-topics.mjs
 *   node scripts/classify-commercial-topics.mjs --write
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IN_PATH = path.join(ROOT, 'content', 'commercial-written-import.json');
const OUT_DIR = path.join(ROOT, 'content', 'commercial-import');
const OUT_PATH = path.join(OUT_DIR, 'commercial-import.json');
const REPORT_PATH = path.join(OUT_DIR, 'topic-classify-report.json');
const WRITE = process.argv.includes('--write');

/** Commercial Glider knowledge / PTS topics (parallel to CFI-G technical areas). */
export const COMMERCIAL_TOPICS = [
  {
    id: 'comm_certs',
    title: 'Certificates & privileges',
    description: 'Commercial privileges, currency, medical, experience.',
    pts_ref: 'PTS I.A / 61.133',
    sort_order: 10
  },
  {
    id: 'comm_airworthy',
    title: 'Airworthiness',
    description: 'Inspections, ADs, maintenance records, INOP gear.',
    pts_ref: 'PTS I.B',
    sort_order: 20
  },
  {
    id: 'comm_aeromedical',
    title: 'Aeromedical & human factors',
    description: 'Hypoxia, ADM, hazardous attitudes, fitness to fly.',
    pts_ref: 'AIM / PHAK',
    sort_order: 30
  },
  {
    id: 'comm_scan',
    title: 'Scanning & collision avoidance',
    description: 'See-and-avoid, wake turbulence, clearing procedures.',
    pts_ref: 'AC 90-48',
    sort_order: 40
  },
  {
    id: 'comm_aero',
    title: 'Principles of flight',
    description: 'Lift, drag, stability, airfoils, forces in flight.',
    pts_ref: 'GFH / PHAK',
    sort_order: 50
  },
  {
    id: 'comm_controls',
    title: 'Flight controls & devices',
    description: 'Ailerons, rudder, trim, spoilers, dive brakes, adverse yaw.',
    pts_ref: 'GFH',
    sort_order: 60
  },
  {
    id: 'comm_wb',
    title: 'Weight & balance',
    description: 'CG, ballast, loading, envelopes.',
    pts_ref: 'PTS / POH',
    sort_order: 70
  },
  {
    id: 'comm_nav',
    title: 'Navigation & flight planning',
    description: 'Charts, pilotage, dead reckoning, XC planning.',
    pts_ref: 'PTS VIII',
    sort_order: 80
  },
  {
    id: 'comm_regs',
    title: 'Regulations & publications',
    description: '14 CFR, NTSB, AIM, Chart Supplement, NOTAMs.',
    pts_ref: '14 CFR / NTSB 830',
    sort_order: 90
  },
  {
    id: 'comm_airspace',
    title: 'National Airspace System',
    description: 'Airspace classes, TFRs, SUA, communications.',
    pts_ref: 'AIM / 91.155',
    sort_order: 100
  },
  {
    id: 'comm_preflight',
    title: 'Preflight preparation',
    description: 'Documents, weather briefing, assembly, ground handling.',
    pts_ref: 'PTS I–II',
    sort_order: 110
  },
  {
    id: 'comm_airport',
    title: 'Airport & gliderport operations',
    description: 'Patterns, signs, markings, lighting, taxi.',
    pts_ref: 'PTS III',
    sort_order: 120
  },
  {
    id: 'comm_tow',
    title: 'Aerotow & abnormals',
    description: 'Positions, boxing, rope break, release failures, winch/auto.',
    pts_ref: 'PTS IV.A–G',
    sort_order: 130
  },
  {
    id: 'comm_landings',
    title: 'Landings & pattern',
    description: 'Approach, slips, touchdown, downwind landings.',
    pts_ref: 'PTS III.B / IV.Q–S',
    sort_order: 140
  },
  {
    id: 'comm_perf',
    title: 'Performance airspeeds',
    description: 'Min sink, best L/D, speed-to-fly, density altitude.',
    pts_ref: 'PTS V',
    sort_order: 150
  },
  {
    id: 'comm_soaring',
    title: 'Soaring techniques',
    description: 'Thermals, ridge, wave, lift sources.',
    pts_ref: 'PTS VI',
    sort_order: 160
  },
  {
    id: 'comm_maneuvers',
    title: 'Performance maneuvers',
    description: 'Straight glides, turns to headings, steep turns.',
    pts_ref: 'PTS VII',
    sort_order: 170
  },
  {
    id: 'comm_stalls',
    title: 'Slow flight, stalls & spins',
    description: 'Stall recognition/recovery, spin entry/recovery.',
    pts_ref: 'PTS IX',
    sort_order: 180
  },
  {
    id: 'comm_emergency',
    title: 'Emergency operations',
    description: 'Rope break, off-field, systems failures, abnormals.',
    pts_ref: 'PTS X',
    sort_order: 190
  },
  {
    id: 'comm_weather',
    title: 'Weather',
    description: 'Reports, forecasts, fronts, thunderstorms, icing.',
    pts_ref: 'AC 00-6 / AIM',
    sort_order: 200
  },
  {
    id: 'comm_systems',
    title: 'Systems & instruments',
    description: 'Pitot-static, compass, ASI markings, oxygen.',
    pts_ref: 'GFH / PHAK',
    sort_order: 210
  }
];

const TOPIC_BY_ID = Object.fromEntries(COMMERCIAL_TOPICS.map((t) => [t.id, t]));

/** Ordered rules: first match wins. */
const RULES = [
  {
    id: 'comm_scan',
    any: [
      /\bwake turbulence\b/i,
      /\bwingtip vort/i,
      /\bvortex\b/i,
      /\bcollision avoid/i,
      /\bvisual scanning\b/i,
      /\bsee and avoid\b/i,
      /\bclearing turn/i,
      /\bto scan properly\b/i
    ]
  },
  {
    id: 'comm_stalls',
    any: [
      /\bspin\b/i,
      /\bstall\b/i,
      /\bslow flight\b/i,
      /\baccelerated stall/i
    ]
  },
  {
    id: 'comm_tow',
    any: [
      /\baerotow\b/i,
      /\btow(?:line|rope|plane|hook|position|pilot)\b/i,
      /\bwinch\b/i,
      /\bauto.?tow\b/i,
      /\brope break\b/i,
      /\bsafety link\b/i,
      /\bweak.?link\b/i,
      /\bbox(?:ing)? the wake\b/i,
      /\blaunch\b/i
    ]
  },
  {
    id: 'comm_landings',
    any: [
      /\bforward slip\b/i,
      /\bside slip\b/i,
      /\btouchdown\b/i,
      /\blanding\b/i,
      /\bapproach to land/i,
      /\bdownwind landing\b/i
    ]
  },
  {
    id: 'comm_soaring',
    any: [
      /\bthermal\b/i,
      /\bridge soar/i,
      /\bwave soar/i,
      /\borographic\b/i,
      /\bsoaring\b/i,
      /\blift source/i,
      /\bconvergen/i,
      /\bwater ballast\b/i
    ]
  },
  {
    id: 'comm_wb',
    any: [
      /\bweight and balance\b/i,
      /\bcenter of gravity\b/i,
      /\bCG\b/,
      /\bballast\b/i,
      /\bmoment\b/i,
      /\bempty weight\b/i,
      /\bgross weight\b/i,
      /\bloading\b/i
    ]
  },
  {
    id: 'comm_perf',
    any: [
      /\bdensity alt/i,
      /\bpressure alt/i,
      /\babsolute alt/i,
      /\btrue alt/i,
      /\bindicated alt/i,
      /\bglide ratio\b/i,
      /\bL\/D\b/i,
      /\baspect ratio\b/i,
      /\bbest (?:l\/d|glide)\b/i,
      /\bmin(?:imum)? sink\b/i,
      /\bspeed.?to.?fly\b/i,
      /\bmaccready\b/i,
      /\bperformance chart\b/i,
      /\bcrosswind component\b/i,
      /\bnever.?exceed\b/i,
      /\bmaneuvering speed\b/i,
      /\bvne\b/i,
      /\bforward speed on a cross-country\b/i
    ]
  },
  {
    id: 'comm_weather',
    any: [
      /\bthunderstorm\b/i,
      /\bfront(?:al)?\b/i,
      /\bfrost\b/i,
      /\bicing\b/i,
      /\bturbulence\b/i,
      /\bwind shear\b/i,
      /\bMETAR\b/i,
      /\bTAF\b/i,
      /\bAIRMET\b/i,
      /\bSIGMET\b/i,
      /\bweather\b/i,
      /\batmospheric\b/i,
      /\bclouds?\b/i,
      /\binversion\b/i,
      /\bradar summary\b/i,
      /\bwinds? aloft\b/i,
      /\bdewpoint\b/i,
      /\blapse rate\b/i,
      /\bcauses wind\b/i,
      /\bwind flow\b/i,
      /\bpressure (?:system|gradient|area)\b/i,
      /\bhigh pressure\b/i,
      /\blow pressure\b/i,
      /\bstandard temperature and pressure\b/i,
      /\bmean sea level\b/i,
      /\bair mass\b/i,
      /\bstable air\b/i,
      /\bunstable air\b/i,
      /\bprecipitation\b/i,
      /\bsquall\b/i,
      /\bhumidity\b/i,
      /\btemperature spread\b/i,
      /\bvirga\b/i,
      /\bridgetop wind\b/i
    ]
  },
  {
    id: 'comm_emergency',
    any: [
      /\bin-flight emergency\b/i,
      /\bemergency requires\b/i,
      /\bemergency\b/i,
      /\babnormal\b/i,
      /\boff.?field\b/i,
      /\bforced landing\b/i,
      /\bspiral dive\b/i,
      /\bdiving spiral\b/i,
      /\bdeviate from an air traffic\b/i
    ]
  },
  {
    id: 'comm_aeromedical',
    any: [
      /\bhypoxia\b/i,
      /\bhyperventilation\b/i,
      /\bspatial disorientation\b/i,
      /\bmotion sickness\b/i,
      /\balcohol\b/i,
      /\bdrug\b/i,
      /\bscuba\b/i,
      /\bdehydrat/i,
      /\bhazardous attitude/i,
      /\bimpulsivity\b/i,
      /\bmachismo\b/i,
      /\binvulnerability\b/i,
      /\bresignation\b/i,
      /\baeronautical decision\b/i,
      /\bADM\b/,
      /\bIMSAFE\b/i,
      /\bfatigue\b/i,
      /\bcockpit stress\b/i,
      /\bstress\b/i
    ]
  },
  {
    id: 'comm_airworthy',
    any: [
      /\bairworthiness directive\b/i,
      /\b\bAD\b/,
      /\b100.?hour\b/i,
      /\bannual inspection\b/i,
      /\bmaintenance records?\b/i,
      /\breturned to service\b/i,
      /\bprogressive inspection\b/i,
      /\binoperative\b/i,
      /\bMEL\b/,
      /\bairworthiness certificate\b/i
    ]
  },
  {
    id: 'comm_certs',
    any: [
      /\bcommercial (?:pilot|certificate|privileges)\b/i,
      /\bprivate pilot certificate\b/i,
      /\bstudent pilot certificate\b/i,
      /\bmedical certificate\b/i,
      /\bflight review\b/i,
      /\bprivileges?\b/i,
      /\bto act as (?:pilot in command|PIC)\b/i,
      /\btakeoffs and (?:three )?landings\b/i,
      /\bwithin the preceding\b/i,
      /\bcurrency\b/i,
      /\blogbook\b/i,
      /\bendorsement\b/i,
      /\bknowledge test\b/i,
      /\boperat(?:e|ion) for hire\b/i,
      /\bcompensation or hire\b/i,
      /\bpart 119\b/i
    ]
  },
  {
    id: 'comm_airspace',
    any: [
      /\bclass [abcdefg]\b/i,
      /\bairspace\b/i,
      /\bMOA\b/,
      /\bTFR\b/,
      /\brestricted area\b/i,
      /\bprohibited area\b/i,
      /\bwarning area\b/i,
      /\balert area\b/i,
      /\btransponder\b/i,
      /\bsquawk\b/i,
      /\bATC\b/,
      /\bair traffic control\b/i,
      /\btwo-way radio\b/i,
      /\blight signal\b/i
    ]
  },
  {
    id: 'comm_airport',
    any: [
      /\brunway\b/i,
      /\btaxiway\b/i,
      /\bairport\b/i,
      /\bgliderport\b/i,
      /\btraffic pattern\b/i,
      /\bmarking\b/i,
      /\bholding position\b/i,
      /\bhold short\b/i,
      /\bdisplaced threshold\b/i,
      /\bdemarcation bar\b/i,
      /\bvehicle lane\b/i,
      /\bcritical area\b/i
    ]
  },
  {
    id: 'comm_nav',
    any: [
      /\bsectional\b/i,
      /\bVOR\b/,
      /\bVORTAC\b/,
      /\bpilotage\b/i,
      /\bdead reckoning\b/i,
      /\bnavigation\b/i,
      /\bgroundspeed\b/i,
      /\bmagnetic compass\b/i,
      /\bvariation\b/i,
      /\bdeviation\b/i,
      /\bhow far will an aircraft travel\b/i,
      /\bcross-country\b/i,
      /\bflying from [A-Z] to [A-Z]\b/i
    ]
  },
  {
    id: 'comm_systems',
    any: [
      /\bpitot\b/i,
      /\bstatic system\b/i,
      /\bairspeed indicator\b/i,
      /\balimeter\b/i,
      /\bcompass\b/i,
      /\binstrument\b/i,
      /\boxygen\b/i,
      /\btotal energy\b/i,
      /\bvariometer\b/i,
      /\bgreen arc\b/i,
      /\byellow arc\b/i,
      /\bwhite arc\b/i,
      /\bred (?:radial )?line\b/i,
      /\bflight manual\b/i
    ]
  },
  {
    id: 'comm_controls',
    any: [
      /\baileron\b/i,
      /\brudder\b/i,
      /\belevator\b/i,
      /\badverse yaw\b/i,
      /\bspoiler\b/i,
      /\bdive brake\b/i,
      /\btrim\b/i,
      /\bflap\b/i
    ]
  },
  {
    id: 'comm_maneuvers',
    any: [
      /\bsteep turn\b/i,
      /\bturns? to headings?\b/i,
      /\bstraight glide\b/i,
      /\brate of turn\b/i,
      /\bradius of turn\b/i,
      /\bbank(?:ed| angle)\b/i,
      /\bcentrifugal force\b/i
    ]
  },
  {
    id: 'comm_preflight',
    any: [
      /\bpreflight\b/i,
      /\bassembly\b/i,
      /\bground handling\b/i,
      /\bregistration\b/i,
      /\bbefore takeoff check\b/i,
      /\bcertificates and documents\b/i,
      /\brequired by regulation to be available\b/i
    ]
  },
  {
    id: 'comm_regs',
    any: [
      /\bFAR\b/,
      /\b14 CFR\b/i,
      /\bNTSB\b/,
      /\bregulation\b/i,
      /\bprivileges? and limitations\b/i,
      /\bpilot in command\b/i,
      /\brequired to file\b/i,
      /\baccident report\b/i,
      /\bsubstantial damage\b/i,
      /\bChart Supplement\b/i,
      /\bAirport\/Facility\b/i,
      /\bNOTAM\b/i,
      /\bparachute jumping\b/i,
      /\bpublic figures?\b/i,
      /\bpresent it for inspection\b/i,
      /\bno person may\b/i,
      /\bnotification to the NTSB\b/i
    ]
  },
  {
    id: 'comm_aero',
    any: [
      /\blift\b/i,
      /\bdrag\b/i,
      /\bairfoil\b/i,
      /\bangle of attack\b/i,
      /\bstability\b/i,
      /\bbernoulli\b/i,
      /\brelative wind\b/i,
      /\bcenter of pressure\b/i,
      /\bchord\b/i,
      /\bcamber\b/i,
      /\binduced\b/i,
      /\bparasite\b/i,
      /\bload factor\b/i,
      /\baxes of an aircraft\b/i,
      /\bmaneuverability\b/i,
      /\bcontrollability\b/i,
      /\baerodynamic\b/i,
      /\bsteady-state\b/i,
      /\bforces acting\b/i
    ]
  }
];

function classifyCard(card) {
  const blob = [card.question, card.answer, ...(card.choices || [])].join('\n');
  for (const rule of RULES) {
    if (rule.any.some((re) => re.test(blob))) {
      return rule.id;
    }
  }
  if (/\bforce|pressure|wing|flight|aircraft\b/i.test(blob)) return 'comm_aero';
  return 'comm_regs';
}

const data = JSON.parse(readFileSync(IN_PATH, 'utf8'));
const counts = Object.fromEntries(COMMERCIAL_TOPICS.map((t) => [t.id, 0]));
const assignments = [];
const cards = (data.cards || []).map((card) => {
  const topicId = classifyCard(card);
  counts[topicId] = (counts[topicId] || 0) + 1;
  const topic = TOPIC_BY_ID[topicId];
  assignments.push({
    id: card.id,
    topic_id: topicId,
    title: topic.title,
    q: card.question.slice(0, 80)
  });
  return {
    ...card,
    topic_id: topicId,
    topic_title: topic.title,
    tags: Array.from(new Set([...(card.tags || []), 'commercial', topicId]))
  };
});

mkdirSync(OUT_DIR, { recursive: true });

const report = {
  total: cards.length,
  counts: Object.fromEntries(
    COMMERCIAL_TOPICS.map((t) => [t.id, { title: t.title, count: counts[t.id] || 0 }])
  ),
  assignments
};

console.log(`Classified ${cards.length} cards:\n`);
for (const t of COMMERCIAL_TOPICS) {
  const n = counts[t.id] || 0;
  if (n) console.log(`${String(n).padStart(4)}  ${t.id.padEnd(18)} ${t.title}`);
}
const zero = COMMERCIAL_TOPICS.filter((t) => !(counts[t.id] > 0)).map((t) => t.id);
if (zero.length) console.log('\nUnused topics:', zero.join(', '));

writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`\nWrote report ${REPORT_PATH}`);

if (WRITE) {
  const out = {
    track_id: 'commercial',
    topic_title: 'Commercial written question bank',
    filename: data.filename || 'commercial-written',
    note: `${data.note || ''} · Topic classification ${new Date().toISOString().slice(0, 10)}`.trim(),
    topics: COMMERCIAL_TOPICS.map((t) => ({ ...t, track_id: 'commercial' })),
    cards
  };
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${OUT_PATH}`);
} else {
  console.log('Dry run only. Re-run with --write to save topic_ids onto cards.');
}
