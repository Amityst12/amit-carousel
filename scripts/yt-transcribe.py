"""Transcribe a YouTube video to text (no need to watch it).

Usage (from the project root):
    python scripts/yt-transcribe.py "<youtube url>" [--lang en|he|auto] [--force-audio]

1. Tries the video's own captions first (tiny text download, seconds).
2. If there are none (or --force-audio), downloads the AUDIO only to a temp folder, transcribes it locally with
   faster-whisper (model "small"), then deletes the audio.
Output: transcripts/<video-id>.txt (lines like "[mm:ss] text") + the title/channel on top. Prints the path.
Requires: yt-dlp (pip), faster-whisper (pip), ffmpeg on PATH.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "transcripts")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def video_info(url):
    r = run([sys.executable, "-m", "yt_dlp", "--skip-download", "--no-warnings", "--print", "%(id)s\t%(title)s\t%(channel)s\t%(duration)s", url])
    if r.returncode != 0:
        sys.exit("yt-dlp failed:\n" + r.stderr[-800:])
    vid, title, channel, dur = r.stdout.strip().splitlines()[-1].split("\t")
    return vid, title, channel, dur


def mmss(sec):
    sec = int(sec)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def parse_vtt(path):
    lines, last = [], ""
    t = None
    for raw in open(path, encoding="utf-8", errors="replace"):
        raw = raw.strip()
        m = re.match(r"(\d+):(\d+):(\d+)\.\d+ -->", raw)
        if m:
            t = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            continue
        if not raw or raw.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")) or t is None:
            continue
        txt = re.sub(r"<[^>]+>", "", raw).strip()
        if txt and txt != last:
            lines.append(f"[{mmss(t)}] {txt}")
            last = txt
    return lines


def captions(url, tmp, lang):
    langs = "he.*,iw.*" if lang == "he" else "en.*,en"
    run([sys.executable, "-m", "yt_dlp", "--skip-download", "--no-warnings", "--write-subs", "--write-auto-subs", "--sub-langs", langs,
         "--sub-format", "vtt", "-o", os.path.join(tmp, "c.%(ext)s"), url])
    for f in sorted(os.listdir(tmp)):
        if f.endswith(".vtt"):
            return parse_vtt(os.path.join(tmp, f))
    return []


def whisper(url, tmp, lang):
    r = run([sys.executable, "-m", "yt_dlp", "--no-warnings", "-f", "bestaudio/best", "-x", "--audio-format", "wav", "-o", os.path.join(tmp, "a.%(ext)s"), url])
    wav = os.path.join(tmp, "a.wav")
    if not os.path.exists(wav):
        sys.exit("audio download failed:\n" + r.stderr[-800:])
    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segs, info = model.transcribe(wav, language=None if lang == "auto" else lang)
    return [f"[{mmss(s.start)}] {s.text.strip()}" for s in segs]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--force-audio", action="store_true")
    a = ap.parse_args()
    vid, title, channel, dur = video_info(a.url)
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="yt-")
    try:
        lines = [] if a.force_audio else captions(a.url, tmp, a.lang)
        source = "captions"
        if not lines:
            source = "whisper(small)"
            lines = whisper(a.url, tmp, a.lang)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    path = os.path.join(OUT, f"{vid}.txt")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"# {title}\n# channel: {channel} | duration: {dur}s | source: {source} | url: {a.url}\n\n" + "\n".join(lines) + "\n")
    print(path, f"({len(lines)} lines, {source})")


if __name__ == "__main__":
    main()
