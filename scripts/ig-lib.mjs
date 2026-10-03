// Instagram helper — SECRETS RULE: the contents of .instagram.env (app id/secret, token, user id) must NEVER be printed, logged,
// echoed, pasted in chat, committed, or sent anywhere except graph.instagram.com. Never `cat`/Read that file. This module redacts every output.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".instagram.env");

export function loadEnv() {
  const env = {};
  if (!fs.existsSync(ENV_PATH)) throw new Error(".instagram.env not found — copy .instagram.env.example to .instagram.env and fill it in (see README: Publishing to Instagram)");
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

export function redact(text, env) {
  let s = String(text);
  for (const k of ["IG_ACCESS_TOKEN", "IG_APP_SECRET", "IG_APP_ID", "IG_USER_ID"]) if (env[k] && env[k].length > 3) s = s.split(env[k]).join(`<${k}>`);
  return s.replace(/IG[A-Za-z0-9_-]{30,}/g, "<token>").replace(/access_token=[^&\s"]+/g, "access_token=<redacted>");
}

export async function igGet(env, pathAndQuery) {
  const url = `https://graph.instagram.com/${pathAndQuery}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${env.IG_ACCESS_TOKEN}` } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { ok: res.ok, status: res.status, json };
}

export async function igPost(env, pathAndQuery, params) {
  const url = `https://graph.instagram.com/${pathAndQuery}`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${env.IG_ACCESS_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { ok: res.ok, status: res.status, json };
}
