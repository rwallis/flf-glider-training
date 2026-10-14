/**
 * Upsert Details for remaining CFI-G topics:
 * stalls (17), emergency (2), weather (58), systems (9).
 * Run: node scripts/add-remaining-details.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const detailsPath = path.join(root, 'content', 'card-details.json');

const PHAK = {
  label: 'Pilot’s Handbook of Aeronautical Knowledge (PHAK)',
  url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
};
const GFH = {
  label: 'Glider Flying Handbook',
  url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/glider_handbook',
};
const AFH = {
  label: 'Airplane Flying Handbook — Stalls / Spins',
  url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook',
};
const AIM = {
  label: 'AIM — Weather / Meteorology',
  url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
};
const AWH = {
  label: 'Aviation Weather Handbook',
  url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation',
};
const FOI = {
  label: 'Aviation Instructor’s Handbook (FOI)',
  url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook',
};

const L = (...links) => links;

const NEW = [
  // ── Stalls / spins / approach speed ─────────────────────────────────────
  {
    card_id: 'cfi_g_bank_007',
    summary:
      'Spin entry after a full stall: the down-going wing stays stalled while the rising wing unstalls and produces some lift — that lift asymmetry drives autorotation. Teach stall + yaw → spin; recovery starts with reducing AOA and stopping yaw.',
    links: L(
      { label: 'Airplane Flying Handbook — Spins', url: AFH.url },
      { label: 'PHAK — Stalls / Spins', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_032',
    summary:
      'A stall occurs when the wing exceeds its critical angle of attack — regardless of airspeed, attitude, or power. Any flight attitude can stall if AOA is high enough; “slow = stall” is incomplete teaching.',
    links: L(
      { label: 'PHAK — Stalls', url: PHAK.url },
      { label: 'Glider Flying Handbook — Stalls', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_047',
    summary:
      'High aspect-ratio wings (long, narrow) typically stall at a lower airspeed than low aspect-ratio wings of similar area — more efficient lift at a given AOA, lower stall speed. Gliders exploit this; expect different handling vs short-wing trainers.',
    links: L(
      { label: 'PHAK — Aspect Ratio / Wing Design', url: PHAK.url },
      { label: 'Glider Flying Handbook', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_063',
    summary:
      'Spoilers’ primary purpose on gliders is to decrease lift (and increase drag) so you can steepen the approach without a large airspeed increase. Teach approach control with spoilers, not “dive flaps.”',
    links: L(
      { label: 'Glider Flying Handbook — Spoilers', url: GFH.url },
      { label: 'PHAK — High-Lift / Drag Devices', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_064',
    summary:
      'A spin has at least one wing stalled (autorotation). A steep spiral does not — both wings are flying, airspeed and G rise, and the spiral can exceed VNE/load limits. Differentiating spin vs spiral is a core CFI teaching point.',
    links: L(
      { label: 'Airplane Flying Handbook — Spins vs Spirals', url: AFH.url },
      { label: 'PHAK — Spins', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_130',
    summary:
      'CG aft of the aft limit: pitch stability is reduced and stall/spin recovery can become difficult or impossible. Never fly outside the weight-and-balance envelope — especially aft.',
    links: L(
      { label: 'PHAK — Weight and Balance / Stability', url: PHAK.url },
      { label: 'Glider Flying Handbook — Loading', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_132',
    summary:
      'CG at the aft limit (vs forward): lowest stalling speed, highest cruise performance, and least stability. Forward CG is more stable but stalls sooner and needs more elevator for flare.',
    links: L(
      { label: 'PHAK — CG Effects on Performance', url: PHAK.url },
      { label: 'Glider Flying Handbook', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_138',
    summary:
      'As CG moves rearward, stall recovery becomes progressively more difficult — less nose-down pitching moment available and less static stability. Emphasize this when teaching loading and spin awareness.',
    links: L(
      { label: 'PHAK — CG and Stability', url: PHAK.url },
      { label: 'Airplane Flying Handbook — Stall Recovery', url: AFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_139',
    summary:
      'CG too far aft can allow a flat spin — high rotation rate, nose-high attitude, and recovery that may be delayed or impossible. Aft loading is a spin-risk multiplier.',
    links: L(
      { label: 'Airplane Flying Handbook — Spins', url: AFH.url },
      { label: 'PHAK — Weight and Balance', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_397',
    summary:
      'A CFI applicant must demonstrate spins (airplane or glider, as appropriate) when being retested for deficiencies in instructional proficiency on stall awareness or spins from the initial test — not as a routine extra on every retest for unrelated items.',
    links: L(
      {
        label: '14 CFR Part 61 — Flight Instructor Practical Tests',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61',
      },
      {
        label: 'FAA Flight Instructor PTS / ACS (Glider)',
        url: 'https://www.faa.gov/training_testing/testing/acs',
      },
    ),
  },
  {
    card_id: 'cfi_g_bank_538',
    summary:
      'Accelerated stall in a steep turn: in a slip the high wing stalls first; in a skid the low wing stalls first; in coordinated flight both wings stall together. Teach coordination as spin-prevention, not just “pretty ball.”',
    links: L(
      { label: 'Airplane Flying Handbook — Accelerated Stalls', url: AFH.url },
      { label: 'PHAK — Stalls in Turns', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_546',
    summary:
      'Towplane choice for aerotow: match (among other factors) stall speeds so the towplane does not force the glider into a high-AOA / stall-risk regime on climb or in turbulence. Towplane too slow or too fast both create teaching problems.',
    links: L(
      { label: 'Glider Flying Handbook — Aerotow', url: GFH.url },
      { label: 'PHAK — Performance', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_557',
    summary:
      'Steep wind gradient on base/final into the wind: if you do not keep adequate airspeed, expect undershoot of the aim point or a stall as wind decreases near the surface. Add margin and plan a higher approach speed in gradient/shear.',
    links: L(
      { label: 'Glider Flying Handbook — Approach / Wind Gradient', url: GFH.url },
      { label: 'PHAK — Wind Shear / Gradient', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_558',
    summary:
      'Rule of thumb for final: about 50% above the glider’s stall speed plus half the estimated windspeed. Example: Vs 40, wind 20 → ~40×1.5 + 10 = 70. Adjust for ship, density altitude, and turbulence — POH wins.',
    links: L(
      { label: 'Glider Flying Handbook — Approach Speeds', url: GFH.url },
      { label: 'PHAK — Performance / Wind', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_564',
    summary:
      'Safe off-field landing odds improve when you hold an approach speed of at least ~50% above stall plus half the estimated wind — same rule of thumb as a normal final, with extra respect for unknown surface and gradient.',
    links: L(
      { label: 'Glider Flying Handbook — Off-Field Landing', url: GFH.url },
      { label: 'PHAK — Emergency Procedures', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_605',
    summary:
      'Hazardous attitude — anti-authority: “The aircraft can handle a lot more than maneuvering speed.” Va (or design maneuvering speed) is a structural/control limit in turbulence and abrupt inputs; instructors must model respect for it, not dismiss it.',
    links: L(
      { label: 'Aviation Instructor’s Handbook — Hazardous Attitudes', url: FOI.url },
      { label: 'PHAK — Maneuvering Speed', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_698',
    summary:
      'In a developed spin, load factor is typically low — about 0.5 to 1.5 G — not a high-G spiral. That is why “it doesn’t feel violent” can lull pilots; airspeed and turn rate still matter for recovery and structural limits after recovery.',
    links: L(
      { label: 'Airplane Flying Handbook — Spins', url: AFH.url },
      { label: 'PHAK — Load Factor', url: PHAK.url },
    ),
  },

  // ── Emergency / PIC authority ───────────────────────────────────────────
  {
    card_id: 'cfi_g_bank_442',
    summary:
      'In an in-flight emergency requiring immediate action, the PIC may deviate from any rule in 14 CFR to the extent required to meet that emergency (§ 91.3). Teach: declare when able, fly the ship first, then sort paperwork.',
    links: L(
      {
        label: '14 CFR § 91.3 — Responsibility and authority of the PIC',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-A/section-91.3',
      },
      { label: 'AIM — Emergency Procedures', url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/' },
    ),
  },
  {
    card_id: 'cfi_g_bank_461',
    summary:
      'If you deviate from an ATC instruction in an emergency and are given priority, submit a detailed report within 48 hours if the ATC facility manager requests it (§ 91.123). Know the 48-hour clock separately from NTSB accident reporting.',
    links: L(
      {
        label: '14 CFR § 91.123 — Compliance with ATC clearances and instructions',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-B/section-91.123',
      },
      {
        label: '14 CFR § 91.3 — PIC emergency authority',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-A/section-91.3',
      },
    ),
  },

  // ── Systems / oxygen / instruments ──────────────────────────────────────
  {
    card_id: 'cfi_g_bank_079',
    summary:
      'A clogged pitot tube affects the airspeed indicator (impact pressure). Static-only instruments (altimeter, VSI) are unaffected unless the static system is also blocked. Teach partial-panel implications for gliders with limited backup.',
    links: L(
      { label: 'PHAK — Pitot-Static System', url: PHAK.url },
      { label: 'Glider Flying Handbook — Instruments', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_082',
    summary:
      'Never replenish an aircraft oxygen system with industrial oxygen — contaminants and moisture can be hazardous. Use only aviators’ breathing oxygen. (Bank answer text is truncated/OCR-noisy; the teaching point is aviation-grade O₂ only.)',
    links: L(
      { label: 'PHAK — Oxygen Systems', url: PHAK.url },
      { label: 'AIM — Oxygen Use', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_084',
    summary:
      'Replenish aircraft oxygen systems with aviation (aviators’ breathing) oxygen only — not medical or industrial grades sold for other uses.',
    links: L(
      { label: 'PHAK — Oxygen Equipment', url: PHAK.url },
      { label: 'Glider Flying Handbook — High Altitude', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_087',
    summary:
      'A total-energy compensator reduces climb/dive (stick-thermal) errors on the variometer caused by airspeed changes — so the vario better reflects air-mass vertical motion rather than zoom climbs and pushovers.',
    links: L(
      { label: 'Glider Flying Handbook — Variometers / TE', url: GFH.url },
      { label: 'PHAK — Instruments', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_089',
    summary:
      'In a continuous-flow oxygen mask, the rebreather bag stores exhaled oxygen-rich gas so you can re-inhale part of it — helping conserve the oxygen supply.',
    links: L(
      { label: 'PHAK — Continuous-Flow Oxygen', url: PHAK.url },
      { label: 'AIM — Supplemental Oxygen', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_574',
    summary:
      'As you climb, the percentage of oxygen in the atmosphere stays about 21% — partial pressure falls with total pressure. Hypoxia risk rises because fewer O₂ molecules are available per breath, not because the mix changes.',
    links: L(
      { label: 'PHAK — Atmosphere / Hypoxia', url: PHAK.url },
      { label: 'AIM — Aeromedical', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_588',
    summary:
      'Although not always required by regulation at that altitude, supplemental oxygen is recommended for night flight above about 5,000 feet — night vision is especially hypoxia-sensitive.',
    links: L(
      { label: 'PHAK — Night Flying / Oxygen', url: PHAK.url },
      {
        label: '14 CFR § 91.211 — Supplemental oxygen',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-C/section-91.211',
      },
    ),
  },
  {
    card_id: 'cfi_g_bank_661',
    summary:
      'The pitot system supplies impact (ram) pressure to the airspeed indicator. Altimeter and VSI use static pressure only.',
    links: L(
      { label: 'PHAK — Pitot-Static Instruments', url: PHAK.url },
      { label: 'Glider Flying Handbook', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_674',
    summary:
      'Bank is mis-topic’d under systems (certificate renewal). Passing a flight instructor practical test in one category/class (e.g., single-engine airplane) renews the instructor certificate with its ratings for the renewal period — you do not need a separate ride in every rating to renew the whole certificate. Confirm current Part 61 renewal paths (FIRC vs practical test).',
    links: L(
      {
        label: '14 CFR § 61.197 — Renewal requirements for flight instructor certification',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61/subpart-H/section-61.197',
      },
      { label: 'Aviation Instructor’s Handbook', url: FOI.url },
    ),
  },

  // ── Weather (and a few misfiled aero / regs cards) ──────────────────────
  {
    card_id: 'cfi_g_bank_016',
    summary:
      'Bank misfiled under weather (aerodynamics). At zero geometric AOA the upper surface can still have pressure below atmospheric because of camber/flow acceleration — lift is about pressure difference, not “nose-up attitude.”',
    links: L(
      { label: 'PHAK — Aerodynamics of Lift', url: PHAK.url },
      { label: 'Glider Flying Handbook — Aerodynamics', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_029',
    summary:
      'Bank misfiled under weather (aerodynamics). Flying in ground effect just clear of the surface can be sustained at a slightly lower airspeed than out of ground effect because the ground interferes with wingtip vortices / downwash, reducing induced drag.',
    links: L(
      { label: 'PHAK — Ground Effect', url: PHAK.url },
      { label: 'Glider Flying Handbook — Landing', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_141',
    summary:
      'Bank answer looks wrong: most weather occurs in the troposphere, not the tropopause. The tropopause is the lid; the weather layer is the troposphere beneath it. Study the troposphere for fronts, clouds, and turbulence.',
    links: L(
      { label: 'PHAK — Atmosphere', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_143',
    summary:
      'Standard average lapse rate in the troposphere used on many FAA questions: about 2 °C per 1,000 feet (≈ 3.5 °F/1,000 ft). Actual lapse rate varies and determines stability.',
    links: L(
      { label: 'PHAK — Lapse Rate', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_144',
    summary:
      'The most common ground-/surface-based temperature inversion is from terrestrial radiation on a clear, relatively calm night — ground cools, air near the surface becomes colder than air above.',
    links: L(
      { label: 'PHAK — Temperature Inversions', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_145',
    summary:
      'Beneath a low-level inversion with high relative humidity, expect smooth air and poor visibility from fog, haze, or low clouds — pollutants and moisture are trapped under the lid.',
    links: L(
      { label: 'PHAK — Inversions / Visibility', url: PHAK.url },
      { label: 'AIM — Weather', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_153',
    summary:
      'Standard sea-level values: 59 °F (15 °C) and 1013.2 mb (29.92 inHg). These are the ISA baseline for performance and altimetry teaching.',
    links: L(
      { label: 'PHAK — Standard Atmosphere', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_154',
    summary:
      'Wind is caused by pressure differences — air moves from high toward low pressure, then is turned by Coriolis and modified by friction near the surface.',
    links: L(
      { label: 'PHAK — Wind / Pressure Gradient', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_155',
    summary:
      'Flow around a low is cyclonic (counterclockwise in the Northern Hemisphere). Highs are anticyclonic (clockwise NH).',
    links: L(
      { label: 'PHAK — Highs and Lows', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_160',
    summary:
      'A low-pressure area or trough is associated with rising air (and often clouds/precipitation). Highs/ridges favor sinking air and clearer conditions.',
    links: L(
      { label: 'PHAK — Pressure Systems', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_161',
    summary:
      'As relative humidity increases, the temperature–dewpoint spread decreases. Small spread → closer to saturation → higher fog/cloud potential.',
    links: L(
      { label: 'PHAK — Moisture / Dewpoint', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_162',
    summary:
      'Relative humidity is the ratio of water vapor actually in the air to the maximum that could exist at that temperature (saturation).',
    links: L(
      { label: 'PHAK — Humidity', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_166',
    summary:
      'Virga: precipitation that falls from a cloud but evaporates before reaching the ground. Often a dry-air / evaporative-cooling cue under the base.',
    links: L(
      { label: 'PHAK — Precipitation', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_167',
    summary:
      'Atmospheric stability is determined from the ambient (environmental) lapse rate compared with dry/moist adiabatic rates — steep lapse → unstable; shallow/inverted → stable.',
    links: L(
      { label: 'PHAK — Stability', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_168',
    summary:
      'Whether lifted moist air forms mostly stratiform or cumuliform clouds depends on the stability of the air being lifted — stable → layer/stratus; unstable → cumulus/showers.',
    links: L(
      { label: 'PHAK — Clouds and Stability', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_169',
    summary:
      'Cumuliform cloud-base estimate (°F): (temperature − dewpoint) ÷ 4.4 × 1,000 ≈ feet AGL. Here (77 − 53) / 4.4 ≈ 5,500 feet AGL.',
    links: L(
      { label: 'PHAK — Cloud Base Estimate', url: PHAK.url },
      { label: 'Glider Flying Handbook — Soaring Weather', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_170',
    summary:
      'Cumuliform cloud-base estimate (°C): (temperature − dewpoint) × 400 ≈ feet AGL. Here (33 − 15) × 400 = 7,200 feet AGL.',
    links: L(
      { label: 'PHAK — Cloud Base Estimate', url: PHAK.url },
      { label: 'Glider Flying Handbook — Soaring Weather', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_171',
    summary:
      'Very stable moist air forced up a mountain slope tends to form stratus-type clouds with little vertical development and little or no turbulence — orographic layer cloud, not towering cumulus.',
    links: L(
      { label: 'PHAK — Orographic Lift / Stability', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_172',
    summary:
      'Middle-cloud bases in middle latitudes are commonly about 6,500 to 23,000 feet. Know low / middle / high families for icing and weather briefing vocabulary.',
    links: L(
      { label: 'PHAK — Cloud Classification', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_173',
    summary:
      'Nimbostratus: middle-level (often thickening) rain/snow/ice-pellet producer that can pose a serious icing hazard when temperatures are near or below freezing — continuous precip, not showery CB.',
    links: L(
      { label: 'PHAK — Cloud Types / Icing', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_175',
    summary:
      'Unstable air is normally associated with good visibility (except in blowing sand or snow), cumuliform clouds, and turbulence — contrast with stable air’s haze and stratiform layers.',
    links: L(
      { label: 'PHAK — Stable vs Unstable Air', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_176',
    summary:
      'A moist, unstable air mass: cumuliform clouds and showery precipitation (plus turbulence and good visibility outside showers).',
    links: L(
      { label: 'PHAK — Air Mass Weather', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_177',
    summary:
      'Advancing warm front with moist, unstable air: cumuliform clouds, turbulent air, and showery precipitation — not the classic stable warm-front stratus/drizzle pattern.',
    links: L(
      { label: 'PHAK — Fronts', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_178',
    summary:
      'Bank answer looks swapped. Moist cold air being warmed from below becomes unstable (cumulus, turbulence, good visibility outside precip) — “restricted visibility” is the usual stable-air cue. Know the contrast for the checkride even if the key is noisy.',
    links: L(
      { label: 'PHAK — Stability Modification', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_179',
    summary:
      'Stable air characteristically brings restricted visibility (haze, fog, smoke trapped in a layer) plus stratiform clouds and smooth air.',
    links: L(
      { label: 'PHAK — Characteristics of Stable Air', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_180',
    summary:
      'Bank Q/A garbled (OCR mix of humidity-spread wording with a thunderstorm answer). Strong updrafts and cumulonimbus are signatures of deep moist instability — not of an increasing temperature–dewpoint spread with rising RH (that statement is false).',
    links: L(
      { label: 'PHAK — Thunderstorms / Stability', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_181',
    summary:
      'Typical stable air-mass weather includes continuous (steady) precipitation from layered clouds — contrast with showery precip in unstable air.',
    links: L(
      { label: 'PHAK — Stable Air Masses', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_182',
    summary:
      'Moist warm air being cooled from below becomes more stable — expect smooth air (and often stratiform cloud/fog potential), not towering cumulus.',
    links: L(
      { label: 'PHAK — Stability', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_183',
    summary:
      'Frontal waves normally form on slow-moving cold fronts or stationary fronts — the wave can amplify into a mature cyclone with warm and cold fronts.',
    links: L(
      { label: 'PHAK — Frontal Waves / Cyclogenesis', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_184',
    summary:
      'Cool air moving over a warm surface is heated from below → instability and showers (and often good visibility between showers).',
    links: L(
      { label: 'PHAK — Air Mass Modification', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_185',
    summary:
      'Wave on a stationary front oriented east–west across the U.S.: portion east of the wave normally becomes a warm front; portion west becomes a cold front — classic open-wave cyclone geometry.',
    links: L(
      { label: 'PHAK — Mid-Latitude Cyclones', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_188',
    summary:
      'Bank stem truncated. Over hills/ridges, expect the worst downdrafts/turbulence on the leeward (downwind) side — especially when flying into the wind toward the ridge lee. Stay upwind or high enough to clear rotor/sink.',
    links: L(
      { label: 'Glider Flying Handbook — Ridge / Mountain Flying', url: GFH.url },
      { label: 'PHAK — Mountain Flying', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_189',
    summary:
      'Low-level wind shear with a sudden direction change can occur with a low-level temperature inversion and strong winds above the inversion — classic morning shear under a nocturnal inversion.',
    links: L(
      { label: 'PHAK — Wind Shear', url: PHAK.url },
      { label: 'AIM — Wind Shear / LLWS', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_190',
    summary:
      'Bank stem truncated (strong wind above an inversion). Expect wind shear and possible sudden airspeed loss when climbing or descending through the inversion top — brief hard, add approach margin.',
    links: L(
      { label: 'PHAK — Inversion Wind Shear', url: PHAK.url },
      { label: 'Glider Flying Handbook — Wind Gradient', url: GFH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_195',
    summary:
      'Thunderstorm life cycle: beginning of rain at the surface marks transition into the mature stage (updraft + downdraft). Cumulus = updrafts; dissipating = mostly downdrafts.',
    links: L(
      { label: 'PHAK — Thunderstorm Life Cycle', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_196',
    summary:
      'Tornadoes are most likely with steady-state thunderstorms associated with cold fronts or squall lines — not ordinary air-mass “pulse” storms.',
    links: L(
      { label: 'PHAK — Severe Thunderstorms / Tornadoes', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_197',
    summary:
      'Cumulus stage of a thunderstorm: continuous updrafts (little or no precipitation at the surface yet). Bank stem has OCR bleed from mountain-wave text — answer is still continuous updrafts.',
    links: L(
      { label: 'PHAK — Thunderstorm Stages', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_198',
    summary:
      'Bank stem OCR-mashed (mountain-wave statements mixed with CB/funnel wording). Correct pick for the mountain-wave true statements is typically 2 and 3: waves develop in a series on the lee side; humid large-amplitude waves show lenticulars at the crests. Use the Figure / handbook diagram, not the scrambled stem alone.',
    links: L(
      { label: 'Glider Flying Handbook — Mountain Wave', url: GFH.url },
      { label: 'PHAK — Mountain Wave', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_199',
    summary:
      'A squall line is usually associated with a fast-moving cold front — a narrow band of intense thunderstorms ahead of or with the front.',
    links: L(
      { label: 'PHAK — Squall Lines', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_200',
    summary:
      'Hail hazard true statements (bank): large hail with strong updrafts + high liquid water; hail usually in the mature stage; hailstones can be thrown outward for several miles. Visual appearance alone is a poor hail predictor; hail can exist outside the cloud core downwind of the anvil.',
    links: L(
      { label: 'PHAK — Hail', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_201',
    summary:
      'Hailstones may be thrown outward from a storm cloud for several miles — clear air beside a CB is not automatically hail-safe, especially under/near the anvil.',
    links: L(
      { label: 'PHAK — Thunderstorm Hazards', url: PHAK.url },
      { label: 'AIM — Thunderstorm Flying', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_202',
    summary:
      'Hail as an in-flight hazard is most likely associated with cumulonimbus clouds — avoid by wide margins; do not plan to “skirt” under the anvil.',
    links: L(
      { label: 'PHAK — Cumulonimbus / Hail', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_203',
    summary:
      'Hail is most likely to be encountered beneath the anvil of a large cumulonimbus — ice is lofted in the updraft and falls out downwind under the anvil.',
    links: L(
      { label: 'PHAK — Hail Distribution', url: PHAK.url },
      { label: 'AIM — Thunderstorms', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_204',
    summary:
      'Fog needs high relative humidity (near saturation) plus a cooling or moistening process. Without moisture near saturation, fog does not form.',
    links: L(
      { label: 'PHAK — Fog', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_205',
    summary:
      'Radiation fog: high humidity in early evening, cool clear night, light wind, and favorable topography (valleys/drainage). Calm traps the cold layer; too much wind mixes it out.',
    links: L(
      { label: 'PHAK — Radiation Fog', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_206',
    summary:
      'Advection fog forms when moist air moves over a colder surface — common along coasts and with warm air over cool water/ground.',
    links: L(
      { label: 'PHAK — Advection Fog', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_207',
    summary:
      'Advection fog can appear suddenly day or night and is typically more persistent than radiation fog — wind that would clear radiation fog often sustains advection fog.',
    links: L(
      { label: 'PHAK — Fog Types', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_208',
    summary:
      'Warm fronts commonly bring precipitation-induced fog — rain evaporates into cool stable air ahead of the front, saturating the layer.',
    links: L(
      { label: 'PHAK — Precipitation-Induced Fog', url: PHAK.url },
      { label: 'Aviation Weather Handbook', url: AWH.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_212',
    summary:
      'Mountain-wave formation favors a stable layer near mountaintop height and a wind of at least about 15–25 knots blowing roughly perpendicular across the ridge — plus increasing wind with height in many setups.',
    links: L(
      { label: 'Glider Flying Handbook — Mountain Wave', url: GFH.url },
      { label: 'PHAK — Mountain Wave', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_215',
    summary:
      'One of the most dangerous mountain-wave features is severe turbulence in and below lenticular clouds (rotor zone). Lenticulars mark the wave; the rotor under them can destroy aircraft.',
    links: L(
      { label: 'Glider Flying Handbook — Rotor / Lenticulars', url: GFH.url },
      { label: 'PHAK — Mountain Wave Hazards', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_229',
    summary:
      'METAR true set per bank: FG only with visibility < 5/8 SM; BR from 5/8 up to 6 SM; no provision for partial obscurations in that older keying. (Modern decoding still: know FG vs BR thresholds; VV is treated as ceiling in current practice — bank item 1 may be outdated.)',
    links: L(
      { label: 'AIM — METAR/SPECI', url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/' },
      {
        label: 'FAA Aviation Weather Services (AC 00-45)',
        url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation',
      },
    ),
  },
  {
    card_id: 'cfi_g_bank_231',
    summary:
      '(Figure 3) Read KAUS temperature and dewpoint from the METAR/surface report in the figure; the spread is temperature − dewpoint = 4 °C. Use the Figure pill for the actual print.',
    links: L(
      { label: 'AIM — METAR', url: AIM.url },
      { label: 'PHAK — Temperature / Dewpoint', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_307',
    summary:
      'Bank misfiled under weather (VFR cloud clearance). In controlled airspace more than 1,200 feet AGL and below 10,000 feet MSL, VFR minimum horizontal distance from clouds is 2,000 feet (also 500 below / 1,000 above).',
    links: L(
      {
        label: '14 CFR § 91.155 — Basic VFR weather minimums',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-B/section-91.155',
      },
      { label: 'AIM — VFR Cloud Clearance', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_308',
    summary:
      'Class G, more than 1,200 feet AGL and at or above 10,000 feet MSL: remain 1,000 feet below, 1,000 feet above, and 1 mile horizontal from clouds (plus 5 SM visibility).',
    links: L(
      {
        label: '14 CFR § 91.155 — Basic VFR weather minimums',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-B/section-91.155',
      },
      { label: 'AIM 3-1-4 — VFR Weather Minimums', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_447',
    summary:
      'Required preflight action for every flight (§ 91.103): become familiar with all available information, including runway lengths at airports of intended use (and takeoff/landing distance data). Weather briefing is part of “all available information,” but this item’s keyed answer is runway lengths.',
    links: L(
      {
        label: '14 CFR § 91.103 — Preflight action',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-B/section-91.103',
      },
      { label: 'PHAK — Preflight', url: PHAK.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_569',
    summary:
      'Upsloping terrain creates the illusion that the aircraft is higher than it actually is — pilots tend to fly too low on approach. Downsloping terrain does the opposite.',
    links: L(
      { label: 'PHAK — Optical Illusions / Approach', url: PHAK.url },
      { label: 'AIM — Illusions', url: AIM.url },
    ),
  },
  {
    card_id: 'cfi_g_bank_577',
    summary:
      'Above about 15,000 feet without supplemental oxygen in an unpressurized aircraft, expect hypoxic signs such as cyanosis (blue lips/fingernails) and tunnel vision — plus impaired judgment. Use oxygen early; do not wait for symptoms.',
    links: L(
      { label: 'PHAK — Hypoxia', url: PHAK.url },
      {
        label: '14 CFR § 91.211 — Supplemental oxygen',
        url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-C/section-91.211',
      },
    ),
  },
  {
    card_id: 'cfi_g_bank_686',
    summary:
      '(Figure 8) On a Surface Analysis chart, symbol “12” denotes a squall line. Use the Figure pill; match the legend for fronts, troughs, and squall-line symbology.',
    links: L(
      { label: 'Aviation Weather Services — Surface Analysis', url: AWH.url },
      { label: 'PHAK — Weather Charts', url: PHAK.url },
    ),
  },
];

const data = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
const byId = new Map(data.details.map((d) => [d.card_id, d]));
let added = 0;
let updated = 0;
for (const row of NEW) {
  if (byId.has(row.card_id)) {
    Object.assign(byId.get(row.card_id), row);
    updated++;
  } else {
    data.details.push(row);
    byId.set(row.card_id, row);
    added++;
  }
}
fs.writeFileSync(detailsPath, JSON.stringify(data, null, 2) + '\n');

const remaining = JSON.parse(fs.readFileSync(path.join(root, 'content', '_remaining-cards.json'), 'utf8'));
const have = new Set(data.details.map((d) => d.card_id));
const still = remaining.filter((c) => !have.has(c.id));
const byTopic = {};
for (const c of remaining) {
  byTopic[c.topic] = (byTopic[c.topic] || 0) + (have.has(c.id) ? 1 : 0);
}
console.log(JSON.stringify({ added, updated, newTotal: data.details.length, stillMissing: still.length, coveredByTopic: byTopic }, null, 2));
if (still.length) {
  console.log('Missing ids:', still.map((c) => c.id).join(', '));
  process.exitCode = 1;
}
