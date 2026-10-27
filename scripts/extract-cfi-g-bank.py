"""
Extract CFI-G question bank from scanned GPGS PDF OCR text → CSV spreadsheet + QA report.

Usage:
  python scripts/extract-cfi-g-bank.py [path/to/IMG_0001.pdf]
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import pymupdf
except ImportError:  # pragma: no cover
    pymupdf = None

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path(r"C:\Users\ronwa\OneDrive\Documents\2026_10_13\IMG_0001.pdf")
OUT_DIR = ROOT / "content" / "cfi-g-import"
RAW_DIR = ROOT / "content" / "cfi-g-raw"

HEADER_RE = re.compile(
    r"(?im)^(?:Glider Pilots Ground School.*|Flight\s*lnstructor Glider.*|"
    r"Flight Instructor Glider.*|@?GPGS.*|www\..*|gliderpilotsgroundschool\.com|"
    r"303-908-3147|Computer Testing Supplement.*|O gpgs.*|\d{1,3}\s*$|"
    r"Refer to Chapter 17.*|16\.\s*FLIGHT INSTRUCTOR.*)$"
)

# Hyphen form is the bank default (1- …). Period form used on some late pages (681.).
# Space after the delimiter is optional (OCR often yields "656-Action").
# Lookahead nums must NOT include B/C (those are choice letters: "B- longitudinal").
_NUM_CAPT = r"[0-9lI|SsEe]"
_NUM_NEXT = r"[0-9lI|]"
Q_START_HYPHEN_RE = re.compile(
    rf"(?m)(?P<num>{_NUM_CAPT}{{1,3}})\s*[-–—]\s*"
    rf"(?P<body>.+?)(?=(?:\n{_NUM_NEXT}{{1,3}}\s*[-–—]\s*)|\Z)",
    re.S,
)
Q_START_DOT_RE = re.compile(
    rf"(?m)(?P<num>{_NUM_CAPT}{{3}})\s*\.\s*"
    rf"(?P<body>.+?)(?=(?:\n{_NUM_NEXT}{{1,3}}\s*[-–—.]\s*)|\Z)",
    re.S,
)
# OCR sometimes drops the delimiter entirely: "676Human behavior"
Q_START_GLUED_RE = re.compile(
    rf"(?m)(?P<num>\d{{3}})(?=[A-Z(])"
    rf"(?P<body>.+?)(?=(?:\n(?:{_NUM_NEXT}{{1,3}}\s*[-–—.]\s*|\d{{3}}[A-Z(]))|\Z)",
    re.S,
)

CHOICE_SPLIT_RE = re.compile(
    r"(?m)^\s*(?P<letter>[ABC])\s*[-–—:.]+\s*(?P<text>.+?)(?=(?:\n\s*[ABC]\s*[-–—:.]+\s*)|\Z)",
    re.S,
)


def ocr_digit_token(token: str) -> str | None:
    """Fix common OCR mistakes in answer-key question numbers."""
    t = token.strip()
    if not t:
        return None
    # strip trailing punctuation leftovers
    t = t.rstrip(".,;")
    # map OCR glyphs commonly used for digits
    out = []
    for ch in t:
        if ch.isdigit():
            out.append(ch)
        elif ch in "lI|i!":
            out.append("1")
        elif ch in "Oo":
            out.append("0")
        elif ch in "Ss":
            out.append("5")
        elif ch in "Bb":
            out.append("8")
        elif ch == "E":
            out.append("8")
        elif ch == "e":
            out.append("9")
        elif ch in "Zz":
            out.append("2")
        elif ch in "g":
            out.append("9")
        elif ch in "rRtT":
            # leading r/t often OCR of 1 (r29→129, t41→141)
            if not out:
                out.append("1")
            else:
                return None
        else:
            return None
    if not out:
        return None
    n = int("".join(out))
    if 1 <= n <= 750:
        return str(n)
    return None


def ocr_answer_letter(raw: str) -> str | None:
    s = raw.strip().upper()
    if not s:
        return None
    s = s.replace(" ", "")
    # G often OCR of C; 0 of O unused; X means not on test
    if s in {"A", "B", "C", "X"}:
        return s
    if s in {"G"}:
        return "C"
    if s.startswith(("A", "B", "C", "X")):
        return s[0]
    return None


def clean_text(s: str) -> str:
    s = s.replace("\r", "\n")
    s = HEADER_RE.sub("", s)
    # join hyphenated line wraps: word-\nword → wordword (OCR often breaks mid-word)
    s = re.sub(r"(\w)-\n(\w)", r"\1\2", s)
    # collapse newlines inside paragraphs to spaces
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n+", "\n", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


def normalize_choice_text(s: str) -> str:
    s = clean_text(s)
    s = re.sub(r"\s+", " ", s).strip()
    # trim trailing junk punctuation duplication
    s = s.strip(" -–—")
    return s


def extract_pdf_text(pdf_path: Path) -> str:
    if pymupdf is None:
        raise SystemExit("pymupdf required")
    doc = pymupdf.open(pdf_path)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    parts = []
    for i, page in enumerate(doc):
        t = page.get_text("text")
        (RAW_DIR / f"page-{i + 1:02d}.txt").write_text(t, encoding="utf-8")
        parts.append(f"===== PAGE {i + 1} =====\n{t}")
    full = "\n".join(parts)
    (RAW_DIR / "full.txt").write_text(full, encoding="utf-8")
    return full


def split_sections(full: str) -> tuple[str, str]:
    m = re.search(r"(?i)ANSWER\s+KEY\b", full)
    if not m:
        return full, ""
    return full[: m.start()], full[m.start() :]


def parse_questions(full: str) -> dict[int, dict]:
    """Parse questions from PDF pages 1–26 only (skip figures + answer key)."""
    page_chunks = re.split(r"===== PAGE (\d+) =====\n", full)
    q_pages = []
    for i in range(1, len(page_chunks), 2):
        n = int(page_chunks[i])
        if 1 <= n <= 26:
            q_pages.append(page_chunks[i + 1])
    question_text = "\n".join(q_pages)

    lines = []
    for line in question_text.splitlines():
        if HEADER_RE.match(line.strip()):
            continue
        lines.append(line)
    body = "\n".join(lines)
    # Normalize spaced OCR numbers like "I l-" / "l 0-" before split
    body = re.sub(
        r"(?m)^(?P<a>[0-9lI|])\s+(?P<b>[0-9lI|])\s*([-–—.])",
        lambda m: f"{ocr_digit_token(m.group('a') + m.group('b')) or (m.group('a') + m.group('b'))}{m.group(3)}",
        body,
    )

    def absorb(matches, min_num: int = 1):
        for m in matches:
            num_s = ocr_digit_token(m.group("num").replace(" ", ""))
            if not num_s:
                continue
            num = int(num_s)
            if num < min_num:
                continue
            chunk = m.group("body").strip()
            cm = re.search(r"(?m)^\s*[ABC]\s*[-–—:.]+", chunk)
            if not cm:
                row = {
                    "no": num,
                    "question": normalize_choice_text(chunk),
                    "choice_a": "",
                    "choice_b": "",
                    "choice_c": "",
                    "choices_found": 0,
                    "parse_ok": False,
                    "issue": "no_choices_found",
                }
            else:
                qtext = normalize_choice_text(chunk[: cm.start()])
                choice_blob = chunk[cm.start() :]
                choice_blob = re.sub(r"(?m)^\s*8\s*[.]", "B.", choice_blob)
                choice_blob = re.sub(r"(?m)^\s*[cC]\s*[.]", "C.", choice_blob)
                choice_blob = re.sub(r"(?m)^\s*[aA]\s*[.]", "A.", choice_blob)
                choice_blob = re.sub(r"(?m)^\s*[bB]\s*[.]", "B.", choice_blob)
                choices = {"A": "", "B": "", "C": ""}
                for cm2 in CHOICE_SPLIT_RE.finditer(choice_blob):
                    letter = cm2.group("letter").upper()
                    choices[letter] = normalize_choice_text(cm2.group("text"))
                found = sum(1 for k in "ABC" if choices[k])
                issue = ""
                if found < 3:
                    issue = f"missing_choices:{found}/3"
                elif not qtext:
                    issue = "empty_question"
                row = {
                    "no": num,
                    "question": qtext,
                    "choice_a": choices["A"],
                    "choice_b": choices["B"],
                    "choice_c": choices["C"],
                    "choices_found": found,
                    "parse_ok": found == 3 and bool(qtext),
                    "issue": issue,
                }
            prev = questions.get(num)
            # Never replace a complete question with a later OCR collision.
            if prev and prev.get("parse_ok"):
                continue
            # Prefer a complete parse over an incomplete one.
            if prev and not row["parse_ok"]:
                continue
            questions[num] = row

    questions: dict[int, dict] = {}
    absorb(Q_START_HYPHEN_RE.finditer(body), min_num=1)
    absorb(Q_START_DOT_RE.finditer(body), min_num=100)
    absorb(Q_START_GLUED_RE.finditer(body), min_num=100)
    return questions


def parse_answer_key(key_text: str) -> dict[int, str]:
    answers: dict[int, str] = {}
    # Match patterns like 128) C   l28) C   162\ c   1)A   6rt A (missing paren)
    for m in re.finditer(
        r"(?m)(?P<num>[0-9lI|OoSsBbEegrRtT]{1,3})\s*[)\\/]?\s*(?P<ans>[ABCXGOabcxg])(?:\b|$)",
        key_text,
    ):
        num = ocr_digit_token(m.group("num"))
        ans = ocr_answer_letter(m.group("ans"))
        if num and ans:
            n = int(num)
            prev = answers.get(n)
            # Prefer a real A/B/C over an earlier OCR false "X" (e.g. "2) X" before "2)B").
            if prev is None or (prev == "X" and ans in {"A", "B", "C"}):
                answers[n] = ans
    return answers


def letter_to_choice(row: dict, letter: str) -> str:
    return {
        "A": row["choice_a"],
        "B": row["choice_b"],
        "C": row["choice_c"],
    }.get(letter, "")


def main() -> None:
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf.exists():
        raise SystemExit(f"PDF not found: {pdf}")

    print(f"Reading {pdf}")
    full = extract_pdf_text(pdf)
    _q_text, key_text = split_sections(full)
    questions = parse_questions(full)
    answers = parse_answer_key(key_text)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    qa = {
        "source_pdf": str(pdf),
        "questions_parsed": len(questions),
        "answer_key_entries": len(answers),
        "complete_importable": 0,
        "missing_from_scan": [],
        "missing_likely_false_key_ocr": [],
        "intentional_gaps_not_on_test": [],
        "incomplete_choices": [],
        "missing_answer_key": [],
        "answer_key_x_not_on_test": [],
        "answer_key_without_question": [],
        "parse_issues": [],
        "recovered_this_pass": [],
    }

    # Build searchable question-page text for evidence checks
    page_chunks = re.split(r"===== PAGE (\d+) =====\n", full)
    q_page_text = []
    for i in range(1, len(page_chunks), 2):
        if 1 <= int(page_chunks[i]) <= 26:
            q_page_text.append(page_chunks[i + 1])
    q_haystack = "\n".join(q_page_text)

    def number_evident_in_scan(n: int) -> bool:
        """True if OCR text has a plausible question-start for n (incl. common OCR forms)."""
        s = str(n)
        forms = {s}
        # Single-position OCR substitutions only (avoid 388 → 3EE false positives).
        digit_alts = {"0": "O", "1": "lI", "5": "sS", "8": "E", "9": "e"}
        for i, ch in enumerate(s):
            for rep in digit_alts.get(ch, ""):
                forms.add(s[:i] + rep + s[i + 1 :])
        for form in forms:
            if re.search(
                rf"(?m)^\s*{re.escape(form)}(?:\s*[-–—.]|[A-Z(])",
                q_haystack,
            ):
                return True
        return False

    # Answer-key numbers with A/B/C but no parsed question — bank is NOT always consecutive.
    for n, key in sorted(answers.items()):
        if n in questions:
            continue
        if key == "X":
            qa["intentional_gaps_not_on_test"].append(n)
            continue
        if key not in {"A", "B", "C"}:
            continue
        if number_evident_in_scan(n):
            qa["missing_from_scan"].append(n)  # in scan but parser still failed
        else:
            # No stem evidence: usually answer-key OCR collision or intentional skip.
            qa["missing_likely_false_key_ocr"].append({"no": n, "key": key})

    for n in sorted(questions):
        q = questions[n]
        key = answers.get(n, "")
        correct = letter_to_choice(q, key) if key in {"A", "B", "C"} else ""
        status = "ok"
        if not q["parse_ok"]:
            status = q["issue"] or "parse_fail"
            qa["incomplete_choices"].append(n)
            qa["parse_issues"].append({"no": n, "issue": status})
        elif key == "X":
            status = "not_on_test_X"
            qa["answer_key_x_not_on_test"].append(n)
        elif not key:
            status = "missing_answer_key"
            qa["missing_answer_key"].append(n)
        elif not correct:
            status = "answer_letter_not_mapped"
            qa["parse_issues"].append({"no": n, "issue": status, "key": key})
        else:
            qa["complete_importable"] += 1

        rows.append(
            {
                "No.": n,
                "Topic": "CFI-G written bank",
                "Question": q["question"],
                "Choice A": q["choice_a"],
                "Choice B": q["choice_b"],
                "Choice C": q["choice_c"],
                "Answer Key": key,
                "Correct Answer": correct,
                "Source PDF": pdf.name,
                "Track": "cfi_g",
                "QA Status": status,
                "Choices Found": q["choices_found"],
            }
        )

    for n, key in sorted(answers.items()):
        if n not in questions:
            qa["answer_key_without_question"].append({"no": n, "key": key})

    # CSV for app upload (importable rows only + also full with status)
    csv_all = OUT_DIR / "cfi-g-question-bank.csv"
    csv_import = OUT_DIR / "cfi-g-question-bank-importable.csv"
    fields = [
        "No.",
        "Topic",
        "Question",
        "Choice A",
        "Choice B",
        "Choice C",
        "Answer Key",
        "Correct Answer",
        "Source PDF",
        "Track",
        "QA Status",
        "Choices Found",
    ]
    with csv_all.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    importable = [r for r in rows if r["QA Status"] == "ok"]
    with csv_import.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "No.",
                "Topic",
                "Question",
                "Choice A",
                "Choice B",
                "Choice C",
                "Answer Key",
                "Correct Answer",
                "Source PDF",
            ],
        )
        w.writeheader()
        for r in importable:
            w.writerow({k: r[k] for k in w.fieldnames})

    # Also write JSON cards ready for API
    cards = []
    for r in importable:
        choices = [r["Choice A"], r["Choice B"], r["Choice C"]]
        cards.append(
            {
                "id": f"cfi_g_bank_{int(r['No.']):03d}",
                "question": r["Question"],
                "answer": r["Correct Answer"],
                "choices": choices,
                "source": f"CFI-G bank #{r['No.']} · {pdf.name}",
                "tags": ["imported", "cfi_g", "multiple_choice"],
            }
        )
    (OUT_DIR / "cfi-g-import.json").write_text(
        json.dumps(
            {
                "track_id": "cfi_g",
                "topic_title": "CFI-G written question bank",
                "filename": pdf.name,
                "note": "Extracted from scanned GPGS Flight Instructor Glider question bank",
                "cards": cards,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    # Human QA report
    false_key = qa["missing_likely_false_key_ocr"]
    report_lines = [
        "# CFI-G scan QA report",
        "",
        f"- Source: `{pdf}`",
        f"- Questions parsed from OCR: **{qa['questions_parsed']}**",
        f"- Answer-key entries parsed: **{qa['answer_key_entries']}**",
        f"- Complete importable (question + A/B/C + answer key A/B/C): **{qa['complete_importable']}**",
        "",
        "## Gaps / issues",
        "",
        f"- Incomplete A/B/C choices: **{len(qa['incomplete_choices'])}** → {qa['incomplete_choices'][:40]}",
        f"- Questions missing answer key: **{len(qa['missing_answer_key'])}** → {qa['missing_answer_key'][:40]}",
        f"- Parsed questions with answer key X (not on FAA CFI glider test): **{len(qa['answer_key_x_not_on_test'])}**",
        f"- Still missing stems that appear to be in the OCR text: **{len(qa['missing_from_scan'])}** → {qa['missing_from_scan'][:60]}",
        f"- Answer-key A/B/C with no stem evidence (likely key OCR collision or non-consecutive skip): **{len(false_key)}**",
        f"- Answer-key X with no stem (intentional non-consecutive / not on test): **{len(qa['intentional_gaps_not_on_test'])}**",
        "",
        "### Note on numbering",
        "The bank is **not always consecutive**. Many gaps are intentional (`X` in the answer key = not currently on the FAA CFI-G test).",
        "Other “missing” numbers are often answer-key OCR misreads (e.g. `2) X` colliding with `2)B`), not absent pages.",
        "",
        "## Outputs",
        "",
        f"- Excel workbook: `{OUT_DIR / 'cfi-g-question-bank.xlsx'}` (also copied next to the PDF)",
        f"- Full CSV (with QA Status): `{csv_all}`",
        f"- Importable CSV: `{csv_import}`",
        f"- JSON cards: `{OUT_DIR / 'cfi-g-import.json'}`",
        "",
        "### Note on OCR",
        "Scanner OCR has character errors (e.g. tum→turn, ainpeed→airspeed). Importable rows are structurally complete;",
        "spot-check wording against the PDF before relying on them for checkride prep.",
        "",
    ]
    if qa["missing_from_scan"]:
        report_lines += ["## Still missing (stem evidence in OCR, parser failed)", ""]
        for n in qa["missing_from_scan"]:
            report_lines.append(f"- #{n} key={answers.get(n)}")
        report_lines.append("")
    if false_key:
        report_lines += [
            "## Answer key A/B/C with no stem in scan (probably false key OCR / non-consecutive)",
            "",
        ]
        report_lines.append(
            ", ".join(f"#{x['no']}={x['key']}" for x in false_key[:80])
            + (" …" if len(false_key) > 80 else "")
        )
        report_lines.append("")
    if qa["incomplete_choices"]:
        report_lines += ["## Incomplete choice sets", ""]
        for n in qa["incomplete_choices"][:80]:
            q = questions[n]
            report_lines.append(
                f"- #{n}: found {q['choices_found']}/3 — {q['question'][:80]!r}"
            )
        report_lines.append("")

    report_path = OUT_DIR / "QA-REPORT.md"
    report_path.write_text("\n".join(report_lines), encoding="utf-8")
    (OUT_DIR / "qa-summary.json").write_text(json.dumps(qa, indent=2), encoding="utf-8")

    # Copy importable CSV to the scan folder for easy access
    user_dir = pdf.parent
    user_csv = user_dir / "cfi-g-question-bank-importable.csv"
    user_all = user_dir / "cfi-g-question-bank-full-with-qa.csv"
    user_csv.write_text(csv_import.read_text(encoding="utf-8"), encoding="utf-8")
    user_all.write_text(csv_all.read_text(encoding="utf-8"), encoding="utf-8")
    (user_dir / "cfi-g-QA-REPORT.md").write_text(report_path.read_text(encoding="utf-8"), encoding="utf-8")

    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in qa.items()}, indent=2))
    print(f"Wrote {csv_all}")
    print(f"Wrote {csv_import} ({len(importable)} rows)")
    print(f"Wrote {report_path}")
    print(f"Also copied CSVs + report to {user_dir}")


if __name__ == "__main__":
    main()
