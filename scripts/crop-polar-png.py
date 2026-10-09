"""Crop sgs-233-polar.png to the graph (drop Acrobat chrome / page footnote)."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "aircraft" / "sgs-233-polar.png"
FULL = ROOT / "public" / "aircraft" / "sgs-233-polar-full.png"


def largest_run(idxs):
    runs = []
    start = prev = idxs[0]
    for y in idxs[1:]:
        if y == prev + 1:
            prev = y
        else:
            runs.append((start, prev))
            start = prev = y
    runs.append((start, prev))
    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return runs[0]


def main():
    if FULL.exists():
        source = Image.open(FULL).convert("RGB")
    else:
        source = Image.open(SRC).convert("RGB")
        source.save(FULL)

    arr = np.asarray(source)
    white = (arr[:, :, 0] > 245) & (arr[:, :, 1] > 245) & (arr[:, :, 2] > 245)
    content = ~white
    h, w = content.shape
    row_counts = content.sum(axis=1)
    col_counts = content.sum(axis=0)
    row_thresh = max(40, int(w * 0.08))
    col_thresh = max(40, int(h * 0.08))

    good_cols = np.where(col_counts >= col_thresh)[0]
    x0, x1 = largest_run(good_cols)

    # Skip thin top browser/Acrobat chrome
    good_rows = np.where((np.arange(h) >= 20) & (row_counts >= row_thresh))[0]
    y0 = largest_run(good_rows)[0]

    # Keep "V M.P.H." label (~row 520) but drop "(page 1-15)" (~550+)
    # Detect end of axis label as last sparse-but-nonzero band before a long blank.
    y1 = y0
    blank_run = 0
    for y in range(y0, h):
        if row_counts[y] < 5:
            blank_run += 1
            if blank_run >= 12 and y1 > y0 + 100:
                break
        else:
            blank_run = 0
            y1 = y

    pad = 6
    box = (
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(w, x1 + pad + 1),
        min(h, y1 + pad + 1),
    )
    cropped = source.crop(box)
    cropped.save(SRC, optimize=True)
    print(f"full={source.size} crop={box} out={cropped.size}")


if __name__ == "__main__":
    main()
