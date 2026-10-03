// OPTIONAL branding archive: copies an approved/published carousel (slides PNG + caption + meta) to Google Drive for Desktop.
//   bun scripts/drive-archive.mjs <slug|folder>        (config/ig-config.json -> driveArchive.enabled / dir; enabled=false or a missing dir = skipped, exit 0)
// Target: <dir>/<archive-folder>/ = slides/*.png (upload quality), caption.md, meta.json. Contains no secrets.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfgPath = path.join(ROOT, "config", "ig-config.json");
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")).driveArchive || {} : {};
const arg = process.argv[2];
if (!cfg.enabled) { console.log("drive archive: disabled in config (skipped)"); process.exit(0); }
if (!arg) { console.error("usage: bun scripts/drive-archive.mjs <slug|folder>"); process.exit(1); }
const parent = path.dirname(cfg.dir);
if (!fs.existsSync(parent)) { console.log(`drive archive: ${parent} not found (Drive for Desktop not running?) — skipped`); process.exit(0); }
const pub = path.join(ROOT, "Published");
const folder = fs.readdirSync(pub).find((d) => d === arg || d.endsWith("_" + arg));
if (!folder) { console.error("no archive folder for", arg); process.exit(1); }
const dest = path.join(cfg.dir, folder);
fs.mkdirSync(dest, { recursive: true });
let n = 0;
for (const rel of ["caption.md", "meta.json"]) if (fs.existsSync(path.join(pub, folder, rel))) fs.copyFileSync(path.join(pub, folder, rel), path.join(dest, rel));
fs.mkdirSync(path.join(dest, "slides"), { recursive: true });
for (const f of fs.readdirSync(path.join(pub, folder, "slides"))) { fs.copyFileSync(path.join(pub, folder, "slides", f), path.join(dest, "slides", f)); n++; }
console.log(`drive archive: ${n} slides + caption -> ${dest}`);
