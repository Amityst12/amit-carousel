#!/usr/bin/env node
// Brand kit generator — run by the /amit-setup skill (or by hand).
// Writes:  skill/template/src/brand-kit.ts                      (palette, font, highlight style, SVG names, logo)
//          skill/template/public/images/svg/brand/*.svg + preview.html   (10 SVGs drawn in YOUR palette and YOUR style, unique per --seed)
//
//   bun scripts/brand-kit.mjs --name "Dana" --accent "#FF5A36" --accent2 "#FFD166" --bg "#FFF8EE" --text "#1B1B1B" \
//        --font rubik --highlight marker --style organic --seed "@dana.cooks" [--logo /images/logo.png | --logo none]
//
// --style: rounded | sharp | organic | playful        --font: hebrew rubik secular frank suez minimal editorial clean mono condensed
// --highlight: marker | brush-solid | italic-box      --logo omitted = keep the current logo setting
// `--reset` removes the kit (back to the manual Surface/Accent/Font pickers).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TPL = path.join(ROOT, "skill", "template");
const OUT = path.join(TPL, "public", "images", "svg", "brand");
const KIT_FILE = path.join(TPL, "src", "brand-kit.ts");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    const v = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "true";
    args[k] = v;
  }
}

const FONTS = ["hebrew", "rubik", "secular", "frank", "suez", "minimal", "editorial", "clean", "mono", "condensed"];
const STYLES = ["rounded", "sharp", "organic", "playful"];
const HIGHLIGHTS = ["marker", "brush-solid", "italic-box"];
const HEX = /^#[0-9a-fA-F]{6}$/;

function readKitFile() { return fs.existsSync(KIT_FILE) ? fs.readFileSync(KIT_FILE, "utf8") : ""; }
function currentLogo() { const m = readKitFile().match(/export const LOGO_SRC: string \| null = (null|"[^"]*");/); return m ? (m[1] === "null" ? null : JSON.parse(m[1])) : null; }

function writeKitFile(kit, logo) {
  const body = `// YOUR BRAND KIT — written by \`bun scripts/brand-kit.mjs\` (the /amit-setup skill runs it for you). null = no kit: the Surface / Accent / Font pickers decide.
// With a kit: your palette + font + highlight style apply to every carousel, and your own SVG set (public/images/svg/brand/) is used for arrows and \`decor\` (color: "brand").
import type { BrandKit } from "./lib/types";

export const BRAND_KIT: BrandKit | null = ${kit ? JSON.stringify(kit, null, 2) : "null"};

// Optional logo (transparent PNG/SVG in public/images/, e.g. "/images/logo.png"): footer of every slide + CTA slide. null = none.
export const LOGO_SRC: string | null = ${logo ? JSON.stringify(logo) : "null"};
`;
  fs.writeFileSync(KIT_FILE, body);
}

if (args.reset) {
  writeKitFile(null, args.logo === "none" ? null : currentLogo());
  console.log("Brand kit removed (src/brand-kit.ts → null). SVGs in public/images/svg/brand/ are kept.");
  process.exit(0);
}

function die(msg) { console.error("ERROR: " + msg); process.exit(1); }
for (const k of ["accent", "accent2", "bg", "text"]) if (!HEX.test(args[k] || "")) die(`--${k} must be a hex colour like #FF5A36`);
const font = args.font || "hebrew";
const style = args.style || "rounded";
const highlight = args.highlight || "marker";
if (!FONTS.includes(font)) die(`--font must be one of: ${FONTS.join(", ")}`);
if (!STYLES.includes(style)) die(`--style must be one of: ${STYLES.join(", ")}`);
if (!HIGHLIGHTS.includes(highlight)) die(`--highlight must be one of: ${HIGHLIGHTS.join(", ")}`);
const name = (args.name || "brand").replace(/[^\p{L}\p{N}_ -]/gu, "").trim() || "brand";
const seedText = args.seed || name;
const accent = args.accent.toUpperCase(), accent2 = args.accent2.toUpperCase(), bg = args.bg.toUpperCase(), text = args.text.toUpperCase();

// ---------- colour helpers ----------
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v * (1 - t) + B[i] * t)); };
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const textSecondary = mix(text, bg, 0.4);

const warnings = [];
const cText = contrast(text, bg), cAcc = contrast(accent, bg), cAcc2 = contrast(accent2, bg);
if (cText < 7) warnings.push(`text on bg contrast ${cText.toFixed(1)}:1 (aim ≥ 7) — slides may be hard to read`);
if (cAcc < 3) warnings.push(`accent on bg contrast ${cAcc.toFixed(1)}:1 (aim ≥ 3) — highlighted words and arrows will fade; pick a darker/lighter accent`);
if (cAcc2 < 1.5) warnings.push(`accent2 on bg contrast ${cAcc2.toFixed(1)}:1 — accent2 is almost invisible on the background`);

// ---------- seeded random ----------
function hashSeed(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry(hashSeed(`${seedText}|${style}`));
const rr = (a, b) => a + rng() * (b - a);

// ---------- style ----------
const ST = {
  rounded: { cap: "round", join: "round", jit: 0.012, smooth: true, w: 10 },
  sharp: { cap: "butt", join: "miter", jit: 0, smooth: false, w: 11 },
  organic: { cap: "round", join: "round", jit: 0.06, smooth: true, w: 9 },
  playful: { cap: "round", join: "round", jit: 0.03, smooth: true, w: 12 },
}[style];
const f = (n) => Math.round(n * 10) / 10;
const jit = (v, scale) => v + (rng() - 0.5) * 2 * ST.jit * scale;
const JY = (pts, scale = 40) => pts.map(([x, y]) => [x, jit(y, scale)]);
const J = (pts, scale = 240) => pts.map(([x, y]) => [jit(x, scale), jit(y, scale)]);

function d(pts, smooth = ST.smooth, close = false) {
  if (!smooth || pts.length < 3) return "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L") + (close ? " Z" : "");
  let out = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    out += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return out;
}
const stroke = (dd, color, w = ST.w, extra = "") => `<path d="${dd}" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="${ST.cap}" stroke-linejoin="${ST.join}" fill="none"${extra}/>`;
const svg = (vb, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb}">${inner}</svg>\n`;

// arrow head at the end of `pts`, opening angle by style
function head(pts, size, color, w = ST.w) {
  const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[pts.length - 2];
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const open = style === "sharp" ? 0.5 : style === "playful" ? 0.62 : 0.55;
  const a = (s) => [x2 - Math.cos(ang + s * open) * size, y2 - Math.sin(ang + s * open) * size];
  const h = [a(1), [x2, y2], a(-1)];
  return stroke(style === "sharp" ? d(h, false) : d([h[0], [x2, y2], h[2]], false), color, w);
}

const shapes = {};

// 1-3: swipe arrows (240x120, pointing right — the same footprint as the built-in arrows)
shapes["arrow-1"] = () => {
  const p = J([[16, rr(58, 68)], [80, rr(50, 62)], [140, rr(64, 74)], [206, 60]]);
  return svg("240 120", stroke(d(p), accent) + head(p, rr(40, 48), accent) + (style === "playful" ? `<circle cx="16" cy="${f(p[0][1] + 24)}" r="7" fill="${accent2}"/>` : ""));
};
shapes["arrow-2"] = () => {
  const lift = rr(26, 40);
  const p = J([[18, 92], [70, 92 - lift * 0.7], [130, 92 - lift], [190, 92 - lift * 0.6], [214, 68]]);
  return svg("240 120", stroke(d(p), accent) + head(p, rr(36, 44), accent) + (style === "playful" ? `<path d="${d(J([[34, 108], [90, 100], [150, 106]]))}" stroke="${accent2}" stroke-width="6" stroke-linecap="round" fill="none"/>` : ""));
};
shapes["arrow-3"] = () => {
  const y = rr(56, 66), p = J([[14, y], [110, y + rr(-6, 6)], [170, y]]);
  const chev = (x, sz) => stroke(d(J([[x - sz, y - sz * 1.1], [x + sz * 0.3, y], [x - sz, y + sz * 1.1]], 200), style !== "sharp" && ST.smooth, false), accent);
  return svg("240 120", stroke(d(p), accent) + chev(176, 30) + chev(212, 30) + (style === "playful" ? `<circle cx="14" cy="${f(y + 26)}" r="6" fill="${accent2}"/>` : ""));
};
// 4: curved arrow (down-curving, 200x220)
shapes["curved-arrow"] = () => {
  const p = J([[44, 20], [140, 52], [70, 112], [118, 176]], 200);
  return svg("200 220", stroke(d(p), accent) + head(p, 40, accent));
};
// 5: underline (400x50)
shapes["underline"] = () => {
  if (style === "sharp") return svg("400 50", stroke(d([[10, 30], [120, 24], [250, 30], [390, 22]], false), accent, 12) + stroke(d([[60, 42], [200, 38], [330, 42]], false), accent2, 6));
  const a = JY([[10, 28], [110, 18], [210, 34], [310, 22], [390, 28]]);
  const b = JY([[50, 42], [160, 36], [270, 44], [350, 38]]);
  return svg("400 50", stroke(d(a), accent, 12) + stroke(d(b), style === "playful" ? accent2 : accent, 6));
};
// 6: hand-drawn loop around a word (400x200, open ellipse)
shapes["circle"] = () => {
  const cx = 200, cy = 100, rx = rr(168, 182), ry = rr(72, 84), start = rr(-2.6, -2.2), turn = rr(6.3, 6.7);
  const pts = []; const n = 16;
  for (let i = 0; i <= n; i++) { const t = start + (turn * i) / n; const k = 1 + (style === "organic" ? rr(-0.05, 0.05) : 0) + i * 0.0022; pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); }
  if (style === "sharp") { const pr = [[40, 60], [250, 20], [368, 70], [330, 160], [90, 176], [32, 96]]; return svg("400 200", stroke(d(pr, false, true), accent, 10)); }
  return svg("400 200", stroke(d(pts), accent, 10));
};
// 7: starburst (200x200)
shapes["starburst"] = () => {
  const spikes = Math.round(rr(9, 14)), pts = [];
  for (let i = 0; i < spikes * 2; i++) { const t = (Math.PI * i) / spikes - Math.PI / 2; const r = i % 2 ? rr(52, 60) : rr(86, 96); pts.push([100 + Math.cos(t) * r, 100 + Math.sin(t) * r]); }
  const fill = style === "playful" ? accent2 : accent;
  const dd = style === "sharp" ? d(pts, false, true) : d([...pts, pts[0], pts[1]].slice(0, pts.length + 1), ST.smooth) + " Z";
  return svg("200 200", `<path d="${dd}" fill="${fill}" stroke="${fill}" stroke-width="${style === "sharp" ? 0 : 6}" stroke-linejoin="${ST.join}"/>`);
};
// 8: sparkles (200x200)
shapes["sparkle"] = () => {
  const star = (cx, cy, r, color) => {
    const k = style === "sharp" ? 0.06 : style === "organic" ? 0.22 : 0.16;
    const p = [[cx, cy - r], [cx + r * k, cy - r * k], [cx + r, cy], [cx + r * k, cy + r * k], [cx, cy + r], [cx - r * k, cy + r * k], [cx - r, cy], [cx - r * k, cy - r * k]];
    return `<path d="${d(p, false, true)}" fill="${color}" stroke="${color}" stroke-width="${style === "sharp" ? 0 : 5}" stroke-linejoin="round"/>`;
  };
  return svg("200 200", star(100, 108, rr(66, 76), accent) + star(rr(150, 160), rr(40, 48), rr(26, 32), accent2) + star(rr(42, 52), rr(158, 166), rr(18, 24), accent));
};
// 9: squiggle / zigzag divider (400x60)
shapes["squiggle"] = () => {
  const n = Math.round(rr(7, 9)), pts = [];
  for (let i = 0; i <= n; i++) pts.push([14 + (372 * i) / n, 30 + (i % 2 ? 16 : -16) + (style === "organic" ? rr(-5, 5) : 0)]);
  return svg("400 60", stroke(d(pts, style !== "sharp"), accent, style === "playful" ? 12 : 9));
};
// 10: dot cluster (200x200)
shapes["dots"] = () => {
  const pts = [[40, 50], [100, 36], [160, 58], [66, 112], [130, 118], [44, 170], [112, 176], [168, 150]];
  const sq = style === "sharp";
  return svg("200 200", pts.map(([x, y], i) => {
    const r = f(rr(8, 15)), c = i % 3 === 2 ? accent2 : accent, X = f(jit(x, 200)), Y = f(jit(y, 200));
    return sq ? `<rect x="${f(X - +r)}" y="${f(Y - +r)}" width="${f(+r * 2)}" height="${f(+r * 2)}" fill="${c}" transform="rotate(${f(rr(-12, 12))} ${X} ${Y})"/>` : `<circle cx="${X}" cy="${Y}" r="${r}" fill="${c}"/>`;
  }).join(""));
};

fs.mkdirSync(OUT, { recursive: true });
const names = Object.keys(shapes);
for (const n of names) fs.writeFileSync(path.join(OUT, `${n}.svg`), shapes[n]());

const preview = `<!doctype html><meta charset="utf-8"><title>Brand kit preview</title>
<body style="margin:0;padding:32px;background:${bg};color:${text};font-family:system-ui,sans-serif">
<h1 style="margin:0 0 4px">${name} — brand kit</h1>
<p style="color:${textSecondary};margin:0 0 24px">style: ${style} · font: ${font} · highlight: ${highlight} · palette: ${[accent, accent2, bg, text].join("  ")}</p>
<div style="display:flex;gap:10px;margin-bottom:28px">${[accent, accent2, bg, text].map((c) => `<div style="width:90px;height:60px;border-radius:10px;background:${c};border:1px solid ${textSecondary}55"></div>`).join("")}</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px">
${names.map((n) => `<figure style="margin:0;padding:18px;border:1px dashed ${textSecondary}66;border-radius:14px"><img src="${n}.svg" style="width:100%;height:150px;object-fit:contain"><figcaption style="margin-top:8px;font-size:13px;color:${textSecondary}">${n}</figcaption></figure>`).join("\n")}
</div></body>`;
fs.writeFileSync(path.join(OUT, "preview.html"), preview);

let logo = currentLogo();
if (args.logo === "none") logo = null;
else if (args.logo && args.logo !== "true") {
  logo = args.logo.replaceAll("\\", "/");
  const at = logo.indexOf("/images/");
  logo = at >= 0 ? logo.slice(at) : "/" + logo.replace(/^\/+/, "");   // tolerate "images/x.png" and Git-Bash path rewriting
  if (!fs.existsSync(path.join(TPL, "public", logo.replace(/^\//, "")))) warnings.push(`logo file ${logo} not found in skill/template/public/`);
}

const kit = {
  name, accent, accent2, bg, text, textSecondary, font, highlightStyle: highlight,
  svgs: names, arrows: ["arrow-1", "arrow-2", "arrow-3", "arrow-2", "arrow-1"],
};
writeKitFile(kit, logo);

console.log(`Brand kit "${name}" written: ${names.length} SVGs → skill/template/public/images/svg/brand/ , kit → skill/template/src/brand-kit.ts`);
console.log(`Preview: http://localhost:3333/images/svg/brand/preview.html  (use your dev-server port)`);
console.log(`Contrast: text ${cText.toFixed(1)}:1 · accent ${cAcc.toFixed(1)}:1 · accent2 ${cAcc2.toFixed(1)}:1`);
for (const w of warnings) console.log("WARN: " + w);
