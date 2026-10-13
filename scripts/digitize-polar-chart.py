"""Sample L/D from sgs-233-polar.png against labeled axes."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "aircraft" / "sgs-233-polar.png"


def main():
    img = Image.open(SRC).convert("L")
    a = np.asarray(img)
    h, w = a.shape

    # Fixed plot box from crop (left/right borders + bottom axis at y~245; top border ~36)
    x0, x1 = 24, 440
    y0, y1 = 36, 245
    mph0, mph1 = 30.0, 90.0
    # Chart: L/D 24 at top aligns with Vs 14; L/D 12 at bottom aligns with Vs 2
    # (labels show 18↔8 … 24↔14). Use L/D 12..24 over the plot height.
    ld0, ld1 = 12.0, 24.0

    def x_of_mph(mph):
        return x0 + (mph - mph0) / (mph1 - mph0) * (x1 - x0)

    def ld_of_y(y):
        return ld1 - (y - y0) / (y1 - y0) * (ld1 - ld0)

    def vs_of_y(y):
        # Vs 2..14 same normalized mapping as L/D 12..24
        return 14.0 - (y - y0) / (y1 - y0) * (14.0 - 2.0)

    def dark_ys(mph, y_lo, y_hi):
        cx = int(round(x_of_mph(mph)))
        ys = []
        for dx in range(-2, 3):
            x = int(np.clip(cx + dx, 0, w - 1))
            for y in range(y_lo, y_hi):
                if a[y, x] > 110:
                    continue
                # skip heavy horizontal grid
                if (a[y] < 140).sum() > w * 0.4:
                    continue
                ys.append(y)
        return sorted(set(ys))

    def cluster_means(ys, gap=4):
        if not ys:
            return []
        groups = [[ys[0]]]
        for y in ys[1:]:
            if y - groups[-1][-1] <= gap:
                groups[-1].append(y)
            else:
                groups.append([y])
        return [sum(g) / len(g) for g in groups]

    print(f"box=({x0},{y0})-({x1},{y1})")
    print("mph | L/D clusters (top first) | Vs clusters | V/bestLD")
    for mph in [36, 42, 48, 51, 54, 57, 60, 66, 72, 78, 84, 90]:
        ld_ys = cluster_means(dark_ys(mph, y0 + 2, int(y0 + 0.62 * (y1 - y0))), gap=4)
        vs_ys = cluster_means(dark_ys(mph, int(y0 + 0.45 * (y1 - y0)), y1 - 2), gap=4)
        lds = [round(ld_of_y(y), 2) for y in ld_ys]
        vss = [round(vs_of_y(y), 2) for y in vs_ys]
        v_fps = mph * (5280 / 3600)
        best = max(lds) if lds else None
        print(
            f"{mph:3d} | {lds} | {vss} | chk={round(v_fps / best, 2) if best else None}"
        )


if __name__ == "__main__":
    main()
