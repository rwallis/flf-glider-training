/**
 * Build Details (summary + reference links) for Private Pilot Glider questions.
 * Merges into content/card-details.json without overwriting existing entries.
 *
 * Summaries add teaching context / traps — they never restate the question or keyed answer.
 *
 * Run: node scripts/build-private-details.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const detailsPath = path.join(root, 'content', 'card-details.json');
const privateImportPath = path.join(root, 'content', 'private-import', 'private-import.json');

const LINKS = {
  phak: {
    label: 'Pilot’s Handbook of Aeronautical Knowledge (PHAK)',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak'
  },
  gfh: {
    label: 'Glider Flying Handbook',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/glider_handbook'
  },
  aim: {
    label: 'Aeronautical Information Manual (AIM)',
    url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/'
  },
  part1: {
    label: '14 CFR Part 1 — Definitions',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-A/part-1'
  },
  part61: {
    label: '14 CFR Part 61 — Certification',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61'
  },
  part91: {
    label: '14 CFR Part 91 — General Operating Rules',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91'
  },
  part43: {
    label: '14 CFR Part 43 — Maintenance',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-C/part-43'
  },
  part39: {
    label: '14 CFR Part 39 — Airworthiness Directives',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-C/part-39'
  },
  ntsb830: {
    label: '49 CFR Part 830 — NTSB Notification and Reporting',
    url: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-VIII/part-830'
  },
  chartSupp: {
    label: 'Chart Supplement / Airport data',
    url: 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/'
  },
  ac9048: {
    label: 'AC 90-48 — Pilots’ Role in Collision Avoidance',
    url: 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_90-48D.pdf'
  },
  weather: {
    label: 'Aviation Weather Handbook',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation'
  },
  pts: {
    label: 'Private Pilot PTS / ACS (Glider)',
    url: 'https://www.faa.gov/training_testing/testing/test_standards'
  },
  sectional: {
    label: 'FAA VFR sectional / chart users guide',
    url: 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/'
  },
  signs: {
    label: 'AIM — Airport Marking Aids and Signs',
    url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap2_section_3.html'
  }
};

const TOPIC_LINKS = {
  priv_certs: [LINKS.part61, LINKS.pts],
  priv_airworthy: [LINKS.part91, LINKS.part43, LINKS.part39],
  priv_aeromedical: [LINKS.phak, LINKS.aim],
  priv_scan: [LINKS.ac9048, LINKS.aim],
  priv_aero: [LINKS.phak, LINKS.gfh],
  priv_controls: [LINKS.gfh, LINKS.phak],
  priv_wb: [LINKS.gfh, LINKS.phak],
  priv_nav: [LINKS.phak, LINKS.sectional],
  priv_regs: [LINKS.part91, LINKS.part61],
  priv_airspace: [LINKS.aim, LINKS.part91],
  priv_preflight: [LINKS.gfh, LINKS.phak],
  priv_airport: [LINKS.aim, LINKS.signs],
  priv_tow: [LINKS.gfh, LINKS.part91],
  priv_landings: [LINKS.gfh, LINKS.pts],
  priv_perf: [LINKS.gfh, LINKS.phak],
  priv_soaring: [LINKS.gfh, LINKS.weather],
  priv_stalls: [LINKS.gfh, LINKS.phak],
  priv_emergency: [LINKS.gfh, LINKS.pts],
  priv_weather: [LINKS.weather, LINKS.aim],
  priv_systems: [LINKS.gfh, LINKS.phak],
  priv_misc: [LINKS.phak, LINKS.gfh]
};

const TOPIC_CONTEXT = {
  priv_certs:
    'Private privileges are category- and class-specific. Age, solo endorsements, passenger-carrying currency, and medical/self-certification rules sit in Part 61 — read the paragraph that matches the operation.',
  priv_airworthy:
    'Airworthiness is continuous: annual, ADs, and required equipment status all matter before launch. Preventive maintenance (Part 43 Appendix A) is limited and must be logged correctly.',
  priv_aeromedical:
    'Even without a required FAA medical for many glider ops, 61.53 still bars flying with a known deficiency that makes you unsafe. Alcohol, meds, hypoxia, and fatigue are judgment traps.',
  priv_scan:
    'Collision avoidance is a deliberate scan pattern plus clearing turns — short eye hops across sectors with distant focus, not a slow sweep parked on the panel.',
  priv_aero:
    'Force pairs balance in steady flight; change bank, pitch, or speed and lift/drag/weight rearrange immediately. Stall is AOA, not a magic airspeed.',
  priv_controls:
    'Primary effects first, then secondary (adverse yaw, pitch change with spoiler). Spoilers dump lift and add drag — they are not “flaps in reverse.”',
  priv_wb:
    'Empty weight/CG come from this glider’s records; seat arms and ballast from the Flight Manual. Aft CG softens pitch stability; forward CG raises stall speed.',
  priv_nav:
    'Sectionals encode airspace, obstacles, and landability. Measure carefully, convert units once, and always know the next landable field — not just the destination.',
  priv_regs:
    'Written traps mix adjacent rules (Part 61 vs 91, privilege vs limitation, required vs optional equipment). Name the part and paragraph family before you pick.',
  priv_airspace:
    'Most airspace answers need class + altitude band + visibility/cloud clearance together. Chart depictions and radio requirements change when a part-time tower closes.',
  priv_preflight:
    'Assembly, positive control checks, and documents are launch-critical. Most glider accidents begin with a ground omission.',
  priv_airport:
    'Holding-position markings, runway/taxiway signs, and segmented-circle traffic patterns keep towplanes, gliders, and cars from sharing the same pavement.',
  priv_tow:
    'Brief rope-break altitudes and aerotow signals before takeoff. Weak-link placement and 91.309 towline limits protect the glider and the towplane.',
  priv_landings:
    'Aim point, energy management (spoilers/slip), and a planned stop beat a long float. Pattern discipline and wind assessment start before base.',
  priv_perf:
    'Min sink maximizes time; best L/D maximizes distance in still air; speed-to-fly trades glide ratio against wind and sink. Pick the job first.',
  priv_soaring:
    'Lift type drives tactics: thermals need centering, ridge needs terrain clearance and wind, wave needs rotor awareness and oxygen planning.',
  priv_stalls:
    'Critical AOA is the stall, not a particular IAS. Recover by reducing AOA first; altitude is the margin you buy with entry height.',
  priv_emergency:
    'Aviate, navigate, communicate: fly a landable speed toward a field before troubleshooting releases, radios, or instruments.',
  priv_weather:
    'Soaring and VFR both hinge on stability, moisture, and wind. METARs/TAFs, fronts, and convective clues tell you about lift and about hazards.',
  priv_systems:
    'Know normal and failure modes for release, spoilers, instruments, and pitot-static — and what the POH says must work for flight.',
  priv_misc:
    'Private written items often turn on a nearby definition or a look-alike number. Use the linked references for the “why,” not only the letter.'
};

const KEYWORD_NOTES = [
  {
    re: /\bcategory\b|\bclass of aircraft\b|certification of airmen|certification of aircraft/,
    note: 'Airmen “category/class” (airplane, glider, … / single-engine land, …) is not the same as aircraft certification category (normal, utility, acrobatic). Part 1 and Part 61 use the words differently.'
  },
  {
    re: /nighttime|\bnight\b|civil twilight|sunset|sunrise|position lights/,
    note: 'Regulatory “night” for logging and currency is end of evening civil twilight to beginning of morning civil twilight — not merely sunset to sunrise. Position-light rules use a different clock window.'
  },
  {
    re: /\bv-?speed|\bv\([a-z]+\)|\bva\b|\bvne\b|\bvso\b|\bvno\b|\bvfe\b|\bvle\b|\bvlo\b/,
    note: 'V-speeds are defined terms in Part 1. Do not swap maneuvering, never-exceed, flap/gear, or stall-configuration speeds — the letter after V is the whole point.'
  },
  {
    re: /airworthiness directive|\bads?\b(?!\w)/,
    note: 'ADs are mandatory under Part 39. Compliance is an owner/operator duty before further flight unless an AMOC is approved.'
  },
  {
    re: /preventive maintenance|43\.7|appendix a/,
    note: 'Part 43 Appendix A lists what a private pilot may do as preventive maintenance; the work must still be entered in the maintenance records with certificate data.'
  },
  {
    re: /annual inspection|100-?hour|condition inspection/,
    note: 'Annual is calendar-driven; 100-hour is driven by for-hire use. One does not replace the other when both apply.'
  },
  {
    re: /medical|61\.53|basicmed|fitness for|alcoholic|alcohol|drug|hypoxia|imsafe|fit to fly/,
    note: 'Many glider private ops need no FAA medical, but 61.53 still requires you to be fit. Alcohol, meds, fatigue, and hypoxia are judgment failures before they are paperwork failures.'
  },
  {
    re: /passenger.?carrying|61\.57|currency|takeoffs and landings/,
    note: 'Passenger-carrying currency is category/class specific: three takeoffs and landings in a glider within 90 days (61.57), separate from airplane currency.'
  },
  {
    re: /ntsb|part 830|substantial damage|immediate notification/,
    note: 'Part 830 separates accidents from listed incidents; when notification is required, do it immediately by the fastest means, then follow up in writing as specified.'
  },
  {
    re: /class [bcd]|basic vfr|cloud clearance|class g|1,200 feet agl|10,000 feet msl|vfr flight is/,
    note: 'Below 10,000 MSL in C/D/E the classic memory aid is 3-152 — then adjust for class and altitude. Above 10,000 MSL the cloud clearances jump (1,000 above / 1,000 below / 1 SM horizontal).'
  },
  {
    re: /class d|tower.*closed|part-time tower/,
    note: 'When a part-time Class D tower closes, the airspace typically reverts to Class E (or G) as charted — weather minimums and radio needs change with it.'
  },
  {
    re: /mode c|transponder|91\.215|ads-?b/,
    note: 'Gliders often get Mode C / electrical-system exceptions, but airspace still dictates when you need equipment or an ATC authorization. Read 91.215 / 91.225 carefully.'
  },
  {
    re: /\bweak link\b|\btowline\b|91\.309|\baerotow\b|\btow rope\b|\btowplane\b|soaring signal|unable to release|signal to stop/,
    note: '91.309 sets towline length and breaking-strength / weak-link rules. Aerotow signals (AIM / GFH) are a shared language — brief them before the first launch of the day.'
  },
  {
    re: /\bwinch\b|\bauto-?tow\b/,
    note: 'Winch launches punish over-rotation: ease back-pressure if the glider porpoises; a cable break on a steep climb needs an immediate nose-down to a landable attitude.'
  },
  {
    re: /\bcg\b|center of gravity|weight and balance|ballast/,
    note: 'Aft CG reduces pitch stability and can worsen stall/spin recovery; forward CG raises stall speed and makes the flare heavier. Stay inside the published envelope.'
  },
  {
    re: /stall|critical angle|spin|indicated airspeed at which/,
    note: 'Stall is AOA, not airspeed. Indicated stall speed stays roughly constant with altitude for a given configuration; true airspeed rises. A spin needs stall plus yaw.'
  },
  {
    re: /min(?:imum)? sink|best l\/d|l\/d|speed to fly|maccready|glide ratio|upward current|sink in 1|gain the most distance|figure 55|figure 53/,
    note: 'Min sink ≠ best L/D ≠ speed-to-fly. Using the wrong one wastes either altitude or distance, especially in sink or headwind. Read polar charts for the speed that matches the job.'
  },
  {
    re: /metar|taf|pirep|sigmet|airmet|winds aloft|weather briefing|ceiling is defined|atis/,
    note: 'Decode remarks and forecast change groups deliberately. Ceiling is AGL to the lowest broken/overcast layer (or vertical visibility into obscuration) — not the tops.'
  },
  {
    re: /virga|thunderstorm|front|stability|thermal|wave|ridge|density altitude|sea breeze|fog|nimbus|lenticular|air mass|moisture|dew|haze|convective|clouds are divided|formation of/,
    note: 'Lift and hazards travel together: convective cloud, fronts, fog types, and high DA all change performance and landout options. Cloud families are sorted by height range; fog needs moisture plus cooling or lifting.'
  },
  {
    re: /scan|collision|see and avoid|right-?of-?way|converging|overtaking|wake|vortex|vortes|midair|head-on|another aircraft is on a/,
    note: 'Right-of-way and see-and-avoid still apply when the radio is quiet: head-on both alter right, converging yield to the right, overtaking keep clear of the one ahead. Collision courses show little relative motion; wake is worst when the generator is heavy, clean, and slow.'
  },
  {
    re: /sectional|latitude|longitude|obstacle|mea|moa|restricted|prohibited|tfr|wildlife refuge|caution box|terrain elevation|lighted obstacle|arrowwood|national wildlife/,
    note: 'Chart symbology is dense: measure lat/long carefully, read altitude floors/ceilings of SUA, and respect refuge/overflight notes — they are operational, not decoration.'
  },
  {
    re: /holding position|runway.*marking|taxiway|segmented circle|wind (cone|sock)|airport sign|destination sign|inbound destination/,
    note: 'Red/white runway signs and painted holding bars are hard stops without clearance. Segmented-circle L-bars show pattern direction; the wind sock shows which runway to use.'
  },
  {
    re: /slip|forward slip|side slip|yaw string|inclinometer/,
    note: 'Slips trade altitude for track without adding much airspeed when spoilers are already out. Yaw string and ball both show coordination — know which way “into the string” means.'
  },
  {
    re: /oxygen|91\.211|hypoxia/,
    note: 'Supplemental oxygen rules are time-and-altitude based for required crew; passengers have a higher altitude trigger. Use oxygen before you “feel fine.”'
  },
  {
    re: /notam|chart supplement|af\/d|advisory circular/,
    note: 'Preflight data is layered: sectional for structure, Chart Supplement for local procedures/frequencies, NOTAMs for what changed today. Advisory circulars are guidance, numbered by subject series.'
  },
  {
    re: /angle of attack|angle of incidence|lift vector|load factor|bank|newton/,
    note: 'Angle of attack is chordline vs relative wind; incidence is built into the airframe. In a level turn, load factor rises with bank and stall speed scales with √n.'
  },
  {
    re: /federal airway|victor airway|airway from either side/,
    note: 'Federal airways are 8 NM wide total — 4 NM either side of centerline — unless otherwise designated. Treat them as Class E corridors when charted.'
  },
  {
    re: /final authority|pilot in command|condition for safe flight|maintained in an airworthy|primarily responsible for maintaining/,
    note: 'PIC decides go/no-go for that flight (91.3). Keeping the aircraft airworthy over time is primarily the owner/operator’s duty — different hats, different Part 91 paragraphs.'
  },
  {
    re: /altimeter|29\.92|pressure altitude|standard temperature and pressure|millibars|barometric|" hg|sea level/,
    note: 'Rough rule: 1 in Hg ≈ 1,000 ft. From high to low (setting or flying into lower pressure), look out below — the altimeter reads high if unset. Standard sea-level: 15 °C / 29.92 in Hg.'
  },
  {
    re: /parachute|91\.307/,
    note: 'Except for certain training/test cases, each occupant needs an approved parachute when intentional bank exceeds 60° or pitch exceeds 30° relative to the horizon.'
  },
  {
    re: /hazardous attitude|antidotal|get-?there-?itis|scud running|peer pressure|macho|impulsive|invulnerab|resignation|risk management|preventable accident|pushes his or her capabilities|fit to fly|short- and long-term memory/,
    note: 'ADM antidotes pair with hazardous attitudes (anti-authority, impulsivity, invulnerability, macho, resignation). Scud running and get-there-itis are classic pressure traps — most preventable accidents share a human-factors root.'
  },
  {
    re: /density altitude|increase the density|barometric pressure/,
    note: 'Density altitude rises when air is hot, high, or humid (less dense). Cooler, higher-pressure, drier air is denser and helps performance.'
  },
  {
    re: /rocky knoll|surrounded by vegetation/,
    note: 'Dark/rocky surfaces heat faster than vegetation; expect stronger thermals on the sun-facing rocky side once the surface has warmed.'
  },
  {
    re: /collision course|collision accidents occur/,
    note: 'Most midairs happen in day VFR near airports during climb/descent/pattern work. A structured scan beats a fixed stare, especially when traffic converges.'
  }
];

function stemText(card) {
  return `${card.question || ''} ${card.answer || ''}`.toLowerCase();
}

function buildSummary(card) {
  const text = stemText(card);
  const notes = [];
  for (const row of KEYWORD_NOTES) {
    if (row.re.test(text)) notes.push(row.note);
    if (notes.length >= 2) break;
  }
  const topicNote = TOPIC_CONTEXT[card.topic_id];
  // Only fall back to topic context when no keyword note matched.
  if (!notes.length && topicNote) notes.push(topicNote);
  if (!notes.length) {
    notes.push(
      'Use the linked references to deepen the “why,” not just memorize the letter. Private written items often turn on a nearby definition or a look-alike number.'
    );
  }
  return notes.slice(0, 2).join(' ');
}

function linksFor(card) {
  const topicLinks = TOPIC_LINKS[card.topic_id] || [LINKS.gfh, LINKS.phak];
  const q = stemText(card);
  const extra = [];
  if (/\bntsb\b|part 830|substantial damage/.test(q)) extra.push(LINKS.ntsb830);
  if (/\b61\.\d+|certificate|endorsement|solo|passenger|nighttime|definition of night/.test(q)) {
    extra.push(LINKS.part61);
  }
  if (
    /\b91\.\d+|vfr|oxygen|aerotow|weak link|airworthiness|transponder|alcohol|right-?of-?way|final authority|pilot in command|parachute|position lights/.test(
      q
    )
  ) {
    extra.push(LINKS.part91);
  }
  if (/\bclass [a-g]\b|airspace|tfr|sua\b|moa|restricted|federal airway|atis/.test(q)) {
    extra.push(LINKS.aim);
  }
  if (
    /\bstall|spin|lift|drag|cg\b|weight and balance|angle of attack|angle of incidence|load factor|altimeter|newton|hazardous|scud|antidotal/.test(
      q
    )
  ) {
    extra.push(LINKS.phak);
  }
  if (/\bthermal|ridge|wave|soaring|tow|spoiler|winch|min sink|l\/d|upward current/.test(q)) {
    extra.push(LINKS.gfh);
  }
  if (/\bweather|front|metar|taf|thunderstorm|stability|cloud|fog|haze|moisture|air mass/.test(q)) {
    extra.push(LINKS.weather);
  }
  if (/\bairport sign|holding position|taxiway|runway marking|segmented circle|destination sign/.test(q)) {
    extra.push(LINKS.signs);
  }
  if (/\bsectional|latitude|longitude|chart excerpt|wildlife refuge|caution box|lighted obstacle/.test(q)) {
    extra.push(LINKS.sectional);
  }
  if (/\bcategory of aircraft|class of aircraft|nighttime|v-?speed|v\([a-z]+\)|standard temperature/.test(q)) {
    extra.push(LINKS.part1);
  }
  if (/\bscan|collision|midair|wake|vortex|see and avoid/.test(q)) extra.push(LINKS.ac9048);
  if (/\bmaintained in an airworthy|preventive maintenance|annual inspection|100-?hour/.test(q)) {
    extra.push(LINKS.part43);
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

function main() {
  const detailsDoc = loadJson(detailsPath);
  const existingAll = Array.isArray(detailsDoc.details) ? [...detailsDoc.details] : [];
  // Regenerate private written details; keep every other track untouched.
  const existing = existingAll.filter((d) => !String(d.card_id || '').startsWith('private_written_'));
  const have = new Set(existing.map((d) => String(d.card_id || '').trim()).filter(Boolean));

  const privateImport = loadJson(privateImportPath);
  const importCards = Array.isArray(privateImport.cards) ? privateImport.cards : [];

  const generated = [];
  for (const card of importCards) {
    if (!card?.id || have.has(card.id)) continue;
    if (!String(card.id).startsWith('private_written_')) continue;
    generated.push({
      card_id: card.id,
      summary: buildSummary(card),
      links: linksFor(card)
    });
    have.add(card.id);
  }

  const merged = [...existing, ...generated];
  merged.sort((a, b) => String(a.card_id).localeCompare(String(b.card_id)));
  fs.writeFileSync(detailsPath, `${JSON.stringify({ details: merged }, null, 2)}\n`, 'utf8');

  const privateCount = merged.filter((d) => String(d.card_id || '').startsWith('private_')).length;
  console.log(
    JSON.stringify(
      {
        kept_non_private_written: existing.length,
        generated: generated.length,
        total: merged.length,
        private_details: privateCount,
        import_cards: importCards.length
      },
      null,
      2
    )
  );
}

main();
