// YOUR BRAND KIT — written by `bun scripts/brand-kit.mjs` (the /amit-setup skill runs it for you). null = no kit: the Surface / Accent / Font pickers decide.
// With a kit: your palette + font + highlight style apply to every carousel, and your own SVG set (public/images/svg/brand/) is used for arrows and `decor` (color: "brand").
import type { BrandKit } from "./lib/types";

export const BRAND_KIT: BrandKit | null = null;

// Optional logo (transparent PNG/SVG in public/images/, e.g. "/images/logo.png"): footer of every slide + CTA slide. null = none.
export const LOGO_SRC: string | null = null;
