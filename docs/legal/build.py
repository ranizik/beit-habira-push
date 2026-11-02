# בונה את דפי ה-HTML של המסמכים המשפטיים מקובצי ה-Markdown.
# שימוש:  python3 docs/legal/build.py            -> טיוטות ל-docs/legal/html/ (לא עולות לאתר)
#         python3 docs/legal/build.py --publish  -> tasks-app/ (עולה לאתר!) - רק אחרי שכל שדות [להשלמה] הושלמו
import sys, re, pathlib, markdown
here = pathlib.Path(__file__).parent
publish = '--publish' in sys.argv
out = (here.parent.parent / 'tasks-app') if publish else (here / 'html')
out.mkdir(exist_ok=True)
docs = {'terms': ('terms.md', 'תנאי שימוש'), 'privacy': ('privacy.md', 'מדיניות פרטיות'), 'business': ('business-addendum.md', 'נספח פרטיות ללקוחות עסקיים')}
CSS = """body{margin:0;font-family:Rubik,system-ui,Arial,sans-serif;background:#F4F3FB;color:#1A1A2E;line-height:1.75}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}h1{color:#1E1B4B;font-size:26px;margin:0 0 6px}
h2{color:#1E1B4B;font-size:19px;margin:26px 0 8px}h3{font-size:16px;margin:18px 0 6px}
table{width:100%;border-collapse:collapse;background:#fff;font-size:14px;margin:8px 0}td,th{border:1px solid #E2E1F0;padding:8px;text-align:right;vertical-align:top}
th{background:#EEEDF7}ul{padding-inline-start:22px}a{color:#4338CA}nav{font-size:14px;margin-bottom:14px}
.ph{background:#FFF4DB;color:#8A5A00;border-radius:4px;padding:0 3px}.draft{background:#FDECEA;color:#B42318;border-radius:10px;padding:8px 12px;font-weight:700;margin-bottom:12px}"""
# בדיקה לפני כתיבה: לא מפרסמים כל עוד יש שדות פתוחים
missing = sum(len(re.findall(r'\[להשלמה', (here / src).read_text(encoding='utf-8'))) for src, _ in docs.values())
if publish and missing:
    sys.exit(f'נעצר: {missing} שדות [להשלמה] עדיין פתוחים - לא מפרסמים (לא נכתב כלום)')
for key, (src, title) in docs.items():
    md = (here / src).read_text(encoding='utf-8')
    n = len(re.findall(r'\[להשלמה', md))
    body = markdown.markdown(md, extensions=['tables'])
    body = re.sub(r'\[(להשלמה[^\]]*)\]', r'<span class="ph">[\1]</span>', body)
    nav = ' · '.join(f'<a href="{k}.html">{t}</a>' for k, (_, t) in docs.items() if k != key)
    draft = '' if publish else f'<div class="draft">טיוטה – לא לפרסום ({n} שדות להשלמה)</div>'
    html = f'<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>תכל׳ס – {title}</title><link rel="icon" href="icon-v3-192.png"><style>{CSS}</style></head><body><main><nav><a href="./">← לתכל׳ס</a> · {nav}</nav>{draft}{body}</main></body></html>'
    (out / f'{key}.html').write_text(html, encoding='utf-8')
    print(f'{key}.html  ({n} שדות להשלמה)')
