// Read-only connection test: `bun scripts/ig-check.mjs`. Prints ONLY non-secret facts (username, account type, counts, public permalinks, metric names/values).
import { loadEnv, redact, igGet } from "./ig-lib.mjs";
const env = loadEnv();
const need = ["IG_APP_ID", "IG_APP_SECRET", "IG_ACCESS_TOKEN", "IG_USER_ID"];
console.log("env fields present:", need.map((k) => `${k}=${env[k] ? "yes" : "NO"}`).join(", "));
if (!env.IG_ACCESS_TOKEN) process.exit(1);
const show = (r) => redact(JSON.stringify(r.json), env).replace(/"(user_)?id":"?\d+"?,?/g, "");

const me = await igGet(env, "me?fields=user_id,username,account_type,media_count");
console.log("GET /me ->", me.status, show(me));
if (!me.ok) process.exit(1);

const media = await igGet(env, "me/media?fields=id,media_type,timestamp,permalink&limit=3");
console.log("GET /me/media ->", media.status, media.ok ? `${(media.json.data || []).length} items` : show(media));
for (const m of media.json.data || []) console.log("  ", m.media_type, m.timestamp, m.permalink);

const first = (media.json.data || [])[0];
if (first) {
  for (const metrics of ["reach,likes,comments,saved,shares", "reach,saved,shares", "reach"]) {
    const ins = await igGet(env, `${first.id}/insights?metric=${metrics}`);
    if (ins.ok) { console.log("insights OK:", metrics, "->", (ins.json.data || []).map((d) => `${d.name}=${d.values?.[0]?.value}`).join(", ")); break; }
    console.log("insights try", metrics, "->", ins.status, show(ins).slice(0, 220));
  }
}
console.log("done (read-only, nothing was published or changed).");
