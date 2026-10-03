// Prepare a carousel for Instagram from its ARCHIVE folder (the archive is the upload package):
//   bun scripts/ig-prepare.mjs <slug-or-folder-name>
// -> verifies order/size, converts slides/*.png to JPEG 1080x1350 (4:5, q95, sRGB) into a TEMP folder (not into Published/), prints a manifest (no secrets).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "skill", "template", "package.json"));
const sharp = require("sharp");

const arg = process.argv[2];
if (!arg) { console.error("usage: bun scripts/ig-prepare.mjs <slug|folder>"); process.exit(1); }
const pub = path.join(ROOT, "Published");
const folder = fs.readdirSync(pub).find((d) => d === arg || d.endsWith("_" + arg));
if (!folder) { console.error("no archive folder for", arg); process.exit(1); }
const slidesDir = path.join(pub, folder, "slides");
const files = fs.readdirSync(slidesDir).filter((f) => /^\d{2}-.*\.png$/i.test(f)).sort();
if (files.length < 2 || files.length > 10) { console.error(`need 2-10 slides, found ${files.length}`); process.exit(1); }
const out = path.join(os.tmpdir(), "ig-publish", folder);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const manifest = [];
for (const [i, f] of files.entries()) {
  const meta = await sharp(path.join(slidesDir, f)).metadata();
  const ratio = meta.width / meta.height;
  if (Math.abs(ratio - 0.8) > 0.002) throw new Error(`${f}: ratio ${ratio.toFixed(3)} is not 4:5`);
  const name = `${String(i + 1).padStart(2, "0")}.jpg`;
  await sharp(path.join(slidesDir, f)).resize(1080, 1350, { fit: "fill" }).flatten({ background: "#ffffff" }).toColorspace("srgb").jpeg({ quality: 95 }).toFile(path.join(out, name));
  const size = fs.statSync(path.join(out, name)).size;
  if (size > 8 * 1024 * 1024) throw new Error(`${name} is over 8 MB`);
  manifest.push({ order: i + 1, source: f, jpeg: name, kb: Math.round(size / 1024) });
}
const caption = fs.readFileSync(path.join(pub, folder, "caption.md"), "utf8").trim();
const lines = caption.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
console.log("folder:", folder, "| out:", out);
console.table(manifest);
console.log("caption lines:", lines.length, lines.length === 2 ? "(OK: exactly 2)" : "(WARNING: the format is exactly 2 lines)");
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ folder, files: manifest.map((m) => m.jpeg), caption }, null, 2));
