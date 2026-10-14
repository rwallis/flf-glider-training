#!/usr/bin/env python3
"""Extract GPGS CFI-G computer-testing figures from the scanned bank PDF.

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
DEFAULT_PDF = Path(r"C:\Users\ronwa\OneDrive\Documents\2026_10_13\IMG_0001.pdf")
OUT_DIR = ROOT / "public" / "figures" / "cfi-g"
IMPORT_JSON = ROOT / "content" / "cfi-g-import" / "cfi-g-import.json"
CARD_FIGURES_JSON = ROOT / "content" / "card-figures.json"

# Pages in the GPGS scan that hold the computer-testing supplement figures.
FIGURE_PAGE_INDEXES = range(26, 35)  # 1-based pages 27–35

# OCR often fails on sectional pages; force whole-page crops.
PAGE_FORCE_FIGURE = {
    33: 44,  # 1-based page -> figure number
    34: 45,
    35: 46,
}

FIGURE_TITLES = {
    3: "Aviation Routine Weather Reports (METAR)",
    8: "Surface Analysis Chart Symbols",
    18: "Stall speed vs. Load factor chart",
    19: "Angle of Attack vs. Lift chart",
    20: "Drag Chart",
    21: "Aspect Ratio",
    24: "Density Altitude Chart",
    30: "Wind Component Chart",
    38: "Glider Cross-Country",
    40: "Wind Triangle",
    42: "VOR Indicators — OBS set to 180°",
    44: "Sectional Chart Excerpt",
    45: "Sectional Chart Excerpt",
    46: "Sectional Chart Excerpt",
    47: "Class C Airspace Diagram",
    54: "Traffic Pattern Indicator",
}

REFER_RE = re.compile(
    r"\(\s*Refer to\s+(?:Fig(?:ure|ue)?|Pigure)\s+(\d+)\s*\.?\)",
    re.I,
)


def find_figure_captions(page: pymupdf.Page) -> list[tuple[int, pymupdf.Rect, str]]:
    """Return (figure_number, caption_rect, raw_label) sorted top-to-bottom."""
    text_dict = page.get_text("dict")
    found: list[tuple[int, pymupdf.Rect, str]] = []
    for block in text_dict.get("blocks", []):
        for line in block.get("lines", []):
            line_text = "".join(span.get("text", "") for span in line.get("spans", [])).strip()
            if not line_text:
                continue
            m = re.match(
                r"(?i)^\s*(?:Figure|FIGURE|Figue|Flgure|Fig\.?)\s*[,\.]?\s*(\d+)\b(.*)$",
                line_text,
            )
            if not m:
                continue
            num = int(m.group(1))
            xs = []
            ys = []
            for span in line.get("spans", []):
                bbox = span.get("bbox") or [0, 0, 0, 0]
                xs.extend([bbox[0], bbox[2]])
                ys.extend([bbox[1], bbox[3]])
            if not xs:
                continue
            rect = pymupdf.Rect(min(xs), min(ys), max(xs), max(ys))
            found.append((num, rect, line_text))

    # Deduplicate by figure number (keep uppermost caption).
    by_num: dict[int, tuple[int, pymupdf.Rect, str]] = {}
    for item in sorted(found, key=lambda x: x[1].y0):
        if item[0] not in by_num:
            by_num[item[0]] = item
    return sorted(by_num.values(), key=lambda x: x[1].y0)


def page_content_clip(page: pymupdf.Page) -> pymupdf.Rect:
    """Full supplement page minus header/footer chrome (GPGS pages mix side-by-side figures)."""
    return pymupdf.Rect(
        page.rect.x0 + 12,
        58,
        page.rect.x1 - 12,
        page.rect.y1 - 40,
    )


def render_clip(page: pymupdf.Page, clip: pymupdf.Rect, out_path: Path, zoom: float = 1.7) -> None:
    mat = pymupdf.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # JPEG keeps the repo/deploy size reasonable for scanned chart pages.
    pix.save(str(out_path), jpg_quality=78)


def extract_figures(pdf_path: Path) -> dict[int, dict]:
    doc = pymupdf.open(pdf_path)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Clear prior PNG/JPG extracts so we do not leave stale formats behind.
    for old in OUT_DIR.glob('figure-*'):
        old.unlink(missing_ok=True)
    catalog: dict[int, dict] = {}

    for page_index in FIGURE_PAGE_INDEXES:
        page = doc.load_page(page_index)
        page_no = page_index + 1
        captions = find_figure_captions(page)
        nums = [c[0] for c in captions]
        force_num = PAGE_FORCE_FIGURE.get(page_no)
        if force_num and force_num not in nums:
            nums.append(force_num)

        if not nums:
            print(f"page {page_no}: no figures detected")
            continue

        clip = page_content_clip(page)
        # One page image per figure number on that page (side-by-side layouts stay intact).
        for num in sorted(set(nums)):
            url_path = f"/figures/cfi-g/figure-{num:02d}.jpg"
            out = OUT_DIR / f"figure-{num:02d}.jpg"
            render_clip(page, clip, out)
            label = next((c[2] for c in captions if c[0] == num), "")
            title = FIGURE_TITLES.get(num)
            if not title and label:
                rest = re.sub(
                    r"(?i)^\s*(?:Figure|FIGURE|Figue|Flgure|Fig\.?)\s*[,\.]?\s*\d+\s*[-–.]?\s*",
                    "",
                    label,
                ).strip(" .-")
                title = rest or f"Figure {num}"
            if not title:
                title = f"Figure {num}"
            catalog[num] = {
                "number": num,
                "title": title,
                "url": url_path,
                "source_page": page_no,
            }
            print(f"page {page_no}: Figure {num} -> {out.name}")

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
        raise SystemExit(f"PDF not found: {pdf}")
    print(f"Extracting figures from {pdf}")
    catalog = extract_figures(pdf)
    rows = build_card_figure_map(catalog)
    payload = {
        "note": "GPGS CFI-G computer-testing supplement figures linked from bank stems. Apply on seed.",
        "figures": sorted(catalog.values(), key=lambda f: f["number"]),
        "cards": rows,
    }
    CARD_FIGURES_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(catalog)} figure images under {OUT_DIR}")
    print(f"Linked {len(rows)} cards -> {CARD_FIGURES_JSON}")


if __name__ == "__main__":
    main()
