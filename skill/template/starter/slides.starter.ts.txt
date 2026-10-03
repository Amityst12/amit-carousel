// STARTER carousel — a clean 5-slide example that needs no extra assets (no avatar, stickers or screenshots).
// To start fresh: copy this file over src/slides.ts (the skill /amit-carousel does it for you), then edit the text.
// Rules of thumb: max 7 slides · slide 1 = hook · slide 2 = a second hook (number / bold claim) · the real value on slides 4-5 · last slide = CTA.
// In strings use \n for line breaks (never a raw line break inside quotes).

import type { SlideData, BgType, FormatId, FontId, SurfaceId, AccentId, PurposeId } from "./lib/types";

export const SLIDES: SlideData[] = [
  {
    type: "hook",
    heroName: "הנושא שלך",
    text: "כותרת חזקה\nשגורמת לעצור\nולהחליק.",
    highlight: "ולהחליק.",
    highlightStyle: "marker",
    subtitle: "מה יש בפנים, בשורה אחת קצרה",
  },
  {
    type: "number",
    badge: "01",
    bigNumber: "3",
    title: "דברים שכדאי לדעת",
    text: "משפט קצר שמסביר למה זה חשוב לקורא.",
    highlight: "למה זה חשוב",
    highlightStyle: "marker",
    teaser: "ובהמשך: הפתרון, צעד אחר צעד.",
  },
  {
    type: "list",
    badge: "02",
    title: "הרשימה שלך",
    items: ["נקודה ראשונה, קצרה וברורה", "נקודה שנייה, עם פרט ספציפי", "נקודה שלישית, שאפשר ליישם היום"],
  },
  {
    type: "process",
    badge: "03",
    title: "איך עושים את זה",
    steps: [
      { title: "צעד ראשון", text: "מה עושים, במשפט אחד" },
      { title: "צעד שני", text: "מה עושים אחר כך" },
      { title: "צעד שלישי", text: "ומה מקבלים בסוף" },
    ],
    text: "התוצאה: משפט שמסכם מה הקורא קיבל.",
    highlight: "התוצאה",
  },
  {
    type: "cta",
    text: "עוד תוכן שימושי\nכל יום.",
    highlight: "כל יום",
    ctaLabel: "עקבו",
    handle: "‎@your.handle",
    subtitle: "ושמרו את זה לפעם הבאה",
    subtitleHighlight: "ושמרו את זה",
  },
];

// Post metadata - used by the "📁 Archive" button (saves PNGs + this file + caption + meta to <project>/Published/) and by scripts/check-carousel.mjs.
export const POST_META = {
  slug: "my-first-carousel",
  title: "הקרוסלה הראשונה שלי",
  topic: "Starter example",
  type: "tips-list",
  keyword: "",
  guide: "",
  sources: [],
  // exactly 2 lines; every line starts with a Hebrew word (Instagram renders a line that starts with Latin left-to-right and breaks the punctuation)
  caption: `שלוש נקודות שכדאי להכיר, בשפה פשוטה.
פשוט לשמור ולהתחיל ליישם כבר היום.`,
};

// Account handle shown on every slide (U+200E keeps "@" on the left in RTL). "" to hide.
export const HANDLE = "‎@your.handle";
// Optional round avatar next to the handle: drop a square photo in public/images/avatar.png and set "/images/avatar.png". null = hidden.
export const AVATAR_SRC: string | null = null;

// Auto swipe arrow (bottom-right, a different hand-drawn variant per slide) on every slide except the last. false = off.
export const AUTO_ARROW = true;

export const DEFAULT_FONT: FontId = "hebrew";
export const DEFAULT_SURFACE: SurfaceId = "light";
export const DEFAULT_ACCENT: AccentId = "blue";
export const DEFAULT_PURPOSE: PurposeId = "carousel";
export const DEFAULT_BG: BgType = "lines";
export const DEFAULT_FORMAT: FormatId = "threads-4x5";
