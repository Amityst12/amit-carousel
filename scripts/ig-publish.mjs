// Publish/schedule a carousel from its ARCHIVE folder, using public Drive image URLs.
//   bun scripts/ig-publish.mjs --folder <archive-folder> --ids <json {"01.jpg":"<driveFileId>",...}> --mode dryrun
//   bun scripts/ig-publish.mjs ... --mode schedule --time 2026-10-08T15:00:00+03:00 --approved
//   bun scripts/ig-publish.mjs ... --mode now --approved          (only if the user said "publish now")
// dryrun = creates containers and checks their status, NEVER publishes. schedule/now REQUIRE --approved (your explicit approval to publish + when).
// SECRETS RULE: loads .instagram.env via ig-lib (redacted output). Never prints tokens/URLs with tokens.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, redact, igGet, igPost } from "./ig-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true] : null)).filter(Boolean));
const mode = args.mode || "dryrun";
if (!args.folder || !args.ids) { console.error("need --folder and --ids"); process.exit(1); }
if (["schedule", "now"].includes(mode) && !args["approved"]) { console.error("REFUSED: schedule/now need your explicit approval to publish + when → pass --approved"); process.exit(1); }
let unix;
if (mode === "schedule") {
  if (!args.time) { console.error("schedule needs --time <ISO with offset>"); process.exit(1); }
  unix = Math.floor(new Date(args.time).getTime() / 1000);
  const delta = unix - Math.floor(Date.now() / 1000);
  if (!(delta >= 600 && delta <= 75 * 86400)) { console.error(`time must be 10 minutes - 75 days ahead (delta ${Math.round(delta / 60)} min)`); process.exit(1); }
}
if (args["not-after"]) {
  const limit = new Date(args["not-after"]).getTime();
  if (Date.now() > limit) { console.log(`ABORTED: it is later than --not-after (${args["not-after"]}); nothing was published. Tell the user.`); process.exit(2); }
}
console.log("run at", new Date().toISOString());
const env = loadEnv();
const ids = JSON.parse(fs.readFileSync(args.ids, "utf8"));
const names = Object.keys(ids).sort();
if (names.length < 2 || names.length > 10) { console.error("need 2-10 images"); process.exit(1); }
const caption = fs.readFileSync(path.join(ROOT, "Published", args.folder, "caption.md"), "utf8").trim();
const clean = (r) => redact(JSON.stringify(r.json), env).replace(/"id":"?\d+"?/g, '"id":"<id>"');
const url = (n) => `https://lh3.googleusercontent.com/d/${ids[n]}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function status(id) {
  for (let i = 0; i < 20; i++) {
    const r = await igGet(env, `${id}?fields=status_code,status`);
    const code = r.json.status_code;
    if (code === "FINISHED") return "FINISHED";
    if (code === "ERROR" || code === "EXPIRED") return `${code}: ${clean(r)}`;
    await wait(1500);
  }
  return "TIMEOUT";
}
console.log(`mode=${mode} folder=${args.folder} images=${names.length}`);
const children = [];
for (const [i, n] of names.entries()) {
  const r = await igPost(env, `${env.IG_USER_ID}/media`, { image_url: url(n), is_carousel_item: "true" });
  if (!r.ok) { console.log(`child ${i + 1} (${n}) FAILED:`, clean(r)); process.exit(1); }
  const st = await status(r.json.id);
  console.log(`child ${i + 1}/${names.length} ${n}: ${st}`);
  if (st !== "FINISHED") process.exit(1);
  children.push(r.json.id);
}
const params = { media_type: "CAROUSEL", children: children.join(","), caption };
if (mode === "schedule") { params.published = "false"; params.scheduled_publish_time = String(unix); }
const parent = await igPost(env, `${env.IG_USER_ID}/media`, params);
if (!parent.ok) { console.log("parent FAILED:", clean(parent)); process.exit(1); }
const pst = await status(parent.json.id);
console.log("carousel container:", pst);
{ const d = await igGet(env, `${parent.json.id}?fields=status_code,status`); console.log("container details:", clean(d)); }
if (mode === "dryrun") { console.log("DRY RUN done: nothing was published (containers expire by themselves)."); process.exit(0); }
if (mode === "schedule") { console.log(`SCHEDULED for ${args.time} (unix ${unix}). Verify it appears as scheduled; no media_publish was called.`); process.exit(0); }
const pub = await igPost(env, `${env.IG_USER_ID}/media_publish`, { creation_id: parent.json.id });
console.log("media_publish:", pub.ok ? "OK" : "FAILED", clean(pub));
if (pub.ok) {
  const m = await igGet(env, `${pub.json.id}?fields=media_type,timestamp,permalink,children{media_type}`);
  const kids = (m.json.children && m.json.children.data) || [];
  console.log(`VERIFY: type=${m.json.media_type} items=${kids.length}/${names.length} time=${m.json.timestamp} link=${m.json.permalink}`);
}
