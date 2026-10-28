# תכל׳ס – מסמך טכני

> © 2026 רני איציק. כל הזכויות שמורות.
> מסמך זה מיועד למי שמתחזק את האפליקציה (מתכנת, או Claude בשיחה חדשה). קראו אותו לפני כל שינוי.

**מה זה:** אפליקציית משימות בקול בעברית (PWA). לוחצים על המיקרופון, אומרים משימה, והיא נרשמת עם תאריך, שעה, קטגוריה ודחיפות. יש תזכורות Push, נודניק, חיבור ל-Google Tasks וליומן, רשימות משותפות, וניהול משתמשים ומנויים.

- כתובת: https://beit-habira.com/tasks/
- בעלים: רני איציק (חשבון Google: ranizik@gmail.com)

---

## 1. מבנה כללי

```
 טלפון / דפדפן                       Hostinger (beit-habira.com)
 ┌───────────────────┐              public_html/tasks/
 │ index.html (PWA)  │◄──── קבצים ── index.html, sw-push.js, manifest-v3.json,
 │ sw-push.js (SW)   │              icons, .htaccess
 └─────┬───────┬─────┘
       │       │ Firebase JS SDK (קריאה/כתיבה ישירה של משימות)
       │       ▼
       │   Firebase Realtime DB  (פרויקט orders-app-78c0f – משותף עם מערכת ההזמנות של החנות!)
       │       ▲
       │ fetch │ firebase-admin
       ▼       │
 Render: beit-habira-api  (ריפו ranizik/beit-habira-api, Node/Express)
   taskReminders.js  tasksGcal.js  tasksStats.js  tasksAccess.js  tasksHealth.js
       │
       └── FCM (Push), Google OAuth / Tasks API / Calendar API
```

| רכיב | איפה | ריפו |
|---|---|---|
| אפליקציה (קובץ אחד) | `public_html/tasks/index.html` ב-Hostinger | `ranizik/beit-habira-push` → `tasks-app/` (עותק) |
| Service Worker (התראות) | `public_html/tasks/sw-push.js` | אותו ריפו |
| שרת API | Render – שירות `beit-habira-api` (srv-d9utubfavr4c73bhh360) | `ranizik/beit-habira-api` |
| שרת Push ישן (OneSignal) + מעיר את ה-API | Render | `ranizik/beit-habira-push` → `server.js` |
| מסד נתונים | Firebase RTDB `orders-app-78c0f` (europe-west1) | – |
| OAuth / Tasks / Calendar | Google Cloud – פרויקט `beit-habira-todo` | – |

---

## 2. האפליקציה (`tasks-app/index.html`)

קובץ HTML אחד: CSS + HTML + JS בלי build. נקודות חשובות:

- **`APP_VERSION`** (קבוע בסוף הקובץ) – **חובה להעלות בכל שינוי** (פורמט `YYYY-MM-DD` + אות). באפליקציה פתוחה יש בדיקה ב-`visibilitychange`: אם הגרסה באתר שונה, הדף נטען מחדש.
- **Firebase:** אפליקציה בשם `'staff-tasks'` (`TASKS_APP`), `authDomain: 'beit-habira.com'` – קבצי ההתחברות מתארחים ב-`beit-habira.com/__/auth` (מגיעים דרך proxy בשרת `/tasks/auth-helper/:file`). בלי זה התחברות באייפון לא עובדת.
- **התחברות:**
  - מנהל: קוד PIN → custom token עם `uid = 'staff-tasks'`.
  - משתמשים: Google Identity Services → השרת מאמת ומחזיר custom token (`/tasks/google-login`, ובאייפון/PWA `/tasks/google-login-redirect` עם nonce).
  - הרשמה ישירה ב-Firebase חסומה בכוונה.
- **נתיבי משימות:** `refForUser()` / `listTasksRef(listId)`:
  - מנהל: `todo/tasks`
  - משתמש: `todo/users/<uid>/tasks`
  - רשימה משותפת: `todo/shared/<listId>/tasks`
- **מזהה משימה = המפתח ב-Firebase.** ב-`subscribeTasks` מנרמלים `t.id = key`. משימות ישנות היו עם id שונה, וזה גרם למחיקה שלא עבדה.
- **זיהוי דיבור:**
  - `SpeechRecognition` במצב `continuous`. עצירה אחרי שקט של `MIC_SILENCE_MS` (2300ms), ואז הוספה אוטומטית.
  - `micMerge` + `micDedupe`: אנדרואיד שולח תוצאות מצטברות או כפולות, ולכן חייבים לאחד אותן.
- **פענוח עברית** – `normalizeHebrewTime` + `parseHebrewDateTime`:
  - תאריכים: היום/מחר/מחרתיים, יום בשבוע, "ראשון הבא", `15/11`, "15 בנובמבר", "5 לחודש", "בעוד X ימים/שבועות/חודש", "שבוע הבא".
  - שעות: `ב-10`, `10:30`, "שלוש וחצי". **1–6 בלי "בבוקר" = אחה"צ.**
  - חזרה: "כל יום/שבוע/חודש/ראשון".
  - ב-`addTask`:
    - קטגוריה: "קטגוריה X", "…לבית" בכל מקום במשפט, אבל לא לפני "של".
    - דחיפות: `PRI_RULES` – שלוש רמות: `high` דחוף / `med` בינוני / `low` לא דחוף.
    - "באחריות X": `parseWho`, רק ברשימה משותפת.
- **אחרי הקלטה בלי דחיפות** נפתח חלון "דחוף?" (`askPriority`), שנסגר לבד אחרי 8 שניות.
- **Google Tasks:** במצב שרת (`gcalSrv.configured`) כל הקריאות עוברות דרך `/tasks/gcal/*`. יש גם מצב ישן מהדפדפן (token לשעה) כגיבוי.
- **מסכים:**
  - ❓ `showHelp`: המדריך. נפתח פעם אחת אוטומטית בכניסה הראשונה.
  - 📊 `showStats`: נתונים + ניהול משתמשים (`renderAccessAdmin`).
  - 🔔 `notifSettings`: הגדרות הנודניק.
  - 📅 `gcalSettings`: יומן Google.
  - רשימות משותפות: `listInfo`.
  - `showLocked`: מסך נעילה למשתמש לא מאושר או שהמנוי שלו נגמר.
- **ספירת כניסות:** `trackVisit()` – פעם ביום לכל מכשיר, גם בלי התחברות. מקור התנועה לפי `?src=wa` / `?src=fb`.

### Service Worker (`sw-push.js`)
- מציג Push מ-FCM.
- אם יש `data.act` (טוקן חתום), מוסיף כפתורים "✅ בוצע" / "⏰ עוד 30 דק׳". הלחיצה שולחת `POST /tasks/nag/act` בלי שהאפליקציה פתוחה.

---

## 3. השרת (`ranizik/beit-habira-api`)

כל המודולים נרשמים ב-`server.js` **לפני** `app.use(requireApiKey)`, כי הם מאומתים ב-Firebase ID token ולא ב-API key. CORS פתוח.

| מודול | תפקיד | נתיבים עיקריים |
|---|---|---|
| `taskReminders.js` | תזכורות כל דקה (ערב לפני ב-20:00 + בשעת המשימה), נודניק, רשימות משותפות, רישום Push | `/tasks/push-register`, `/tasks/lists/*` (create, join, leave, notify, info, contacts, add, remove-tasks), `/tasks/nag/settings`, `/tasks/nag/act` |
| `tasksGcal.js` | חיבור קבוע ל-Google (refresh token בשרת), Google Tasks, אירועי יומן (לסמסונג), התחברות Google, דפי פרטיות | `/tasks/gcal/*`, `/tasks/google-login(-redirect)`, `/tasks/privacy`, `/tasks/home`, `/tasks/auth-helper/:file` |
| `tasksStats.js` | נתוני שימוש, כניסות לקישור | `/tasks/stats/ping`, `event`, `visit`, `summary` (מנהל בלבד) |
| `tasksAccess.js` | מנויים: אישור משתמשים חדשים, ניסיון, נעילה, תקופת הרצה (חינם) | `/tasks/access/me`, `list`, `set`, `config` |
| `tasksHealth.js` | בדיקה עצמית כל 5 דקות + התראה לבעלים | `GET /tasks/health` |

**תזכורות (`tick` ב-`taskReminders.js`):**
- רץ כל דקה, וקורא את כל המשימות.
- מה שנשלח נשמר במשימה ב-`rem`: `k` (תאריך|שעה – שינוי מאפס), `eve`, `at`, `atAt`, `nagAt`, `nagN`, `snooze`.
- משתמש נעול או ממתין לאישור לא מקבל תזכורות (`tasksAccess.blockedSet`).
- **נודניק:** משימה עם שעה, אחרי שנשלחה תזכורת `at`:
  - חוזר כל `every` דקות (5/10/15/30). ברירת מחדל: `mode: 'all'`, `every: 5`.
  - שקט בין 22:00 ל-07:00. עד 24 שעות, ולכל היותר 120 פעמים.
  - ברשימה משותפת – רק למי שהמשימה באחריותו (`t.who.uid`).
  - הטוקן בכפתורים: HMAC על `path|id`, עם מפתח שנגזר מ-`FIREBASE_KEY`.
- **שעון:** הכל לפי `Asia/Jerusalem` (`ilTime`).

**משתני סביבה ב-Render** (שמות בלבד, הערכים אצל רני):
- `FIREBASE_KEY`, `FIREBASE_DB_URL`, `API_KEY` – חובה.
- `GCAL_CLIENT_SECRET` – חיבור Google קבוע. בלעדיו האפליקציה עוברת למצב הדפדפן הישן.
- `GCAL_CLIENT_ID` – אופציונלי. ברירת המחדל: ה-client של `beit-habira-todo`.
- משתנים של מערכות אחרות בחנות (PayPlus, Brevo ועוד) – לא קשורים לתכל׳ס.

**Google Cloud (`beit-habira-todo`):**
- OAuth client: `895106923239-7ctgh1gc0je4pah4egj0t8h2ajapo95c`, במצב In production אבל לא מאומת.
- הגבלה: עד 100 משתמשים ב-scopes רגישים (יומן).
- APIs מופעלים: Tasks API, Calendar API.
- Redirect: `https://beit-habira-api.onrender.com/tasks/gcal/callback`.

---

## 4. מבנה הנתונים ב-Firebase

| נתיב | תוכן | מי כותב |
|---|---|---|
| `todo/tasks/<id>` | משימות המנהל | אפליקציה |
| `todo/users/<uid>/tasks/<id>` | משימות משתמש | אפליקציה |
| `todo/shared/<listId>` | `{name, owner, invite, created, members:{uid:{name,at,via,by,byName}}, tasks, log}` | members / invite / log – שרת בלבד. tasks – חברי הרשימה |
| `todo/userLists/<uid>/<listId>` | אינדקס הרשימות של המשתמש | שרת |
| `todoPushTokens/<uid>/<deviceId>` | טוקני FCM | שרת |
| `todoGcal/<uid>` | `{refresh, email, cal, events}` | שרת |
| `todoGcalEv/<uid>/<gtaskId>` | מזהה אירוע ביומן | שרת |
| `todoAccess/users/<uid>` | `{name, email, start, until, locked, pending, plan}` | שרת |
| `todoAccess/config` | `{trialDays, price, contact, approval, freeMode}` | שרת (מנהל) |
| `todoNag/<uid>` | `{mode, every}` | שרת |
| `todoStats/*` | `users`, `daily/<YYYY-MM-DD>`, `visitors` | שרת |
| `todoHealth` | מצב הבדיקה העצמית האחרון | שרת |

**משימה:**
```
{ id, name, pri: 'high'|'med'|'low', date: 'YYYY-MM-DD', time: 'HH:MM', done, doneAt?, created,
  cat?, notes?, rep?: 'daily'|'weekly'|'monthly', gtaskId?, gOwner?,
  by?, byUid?, who?: {uid,name}, rem? }
```

> ⚠️ **ה-DB משותף עם מערכת ההזמנות של החנות.** לא לשנות את חוקי האבטחה (rules) בלי לבדוק את שתי המערכות. מחיקה ברשימה משותפת עוברת דרך השרת (`/tasks/lists/remove-tasks`), כי החוקים חוסמים מחיקה ישירה.

---

## 5. העלאה לאוויר (Deploy)

**שרת:** כל `git push` ל-`main` ב-`ranizik/beit-habira-api` עולה אוטומטית ב-Render (בערך 2 דקות). בודקים ב-Render → Events שכתוב "Deploy live".

**אפליקציה (כרגע ידני):**
1. שינוי ב-`tasks-app/index.html` (ו-`sw-push.js` לפי הצורך) + העלאת `APP_VERSION`.
2. בדיקה מקומית (סעיף 6).
3. `git commit` + `git push` ל-`ranizik/beit-habira-push`.
4. העלאה ל-Hostinger → File Manager (File Browser) → `public_html/tasks/`:
   - **לגבות קודם:** `index-before-<מה>-<תאריך>.html`.
   - להעלות, ולוודא שהקובץ באתר זהה לקובץ בגיטהאב.
   - (אוטומטית מהדפדפן: `POST <base>/api/resources/public_html/tasks/<file>?override=true` עם כותרת `X-Auth` = ה-jwt מ-localStorage. קריאה: `GET <base>/api/raw/...`.)
5. בדיקה באתר: `APP_VERSION` החדש מופיע ב-`https://beit-habira.com/tasks/`.

**חשוב:**
- **סדר העלאה:** אם שינוי באפליקציה תלוי בנתיב חדש בשרת, מעלים קודם את השרת ומחכים ל-"Deploy live".
- **קבצים שלא נשמרים במטמון:** `.htaccess` מונע מטמון ל-`index.html`, `manifest*.json` ו-`sw-push.js`.
  - אייקונים: משנים שם קובץ (`icon-v3-…`) במקום לדרוס.
  - manifest: מעלים שם חדש (`manifest-v3.json`), כי מכשירים שומרים את הישן.
- **גיבויים:** כל הגרסאות הקודמות נמצאות ב-`public_html/tasks/*-before-*` ובהיסטוריית git.

---

## 6. בדיקות

עד שיהיו בדיקות אוטומטיות:
- **תחביר:** `node -e` שמריץ `new Function()` על כל `<script>` בקובץ.
- **פענוח עברית:** לחלץ את `HEB_NUMS` + `normalizeHebrewTime` + `parseHebrewDateTime` ולהריץ על משפטים לדוגמה. יש דוגמאות בהיסטוריית ה-commits.
- **ממשק:** Playwright עם Firebase מדומה (Proxy שמחזיר את עצמו), הזרקת `tasks` ו-`curUser`, קריאה ל-`render()` וצילום מסך ב-390×844.
- **שרת:** להריץ מודול עם `db` / `admin` מדומים ולקרוא לנתיבים ישירות (ראו commits אחרונים).
- **אחרי העלאה:** בדיקת `APP_VERSION` באתר, ו-`GET /tasks/health` מחזיר `ok: true`.

---

## 7. ניטור ותקלות

- **בדיקה עצמית** (`tasksHealth.js`): אם התזכורות תקועות יותר מ-5 דקות, אם יש 3 שגיאות רצופות, או אם הרבה התראות Push נכשלות – נשלחת התראה לבעלים "⚠️ תכל׳ס: …", ואחר כך "✅ חזר לעבוד".
- **ניטור חיצוני (מומלץ):** UptimeRobot על `https://beit-habira-api.onrender.com/tasks/health`. מחזיר 503 בתקלה, ומתריע במייל גם כשהשרת כולו נפל.
- **לוגים:** Render → `beit-habira-api` → Logs.

**תקלות שהיו, והפתרון:**

| תקלה | סיבה | פתרון |
|---|---|---|
| התראות לא הגיעו כשהאפליקציה סגורה | טיימרים מקומיים בלבד | תזכורות מהשרת (FCM) |
| התחברות Google באייפון | Safari ITP, הרשמה חסומה, CSRF | קבצי auth על הדומיין + התחברות דרך השרת + nonce |
| מילים כפולות בדיבור | אנדרואיד שולח תוצאות מצטברות | `micMerge`/`micDedupe` |
| שעה נכנסה לשם המשימה | "3:42" בלי "ב-" | נרמול לשעה |
| מחיקה ברשימה משותפת | חוקי DB + מזהה משימה ישן | מחיקה דרך השרת + נרמול id |
| הלוגו הישן בהתקנה | manifest במטמון | שם קובץ חדש + no-cache |

---

## 8. החלטות מוצר (כדי לא לשנות בטעות)

- **דחיפות:** שלוש רמות – דחוף 🔴 / בינוני 🟡 / לא דחוף (ברירת מחדל). בחלון "דחיפות?" אחרי הקלטה יש שלושה כפתורים.
- **Google Tasks:** השעה לא בכותרת המשימה, אלא בפרטים (Google לא שומר שעה במשימות).
- **מסלול:** תקופת הרצה – כל משתמש מאושר בחינם. **כל משתמש חדש צריך אישור של רני** (`approval: true`).
- **חשבון הבעלים:** ranizik@gmail.com אף פעם לא ננעל, ולא נספר בנתוני השימוש.
- **נודניק:** ברשימה משותפת מציק רק למי שהמשימה באחריותו.
- **רשימות משותפות:** לא נמחקות לעולם, גם כשכולם יוצאים.
- **עיצוב:** כחול לילה `#1E1B4B` + קורל `#FF5A5F`, גופן Rubik.
