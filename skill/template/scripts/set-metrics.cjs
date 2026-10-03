// Usage (from skill/template):  node scripts/set-metrics.cjs <slug> views=1200 reach=900 likes=60 comments=40 saves=25 shares=10 profile_follows=8 keyword_comments=35 post_url=https://... notes="text"
// Updates Published/<date>_<slug>/meta.json and the matching row in Published/index.csv (partial updates OK).
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(process.cwd(), "../../Published");
const [slug, ...pairs] = process.argv.slice(2);
if (!slug) { console.error("slug required"); process.exit(1); }
const dirName = fs.readdirSync(ROOT).find((d) => d.endsWith("_" + slug));
if (!dirName) { console.error("no archived carousel with slug", slug); process.exit(1); }
const metaPath = path.join(ROOT, dirName, "meta.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
meta.metrics = meta.metrics || {};
const numeric = ["views", "reach", "likes", "comments", "saves", "shares", "profile_follows", "keyword_comments"];
for (const p of pairs) {
  const i = p.indexOf("="); const k = p.slice(0, i), v = p.slice(i + 1);
  if (numeric.includes(k)) meta.metrics[k] = Number(v);
  else if (k === "post_url") meta.post_url = v;
  else if (k === "notes") meta.notes = v;
  else { console.error("unknown field", k); process.exit(1); }
}
if (pairs.some((p) => numeric.includes(p.split("=")[0]))) meta.metrics.checked_at = new Date().toISOString().slice(0, 16).replace("T", " ");
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");

const CSV = path.join(ROOT, "index.csv");
const COLS = ["date","slug","title","topic","type","hook","keyword","slides","post_url","views","reach","likes","comments","saves","shares","profile_follows","keyword_comments","notes"];
const q = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const m = meta.metrics;
const row = { date: meta.date, slug: meta.slug, title: meta.title || "", topic: meta.topic, type: meta.type, hook: meta.hook, keyword: meta.keyword || "", slides: meta.slides.length, post_url: meta.post_url ?? "", ...Object.fromEntries(numeric.map((k) => [k, m[k] ?? ""])), notes: meta.notes ?? "" };
let lines = fs.readFileSync(CSV, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
const key = `"${meta.date}","${meta.slug}"`;
lines = lines.filter((l, i) => i === 0 || !l.startsWith(key));
lines.push(COLS.map((c) => q(row[c])).join(","));
fs.writeFileSync(CSV, "\uFEFF" + lines.join("\n") + "\n", "utf8");
console.log("updated", dirName, JSON.stringify(meta.metrics));
