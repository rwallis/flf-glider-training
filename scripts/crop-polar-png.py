"""Crop sgs-233-polar.png tightly to the POH graph (drop chrome + top whitespace)."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "aircraft" / "sgs-233-polar.png"
FULL = ROOT / "public" / "aircraft" / "sgs-233-polar-full.png"


def largest_run(idxs):
    runs = []
    start = prev = int(idxs[0])
    for y in idxs[1:]:
        y = int(y)
        if y == prev + 1:
            prev = y
        else:
            runs.append((start, prev))
            start = prev = y
    runs.append((start, prev))
    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return runs[0]


def main():
    source = Image.open(FULL if FULL.exists() else SRC).convert("RGB")
    arr = np.asarray(source)
    h, w = arr.shape[:2]

    white = (arr[:, :, 0] > 245) & (arr[:, :, 1] > 245) & (arr[:, :, 2] > 245)
    content = ~white
    row_counts = content.sum(axis=1)
    col_counts = content.sum(axis=0)

    # Top browser/Acrobat toolbar only (contiguous from y=0).
    top_chrome_end = 0
    for y in range(min(40, h)):
        if row_counts[y] >= int(w * 0.75):
            top_chrome_end = y + 1
        else:
            break

    # Bottom viewer chrome (contiguous from bottom).
    bottom_chrome_start = h
    for y in range(h - 1, max(h - 80, 0), -1):
        if row_counts[y] >= int(w * 0.55):
            bottom_chrome_start = y
        else:
            break

    usable = content.copy()
    usable[:top_chrome_end, :] = False
    usable[bottom_chrome_start:, :] = False

    row_counts_u = usable.sum(axis=1)
    col_counts_u = usable.sum(axis=0)
    row_thresh = max(30, int(w * 0.05))
    col_thresh = max(30, int((bottom_chrome_start - top_chrome_end) * 0.08))

    good_cols = np.where(col_counts_u >= col_thresh)[0]
    good_rows = np.where(row_counts_u >= row_thresh)[0]
    if len(good_cols) == 0 or len(good_rows) == 0:
        raise SystemExit("no chart region found")

    x0, x1 = largest_run(good_cols)
    y0, y1 = largest_run(good_rows)

    pad = 4
    box = (
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(w, x1 + pad + 1),
        min(bottom_chrome_start, y1 + pad + 1),
    )
    cropped = source.crop(box)

    c_arr = np.asarray(cropped)
    c_white = (c_arr[:, :, 0] > 245) & (c_arr[:, :, 1] > 245) & (c_arr[:, :, 2] > 245)
    c_ink = (~c_white).sum(axis=1)

    # Top: skip whitespace + orphan hairlines until the chart border/title band.
    top = 0
    while top < len(c_ink) - 30:
        if c_ink[top] >= 80 and c_ink[top : top + 40].sum() >= 800:
            # Prefer the strong top border (near-full width), not a stray line.
            if c_ink[top] >= int(cropped.width * 0.7) or c_ink[top : top + 8].mean() >= 40:
                break
        top += 1

    # Bottom: drop trailing blank and any leftover toolbar fragments; keep V M.P.H.
    # Cut at the last long blank before the end if what follows looks like UI chrome.
    bottom = len(c_ink) - 1
    while bottom > 60 and c_ink[bottom] < 10:
        bottom -= 1

    # If a blank gap sits above a dense near-full-width band, that band is UI — cut above it.
    y = bottom
    while y > 80:
        if c_ink[y] < 8:
            gap_end = y
            while y > 80 and c_ink[y] < 8:
                y -= 1
            gap_start = y + 1
            below = c_ink[gap_end + 1 : gap_end + 25]
            if len(below) and below.max() >= int(cropped.width * 0.5) and (gap_end - gap_start) >= 2:
                bottom = gap_start - 1
                break
        y -= 1

    # Also drop "(page 1-15)" if it sits alone under a blank after the axis label.
    # Keep rows through the last moderately dense chart/label content before a short blank+sparse footnote.
    cut = bottom
    blank = 0
    for y in range(int(len(c_ink) * 0.55), bottom + 1):
        if c_ink[y] < 8:
            blank += 1
            if blank >= 3:
                # Look ahead: sparse footnote only?
                ahead = c_ink[y + 1 : min(len(c_ink), y + 20)]
                if len(ahead) and ahead.max() < int(cropped.width * 0.35):
                    cut = y - blank
                    break
        else:
            blank = 0

    bottom = max(cut, top + 80)
    cropped = cropped.crop((0, top, cropped.width, bottom + 2))
    cropped.save(SRC, optimize=True)
    print(
        f"source={source.size} chrome=({top_chrome_end},{bottom_chrome_start}) "
        f"box={box} trim_top={top} out={cropped.size}"
    )


if __name__ == "__main__":
    main()
