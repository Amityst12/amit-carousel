// Read-only: pulls analytics for the account's recent posts -> transcripts-free JSON/CSV in `analytics/` (no secrets).
//   bun scripts/ig-insights.mjs [--limit 50]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, redact, igGet } from "./ig-lib.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv();
const limit = Number(process.argv[process.argv.indexOf("--limit") + 1]) || 50;
const list = await igGet(env, `me/media?fields=id,media_type,media_product_type,timestamp,permalink,caption,like_count,comments_count&limit=${limit}`);
if (!list.ok) { console.error("list failed:", redact(JSON.stringify(list.json), env).slice(0, 300)); process.exit(1); }
const METRICS = ["views", "reach", "likes", "comments", "saved", "shares", "total_interactions", "follows", "profile_visits", "profile_activity", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"];
const rows = [];
for (const m of list.json.data) {
  const row = { id: m.id, type: m.media_type, product: m.media_product_type, time: m.timestamp, url: m.permalink, caption: (m.caption || "").split("\n")[0].slice(0, 80), like_count: m.like_count, comments_count: m.comments_count };
  // try the full metric set first, then drop metrics the media type does not support (error message names them) one by one
  let ms = METRICS.slice();
  for (let i = 0; i < 12 && ms.length; i++) {
    const r = await igGet(env, `${m.id}/insights?metric=${ms.join(",")}`);
    if (r.ok) { for (const d of r.json.data || []) row[d.name] = d.values?.[0]?.value ?? d.total_value?.value; break; }
    const msg = JSON.stringify(r.json);
    const bad = ms.filter((x) => new RegExp(`\b${x}\b`).test((r.json.error?.message || "")));
    ms = bad.length ? ms.filter((x) => !bad.includes(x)) : ms.slice(0, -1);
    if (!ms.length) row.error = redact(msg, env).slice(0, 160);
  }
  rows.push(row);
}
fs.mkdirSync(path.join(ROOT, "analytics"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "analytics", "insights.json"), JSON.stringify(rows, null, 2));
const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
fs.writeFileSync(path.join(ROOT, "analytics", "insights.csv"), "\ufeff" + [cols.join(","), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\n"));
console.log(`${rows.length} posts -> analytics/insights.csv`);
console.table(rows.map((r) => ({ date: r.time?.slice(0, 10), type: r.product === "REELS" ? "REEL" : r.type?.replace("CAROUSEL_ALBUM", "CAROUSEL"), views: r.views, reach: r.reach, likes: r.likes, cmts: r.comments, saved: r.saved, shares: r.shares, follows: r.follows, caption: r.caption.slice(0, 32) })));
