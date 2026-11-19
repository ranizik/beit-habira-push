// בדיקות אוטומטיות לתכל׳ס – רצות ב-GitHub Actions לפני כל העלאה לאתר (ומקומית: node --test tests/)
// אם בדיקה נכשלת – ההעלאה נעצרת והאתר נשאר על הגרסה הקודמת.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'tasks-app');
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const grab = (re, name) => { const m = html.match(re); assert.ok(m, 'לא נמצא בקוד: ' + name); return m[0]; };

// פונקציות הפענוח מתוך הקובץ עצמו (כך שבודקים את הקוד האמיתי)
const parserSrc = grab(/const HEB_NUMS[^\n]*\n/, 'HEB_NUMS')
  + grab(/const DAY_WORDS = \(function\(\)\{[\s\S]*?\n\}\)\(\);\n/, 'DAY_WORDS')
  + grab(/function normalizeHebrewTime[\s\S]*?\n}\n/, 'normalizeHebrewTime')
  + grab(/function parseHebrewDateTime[\s\S]*?\n}\n/, 'parseHebrewDateTime');
const parse = new Function(parserSrc + ';return parseHebrewDateTime;')();
const micSrc = grab(/function micMerge[\s\S]*?\n}\n/, 'micMerge') + grab(/function micDedupe[\s\S]*?\n}\n/, 'micDedupe');
const { micMerge, micDedupe } = new Function(micSrc + ';return {micMerge, micDedupe};')();

const ymd = (d) => d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : null;
const plusDays = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return ymd(d); };

test('תחביר: כל הסקריפטים בקובץ, ה-Service Worker וה-manifest', () => {
  assert.ok(scripts.length >= 1);
  scripts.forEach((s, i) => assert.doesNotThrow(() => new Function(s), 'שגיאת תחביר בסקריפט ' + i));
  assert.doesNotThrow(() => new Function(fs.readFileSync(path.join(APP, 'sw-push.js'), 'utf8')), 'sw-push.js');
  const man = JSON.parse(fs.readFileSync(path.join(APP, 'manifest-v3.json'), 'utf8'));
  assert.equal(man.short_name, 'תכל׳ס');
  man.icons.forEach((i) => assert.ok(fs.existsSync(path.join(APP, i.src)), 'אייקון חסר: ' + i.src));
});

test('גרסה וזכויות יוצרים', () => {
  assert.match(html, /const APP_VERSION='\d{4}-\d{2}-\d{2}[a-z]+'/);
  assert.match(html, /© 2026 רני איציק/);
  assert.match(html, /<link rel="manifest" href="manifest-v3.json"\/>/);
});

test('פונקציות חיוניות קיימות', () => {
  ['addTask', 'render', 'toggle', 'deleteWithUndo', 'editTask', 'saveEdit', 'showHelp', 'listInfo', 'notifSettings',
    'checkAccess', 'gcalConnectGuide', 'trackVisit', 'askPriority', 'parseWho', 'quickDate', 'gcalSettings', 'renderAccessAdmin', 'subscribeTasks']
    .forEach((f) => assert.match(html, new RegExp('function ' + f + '\\('), 'חסרה הפונקציה ' + f));
});

test('פענוח: תאריכים ושעות', () => {
  const cases = [
    ['לקנות ביצים מחר ב-10', 'לקנות ביצים', plusDays(1), '10:00'],
    ['לשלם חשבון ב-15/11', 'לשלם חשבון', null, null],
    ['לשלם חשבון ב-15/11 ב-10', 'לשלם חשבון', null, '10:00'],
    ['לבדוק מלאי בעוד שבוע', 'לבדוק מלאי', plusDays(7), null],
    ['להתקשר לרו"ח בעוד 3 ימים', 'להתקשר לרו"ח', plusDays(3), null],
    ['לשלם ארנונה בעוד שבועיים', 'לשלם ארנונה', plusDays(14), null],
    ['משימת בדיקה 3:42', 'משימת בדיקה', null, '15:42'],
    ['להתקשר לספק 10:30 בבוקר', 'להתקשר לספק', null, '10:30'],
    ['פגישה בשלוש וחצי', 'פגישה', null, '15:30'],
    ['ספירה ב-6 בבוקר', 'ספירה', null, '06:00'],
    ['לקנות 3 ארגזים', 'לקנות 3 ארגזים', null, null],
    ['התקשר למתתיהו ב-4 09', 'התקשר למתתיהו', null, '16:09'],
    ['התקשר למתתיהו בשעה 409', 'התקשר למתתיהו', null, '16:09'],
    ['התקשר למתתיהו בארבע ותשע דקות', 'התקשר למתתיהו', null, '16:09'],
    ['התקשר למתתיהו ב-4 ו-9 דקות', 'התקשר למתתיהו', null, '16:09'],
    ['פגישה בארבע ועשרים וחמש', 'פגישה', null, '16:25'],
    ['לשלם ב-300 שקל', 'לשלם ב-300 שקל', null, null],
    ['להתקשר לדוד 4:14 דקות', 'להתקשר לדוד', null, '16:14'],
    ['להתקשר לדוד בארבע וארבע עשרה דקות', 'להתקשר לדוד', null, '16:14'],
    ['לקנות 5 דקות הליכה', 'לקנות 5 דקות הליכה', null, null],
  ];
  for (const [text, name, date, time] of cases) {
    const r = parse(text);
    assert.equal(r.cleanText, name, text);
    if (date !== null) assert.equal(ymd(r.date), date, text + ' (תאריך)');
    assert.equal(r.time, time, text + ' (שעה)');
  }
  const nov = parse('לשלם חשבון ב-15 בנובמבר');
  assert.equal(nov.cleanText, 'לשלם חשבון'); assert.equal(nov.date.getMonth(), 10); assert.equal(nov.date.getDate(), 15);
  for (const t of ['לחדש רישיון לאוקטובר 2027', 'לחדש רישיון לאוקטובר2027', 'לחדש רישיון באוקטובר 2027']) {
    const r = parse(t); assert.equal(r.cleanText, 'לחדש רישיון', t);
    assert.equal(r.date.getFullYear(), 2027, t); assert.equal(r.date.getMonth(), 9, t);
  }
  const y = parse('לשלם ביטוח ב-15 במרץ 2027');
  assert.equal(y.cleanText, 'לשלם ביטוח'); assert.equal(y.date.getFullYear(), 2027); assert.equal(y.date.getDate(), 15);
  const n = parse('לשלם ביטוח 15/3/2027');
  assert.equal(n.cleanText, 'לשלם ביטוח'); assert.equal(n.date.getFullYear(), 2027); assert.equal(n.date.getMonth(), 2);
  const dec = parse('לסגור שנה בדצמבר');
  assert.equal(dec.cleanText, 'לסגור שנה'); assert.equal(dec.date.getMonth(), 11);
  assert.equal(parse('לקנות יין מאיציק').cleanText, 'לקנות יין מאיציק');
  assert.equal(parse('להשקות עציצים כל יום').rep, 'daily');
  assert.equal(parse('ישיבה כל שבוע').rep, 'weekly');
});

test('מיקרופון: איחוד תוצאות כפולות מאנדרואיד', () => {
  const run = (arr) => arr.reduce((f, t) => micMerge(f, t), '');
  assert.equal(run(['משימת', 'משימת בדיקה', 'משימת בדיקה']), 'משימת בדיקה');
  assert.equal(run(['לקנות', 'ביצים לבית']), 'לקנות ביצים לבית');
  assert.equal(run(['להכין תיק לפינג-פונג', 'להכין תיק לפינג פונג מחר ב-7']), 'להכין תיק לפינג פונג מחר ב-7');
  assert.equal(micDedupe('להכין תיק לפינג פונג להכין תיק לפינג פונג'), 'להכין תיק לפינג פונג');
  assert.equal(micDedupe('לקנות לחם לקנות חלב'), 'לקנות לחם לקנות חלב');
});

test('קטגוריה ודחיפות מהמשפט', () => {
  const catBlock = grab(/    const cats=allCats\(\)[\s\S]*?\n    }\n  }\n/, 'זיהוי קטגוריה').replace(/\n  }\n$/, '\n');
  const cat = new Function('allCats', 'name', 'let autoCat="";' + catBlock + ';return [name,autoCat];');
  const cats = () => ['בית', 'עבודה', 'מכירות'];
  assert.deepEqual(cat(cats, 'לקנות ביצים לבית'), ['לקנות ביצים', 'בית']);
  assert.deepEqual(cat(cats, 'לבית לקנות ביצים'), ['לקנות ביצים', 'בית']);
  assert.deepEqual(cat(cats, 'קטגוריה עבודה להזמין קולה'), ['להזמין קולה', 'עבודה']);
  assert.deepEqual(cat(cats, 'לקנות מתנה לבית של אמא'), ['לקנות מתנה לבית של אמא', '']);
  const priBlock = grab(/  const PRI_RULES=[\s\S]*?break; } }\n/, 'דחיפות');
  const pri = new Function('name', 'let autoPri="";const plang="he";' + priBlock + ';return [name.replace(/\\s+/g," ").trim(),autoPri];');
  assert.deepEqual(pri('להזמין קולה דחוף'), ['להזמין קולה', 'high']);
  assert.deepEqual(pri('לסדר מחסן לא דחוף'), ['לסדר מחסן', 'low']);
  assert.deepEqual(pri('לסדר מחסן בינוני'), ['לסדר מחסן', 'med']);
  assert.deepEqual(pri('לתקן את המדף הנמוך'), ['לתקן את המדף הנמוך', '']);
});

test('טווח תאריכים בדיבור: "מ... עד ..." נשמר כתאריך התחלה וסיום', () => {
  const r1 = parse('ספירת מלאי מ-20 עד 24 בנובמבר');
  assert.ok(r1.date && r1.date2, 'לא זוהה טווח');
  assert.equal(r1.cleanText, 'ספירת מלאי', 'שם המשימה נשאר נקי');
  assert.equal(r1.date.getDate(), 20);
  assert.equal(r1.date2.getDate(), 24);
  assert.equal(r1.date.getMonth(), 10, 'החודש מושלם מהצד השני');
  assert.equal(r1.date2.getMonth(), 10);

  const r2 = parse('מהיום עד מחר לסדר את המחסן');
  assert.equal(ymd(r2.date), plusDays(0));
  assert.equal(ymd(r2.date2), plusDays(1));
  assert.equal(r2.cleanText, 'לסדר את המחסן');

  const r3 = parse('חופשה מ-1.12 עד 5.12');
  assert.equal(r3.date.getDate(), 1);
  assert.equal(r3.date2.getDate(), 5);
  assert.equal(r3.cleanText, 'חופשה');

  const r4 = parse('שיפוצים מיום ראשון עד רביעי');
  assert.ok(r4.date && r4.date2 && r4.date2 > r4.date, 'ימי שבוע: הסוף אחרי ההתחלה');
  assert.equal(r4.cleanText, 'שיפוצים');

  const r5 = parse('ספירה מ-20 עד 24 בנובמבר בשעה 8');
  assert.equal(r5.time, '08:00', 'השעה נשמרת גם כשיש טווח');
  assert.equal(r5.cleanText, 'ספירה');

  // לא טווח: שמות מקומות ומשפטים רגילים לא נפגעים
  const p1 = parse('לנסוע מתל אביב עד חיפה');
  assert.equal(p1.date, null); assert.equal(p1.date2, null);
  assert.equal(p1.cleanText, 'לנסוע מתל אביב עד חיפה');
  const p2 = parse('להזמין יין מחר ב-10');
  assert.equal(p2.date2, null); assert.equal(p2.time, '10:00');
  assert.equal(parse('לקנות מלפפונים').date2, null, 'מילה שמתחילה ב-מ לא מבלבלת');
});

test('טווח תאריכים בדיבור: ה"א הידיעה, "תאריך", "בין ... ל..." וימים בלי חודש', () => {
  const inMonth = (d, day) => { assert.equal(d.getDate(), day); };

  // ה"א הידיעה - כך הכתיב מופיע בפועל בהכתבה בעברית
  const a = parse('ספירת מלאי מה-20 עד ה-24 בנובמבר');
  assert.ok(a.date && a.date2, '"מה-20 עד ה-24" לא זוהה');
  assert.equal(a.cleanText, 'ספירת מלאי');
  inMonth(a.date, 20); inMonth(a.date2, 24);

  // המילה "תאריך" באמצע
  const b = parse('ספירת מלאי מתאריך 20 עד תאריך 24 בנובמבר');
  assert.ok(b.date && b.date2, '"מתאריך ... עד תאריך ..." לא זוהה');
  assert.equal(b.cleanText, 'ספירת מלאי');

  // "בין ... ל..."
  const c = parse('ספירת מלאי בין 20 ל-24 בנובמבר');
  assert.ok(c.date && c.date2, '"בין 20 ל-24" לא זוהה');
  assert.equal(c.cleanText, 'ספירת מלאי');
  const d = parse('חופשה בין יום ראשון ליום רביעי');
  assert.ok(d.date && d.date2 && d.date2 > d.date, '"בין יום ראשון ליום רביעי" לא זוהה');
  assert.equal(d.cleanText, 'חופשה');

  // ימים בלי חודש, כשצד אחד מסומן כתאריך
  const e = parse('חוג מ-23 עד ה-27');
  assert.ok(e.date && e.date2, '"מ-23 עד ה-27" לא זוהה');
  inMonth(e.date, 23); inMonth(e.date2, 27);
  assert.equal(e.cleanText, 'חוג');
  assert.ok(e.date >= new Date(new Date().setHours(0, 0, 0, 0)), 'תאריך עתידי, לא בעבר');

  // בלי סימון תאריך - כמות, לא טווח
  assert.equal(parse('להזמין מ-6 עד 12 בקבוקים').date2, null, 'כמות לא הופכת לטווח');
  assert.equal(parse('חוג מ-23 עד 27').date2, null, 'בלי סימון תאריך אין טווח');
  assert.equal(parse('לעבוד בין הערביים').date2, null, '"בין" לבדה לא יוצרת טווח');
});

test('"עד ה-23 לחודש": ה"א הידיעה, שם נקי בלי "עד", והתחלה שהמיקרופון בלע', () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // ה"א הידיעה לפני "לחודש" - לא זוהה בכלל עד 19k
  const a = parse('לשלם ה-23 לחודש');
  assert.equal(a.date && a.date.getDate(), 23);
  assert.equal(a.cleanText, 'לשלם');

  // מילת "עד" לא נשארת בשם המשימה
  assert.equal(parse('לנסוע לחו"ל עד 23 בנובמבר').cleanText, 'לנסוע לחו"ל');
  assert.equal(parse('להגיש דוח עד מחר').cleanText, 'להגיש דוח');
  assert.equal(parse('לנסוע לחו"ל עד יום ראשון').cleanText, 'לנסוע לחו"ל');

  // "מה עד ה-23" - ההכתבה בלעה את תאריך ההתחלה, הכוונה מהיום
  const b = parse('לנסוע לחול מה עד ה-23 לחודש');
  assert.ok(b.date && b.date2, 'לא זוהה טווח');
  assert.equal(ymd(b.date), ymd(today), 'ההתחלה היא היום');
  assert.equal(b.date2.getDate(), 23);
  assert.equal(b.cleanText, 'לנסוע לחול');

  // ההכתבה מפצלת "מהיום" ל-"מה היום"
  const c = parse('לנסוע לחול מה היום עד ה-23 לחודש');
  assert.ok(c.date && c.date2, '"מה היום עד ..." לא זוהה כטווח');
  assert.equal(ymd(c.date), ymd(today));
  assert.equal(c.date2.getDate(), 23);
  assert.equal(c.cleanText, 'לנסוע לחול');

  // "מה" כמילה רגילה לא הופכת לטווח
  assert.equal(parse('לבדוק מה קרה').date, null);
  assert.equal(parse('לבדוק מה קרה').cleanText, 'לבדוק מה קרה');
  assert.equal(parse('לשאול מה הלקוח רוצה').date, null);
  assert.equal(parse('לשאול מה הלקוח רוצה').cleanText, 'לשאול מה הלקוח רוצה');
});

test('תאריכים שנאמרים במילים: "בעשרים בנובמבר", "מחמישה עשר לדצמבר"', () => {
  const day = (r) => r.date && r.date.getDate();

  assert.equal(day(parse('ספירת מלאי בעשרים בנובמבר')), 20);
  assert.equal(parse('ספירת מלאי בעשרים בנובמבר').cleanText, 'ספירת מלאי');
  assert.equal(day(parse('פגישה בחמישה עשר בדצמבר')), 15);
  assert.equal(day(parse('פגישה בחמש עשרה בדצמבר')), 15, 'צורת נקבה לא נקלטת כשעה 5:00');
  assert.equal(parse('פגישה בחמש עשרה בדצמבר').time, null);
  assert.equal(day(parse('לשלם בשלושים ואחד בדצמבר')), 31);
  assert.equal(day(parse('לשלם בעשרים ואחד בנובמבר')), 21);
  assert.equal(day(parse('לשלם בשלושה לחודש')), 3);

  const r = parse('ספירת מלאי מעשרים עד עשרים וארבעה בנובמבר');
  assert.ok(r.date && r.date2, 'טווח במילים לא זוהה');
  assert.equal(r.date.getDate(), 20);
  assert.equal(r.date2.getDate(), 24);
  assert.equal(r.cleanText, 'ספירת מלאי');

  const r2 = parse('חופשה מעשרים בנובמבר עד שלושה בדצמבר');
  assert.equal(r2.date.getMonth(), 10);
  assert.equal(r2.date2.getMonth(), 11);
  assert.equal(r2.date2.getDate(), 3);

  // מספר במילים בלי חודש = כמות, לא תאריך
  assert.equal(parse('לקנות שלושה בקבוקים').date, null);
  assert.equal(parse('לקנות שלושה בקבוקים').cleanText, 'לקנות שלושה בקבוקים');
  assert.equal(parse('להזמין עשרים ארגזים').date, null);

  // שעות ממשיכות לעבוד כרגיל
  assert.equal(parse('פגישה בשתים עשרה').time, '12:00');
  assert.equal(parse('להתקשר ביום חמישי בשלוש וחצי').time, '15:30');
  assert.equal(parse('לקנות ביצים מחר בעשר').time, '10:00');
});

// ── מסלול הדיבור עצמו, לא רק המפענח ──
// applyParsed הוא מה שהמיקרופון מפעיל. אין במסך ההוספה שדה "עד תאריך",
// ולכן תאריך הסיום חייב לעבור דרך pendingDate2 ל-addTask. בלי זה הטווח נעלם בדיבור
// גם כשהמפענח זיהה אותו נכון (קרה בפועל ב-19c..19l).
test('מסלול הדיבור: טווח שנאמר בקול מגיע עד המשימה השמורה', () => {
  const fake = {};
  const getEl = (id) => fake[id] || (fake[id] = { value: '', textContent: '', style: {} });
  ['f-name', 'f-date', 'f-time', 'parsed-hint'].forEach(getEl);

  const src = grab(/const HEB_NUMS[^\n]*\n/, 'HEB_NUMS')
    + grab(/const DAY_WORDS = \(function\(\)\{[\s\S]*?\n\}\)\(\);\n/, 'DAY_WORDS')
    + grab(/function normalizeHebrewTime[\s\S]*?\n}\n/, 'normalizeHebrewTime')
    + grab(/let pendingRep[^\n]*\n/, 'pendingRep')
    + grab(/function parseHebrewDateTime[\s\S]*?\n}\n/, 'parseHebrewDateTime')
    + grab(/function applyParsed[\s\S]*?\n}\n/, 'applyParsed');
  const api = new Function('document', 'LOC',
    src + ';return {applyParsed, parseHebrewDateTime, get d2(){return pendingDate2}, get d2for(){return pendingDate2For}};'
  )({ getElementById: getEl }, () => 'he-IL');

  api.applyParsed(api.parseHebrewDateTime('לנסוע לחול מה-19 לחודש עד ה-23 לחודש'));
  assert.equal(getEl('f-name').value, 'לנסוע לחול', 'שם המשימה נקי');
  assert.match(getEl('f-date').value, /^\d{4}-\d{2}-19$/, 'תאריך ההתחלה נכנס לשדה');
  assert.match(api.d2, /^\d{4}-\d{2}-23$/, 'תאריך הסיום נשמר להעברה ל-addTask');
  assert.equal(api.d2for, getEl('f-date').value, 'הסיום משויך לתאריך ההתחלה הזה');
  assert.match(getEl('parsed-hint').textContent, /–/, 'הרמז על המסך מציג טווח');

  // addTask חייב לקרוא את pendingDate2, אחרת הסיום נזרק
  const add = grab(/function addTask\(auto\)\{[\s\S]*?\n\}\n/, 'addTask');
  assert.match(add, /pendingDate2For===date/, 'addTask לוקח את "עד תאריך" מהדיבור');

  // בלי טווח - לא נשאר זכר מהקודם
  api.applyParsed(api.parseHebrewDateTime('לקנות חלב מחר'));
  assert.equal(api.d2, '', 'משימה בלי טווח מנקה את הסיום');
});

// "מה-22" נשמע בהכתבה כמו "מאה עשרים ושתיים" וההכתבה כותבת 122. קרה בפועל פעמיים.
test('הכתבה: "מה-22 לדצמבר" שנשמע כ-122', () => {
  const a = parse('לנסוע לחול 122 לדצמבר עד ה-30 לדצמבר');
  assert.ok(a.date && a.date2, '122 לפני שם חודש לא פוענח כ-"מה-22"');
  assert.equal(a.date.getDate(), 22);
  assert.equal(a.date.getMonth(), 11);
  assert.equal(a.date2.getDate(), 30);
  assert.equal(a.cleanText, 'לנסוע לחול');

  const b = parse('חוג ל-123 עד ה-27');
  assert.ok(b.date && b.date2, '123 לפני "עד" לא פוענח כ-"מה-23"');
  assert.equal(b.date.getDate(), 23);
  assert.equal(b.date2.getDate(), 27);
  assert.equal(b.cleanText, 'חוג');

  // מספרים תלת-ספרתיים שהם כמות - לא נוגעים בהם
  assert.equal(parse('להזמין 122 בקבוקים').date, null);
  assert.equal(parse('להזמין 122 בקבוקים').cleanText, 'להזמין 122 בקבוקים');
  assert.equal(parse('לשלם 199 שקל').date, null);
  assert.equal(parse('לספור 150 ארגזים').date, null);
});
