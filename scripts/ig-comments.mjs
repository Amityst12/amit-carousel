// Read-only: counts keyword comments per published carousel (needs the token scope instagram_business_manage_comments).
//   bun scripts/ig-comments.mjs        -> prints counts and updates keyword_comments in Published/<..>/meta.json + index.csv
// Privacy: only the comment TEXT is read to count keyword matches; usernames are never requested, nothing is stored except the counts. Never writes/replies/hides/deletes comments.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv, redact, igGet } from "./ig-lib.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv();
const pub = path.join(ROOT, "Published");
const media = [];
for (let url = "me/media?fields=id,permalink,media_type&limit=100"; url;) {
  const r = await igGet(env, url);
  if (!r.ok) { console.error("media list failed:", redact(JSON.stringify(r.json), env).slice(0, 200)); process.exit(1); }
  media.push(...r.json.data);
  url = r.json.paging?.next ? r.json.paging.next.replace("https://graph.instagram.com/", "") : null;
  if (media.length >= 300) break;
}
for (const d of fs.readdirSync(pub)) {
  const mp = path.join(pub, d, "meta.json");
  if (!fs.existsSync(mp)) continue;
  const meta = JSON.parse(fs.readFileSync(mp, "utf8"));
  const kw = (meta.keyword || "").replace(/[״"“”']/g, "").trim();
  if (!meta.post_url || !kw) continue;
  const m = media.find((x) => x.permalink === meta.post_url);
  if (!m) { console.log(d, ": post not found on the account"); continue; }
  let total = 0, hit = 0;
  for (let url = `${m.id}/comments?fields=text&limit=100`; url;) {
    const r = await igGet(env, url);
    if (!r.ok) { console.error(d, "comments failed:", redact(JSON.stringify(r.json), env).slice(0, 200)); process.exit(1); }
    for (const c of r.json.data || []) { total++; if ((c.text || "").replace(/[״"“”']/g, "").includes(kw)) hit++; }
    url = r.json.paging?.next ? r.json.paging.next.replace("https://graph.instagram.com/", "") : null;
  }
  console.log(`${d}: ${total} top-level comments, ${hit} contain the keyword "${kw}"`);
  spawnSync("node", ["scripts/set-metrics.cjs", meta.slug, `keyword_comments=${hit}`], { cwd: path.join(ROOT, "skill", "template"), encoding: "utf8" });
}
