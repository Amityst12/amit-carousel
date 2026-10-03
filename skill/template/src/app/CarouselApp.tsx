"use client";

import { useRef, useState, useCallback, useEffect, ReactNode, createContext, useContext } from "react";
import { toPng, toJpeg } from "html-to-image";
import type { SlideData, BgType, StylePreset, FontId, SurfaceId, AccentId, PurposeId, FormatId, HighlightStyle } from "../lib/types";
import { BRUSH_W, BRUSH_H, BRUSH_CAP, BRUSH_PATHS } from "../lib/brush";
import { FONT_STYLES, SURFACES, ACCENTS, composePreset, FORMAT_PRESETS } from "../lib/presets";
import { SLIDES, POST_META, HANDLE, AVATAR_SRC, AUTO_ARROW, DEFAULT_FONT, DEFAULT_SURFACE, DEFAULT_ACCENT, DEFAULT_PURPOSE, DEFAULT_BG, DEFAULT_FORMAT } from "../slides";

const CANVAS_W = FORMAT_PRESETS[DEFAULT_FORMAT].w;
const CANVAS_H = FORMAT_PRESETS[DEFAULT_FORMAT].h;

const CanvasSizeContext = createContext({ w: CANVAS_W, h: CANVAS_H });
function useCanvasSize() { return useContext(CanvasSizeContext); }

// ============================================================
// ADAPTIVE FONT SIZE
// ============================================================

function getAdaptiveFontSize(text: string, type: "hook" | "body"): number {
  const chars = text.replace(/\n/g, "").length;
  const lines = text.split("\n").length;
  const maxLineLen = Math.max(...text.split("\n").map((l) => l.length));

  if (type === "hook") {
    let sizeByChars = 170;
    if (chars > 70) sizeByChars = 104;
    else if (chars > 50) sizeByChars = 120;
    else if (chars > 30) sizeByChars = 140;
    else if (chars > 20) sizeByChars = 156;

    let sizeByLines = 170;
    if (lines > 4) sizeByLines = 104;
    else if (lines > 3) sizeByLines = 120;
    else if (lines > 2) sizeByLines = 144;

    // Unbounded bold is wide (Cyrillic more so) — cap by longest explicit line
    // so long words don't overflow 920px content area (1080 − 80×2 padding).
    let sizeByMaxLine = 170;
    if (lines > 1) {
      if (maxLineLen > 14) sizeByMaxLine = 88;
      else if (maxLineLen > 12) sizeByMaxLine = 108;
      else if (maxLineLen > 10) sizeByMaxLine = 124;
      else if (maxLineLen > 8) sizeByMaxLine = 140;
    }

    return Math.min(sizeByChars, sizeByLines, sizeByMaxLine);
  }

  // body
  let sizeByChars = 88;
  if (chars > 160) sizeByChars = 48;
  else if (chars > 120) sizeByChars = 56;
  else if (chars > 80) sizeByChars = 64;
  else if (chars > 40) sizeByChars = 76;

  let sizeByLines = 88;
  if (lines > 6) sizeByLines = 48;
  else if (lines > 5) sizeByLines = 54;
  else if (lines > 4) sizeByLines = 62;
  else if (lines > 3) sizeByLines = 72;

  return Math.min(sizeByChars, sizeByLines);
}

// ============================================================
// DECORATIVE BLOBS
// ============================================================

function seededRandom(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateBlobPath(
  rng: () => number,
  cx: number,
  cy: number,
  radius: number,
  points: number = 7
): string {
  const angleStep = (Math.PI * 2) / points;
  const pts: { x: number; y: number }[] = [];

  for (let i = 0; i < points; i++) {
    const angle = angleStep * i - Math.PI / 2;
    const r = radius * (0.7 + rng() * 0.6);
    pts.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }

  // Build smooth cubic bezier path through points
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < points; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % points];
    const prev = pts[(i - 1 + points) % points];
    const nextNext = pts[(i + 2) % points];

    const cp1x = curr.x + (next.x - prev.x) * 0.25;
    const cp1y = curr.y + (next.y - prev.y) * 0.25;
    const cp2x = next.x - (nextNext.x - curr.x) * 0.25;
    const cp2y = next.y - (nextNext.y - curr.y) * 0.25;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  d += " Z";
  return d;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// Corner zones where blobs can appear without overlapping text
const BLOB_ZONES = [
  { x: 0.1, y: 0.05 },   // top-left
  { x: 0.85, y: 0.05 },  // top-right
  { x: 0.05, y: 0.85 },  // bottom-left
  { x: 0.9, y: 0.8 },    // bottom-right
  { x: 0.85, y: 0.45 },  // mid-right
  { x: 0.05, y: 0.4 },   // mid-left
];

function SlideDecorations({
  slideIndex,
  preset,
}: {
  slideIndex: number;
  preset: StylePreset;
}) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  const rng = seededRandom(slideIndex * 7919 + 42);
  const blobCount = 1 + Math.floor(rng() * 2); // 1-2 blobs
  const { r, g, b } = hexToRgb(preset.accentColor);

  const blobs: ReactNode[] = [];

  for (let i = 0; i < blobCount; i++) {
    const zoneIdx = Math.floor(rng() * BLOB_ZONES.length);
    const zone = BLOB_ZONES[zoneIdx];
    const cx = zone.x * CANVAS_W + (rng() - 0.5) * 100;
    const cy = zone.y * CANVAS_H + (rng() - 0.5) * 100;
    const radius = 150 + rng() * 200;
    const opacity = 0.06 + rng() * 0.06;
    const rotation = rng() * 360;

    const path = generateBlobPath(rng, 0, 0, radius);

    blobs.push(
      <g
        key={i}
        transform={`translate(${cx}, ${cy}) rotate(${rotation})`}
      >
        <path
          d={path}
          fill={`rgba(${r}, ${g}, ${b}, ${opacity})`}
        />
      </g>
    );
  }

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    >
      {blobs}
    </svg>
  );
}

// ============================================================
// BACKGROUND DECORATIONS (grid / noise / bignumber / glow / lines)
// ============================================================

function GridDecoration({ preset }: { preset: StylePreset }) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  const { r, g, b } = hexToRgb(preset.accentColor);
  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <defs>
        <pattern id="dotgrid" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="2.5" fill={`rgba(${r},${g},${b},0.14)`} />
        </pattern>
      </defs>
      <rect width={CANVAS_W} height={CANVAS_H} fill="url(#dotgrid)" />
    </svg>
  );
}

function LinesDecoration({ preset }: { preset: StylePreset }) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  const { r, g, b } = hexToRgb(preset.accentColor);
  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <defs>
        <pattern
          id="diaglines"
          width="64"
          height="64"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-35)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="64"
            stroke={`rgba(${r},${g},${b},0.08)`}
            strokeWidth="3"
          />
        </pattern>
      </defs>
      <rect width={CANVAS_W} height={CANVAS_H} fill="url(#diaglines)" />
    </svg>
  );
}

function PaperDecoration({ preset }: { preset: StylePreset }) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  const { r, g, b } = hexToRgb(preset.textColor);
  const lineColor = `rgba(${r},${g},${b},0.12)`;
  const marginColor = `rgba(${r},${g},${b},0.22)`;
  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <defs>
        <pattern id="ruledlines" width={CANVAS_W} height="64" patternUnits="userSpaceOnUse">
          <line
            x1="0"
            y1="64"
            x2={CANVAS_W}
            y2="64"
            stroke={lineColor}
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      <rect width={CANVAS_W} height={CANVAS_H} fill="url(#ruledlines)" />
      <line
        x1="140"
        y1="0"
        x2="140"
        y2={CANVAS_H}
        stroke={marginColor}
        strokeWidth="2"
      />
    </svg>
  );
}

function NoiseDecoration({ slideIndex }: { slideIndex: number }) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  const id = `noise-${slideIndex}`;
  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        mixBlendMode: "overlay",
        opacity: 0.6,
      }}
    >
      <filter id={id}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="2"
          seed={slideIndex + 1}
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={CANVAS_W} height={CANVAS_H} filter={`url(#${id})`} />
    </svg>
  );
}

function BigNumberDecoration({
  slideIndex,
  preset,
}: {
  slideIndex: number;
  preset: StylePreset;
}) {
  const { r, g, b } = hexToRgb(preset.accentColor);
  return (
    <div
      style={{
        position: "absolute",
        right: -60,
        bottom: -280,
        fontSize: 960,
        fontFamily: preset.fontFamily,
        fontWeight: 900,
        color: `rgba(${r},${g},${b},0.055)`,
        lineHeight: 0.8,
        letterSpacing: "-0.06em",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {String(slideIndex + 1).padStart(2, "0")}
    </div>
  );
}

function GlowDecoration({
  slideIndex,
  preset,
}: {
  slideIndex: number;
  preset: StylePreset;
}) {
  const { r, g, b } = hexToRgb(preset.accentColor);
  // alternate corners by slide index
  const positions = [
    { top: -200, right: -200 },
    { bottom: -200, left: -200 },
    { top: -200, left: -200 },
    { bottom: -200, right: -200 },
  ];
  const pos = positions[slideIndex % positions.length];
  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        width: 900,
        height: 900,
        background: `radial-gradient(circle, rgba(${r},${g},${b},0.22), transparent 65%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
      }}
    />
  );
}

function SlideBackground({
  bgType,
  slideIndex,
  preset,
}: {
  bgType: BgType;
  slideIndex: number;
  preset: StylePreset;
}) {
  switch (bgType) {
    case "blobs":
      return <SlideDecorations slideIndex={slideIndex} preset={preset} />;
    case "grid":
      return <GridDecoration preset={preset} />;
    case "lines":
      return <LinesDecoration preset={preset} />;
    case "paper":
      return <PaperDecoration preset={preset} />;
    case "noise":
      return <NoiseDecoration slideIndex={slideIndex} />;
    case "bignumber":
      return <BigNumberDecoration slideIndex={slideIndex} preset={preset} />;
    case "glow":
      return <GlowDecoration slideIndex={slideIndex} preset={preset} />;
    case "none":
    default:
      return null;
  }
}

// ============================================================
// HELPERS — badge, highlight, text balance
// ============================================================

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
// t = share of colour `a` in the mix (0..1)
function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.r * t + B.r * (1 - t), A.g * t + B.g * (1 - t), A.b * t + B.b * (1 - t));
}
function relLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// ---- adaptive dry-brush marker: a 3-slice background (fixed ragged left/right caps + stretchable middle) so it fits any phrase length and wraps per line
const BRUSH_BOX_EM = 1.5; // painted box height in em (content area + vertical padding)
const brushCache = new Map<string, string[]>();
function brushLayers(variant: number, fill: string): string[] {
  const key = `${variant}|${fill}`;
  const hit = brushCache.get(key);
  if (hit) return hit;
  const d = BRUSH_PATHS[variant % BRUSH_PATHS.length];
  const mk = (x0: number, w: number) =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${x0} 0 ${w} ${BRUSH_H}' preserveAspectRatio='none'><path fill-rule='evenodd' fill='${fill}' d='${d}'/></svg>`
    )}")`;
  const out = [mk(BRUSH_W - BRUSH_CAP, BRUSH_CAP), mk(0, BRUSH_CAP), mk(BRUSH_CAP, BRUSH_W - 2 * BRUSH_CAP)];
  brushCache.set(key, out);
  return out;
}
// RULE: the stroke must OVERSHOOT the text on all sides (short words like "זה"/"לא" must sit well inside it, never touch its ragged edge) and be a thick, even band.
// Horizontal padding (0.42em) > the ragged end of the cap shape (~0.15em), so the text always starts inside the paint; the margin keeps a small gap to neighbouring words.
function brushStyle(preset: StylePreset, phrase: string, solid: boolean, padY = 0.16): React.CSSProperties {
  const acc = preset.highlightColor;
  const dark = relLuminance(preset.bg) < 0.35;
  // light tint = accent blended into the surface (opaque => no seams between the slices); text = deeper (light surface) / lighter (dark surface) accent
  const fill = solid ? acc : mixHex(acc, preset.bg, dark ? 0.42 : 0.32);
  const color = solid ? "#FFFFFF" : dark ? mixHex(acc, "#FFFFFF", 0.4) : mixHex(acc, "#000000", 0.7);
  let h = 0;
  for (const ch of phrase) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [capR, capL, mid] = brushLayers(h % BRUSH_PATHS.length, fill);
  const boxEm = BRUSH_BOX_EM + (padY - 0.17) * 2;           // painted box height grows with the vertical padding
  const capEm = (BRUSH_CAP / BRUSH_H) * boxEm;
  return {
    color,
    backgroundImage: `${capR}, ${capL}, ${mid}`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right center, left center, center",
    backgroundSize: `min(${capEm}em, 50%) 100%, min(${capEm}em, 50%) 100%, max(0px, calc(100% - ${(2 * capEm - 0.04).toFixed(3)}em)) 100%`,
    padding: `${padY}em 0.42em`,
    margin: "0 0.08em",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  };
}

function renderWithHighlight(
  text: string,
  highlight: string | undefined,
  preset: StylePreset,
  style: HighlightStyle = "default",
  scale = 1 // brush-solid only: font-size multiplier (CTA words are drawn a bit bigger than the text around them)
): ReactNode {
  if (!highlight) return text;
  const highlightColor = preset.highlightColor;
  const escaped = highlight.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const brush = style === "marker" || style === "brush-solid";
  return parts.map((part, i) => {
    if (part.toLowerCase() !== highlight.toLowerCase()) {
      // brush: positioned => painted above ALL brush backgrounds, so a marker on a lower line can never hide the text of the line above
      return brush ? <span key={i} style={{ position: "relative" }}>{part}</span> : <span key={i}>{part}</span>;
    }
    if (style === "italic-box") {
      return (
        <span
          key={i}
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontStyle: "italic",
            fontWeight: 700,
            background: highlightColor,
            color: "#ffffff",
            // no vertical padding — box matches line-box, horizontal breathing only
            padding: "0 0.22em",
            borderRadius: 6,
            textTransform: "none",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
          }}
        >
          {part}
        </span>
      );
    }
    if (style === "marker" || style === "brush-solid") {
      return (
        <span key={i} style={style === "brush-solid" ? { ...brushStyle(preset, highlight, true), fontWeight: 900, ...(scale !== 1 ? { fontSize: `${scale}em` } : {}) } : brushStyle(preset, highlight, false)}>
          <span style={{ position: "relative" }}>{part}</span>
        </span>
      );
    }
    return (
      <span
        key={i}
        style={{ color: highlightColor, position: "relative" }}
      >
        {part}
      </span>
    );
  });
}

function Badge({ text, preset }: { text: string; preset: StylePreset }) {
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: preset.fontFamily,
        fontSize: 26,
        fontWeight: 800,
        padding: "10px 22px",
        border: `3px solid ${preset.accentColor}`,
        color: preset.accentColor,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginBottom: 40,
        borderRadius: 6,
        alignSelf: "flex-start",
        position: "relative",
      }}
    >
      {text}
    </div>
  );
}

function TitleDivider({ preset }: { preset: StylePreset }) {
  if (preset.titleDivider === false) return null;
  return (
    <div
      style={{
        width: 96,
        height: 4,
        background: preset.accentColor,
        opacity: 0.6,
        marginBottom: 64,
        position: "relative",
      }}
    />
  );
}

function SlideTitle({
  text,
  preset,
  highlight,
  highlightStyle,
}: {
  text: string;
  preset: StylePreset;
  highlight?: string;
  highlightStyle?: HighlightStyle;
}) {
  return (
    <div
      style={{
        fontFamily: preset.fontFamily,
        fontSize: preset.titleFontSize ?? 44,
        fontWeight: preset.titleFontWeight ?? 800,
        color: preset.titleColor ?? preset.accentColor,
        textTransform: (preset.titleUppercase ?? true) && !/[֐-׿]/.test(text) ? "uppercase" : "none", // Hebrew titles keep Latin names as spelled (Sonnet 5.5, not SONNET 5.5)
        letterSpacing: (preset.titleUppercase ?? true) ? "0.06em" : "-0.02em",
        lineHeight: 1.1,
        marginBottom: 28,
        position: "relative",
        textWrap: "balance" as const,
      }}
    >
      {renderWithHighlight(text, highlight, preset, highlightStyle)}
    </div>
  );
}

// ============================================================
// SLIDE COMPONENTS
// ============================================================

function SlideCounter({
  current,
  total,
  color,
}: {
  current: number;
  total: number;
  color: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        paddingRight: 100, // dots sit ~50 px left of centre to make room for the footer, which moved left of the mute button
        display: "flex",
        direction: "ltr", // progress dots run left→right: slide 1 on the left (Hebrew swipe direction)
        justifyContent: "center",
        gap: 8,
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            opacity: i === current ? 1 : 0.3,
            transition: "all 0.2s",
          }}
        />
      ))}
    </div>
  );
}

function SlideHook({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  return (
    <div
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        background: preset.bgGradient || preset.bg,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        fontFamily: preset.hookFontFamily || preset.fontFamily,
        boxSizing: "border-box",
      }}
    >
      <SlideBackground bgType={bgType} slideIndex={index} preset={preset} />
      {data.badge && <Badge text={data.badge} preset={preset} />}
      {data.heroName && (
        <div
          style={{
            display: "flex",
            direction: "ltr",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 32,
            marginBottom: 40,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: data.heroName.length <= 10 ? 160 : data.heroName.length <= 15 ? (data.heroIcon ? 96 : 112) : 88,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: preset.highlightColor,
              whiteSpace: "nowrap",
              unicodeBidi: "isolate",
            }}
          >
            {data.heroName}
          </div>
          {data.heroIcon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.heroIcon}
              alt=""
              style={{ width: 128, height: 128, objectFit: "contain", filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.18))" }}
            />
          )}
        </div>
      )}
      <div
        style={{
          fontSize: data.heroName ? Math.min(getAdaptiveFontSize(data.text || "", "hook"), 84) : getAdaptiveFontSize(data.text || "", "hook"),
          fontWeight: 800,
          color: preset.textColor,
          // 1.08 instead of 0.95 — tight but leaves room for italic-box highlight
          // on the next line without the colored rect clipping into prev line
          lineHeight: data.highlightStyle === "italic-box" ? 1.15 : 1.02,
          whiteSpace: "pre-line",
          letterSpacing: "-0.03em",
          position: "relative",
          textWrap: "balance" as const,
        }}
      >
        {renderWithHighlight(data.text || "", data.highlight, preset, data.highlightStyle)}
      </div>
      {data.subtitle && (
        <div
          style={{
            marginTop: 48,
            fontSize: 44,
            fontWeight: data.keyword ? 600 : 500,
            lineHeight: data.keyword ? 1.6 : 1.35,
            color: data.keyword ? preset.textColor : preset.textSecondary,
            whiteSpace: "pre-line",
            position: "relative",
          }}
        >
          {data.keyword && data.subtitle.includes(data.keyword)
            ? data.subtitle.split(data.keyword).map((part, i, arr) => (
                <span key={i} style={{ position: "relative" }}>
                  {part}
                  {i < arr.length - 1 && (
                    <span
                      style={
                        data.keywordStyle !== "chip"
                          ? { ...brushStyle(preset, data.keyword || "", true, 0.32), fontWeight: 900, fontSize: "1.45em", margin: "0 14px", lineHeight: 1.25 }
                          : {
                              background: preset.highlightColor,
                              color: "#fff",
                              fontWeight: 900,
                              fontSize: "1.45em",
                              padding: "4px 30px 10px",
                              margin: "0 8px",
                              borderRadius: 22,
                              display: "inline-block",
                              lineHeight: 1.15,
                              verticalAlign: "middle",
                            }
                      }
                    >
                      <span style={{ position: "relative" }}>{data.keyword}</span>
                    </span>
                  )}
                </span>
              ))
            : data.subtitle}
        </div>
      )}
      <SlideCounter current={index} total={total} color={preset.accentColor} />
    </div>
  );
}

function getPointsFontSize(points: Array<{ type: string; text: string }>): number {
  const count = points.length;
  const maxLen = Math.max(...points.map((p) => p.text.length));
  let byCount = 62;
  if (count >= 6) byCount = 44;
  else if (count >= 5) byCount = 48;
  else if (count >= 4) byCount = 54;
  else if (count >= 3) byCount = 58;
  let byLen = 62;
  if (maxLen > 50) byLen = 44;
  else if (maxLen > 40) byLen = 50;
  else if (maxLen > 30) byLen = 56;
  return Math.min(byCount, byLen);
}

function IconCheck({ size }: { size: number }) {
  const stroke = Math.max(1.5, size * 0.1);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 13 9 18 20 7" />
    </svg>
  );
}

function IconCross({ size }: { size: number }) {
  const stroke = Math.max(1.5, size * 0.1);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

function SlideBody({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  return (
    <div
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        background: preset.bgGradient || preset.bg,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        fontFamily: preset.fontFamily,
        boxSizing: "border-box",
      }}
    >
      <SlideBackground bgType={bgType} slideIndex={index} preset={preset} />
      {data.type === "cta" && AVATAR_SRC && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={AVATAR_SRC}
          alt=""
          style={{ width: 168, height: 168, borderRadius: "50%", objectFit: "cover", marginBottom: 48, position: "relative", border: `6px solid ${preset.highlightColor}` }}
        />
      )}
      {data.badge && <Badge text={data.badge} preset={preset} />}
      {data.title && data.bigTitle && (
        <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em", color: preset.highlightColor, marginBottom: 44, position: "relative" }}>
          {data.title}
        </div>
      )}
      {data.title && !data.bigTitle && (
        <>
          <SlideTitle text={data.title} preset={preset} highlight={data.highlight} highlightStyle={data.highlightStyle} />
          <TitleDivider preset={preset} />
        </>
      )}
      {data.points ? (
        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          {data.points.map((point, i) => {
            const fontSize = getPointsFontSize(data.points!);
            const iconSize = Math.round(fontSize * 0.65);
            const isFirstMinus = point.type === "minus" && (i === 0 || data.points![i - 1].type === "plus");
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: Math.round(fontSize * 0.45),
                  marginTop: isFirstMinus ? Math.round(fontSize * 0.9) : (i === 0 ? 0 : Math.round(fontSize * 0.3)),
                }}
              >
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", color: point.type === "plus" ? "#22c55e" : preset.textSecondary }}>
                  {point.type === "plus" ? <IconCheck size={iconSize} /> : <IconCross size={iconSize} />}
                </div>
                <span style={{ fontSize, fontWeight: 600, color: point.type === "plus" ? preset.textColor : preset.textSecondary, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
                  {point.text}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            fontSize: getAdaptiveFontSize(data.text || "", "body"),
            fontWeight: preset.bodyFontWeight ?? 600,
            color: preset.bodyColor ?? preset.textColor,
            lineHeight: preset.bodyLineHeight ?? 1.2,
            whiteSpace: "pre-line",
            letterSpacing: "-0.01em",
            position: "relative",
            textWrap: "balance" as const,
          }}
        >
          {renderWithHighlight(data.text || "", data.highlight, preset, data.type === "cta" ? data.highlightStyle ?? "brush-solid" : data.highlightStyle)}
        </div>
      )}
      {(data.handle || (data.type === "cta" && data.ctaLabel)) && (
        <div
          style={{
            fontFamily: preset.fontFamily,
            fontSize: data.type === "cta" ? 46 : 36,
            fontWeight: data.type === "cta" ? 800 : 500,
            color: data.type === "cta" ? "#fff" : preset.textSecondary,
            background: data.type === "cta" ? preset.highlightColor : undefined,
            padding: data.type === "cta" ? "22px 44px" : undefined,
            borderRadius: data.type === "cta" ? 999 : undefined,
            alignSelf: data.type === "cta" ? "flex-start" : undefined,
            marginTop: 56,
            letterSpacing: "0.02em",
            position: "relative",
          }}
        >
          {data.ctaLabel ? (data.handle ? `${data.ctaLabel}  ` : data.ctaLabel) : ""}
          {data.handle && <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>{data.handle}</span>}
        </div>
      )}
      {data.type === "cta" && data.subtitle && (
        <div style={{ marginTop: 36, fontSize: 38, fontWeight: 500, lineHeight: 1.35, color: preset.textSecondary, whiteSpace: "pre-line", position: "relative" }}>
          {renderWithHighlight(data.subtitle, data.subtitleHighlight, preset, "brush-solid", 1.18)}
        </div>
      )}
      <SlideCounter current={index} total={total} color={preset.accentColor} />
    </div>
  );
}

// ============================================================
// NEW SLIDE TYPES
// ============================================================

function SlideShell({
  children,
  preset,
  index,
  total,
  bgType,
  center,
}: {
  children: ReactNode;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
  center?: boolean;
}) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  return (
    <div
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        background: preset.bgGradient || preset.bg,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "center",
        padding: "80px",
        fontFamily: preset.fontFamily,
        boxSizing: "border-box",
      }}
    >
      <SlideBackground bgType={bgType} slideIndex={index} preset={preset} />
      {children}
      <SlideCounter current={index} total={total} color={preset.accentColor} />
    </div>
  );
}

function SlideList({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const items = data.items || [];
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType}>
      {data.badge && <Badge text={data.badge} preset={preset} />}
      {data.title && (
        <>
          <SlideTitle text={data.title} preset={preset} highlight={data.highlight} highlightStyle={data.highlightStyle} />
          <TitleDivider preset={preset} />
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 32, position: "relative" }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 28,
            }}
          >
            <div
              style={{
                fontFamily: preset.fontFamily,
                fontSize: 48,
                fontWeight: 800,
                color: preset.highlightColor,
                lineHeight: 1,
                minWidth: 80,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div
              style={{
                fontSize: 46,
                fontWeight: 600,
                color: preset.textColor,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                flex: 1,
                textWrap: "balance" as const,
              }}
            >
              {item}
            </div>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SlideStats({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const stats = data.stats || [];
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType}>
      {data.badge && <Badge text={data.badge} preset={preset} />}
      {data.title && (
        <>
          <SlideTitle text={data.title} preset={preset} highlight={data.highlight} highlightStyle={data.highlightStyle} />
          <TitleDivider preset={preset} />
        </>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: stats.length > 2 ? "column" : "row",
          gap: stats.length > 2 ? 32 : 48,
          position: "relative",
        }}
      >
        {stats.map((stat, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                fontFamily: preset.fontFamily,
                fontSize: stats.length > 2 ? 116 : stats.length === 2 && data.text ? 150 : 170,
                fontWeight: 900,
                color: preset.highlightColor,
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 500,
                color: preset.textSecondary,
                marginTop: 12,
                textTransform: /[֐-׿]/.test(stat.label) ? "none" : "uppercase",
                whiteSpace: "pre-line",
                letterSpacing: "0.08em",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      {data.text && (
        <div style={{ marginTop: 44, fontSize: 40, fontWeight: 600, lineHeight: 1.4, color: preset.textColor, whiteSpace: "pre-line", position: "relative" }}>
          {renderWithHighlight(data.text, data.highlight, preset, data.highlightStyle ?? "marker")}
        </div>
      )}
    </SlideShell>
  );
}

function SlideQuote({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType}>
      <div
        style={{
          fontFamily: preset.fontFamily,
          fontSize: 200,
          fontWeight: 900,
          color: preset.highlightColor,
          lineHeight: 0.7,
          marginBottom: 24,
          position: "relative",
        }}
      >
        “
      </div>
      <div
        style={{
          fontSize: 62,
          fontWeight: 600,
          color: preset.textColor,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          whiteSpace: "pre-line",
          position: "relative",
          textWrap: "balance" as const,
        }}
      >
        {renderWithHighlight(data.text || "", data.highlight, preset, data.highlightStyle)}
      </div>
      {data.author && (
        <div
          style={{
            marginTop: 48,
            fontFamily: preset.fontFamily,
            fontSize: 46,
            fontWeight: 800,
            color: preset.accentColor,
            letterSpacing: "0.02em",
            position: "relative",
          }}
        >
          {data.author}
          {data.role && (
            <div style={{ color: preset.textSecondary, fontWeight: 600, fontSize: 36, letterSpacing: 0, marginTop: 8 }}>
              {data.role}
            </div>
          )}
        </div>
      )}
    </SlideShell>
  );
}

function SlideChecklist({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const items = data.items || [];
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType}>
      {data.badge && <Badge text={data.badge} preset={preset} />}
      {data.title && (
        <>
          <SlideTitle text={data.title} preset={preset} highlight={data.highlight} highlightStyle={data.highlightStyle} />
          <TitleDivider preset={preset} />
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative" }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: preset.highlightColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: preset.bg,
                fontSize: 34,
                fontWeight: 900,
                fontFamily: preset.fontFamily,
              }}
            >
              ✓
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 600,
                color: preset.textColor,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                flex: 1,
              }}
            >
              {item}
            </div>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SlideProcess({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const steps = data.steps || [];
  // fuller layout: every step is a tinted card (big number, bold title, readable text) + optional closing line (`text`) so the slide never feels sparse
  const n = steps.length;
  const titleSize = n <= 3 ? 48 : n === 4 ? 42 : 38;
  const textSize = n <= 3 ? 38 : 35;
  const circle = n <= 3 ? 88 : n === 4 ? 76 : 68;
  const cardFill = mixHex(preset.highlightColor, preset.bg, 0.1);
  const cardLine = mixHex(preset.highlightColor, preset.bg, 0.38);
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType}>
      {data.badge && <Badge text={data.badge} preset={preset} />}
      {data.title && (
        <>
          <SlideTitle text={data.title} preset={preset} highlight={data.highlight} highlightStyle={data.highlightStyle} />
          <TitleDivider preset={preset} />
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: n <= 3 ? 24 : 18, position: "relative" }}>
        {steps.map((step, i) => (
          <div key={i} style={{ position: "relative" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 30,
                padding: n <= 3 ? "28px 34px" : "22px 30px",
                background: cardFill,
                border: `3px solid ${cardLine}`,
                borderRadius: 28,
              }}
            >
              <div
                style={{
                  width: circle,
                  height: circle,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: preset.highlightColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontFamily: preset.fontFamily,
                  fontWeight: 900,
                  fontSize: Math.round(circle * 0.55),
                  boxShadow: `0 6px 0 ${mixHex(preset.highlightColor, "#000000", 0.75)}33`,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: preset.fontFamily,
                    fontSize: titleSize,
                    fontWeight: 800,
                    lineHeight: 1.15,
                    color: preset.textColor,
                    letterSpacing: "-0.01em",
                    marginBottom: step.text ? 10 : 0,
                  }}
                >
                  {step.title}
                </div>
                {step.text && (
                  <div style={{ fontSize: textSize, fontWeight: 600, color: preset.textSecondary, lineHeight: 1.3 }}>
                    {step.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {data.text && (
        <div
          style={{
            marginTop: 32,
            marginBottom: 56, // lifts the whole centred block, keeping the closing line clear of the swipe arrow
            fontSize: 44,
            fontWeight: 800,
            lineHeight: 1.45,
            color: preset.textColor,
            position: "relative",
          }}
        >
          {renderWithHighlight(data.text, data.highlight, preset, data.highlightStyle ?? "marker")}
        </div>
      )}
    </SlideShell>
  );
}

function SlideComparison({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const allItems = [...(data.leftItems || []), ...(data.rightItems || [])];
  const maxItems = Math.max(data.leftItems?.length || 0, data.rightItems?.length || 0);
  const maxItemLen = Math.max(0, ...allItems.map((i) => i.length));
  let itemSize = 48;
  if (maxItems >= 5 || maxItemLen > 48) itemSize = 34;
  else if (maxItems >= 4 || maxItemLen > 36) itemSize = 40;
  else if (maxItemLen > 26) itemSize = 44;
  const labelSize = 40;

  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType}>
      {data.title && (
        <>
          <SlideTitle text={data.title} preset={preset} highlight={data.highlight} highlightStyle={data.highlightStyle} />
          <TitleDivider preset={preset} />
        </>
      )}
      <div style={{ display: "flex", gap: 32, position: "relative", flex: 1, alignItems: "stretch" }}>
        {[
          { label: data.leftLabel || "", items: data.leftItems || [], color: "#EF4444" },
          { label: data.rightLabel || "", items: data.rightItems || [], color: "#22C55E" },
        ].map((col, ci) => (
          <div
            key={ci}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              padding: 36,
              border: `3px solid ${col.color}`,
              borderRadius: 16,
            }}
          >
            <div
              style={{
                fontFamily: preset.fontFamily,
                fontSize: labelSize,
                fontWeight: 800,
                color: col.color,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 16,
              }}
            >
              {col.label}
            </div>
            {col.items.map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: itemSize,
                  fontWeight: 500,
                  color: preset.textColor,
                  lineHeight: 1.25,
                }}
              >
                · {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SlideImage({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType}>
      {data.badge && <Badge text={data.badge} preset={preset} />}
      {data.title && (
        <>
          <SlideTitle text={data.title} preset={preset} highlight={data.highlight} highlightStyle={data.highlightStyle} />
          <TitleDivider preset={preset} />
        </>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 32,
          position: "relative",
          minHeight: 0,
        }}
      >
        {data.imageSrc && (
          <img
            src={data.imageSrc}
            alt={data.imageCaption || data.title || "slide image"}
            crossOrigin="anonymous"
            style={{
              maxWidth: "100%",
              maxHeight: data.imageCaption ? "64%" : "88%",
              objectFit: "contain",
              borderRadius: 18,
              boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
              display: "block",
            }}
          />
        )}
        {data.imageCaption && (
          <div
            style={{
              fontFamily: preset.fontFamily,
              fontSize: 48,
              fontWeight: 700,
              color: preset.textColor,
              letterSpacing: "-0.01em",
              textAlign: "start",
              alignSelf: "stretch",
              lineHeight: 1.25,
              textWrap: "balance" as const,
            }}
          >
            {renderWithHighlight(data.imageCaption, data.highlight, preset, data.highlightStyle)}
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function SlideBars({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const bars = data.bars || [];
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType}>
      {data.badge && <Badge text={data.badge} preset={preset} />}
      {data.title && (
        <>
          <SlideTitle text={data.title} preset={preset} highlight={data.highlight} highlightStyle={data.highlightStyle} />
          <TitleDivider preset={preset} />
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 26, position: "relative", direction: "ltr", marginTop: 8 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 210, flexShrink: 0, fontSize: 32, fontWeight: b.highlight ? 800 : 500, color: b.highlight ? preset.textColor : preset.textSecondary, textAlign: "right" }}>
              {b.label}
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  height: 46,
                  width: `${Math.max((b.value / max) * 100, 1.5)}%`,
                  maxWidth: "calc(100% - 100px)",
                  borderRadius: 10,
                  background: b.highlight ? preset.highlightColor : preset.textColor,
                  opacity: b.highlight ? 1 : 0.16,
                }}
              />
              <div style={{ fontSize: 34, fontWeight: b.highlight ? 900 : 600, color: b.highlight ? preset.highlightColor : preset.textColor }}>{b.value}</div>
            </div>
          </div>
        ))}
      </div>
      {data.barsUnit && (
        <div style={{ marginTop: 36, fontSize: 32, fontWeight: 500, color: preset.textSecondary, position: "relative" }}>{data.barsUnit}</div>
      )}
    </SlideShell>
  );
}

function SlideEmoji({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType} center>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
        }}
      >
        {data.emoji && (
          <div
            style={{
              fontSize: 360,
              lineHeight: 1,
              marginBottom: 48,
              // deliberately no fontFamily — let OS emoji font render in color
            }}
          >
            {data.emoji}
          </div>
        )}
        {data.title && (
          <div
            style={{
              fontFamily: preset.fontFamily,
              fontSize: preset.titleFontSize ?? 72,
              fontWeight: preset.titleFontWeight ?? 800,
              color: preset.titleColor ?? preset.textColor,
              textTransform: (preset.titleUppercase ?? true) ? "uppercase" : "none",
              letterSpacing: (preset.titleUppercase ?? true) ? "0.04em" : "-0.02em",
              lineHeight: 1.1,
              marginBottom: data.text ? 20 : 0,
              textWrap: "balance" as const,
            }}
          >
            {renderWithHighlight(data.title, data.highlight, preset, data.highlightStyle)}
          </div>
        )}
        {data.text && (
          <div
            style={{
              fontFamily: preset.fontFamily,
              fontSize: 56,
              fontWeight: 500,
              color: preset.textSecondary,
              lineHeight: 1.25,
              maxWidth: "88%",
              textWrap: "balance" as const,
              whiteSpace: "pre-line",
            }}
          >
            {data.text}
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function SlideNumber({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const num = data.bigNumber || "";
  const size = num.length <= 1 ? 560 : num.length <= 2 ? (data.text ? 340 : 440) : num.length <= 4 ? (data.text ? 320 : 420) : 320;
  return (
    <SlideShell preset={preset} index={index} total={total} bgType={bgType} center>
      {data.badge && <Badge text={data.badge} preset={preset} />}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: preset.hookFontFamily || preset.fontFamily,
            fontSize: size,
            fontWeight: 900,
            color: preset.highlightColor,
            lineHeight: 0.9,
            letterSpacing: "-0.05em",
            marginBottom: 24,
          }}
        >
          {num}
        </div>
        {data.title && (
          <div
            style={{
              fontFamily: preset.fontFamily,
              fontSize: 64,
              fontWeight: 800,
              color: preset.textColor,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textWrap: "balance" as const,
              marginBottom: data.text ? 16 : 0,
            }}
          >
            {renderWithHighlight(data.title, data.highlight, preset, data.highlightStyle)}
          </div>
        )}
        {data.text && (
          <div
            style={{
              fontFamily: preset.fontFamily,
              fontSize: 48,
              fontWeight: 500,
              color: preset.textSecondary,
              lineHeight: 1.25,
              whiteSpace: "pre-line",
              textWrap: "balance" as const,
            }}
          >
            {renderWithHighlight(data.text, data.highlight, preset, data.highlightStyle ?? "marker")}
          </div>
        )}
        {data.teaser && (
          // forward pull: a small teaser of what comes next in the carousel
          <div style={{ marginTop: 30, fontFamily: preset.fontFamily, fontSize: 42, fontWeight: 800, color: preset.highlightColor, lineHeight: 1.25, whiteSpace: "pre-line" }}>
            {data.teaser}
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function SlideInner({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  switch (data.type) {
    case "hook":
      return <SlideHook data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "list":
      return <SlideList data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "stats":
      return <SlideStats data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "quote":
      return <SlideQuote data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "checklist":
      return <SlideChecklist data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "process":
      return <SlideProcess data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "comparison":
      return <SlideComparison data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "image":
      return <SlideImage data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "emoji":
      return <SlideEmoji data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "bars":
      return <SlideBars data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "number":
      return <SlideNumber data={data} preset={preset} index={index} total={total} bgType={bgType} />;
    case "body":
    case "cta":
    default:
      return <SlideBody data={data} preset={preset} index={index} total={total} bgType={bgType} />;
  }
}

// Slides render right-to-left (Hebrew). `direction` is inherited by every slide type.
// Also draws the account handle (and optional avatar) bottom-start on every slide except the CTA,
// which already shows the handle.
// SVG decor/arrows are drawn in the brand colour: the shipped blue assets (#3B82F6) are recoloured to the chosen accent at runtime (cached data URI;
// the default blue accent uses the file as-is). Colours "dark" and "white" stay as they are.
const svgCache = new Map<string, string>();
function AccentSvg({ name, accent, style }: { name: string; accent: string; style: React.CSSProperties }) {
  const base = `/images/svg/blue/${name}.svg`;
  const same = accent.toLowerCase() === "#3b82f6";
  const key = `${name}|${accent}`;
  const [src, setSrc] = useState<string | null>(() => (same ? base : svgCache.get(key) ?? null));
  useEffect(() => {
    if (same) { setSrc(base); return; }
    const hit = svgCache.get(key);
    if (hit) { setSrc(hit); return; }
    let alive = true;
    fetch(base)
      .then((r) => r.text())
      .then((t) => {
        const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t.replace(/#3B82F6/gi, accent))}`;
        svgCache.set(key, uri);
        if (alive) setSrc(uri);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [base, accent, key, same]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src ?? undefined} alt="" style={{ ...style, visibility: src ? "visible" : "hidden" }} />;
}

// five similar-but-different swipe arrows (assets: public/images/svg/<colour>/swipe-arrow*.svg) with small per-slide variations
const ARROW_FILES = ["swipe-arrow", "swipe-arrow-3", "swipe-arrow-2", "swipe-arrow-4", "swipe-arrow-5"];
const ARROW_W = [150, 160, 152, 150, 140];
const ARROW_RIGHT = [80, 86, 78, 84, 82];
const ARROW_BOTTOM = [168, 162, 172, 165, 170]; // lowered 2026-10-02 so full-height slides (process cards) keep clear of it
const ARROW_ROT = [-2, 3, -4, 2, -3];

function Slide(props: React.ComponentProps<typeof SlideInner>) {
  const { w, h } = useCanvasSize();
  const { preset, data } = props;
  const showFooter = (HANDLE || AVATAR_SRC) && data.type !== "cta";
  // swipe arrow on every slide except the last/CTA; the variant rotates with the slide index (slide-level `arrow` overrides: false = none, number = fixed variant)
  const autoArrow = AUTO_ARROW && data.arrow !== false && data.type !== "cta" && props.index < props.total - 1;
  const arrowIdx = typeof data.arrow === "number" ? data.arrow % ARROW_FILES.length : props.index % ARROW_FILES.length;
  const arrowDark = relLuminance(preset.bg) < 0.35;
  return (
    <div dir="rtl" style={{ direction: "rtl", position: "relative", width: w, height: h }}>
      <SlideInner {...props} />
      {data.sticker && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/images/stickers/${data.sticker}.png`}
          alt=""
          style={{
            position: "absolute",
            width: 260,
            height: "auto",
            filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.18))",
            ...(data.stickerPos === "top-left"
              ? { top: 70, left: 60 }
              : data.stickerPos === "bottom-right"
              ? { bottom: 100, right: 60 }
              : { bottom: 100, left: 60 }),
          }}
        />
      )}
      {data.decor?.map((d, i) => {
        const st: React.CSSProperties = {
          position: "absolute",
          width: d.w ?? 160,
          height: d.h ?? "auto",
          top: d.top,
          left: d.left,
          right: d.right,
          bottom: d.bottom,
          opacity: d.opacity,
          transform: `${d.flipX ? "scaleX(-1) " : ""}rotate(${d.rotate ?? 0}deg)`,
          pointerEvents: "none",
        };
        return !d.color || d.color === "blue" ? (
          <AccentSvg key={i} name={d.name} accent={preset.highlightColor} style={st} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={`/images/svg/${d.color}/${d.name}.svg`} alt="" style={st} />
        );
      })}
      {autoArrow &&
        (arrowDark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/images/svg/white/${ARROW_FILES[arrowIdx]}.svg`} alt="" style={{
            position: "absolute",
            width: ARROW_W[arrowIdx % ARROW_W.length],
            height: "auto",
            right: ARROW_RIGHT[arrowIdx % ARROW_RIGHT.length],
            bottom: ARROW_BOTTOM[arrowIdx % ARROW_BOTTOM.length],
            transform: `rotate(${ARROW_ROT[arrowIdx % ARROW_ROT.length]}deg)`,
            pointerEvents: "none",
          }} />
        ) : (
          <AccentSvg name={ARROW_FILES[arrowIdx]} accent={preset.highlightColor} style={{
            position: "absolute",
            width: ARROW_W[arrowIdx % ARROW_W.length],
            height: "auto",
            right: ARROW_RIGHT[arrowIdx % ARROW_RIGHT.length],
            bottom: ARROW_BOTTOM[arrowIdx % ARROW_BOTTOM.length],
            transform: `rotate(${ARROW_ROT[arrowIdx % ARROW_ROT.length]}deg)`,
            pointerEvents: "none",
          }} />
        ))}
      {showFooter && (
        <div
          style={{
            position: "absolute",
            bottom: 44,
            right: 170, // keep clear of Instagram's sound/mute button (bottom-right corner, ≈ x 965–1050, y 1240–1310): it used to cover the avatar
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: preset.textSecondary,
            fontSize: 28,
            fontWeight: 500,
            fontFamily: preset.fontFamily,
          }}
        >
          {AVATAR_SRC && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={AVATAR_SRC} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} />
          )}
          {HANDLE && <span style={{ direction: "ltr" }}>{HANDLE}</span>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PREVIEW + EXPORT
// ============================================================

function SlidePreview({
  data,
  preset,
  index,
  total,
  bgType,
}: {
  data: SlideData;
  preset: StylePreset;
  index: number;
  total: number;
  bgType: BgType;
}) {
  const { w: CANVAS_W, h: CANVAS_H } = useCanvasSize();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const parentW = entry.contentRect.width;
        setScale(parentW / CANVAS_W);
      }
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [CANVAS_W]);

  return (
    <div
      className="slide-preview-wrapper"
      style={{
        width: "100%",
        aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
        overflow: "hidden",
        borderRadius: 12,
        position: "relative",
      }}
    >
      <div
        ref={containerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: CANVAS_W,
          height: CANVAS_H,
        }}
      >
        <Slide data={data} preset={preset} index={index} total={total} bgType={bgType} />
      </div>
    </div>
  );
}

// ============================================================
// I18N
// ============================================================

type Lang = "en" | "he";

const T = {
  en: {
    appTitle: "Threads Carousel",
    rowFont: "Font",
    rowSurface: "Surface",
    rowAccent: "Accent",
    rowBg: "Background",
    rowMode: "Mode",
    rowFormat: "Format",
    btnPdf: "Export PDF",
    btnAll: "Export All",
    statusDone: "Done!",
    statusExport: (i: number, n: number) => `Exporting ${i}/${n}...`,
    statusPdf: (i: number, n: number) => `PDF ${i}/${n}...`,
    footer: (w: number, h: number, n: number) =>
      `${w}×${h}px — ${n} slides — Click a slide to export individually`,
    modes: { carousel: "Carousel", presentation: "Presentation" } as Record<PurposeId, string>,
    bgs: {
      none: "None", blobs: "Blobs", grid: "Grid", lines: "Lines",
      noise: "Noise", bignumber: "Bignumber", glow: "Glow", paper: "Ruled",
    } as Record<BgType, string>,
    surfaces: {
      dark: "Dark", white: "White", light: "Light", paper: "Paper",
      gradient: "Gradient", pastel: "Pastel", neon: "Neon", ember: "Ember",
    } as Record<SurfaceId, string>,
    accents: {
      yellow: "Yellow", red: "Red", teal: "Teal", coral: "Coral",
      orange: "Orange", violet: "Violet", lime: "Lime", blue: "Blue",
      fuchsia: "Fuchsia", pink: "Pink", amber: "Amber",
    } as Record<AccentId, string>,
  },
  he: {
    appTitle: "Threads Carousel",
    rowFont: "גופן",
    rowSurface: "רקע",
    rowAccent: "צבע דגש",
    rowBg: "עיטור",
    rowMode: "מצב",
    rowFormat: "פורמט",
    btnPdf: "ייצוא PDF",
    btnAll: "ייצוא הכל",
    statusDone: "בוצע!",
    statusExport: (i: number, n: number) => `מייצא ${i}/${n}...`,
    statusPdf: (i: number, n: number) => `PDF ${i}/${n}...`,
    footer: (w: number, h: number, n: number) =>
      `${w}×${h}px — ${n} שקפים — לחצו על שקף לייצוא בודד`,
    modes: { carousel: "קרוסלה", presentation: "מצגת" } as Record<PurposeId, string>,
    bgs: {
      none: "ללא", blobs: "כתמים", grid: "רשת", lines: "קווים",
      noise: "רעש", bignumber: "מספר גדול", glow: "זוהר", paper: "דפי שורות",
    } as Record<BgType, string>,
    surfaces: {
      dark: "כהה", white: "לבן", light: "בהיר", paper: "נייר",
      gradient: "גרדיאנט", pastel: "פסטל", neon: "ניאון", ember: "גחלים",
    } as Record<SurfaceId, string>,
    accents: {
      yellow: "צהוב", red: "אדום", teal: "טורקיז", coral: "קורל",
      orange: "כתום", violet: "סגול", lime: "ליים", blue: "כחול",
      fuchsia: "פוקסיה", pink: "ורוד", amber: "ענבר",
    } as Record<AccentId, string>,
  },
} as const;

// ============================================================
// MAIN PAGE
// ============================================================

export default function CarouselPage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const [fontId, setFontId] = useState<FontId>(DEFAULT_FONT);
  const [surfaceId, setSurfaceId] = useState<SurfaceId>(DEFAULT_SURFACE);
  const [accentId, setAccentId] = useState<AccentId>(DEFAULT_ACCENT);
  const [purposeId, setPurposeId] = useState<PurposeId>(DEFAULT_PURPOSE);
  const [formatId, setFormatId] = useState<FormatId>(DEFAULT_FORMAT);
  const [bgType, setBgType] = useState<BgType>(DEFAULT_BG);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const langRef = useRef<Lang>("en");
  langRef.current = lang;
  const offscreenRefs = useRef<(HTMLDivElement | null)[]>([]);

  const canvasW = FORMAT_PRESETS[formatId].w;
  const canvasH = FORMAT_PRESETS[formatId].h;
  const preset = composePreset(FONT_STYLES[fontId], SURFACES[surfaceId], ACCENTS[accentId], purposeId);

  const captureSlide = useCallback(
    async (index: number): Promise<string | null> => {
      const el = offscreenRefs.current[index];
      if (!el) return null;

      el.style.opacity = "1";
      el.style.zIndex = "-1";
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const opts = {
        width: canvasW,
        height: canvasH,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: preset.bg,
      };

      // Double-call: first warms fonts/images, second captures
      await toPng(el, opts);
      await new Promise((r) => setTimeout(r, 120));
      const dataUrl = await toPng(el, opts);

      el.style.opacity = "0";
      el.style.zIndex = "-1";
      return dataUrl;
    },
    [preset.bg, canvasW, canvasH]
  );

  const exportSlide = useCallback(
    async (index: number) => {
      const dataUrl = await captureSlide(index);
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.download = `${String(index + 1).padStart(2, "0")}-${SLIDES[index].type}.png`;
      link.href = dataUrl;
      link.click();
    },
    [captureSlide]
  );

  const exportAll = useCallback(async () => {
    setExporting(true);
    const tl = T[langRef.current];
    for (let i = 0; i < SLIDES.length; i++) {
      setExportStatus(tl.statusExport(i + 1, SLIDES.length));
      await exportSlide(i);
      await new Promise((r) => setTimeout(r, 300));
    }
    setExportStatus(tl.statusDone);
    setExporting(false);
    setTimeout(() => setExportStatus(""), 2000);
  }, [exportSlide]);

  // Save the approved carousel (PNGs + slides snapshot + caption + meta) to <project>/Published/ via /api/archive.
  const archiveAll = useCallback(async () => {
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const slug = POST_META.slug;
      for (let i = 0; i < SLIDES.length; i++) {
        setExportStatus(`Archive ${i + 1}/${SLIDES.length}`);
        const dataUrl = await captureSlide(i);
        if (!dataUrl) continue;
        const r = await fetch("/api/archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "slide", date, slug, name: `${String(i + 1).padStart(2, "0")}-${SLIDES[i].type}.png`, dataUrl }),
        });
        if (!r.ok) throw new Error("slide " + (i + 1) + " failed");
        await new Promise((res) => setTimeout(res, 150));
      }
      const hook = SLIDES[0];
      const meta = {
        date,
        slug,
        title: POST_META.title,
        topic: POST_META.topic,
        type: POST_META.type,
        hook: [hook.heroName, hook.text].filter(Boolean).join(" — ").replace(/\n/g, " "),
        keyword: POST_META.keyword || "",
        sources: POST_META.sources || [],
        guide: POST_META.guide || "",
        settings: { format: formatId, mode: purposeId, font: fontId, surface: surfaceId, accent: accentId, background: bgType },
        slides: SLIDES.map((sl, i) => ({ n: i + 1, type: sl.type, title: sl.title || sl.heroName || (sl.text || "").replace(/\n/g, " ").slice(0, 60) })),
        post_url: null,
        notes: "",
        metrics: { views: null, reach: null, likes: null, comments: null, saves: null, shares: null, profile_follows: null, keyword_comments: null, checked_at: null },
      };
      const r2 = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize", date, slug, meta, caption: POST_META.caption }),
      });
      const j = await r2.json();
      setExportStatus(j.ok ? `Archived ✓ ${j.slides} slides, ${j.totalKB} KB → Published/${date}_${slug}` : "Archive failed");
    } catch (e) {
      setExportStatus("Archive failed: " + (e as Error).message);
    }
    setExporting(false);
    setTimeout(() => setExportStatus(""), 8000);
  }, [captureSlide, formatId, purposeId, fontId, surfaceId, accentId, bgType]);

  const exportPdf = useCallback(async () => {
    setExporting(true);
    const isLandscape = canvasW > canvasH;
    const orientation = isLandscape ? "landscape" : "portrait";
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation, unit: "px", format: [canvasW, canvasH], hotfixes: ["px_scaling"] });
    const jpegOpts = { width: canvasW, height: canvasH, pixelRatio: 2, cacheBust: true, backgroundColor: preset.bg, quality: 0.92 };

    const tl = T[langRef.current];
    for (let i = 0; i < SLIDES.length; i++) {
      setExportStatus(tl.statusPdf(i + 1, SLIDES.length));
      const el = offscreenRefs.current[i];
      if (!el) continue;

      el.style.opacity = "1";
      el.style.zIndex = "-1";
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await toJpeg(el, jpegOpts); // warm up
      await new Promise((r) => setTimeout(r, 120));
      const dataUrl = await toJpeg(el, jpegOpts);
      el.style.opacity = "0";
      el.style.zIndex = "-1";

      if (i > 0) pdf.addPage([canvasW, canvasH], orientation);
      pdf.addImage(dataUrl, "JPEG", 0, 0, canvasW, canvasH);
      await new Promise((r) => setTimeout(r, 200));
    }

    pdf.save("slides.pdf");
    setExportStatus(T[langRef.current].statusDone);
    setExporting(false);
    setTimeout(() => setExportStatus(""), 2000);
  }, [preset.bg, canvasW, canvasH]);

  return (
    <CanvasSizeContext.Provider value={{ w: canvasW, h: canvasH }}>
    <div suppressHydrationWarning style={{ minHeight: "100vh", padding: 32 }}>
      {/* Toolbar */}
      <div style={{ marginBottom: 32 }}>
        {/* Title + Export + Lang toggle */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, textWrap: "balance" } as React.CSSProperties}>{t.appTitle}</h1>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              {FORMAT_PRESETS[formatId].name} — {canvasW}×{canvasH}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {/* Lang toggle */}
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #333" }}>
              {(["en", "he"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="tb-btn"
                  style={{
                    padding: "9px 12px",
                    minHeight: 36,
                    border: "none",
                    background: lang === l ? "#555" : "transparent",
                    color: lang === l ? "#fff" : "#888",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <button onClick={exportPdf} disabled={exporting} style={{ padding: "8px 20px", minWidth: 120, minHeight: 36, borderRadius: 8, border: "none", background: exporting ? "#444" : "#6366F1", color: "#fff", cursor: exporting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }} className="tb-btn">
              {exporting ? exportStatus : t.btnPdf}
            </button>
            <button onClick={exportAll} disabled={exporting} style={{ padding: "8px 20px", minWidth: 110, minHeight: 36, borderRadius: 8, border: "none", background: exporting ? "#444" : "#22C55E", color: "#fff", cursor: exporting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }} className="tb-btn">
              {exporting ? exportStatus : t.btnAll}
            </button>
            <button onClick={archiveAll} disabled={exporting} title="Save to Published/ (PNGs, caption, meta, index.csv)" style={{ padding: "8px 20px", minWidth: 110, minHeight: 36, borderRadius: 8, border: "none", background: exporting ? "#444" : "#F59E0B", color: "#fff", cursor: exporting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600 }} className="tb-btn">
              📁 Archive
            </button>
          </div>
        </div>

        {/* 5-row axis toolbar — order: Format → Mode → Font → Color → Background */}
        {/* key={lang} causes remount → tbFadeIn animation plays on language switch */}
        <div key={lang} className="tb-lang-fade" style={{ display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Format */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#666", width: 90, flexShrink: 0 }}>{t.rowFormat}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.values(FORMAT_PRESETS).map((f) => (
                <button key={f.id} onClick={() => setFormatId(f.id)} title={f.platform} style={{ padding: "9px 14px", minHeight: 36, borderRadius: 8, border: formatId === f.id ? "2px solid #06B6D4" : "1px solid #333", background: formatId === f.id ? "#06B6D4" : "transparent", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }} className="tb-btn">
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#666", width: 90, flexShrink: 0 }}>{t.rowMode}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {(["carousel", "presentation"] as PurposeId[]).map((p) => (
                <button key={p} onClick={() => setPurposeId(p)} style={{ padding: "9px 14px", minWidth: 110, minHeight: 36, borderRadius: 8, border: purposeId === p ? "2px solid #F59E0B" : "1px solid #333", background: purposeId === p ? "#F59E0B" : "transparent", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }} className="tb-btn">
                  {t.modes[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#666", width: 90, flexShrink: 0 }}>{t.rowFont}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.values(FONT_STYLES).map((f) => (
                <button key={f.id} onClick={() => setFontId(f.id)} style={{ padding: "9px 14px", minHeight: 36, borderRadius: 8, border: fontId === f.id ? "2px solid #6366F1" : "1px solid #333", background: fontId === f.id ? "#6366F1" : "transparent", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }} className="tb-btn">
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Surface (bg + text) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#666", width: 90, flexShrink: 0 }}>{t.rowSurface}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.values(SURFACES).map((s) => (
                <button key={s.id} onClick={() => setSurfaceId(s.id)} style={{ padding: "9px 14px", minHeight: 36, borderRadius: 8, border: surfaceId === s.id ? "2px solid #6366F1" : "1px solid #333", background: surfaceId === s.id ? "#6366F1" : "transparent", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }} className="tb-btn">
                  {t.surfaces[s.id]}
                </button>
              ))}
            </div>
          </div>

          {/* Accent (pop color) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#666", width: 90, flexShrink: 0 }}>{t.rowAccent}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.values(ACCENTS).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccentId(a.id)}
                  title={t.accents[a.id]}
                  style={{
                    padding: "9px 14px",
                    minHeight: 36,
                    borderRadius: 8,
                    border: accentId === a.id ? `2px solid ${a.color}` : "1px solid #333",
                    background: accentId === a.id ? a.color : "transparent",
                    color: accentId === a.id ? "#000" : "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  className="tb-btn"
                >
                  {t.accents[a.id]}
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#666", width: 90, flexShrink: 0 }}>{t.rowBg}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["none", "blobs", "grid", "lines", "paper", "noise", "bignumber", "glow"] as BgType[]).map((bg) => (
                <button key={bg} onClick={() => setBgType(bg)} style={{ padding: "9px 12px", minHeight: 36, borderRadius: 8, border: bgType === bg ? "2px solid #22C55E" : "1px solid #333", background: bgType === bg ? "#22C55E" : "transparent", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }} className="tb-btn">
                  {t.bgs[bg]}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Preview Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 20,
        }}
      >
        {SLIDES.map((slide, i) => (
          <div key={i}>
            <div
              onClick={() => !exporting && exportSlide(i)}
              className="slide-card"
              title="Click to export this slide"
            >
              <SlidePreview
                data={slide}
                preset={preset}
                index={i}
                total={SLIDES.length}
                bgType={bgType}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#888",
                marginTop: 8,
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}/{SLIDES.length} — {slide.type}
            </div>
          </div>
        ))}
      </div>

      {/* Offscreen slides for export — always rendered at (0,0), invisible via opacity */}
      {SLIDES.map((slide, i) => (
        <div
          key={`export-${i}`}
          ref={(el) => {
            offscreenRefs.current[i] = el;
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: canvasW,
            height: canvasH,
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
            fontFamily: preset.fontFamily,
          }}
        >
          <Slide data={slide} preset={preset} index={i} total={SLIDES.length} bgType={bgType} />
        </div>
      ))}

      {/* Info */}
      <div
        style={{
          marginTop: 32,
          fontSize: 13,
          color: "#666",
          textAlign: "center",
        }}
      >
        {t.footer(canvasW, canvasH, SLIDES.length)}
      </div>
    </div>
    </CanvasSizeContext.Provider>
  );
}
