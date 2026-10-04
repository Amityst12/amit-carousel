// ============================================================
// Shared type definitions for carousel slides and presets.
// Imported by both page.tsx (browser preview) and any future
// server-side renderer (e.g. Satori export script).
// ============================================================

// "marker" = adaptive dry-brush stroke BEHIND the phrase (light brand tint) + brand-blue text; "brush-solid" = opaque brand brush + white text (keywords, numbers)
export type HighlightStyle = "default" | "italic-box" | "marker" | "brush-solid";

export type SlideType =
  | "hook"
  | "body"
  | "cta"
  | "quote"
  | "stats"
  | "list"
  | "checklist"
  | "process"
  | "comparison"
  | "image"
  | "emoji"
  | "number"
  | "bars";

export type BgType =
  | "none"
  | "blobs"
  | "grid"
  | "lines"
  | "noise"
  | "bignumber"
  | "glow"
  | "paper";

export type FormatId =
  | "threads-4x5"
  | "instagram-square"
  | "linkedin-square"
  | "tiktok-9x16"
  | "story-9x16"
  | "wide-16x9";

// ---- Three independent style axes ----

/** Font / typeface selection */
export type FontId = "minimal" | "editorial" | "clean" | "mono" | "condensed" | "hebrew" | "rubik" | "secular" | "frank" | "suez";

/** Surface — bg + text neutrals (no pop color). */
export type SurfaceId =
  | "dark"
  | "white"
  | "light"
  | "paper"
  | "gradient"
  | "pastel"
  | "neon"
  | "ember";

/** Accent — the pop color used for highlighted words. */
export type AccentId =
  | "yellow"
  | "red"
  | "teal"
  | "coral"
  | "orange"
  | "violet"
  | "lime"
  | "blue"
  | "fuchsia"
  | "pink"
  | "amber";

/** Layout purpose — drives typography scale */
export type PurposeId = "carousel" | "presentation";

export interface FontStyle {
  id: FontId;
  name: string;
  fontFamily: string;
  hookFontFamily?: string;
}

export interface Surface {
  id: SurfaceId;
  name: string;
  bg: string;
  bgGradient?: string;
  textColor: string;
  textSecondary: string;
  /** Color used for titles, dividers, badges. For most surfaces equals textColor. */
  accentColor: string;
}

/** Personal brand kit (src/brand-kit.ts, written by scripts/brand-kit.mjs): palette + font + highlight + its own SVG set in public/images/svg/brand/. */
export interface BrandKit {
  name: string;
  accent: string;
  accent2: string;
  bg: string;
  text: string;
  textSecondary: string;
  font: FontId;
  highlightStyle: "marker" | "brush-solid" | "italic-box";
  /** Names of the generated SVGs (public/images/svg/brand/<name>.svg), usable in `decor` with color: "brand". */
  svgs: string[];
  /** Swipe-arrow variants (subset of svgs) used automatically. */
  arrows: string[];
}

export interface Accent {
  id: AccentId;
  name: string;
  /** Color used for highlighted words. */
  color: string;
}

// ---- Slide data ----

export interface SlideData {
  type: SlideType;
  text?: string;
  title?: string;
  badge?: string;
  // body slide — render the title huge in the accent color (e.g. a product/fiber name on comparison slides)
  bigTitle?: boolean;
  highlight?: string;
  // any slide — swipe arrow (auto-added when AUTO_ARROW is on): false = none on this slide, number = force that variant (0-4)
  arrow?: boolean | number;
  // hook slide — how the comment keyword is drawn: "brush" (default: solid dry-brush stroke + white text, like a painted label) or "chip" (the older rounded button)
  keywordStyle?: "chip" | "brush";
  // any slide — optional reaction sticker (your own cartoon, see docs/sticker-prompts.md) (angry|happy|celebrate|laughing|thinking|sad|shocked|wink); use ONLY when it adds meaning
  sticker?: string;
  // any slide — repeating brand SVG decorations from /public/images/svg/<color>/<name>.svg, absolutely positioned on the 1080x1350 canvas
  // names: swipe-arrow, curved-arrow, underline, circle-highlight, starburst, bookmark, share, gift, sparkles, comment-bubble
  decor?: { name: string; color?: "blue" | "dark" | "white" | "brand"; w?: number; h?: number; top?: number; left?: number; right?: number; bottom?: number; rotate?: number; flipX?: boolean; opacity?: number }[];
  stickerPos?: "bottom-left" | "top-left" | "bottom-right";
  // hook slide — small line under the headline explaining what the carousel covers
  subtitle?: string;
  // number slide — a short teaser line (accent colour) saying what comes next in the carousel ("ובהמשך: ...")
  teaser?: string;
  // cta slide — call-to-action words inside `subtitle` (e.g. "שלחו את זה"), drawn as the strong solid brush (opaque accent + white, bold)
  subtitleHighlight?: string;
  // hook slide — comment keyword inside `subtitle`; rendered as a bold accent chip so it pops
  keyword?: string;
  // hook slide — a named model/product, rendered huge above the headline (e.g. "Gemini 4 Argon")
  heroName?: string;
  // hook slide — optional logo/icon shown next to heroName, e.g. "/images/claude.png"
  heroIcon?: string;
  handle?: string;
  // cta slide — text inside the follow button before the handle, e.g. "עקבו"
  ctaLabel?: string;
  // quote
  author?: string;
  role?: string;
  // stats
  stats?: { value: string; label: string }[];
  // list / checklist
  items?: string[];
  // process
  steps?: { title: string; text?: string }[];
  // comparison
  leftLabel?: string;
  leftItems?: string[];
  rightLabel?: string;
  rightItems?: string[];
  // icon points (plus/minus list with SVG icons)
  points?: Array<{ type: "plus" | "minus"; text: string }>;
  // image slide — put file into /public/images/ and reference as "/images/file.png"
  imageSrc?: string;
  imageCaption?: string;
  // emoji slide — single grapheme rendered large
  emoji?: string;
  // bars slide — horizontal bar chart (labels LTR, one bar can be highlighted)
  bars?: { label: string; value: number; highlight?: boolean }[];
  barsUnit?: string;
  // number slide — big hero number/string like "17", "5K+", "№1"
  bigNumber?: string;
  // highlight variant — "italic-box" renders highlighted word in Playfair italic on colored box
  highlightStyle?: HighlightStyle;
}

// ---- Internal composed type used by all slide components ----
// Built by composePreset(font, color, purpose) in presets.ts.

export interface StylePreset {
  id: string;
  name: string;
  bg: string;
  bgGradient?: string;
  textColor: string;
  textSecondary: string;
  accentColor: string;
  highlightColor: string;
  fontFamily: string;
  hookFontFamily?: string;
  // Title overrides — defaults: 44px, 800, uppercase, accentColor, divider visible
  titleFontSize?: number;
  titleFontWeight?: number;
  titleUppercase?: boolean;
  titleDivider?: boolean;
  titleColor?: string;
  // Body text overrides — defaults: 600, textColor, lineHeight 1.2
  bodyFontWeight?: number;
  bodyColor?: string;
  bodyLineHeight?: number;
}

export interface FormatPreset {
  id: FormatId;
  name: string;
  w: number;
  h: number;
  platform: string;
}
