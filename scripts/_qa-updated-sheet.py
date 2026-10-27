"""QA updated Downloads spreadsheet against original OCR scan stems."""
from __future__ import annotations

import importlib.util
import re
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SHEET = Path(r"C:\Users\ronwa\Downloads\cfi-g-question-bank.xlsx")
OUT = ROOT / "content" / "cfi-g-import" / "_qa-updated-sheet.md"

spec = importlib.util.spec_from_file_location("extract", ROOT / "scripts" / "extract-cfi-g-bank.py")
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)

full = (ROOT / "content" / "cfi-g-raw" / "full.txt").read_text(encoding="utf-8")
_, key_text = ex.split_sections(full)
ocr_qs = ex.parse_questions(full)
answers = ex.parse_answer_key(key_text)

wb = openpyxl.load_workbook(SHEET, data_only=True)


def load_sheet(name: str) -> dict[int, dict]:
    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    hdr = [str(h).strip() if h is not None else "" for h in rows[0]]
    out: dict[int, dict] = {}
    for r in rows[1:]:
        if r[0] is None or str(r[0]).strip() == "":
            continue
        try:
            n = int(float(str(r[0])))
        except Exception:
            continue

        def cell(i: int) -> str:
            v = r[i] if i < len(r) else None
            return "" if v is None else str(v).strip()

        def by(*names: str) -> str:
            for name in names:
                if name in hdr:
                    return cell(hdr.index(name))
            return ""

        q = by("Question")
        a = by("Choice A")
        b = by("Choice B")
        c = by("Choice C")
        k = by("Answer Key").upper()
        out[n] = {
            "question": q,
            "a": a,
            "b": b,
            "c": c,
            "key": k,
            "status": by("QA Status"),
            "complete": bool(q and a and b and c and k in "ABC"),
            "choices": sum(1 for x in (a, b, c) if x),
        }
    return out


full_sheet = load_sheet("Full with QA")
imp_sheet = load_sheet("Importable")
sheet_nos = set(full_sheet) | set(imp_sheet)
ocr_nos = set(ocr_qs)
ocr_complete = {n for n, q in ocr_qs.items() if q["parse_ok"]}
ocr_incomplete = sorted(ocr_nos - ocr_complete)

missing_from_sheet = sorted(ocr_nos - sheet_nos)
missing_from_importable = sorted(ocr_complete - set(imp_sheet))
extra_in_sheet = sorted(sheet_nos - ocr_nos)

page_chunks = re.split(r"===== PAGE (\d+) =====\n", full)
q_haystack_parts = []
for i in range(1, len(page_chunks), 2):
    if 1 <= int(page_chunks[i]) <= 26:
        q_haystack_parts.append(page_chunks[i + 1])
q_haystack = "\n".join(q_haystack_parts)


def number_evident(n: int) -> bool:
    s = str(n)
    forms = {s}
    digit_alts = {"0": "O", "1": "lI", "5": "sS", "8": "E", "9": "e"}
    for i, ch in enumerate(s):
        for rep in digit_alts.get(ch, ""):
            forms.add(s[:i] + rep + s[i + 1 :])
    for form in forms:
        if re.search(rf"(?m)^\s*{re.escape(form)}(?:\s*[-–—.]|[A-Z(])", q_haystack):
            return True
    return False


extra_evident = [n for n in extra_in_sheet if number_evident(n)]
extra_not_evident = [n for n in extra_in_sheet if not number_evident(n)]
in_full_not_imp = sorted(set(full_sheet) - set(imp_sheet))
in_imp_not_full = sorted(set(imp_sheet) - set(full_sheet))

orig_incomplete = [
    49, 50, 51, 52, 56, 115, 120, 122, 181, 184, 185, 187, 194, 390, 408, 425, 432, 433, 468, 508, 630, 661, 678, 681
]
orig_missing_key = [
    11, 21, 72, 73, 174, 175, 314, 321, 451, 471, 515, 517, 531, 571, 587, 591, 615, 641
]


def row_of(n: int):
    return imp_sheet.get(n) or full_sheet.get(n)


fixed_incomplete = []
still_inc = []
for n in orig_incomplete:
    row = row_of(n)
    if row and row["complete"]:
        fixed_incomplete.append(n)
    elif row:
        still_inc.append((n, row["choices"], row["key"] or "-", (row["question"] or "")[:50]))
    else:
        still_inc.append((n, "GONE", "", ""))

fixed_keys = []
still_keys = []
for n in orig_missing_key:
    row = row_of(n)
    if row and row["key"] in "ABC":
        fixed_keys.append((n, row["key"], "complete" if row["complete"] else f"choices={row['choices']}"))
    else:
        still_keys.append(n)

ocr_inc_fixed = [n for n in ocr_incomplete if (r := row_of(n)) and r["complete"]]
still_incomplete = []
for n in sorted(sheet_nos):
    row = row_of(n)
    if not row["complete"]:
        still_incomplete.append((n, row["choices"], row["key"] or "-", (row["question"] or "")[:55]))

nos = []
for r in wb["Importable"].iter_rows(min_row=2, values_only=True):
    if r[0] is None or str(r[0]).strip() == "":
        continue
    try:
        nos.append(int(float(str(r[0]))))
    except Exception:
        pass
dups = sorted(n for n, c in Counter(nos).items() if c > 1)

lines = [
    "CFI-G updated spreadsheet QA vs original scan",
    f"Source OCR: content/cfi-g-raw/full.txt (from IMG_0001.pdf)",
    f"Spreadsheet: {SHEET}",
    "",
    "## Counts",
    f"- OCR stems parsed: {len(ocr_nos)} (complete A/B/C parse: {len(ocr_complete)}, incomplete parse: {len(ocr_incomplete)})",
    f"- Sheet Full with QA: {len(full_sheet)}",
    f"- Sheet Importable unique: {len(imp_sheet)}",
    f"- Sheet union: {len(sheet_nos)}",
    f"- Importable complete (A/B/C + key A/B/C): {sum(1 for r in imp_sheet.values() if r['complete'])}",
    "",
    "## PRIMARY: in original scan OCR but MISSING from updated spreadsheet",
    f"Count: {len(missing_from_sheet)}",
    str(missing_from_sheet),
]
if missing_from_sheet:
    for n in missing_from_sheet:
        q = ocr_qs[n]
        lines.append(
            f"  #{n} choices={q['choices_found']} key={answers.get(n, '?')} stem={(q['question'] or '')[:70]}"
        )
else:
    lines.append("NONE — every OCR-parsed stem number appears in Full and/or Importable.")

lines += [
    "",
    "## OCR-complete stems not on Importable sheet (may still be on Full/QA Issues)",
    f"Count: {len(missing_from_importable)}",
    str(missing_from_importable),
]
for n in missing_from_importable:
    row = full_sheet.get(n)
    lines.append(
        f"  #{n} on Full={n in full_sheet} sheet_complete={row['complete'] if row else None} "
        f"ocr_key={answers.get(n, '?')} status={row['status'] if row else None}"
    )

lines += [
    "",
    "## In spreadsheet but not in OCR parser output",
    f"Count: {len(extra_in_sheet)}",
    str(extra_in_sheet),
    f"Stem-evident in OCR haystack (parser miss, user recovered): {extra_evident}",
    f"Not evident in OCR (likely added from key/elsewhere): {extra_not_evident}",
]
for n in extra_in_sheet:
    row = row_of(n)
    lines.append(
        f"  #{n} complete={row['complete']} key={row['key']} evident={number_evident(n)} "
        f"stem={(row['question'] or '')[:60]}"
    )

lines += [
    "",
    "## Full sheet rows dropped from Importable",
    str(in_full_not_imp),
    "## Importable rows not on Full sheet",
    str(in_imp_not_full),
    "",
    "## Prior incomplete-list recovery",
    f"Fixed now complete: {fixed_incomplete}",
    f"Still incomplete/missing: {still_inc}",
    f"OCR-incomplete but sheet now complete: {ocr_inc_fixed}",
    "",
    "## Prior missing-answer-key recovery",
    f"Fixed: {fixed_keys}",
    f"Still missing key: {still_keys}",
    "",
    f"## All sheet rows still incomplete: {len(still_incomplete)}",
]
for item in still_incomplete:
    lines.append(f"  {item}")

lines += ["", f"Importable duplicate Nos: {dups}"]

OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {OUT}")
print(f"missing_from_sheet={missing_from_sheet}")
print(f"extra_in_sheet={extra_in_sheet}")
print(f"fixed_incomplete={len(fixed_incomplete)} still={len(still_inc)}")
print(f"fixed_keys={len(fixed_keys)} still_keys={still_keys}")
print(f"importable_complete={sum(1 for r in imp_sheet.values() if r['complete'])}/{len(imp_sheet)}")
