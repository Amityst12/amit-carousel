// One command to publish an ARCHIVED carousel to Instagram NOW (also what a Claude scheduled task runs at the chosen time):
//   bun scripts/ig-publish-auto.mjs <slug|folder> --approved [--dryrun]
// Steps: ig-prepare (JPEG 1080x1350) -> copy to the shared Drive host folder -> wait until Drive lists the files -> ig-publish.mjs (--mode now | dryrun)
// -> remove the temporary Drive host files -> optional branding copy (drive-archive.mjs). Prints no secrets (ig-publish/ig-lib redact).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfgPath = path.join(ROOT, "config", "ig-config.json");
if (!fs.existsSync(cfgPath)) { console.error("missing config/ig-config.json — copy config/ig-config.example.json and fill in the Drive paths (see README: Publishing to Instagram)"); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith("--"));
const dry = argv.includes("--dryrun");
if (!slug) { console.error("usage: bun scripts/ig-publish-auto.mjs <slug|folder> --approved [--dryrun]"); process.exit(1); }
if (!dry && !argv.includes("--approved")) { console.error("refusing: needs --approved (your explicit approval to publish + when)"); process.exit(1); }
const run = (file, args) => { const r = spawnSync("bun", [path.join(ROOT, "scripts", file), ...args], { encoding: "utf8" }); process.stdout.write(r.stdout || ""); if (r.status) process.stderr.write(r.stderr || ""); return r; };

const p = run("ig-prepare.mjs", [slug]);
if (p.status) process.exit(p.status);
const folder = /^folder: (\S+)/m.exec(p.stdout)[1];
const tmp = path.join(os.tmpdir(), "ig-publish", folder);
const manifest = JSON.parse(fs.readFileSync(path.join(tmp, "manifest.json"), "utf8"));
const lines = manifest.caption.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
if (lines.length !== 2) { console.error("caption must be exactly 2 lines"); process.exit(1); }

const host = path.join(cfg.driveHost.dir, folder);
fs.rmSync(host, { recursive: true, force: true });
fs.mkdirSync(host, { recursive: true });
for (const f of manifest.files) fs.copyFileSync(path.join(tmp, f), path.join(host, f));
console.log(`copied ${manifest.files.length} JPEGs to the Drive host folder; waiting for Drive to list them…`);

const page = async (id) => (await (await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`)).text());
const entries = (html, re) => [...html.matchAll(re)];
let ids = null;
for (let i = 0; i < 40 && !ids; i++) {
  const top = await page(cfg.driveHost.publicFolderId);
  const sub = entries(top, /folders\/([A-Za-z0-9_-]{20,})[\s\S]*?flip-entry-title">([^<]+)/g).find((m) => m[2] === folder);
  if (sub) {
    const html = await page(sub[1]);
    const found = Object.fromEntries(entries(html, /file\/d\/([A-Za-z0-9_-]{20,})[\s\S]*?flip-entry-title">([^<]+)/g).map((m) => [m[2], m[1]]));
    if (manifest.files.every((f) => found[f])) ids = Object.fromEntries(manifest.files.map((f) => [f, found[f]]));
  }
  if (!ids) await new Promise((r) => setTimeout(r, 8000));
}
if (!ids) { console.error("Drive did not list all files in time (is Drive for Desktop running + synced?)"); process.exit(1); }
const idsFile = path.join(ROOT, "ig-queue", `${folder}.ids.json`);
fs.mkdirSync(path.dirname(idsFile), { recursive: true });
fs.writeFileSync(idsFile, JSON.stringify(ids, null, 2));
console.log("Drive listing OK:", Object.keys(ids).length, "files");

const pub = run("ig-publish.mjs", ["--folder", folder, "--ids", idsFile, "--mode", dry ? "dryrun" : "now", ...(dry ? [] : ["--approved"])]);
if (pub.status) process.exit(pub.status);
fs.rmSync(host, { recursive: true, force: true });
console.log("temporary Drive host files removed");
if (!dry) run("drive-archive.mjs", [folder]);
