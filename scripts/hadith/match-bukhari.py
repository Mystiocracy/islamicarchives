import json, re
from rapidfuzz import fuzz
import pandas as pd
D = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def norm(s):
    s = D.sub('', s or '')
    s = re.sub('[إأآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه')
    return re.sub(r'[^ء-ي]', '', s)
fz = json.load(open('/home/claude/bk/dl/fz/ara-bukhari.json'))['hadiths']
fzn = [norm(h['text']) for h in fz]
d = pd.read_parquet('/home/claude/bk/dl/hadith.parquet'); b = d[d.source.str.contains('Bukhari')].reset_index(drop=True)
out = []; j = 0; low = 0
for i, r in b.iterrows():
    a = norm(r.text_ar)[:300]
    best, bs = None, 0
    lo, hi = max(0, j - 30), min(len(fz), j + 120)
    for k in range(lo, hi):
        s = fuzz.ratio(a, fzn[k][:300]) / 100
        if s > bs: bs, best = s, k
        if s > 0.97: break
    if bs < 0.85: low += 1
    out.append((int(r.hadith_id), str(r.hadith_no).strip(), fz[best]['hadithnumber'] if best is not None else None, round(bs, 3)))
    if best is not None and bs >= 0.85: j = best
json.dump(out, open('/home/claude/bk/match.json', 'w'))
import collections
print('rows', len(out), 'low', low)
print(collections.Counter(round(x[3], 1) for x in out))
print(out[:5], out[-5:])
