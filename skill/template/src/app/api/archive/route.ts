// Archive endpoint: saves an approved carousel to <project>/Published/<date>_<slug>/ and updates Published/index.csv.
// Local dev tool only (writes to disk). Slides arrive one by one as PNG data URLs — the SAME 2160×2700 export that gets uploaded to Instagram —
// and are only losslessly re-compressed (no resize, no palette), so the archive keeps upload quality.
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const runtime = "nodejs";

const ROOT = path.resolve(process.cwd(), "../../Published");
const CSV = path.join(ROOT, "index.csv");
const COLS = [
  "date", "slug", "title", "topic", "type", "hook", "keyword", "slides", "post_url",
  "views", "reach", "likes", "comments", "saves", "shares", "profile_follows", "keyword_comments", "notes",
];

const safeSlug = (s: string) => String(s || "post").toLowerCase().replace(/[^a-z0-9\u0590-\u05ff-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "post";
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

function folderFor(date: string, slug: string) {
  return path.join(ROOT, `${date}_${safeSlug(slug)}`);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, date, slug } = body as { action: string; date: string; slug: string };
  const dir = folderFor(date, slug);

  if (action === "slide") {
    const { name, dataUrl } = body as { name: string; dataUrl: string };
    fs.mkdirSync(path.join(dir, "slides"), { recursive: true });
    const buf = Buffer.from(dataUrl.split(",")[1], "base64");
    const out = await sharp(buf).png({ compressionLevel: 9, palette: false }).toBuffer(); // lossless
    fs.writeFileSync(path.join(dir, "slides", name.replace(/[^\w.-]/g, "_")), out);
    return NextResponse.json({ ok: true, bytes: out.length });
  }

  if (action === "finalize") {
    const { meta, caption } = body as { meta: Record<string, any>; caption?: string };
    // snapshot of the slides source + caption + meta
    fs.copyFileSync(path.resolve(process.cwd(), "src/slides.ts"), path.join(dir, "slides.ts.txt"));
    if (caption) fs.writeFileSync(path.join(dir, "caption.md"), caption, "utf8");
    const metaPath = path.join(dir, "meta.json");
    // keep metrics/post_url already filled by the user if re-archiving
    let previous: any = {};
    try { previous = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}
    const full = { ...meta, metrics: previous.metrics ?? meta.metrics, post_url: previous.post_url ?? meta.post_url, notes: previous.notes ?? meta.notes };
    fs.writeFileSync(metaPath, JSON.stringify(full, null, 2), "utf8");

    // index.csv (UTF-8 with BOM so Excel shows Hebrew)
    const m = full.metrics || {};
    const row: Record<string, unknown> = {
      date, slug: safeSlug(slug), title: full.title || "", topic: full.topic, type: full.type, hook: full.hook, keyword: full.keyword || "",
      slides: full.slides?.length ?? "", post_url: full.post_url ?? "",
      views: m.views ?? "", reach: m.reach ?? "", likes: m.likes ?? "", comments: m.comments ?? "", saves: m.saves ?? "",
      shares: m.shares ?? "", profile_follows: m.profile_follows ?? "", keyword_comments: m.keyword_comments ?? "", notes: full.notes ?? "",
    };
    let lines: string[] = [];
    try { lines = fs.readFileSync(CSV, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean); } catch {}
    if (lines.length === 0) lines = [COLS.join(",")];
    const key = `"${date}","${safeSlug(slug)}"`;
    lines = lines.filter((l, i) => i === 0 || !l.startsWith(key));
    lines.push(COLS.map((c) => csvCell(row[c])).join(","));
    fs.mkdirSync(ROOT, { recursive: true });
    fs.writeFileSync(CSV, "\uFEFF" + lines.join("\n") + "\n", "utf8");

    const files = fs.readdirSync(path.join(dir, "slides"));
    const total = files.reduce((s, f) => s + fs.statSync(path.join(dir, "slides", f)).size, 0);
    return NextResponse.json({ ok: true, dir, slides: files.length, totalKB: Math.round(total / 1024) });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
