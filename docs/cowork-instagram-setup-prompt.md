# חיבור האינסטגרם שלכם ל-API (פרומפט ל-Cowork / סוכן דפדפן)

> **שלב אופציונלי.** נדרש רק אם אתם רוצים שהמערכת תעלה קרוסלות, תתזמן ותמשוך סטטיסטיקות. בלי זה עובדים רגיל והעלאה ידנית.

## ⚠️ תנאי חובה: חשבון מקצועי (Business או Creator)
ה-API של אינסטגרם **עובד רק עם חשבון מקצועי**. חשבון אישי (Personal) לא יעבוד, ולא נוכל להעלות או למשוך נתונים. לפני הכול:
1. אינסטגרם ← פרופיל ← ☰ ← **Settings and privacy** ← **Account type and tools** ← **Switch to professional account** ← בחרו **Business** או **Creator** (חינם, ושניהם נתמכים).
2. לא צריך דף פייסבוק (Facebook Page) כשעובדים עם *Instagram API with Instagram Login*, השיטה שמתוארת כאן.

## מה צריך להכין
- חשבון אינסטגרם **מקצועי** (ראו למעלה) ואת שם המשתמש שלו.
- חשבון Meta for Developers (חינם): התחברו ל-[developers.facebook.com](https://developers.facebook.com) עם חשבון פייסבוק.
- סוכן שיודע לנהל דפדפן (Claude Cowork או דומה) שמחובר כבר לחשבונות שלכם בדפדפן, **או** עשו את השלבים בעצמכם לפי הפרומפט כמדריך.

## הפרומפט (העתיקו והחליפו את `[…]`)
```
אני צריך שתכין לי גישה ל-Instagram API (גרסת "Instagram API with Instagram Login") לחשבון האינסטגרם שלי, [@YOUR_HANDLE], ותכתוב את הערכים לקובץ מקומי. אל תפרסם כלום ואל תשנה שום דבר אחר.

תנאי חובה: החשבון חייב להיות Professional (Business או Creator). חשבון Personal לא יעבוד.

מה לעשות, בסדר הזה:
1. פתח את https://developers.facebook.com/apps ופתח את האפליקציה הקיימת שלי. אם אין, צור אפליקציה חדשה: Create App, בחר use case של Instagram / "Other" ואז סוג Business, וקרא לה "My Carousel Publisher".
2. בתפריט הצד: Add product / Use cases ← Instagram ← "API setup with Instagram login".
3. ודא שחשבון האינסטגרם [@YOUR_HANDLE] הוא Professional (Business או Creator). אם הוא Personal, עצור ותגיד לי: אני אמיר אותו בעצמי (Settings and privacy ← Account type and tools ← Switch to professional account).
4. ב-App roles ← Roles הוסף את החשבון כ-Instagram Tester אם צריך. את אישור ההזמנה אני אעשה בעצמי באפליקציית אינסטגרם (Settings ← Website permissions / Apps and websites ← Tester invites). ספר לי כשצריך.
5. בהרשאות (Permissions) הפעל רק את שלוש האלה: instagram_business_basic, instagram_business_content_publish, instagram_business_manage_insights. אל תפעיל הרשאות להודעות או לתגובות.
6. בסעיף "Generate access tokens" לחץ Generate token ליד החשבון שלי ואשר בחלון של אינסטגרם. אם מתבקשת סיסמה או אימות דו-שלבי, עצור: אני אזין אותם בעצמי.
7. אסוף: את ה-Instagram App ID, את ה-Instagram App Secret (אם נדרשת סיסמה כדי להציג אותו, אני אעשה זאת), את הטוקן שנוצר, ואת מזהה החשבון (Instagram account ID, ליד הטוקן).
8. כתוב את הערכים לקובץ .instagram.env בתיקיית הפרויקט שלי: [FULL_PATH_TO_PROJECT_FOLDER]\.instagram.env (אם הקובץ לא קיים, צור אותו; מותר להעתיק את .instagram.env.example), בפורמט:
   IG_APP_ID=...
   IG_APP_SECRET=...
   IG_ACCESS_TOKEN=...
   IG_USER_ID=...

כללי ברזל:
- לעולם אל תציג את הטוקן או את ה-App Secret בצ'אט, בצילום מסך, בלוג או בשום מקום אחר, ואל תשלח אותם לאף שירות. הם נכתבים רק לקובץ. בדוח כתוב רק את 4 התווים האחרונים.
- אל תבצע App Review, אל תוסיף משתמשים או אפליקציות אחרות, אל תשנה הגדרות אבטחה או חיוב, ואל תפרסם או תמחק תוכן.
- אם מתבקשים סיסמה, אימות דו-שלבי, תשלום או אימות עסק: עצור ושאל אותי.
- אם Instagram Login לא עובד אצלי (למשל דורש Facebook Page), עצור ותגיד לי במה נתקעת. אל תעבור בעצמך לשיטה אחרת.

דוח סיום (בלי סודות): מה הושלם, אילו הרשאות פעילות, האם החשבון Professional, ומה נשאר לי לעשות ידנית.
```

## אחרי שהסוכן סיים
1. **בדיקת חיבור** (קריאה בלבד, לא מפרסם): `bun scripts/ig-check.mjs`. אמור להדפיס שם משתמש, `account_type: BUSINESS` או `MEDIA_CREATOR`, ומדדים. אם מקבלים 401/190, הטוקן שגוי או פג.
2. **אירוח תמונות לפרסום (Google Drive):** ראו ב-README, "אופציונלי: פרסום לאינסטגרם". צריך תיקייה ב-Google Drive for Desktop שמשותפת "כל מי שיש לו הקישור, צפייה", וקובץ `config/ig-config.json`.
3. **הטוקן פג אחרי 60 יום.** שימו תזכורת ביומן להנפיק מחדש (אותו מסך ב-Meta, Generate token) ולעדכן את `.instagram.env`.

## 🔒 אבטחה
- `.instagram.env` כבר ב-`.gitignore`. אל תדחפו אותו לגיט ואל תשתפו אותו.
- אל תדביקו את הטוקן בצ׳אט (גם לא עם Claude). הסקילים של הפרויקט אסורים לקרוא את הקובץ.
- אם סוד דלף: בטלו מיד את הטוקן ב-Meta והנפיקו חדש.
