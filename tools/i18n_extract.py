# מחלץ את כל קטעי הטקסט בעברית מהממשק (לא מהמפענח של הדיבור) -> tools/i18n_keys.json
import re, json, pathlib
src = pathlib.Path('tasks-app/index.html').read_text(encoding='utf-8')
lines = src.split('\n')
# אזורים שלא מתרגמים: מפענח העברית (מילות זמן/דחיפות/קטגוריה) - זה קוד, לא ממשק
skip = []
def rng(start_pat, end_pat=r'^}$'):
    s = next(i for i, l in enumerate(lines) if re.search(start_pat, l))
    e = s if end_pat == 'SAME' else next(i for i in range(s + 1, len(lines)) if re.search(end_pat, lines[i]))
    skip.append((s, e))
rng(r'^const HEB_NUMS', 'SAME')
rng(r'^function normalizeHebrewTime')
rng(r'^function parseHebrewDateTime')
rng(r'^function micMerge'); rng(r'^function micDedupe'); rng(r'^function parseWho')
# מנוע התרגום עצמו (regex ושמות שפות)
rng(r'^// ── שפות \(i18n\) ──', r'^async function langPref')
# מסכי הניהול - לבעל העסק בלבד, נשארים בעברית (מסומנים data-notr)
for f in ['renderAccessAdmin', 'showStats', 'dependHtml', 'activityHtml', 'renderBackups', 'backupApi', 'showAdminVerify', 'onAdminCredential', 'admApply', 'admClose', 'renderOrgAdmin']:
    try: rng(r'^(async )?function ' + f + r'\b')
    except StopIteration: pass
for pat in [r'PRI_RULES\s*=', r'const tries=\[']:
    for i, l in enumerate(lines):
        if re.search(pat, l):
            e = i
            while e < len(lines) - 1 and not re.search(r'\];', lines[e]): e += 1
            skip.append((i, e))
def skipped(i): return any(a <= i <= b for a, b in skip)
HEB = '\u0590-\u05FF'
run = re.compile(r'[' + HEB + r'](?:[^<>{}`\'"\n\\]*[' + HEB + r'])?')
keys = {}
for i, l in enumerate(lines):
    if skipped(i): continue
    code = re.sub(r'(^|\s)//.*$', '', l) if '<' not in l[:3] else l
    # מדלגים על regex: קטעים בתוך /.../ עם תווי regex
    for m in run.finditer(code):
        t = m.group(0).strip()
        ctx = code[max(0, m.start() - 3):m.end() + 3]
        if re.search(r'\\s|\(\?|\|.*\||\\d', code[max(0,m.start()-40):m.end()+40]) and ('RegExp' in code or re.search(r'/[^/]*' + re.escape(t[:3]), code)): 
            if re.search(r'\.(test|match|replace)\(|new RegExp', code): continue
        keys[t] = keys.get(t, 0) + 1
out = sorted(keys)
pathlib.Path('tools/i18n_keys.json').write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding='utf-8')
print(len(out), 'keys,', sum(len(k) for k in out), 'chars')
