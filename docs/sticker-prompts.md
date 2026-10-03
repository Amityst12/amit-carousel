# סטיקרים משלכם: פרומפטים ל-AI + חיתוך אוטומטי

סטיקרים הם איורי תגובה קטנים (אתם, בקריקטורה) שמופיעים בפינת שקף ונותנים לקרוסלה אישיות: 😲 מספר מפתיע, 🎉 חדשות טובות, 💡 טיפ, ⚠️ "חשוב לדעת". הם **לא חובה**, אבל הם מה שהופך קרוסלה לשלכם. הסקיל `/amit-setup` מוביל אתכם בתהליך; כאן הפירוט.

**איך זה עובד:** (1) מבקשים ממודל AI שמייצר תמונות גיליון של 8 איורים שלכם על רקע צבע אחיד ← (2) מריצים סקריפט אחד שחותך את הגיליון ל-8 קבצי PNG שקופים ← (3) הם מופיעים אוטומטית בכלי (`sticker: "thinking"`).

## 1. מה צריך
- **תמונת ייחוס שלכם:** פנים קדמיות, תאורה טובה, בלי משקפי שמש/כובע. (הכי חשוב לאיכות ולדמיון.)
- **מודל AI לתמונות עם העלאת תמונת ייחוס:** כל אחד שאתם אוהבים: ChatGPT (יצירת תמונות), Gemini (Nano Banana), Midjourney (`--cref`/`--oref`), Flux, Grok ועוד. הפרומפט למטה עובד בכולם, בדרך כלל ב-1–3 ניסיונות.
- **פייתון + 4 ספריות** לחיתוך: `pip install pillow numpy opencv-python scipy`

## 2. הפרומפט (גיליון 1: 8 רגשות)
העלו את תמונת הייחוס ושלחו (החליפו את `[…]` בתיאור שלכם):

```
Use the attached photo as the reference for the character. Create ONE image: a sticker sheet with exactly 8 stickers in a grid of 2 columns x 4 rows. Each sticker sits in its own equal-size cell with a generous empty margin around it, so nothing touches the cell edges.

Character: a friendly, high-quality 2D cartoon illustration of the person in the reference photo [e.g. "a man with short dark hair and a beard" / "a woman with long brown hair and glasses"]. Keep the SAME face, skin tone, hair, beard/glasses and clothing in all 8 stickers (consistent character). Clean vector-like style, bold outlines, vibrant colors. Head and shoulders only (bust). Each sticker has a thick white sticker-style outline around the whole figure.

Background: ONE flat solid color, pure green #00B140. No gradient, no texture, no shadow, no frame, no text. Do not use this green anywhere in the characters or props.

The 8 stickers in reading order (left to right, top to bottom):
1. angry - furious, frowning, red face, steam from the ears
2. happy - big warm smile, relaxed
3. celebrate - arms up, joyful, colorful confetti
4. laughing - laughing so hard he/she cries, tears of joy
5. thinking - hand on chin, looking up, a small "?" speech bubble
6. sad - crying, teary eyes
7. shocked - wide eyes, open mouth, small lightning bolts around the head
8. wink - hand on chin, winking, smug smile

No words or letters in the image (except the symbols ? and !). Portrait sheet, high resolution.
```

## 3. גיליון 2: עוד 8 סטיקרים (אופציונלי)
אותו דבר, עם הרשימה הבאה. **שימו לב:** בסטיקר `money` יש שטרות ירוקים. אם הרקע ירוק הם ייחתכו, לכן בגיליון הזה בקשו רקע **מג׳נטה `#FF00FF`** (ואל תשתמשו בו בדמות).

```
(the same character/background instructions as sheet 1, but the background is flat pure magenta #FF00FF)
1. thumbsup - big smile, thumbs up, small sparkles
2. idea - one finger raised, a glowing light bulb above the finger
3. money - dollar signs in the eyes, coins and banknotes flying around
4. pointing - pointing a finger straight at the viewer, friendly confident smile
5. warning - one finger raised, serious look, a red warning triangle next to the head
6. skeptical - one eyebrow raised, side-eye, a speech bubble with "?!"
7. facepalm - hand over the face, tired disappointed look
8. hurry - panicked, holding a stopwatch, speed lines
```

## 4. חיתוך לסטיקרים שקופים
שמרו את תמונת הגיליון (למשל `sheet1.png`) והריצו מתיקיית הפרויקט:
```bash
python scripts/cut-stickers.py sheet1.png --names angry,happy,celebrate,laughing,thinking,sad,shocked,wink --preview preview.png
python scripts/cut-stickers.py sheet2.png --names thumbsup,idea,money,pointing,warning,skeptical,facepalm,hurry --preview preview2.png
```
הסדר של `--names` הוא סדר הקריאה בגיליון (שמאל ← ימין, למעלה ← למטה). הקבצים נשמרים ב-`skill/template/public/images/stickers/`. פתחו את `preview.png` (הסטיקרים על רקע לבן וכהה) ובדקו: שוליים נקיים, בלי שאריות רקע. אם נשארו כתמים ירוקים בתוך הדמות הורידו את `--pocket-tol` (למשל `--pocket-tol 18`); אם נמחק חלק מהאיור שדומה לצבע הרקע, בקשו מהמודל גיליון חדש על רקע בצבע אחר ושמרו על `--bg`.

## 5. אם משהו לא יצא טוב
| בעיה | מה עושים |
|---|---|
| הדמות לא דומה/לא עקבית | נסו מודל אחר או הוסיפו "keep identical face in every cell"; חזרו על תמונת הייחוס. |
| המודל צייר פחות/יותר מ-8 או שבר את הרשת | בקשו "exactly 8, 2 columns x 4 rows, equal cells"; נסו שוב. |
| טקסט/אותיות בתוך האיורים | הוסיפו "no text, no letters". |
| רקע לא אחיד | הוסיפו "perfectly flat solid color"; אפשר `--bg "#00B140"` לציון הצבע ידנית. |
| איכות נמוכה | בקשו רזולוציה גבוהה (≥ 1500px גובה). הסטיקרים קטנים בשקף (≈260px), אז זה בדרך כלל מספיק. |

## 6. שימוש בקרוסלה
ב-`slides.ts`: `sticker: "thinking"` (+ `stickerPos: "top-left"` בהוק ובשקף ה-CTA; ברירת המחדל: מטה-שמאל). מומלץ 2–4 סטיקרים לקרוסלה, לא על כל שקף, ולפי הרגש: 🤔 `thinking` שאלה/הוק, 😲 `shocked` מספר מפתיע, 🎉 `celebrate`/`thumbsup` חדשות טובות, 💡 `idea` טיפ, 👉 `pointing` קריאה לפעולה, ⚠️ `warning` חשוב לדעת, 🤨 `skeptical` בדיקת טענה, 🤦 `facepalm` טעויות נפוצות, ⏱️ `hurry` מועד אחרון, 💰 `money` הטבות, 😢 `sad`/😠 `angry` כאב או חדשות רעות. בנושאים עצובים (אסון, אובדן) אל תשתמשו בסטיקרים.
