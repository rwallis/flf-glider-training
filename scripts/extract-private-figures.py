#!/usr/bin/env python3
"""Extract FAA Sport/Rec/Private AKTS figures for the Private Glider bank.

GPGS IMG_0003 figure numbers do not always match the current FAA PDF numbering.
This script maps each bank figure number to the correct FAA PDF figure (by content),
renders JPGs under public/figures/private/figure-NN.jpg using the BANK number, and
updates content/card-figures.json (preserving other tracks).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "content" / "faa-supplements" / "sport_rec_private_akts.pdf"
OUT_DIR = ROOT / "public" / "figures" / "private"
IMPORT_JSON = ROOT / "content" / "private-import" / "private-import.json"
CARD_FIGURES_JSON = ROOT / "content" / "card-figures.json"
SOURCE_NAME = "FAA Computer Testing Supplement — Sport/Recreational/Private Pilot"
SOURCE_URL = (
    "https://www.faa.gov/sites/faa.gov/files/training_testing/testing/"
    "supplements/sport_rec_private_akts.pdf"
)

# Bank figure number (as cited in question stems) -> FAA PDF figure number.
BANK_TO_FAA = {
    1: 1,  # Lift Vector
    11: 11,  # Glider Yaw String
    12: 12,  # METAR
    13: 13,  # Telephone Weather Briefing
    20: 20,
    21: 21,
    22: 22,
    23: 23,
    24: 24,
    25: 25,
    26: 26,
    31: 50,  # segmented circle / wind cone (bank #31)
    34: 53,  # glider W&B
    49: 49,  # airport diagram
    50: 50,  # wind sock / segmented circle
    51: 50,  # same segmented-circle graphic in current FAA PDF
    53: 54,  # glider performance
    54: 53,  # glider W&B / CG
    55: 54,  # glider performance (L/D, sink)
    56: 55,  # standard soaring signals
    65: 65,  # U.S. airport signs
    66: 65,  # airport signs (GPGS labeled some as 66)
}

REFER_RE = re.compile(
    r"(?:\(|^)\s*Refe[rl]\s+to\s+(?:Fig(?:ure|ue)?|Pigure)\s+(\d+)\b",
    re.I | re.M,
)
FIGURE_LABEL_RE = re.compile(r"(?im)^\s*Figure\s+(\d+)\.\s*(.+?)\s*$")


def page_content_clip(page: pymupdf.Page) -> pymupdf.Rect:
    return pymupdf.Rect(page.rect.x0 + 10, 36, page.rect.x1 - 10, page.rect.y1 - 28)


def find_figure_pages(doc: pymupdf.Document) -> dict[int, tuple[int, str]]:
    found: dict[int, tuple[int, str]] = {}
    for i in range(doc.page_count):
        text = doc.load_page(i).get_text("text")
        # Prefer labels that appear as body captions (short title, not TOC dots).
        for m in FIGURE_LABEL_RE.finditer(text):
            num = int(m.group(1))
            title = re.sub(r"\s+", " ", m.group(2)).strip(" .")
            if "...." in title or len(title) > 80:
                continue
            found[num] = (i + 1, title)
    return found


def main() -> None:
    if not PDF.exists():
        raise SystemExit(f"Missing PDF: {PDF}\nDownload: {SOURCE_URL}")

    cards = json.loads(IMPORT_JSON.read_text(encoding="utf-8")).get("cards") or []
    needed_bank: set[int] = set()
    card_bank_fig: list[tuple[str, int]] = []
    for card in cards:
        m = REFER_RE.search(str(card.get("question") or ""))
        if not m:
            continue
        bank_num = int(m.group(1))
        needed_bank.add(bank_num)
        card_bank_fig.append((card["id"], bank_num))

    unmapped = sorted(n for n in needed_bank if n not in BANK_TO_FAA)
    if unmapped:
        raise SystemExit(f"No FAA remap for bank figures: {unmapped}")

    doc = pymupdf.open(PDF)
    page_map = find_figure_pages(doc)
    faa_needed = {BANK_TO_FAA[n] for n in needed_bank}
    missing = sorted(n for n in faa_needed if n not in page_map)
    if missing:
        raise SystemExit(f"FAA PDF missing figures: {missing}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("figure-*.jpg"):
        old.unlink(missing_ok=True)
    check = OUT_DIR / "_check"
    if check.exists():
        for p in check.glob("*"):
            p.unlink(missing_ok=True)
        check.rmdir()

    catalog: dict[int, dict] = {}
    for bank_num in sorted(needed_bank):
        faa_num = BANK_TO_FAA[bank_num]
        page_no, faa_title = page_map[faa_num]
        page = doc.load_page(page_no - 1)
        out = OUT_DIR / f"figure-{bank_num:02d}.jpg"
        clip = page_content_clip(page)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2.0, 2.0), clip=clip, alpha=False)
        pix.save(str(out), jpg_quality=85)
        title = faa_title or f"Figure {faa_num}"
        if bank_num != faa_num:
            title = f"{title} (FAA Fig. {faa_num}; bank Fig. {bank_num})"
        catalog[bank_num] = {
            "number": bank_num,
            "title": title,
            "url": f"/figures/private/figure-{bank_num:02d}.jpg",
            "source_page": page_no,
            "faa_figure": faa_num,
            "track": "private",
            "source": SOURCE_NAME,
            "source_url": SOURCE_URL,
        }
        print(f"bank Fig {bank_num} <- FAA Fig {faa_num} p{page_no} -> {out.name} — {faa_title}")

    rows = []
    for card_id, bank_num in card_bank_fig:
        fig = catalog.get(bank_num)
        if not fig:
            continue
        rows.append(
            {
                "card_id": card_id,
                "figure": bank_num,
                "title": fig["title"],
                "url": fig["url"],
                "track": "private",
            }
        )
    rows.sort(key=lambda r: r["card_id"])

    prev = {}
    if CARD_FIGURES_JSON.exists():
        prev = json.loads(CARD_FIGURES_JSON.read_text(encoding="utf-8"))
    figures = [f for f in (prev.get("figures") or []) if f.get("track") != "private"]
    figures.extend(sorted(catalog.values(), key=lambda f: f["number"]))
    card_rows = [c for c in (prev.get("cards") or []) if c.get("track") != "private"]
    card_rows.extend(rows)
    source_urls = []
    for url in prev.get("source_urls") or []:
        if url and url not in source_urls:
            source_urls.append(url)
    if SOURCE_URL not in source_urls:
        source_urls.append(SOURCE_URL)

    figures.sort(key=lambda f: (f.get("track") or "", f.get("number") or 0))
    card_rows.sort(key=lambda r: r["card_id"])
    payload = {
        "note": (
            "Official FAA Computer Testing Supplement figures for CFI-G, Commercial, and Private. "
            "Private bank figure numbers follow GPGS stems; some map to a different FAA figure number "
            "when the current Sport/Rec/Private AKTS renumbered plates. Apply on seed."
        ),
        "source_urls": source_urls,
        "figures": figures,
        "cards": card_rows,
    }
    CARD_FIGURES_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Linked {len(rows)} private cards; wrote {len(catalog)} private figure images")
    print(f"Updated {CARD_FIGURES_JSON}")


if __name__ == "__main__":
    main()
