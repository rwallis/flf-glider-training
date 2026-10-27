#!/usr/bin/env python3
"""OCR + parse GPGS Private Pilot Glider question bank (IMG_0003.pdf).

Pages are upright portrait (no rotate). Two-column MC with A/B/C.
Answer key on pages 27-28 (X = inactive / removed from exams).

Re-run OCR:  python parse_private_ocr.py
Parse only:   python parse_private_ocr.py --parse-only
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

from PIL import Image

PAGES_DIR = Path(r"C:\Users\ronwa\OneDrive\Documents\2026_10_27\_private_ocr_pages")
COLS_DIR = Path(r"C:\Users\ronwa\OneDrive\Documents\2026_10_27\_private_ocr_text\cols")
ANSWER_KEY_PATH = Path(
    r"C:\Users\ronwa\OneDrive\Documents\2026_10_27\_private_ocr_text\answer_key.json"
)
OUT_DIR = Path(
    r"C:\Users\ronwa\Documents\Codex\2026-05-15\flf-glider-training\content\private-import"
)
OVERRIDES_JSON = OUT_DIR / "manual_overrides.json"
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")

EXPECTED_TOTAL = 473  # including inactive X items
QUESTION_PAGES = range(1, 27)  # pages 27-28 are answer keys

TOPICS = [
    {
        "id": "priv_certs",
        "title": "Certificates & privileges",
        "description": "Private privileges, currency, medical, student/private rules.",
        "pts_ref": "14 CFR 61 / Private PTS",
        "sort_order": 10,
        "track_id": "private",
    },
    {
        "id": "priv_airworthy",
        "title": "Airworthiness",
        "description": "Inspections, ADs, maintenance records, INOP gear.",
        "pts_ref": "Private PTS I.B",
        "sort_order": 20,
        "track_id": "private",
    },
    {
        "id": "priv_aeromedical",
        "title": "Aeromedical & human factors",
        "description": "Hypoxia, ADM, hazardous attitudes, fitness to fly.",
        "pts_ref": "AIM / PHAK",
        "sort_order": 30,
        "track_id": "private",
    },
    {
        "id": "priv_scan",
        "title": "Scanning & collision avoidance",
        "description": "See-and-avoid, wake turbulence, clearing procedures.",
        "pts_ref": "AC 90-48",
        "sort_order": 40,
        "track_id": "private",
    },
    {
        "id": "priv_aero",
        "title": "Principles of flight",
        "description": "Lift, drag, stability, airfoils, forces in flight.",
        "pts_ref": "GFH / PHAK",
        "sort_order": 50,
        "track_id": "private",
    },
    {
        "id": "priv_controls",
        "title": "Flight controls & devices",
        "description": "Ailerons, rudder, trim, spoilers, dive brakes, adverse yaw.",
        "pts_ref": "GFH",
        "sort_order": 60,
        "track_id": "private",
    },
    {
        "id": "priv_wb",
        "title": "Weight & balance",
        "description": "CG, ballast, loading, envelopes.",
        "pts_ref": "PTS / POH",
        "sort_order": 70,
        "track_id": "private",
    },
    {
        "id": "priv_nav",
        "title": "Navigation & flight planning",
        "description": "Charts, pilotage, dead reckoning, XC planning.",
        "pts_ref": "Private PTS",
        "sort_order": 80,
        "track_id": "private",
    },
    {
        "id": "priv_regs",
        "title": "Regulations & publications",
        "description": "14 CFR, NTSB, AIM, Chart Supplement, NOTAMs.",
        "pts_ref": "14 CFR / NTSB 830",
        "sort_order": 90,
        "track_id": "private",
    },
    {
        "id": "priv_airspace",
        "title": "National Airspace System",
        "description": "Airspace classes, TFRs, SUA, communications.",
        "pts_ref": "AIM / 91.155",
        "sort_order": 100,
        "track_id": "private",
    },
    {
        "id": "priv_preflight",
        "title": "Preflight preparation",
        "description": "Documents, weather briefing, assembly, ground handling.",
        "pts_ref": "Private PTS I–II",
        "sort_order": 110,
        "track_id": "private",
    },
    {
        "id": "priv_airport",
        "title": "Airport & gliderport operations",
        "description": "Patterns, signs, markings, lighting, taxi.",
        "pts_ref": "Private PTS III",
        "sort_order": 120,
        "track_id": "private",
    },
    {
        "id": "priv_tow",
        "title": "Aerotow & abnormals",
        "description": "Positions, boxing, rope break, release failures, winch/auto.",
        "pts_ref": "Private PTS IV",
        "sort_order": 130,
        "track_id": "private",
    },
    {
        "id": "priv_landings",
        "title": "Landings & pattern",
        "description": "Approach, slips, touchdown, downwind landings.",
        "pts_ref": "Private PTS",
        "sort_order": 140,
        "track_id": "private",
    },
    {
        "id": "priv_perf",
        "title": "Performance airspeeds",
        "description": "Min sink, best L/D, speed-to-fly, density altitude, V-speeds.",
        "pts_ref": "Private PTS / POH",
        "sort_order": 150,
        "track_id": "private",
    },
    {
        "id": "priv_soaring",
        "title": "Soaring techniques",
        "description": "Thermals, ridge, wave, lift sources.",
        "pts_ref": "Private PTS",
        "sort_order": 160,
        "track_id": "private",
    },
    {
        "id": "priv_maneuvers",
        "title": "Performance maneuvers",
        "description": "Straight glides, turns to headings, steep turns.",
        "pts_ref": "Private PTS",
        "sort_order": 170,
        "track_id": "private",
    },
    {
        "id": "priv_stalls",
        "title": "Slow flight, stalls & spins",
        "description": "Stall recognition/recovery, spin entry/recovery.",
        "pts_ref": "Private PTS",
        "sort_order": 180,
        "track_id": "private",
    },
    {
        "id": "priv_emergency",
        "title": "Emergency operations",
        "description": "Rope break, off-field, systems failures, abnormals.",
        "pts_ref": "Private PTS",
        "sort_order": 190,
        "track_id": "private",
    },
    {
        "id": "priv_weather",
        "title": "Weather",
        "description": "Reports, forecasts, fronts, thunderstorms, icing.",
        "pts_ref": "AC 00-6 / AIM",
        "sort_order": 200,
        "track_id": "private",
    },
    {
        "id": "priv_systems",
        "title": "Systems & instruments",
        "description": "Pitot-static, compass, ASI markings, oxygen, transponder.",
        "pts_ref": "GFH / PHAK",
        "sort_order": 210,
        "track_id": "private",
    },
    {
        "id": "priv_misc",
        "title": "Private miscellaneous",
        "description": "Private bank items that do not fit a primary topic bucket.",
        "pts_ref": "Private Glider bank",
        "sort_order": 220,
        "track_id": "private",
    },
]
TOPIC_BY_ID = {t["id"]: t for t in TOPICS}

TOPIC_RULES = [
    (
        "priv_regs",
        [
            r"\bNTSB\b",
            r"\bsubstantial damage\b",
            r"\baccident report\b",
            r"\bimmediate notification\b",
            r"\bChart Supplement\b",
            r"\bNOTAM\b",
            r"\bAdvisory Circular\b",
            r"\b14 CFR\b",
            r"\bFAR\b",
        ],
    ),
    (
        "priv_airspace",
        [
            r"\bminimum flight visibility\b",
            r"\bproximity to cloud\b",
            r"\bdistance from clouds?\b",
            r"\bbasic VFR\b",
            r"\bVFR (?:flight )?(?:weather )?minimums?\b",
            r"\bclass [abcdefg]\b",
            r"\bairspace\b",
            r"\bMOA\b",
            r"\bTFR\b",
            r"\brestricted area\b",
            r"\bprohibited area\b",
            r"\bwarning area\b",
            r"\balert area\b",
            r"\btransponder\b",
            r"\bsquawk\b",
            r"\bATC\b",
            r"\blight signal\b",
            r"\bSpecial VFR\b",
        ],
    ),
    (
        "priv_scan",
        [
            r"\bwake turbulence\b",
            r"\bwingtip vort",
            r"\bvortex\b",
            r"\bcollision avoid",
            r"\bvisual scanning\b",
            r"\bsee and avoid\b",
            r"\bclearing turn",
        ],
    ),
    (
        "priv_stalls",
        [r"\bspin\b", r"\bstall\b", r"\bslow flight\b", r"\baccelerated stall"],
    ),
    (
        "priv_tow",
        [
            r"\baerotow\b",
            r"\btow(?:line|rope|plane|hook|position|pilot)\b",
            r"\bwinch\b",
            r"\bauto.?tow\b",
            r"\brope break\b",
            r"\bsafety link\b",
            r"\bweak.?link\b",
            r"\bbox(?:ing)? the wake\b",
            r"\blaunch\b",
        ],
    ),
    (
        "priv_landings",
        [
            r"\bforward slip\b",
            r"\bside slip\b",
            r"\btouchdown\b",
            r"\bapproach to land",
            r"\bdownwind landing\b",
            r"\blanding(?:s)?\b(?!\s+gear)",
        ],
    ),
    (
        "priv_soaring",
        [
            r"\bthermal\b",
            r"\bridge soar",
            r"\bwave soar",
            r"\borographic\b",
            r"\bsoaring\b",
            r"\blift source",
            r"\bsea breeze\b",
            r"\bconvergen",
        ],
    ),
    (
        "priv_wb",
        [
            r"\bweight and balance\b",
            r"\bcenter of gravity\b",
            r"\bCG\b",
            r"\bballast\b",
            r"\bmoment\b",
            r"\bempty weight\b",
            r"\bgross weight\b",
        ],
    ),
    (
        "priv_perf",
        [
            r"\bdensity altitude\b",
            r"\b(?<!cabin )pressure altitude\b",
            r"\babsolute altitude\b",
            r"\btrue altitude\b",
            r"\bindicated altitude\b",
            r"\bglide ratio\b",
            r"\bL\/D\b",
            r"\bbest (?:l\/d|glide)\b",
            r"\bmin(?:imum)? sink\b",
            r"\bspeed.?to.?fly\b",
            r"\bnever.?exceed\b",
            r"\bmaneuvering speed\b",
            r"\bV\([A-Z]+\)",
            r"\bVne\b",
            r"\bVso\b",
            r"\bVa\b",
            r"\bVno\b",
        ],
    ),
    (
        "priv_weather",
        [
            r"\bthunderstorm\b",
            r"\bfront(?:al)?\b",
            r"\bfrost\b",
            r"\bicing\b",
            r"\bturbulence\b",
            r"\bwind shear\b",
            r"\bMETAR\b",
            r"\bTAF\b",
            r"\bAIRMET\b",
            r"\bSIGMET\b",
            r"\bweather\b",
            r"\batmospheric\b",
            r"\binversion\b",
            r"\bwinds? aloft\b",
            r"\bdewpoint\b",
            r"\blapse rate\b",
            r"\bair mass\b",
            r"\bstable air\b",
            r"\bunstable air\b",
            r"\bGraphical Forecasts for Aviation\b",
            r"\bGFA\b",
            r"\bAFSS\b",
            r"\bweather briefer\b",
            r"\boutlook briefing\b",
            r"\bstandard briefing\b",
            r"\babbreviated briefing\b",
        ],
    ),
    (
        "priv_emergency",
        [
            r"\bin-flight emergency\b",
            r"\bemergency\b",
            r"\babnormal\b",
            r"\boff.?field\b",
            r"\bforced landing\b",
            r"\bspiral dive\b",
        ],
    ),
    (
        "priv_aeromedical",
        [
            r"\bhypoxia\b",
            r"\bhyperventilation\b",
            r"\bspatial disorientation\b",
            r"\bmotion sickness\b",
            r"\balcohol\b",
            r"\bdrug\b",
            r"\bscuba\b",
            r"\bdehydrat",
            r"\bhazardous attitude",
            r"\baeronautical decision\b",
            r"\bADM\b",
            r"\bIMSAFE\b",
            r"\bfatigue\b",
        ],
    ),
    (
        "priv_airworthy",
        [
            r"\bairworthiness directive\b",
            r"\b\bAD'?s?\b",
            r"\b100.?hour\b",
            r"\bannual inspection\b",
            r"\bmaintenance records?\b",
            r"\bpreventive maintenance\b",
            r"\bairworthiness certificate\b",
            r"\binoperative\b",
        ],
    ),
    (
        "priv_certs",
        [
            r"\bprivate (?:pilot|certificate|privileges)\b",
            r"\bstudent pilot\b",
            r"\bmedical certificate\b",
            r"\bflight review\b",
            r"\bto act as (?:pilot in command|PIC)\b",
            r"\btakeoffs and (?:three )?landings\b",
            r"\bcurrency\b",
            r"\blogbook\b",
            r"\bendorsement\b",
            r"\bknowledge test\b",
            r"\bcertification of airmen\b",
            r"\bcategory of airmen\b",
            r"\bclass of (?:aircraft|airmen)\b",
            r"\bcategory of aircraft\b",
            r"\bpermanent mailing address\b",
            r"\bpersonal possession\b",
        ],
    ),
    (
        "priv_airport",
        [
            r"\brunway\b",
            r"\btaxiway\b",
            r"\bairport\b",
            r"\bgliderport\b",
            r"\btraffic pattern\b",
            r"\bmarking\b",
            r"\bholding position\b",
            r"\bhold short\b",
            r"\bdisplaced threshold\b",
            r"\bdemarcation bar\b",
            r"\bvehicle lane\b",
            r"\bFigure 65\b",
        ],
    ),
    (
        "priv_nav",
        [
            r"\bsectional\b",
            r"\bVOR\b",
            r"\bVORTAC\b",
            r"\bpilotage\b",
            r"\bdead reckoning\b",
            r"\bnavigation\b",
            r"\bgroundspeed\b",
            r"\bmagnetic compass\b",
            r"\bvariation\b",
            r"\bdeviation\b",
            r"\bcross-country\b",
            r"\blatitude\b",
            r"\blongitude\b",
        ],
    ),
    (
        "priv_systems",
        [
            r"\bpitot\b",
            r"\bstatic system\b",
            r"\bairspeed indicator\b",
            r"\balimeter\b",
            r"\bcompass\b",
            r"\binstrument\b",
            r"\boxygen\b",
            r"\bvariometer\b",
            r"\bgreen arc\b",
            r"\byellow arc\b",
            r"\bwhite arc\b",
            r"\bred (?:radial )?line\b",
            r"\btransponder\b",
        ],
    ),
    (
        "priv_controls",
        [
            r"\baileron\b",
            r"\brudder\b",
            r"\belevator\b",
            r"\badverse yaw\b",
            r"\bspoiler\b",
            r"\bdive brake\b",
            r"\btrim\b",
            r"\bflap\b",
        ],
    ),
    (
        "priv_maneuvers",
        [
            r"\bsteep turn\b",
            r"\bturns? to headings?\b",
            r"\bstraight glide\b",
            r"\brate of turn\b",
            r"\bradius of turn\b",
            r"\bbank(?:ed| angle)\b",
            r"\bcentrifugal force\b",
        ],
    ),
    (
        "priv_preflight",
        [
            r"\bpreflight\b",
            r"\bassembly\b",
            r"\bground handling\b",
            r"\bregistration\b",
            r"\bbefore takeoff\b",
            r"\bcertificates and documents\b",
            r"\bpassenger(?:s)?\b.*\bbrief",
            r"\bpre-takeoff briefing\b",
        ],
    ),
    (
        "priv_aero",
        [
            r"\blift\b",
            r"\bdrag\b",
            r"\bairfoil\b",
            r"\bangle of attack\b",
            r"\bstability\b",
            r"\bbernoulli\b",
            r"\brelative wind\b",
            r"\bcenter of pressure\b",
            r"\bchord\b",
            r"\bcamber\b",
            r"\binduced\b",
            r"\bparasite\b",
            r"\bload factor\b",
        ],
    ),
]

FOOTER_RE = re.compile(
    r"(?:©\s*GPGS|O?GPGS\s+\d+|gliderpilotsgroundschool\.com|303[-–]?\s*908[-–]?\s*3147|gpgsds?\s+\d+)",
    re.I,
)
HEADER_RE = re.compile(
    r"(?:Glider Pilots Ground School|Private Glider|PRIVATE PILOT GLIDER|"
    r"QUESTION BANK|Computer Test(?:ing)? Supplement|See Chapter|"
    r"Pages?\s+\d+.*intentionally omitted|SLIDER QUESTION)",
    re.I,
)

TYPO_FIXES = [
    (r"\brespeet\b", "respect"),
    (r"\baireralt\b", "aircraft"),
    (r"\bairerat\b", "aircraft"),
    (r"\baireraft\b", "aircraft"),
    (r"\bareraft\b", "aircraft"),
    (r"\bcategors\b", "category"),
    (r"\bcatczory\b", "category"),
    (r"\brotoreratt\b", "rotorcraft"),
    (r"\brotorerali\b", "rotorcraft"),
    (r"\breter\b", "refer"),
    (r"\bfongitude\b", "longitude"),
    (r"\biatiude\b", "latitude"),
    (r"\bpila\b", "pilot"),
    (r"\bpitssengers\b", "passengers"),
    (r"\bHight\b", "flight"),
    (r"\bfight\b", "flight"),
    (r"\bnorma\b", "normal"),
    (r"\bIransponder\b", "transponder"),
    (r"\biusponder\b", "transponder"),
    (r"\bselvetion\b", "selection"),
    (r"\bMakeel\b", "Makeeff"),
    (r"\bMakeelt\b", "Makeeff"),
    (r"\bPurtle Lake\b", "Turtle Lake"),
    (r"\bAirnvorthiness\b", "Airworthiness"),
    (r"\bpurpases\b", "purposes"),
    (r"\bperfermed\b", "performed"),
    (r"\baircrall\b", "aircraft"),
    (r"\bpertorm\b", "perform"),
    (r"\bhet air\b", "hot air"),
    (r"\btree balloon\b", "free balloon"),
    (r"\bAnrpkine\b", "Airplane"),
    (r"\blighter-than-air\b", "lighter-than-air"),
    (r"\bShorty after\b", "Shortly after"),
    (r"\bearls forenoon\b", "early forenoon"),
    (r"\byellow are\b", "yellow arc"),
    (r"\bwhite are\b", "white arc"),
    (r"\bgreen are\b", "green arc"),
    (r"\bunaccelerated fight\b", "unaccelerated flight"),
    (r"\bsoaring Hight\b", "soaring flight"),
    (r"\bChe remarks\b", "The remarks"),
    (r"\bRAB3S\b", "RAB35"),
    (r"\b18357\b", "1835Z"),
    (r"\b“Hy\b", '"Hg'),
    (r"\b1-1'2 SM\b", "1-1/2 SM"),
    (r"\bVIFR\b", "VFR"),
    (r"\bClass DL\b", "Class D."),
]

# Manual fixes for badly OCR'd / truncated items (bank number → text).
MANUAL_OVERRIDES: dict[int, dict] = {
    1: {
        "question": "With respect to the certification of airmen, which is a category of aircraft?",
        "choices": {
            "A": "Gyroplane, helicopter, airship, free balloon.",
            "B": "Airplane, rotorcraft, glider, lighter-than-air.",
            "C": "Single-engine land and sea, multiengine land and sea.",
        },
    },
    2: {
        "question": "With respect to the certification of airmen, which is a class of aircraft?",
        "choices": {
            "A": "Airplane, rotorcraft, glider, lighter-than-air.",
            "B": "Single-engine land and sea, multiengine land and sea.",
            "C": "Lighter-than-air, airship, hot air balloon, gas balloon.",
        },
    },
    3: {
        "question": "With respect to the certification of aircraft, which is a category of aircraft?",
        "choices": {
            "A": "Normal, utility, acrobatic.",
            "B": "Airplane, rotorcraft, glider.",
            "C": "Landplane, seaplane.",
        },
    },
    451: {
        "question": "If your glider is equipped with 4096 code radar beacon transponder, the code for normal operation is",
        "choices": {"A": "1200.", "B": "1202.", "C": "7700."},
    },
    452: {
        "question": "When making transponder code changes, pilots should avoid inadvertent selection of which code?",
        "choices": {"A": "7200.", "B": "7500.", "C": "7600."},
    },
    453: {
        "question": "Pre-takeoff briefing of passengers for a flight is the responsibility of",
        "choices": {"A": "all passengers.", "B": "the pilot.", "C": "a crewmember."},
    },
    454: {
        "question": "(Refer to figure 20, area 1.) The NALF Fentress (NFE) Airport is in what type of airspace?",
        "choices": {"A": "Class D.", "B": "Class E.", "C": "Class G."},
    },
    455: {
        "question": "Deviation error of the magnetic compass is caused by",
        "choices": {
            "A": "northerly turning error.",
            "B": "certain metals and electrical systems within the aircraft.",
            "C": "the difference in location of true north and magnetic north.",
        },
    },
    456: {
        "question": "Refer to figure 65. Which figure indicates a vehicle lane?",
        "choices": {"A": "G.", "B": "A.", "C": "E."},
    },
    457: {
        "question": 'The "yellow demarcation bar" marking indicates',
        "choices": {
            "A": "a runway with a displaced threshold that precedes the runway.",
            "B": "a hold line from a taxiway to a runway.",
            "C": "the beginning of available runway for landing on the approach side.",
        },
    },
    458: {
        "question": "When speaking to an AFSS weather briefer, you should state",
        "choices": {
            "A": "the pilot-in-command's full name and address.",
            "B": "a summary of your qualifications.",
            "C": "whether the flight is VFR or IFR.",
        },
    },
    459: {
        "question": "To best determine general aviation forecast weather conditions covering a flight information region, the pilot should refer to",
        "choices": {
            "A": "Weather Depiction Charts.",
            "B": "Graphical Forecasts for Aviation (GFA).",
            "C": "Satellite maps.",
        },
    },
    460: {
        "question": "Some Advisory Circulars (ACs) are available free of charge while the remaining ACs must be purchased. All aviation ACs may be obtained by following the procedures in the AC Checklist (AC 00-2) or by",
        "choices": {
            "A": "Contacting the local airport Fixed Base Operator and requesting the desired AC.",
            "B": "referring to the FAA internet home page and following the links to the ACs.",
            "C": "reading the ACs in the Aeronautical Information Manual (AIM).",
        },
    },
    461: {
        "question": "What causes variations in altimeter settings between weather reporting points?",
        "choices": {
            "A": "Coriolis force.",
            "B": "Variation of terrain elevation.",
            "C": "Unequal heating of the Earth's surface.",
        },
    },
    464: {
        "question": '(Refer to Figure 21, area 2.) Which airport is located at approximately 47° 35\' 30"N latitude and 100° 43\' 00"W longitude?',
        "choices": {"A": "Makeeff.", "B": "Turtle Lake.", "C": "Johnson."},
    },
    465: {
        "question": "(Refer to Figure 21, area 3.) Which airport is located at approximately 47° 21'N latitude and 101° 01'W longitude?",
        "choices": {"A": "Washburn.", "B": "Johnson.", "C": "Lorentzen."},
    },
    466: {
        "question": "(Refer to Figure 65.) From the flight deck, marking G confirms the aircraft to be",
        "choices": {
            "A": "near an instrument approach clearance zone.",
            "B": "on a runway, about to clear.",
            "C": "on a taxiway, about to enter runway zone.",
        },
    },
    467: {
        "question": "(Refer to Figure 65.) Sign E is a visual clue that",
        "choices": {
            "A": "confirms the aircraft's location on taxiway B.",
            "B": "warns the pilot of approaching taxiway B.",
            "C": 'indicates that "B" holding area is ahead.',
        },
    },
    468: {
        "question": "The lateral dimensions of Class D airspace are based on",
        "choices": {
            "A": "Five statute miles from the geographical center of the airport.",
            "B": "The number of the airports that lie within the class D airspace.",
            "C": "the instrument approach procedures for which the controlled airspace is established.",
        },
    },
    469: {
        "question": "(Refer to Figure 25.) At which airports is fixed-wing Special VFR not authorized?",
        "choices": {
            "A": "Fort Worth Meacham and Fort Worth Spinks.",
            "B": "Dallas-Fort Worth International and Dallas Love Field.",
            "C": "Addison and Dallas Executive.",
        },
    },
    470: {
        "question": "(Refer to Figure 20, area 1.) What minimum radio equipment is required to land and take off at Norfolk International?",
        "choices": {
            "A": "Mode C transponder and omni receiver.",
            "B": "Mode C transponder and 2-way radio.",
            "C": "Mode C transponder, 2-way radio and DME.",
        },
    },
    471: {
        "question": "When a control tower, located on an airport within Class D airspace, ceases operation for the day, what happens to the airspace designation?",
        "choices": {
            "A": "The airspace reverts to class E or a combination of class E and class G airspace during the hours the tower is not in operation.",
            "B": "The airspace designation normally will not change.",
            "C": "The airspace remains class D airspace as long as a weather observer or automated weather system is available.",
        },
    },
    472: {
        "question": "During turns, the glider pilot observes the towplane, matches the bank angle in a coordinated turn, and aims the nose of the glider",
        "choices": {
            "A": "at the outside wingtip of the towplane.",
            "B": "at the inside wingtip of the towplane.",
            "C": "directly at towplane.",
        },
    },
    473: {
        "question": "(Refer to figure 12.) The remarks section for KMDW has RAB35 listed. This entry means",
        "choices": {
            "A": 'blowing mist has reduced the visibility to 1-1/2 SM.',
            "B": 'the barometer has risen .35 "Hg.',
            "C": "rain began at 1835Z.",
        },
    },
}


def light_typo_fix(s: str) -> str:
    for pat, repl in TYPO_FIXES:
        s = re.sub(pat, repl, s, flags=re.I)
    return s


def load_answer_key() -> dict[int, str]:
    raw = json.loads(ANSWER_KEY_PATH.read_text(encoding="utf-8"))
    return {int(k): str(v).upper() for k, v in raw.items()}


def ocr_image(png_path: Path, txt_base: Path) -> str:
    COLS_DIR.mkdir(parents=True, exist_ok=True)
    cmd = [str(TESSERACT), str(png_path), str(txt_base), "--psm", "6", "-l", "eng"]
    subprocess.run(cmd, check=True, capture_output=True)
    return Path(str(txt_base) + ".txt").read_text(encoding="utf-8", errors="replace")


def split_and_ocr_page(page_num: int, overlap: float = 0.02) -> tuple[str, str]:
    """Split upright portrait page into left/right columns (NO rotate)."""
    src = PAGES_DIR / f"page-{page_num:02d}.png"
    img = Image.open(src)
    w, h = img.size
    mid = w // 2
    ov = int(w * overlap)
    left = img.crop((0, 0, mid + ov, h))
    right = img.crop((mid - ov, 0, w, h))
    left_png = COLS_DIR / f"p{page_num:02d}-L.png"
    right_png = COLS_DIR / f"p{page_num:02d}-R.png"
    left.save(left_png)
    right.save(right_png)
    left_txt = ocr_image(left_png, COLS_DIR / f"p{page_num:02d}-L")
    right_txt = ocr_image(right_png, COLS_DIR / f"p{page_num:02d}-R")
    return left_txt, right_txt


def normalize_unicode(text: str) -> str:
    repl = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "—": "-",
        "–": "-",
        "©": "C",
        "€": "C",
        "¢": "C",
    }
    for a, b in repl.items():
        text = text.replace(a, b)
    return text


def normalize_choice_leader(line: str) -> str | None:
    """Return 'A- body' / 'B- body' / 'C- body' if line starts with a choice marker."""
    s = line.strip()
    # Classic A. / A: / A- / A— (em dash already normalized)
    m = re.match(r"^([ABC])\s*[.:\-=\u2013\u2014]\s*(.*)$", s, re.I)
    if m:
        return f"{m.group(1).upper()}- {m.group(2).strip()}"
    # OCR: At / AL / A, / RB: / Be / Bo / Co / C2 / (: / \.
    m = re.match(r"^(?:At|AL|A[,;]|RA|RB)\s*[.:\-]?\s*(.*)$", s, re.I)
    if m and m.group(1):
        return f"A- {m.group(1).strip()}"
    m = re.match(r"^(?:Be|Bo|B[,;]|8)\s*[.:\-]?\s*([a-z].*)$", s, re.I)
    if m:
        return f"B- {m.group(1).strip()}"
    m = re.match(r"^(?:Co|C2|C[,;]|\(|\\\.)\s*[.:\-]?\s*(.*)$", s, re.I)
    if m and m.group(1):
        body = m.group(1).strip()
        if body:
            return f"C- {body}"
    # Bare "\. text" from page1
    m = re.match(r"^\\\.\s*(.+)$", s)
    if m:
        return f"A- {m.group(1).strip()}"
    m = re.match(r"^Ie\s+(.+)$", s)
    if m:
        return f"B- {m.group(1).strip()}"
    m = re.match(r"^\(:\s*(.+)$", s)
    if m:
        return f"C- {m.group(1).strip()}"
    return None


def preprocess_column(text: str, page: int, side: str) -> str:
    text = normalize_unicode(text)
    text = light_typo_fix(text)
    lines_out: list[str] = []
    for raw in text.splitlines():
        line = FOOTER_RE.sub("", raw).rstrip()
        if not line.strip():
            continue
        if HEADER_RE.search(line) and not re.match(r"^\d{1,3}\s*[.:\-]", line.strip()):
            continue
        if re.fullmatch(r"\d{1,3}", line.strip()):
            continue
        # margin bleed
        line = re.sub(r"^[\s\|Il§`'\"]+", "", line)
        line = re.sub(r"^[:;,.\]\[\)\(]+\s*", "", line)

        # Page-1 left: `{+` / `{:` → question 1
        if page == 1 and side == "L":
            if re.match(r"^[\{\[][+1lI:]\s*", line) and re.search(
                r"certification of airmen", line, re.I
            ):
                line = re.sub(r"^[\{\[][+1lI:].*?(?=With)", "1. ", line, count=1)
                if not line.startswith("1"):
                    line = "1. " + re.sub(r"^[\{\[][+1lI:]\s*", "", line)

        # I3: / I4: → 13/14 (capital i for 1)
        line = re.sub(r"^I(\d)\s*[.:\-]\s*", r"1\1. ", line)
        # 451, → 451.  / 473, → 473.
        line = re.sub(r"^(\d{1,3})\s*,\s+", r"\1. ", line)
        # 4517. → 451. (extra digit bleed)
        line = re.sub(r"^4517\s*[.:\-]", "451.", line)
        line = re.sub(r"^4o4\s*[.:\-]", "464.", line, flags=re.I)
        line = re.sub(r"^16S\s*[.:\-]", "465.", line)
        line = re.sub(r"^to6\s*[.:\-]", "466.", line, flags=re.I)
        line = re.sub(r"^\$52\s*[.:\-]", "452.", line)
        line = re.sub(r"^183\s*[.:\-]\s*Pre-", "453. Pre-", line)
        line = re.sub(r"^152\s*[.:\-]\s*When making", "452. When making", line)
        line = re.sub(r"^IS4\s*[.:\-]?", "454. ", line)
        line = re.sub(r"^488\s*[.:\-]\s*Deviation", "455. Deviation", line)
        line = re.sub(r"^1S\s+[Tt]he", "457. The", line)
        line = re.sub(r"^JSS?\s*,?\s*When speaking", "458. When speaking", line)
        line = re.sub(r"^170\s*[.:\-]\s*When a control", "470. When a control", line)
        # Garbled leading "digits" as letters before a question stem (HS: What…)
        # Mark with sentinel 999 so renumber_sequential assigns expected.
        if re.match(
            r"^[A-ZIl|]{2,4}\s*[.:\-]?\s+(?:What|Which|When|Where|How|Why|The|During|"
            r"If|To|A |An |Pilots?|Except|Under|Automatic|Preventive|Deviation|"
            r"Refer|Pre-)",
            line,
        ) and not re.match(r"^\d", line):
            line = re.sub(r"^[A-ZIl|]{2,4}\s*[.:\-]?\s+", "999. ", line, count=1)
        elif re.match(
            r"^[A-ZIl|]{2,4}\s+[A-Z]",
            line,
        ) and re.search(
            r"\b(?:What|Which|When|Where|How|Why|factor|leads|neglected|common)\b",
            line,
            re.I,
        ):
            line = re.sub(r"^[A-ZIl|]{2,4}\s+", "999. ", line, count=1)

        # Normalize choice leaders before question rewrite
        choice = normalize_choice_leader(line)
        if choice:
            line = choice
        else:
            # N: / N. / N- question
            line = re.sub(r"^(\d{1,3})\s*[.:\-]\s*", r"\1. ", line)
            # Collapse A. / B. / C. already handled; also "A text"
            line = re.sub(r"^([ABC])\s*[.:\-=\u2013\u2014]\s*", r"\1- ", line)

        # Split glued choices
        line = re.sub(
            r"([.!?])\s*(?:[\]\[\)\(<\|]+\s*)?([ABC])\s*[.:\-=]\s*",
            r"\1\n\2- ",
            line,
        )
        line = re.sub(
            r"\s+(?:[\]\[\)\(<\|]+\s*)?([ABC])\s*[.:\-=]\s+",
            r"\n\1- ",
            line,
        )
        for part in line.split("\n"):
            part = part.strip()
            if part:
                lines_out.append(part)
    return "\n".join(lines_out)


def join_continuations(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    q_re = re.compile(r"^\d{1,3}\s*[.\-]\s*\S")
    c_re = re.compile(r"^[ABC]\s*[.\-]\s*\S")
    for line in lines:
        if not line:
            continue
        is_q = bool(q_re.match(line))
        is_c = bool(c_re.match(line))
        if out and not is_q and not is_c:
            if out[-1].endswith("-") and not re.search(r"[ABC]-$", out[-1]):
                out[-1] = out[-1][:-1] + line
            else:
                out[-1] = out[-1] + " " + line
        else:
            out.append(line)
    return "\n".join(out)


def clean_text(s: str) -> str:
    s = light_typo_fix(s)
    s = FOOTER_RE.sub("", s)
    s = HEADER_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip(" :.-")
    s = re.sub(r"^[~`'\"|]+", "", s).strip()
    return s


def parse_column_text(text: str, page: int, side: str) -> list[dict]:
    text = preprocess_column(text, page, side)
    text = join_continuations(text)

    questions: list[dict] = []
    cur: dict | None = None
    orphan_choices: dict[str, str] = {}

    for line in text.splitlines():
        line = line.strip()
        if not line or FOOTER_RE.search(line) or HEADER_RE.search(line):
            continue

        qm = re.match(r"^(?P<num>\d{1,3})\s*[.\-]\s*(?P<body>.+)$", line)
        if qm:
            num = int(qm.group("num"))
            body = qm.group("body").strip()
            # Sentinel 999 from garbled-number rewrite → force sequential assign
            if num == 999:
                num = -2  # renumber treats <1 specially; use expected via -2 path
            if num != -2 and (num < 1 or num > EXPECTED_TOTAL + 20):
                continue
            # Reject section headers like "16. PRIVATE PILOT"
            if re.match(r"(?i)PRIVATE PILOT|QUESTION BANK|ANSWERS TO", body):
                continue
            # Lone "8- physical" style mid-sequence → treat as B if needed
            if (
                cur is not None
                and num <= 9
                and num > 0
                and "A" in cur["choices"]
                and "B" not in cur["choices"]
                and cur["ocr_num"] >= 100
                and num < 20
            ):
                cur["choices"]["B"] = body
                continue
            if cur is not None:
                questions.append(cur)
            cur = {
                "ocr_num": expected_placeholder(num),
                "page": page,
                "side": side,
                "question": body,
                "choices": {},
            }
            continue

        cm = re.match(r"^(?P<letter>[ABC])\s*[.\-]\s*(?P<body>.*)$", line)
        if cm:
            letter = cm.group("letter")
            cbody = cm.group("body").strip()
            if cur is None:
                orphan_choices[letter] = cbody
            else:
                if letter in cur["choices"]:
                    prev = cur["choices"][letter]
                    if len(cbody) > len(prev):
                        cur["choices"][letter] = cbody
                else:
                    cur["choices"][letter] = cbody
            continue

        if cur is not None:
            if not cur["choices"]:
                cur["question"] = (cur["question"] + " " + line).strip()
            else:
                last = max(cur["choices"].keys())
                cur["choices"][last] = (cur["choices"][last] + " " + line).strip()

    if cur is not None:
        questions.append(cur)

    for q in questions:
        if q.get("orphan_continuation"):
            continue
        for letter in ("A", "B", "C"):
            body = q["choices"].get(letter)
            if not body:
                continue
            m = re.search(r"\s+(?:[\]\[\)\(<\|]+\s*)?([ABC])\s*[.\-=]\s+(.+)$", body)
            if m and m.group(1) != letter:
                q["choices"][letter] = body[: m.start()].strip()
                nxt = m.group(1)
                if nxt not in q["choices"]:
                    q["choices"][nxt] = m.group(2).strip()

    for q in questions:
        if q.get("orphan_continuation"):
            continue
        q["question"] = clean_text(q["question"])
        q["question"] = re.sub(r"\s+[ABC]\s*[-.].*$", "", q["question"]).strip()
        for k, v in list(q["choices"].items()):
            q["choices"][k] = clean_text(v)

    if orphan_choices:
        questions.insert(
            0,
            {
                "ocr_num": -1,
                "page": page,
                "side": side,
                "question": "",
                "choices": {k: clean_text(v) for k, v in orphan_choices.items()},
                "orphan_continuation": True,
            },
        )
    return questions


def expected_placeholder(num: int) -> int:
    """Map sentinel / unknown OCR nums to a value renumber will replace."""
    if num == -2:
        return -2  # force expected in renumber
    return num


def merge_continuations(items: list[dict]) -> list[dict]:
    out: list[dict] = []
    for item in items:
        if item.get("orphan_continuation"):
            if out and len(out[-1].get("choices", {})) < 3:
                for k, v in item["choices"].items():
                    if k not in out[-1]["choices"]:
                        out[-1]["choices"][k] = v
            continue
        out.append(item)
    return out


def renumber_sequential(parsed: list[dict]) -> list[dict]:
    """Assign bank numbers in page/column order.

    Trust OCR numbers only when close to the running expected index —
    private-bank OCR often misreads 39 as 349, 11 as 1, etc.
    """
    order = sorted(
        enumerate(parsed),
        key=lambda iv: (iv[1]["page"], 0 if iv[1]["side"] == "L" else 1, iv[0]),
    )
    items = [p for _, p in order]
    items = merge_continuations(items)

    assigned: list[dict] = []
    expected = 1
    used: set[int] = set()

    for item in items:
        n = item["ocr_num"]
        if n == -2:
            # Explicit garbled-number sentinel — always take next expected
            final = expected
            while final in used:
                final += 1
            if final > EXPECTED_TOTAL:
                continue
            item = dict(item)
            item["num"] = final
            used.add(final)
            assigned.append(item)
            expected = final + 1
            continue
        if n < 1:
            continue
        # Stray single-digit / tiny nums far from sequence (choice misreads)
        if n < 10 and expected >= 20 and abs(n - expected) > 8:
            if len(item.get("choices", {})) < 2:
                continue
        # Prefer OCR num only when near expected (handles small skips for X gaps)
        if (
            1 <= n <= EXPECTED_TOTAL
            and n not in used
            and abs(n - expected) <= 8
        ):
            final = n
        else:
            final = expected
            while final in used:
                final += 1
            if final > EXPECTED_TOTAL:
                continue
        item = dict(item)
        item["num"] = final
        used.add(final)
        assigned.append(item)
        expected = final + 1

    return assigned


def classify_topic(question: str, choices: list[str]) -> str:
    blob = (question + " " + " ".join(choices)).lower()
    for topic_id, patterns in TOPIC_RULES:
        for pat in patterns:
            if re.search(pat, blob, re.I):
                return topic_id
    return "priv_misc"


def load_manual_overrides() -> dict[int, dict]:
    """Merge in-script overrides with content/private-import/manual_overrides.json."""
    merged: dict[int, dict] = dict(MANUAL_OVERRIDES)
    if OVERRIDES_JSON.exists():
        raw = json.loads(OVERRIDES_JSON.read_text(encoding="utf-8"))
        for k, v in raw.items():
            n = int(k)
            if not isinstance(v, dict) or "question" not in v or "choices" not in v:
                continue
            merged[n] = {
                "question": str(v["question"]),
                "choices": {kk: str(vv) for kk, vv in dict(v["choices"]).items()},
            }
    return merged


def apply_manual_overrides(by_num: dict[int, dict], overrides: dict[int, dict]) -> None:
    for n, ov in overrides.items():
        by_num[n] = {
            "num": n,
            "ocr_num": n,
            "page": by_num.get(n, {}).get("page", 0),
            "side": by_num.get(n, {}).get("side", "M"),
            "question": ov["question"],
            "choices": dict(ov["choices"]),
            "manual": True,
        }


def build_cards(questions: list[dict], answer_key: dict[int, str]) -> tuple[list[dict], dict]:
    by_num: dict[int, dict] = {}
    for q in questions:
        n = q["num"]
        if n in by_num:
            old_ok = len(by_num[n].get("choices", {})) >= 3
            new_ok = len(q.get("choices", {})) >= 3
            if new_ok and not old_ok:
                by_num[n] = q
            continue
        by_num[n] = q

    overrides = load_manual_overrides()
    apply_manual_overrides(by_num, overrides)

    inactive = sorted(n for n, a in answer_key.items() if a == "X")
    cards = []
    missing_answers = []
    missing_choices = []
    truncated_choices = []
    skipped_inactive = []
    gaps = [i for i in range(1, EXPECTED_TOTAL + 1) if i not in by_num and answer_key.get(i) != "X"]
    found_nums = sorted(by_num.keys())

    for n in range(1, EXPECTED_TOTAL + 1):
        letter = answer_key.get(n)
        if letter == "X":
            skipped_inactive.append(n)
            continue
        q = by_num.get(n)
        if not q:
            continue
        chmap = q.get("choices") or {}
        choices = [
            (chmap.get("A") or "").strip() or f"[missing A for #{n}]",
            (chmap.get("B") or "").strip() or f"[missing B for #{n}]",
            (chmap.get("C") or "").strip() or f"[missing C for #{n}]",
        ]
        if any(x.startswith("[missing") for x in choices):
            missing_choices.append(n)
        if any("truncated on source" in x for x in choices):
            truncated_choices.append(n)

        idx = {"A": 0, "B": 1, "C": 2}.get(letter or "", -1)
        if idx < 0:
            missing_answers.append(n)
            answer = ""
        else:
            answer = choices[idx]

        topic_id = classify_topic(q["question"], choices)
        topic = TOPIC_BY_ID[topic_id]
        cards.append(
            {
                "id": f"private_written_{n:03d}",
                "question": q["question"],
                "answer": answer,
                "choices": choices,
                "source": f"Private written · #{n} · IMG_0003.pdf",
                "tags": [
                    "imported",
                    "private_written",
                    "multiple_choice",
                    "private",
                    topic_id,
                ],
                "topic_id": topic_id,
                "topic_title": topic["title"],
            }
        )

    summary = {
        "total_cards": len(cards),
        "expected_active": EXPECTED_TOTAL - len(inactive),
        "inactive_x_numbers": inactive,
        "skipped_inactive_count": len(skipped_inactive),
        "cards_with_3_choices": sum(
            1
            for c in cards
            if len(c["choices"]) == 3
            and all(
                x and not x.startswith("[missing") and "truncated on source" not in x
                for x in c["choices"]
            )
        ),
        "missing_answers": missing_answers,
        "missing_choice_numbers": missing_choices,
        "truncated_choice_numbers": truncated_choices,
        "ocr_number_gaps": gaps,
        "found_ocr_numbers": found_nums,
        "manual_override_numbers": sorted(overrides.keys()),
        "topic_histogram": dict(Counter(c["topic_id"] for c in cards)),
    }
    return cards, summary


def load_existing_cols() -> tuple[list[dict], list[dict]]:
    all_q: list[dict] = []
    page_logs = []
    for page in QUESTION_PAGES:
        left = (COLS_DIR / f"p{page:02d}-L.txt").read_text(encoding="utf-8", errors="replace")
        right = (COLS_DIR / f"p{page:02d}-R.txt").read_text(encoding="utf-8", errors="replace")
        lq = parse_column_text(left, page, "L")
        rq = parse_column_text(right, page, "R")
        page_logs.append(
            {
                "page": page,
                "left_count": len([x for x in lq if not x.get("orphan_continuation")]),
                "right_count": len([x for x in rq if not x.get("orphan_continuation")]),
                "left_nums": [x["ocr_num"] for x in lq if not x.get("orphan_continuation")],
                "right_nums": [x["ocr_num"] for x in rq if not x.get("orphan_continuation")],
            }
        )
        all_q.extend(lq)
        all_q.extend(rq)
        print(
            f"page {page}: L={page_logs[-1]['left_nums']} R={page_logs[-1]['right_nums']}"
        )
    return all_q, page_logs


def run_ocr() -> None:
    for page in QUESTION_PAGES:
        print(f"OCR page {page}...")
        left, right = split_and_ocr_page(page)
        (COLS_DIR / f"p{page:02d}-L.txt").write_text(left, encoding="utf-8")
        (COLS_DIR / f"p{page:02d}-R.txt").write_text(right, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--parse-only", action="store_true", help="Reuse existing column OCR text")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    COLS_DIR.mkdir(parents=True, exist_ok=True)

    if not args.parse_only:
        run_ocr()

    answer_key = load_answer_key()
    all_q, page_logs = load_existing_cols()
    numbered = renumber_sequential(all_q)
    cards, summary = build_cards(numbered, answer_key)

    payload = {
        "track_id": "private",
        "topic_title": "Private Pilot Glider question bank",
        "filename": "IMG_0003.pdf",
        "note": (
            "OCR from GPGS Private Glider bank IMG_0003.pdf · "
            f"{EXPECTED_TOTAL} MC ({summary['skipped_inactive_count']} inactive X skipped) · "
            "answer key pp.27-28 · course track private"
        ),
        "topics": TOPICS,
        "cards": cards,
    }
    out_json = OUT_DIR / "private-import.json"
    out_json.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    qa = {
        **summary,
        "page_parse_log": page_logs,
        "output": str(out_json),
        "expected_total_including_inactive": EXPECTED_TOTAL,
    }
    (OUT_DIR / "qa-summary.json").write_text(
        json.dumps(qa, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print("\n=== SUMMARY ===")
    print(f"cards: {summary['total_cards']} (expected active {summary['expected_active']})")
    print(f"with 3 complete choices: {summary['cards_with_3_choices']}")
    print(f"gaps (active missing OCR): {summary['ocr_number_gaps']}")
    print(f"missing choices: {summary['missing_choice_numbers']}")
    print(f"inactive X: {summary['inactive_x_numbers']}")
    print(f"topics: {summary['topic_histogram']}")
    print(f"wrote {out_json}")


if __name__ == "__main__":
    main()
