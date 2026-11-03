#!/usr/bin/env python3
"""בונה את מילוני השפות של תכל׳ס.
קלט:  tools/i18n/keys.txt (הטקסטים בעברית, שורה לכל קטע)
      tools/i18n/<lang>.txt (תרגום, אותו סדר שורות; ∅ = ריק)
      tools/i18n/extra.tsv (תוספות: he \\t en \\t ar \\t ru \\t fr \\t es)
פלט:  tasks-app/lang/<lang>.json + עדכון LANG_READY / I18N_V ב-index.html
שפה נכנסת ל-LANG_READY רק אם כל הקטעים תורגמו (גם קטעים חדשים שנוספו לממשק)."""
import json, re, sys, hashlib, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[2]
D = ROOT / 'tools/i18n'
LANGS = ['en', 'ar', 'ru', 'fr', 'es']
keys = (D / 'keys.txt').read_text(encoding='utf-8').rstrip('\n').split('\n')
extra = []
for ln in (D / 'extra.tsv').read_text(encoding='utf-8').split('\n'):
    if ln.strip() and not ln.startswith('#'):
        extra.append(ln.split('\t'))
# קטעים שקיימים כרגע בממשק (אם נוספו חדשים - חייבים תרגום ב-extra.tsv)
subprocess.run([sys.executable, str(ROOT / 'tools/i18n_extract.py')], cwd=ROOT, check=True, capture_output=True)
current = json.loads((ROOT / 'tools/i18n_keys.json').read_text(encoding='utf-8'))
ready, out_dir = ['he'], ROOT / 'tasks-app/lang'
out_dir.mkdir(exist_ok=True)
num = re.compile(r'\d+')
bad = 0
for li, lang in enumerate(LANGS):
    f = D / (lang + '.txt')
    if not f.exists():
        print(f'{lang}: אין קובץ'); continue
    tr = f.read_text(encoding='utf-8').rstrip('\n').split('\n')
    if len(tr) != len(keys):
        print(f'{lang}: {len(tr)} שורות במקום {len(keys)} - לא מופעל'); continue
    d = {}
    for k, v in zip(keys, tr):
        v = '' if v.strip() == '∅' else v
        if not set(num.findall(k)) <= set(num.findall(v)):
            print(f'  ⚠ {lang}: מספרים שונים: {k!r} -> {v!r}'); bad += 1
        d[k] = v
    for row in extra:
        if len(row) > li + 1 and row[li + 1].strip():
            d[row[0]] = '' if row[li + 1].strip() == '∅' else row[li + 1]
    missing = [k for k in current if k not in d]
    (out_dir / (lang + '.json')).write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    if missing:
        print(f'{lang}: חסרים {len(missing)} קטעים -> לא מופעל:', missing[:8])
    else:
        ready.append(lang); print(f'{lang}: ✓ {len(d)} קטעים')
ver = hashlib.md5(b''.join((out_dir / (l + '.json')).read_bytes() for l in ready[1:])).hexdigest()[:8]
p = ROOT / 'tasks-app/index.html'
s = p.read_text(encoding='utf-8')
s = re.sub(r"const LANG_READY=\[[^\]]*\]; // i18n:ready", 'const LANG_READY=' + json.dumps(ready) .replace('"', "'").replace(' ', '') + '; // i18n:ready', s)
s = re.sub(r"const I18N_V='[^']*'; // i18n:version", f"const I18N_V='{ver}'; // i18n:version", s)
p.write_text(s, encoding='utf-8')
print('LANG_READY =', ready, ' I18N_V =', ver, ' אזהרות:', bad)
