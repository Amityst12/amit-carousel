#!/usr/bin/env python
"""Cut an AI-generated STICKER SHEET (solid-colour background, a grid of poses) into separate transparent PNG stickers.

  python scripts/cut-stickers.py <sheet.jpg|png> --names thumbsup,idea,money,pointing,warning,skeptical,facepalm,hurry \
         [--cols 2] [--rows 4] [--out skill/template/public/images/stickers] [--max-size 600] [--bg "#00FF00"] [--pocket-tol 26] [--preview preview.png]

How it works (no AI, deterministic):
  1. the background colour is read from the sheet border (or --bg) and removed by a flood fill from the edges, so the white sticker outline stays;
  2. enclosed background-coloured pockets (e.g. between an arm and the body) are removed too;
  3. the edge is eroded 1 px, softened and de-spilled (no green halo), each sticker is cropped to its content and saved as <name>.png.
Names are applied in reading order of the grid: left -> right, top -> bottom. Use ONE solid background colour that does not appear in the character
(pure green #00FF00-ish, or magenta #FF00FF if the character wears green). Needs: pip install pillow numpy opencv-python scipy
"""
import argparse
import os
import sys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def parse_hex(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def bg_mask(rgb, bg, tight, loose):
    """Return (loose_mask, tight_mask): pixels close to the background colour in Lab space."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    ref = cv2.cvtColor(np.uint8([[bg]]), cv2.COLOR_RGB2LAB).astype(np.float32)[0, 0]
    d = np.sqrt(((lab - ref) ** 2).sum(axis=2))
    return d < loose, d < tight


def build_rgba(rgb, bg, pocket_tol=26.0):
    """Whole-sheet cut-out: returns an RGBA array (background transparent, edge softened and de-spilled)."""
    loose, _ = bg_mask(rgb, bg, tight=0, loose=34.0)
    _, pocket = bg_mask(rgb, bg, tight=pocket_tol, loose=0)
    lab_, n = ndi.label(loose)
    border = np.unique(np.concatenate([lab_[0], lab_[-1], lab_[:, 0], lab_[:, -1]]))
    bgreg = np.isin(lab_, border[border > 0])
    # enclosed pockets that match the background colour (area >= 12 px), e.g. between an arm and the body
    lab2, n2 = ndi.label(pocket & ~bgreg)
    if n2:
        sizes = ndi.sum(np.ones_like(lab2), lab2, index=np.arange(1, n2 + 1))
        for i, sz in enumerate(sizes, start=1):
            if sz >= 12:
                bgreg |= lab2 == i
    alpha = (~bgreg).astype(np.uint8) * 255
    alpha = cv2.erode(alpha, np.ones((3, 3), np.uint8), iterations=1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.9)
    band = (alpha > 0) & (alpha < 250)
    out = rgb.astype(np.float32).copy()
    srt = sorted(bg)
    if srt[2] - srt[1] > 25:  # one clearly dominant channel (green / blue screen): cap it by the others in the edge band
        dom = int(np.argmax(bg))
        cap = out[..., [c for c in range(3) if c != dom]].max(axis=2)
        out[..., dom] = np.where(band, np.minimum(out[..., dom], cap), out[..., dom])
    else:  # magenta-like (R and B high, G low): pull R and B toward G in the band
        g = out[..., 1]
        for c in (0, 2):
            out[..., c] = np.where(band, np.minimum(out[..., c], g + 40), out[..., c])
    return np.dstack([np.clip(out, 0, 255).astype(np.uint8), alpha])


def cut_sheet(rgb, bg, cols, rows, max_size, pad=10, pocket_tol=26.0):
    """Split the cut-out sheet into one image per grid cell by connected component (stickers may overlap cell borders)."""
    rgba = build_rgba(rgb, bg, pocket_tol)
    H, W = rgba.shape[:2]
    fg = rgba[..., 3] > 8
    comp, m = ndi.label(fg)
    if not m:
        return [None] * (cols * rows)
    areas = ndi.sum(np.ones_like(comp), comp, index=np.arange(1, m + 1))
    cents = ndi.center_of_mass(fg, comp, index=np.arange(1, m + 1))
    cells = {}
    for idx, (a, (cy, cx)) in enumerate(zip(areas, cents), start=1):
        if a < 0.002 * areas.max():  # drop specks
            continue
        r = min(int(cy / H * rows), rows - 1)
        c = min(int(cx / W * cols), cols - 1)
        cells.setdefault((r, c), []).append(idx)
    result = []
    for r in range(rows):
        for c in range(cols):
            ids = cells.get((r, c))
            if not ids:
                result.append(None)
                continue
            keep = np.isin(comp, ids)
            ys, xs = np.nonzero(keep)
            y0, y1, x0, x1 = max(ys.min() - pad, 0), min(ys.max() + pad, H), max(xs.min() - pad, 0), min(xs.max() + pad, W)
            sub = rgba[y0:y1, x0:x1].copy()
            sub[..., 3] = np.where(keep[y0:y1, x0:x1], sub[..., 3], 0)
            im = Image.fromarray(sub, "RGBA")
            if max(im.size) > max_size:
                k = max_size / max(im.size)
                im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            result.append(im)
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet")
    ap.add_argument("--names", required=True, help="comma-separated names in reading order (left->right, top->bottom)")
    ap.add_argument("--cols", type=int, default=2)
    ap.add_argument("--rows", type=int, default=4)
    ap.add_argument("--out", default=os.path.join("skill", "template", "public", "images", "stickers"))
    ap.add_argument("--max-size", type=int, default=600)
    ap.add_argument("--pocket-tol", type=float, default=26.0, help="how aggressively enclosed background-coloured pockets are removed (lower = safer for artwork that contains the same colour, e.g. green money)")
    ap.add_argument("--bg", default=None, help="background colour as hex; default = detected from the sheet border")
    ap.add_argument("--preview", default=None, help="optional contact-sheet PNG of the result on a white + dark background")
    a = ap.parse_args()

    names = [n.strip() for n in a.names.split(",") if n.strip()]
    if len(names) != a.cols * a.rows:
        sys.exit(f"need {a.cols * a.rows} names for a {a.cols}x{a.rows} grid, got {len(names)}")
    sheet = Image.open(a.sheet).convert("RGB")
    W, H = sheet.size
    if a.bg:
        bg = parse_hex(a.bg)
    else:
        arr = np.asarray(sheet)
        border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]])
        bg = tuple(int(v) for v in np.median(border, axis=0))
    print(f"sheet {W}x{H}, background colour #{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}")
    os.makedirs(a.out, exist_ok=True)
    made = []
    ims = cut_sheet(np.asarray(sheet), bg, a.cols, a.rows, a.max_size, pocket_tol=a.pocket_tol)
    for name, im in zip(names, ims):
        if im is None:
            print(f"  ! {name}: nothing found in its grid cell")
            continue
        path = os.path.join(a.out, f"{name}.png")
        im.save(path)
        made.append((name, im))
        print(f"  {name}.png  {im.width}x{im.height}")
    if a.preview and made:
        cw = max(i.width for _, i in made) + 20
        ch = max(i.height for _, i in made) + 20
        cols = min(4, len(made))
        rows = -(-len(made) // cols)
        prev = Image.new("RGB", (cols * cw, rows * ch * 2), (255, 255, 255))
        prev.paste(Image.new("RGB", (cols * cw, rows * ch), (24, 24, 27)), (0, rows * ch))
        for off in (0, rows * ch):
            for k, (_, im) in enumerate(made):
                prev.paste(im, ((k % cols) * cw + 10, off + (k // cols) * ch + 10), im)
        prev.save(a.preview)
        print("preview ->", a.preview)
    print(f"done: {len(made)} stickers in {a.out}")


if __name__ == "__main__":
    main()
