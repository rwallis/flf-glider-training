#!/usr/bin/env python3
"""Extract FAA Computer Testing Supplement figures for CFI-G and Commercial decks.

Sources:
  CFI-G:      content/faa-supplements/flight_ground_instructor_akts.pdf
  Commercial: content/faa-supplements/commercial_akts.pdf

Writes:
  public/figures/cfi-g/figure-NN.jpg
  public/figures/commercial/figure-NN.jpg
  content/card-figures.json
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
SUPPLEMENTS_DIR = ROOT / "content" / "faa-supplements"
CARD_FIGURES_JSON = ROOT / "content" / "card-figures.json"

# Accept "(Refer to Figure 52, point 1.)" and "(Refer to figure 54. Area 2)".
REFER_RE = re.compile(
    r"\(\s*Refer to\s+(?:Fig(?:ure|ue)?|Pigure)\s+(\d+)\b[^)]*\)?",
    re.I,
)
FIGURE_LABEL_RE = re.compile(r"(?im)^\s*Figure\s+(\d+)\.\s*(.+?)\s*$")

SUPPLEMENTS = {
    "cfi_g": {
        "pdf": SUPPLEMENTS_DIR / "flight_ground_instructor_akts.pdf",
        "out_dir": ROOT / "public" / "figures" / "cfi-g",
        "url_prefix": "/figures/cfi-g",
        "import_json": ROOT / "content" / "cfi-g-import" / "cfi-g-import.json",
        "source_name": "FAA Computer Testing Supplement — Flight and Ground Instructor",
        "source_url": (
            "https://www.faa.gov/sites/faa.gov/files/training_testing/testing/"
            "supplements/flight_ground_instructor_akts.pdf"
        ),
        # Keep extracting the same set we already wire for CFI-G.
        "needed": {3, 8, 18, 19, 20, 21, 24, 30, 38, 40, 42, 44, 45, 46, 47, 54},
    },
    "commercial": {
        "pdf": SUPPLEMENTS_DIR / "commercial_akts.pdf",
        "out_dir": ROOT / "public" / "figures" / "commercial",
        "url_prefix": "/figures/commercial",
        "import_json": ROOT / "content" / "commercial-import" / "commercial-import.json",
        "source_name": "FAA Computer Testing Supplement — Commercial Pilot",
        "source_url": (
            "https://www.faa.gov/sites/faa.gov/files/training_testing/testing/"
            "supplements/commercial_akts.pdf"
        ),
        "needed": None,  # derive from import bank stems
    },
}


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
    found: dict[int, tuple[int, str]] = {}
    for i in range(doc.page_count):
        text = doc.load_page(i).get_text("text")
        for m in FIGURE_LABEL_RE.finditer(text):
            num = int(m.group(1))
            title = re.sub(r"\s+", " ", m.group(2)).strip(" .")
            found[num] = (i + 1, title)
    return found


def figures_needed_from_import(import_json: Path) -> set[int]:
    data = json.loads(import_json.read_text(encoding="utf-8"))
    needed: set[int] = set()
    for card in data.get("cards") or []:
        m = REFER_RE.search(str(card.get("question") or ""))
        if m:
            needed.add(int(m.group(1)))
    return needed


def extract_supplement(track_key: str, cfg: dict) -> tuple[dict[int, dict], list[dict]]:
    pdf_path: Path = cfg["pdf"]
    if not pdf_path.exists():
        raise SystemExit(
            f"PDF not found for {track_key}: {pdf_path}\nDownload: {cfg['source_url']}"
        )

    needed = set(cfg["needed"] or [])
    if not needed:
        needed = figures_needed_from_import(cfg["import_json"])
    if not needed:
        print(f"{track_key}: no figure-referenced cards; skipping")
        return {}, []

    doc = pymupdf.open(pdf_path)
    out_dir: Path = cfg["out_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("figure-*"):
        old.unlink(missing_ok=True)

    page_map = find_figure_pages(doc)
    missing = sorted(n for n in needed if n not in page_map)
    if missing:
        raise SystemExit(f"{track_key}: FAA PDF missing figures: {missing}")

    catalog: dict[int, dict] = {}
    for num in sorted(needed):
        page_no, title = page_map[num]
        page = doc.load_page(page_no - 1)
        out = out_dir / f"figure-{num:02d}.jpg"
        render_clip(page, page_content_clip(page), out)
        catalog[num] = {
            "number": num,
            "title": title or f"Figure {num}",
            "url": f"{cfg['url_prefix']}/figure-{num:02d}.jpg",
            "source_page": page_no,
            "track": track_key,
            "source": cfg["source_name"],
            "source_url": cfg["source_url"],
        }
        print(f"[{track_key}] Figure {num}: page {page_no} -> {out.name} — {title}")

    cards = json.loads(cfg["import_json"].read_text(encoding="utf-8")).get("cards") or []
    rows = []
    for card in cards:
        m = REFER_RE.search(str(card.get("question") or ""))
        if not m:
            continue
        num = int(m.group(1))
        fig = catalog.get(num)
        if not fig:
            continue
        rows.append(
            {
                "card_id": card["id"],
                "figure": num,
                "title": fig["title"],
                "url": fig["url"],
                "track": track_key,
            }
        )
    rows.sort(key=lambda r: r["card_id"])
    return catalog, rows


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    tracks = [only] if only else list(SUPPLEMENTS.keys())
    all_figures: list[dict] = []
    all_cards: list[dict] = []
    source_urls = []

    for track_key in tracks:
        if track_key not in SUPPLEMENTS:
            raise SystemExit(f"Unknown track '{track_key}'. Use: {', '.join(SUPPLEMENTS)}")
        cfg = SUPPLEMENTS[track_key]
        catalog, rows = extract_supplement(track_key, cfg)
        all_figures.extend(sorted(catalog.values(), key=lambda f: (f["track"], f["number"])))
        all_cards.extend(rows)
        source_urls.append(cfg["source_url"])
        print(f"[{track_key}] linked {len(rows)} cards")

    # If only one track was requested, preserve the other track's existing entries.
    if only and CARD_FIGURES_JSON.exists():
        prev = json.loads(CARD_FIGURES_JSON.read_text(encoding="utf-8"))
        keep_track = "commercial" if only == "cfi_g" else "cfi_g"
        all_figures = [
            f for f in (prev.get("figures") or []) if f.get("track") == keep_track
        ] + all_figures
        all_cards = [
            c for c in (prev.get("cards") or []) if c.get("track") == keep_track
        ] + all_cards
        for url in prev.get("source_urls") or ([] if not prev.get("source_url") else [prev["source_url"]]):
            if url and url not in source_urls:
                source_urls.append(url)

    all_figures.sort(key=lambda f: (f.get("track") or "", f.get("number") or 0))
    all_cards.sort(key=lambda r: r["card_id"])

    payload = {
        "note": (
            "Official FAA Computer Testing Supplement figures for CFI-G and Commercial. "
            "Linked from bank stems that say (Refer to Figure N.). Apply on seed."
        ),
        "source_urls": source_urls,
        "figures": all_figures,
        "cards": all_cards,
    }
    CARD_FIGURES_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(all_figures)} figure images total")
    print(f"Linked {len(all_cards)} cards -> {CARD_FIGURES_JSON}")


if __name__ == "__main__":
    main()
