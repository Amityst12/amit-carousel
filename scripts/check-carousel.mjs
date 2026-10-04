// Carousel rule checker — run BEFORE saying a carousel is ready:
//   bun scripts/check-carousel.mjs            (checks skill/template/src/slides.ts)
// Exit code 1 if any ERROR. WARN = review. Rules come from CLAUDE.md (project decisions). Visual checks (overlap with the arrow / sound-button
// corner, content ending above y≈1085) can't be done here: still render the gallery and look at it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TPL = path.join(ROOT, "skill", "template");
const mod = await import(pathToFileURL(path.join(TPL, "src", "slides.ts")).href);
const { SLIDES, POST_META, HANDLE } = mod;

const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);
const HEB = /[֐-׿]/;
const exists = (p) => fs.existsSync(path.join(TPL, "public", p.replace(/^\//, "")));

// 1. slide count (hard rule: max 7)
if (SLIDES.length > 7) E(`${SLIDES.length} slides — the maximum is 7 (hard rule)`);
if (SLIDES.length < 4) W(`only ${SLIDES.length} slides — fine if intentional`);

// 2. structure: hook first, cta last
if (SLIDES[0]?.type !== "hook") E("slide 1 must be type 'hook'");
const last = SLIDES[SLIDES.length - 1];
if (last?.type !== "cta") E("last slide must be type 'cta'");
else if (!last.ctaLabel) E("CTA slide needs ctaLabel (follow button / keyword button)");
if (SLIDES[0]?.type === "hook" && !SLIDES[0].subtitle) W("hook has no subtitle (always say what's inside)");
if (SLIDES.length > 1 && SLIDES[1].type === "body" && /^מה זה/.test(SLIDES[1].title || "")) W("slide 2 looks like a neutral 'what is it' intro — it should be a second hook");

// 3. voice: first person singular
const allText = [];
SLIDES.forEach((s, i) => {
  for (const k of ["text", "title", "subtitle", "imageCaption", "bigNumber", "heroName"]) if (s[k]) allText.push([`slide ${i + 1}.${k}`, s[k]]);
  (s.items || []).forEach((t, j) => allText.push([`slide ${i + 1}.items[${j}]`, t]));
  (s.steps || []).forEach((st, j) => { allText.push([`slide ${i + 1}.steps[${j}].title`, st.title]); if (st.text) allText.push([`slide ${i + 1}.steps[${j}].text`, st.text]); });
  (s.stats || []).forEach((st, j) => { allText.push([`slide ${i + 1}.stats[${j}].label`, st.label]); if (st.label && st.label.replace(/\n/g, " ").length > 32) W(`slide ${i + 1}: stat label "${st.label.slice(0, 30)}…" is long (>32 chars, may wrap)`); });
});
allText.push(["POST_META.caption", POST_META.caption || ""]);
for (const [where, t] of allText) {
  if (/שלנו/.test(t)) E(`${where}: "שלנו" — use first person singular ("שלי")`);
  if (/בנינו|הוספנו|עשינו|אנחנו/.test(t)) W(`${where}: first-person plural — OK only for readers' shared experience, not for the author's own work`);
}

// 4. highlights must actually match text (otherwise no marker is drawn)
SLIDES.forEach((s, i) => {
  if (s.highlight) {
    const hay = [s.text, s.title, s.imageCaption, s.bigNumber].filter(Boolean).join("\n").toLowerCase();
    if (!hay.includes(s.highlight.toLowerCase())) E(`slide ${i + 1}: highlight "${s.highlight}" is not found in the slide text (no marker will be drawn)`);
  }
  if (s.subtitleHighlight && !(s.subtitle || "").includes(s.subtitleHighlight)) E(`slide ${i + 1}: subtitleHighlight "${s.subtitleHighlight}" not found in subtitle`);
  if (s.highlightStyle === "italic-box") E(`slide ${i + 1}: italic-box highlight has no Hebrew glyphs`);
  if (s.type === "comparison") W(`slide ${i + 1}: 'comparison' type clashes with the brand colours — prefer 'stats'`);
});

// 5. keyword rule
const kw = (POST_META.keyword || "").trim();
const hook = SLIDES[0] || {};
if (kw) {
  if (!hook.keyword) E("keyword post: hook needs `keyword` (chip) — it must stand out in the hook");
  else if (!(hook.subtitle || "").includes(hook.keyword)) E("keyword post: hook.subtitle must contain the same keyword string");
  if (!(last?.ctaLabel || "").includes(kw)) E(`keyword post: CTA button label must contain the keyword "${kw}"`);
  if (!(last?.text || "").includes(kw)) W("keyword post: the CTA text should also mention the keyword (highlighted)");
  const firstLine = (POST_META.caption || "").split("\n")[0];
  if (!firstLine.includes(kw)) E("keyword post: the caption's FIRST line must mention the keyword");
  if (!POST_META.guide) E("keyword post: POST_META.guide must point to the written guide");
  else if (!fs.existsSync(path.join(ROOT, POST_META.guide))) E(`guide file missing: ${POST_META.guide}`);
} else if (hook.keyword || /תגיבו ״/.test(last?.text || "")) W("keyword used on slides but POST_META.keyword is empty");

// 6. CTA count: at most ONE call to action on the hook, at most TWO on the last slide
// (typically "do something" + "save OR follow"). Icons count as asks too (bookmark = save, share = send, comment-bubble = comment).
const hookCtas = new Set();
if (hook.keyword) hookCtas.add("comment");
if (/עקבו/.test(hook.subtitle || "")) hookCtas.add("follow");
if (/שמרו/.test(hook.subtitle || "")) hookCtas.add("save");
if (/שלחו/.test(hook.subtitle || "")) hookCtas.add("share");
if (hookCtas.size > 1) E(`hook has ${hookCtas.size} calls to action (${[...hookCtas].join(", ")}) — max 1 on slide 1`);
if (last?.type === "cta") {
  const acts = new Set();
  if (kw || /תגיבו/.test(last.ctaLabel || "")) acts.add("comment");
  if (/עקבו/.test(last.ctaLabel || "") || (!kw && last.handle)) acts.add("follow");
  if (/שמרו/.test(last.subtitle || "")) acts.add("save");
  if (/שלחו/.test(last.subtitle || "")) acts.add("share");
  for (const d of last.decor || []) {
    if (d.name === "bookmark") acts.add("save");
    if (d.name === "share") acts.add("share");
    if (d.name === "comment-bubble") acts.add("comment");
  }
  if (acts.size > 2) E(`CTA slide asks for ${acts.size} things (${[...acts].join(", ")}) — max 2 (e.g. keyword/follow + save). Drop a line or an icon`);
  if (last.sticker && (!last.stickerPos || last.stickerPos === "bottom-left") && last.subtitle) E("CTA: bottom-left sticker covers the subtitle — use stickerPos: 'top-left'");
  if (!last.subtitle) W("CTA has no second line — optional, but one secondary action (save/follow) is usually welcome");
}
// 6b. structure hint: retain -> reward
const hasReward = SLIDES.some((s) => ["process", "list", "checklist"].includes(s.type));
if (/howto|tips/.test(POST_META.type || "") && !hasReward) W("how-to/tips post without a list/steps/process slide — the Reward slide (complete, practical answer) should come after the Retain slides (~slides 4-5)");

// 7. stickers (proactive use: 2-4) and assets exist
const stickerCount = SLIDES.filter((s) => s.sticker).length;
if (stickerCount === 0) W("no stickers — rule: use 2–4 where an emotion fits (skip only for tragedy topics)");
if (stickerCount > 5) W(`${stickerCount} stickers — rule says 2–4, not on every slide`);
SLIDES.forEach((s, i) => {
  if (s.sticker && !exists(`images/stickers/${s.sticker}.png`)) E(`slide ${i + 1}: sticker "${s.sticker}" not found`);
  if (s.heroIcon && !exists(s.heroIcon)) E(`slide ${i + 1}: heroIcon ${s.heroIcon} not found`);
  if (s.imageSrc && !exists(s.imageSrc)) E(`slide ${i + 1}: imageSrc ${s.imageSrc} not found`);
  if (s.imageCaption && !HEB.test(s.imageCaption[0])) E(`slide ${i + 1}: imageCaption must START with Hebrew (bidi)`);
  if (s.heroName && !s.heroIcon && /logo|icon/i.test(s.heroName)) W(`slide ${i + 1}: heroName without heroIcon — colour logos catch the eye`);
  for (const d of s.decor || []) {
    const color = d.color || "blue";
    if (!exists(`images/svg/${color}/${d.name}.svg`)) E(`slide ${i + 1}: decor "${d.name}" (${color}) not found`);
    if (d.right !== undefined && d.bottom !== undefined && d.right < 120 && d.bottom < 130) W(`slide ${i + 1}: decor "${d.name}" sits in the bottom-right sound-button corner (keep x>960,y>1230 empty)`);
  }
});

// 8. images need big source (≥1300 px wide)
SLIDES.forEach((s, i) => {
  if (s.imageSrc && exists(s.imageSrc)) {
    const f = path.join(TPL, "public", s.imageSrc.replace(/^\//, ""));
    const b = fs.readFileSync(f);
    if (b.slice(1, 4).toString() === "PNG") { const w = b.readUInt32BE(16); if (w < 1300) W(`slide ${i + 1}: image is only ${w}px wide (<1300) — it will look soft`); }
  }
});

// 9. handle / titles / POST_META
if (!HANDLE || !HANDLE.startsWith("‎")) W("HANDLE should start with U+200E so '@' stays on the left");
SLIDES.forEach((s, i) => {
  if (s.title && /[A-Za-z]/.test(s.title) && /\?/.test(s.title)) W(`slide ${i + 1}: Latin word + '?' in a title can bidi-flip — rephrase`);
});
const req = ["slug", "title", "topic", "type", "caption"];
for (const k of req) if (!POST_META[k]) E(`POST_META.${k} is empty (needed by the Archive button)`);
if (POST_META.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(POST_META.slug)) E("POST_META.slug must be latin kebab-case");
if (!POST_META.sources || !POST_META.sources.length) W("POST_META.sources is empty — cite the sources");
if (POST_META.title && HEB.test(POST_META.title) === false) W("POST_META.title should be a generic Hebrew title");
// caption: exactly 2 text lines; keyword + mini-explanation in line 1; hashtags optional
const capLines = (POST_META.caption || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const textLines = capLines.filter((l) => !/^(#\S+\s*)+$/.test(l));
if (textLines.length > 2) E(`caption has ${textLines.length} text lines — it must be exactly 2 (line 1 = keyword/hook + mini-explanation, line 2 = short description)`);
if (textLines.length === 1) W("caption has 1 text line — the format is 2 lines");
// Instagram renders each caption line with the direction of its FIRST strong letter: a line that starts with Latin becomes LTR and its punctuation lands on the wrong side.
for (const [n, l] of textLines.entries()) {
  const first = (l.match(/[A-Za-z֐-׿]/) || [""])[0];
  if (/[A-Za-z]/.test(first)) E(`caption line ${n + 1} starts with a Latin letter — start every caption line with a Hebrew word (otherwise the line renders left-to-right and the punctuation flips)`);
  if (l.length > 75) W(`caption line ${n + 1} is ${l.length} chars — keep each line short (≈ up to 70, ideally one phone line or two)`);
  if (/[A-Za-z0-9][.:;,!?]?$/.test(l) && /[A-Za-z]{3,}[.:;,!?]?$/.test(l)) W(`caption line ${n + 1} ends with Latin text — prefer ending with a Hebrew word`);
}
if (kw && textLines[0] && textLines[0].split(/\s+/).length < 7) W("caption line 1 should hold the keyword AND a mini-explanation of what they get");

// report
console.log(`Checked ${SLIDES.length} slides · stickers: ${stickerCount} · keyword: ${kw || "none"}`);
for (const m of errors) console.log("ERROR  " + m);
for (const m of warns) console.log("WARN   " + m);
if (!errors.length && !warns.length) console.log("OK — no issues found");
console.log("\nStill to do by eye (render the gallery): text/arrow overlap (content ends above y≈1085), nothing in the bottom-right corner, slide 2 = a real second hook, caveat only if needed.");
process.exit(errors.length ? 1 : 0);
