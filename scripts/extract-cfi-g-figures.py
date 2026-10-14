#!/usr/bin/env python3
"""Extract CFI-G testing figures from the official FAA AKTS PDF.

Default source:
  https://www.faa.gov/sites/faa.gov/files/training_testing/testing/supplements/flight_ground_instructor_akts.pdf

Writes:
  public/figures/cfi-g/figure-NN.jpg
  content/card-figures.json  (card_id -> figure metadata)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import pymupdf
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pymupdf required: pip install pymupdf") from exc

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "content" / "faa-supplements" / "flight_ground_instructor_akts.pdf"
OUT_DIR = ROOT / "public" / "figures" / "cfi-g"
IMPORT_JSON = ROOT / "content" / "cfi-g-import" / "cfi-g-import.json"
CARD_FIGURES_JSON = ROOT / "content" / "card-figures.json"

FAA_SOURCE_URL = (
    "https://www.faa.gov/sites/faa.gov/files/training_testing/testing/"
    "supplements/flight_ground_instructor_akts.pdf"
)

# Figures referenced by the imported CFI-G bank (plus common neighbors on those pages).
NEEDED_FIGURES = {3, 8, 18, 19, 20, 21, 24, 30, 38, 40, 42, 44, 45, 46, 47, 54}

REFER_RE = re.compile(
    r"\(\s*Refer to\s+(?:Fig(?:ure|ue)?|Pigure)\s+(\d+)\s*\.?\)",
    re.I,
)
FIGURE_LABEL_RE = re.compile(
    r"(?im)^\s*Figure\s+(\d+)\.\s*(.+?)\s*$"
)


def page_content_clip(page: pymupdf.Page) -> pymupdf.Rect:
    return pymupdf.Rect(
        page.rect.x0 + 10,
        36,
        page.rect.x1 - 10,
        page.rect.y1 - 28,
    )


def render_clip(page: pymupdf.Page, clip: pymupdf.Rect, out_path: Path, zoom: float = 2.0) -> None:
    mat = pymupdf.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pix.save(str(out_path), jpg_quality=85)


def find_figure_pages(doc: pymupdf.Document) -> dict[int, tuple[int, str]]:
    """Map figure number -> (1-based page, title). Prefer later pages (skip TOC)."""
    found: dict[int, tuple[int, str]] = {}
    for i in range(doc.page_count):
        text = doc.load_page(i).get_text("text")
        for m in FIGURE_LABEL_RE.finditer(text):
            num = int(m.group(1))
            title = re.sub(r"\s+", " ", m.group(2)).strip(" .")
            # TOC pages list many figures; real figure pages overwrite with later hits.
            found[num] = (i + 1, title)
    return found


def extract_figures(pdf_path: Path) -> dict[int, dict]:
    doc = pymupdf.open(pdf_path)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("figure-*"):
        old.unlink(missing_ok=True)

    page_map = find_figure_pages(doc)
    catalog: dict[int, dict] = {}

    missing = sorted(n for n in NEEDED_FIGURES if n not in page_map)
    if missing:
        raise SystemExit(f"FAA PDF missing figures: {missing}")

    for num in sorted(NEEDED_FIGURES):
        page_no, title = page_map[num]
        page = doc.load_page(page_no - 1)
        out = OUT_DIR / f"figure-{num:02d}.jpg"
        render_clip(page, page_content_clip(page), out)
        catalog[num] = {
            "number": num,
            "title": title or f"Figure {num}",
            "url": f"/figures/cfi-g/figure-{num:02d}.jpg",
            "source_page": page_no,
            "source": "FAA Computer Testing Supplement — Flight and Ground Instructor",
            "source_url": FAA_SOURCE_URL,
        }
        print(f"Figure {num}: page {page_no} -> {out.name} — {title}")

    return catalog


def build_card_figure_map(catalog: dict[int, dict]) -> list[dict]:
    cards = json.loads(IMPORT_JSON.read_text(encoding="utf-8")).get("cards") or []
    rows = []
    missing_figs: set[int] = set()
    for card in cards:
        m = REFER_RE.search(str(card.get("question") or ""))
        if not m:
            continue
        num = int(m.group(1))
        fig = catalog.get(num)
        if not fig:
            missing_figs.add(num)
            continue
        rows.append(
            {
                "card_id": card["id"],
                "figure": num,
                "title": fig["title"],
                "url": fig["url"],
            }
        )
    if missing_figs:
        print("WARNING: referenced figures not extracted:", sorted(missing_figs))
    rows.sort(key=lambda r: r["card_id"])
    return rows


def main() -> None:
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf.exists():
        raise SystemExit(
            f"PDF not found: {pdf}\n"
            f"Download: {FAA_SOURCE_URL}\n"
            f"Save as: {DEFAULT_PDF}"
        )
    print(f"Extracting FAA figures from {pdf}")
    catalog = extract_figures(pdf)
    rows = build_card_figure_map(catalog)
    payload = {
        "note": (
            "Official FAA Computer Testing Supplement figures for Flight/Ground Instructor. "
            "Linked from CFI-G bank stems that say (Refer to Figure N.). Apply on seed."
        ),
        "source_url": FAA_SOURCE_URL,
        "figures": sorted(catalog.values(), key=lambda f: f["number"]),
        "cards": rows,
    }
    CARD_FIGURES_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(catalog)} figure images under {OUT_DIR}")
    print(f"Linked {len(rows)} cards -> {CARD_FIGURES_JSON}")


if __name__ == "__main__":
    main()
