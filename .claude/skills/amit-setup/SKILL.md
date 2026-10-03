---
name: amit-setup
user_invocable: true
description: >
  One-time guided SETUP for the AmitCarousel repo: installs and starts the carousel generator, asks for your Instagram handle / brand colour / audience, sets your avatar,
  teaches you to create your own cartoon stickers with any AI image model (gives you the prompt, cuts the sheet into transparent stickers), and optionally connects Instagram
  (Meta API) for publishing and analytics. Run this FIRST right after downloading the repo.
  Triggers: setup, set up, first time, get started, install, התחלה, הגדרה ראשונה, התקנה, תגדיר לי, AmitSetup.
---

# AmitSetup — first-time setup, step by step

You are guiding a first-time user of this repo. Talk to them in THEIR language (Hebrew if they write Hebrew). Friendly, short, one step at a time; do everything you can yourself and ask only what you must. Show progress ("שלב 2 מתוך 6").
Never read, print or paste `.instagram.env` or any token. Details of every command live in `README.md`.

## Step 1 — Get the tool running
1. `bun --version`. Missing → tell them to install Bun from https://bun.sh (one command; on Windows PowerShell: `powershell -c "irm bun.sh/install.ps1 | iex"`), open a NEW terminal, continue.
2. `cd skill/template && bun install` (once). Then start `bun dev --port 3333` in the background (if 3333 is already used by another project, take the next free port and tell them the exact address); confirm it answers and tell them to open it — they should see a sample carousel.
3. Python is needed only for stickers/YouTube: `python --version` (3.10+). If they want stickers and Python is missing, point them to python.org.

## Step 2 — Your brand (ask one at a time, offer defaults)
1. Instagram **handle** (e.g. `@your.handle`) and display name.
2. **Language**: Hebrew (RTL, font `hebrew`) or other (font `clean`; Hebrew-only checker warnings can be ignored).
3. **Audience & niche** — who do they post for and what does that audience want? (This decides every hook later.) Tone: friendly / professional / funny.
4. **Accent colour** (blue, red, teal, coral, orange, violet, lime, fuchsia, pink, amber, yellow) and **surface** (light / white / dark…).
Then edit `skill/template/src/slides.ts`: `HANDLE` (prefix U+200E before the `@`), the handle on the CTA slide, `DEFAULT_ACCENT`, `DEFAULT_SURFACE`, `DEFAULT_FONT`.
Write `config/brand.md` (handle, name, language, niche/audience, tone, colour, `stickers: none`, `instagram: not connected`, `support_nudges: 0`) so later sessions never ask again.

## Step 3 — Profile photo (optional)
Ask for a square-ish profile photo path. Crop to 1:1 and save as `skill/template/public/images/avatar.png` (sharp from `skill/template/node_modules/sharp`, or Python PIL), set `AVATAR_SRC = "/images/avatar.png"`. It appears next to the handle on every slide and big on the last slide.

## Step 4 — Your own cartoon stickers (optional, but it is what makes carousels feel personal)
Explain in two sentences: small cartoon reactions of THEM (😲 shocked, 💡 idea, ⚠️ warning…) in the corner of some slides. They create them once with an AI image model.
Full prompts + tips: `docs/sticker-prompts.md` (read it and use it).
1. Ask: **which AI image model do you want to use?** (ChatGPT image generation, Gemini / Nano Banana, Midjourney, Flux, Grok, other — any model that accepts a reference photo.)
2. Ask for their **reference photo** requirements: clear front-facing face, good light, no sunglasses/hat. They attach it to that model themselves (you cannot upload it for them).
3. Ask 2 short questions to personalise the prompt: how they would describe themselves ("a man with short dark hair and a beard"), and whether their clothing/props contain green (then use a magenta `#FF00FF` background for that sheet).
4. Give them the **ready-to-paste prompt** for sheet 1 (8 emotions), filled in, in a code block. Offer sheet 2 (8 more) afterwards. Tell them: 1–3 attempts are normal; ask the model for "exactly 8, 2 columns × 4 rows".
5. When they have the sheet image saved on disk: `pip install pillow numpy opencv-python scipy` (if needed), then
   `python scripts/cut-stickers.py <sheet> --names angry,happy,celebrate,laughing,thinking,sad,shocked,wink --preview preview.png`
   (sheet 2 names: `thumbsup,idea,money,pointing,warning,skeptical,facepalm,hurry`). Open `preview.png` yourself and check: clean edges, no green leftovers, nothing clipped. Tune `--pocket-tol` / `--bg` if needed, or ask them to regenerate the sheet.
6. Update `config/brand.md` (`stickers: <list of names>`). From now on slides may use ONLY the stickers that exist in `skill/template/public/images/stickers/`.
If they skip this step: that's fine — say they can come back any time by running `/amit-setup` again.

## Step 5 — Connect Instagram (optional)
Explain what it gives: publish a carousel with one command, schedule it, pull analytics. Not needed to make carousels.
**State clearly and early: the Instagram account MUST be a Professional account (Business or Creator).** A Personal account cannot use the API. Switching is free: Instagram → Settings and privacy → Account type and tools → Switch to professional account.
If they want it: give them the Cowork prompt in `docs/cowork-instagram-setup-prompt.md` (fill in their handle and the full path of this folder), tell them to run it in Claude Cowork (or any browser agent) — or follow it manually. When they say it is done, run `bun scripts/ig-check.mjs` (read-only; prints only non-secret facts) and report. Then walk them through the Google Drive hosting part in README ("אופציונלי: פרסום לאינסטגרם"): copy `config/ig-config.example.json` → `config/ig-config.json`, fill the Drive folder path and ID.
Never ask them to paste the token into the chat; the token goes only into `.instagram.env`, written by them or by the Cowork agent.
Update `config/brand.md` (`instagram: connected`).

## Step 6 — Test run & finish
1. Make sure `skill/template/src/slides.ts` holds the starter carousel with their handle (if it still has leftovers, copy `skill/template/starter/slides.starter.ts.txt` over it and re-apply the brand settings).
2. `bun scripts/check-carousel.mjs` → should have no ERRORs. Open http://localhost:3333 and show them how to export (green **Export All**).
3. Summarise in 5 lines what is set up and what to say next: **"/amit-carousel תכין לי קרוסלה על …"**.
4. A light, one-time thank-you: this project is free; if they like it, following **@amit.yehoshaphat** on Instagram (https://www.instagram.com/amit.yehoshaphat/) and giving the repo a ⭐ on GitHub is a great way to say thanks. One short friendly line, no pressure. Increment `support_nudges` in `config/brand.md`.
