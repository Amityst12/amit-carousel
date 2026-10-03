"""
Generates the brand SVG decor assets (+ the brush-stroke data used by the marker highlight).

Run from skill/template:  python scripts/generate-svg-assets.py

Writes:
  ../../Assets/graphics/svg/<blue|dark|white>/<name>.svg      (source of truth)
  public/images/svg/<blue|dark|white>/<name>.svg              (copies used by the carousel tool)
  src/lib/brush.ts                                            (brush-stroke path data for `highlightStyle: "marker"`)

Assets are SHAPES ONLY (no <text>): SVGs shown through <img> cannot load the Heebo font.
Brush strokes + arrows are procedurally "hand-drawn" with seeded randomness, so re-running gives identical files.
"""
import math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.abspath(os.path.join(HERE, ".."))
ROOT = os.path.abspath(os.path.join(TEMPLATE, "..", ".."))
COLORS = {"blue": "#3B82F6", "dark": "#18181B", "white": "#FFFFFF"}


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


# --------------------------------------------------------------------------- brush strokes
BW, BH = 1000, 200      # brush viewBox
BCAP = 110              # width (viewBox units) of the fixed left/right caps used by the 3-slice marker


def point_in_poly(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def make_brush(seed, top=22, bot=178, n=70, ragL=14, ragR=18, slant=0.0):
    """One dry-brush stroke: ragged bristle ends, wavy top/bottom edge, a few dry streaks and speckles."""
    r = random.Random(seed)
    rows = [top + (bot - top) * i / n for i in range(n + 1)]

    def walk(base, amp, step, jump_p, jump_amp):
        v = base; out = []
        for _ in range(n + 1):
            v += r.uniform(-step, step)
            if r.random() < jump_p:
                v += r.uniform(-jump_amp, jump_amp)
            v = max(base - amp, min(base + amp, v))
            out.append(v)
        return out

    xl = walk(15, ragL, 4, 0.12, ragL * 0.9)           # ragged ends hug the edge: the text must sit INSIDE the stroke
    xr = walk(BW - 15, ragR, 4, 0.12, ragR * 0.9)
    for i in range(n + 1):
        t = abs(2 * i / n - 1)              # 0 centre, 1 top/bottom row
        taper = (t ** 3) * 12               # nearly square corners (a thick, even stroke)
        sl = (i / n - 0.5) * slant
        xl[i] = max(3, xl[i] + taper + sl)
        xr[i] = min(BW - 4, xr[i] - taper + sl)

    p1, p2, p3, p4 = (r.uniform(0, 6.28) for _ in range(4))

    def edge(x, base, sign, phase_a, phase_b):
        y = base + 2.0 * math.sin(x / 61 + phase_a) + 1.3 * math.sin(x / 23 + phase_b) + r.uniform(-1.0, 1.0)
        if r.random() < 0.035:              # bristle tip
            y += sign * r.uniform(3, 7)
        return y

    pts = []
    for i in range(n + 1):                  # left edge, top -> bottom (stair-stepped bristles)
        pts.append((xl[i], rows[i]))
        pts.append((xl[i], rows[min(i + 1, n)]))
    x = xl[n]
    while x < xr[n]:                        # bottom edge, left -> right
        pts.append((x, edge(x, bot, +1, p1, p2))); x += 6
    for i in range(n, -1, -1):              # right edge, bottom -> top
        pts.append((xr[i], rows[i]))
        pts.append((xr[i], rows[max(i - 1, 0)]))
    x = xr[0]
    while x > xl[0]:                        # top edge, right -> left
        pts.append((x, edge(x, top, -1, p3, p4))); x -= 6

    d = "M" + " L".join(f"{f(a)} {f(b)}" for a, b in pts) + " Z"

    # dry-brush streaks (holes, even-odd) near both ends
    def row_of(y):
        return max(0, min(n, int((y - top) / (bot - top) * n)))

    holes = []
    for _ in range(4):
        y = r.uniform(top + 16, bot - 16); i = row_of(y)
        xs = r.uniform(0.70 * BW, 0.88 * BW); xe = min(xr[i] - 16, xs + r.uniform(60, 160))
        if xe - xs < 24 or xs < xl[i] + 20:
            continue
        t = r.uniform(1.5, 3.0)
        holes.append([(xs, y - 0.5), (xe, y - t / 2), (xe + 4, y), (xe, y + t / 2), (xs, y + 0.5)])
    for _ in range(2):
        y = r.uniform(top + 16, bot - 16); i = row_of(y)
        xs = xl[i] + r.uniform(16, 36); xe = xs + r.uniform(50, 130)
        if xe > xr[i] - 30:
            continue
        t = r.uniform(1.4, 2.8)
        holes.append([(xs, y), (xe, y - t / 2), (xe - 4, y), (xe, y + t / 2)])
    for h in holes:
        d += " M" + " L".join(f"{f(a)} {f(b)}" for a, b in h) + " Z"

    # speckles (small separate flecks outside the stroke, near the ends only so the stretched middle stays clean)
    for _ in range(18):
        side = r.choice(("L", "R", "L", "R", "T", "B"))
        if side == "L":
            cx, cy = r.uniform(2, 44), r.uniform(top - 14, bot + 14)
        elif side == "R":
            cx, cy = r.uniform(BW - 90, BW - 2), r.uniform(top - 14, bot + 14)
        elif side == "T":
            cx, cy = r.choice((r.uniform(30, 150), r.uniform(BW - 170, BW - 30))), r.uniform(top - 20, top - 6)
        else:
            cx, cy = r.choice((r.uniform(30, 150), r.uniform(BW - 170, BW - 30))), r.uniform(bot + 6, bot + 20)
        if point_in_poly(cx, cy, pts) or any(abs(cx - a) < 7 and abs(cy - b) < 7 for a, b in pts):
            continue
        rad = r.uniform(0.9, 2.6)
        k = 6
        sp = [(cx + rad * math.cos(2 * math.pi * j / k) * r.uniform(0.7, 1.2),
               cy + rad * math.sin(2 * math.pi * j / k) * r.uniform(0.7, 1.2)) for j in range(k)]
        d += " M" + " L".join(f"{f(a)} {f(b)}" for a, b in sp) + " Z"
    return d


BRUSHES = [
    make_brush(11, slant=10),
    make_brush(23, top=24, bot=176, ragL=12, ragR=20, slant=-8),
    make_brush(37, top=21, bot=179, ragL=16, ragR=16, slant=14),
    make_brush(59, top=23, bot=177, ragL=11, ragR=22, slant=-12),
]


# --------------------------------------------------------------------------- arrows (similar, but not identical)
SW = 12  # stroke width in the 240x120 arrow viewBox


def stroke(d, c, w=SW, extra=""):
    return f'<path d="{d}" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" fill="none"{extra}/>'


def head(tip, direction, size, spread_deg, jitter=(0, 0)):
    """open chevron head: two strokes going back from the tip around the reversed direction"""
    dx, dy = direction
    n = math.hypot(dx, dy); dx, dy = dx / n, dy / n
    pts = []
    for sgn in (+1, -1):
        a = math.radians(180 + sgn * spread_deg)
        rx = dx * math.cos(a) - dy * math.sin(a)
        ry = dx * math.sin(a) + dy * math.cos(a)
        pts.append((tip[0] + rx * size + jitter[0] * sgn, tip[1] + ry * size + jitter[1] * sgn))
    return pts


def arrow_svg(c, shaft, tip, direction, size=48, spread=36, extra_paths=(), double=False):
    parts = [stroke(shaft, c)]
    a, b = head(tip, direction, size, spread)
    parts.append(stroke(f"M{f(a[0])} {f(a[1])} L{f(tip[0])} {f(tip[1])} L{f(b[0])} {f(b[1])}", c))
    if double:
        tip2 = (tip[0] - direction[0] / math.hypot(*direction) * 30, tip[1] - direction[1] / math.hypot(*direction) * 30)
        a2, b2 = head(tip2, direction, size * 0.8, spread)
        parts.append(stroke(f"M{f(a2[0])} {f(a2[1])} L{f(tip2[0])} {f(tip2[1])} L{f(b2[0])} {f(b2[1])}", c))
    for p in extra_paths:
        parts.append(stroke(p[0], c, p[1]))
    return "".join(parts)


ARROWS = {
    # 1: the original long, calm line with an open head (kept identical so older slides don't change)
    "swipe-arrow": lambda c: stroke("M16 62 C70 54 130 67 205 60", c) + stroke("M170 22 C190 38 205 50 218 60 C204 74 190 88 168 100", c),
    # 2: wavy shaft, softer head
    "swipe-arrow-2": lambda c: arrow_svg(c, "M14 70 C44 40 84 96 126 66 S190 52 214 60", (222, 58), (1, -0.1), 46, 38),
    # 3: slightly rising line + a short "speed" stroke underneath
    "swipe-arrow-3": lambda c: arrow_svg(c, "M16 82 C70 80 140 62 208 48", (222, 44), (1, -0.22), 48, 36, extra_paths=(("M52 102 C92 100 128 94 156 88", 7),)),
    # 4: arc that dips and rises, bigger head
    "swipe-arrow-4": lambda c: arrow_svg(c, "M14 44 C52 104 142 112 206 66", (222, 54), (1, -0.55), 52, 34),
    # 5: short line with a double chevron
    "swipe-arrow-5": lambda c: arrow_svg(c, "M18 62 C58 56 110 66 164 60", (204, 60), (1, 0.0), 44, 38, double=True),
}


# --------------------------------------------------------------------------- the other icons (unchanged from the first set)
def star(cx, cy, r, k=0.12):
    return f"M{cx} {cy-r} Q{cx+r*k} {cy-r*k} {cx+r} {cy} Q{cx+r*k} {cy+r*k} {cx} {cy+r} Q{cx-r*k} {cy+r*k} {cx-r} {cy} Q{cx-r*k} {cy-r*k} {cx} {cy-r} Z"


def burst(cx, cy, ro, ri, n=14):
    pts = []
    for i in range(n * 2):
        a = math.pi * i / n - math.pi / 2
        rr = ro if i % 2 == 0 else ri
        pts.append(f"{cx+rr*math.cos(a):.1f},{cy+rr*math.sin(a):.1f}")
    return "M" + " L".join(pts) + " Z"


S = 'stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" fill="none"'
OTHERS = {
    "curved-arrow": ("0 0 220 220", lambda c: f'<path d="M24 36 C40 150 120 192 190 160" {S.format(c=c, w=12)}/><path d="M156 156 L192 160 L170 189" {S.format(c=c, w=12)}/>'),
    "underline": ("0 0 400 50", lambda c: f'<path d="M10 28 C60 16 130 38 190 22 S300 30 390 16" {S.format(c=c, w=12)}/><path d="M40 41 C130 34 230 45 340 35" {S.format(c=c, w=6)}/>'),
    "circle-highlight": ("0 0 400 200", lambda c: f'<path d="M62 112 C38 52 150 12 252 20 C352 30 394 92 342 150 C292 198 120 196 70 152 C38 122 58 82 112 62" {S.format(c=c, w=10)}/>'),
    "starburst": ("0 0 200 200", lambda c: f'<path d="{burst(100,100,96,80,14)}" fill="{c}" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>'),
    "bookmark": ("0 0 120 160", lambda c: f'<path d="M24 14 H96 Q106 14 106 24 V146 L60 112 L14 146 V24 Q14 14 24 14 Z" {S.format(c=c, w=10)}/>'),
    "share": ("0 0 160 160", lambda c: f'<path d="M146 14 L14 66 L62 88 L84 146 Z" {S.format(c=c, w=10)}/><path d="M62 88 L146 14" {S.format(c=c, w=10)}/>'),
    "gift": ("0 0 160 160", lambda c: f'<rect x="20" y="70" width="120" height="76" rx="10" {S.format(c=c, w=10)}/><rect x="12" y="46" width="136" height="26" rx="8" {S.format(c=c, w=10)}/><path d="M80 46 V146" {S.format(c=c, w=10)}/><path d="M80 46 C52 8 18 26 44 42 M80 46 C108 8 142 26 116 42" {S.format(c=c, w=10)}/>'),
    "book": ("0 0 180 140", lambda c: f'<path d="M90 30 C68 16 38 14 12 22 V112 C38 104 68 106 90 122 Z" {S.format(c=c, w=9)}/><path d="M90 30 C112 16 142 14 168 22 V112 C142 104 112 106 90 122 Z" {S.format(c=c, w=9)}/><path d="M28 48 C44 44 58 44 72 48 M28 68 C44 64 58 64 72 68 M28 88 C44 84 58 84 72 88 M108 48 C122 44 136 44 152 48 M108 68 C122 64 136 64 152 68" {S.format(c=c, w=7)}/>'),
    "book-stack": ("0 0 160 160", lambda c: f'<rect x="12" y="110" width="136" height="32" rx="7" {S.format(c=c, w=9)}/><path d="M34 110 V142 M46 110 V142" {S.format(c=c, w=7)}/><rect x="28" y="72" width="116" height="32" rx="7" {S.format(c=c, w=9)}/><path d="M118 72 V104 M130 72 V104" {S.format(c=c, w=7)}/><rect x="22" y="34" width="110" height="32" rx="7" transform="rotate(-5 77 50)" {S.format(c=c, w=9)}/><path d="M44 36 V66 M56 35 V65" transform="rotate(-5 77 50)" {S.format(c=c, w=7)}/>'),
    "test-tube": ("0 0 140 190", lambda c: f'<path d="M30 14 H110" {S.format(c=c, w=9)}/><path d="M44 14 V128 A26 26 0 0 0 96 128 V14" {S.format(c=c, w=9)}/><path d="M44 96 Q57 86 70 96 T96 96" {S.format(c=c, w=8)}/><circle cx="62" cy="128" r="6" fill="{c}"/><circle cx="80" cy="142" r="5" fill="{c}"/><circle cx="78" cy="116" r="4" fill="{c}"/><path d="M120 40 V62 M109 51 H131" {S.format(c=c, w=7)}/>'),
    "dna": ("0 0 120 190", lambda c: dna_svg(c)),
    "team": ("0 0 210 140", lambda c: f'<circle cx="105" cy="34" r="19" {S.format(c=c, w=9)}/><path d="M68 112 C68 74 142 74 142 112 Z" {S.format(c=c, w=9)}/><circle cx="36" cy="58" r="15" {S.format(c=c, w=9)}/><path d="M8 118 C8 90 64 90 64 118" {S.format(c=c, w=9)}/><circle cx="174" cy="58" r="15" {S.format(c=c, w=9)}/><path d="M146 118 C146 90 202 90 202 118" {S.format(c=c, w=9)}/>'),
    "phone": ("0 0 150 190", lambda c: f'<rect x="22" y="12" width="82" height="164" rx="16" {S.format(c=c, w=9)}/><path d="M52 32 H74" {S.format(c=c, w=8)}/><path d="M54 154 H72" {S.format(c=c, w=8)}/><path d="M118 60 Q130 76 118 92 M130 48 Q148 76 130 104" {S.format(c=c, w=8)}/>'),
    "clock": ("0 0 160 170", lambda c: f'<circle cx="80" cy="90" r="58" {S.format(c=c, w=9)}/><path d="M80 90 V54 M80 90 L106 106" {S.format(c=c, w=9)}/><path d="M80 24 V14 M56 14 H104" {S.format(c=c, w=8)}/><path d="M38 38 L28 28 M122 38 L132 28" {S.format(c=c, w=8)}/><circle cx="80" cy="90" r="5" fill="{c}"/>'),
    "picture": ("0 0 170 150", lambda c: f'<rect x="12" y="14" width="146" height="122" rx="16" {S.format(c=c, w=9)}/><circle cx="52" cy="54" r="13" {S.format(c=c, w=8)}/><path d="M18 118 L64 74 L92 100 L116 78 L152 112" {S.format(c=c, w=9)}/>'),
    "gadget": ("0 0 170 140", lambda c: f'<rect x="10" y="12" width="150" height="116" rx="16" {S.format(c=c, w=9)}/><rect x="28" y="30" width="62" height="34" rx="6" {S.format(c=c, w=8)}/><circle cx="122" cy="46" r="15" {S.format(c=c, w=8)}/><circle cx="38" cy="96" r="9" fill="{c}"/><circle cx="68" cy="96" r="9" fill="{c}"/><circle cx="98" cy="96" r="9" fill="{c}"/><circle cx="128" cy="96" r="9" fill="{c}"/>'),
    "mic": ("0 0 120 170", lambda c: f'<rect x="38" y="10" width="44" height="84" rx="22" {S.format(c=c, w=9)}/><path d="M18 74 C18 118 42 126 60 126 C78 126 102 118 102 74" {S.format(c=c, w=9)}/><path d="M60 126 V150 M36 152 H84" {S.format(c=c, w=9)}/>'),
    "sparkles": ("0 0 160 160", lambda c: f'<path d="{star(68,92,56)}" fill="{c}"/><path d="{star(126,38,26)}" fill="{c}"/><path d="{star(130,128,18)}" fill="{c}"/>'),
    "comment-bubble": ("0 0 160 150", lambda c: f'<path d="M30 14 H130 Q148 14 148 32 V90 Q148 108 130 108 H72 L40 138 V108 H30 Q12 108 12 90 V32 Q12 14 30 14 Z" {S.format(c=c, w=10)}/><circle cx="50" cy="61" r="8" fill="{c}"/><circle cx="80" cy="61" r="8" fill="{c}"/><circle cx="110" cy="61" r="8" fill="{c}"/>'),
}


def dna_svg(c):
    import math
    pts1, pts2, rungs = [], [], []
    n = 60
    for i in range(n + 1):
        t = i / n * 2.5 * math.pi
        y = 12 + i / n * 166
        pts1.append((60 + 34 * math.sin(t), y))
        pts2.append((60 - 34 * math.sin(t), y))
        if i % 5 == 2 and abs(math.sin(t)) > 0.35:
            rungs.append((60 + 34 * math.sin(t), y, 60 - 34 * math.sin(t)))
    d1 = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts1)
    d2 = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts2)
    dr = " ".join(f"M{a:.1f} {y:.1f} H{b:.1f}" for a, y, b in rungs)
    return f'<path d="{d1}" {S.format(c=c, w=9)}/><path d="{d2}" {S.format(c=c, w=9)}/><path d="{dr}" {S.format(c=c, w=6)}/>'


def build():
    assets = {}
    for name, fn in ARROWS.items():
        assets[name] = ("0 0 240 120", fn)
    assets.update(OTHERS)
    for i, d in enumerate(BRUSHES, 1):
        assets[f"brush-{i}"] = (f"0 0 {BW} {BH}", (lambda dd: lambda c: f'<path fill-rule="evenodd" fill="{c}" d="{dd}"/>')(d))
    for variant, color in COLORS.items():
        for out in (os.path.join(ROOT, "Assets", "graphics", "svg", variant), os.path.join(TEMPLATE, "public", "images", "svg", variant)):
            os.makedirs(out, exist_ok=True)
            for name, (vb, fn) in assets.items():
                par = ' preserveAspectRatio="none"' if name.startswith("brush-") else ""
                with open(os.path.join(out, f"{name}.svg"), "w", encoding="utf-8") as fh:
                    fh.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{par}>{fn(color)}</svg>\n')
    # runtime data for the marker highlight (3-slice: left cap, stretched middle, right cap)
    ts = "// AUTO-GENERATED by scripts/generate-svg-assets.py — do not edit by hand.\n"
    ts += f"export const BRUSH_W = {BW};\nexport const BRUSH_H = {BH};\nexport const BRUSH_CAP = {BCAP};\n"
    ts += "export const BRUSH_PATHS: string[] = [\n" + "".join(f"  {d!r},\n".replace("'", '"') for d in BRUSHES) + "];\n"
    with open(os.path.join(TEMPLATE, "src", "lib", "brush.ts"), "w", encoding="utf-8") as fh:
        fh.write(ts)
    print(len(assets), "assets x", len(COLORS), "colours; brush paths:", [len(d) for d in BRUSHES])


if __name__ == "__main__":
    build()
