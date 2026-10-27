#!/usr/bin/env python3
"""OCR + parse GPGS FOI question bank (IMG_0002.pdf) into flf-glider-training import JSON.

Re-run OCR:  python parse_foi_ocr.py
Parse only:   python parse_foi_ocr.py --parse-only
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

from PIL import Image

PAGES_DIR = Path(r"C:\Users\ronwa\OneDrive\Documents\2026_10_27\_ocr_pages")
COLS_DIR = Path(r"C:\Users\ronwa\OneDrive\Documents\2026_10_27\_ocr_text\cols")
OUT_DIR = Path(r"C:\Users\ronwa\Documents\Codex\2026-05-15\flf-glider-training\content\foi-import")
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")

ANSWER_KEY = {
    1: "A", 2: "C", 3: "C", 4: "B", 5: "A", 6: "A", 7: "C", 8: "C", 9: "B", 10: "A",
    11: "A", 12: "A", 13: "B", 14: "A", 15: "A", 16: "C", 17: "A", 18: "A", 19: "A", 20: "A",
    21: "B", 22: "B", 23: "B", 24: "C", 25: "B", 26: "A", 27: "A", 28: "B", 29: "C", 30: "A",
    31: "B", 32: "C", 33: "B", 34: "C", 35: "C", 36: "A", 37: "B", 38: "C", 39: "B", 40: "C",
    41: "A", 42: "B", 43: "C", 44: "A", 45: "A", 46: "B", 47: "C", 48: "C", 49: "A", 50: "B",
    51: "C", 52: "B", 53: "A", 54: "C", 55: "C", 56: "C", 57: "B", 58: "A", 59: "B", 60: "B",
    61: "A", 62: "B", 63: "B", 64: "A", 65: "A", 66: "A", 67: "B", 68: "C", 69: "C", 70: "B",
    71: "B", 72: "C", 73: "C", 74: "C", 75: "C", 76: "A", 77: "B", 78: "B", 79: "A", 80: "A",
    81: "A", 82: "A", 83: "C", 84: "B", 85: "B", 86: "A", 87: "C", 88: "C", 89: "B", 90: "A",
    91: "A", 92: "B", 93: "B", 94: "A", 95: "B", 96: "B", 97: "C", 98: "B", 99: "C", 100: "A",
    101: "B", 102: "A", 103: "C", 104: "C", 105: "B", 106: "B", 107: "C", 108: "B", 109: "B", 110: "B",
    111: "C", 112: "C", 113: "C", 114: "B", 115: "C", 116: "A", 117: "C", 118: "B", 119: "B", 120: "A",
    121: "A", 122: "A", 123: "A", 124: "A", 125: "C", 126: "A", 127: "C", 128: "C", 129: "B", 130: "A",
    131: "A", 132: "C", 133: "B", 134: "C", 135: "B", 136: "C", 137: "B", 138: "B", 139: "A", 140: "B",
    141: "A", 142: "C", 143: "A", 144: "B", 145: "B", 146: "A", 147: "B", 148: "C", 149: "A", 150: "C",
    151: "C", 152: "B", 153: "B", 154: "C", 155: "C", 156: "B", 157: "B", 158: "B", 159: "B", 160: "B",
    161: "B", 162: "A", 163: "B", 164: "C", 165: "C", 166: "A", 167: "C", 168: "A", 169: "B", 170: "B",
    171: "A", 172: "C", 173: "A", 174: "A", 175: "B", 176: "C", 177: "B", 178: "C", 179: "C", 180: "C",
    181: "C", 182: "C", 183: "A", 184: "C", 185: "B", 186: "C", 187: "C", 188: "B", 189: "A", 190: "C",
    191: "C", 192: "A", 193: "C", 194: "A", 195: "C", 196: "B", 197: "A", 198: "C", 199: "C", 200: "A",
    201: "A", 202: "A", 203: "A", 204: "C", 205: "B", 206: "A", 207: "A", 208: "B", 209: "C", 210: "B",
    211: "C", 212: "A", 213: "A", 214: "B", 215: "C", 216: "A", 217: "C", 218: "B", 219: "B", 220: "B",
    221: "B", 222: "B", 223: "B", 224: "C", 225: "A", 226: "B", 227: "B", 228: "B", 229: "A", 230: "C",
    231: "A", 232: "A", 233: "A", 234: "B", 235: "A", 236: "C", 237: "C", 238: "C", 239: "C", 240: "C",
    241: "A", 242: "A", 243: "A", 244: "C", 245: "B", 246: "A", 247: "A", 248: "B", 249: "A", 250: "A",
    251: "C", 252: "C", 253: "A", 254: "B", 255: "A", 256: "A", 257: "A", 258: "C", 259: "C", 260: "B",
    261: "C", 262: "B", 263: "B", 264: "C", 265: "C", 266: "B", 267: "C", 268: "B", 269: "B", 270: "A",
    271: "C", 272: "A", 273: "A", 274: "B", 275: "C", 276: "A",
}

TOPICS = [
    {"id": "foi_learning", "title": "Learning process", "description": "Principles of learning, perception, insight, memory, transfer.", "pts_ref": "FOI / AIH", "sort_order": 10, "track_id": "cfi_g"},
    {"id": "foi_human", "title": "Human behavior", "description": "Defense mechanisms, anxiety, motivation, needs, Maslow.", "pts_ref": "FOI / AIH", "sort_order": 20, "track_id": "cfi_g"},
    {"id": "foi_teaching", "title": "Teaching methods", "description": "Lesson plans, lecture, demonstration, guided discussion, CBT.", "pts_ref": "FOI / AIH", "sort_order": 30, "track_id": "cfi_g"},
    {"id": "foi_critique", "title": "Critique & evaluation", "description": "Critique, assessment, oral quiz, written test.", "pts_ref": "FOI / AIH", "sort_order": 40, "track_id": "cfi_g"},
    {"id": "foi_instructor", "title": "Instructor responsibilities", "description": "Professionalism, ADM as instructor, risk, barriers to communication.", "pts_ref": "FOI / AIH", "sort_order": 50, "track_id": "cfi_g"},
    {"id": "foi_planning", "title": "Course & lesson planning", "description": "Syllabus, PTS/ACS, learning plateaus, rates of learning.", "pts_ref": "FOI / AIH", "sort_order": 60, "track_id": "cfi_g"},
    {"id": "foi_misc", "title": "FOI miscellaneous", "description": "FOI items that do not fit a primary topic bucket.", "pts_ref": "FOI / AIH", "sort_order": 70, "track_id": "cfi_g"},
]
TOPIC_BY_ID = {t["id"]: t for t in TOPICS}

# Order matters: more specific buckets before broad ones.
TOPIC_RULES = [
    (
        "foi_planning",
        [
            r"\bcourse of training\b",
            r"\bsyllabus\b",
            r"\bPTS\b",
            r"\bPractical Test Standards\b",
            r"\bACS\b",
            r"\blearning plateau",
            r"\brate(?:s)? of learning\b",
            r"\btraining course\b",
            r"\bblocks? of learning\b",
            r"\bblocks? of instruction\b",
            r"\bcurriculum\b",
            r"\bplanning (?:any )?instructional\b",
            r"\bin planning instructional activity\b",
        ],
    ),
    (
        "foi_learning",
        [
            r"\blearning process\b",
            r"\bprinciple(?:s)? of (?:learning|effect|primacy|recency|exercise|intensity|readiness)\b",
            r"\bperception(?:s)?\b",
            r"\binsight(?:s)?\b",
            r"\bmemory\b",
            r"\btransfer (?:of learning)?\b",
            r"\bmnemonic",
            r"\bsensory register\b",
            r"\bshort[- ]term memory\b",
            r"\blong[- ]term memory\b",
            r"\bprecoding\b",
            r"\brecoding\b",
            r"\blevel(?:s)? of learning\b",
            r"\bcognitive domain\b",
            r"\baffective domain\b",
            r"\bpsychomotor domain\b",
            r"\bdomains? of learning\b",
            r"\bforgetting\b",
            r"\brepression\b",
            r"\binterference\b",
            r"\bincidental\b",
            r"\bassociat",
            r"\bBloom",
            r"\bskill acquisition\b",
            r"\boverlearning\b",
        ],
    ),
    (
        "foi_human",
        [
            r"\bhuman behavior\b",
            r"\bdefense mechanism",
            r"\banxiety\b",
            r"\bmotivat",
            r"\bmaslow\b",
            r"\bhierarchy of needs\b",
            r"\bbasic need",
            r"\bself[- ]concept\b",
            r"\brationalization\b",
            r"\bcompensation\b",
            r"\bprojection\b",
            r"\bdenial\b",
            r"\baggression\b",
            r"\bresignation\b",
            r"\bfantasy\b",
            r"\bfear\b",
            r"\bthreat\b",
            r"\babnormal reaction",
            r"\bnormal reaction",
            r"\bstress\b",
            r"\bimpatience\b",
            r"\bfatigue\b",
            r"\bhuman needs?\b",
        ],
    ),
    (
        "foi_teaching",
        [
            r"\bteaching method",
            r"\blesson plan",
            r"\blecture\b",
            r"\bdemonstration\b",
            r"\bguided discussion\b",
            r"\bcomputer[- ]based\b",
            r"\bCBT\b",
            r"\binstructional aid",
            r"\btraining aid",
            r"\bdrill and practice\b",
            r"\bdelivery method",
            r"\binstructional method",
            r"\bdemonstration[- ]performance\b",
            r"\bintegrated (?:method|flight instruction)\b",
            r"\bblocked practice\b",
            r"\brandom practice\b",
            r"\bdeliberate practice\b",
            r"\bteaching process\b",
            r"\borganizing lesson\b",
        ],
    ),
    (
        "foi_critique",
        [
            r"\bcritique\b",
            r"\bevaluat",
            r"\bassessment\b",
            r"\boral quiz\b",
            r"\bwritten test\b",
            r"\bpractical test\b",
            r"\bperformance[- ]based objective",
            r"\bcriterion[- ]referenced\b",
            r"\bcriteria\b",
            r"\btest item",
            r"\bmultiple[- ]choice\b",
            r"\bsupply[- ]type\b",
            r"\bselection[- ]type\b",
            r"\bquiz\b",
            r"\bfeedback\b",
            r"\bpre[- ]?solo test\b",
        ],
    ),
    (
        "foi_instructor",
        [
            r"\binstructor responsib",
            r"\bprofessionalism\b",
            r"\bADM\b",
            r"\baeronautical decision",
            r"\brisk (?:management|element)",
            r"\bbarriers? to communication\b",
            r"\bcommunication process\b",
            r"\beffective communication\b",
            r"\bprofessional\b",
            r"\bmentoring\b",
            r"\bsingle pilot resource\b",
            r"\bSRM\b",
            r"\bsituational awareness\b",
            r"\bPAVE\b",
            r"\bas a professional\b",
        ],
    ),
]

# Visual/manual corrections where OCR is garbled or truncated (from column PNGs).
MANUAL_OVERRIDES: dict[int, dict] = {
    42: {
        "question": "How can recoding be described?",
        "choices": {
            "A": "The relating of incoming information to concepts or knowledge already in memory.",
            "B": "The initial storage of information in short-term memory.",
            "C": "The selective process where the sensory register is set to recognize certain stimuli.",
        },
    },
    183: {
        "question": "With regard to the characteristics of a well-planned lesson, each lesson should contain",
        "choices": {
            "A": "new material that is related to the lesson previously presented.",
            "B": "one basic element of the principle, procedure, or skill appropriate to that lesson.",
            "C": "every bit of information needed to reach the objective of the training syllabus.",
        },
    },
    184: {
        "question": "Which statement is true about lesson plans?",
        "choices": {
            "A": "Lesson plans should follow a prescribed format.",
            "B": "Standard prepared lesson plans are effective for teaching all students.",
            "C": "The use of standard lesson plans may not be effective for students requiring a different approach.",
        },
    },
    204: {
        "question": "Fatigue can be either",
        "choices": {
            "A": "physiological or psychological.",
            "B": "physical or mental.",
            "C": "acute or chronic.",
        },
    },
    205: {
        "question": "A CFI can detect fatigue by noting these characteristics in the student:",
        "choices": {
            "A": "Nervous laughter.",
            "B": "Loss of accuracy and control, and irritability.",
            "C": "Poor performance and macho attitude.",
        },
    },
    250: {
        "question": "The accurate perception and understanding of all the factors and conditions within the four fundamental risk elements that affect safety is called",
        "choices": {
            "A": "aeronautical decision making.",
            "B": "Single Pilot Resource Management.",
            "C": "situational awareness.",
        },
    },
    257: {
        "question": "Which domain of learning requires remembering specific facts and concepts?",
        "choices": {
            "A": "Cognitive.",
            "B": "Affective.",
            "C": "Comprehensive.",
        },
    },
    258: {
        "question": "An example of a skill involving the psychomotor domain would be",
        "choices": {
            "A": "learning to correctly evaluate a flight maneuver.",
            "B": "determining the temperature at a specific altitude using standard lapse rate.",
            "C": "programming a global positioning satellite (GPS) receiver.",
        },
    },
    259: {
        "question": "An example of a skill involving the cognitive domain would be",
        "choices": {
            "A": "programming a global positioning satellite (GPS) receiver.",
            "B": "making a logbook entry.",
            "C": "learning to fly a precision approach procedure.",
        },
    },
    260: {
        "question": "When new events displace something that had been previously learned, it is called",
        "choices": {
            "A": "displacement.",
            "B": "interference.",
            "C": "repression.",
        },
    },
    261: {
        "question": "When a student attempts to disguise a weak or undesirable quality by emphasizing a more positive one, this is a defense mechanism in the form of",
        "choices": {
            "A": "rationalization.",
            "B": "submission.",
            "C": "compensation.",
        },
    },
    262: {
        "question": "When students display the defense mechanism of denial they",
        "choices": {
            "A": "become visibly angry, upset, or childish.",
            "B": "may attempt to minimize the situation.",
            "C": "attempt to justify actions by asking numerous questions.",
        },
    },
    263: {
        "question": "A student who has a hidden fear of flying that inhibits learning during training is displaying the defense mechanism of",
        "choices": {
            "A": "flight.",
            "B": "repression.",
            "C": "resignation.",
        },
    },
    264: {
        "question": "Students who recognize that the instructor is inadequately prepared can become",
        "choices": {
            "A": "assertive.",
            "B": "apprehensive.",
            "C": "apathetic.",
        },
    },
    265: {
        "question": "Which statement is true about an instructor's assessment of a student's performance?",
        "choices": {
            "A": "Instructor comments and recommendations should be based on the performance as it should have been.",
            "B": "The critique should always be conducted in private.",
            "C": "It is a step in the learning process, not just in the grading process.",
        },
    },
    266: {
        "question": "During a flight training course, when is it appropriate to introduce the students to the acceptable standards for passing the practical test?",
        "choices": {
            "A": "At the beginning of each flight lesson.",
            "B": "Not until 3 hours before the practical test preparation instruction required by regulation.",
            "C": "During phase/stage check to assess a student's progression at strategic course transitions.",
        },
    },
    267: {
        "question": "Commercially-developed test preparation material is",
        "choices": {
            "A": "FAA approved for knowledge tests only.",
            "B": "designed to be used as a stand-alone method of study.",
            "C": "intended to be used as a supplement to instructor-led training and materials.",
        },
    },
    268: {
        "question": "Which statement is true regarding assessment of student learning?",
        "choices": {
            "A": "Assessment should be a formal process and results recorded so the students are continually aware of their progress.",
            "B": "Assessment of student learning should be an integral part of each lesson.",
            "C": "If deficiencies or faults not associated with the present lesson are revealed, they should be corrected immediately.",
        },
    },
    269: {
        "question": "What type of assessment focuses on real-world skills?",
        "choices": {
            "A": "Collaborative.",
            "B": "Authentic.",
            "C": "Traditional.",
        },
    },
    270: {
        "question": "An instructor can help a student cope with fear or anxiety by",
        "choices": {
            "A": "emphasizing the benefits and pleasurable experiences from flying.",
            "B": "discontinuing the lesson or maneuver and moving them to another part of the curriculum.",
            "C": "repeating the lesson or maneuver until the anxiety goes away.",
        },
    },
    271: {
        "question": "For the integrated method of flight instruction to be fully effective, the use of instrument reference should begin",
        "choices": {
            "A": "after the student has mastered the elements of using visual references.",
            "B": "only after collision avoidance scanning techniques have been developed.",
            "C": "the first time each new maneuver is introduced.",
        },
    },
    272: {
        "question": "Assignment of goals the student considers difficult",
        "choices": {
            "A": "usually provides a challenge and promotes learning.",
            "B": "may discourage the student and retard learning.",
            "C": "is usually appropriate for only highly motivated students.",
        },
    },
    273: {
        "question": "What systematic approach to the mental process does the pilot consistently apply to take the best course of action in a given situation?",
        "choices": {
            "A": "Aeronautical decision making.",
            "B": "Pilot judgment chain.",
            "C": "Crew resource management.",
        },
    },
    274: {
        "question": "What are the six major levels of Bloom's Taxonomy of the Cognitive Domain?",
        "choices": {
            "A": "Recall Information, Understanding, Application, Analyze, Synthesize, Evaluate.",
            "B": "Knowledge, Comprehension, Application, Analysis, Synthesis, Evaluate.",
            "C": "Define, Describe, Determine, Points Out, Create, Appraise.",
        },
    },
    275: {
        "question": "What is not a part of the PAVE acronym?",
        "choices": {
            "A": "Environment.",
            "B": "Airplane.",
            "C": "Passengers.",
        },
    },
    276: {
        "question": "What kind of test should the instructor give the student regarding airplane performance, airspace and regulations?",
        "choices": {
            "A": "Pre-solo test.",
            "B": "[truncated on source scan — choice B]",
            "C": "[truncated on source scan — choice C]",
        },
    },
}

FOOTER_RE = re.compile(
    r"(?:©\s*GPGS|O?GPGS\s+\d+|gliderpilotsgroundschool\.com|303[-–]?\s*908[-–]?\s*3147)",
    re.I,
)

TYPO_FIXES = [
    (r"\biearner\b", "learner"),
    (r"\biearning\b", "learning"),
    (r"\bfearning\b", "learning"),
    (r"\btearning\b", "learning"),
    (r"\btesson\b", "lesson"),
    (r"\bNight maneuver\b", "flight maneuver"),
    (r"\bMight maneuver\b", "flight maneuver"),
    (r"\bfing\b", "flying"),
    (r"\bfying\b", "flying"),
    (r"\bdelense\b", "defense"),
    (r"\binterlerence\b", "interference"),
    (r"\bvisibility angry\b", "visibly angry"),
    (r"\bcompiete\b", "complete"),
    (r"\bptans\b", "plans"),
    (r"\bpiateaus\b", "plateaus"),
    (r"\bnormat\b", "normal"),
    (r"\bal a specific\b", "at a specific"),
    (r"\bheips\b", "helps"),
    (r"\bwil!\b", "will"),
    (r"\bwil\b", "will"),
    (r"\bfesson\b", "lesson"),
    (r"\bFaxonomy\b", "Taxonomy"),
    (r"\bansiety\b", "anxiety"),
    (r"\bmancuser\b", "maneuver"),
    (r"\banviety\b", "anxiety"),
    (r"\befivetive\b", "effective"),
    (r"\bafier\b", "after"),
    (r"\balier\b", "after"),
]


def light_typo_fix(s: str) -> str:
    for pat, repl in TYPO_FIXES:
        s = re.sub(pat, repl, s, flags=re.I)
    return s


def ocr_image(png_path: Path, txt_base: Path) -> str:
    COLS_DIR.mkdir(parents=True, exist_ok=True)
    cmd = [str(TESSERACT), str(png_path), str(txt_base), "--psm", "6", "-l", "eng"]
    subprocess.run(cmd, check=True, capture_output=True)
    return Path(str(txt_base) + ".txt").read_text(encoding="utf-8", errors="replace")


def split_and_ocr_page(page_num: int, overlap: float = 0.02) -> tuple[str, str]:
    src = PAGES_DIR / f"page-{page_num:02d}.png"
    rot = Image.open(src).rotate(90, expand=True)
    w, h = rot.size
    mid = w // 2
    ov = int(w * overlap)
    left = rot.crop((0, 0, mid + ov, h))
    right = rot.crop((mid - ov, 0, w, h))
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
    }
    for a, b in repl.items():
        text = text.replace(a, b)
    return text


def preprocess_column(text: str, page: int, side: str) -> str:
    text = normalize_unicode(text)
    text = light_typo_fix(text)
    lines_out: list[str] = []
    for raw in text.splitlines():
        line = FOOTER_RE.sub("", raw).rstrip()
        if not line.strip():
            continue
        if re.fullmatch(r"\d{1,3}", line.strip()):
            continue
        # Strip leading margin bleed junk before a question number or choice letter
        line = re.sub(r"^[\s\|Il§`'\"]+", "", line)
        line = re.sub(r"^[:;,.\]\[\)\(]+\s*", "", line)
        # "1 162-" / "1 80-" leading stray digit before real number
        line = re.sub(r"^\d\s+(?=\d{2,3}\s*[.\-,])", "", line)
        line = re.sub(
            r"^(?:n|be|of|or|st|ly|in|y|g|ro|ng|e|a|to|la|al|le)\s+(?=\d{1,3}\s*[.\-,])",
            "",
            line,
            flags=re.I,
        )
        line = re.sub(
            r"^(?:n|be|of|or|st|ly|in|y|g|ro|ng|e|to|la|al|le|b|\]|\[|\(|\))\s+(?=[ABC]\s*[.\-,=])",
            "",
            line,
            flags=re.I,
        )
        # Short alphanumeric junk before choice: "al A-", "] B-", "ro) B-"
        line = re.sub(r"^[a-z0-9\]\[\)\(]{1,4}\s+(?=[ABC]\s*[.\-,=])", "", line, flags=re.I)
        # §6- → 56-
        line = re.sub(r"^§\s*(\d)\s*[.\-,]", r"5\1-", line)
        # 484- → 184- (page 11 right)
        if page == 11 and side == "R":
            line = re.sub(r"^484\s*[.\-,]", "184-", line)
        # page1 right 40- → 10-
        if page == 1 and side == "R":
            line = re.sub(r"^40\s*[.\-,]", "10-", line, count=1)
        # page17 left: OCR 268 at top is really 265
        if page == 17 and side == "L":
            if re.match(r"^268\s*[.\-,]\s*Which statement is true about an instructor", line):
                line = re.sub(r"^268", "265", line, count=1)
        # Only rewrite OCR "8-" → "B-" when it looks like a choice (lowercase body),
        # never when it is question 8 ("8- Which...")
        if re.match(r"^8\s*[.\-,=]\s*[a-z]", line):
            line = re.sub(r"^8\s*[.\-,=]\s*", "B- ", line)
        line = re.sub(r"^8B\s*[.\-,=]\s*", "B- ", line)
        line = re.sub(r"^BR\s*[.\-,=]\s*", "B- ", line)
        line = re.sub(r"^W\s*[.\-,=]\s*", "B- ", line)
        # C variants already normalized ©→C; also (= and C=
        line = re.sub(r"^\(=\s*", "C- ", line)
        line = re.sub(r"^C=\s*", "C- ", line)
        line = re.sub(r"^A=\s*", "A- ", line)
        line = re.sub(r"^B_\s*", "B- ", line)
        line = re.sub(r"^A\s*[~`]\s*", "A- ", line)
        line = re.sub(r"^B\s*[~`]\s*", "B- ", line)
        line = re.sub(r"^C\s*[~`]\s*", "C- ", line)
        # Collapse "B . Affective" / "A. Environment"
        line = re.sub(r"^([ABC])\s*[.\-,=]\s*", r"\1- ", line)
        # Split glued choices: "memory.C- The" / "...test. ) B- Demo" / "...turn? <) C- What"
        line = re.sub(
            r"([.!?])\s*(?:[\]\[\)\(<\|]+\s*)?([ABC])\s*[.\-,=]\s*",
            r"\1\n\2- ",
            line,
        )
        line = re.sub(
            r"\s+(?:[\]\[\)\(<\|]+\s*)?([ABC])\s*[.\-,=]\s+",
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
    q_re = re.compile(r"^\d{1,3}\s*[.\-,]\s*\S")
    c_re = re.compile(r"^[ABC]\s*[.\-,]\s*\S")
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


def parse_column_text(text: str, page: int, side: str) -> list[dict]:
    text = preprocess_column(text, page, side)
    text = join_continuations(text)

    questions: list[dict] = []
    cur: dict | None = None
    orphan_choices: dict[str, str] = {}  # B/C at top of column continuing previous Q

    for line in text.splitlines():
        line = line.strip()
        if not line or FOOTER_RE.search(line):
            continue

        qm = re.match(r"^(?P<num>\d{1,3})\s*[.\-,]\s*(?P<body>.+)$", line)
        if qm:
            num = int(qm.group("num"))
            body = qm.group("body").strip()
            # Reject absurd / choice-misread numbers (single digit mid-column often is B→8)
            if num < 1 or num > 320:
                continue
            # Lone "8- physical or mental" style: treat as B choice if we have open Q needing B
            if (
                cur is not None
                and num <= 9
                and "A" in cur["choices"]
                and "B" not in cur["choices"]
                and not body[:1].isupper() is False
            ):
                # Heuristic: if expected next Q is >> num, this is likely B OCR'd as 8
                if cur["ocr_num"] >= 100 and num < 20:
                    cur["choices"]["B"] = body
                    continue
            if cur is not None:
                questions.append(cur)
            cur = {"ocr_num": num, "page": page, "side": side, "question": body, "choices": {}}
            continue

        cm = re.match(r"^(?P<letter>[ABC])\s*[.\-,]\s*(?P<body>.*)$", line)
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

    # Split any choice values that still contain a following A-/B-/C- marker
    for q in questions:
        if q.get("orphan_continuation"):
            continue
        for letter in ("A", "B", "C"):
            body = q["choices"].get(letter)
            if not body:
                continue
            m = re.search(r"\s+(?:[\]\[\)\(<\|]+\s*)?([ABC])\s*[.\-,=]\s+(.+)$", body)
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


def clean_text(s: str) -> str:
    s = light_typo_fix(s)
    s = FOOTER_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip(" :.-")
    s = re.sub(r"^[~`'\"|]+", "", s).strip()
    return s


def merge_continuations(items: list[dict]) -> list[dict]:
    """Merge orphan B/C at column starts into previous incomplete question; drop orphans."""
    out: list[dict] = []
    for item in items:
        if item.get("orphan_continuation"):
            if out and len(out[-1].get("choices", {})) < 3:
                for k, v in item["choices"].items():
                    if k not in out[-1]["choices"]:
                        out[-1]["choices"][k] = v
            continue
        # If previous incomplete and this starts mid-stream... already handled
        out.append(item)
    return out


def renumber_sequential(parsed: list[dict]) -> list[dict]:
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
        if n < 1:
            continue
        # Discard stray single-digit OCR nums far from sequence (bleed / choice misreads)
        if n < 10 and expected >= 20 and abs(n - expected) > 5:
            # Might still be real Q8 early; only skip when far from expected
            if not item.get("choices") or len(item.get("choices", {})) < 2:
                continue
            if abs(n - expected) > 50:
                continue
        plausible = 1 <= n <= 276 and n not in used
        if plausible and abs(n - expected) <= 5:
            final = n
        elif plausible and n >= expected and abs(n - expected) <= 15:
            final = n
        elif plausible and n >= expected:
            final = n
        else:
            # Misread — use expected
            final = expected
            while final in used:
                final += 1
            if final > 276:
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
    return "foi_misc"


def apply_manual_overrides(by_num: dict[int, dict]) -> None:
    for n, ov in MANUAL_OVERRIDES.items():
        by_num[n] = {
            "num": n,
            "ocr_num": n,
            "page": by_num.get(n, {}).get("page", 0),
            "side": by_num.get(n, {}).get("side", "M"),
            "question": ov["question"],
            "choices": dict(ov["choices"]),
            "manual": True,
        }


def build_cards(questions: list[dict]) -> tuple[list[dict], dict]:
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

    apply_manual_overrides(by_num)

    cards = []
    missing_answers = []
    missing_choices = []
    truncated_choices = []
    gaps = [i for i in range(1, 277) if i not in by_num]
    found_nums = sorted(by_num.keys())

    for n in range(1, 277):
        q = by_num.get(n)
        if not q:
            continue
        letter = ANSWER_KEY.get(n)
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
                "id": f"foi_written_{n:03d}",
                "question": q["question"],
                "answer": answer,
                "choices": choices,
                "source": f"FOI written · #{n} · IMG_0002.pdf",
                "tags": ["imported", "foi_written", "multiple_choice", "cfi_g", topic_id],
                "topic_id": topic_id,
                "topic_title": topic["title"],
            }
        )

    summary = {
        "total_cards": len(cards),
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
        "manual_override_numbers": sorted(MANUAL_OVERRIDES.keys()),
        "topic_histogram": dict(Counter(c["topic_id"] for c in cards)),
    }
    return cards, summary


def load_existing_cols() -> list[dict]:
    all_q: list[dict] = []
    page_logs = []
    for page in range(1, 18):
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
    for page in range(1, 18):
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

    all_q, page_logs = load_existing_cols()
    numbered = renumber_sequential(all_q)
    cards, summary = build_cards(numbered)

    payload = {
        "track_id": "cfi_g",
        "topic_title": "FOI written question bank",
        "filename": "IMG_0002.pdf",
        "note": "OCR from GPGS FOI bank IMG_0002.pdf · 276 MC · answer key pp.18-19",
        "topics": TOPICS,
        "cards": cards,
    }
    out_json = OUT_DIR / "foi-import.json"
    out_json.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    qa = {**summary, "page_parse_log": page_logs, "output": str(out_json), "expected_total": 276}
    (OUT_DIR / "qa-summary.json").write_text(
        json.dumps(qa, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print("\n=== SUMMARY ===")
    print(f"cards: {summary['total_cards']}")
    print(f"with 3 complete choices: {summary['cards_with_3_choices']}")
    print(f"gaps: {summary['ocr_number_gaps']}")
    print(f"missing choices: {summary['missing_choice_numbers']}")
    print(f"truncated: {summary['truncated_choice_numbers']}")
    print(f"topics: {summary['topic_histogram']}")
    print(f"wrote {out_json}")


if __name__ == "__main__":
    main()
