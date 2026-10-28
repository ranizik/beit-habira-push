# תכל׳ס – beit-habira.com/tasks

> 📘 **מסמך טכני מלא: [`../TECHNICAL.md`](../TECHNICAL.md)** – לקרוא לפני כל שינוי.

עותק של קבצי האפליקציה כפי שהם עולים לאתר (Hostinger → `public_html/tasks/`).
כל שינוי באפליקציה נשמר כאן כ-commit, כך שאפשר לראות היסטוריה ולחזור לכל גרסה.

| קובץ | מה זה |
|---|---|
| `index.html` | האפליקציה כולה (HTML + JS) |
| `sw-push.js` | Service Worker – מציג התראות Push גם כשהאפליקציה סגורה |
| `manifest.json` | הגדרות התקנה למסך הבית |
| `.htaccess` | מונע שמירה במטמון של index.html (כדי שעדכונים יגיעו מיד) |

**שרתים קשורים:**
- `ranizik/beit-habira-api` (Render) – תזכורות, רשימות משותפות, חיבור Google, כניסה עם Google, נתוני שימוש
- `server.js` בריפו הזה – שרת ההתראות הישן, שגם מעיר את שרת ה-API כל 10 דקות

**חזרה לגרסה קודמת:** להעלות את `index.html` מה-commit הרצוי לתיקייה `public_html/tasks/` ב-Hostinger.
