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
  const pri = new Function('name', 'let autoPri="";' + priBlock + ';return [name.replace(/\\s+/g," ").trim(),autoPri];');
  assert.deepEqual(pri('להזמין קולה דחוף'), ['להזמין קולה', 'high']);
  assert.deepEqual(pri('לסדר מחסן לא דחוף'), ['לסדר מחסן', 'low']);
  assert.deepEqual(pri('לסדר מחסן בינוני'), ['לסדר מחסן', 'med']);
  assert.deepEqual(pri('לתקן את המדף הנמוך'), ['לתקן את המדף הנמוך', '']);
});
