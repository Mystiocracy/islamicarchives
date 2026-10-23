"""Match each Ṣaḥīḥ Muslim row of the Hadith Narrators dataset to the hadith-api (sunnah.com) record with the same Arabic text."""
import json, re, collections
from rapidfuzz import fuzz
import pandas as pd
D = re.compile('[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]')
def norm(s):
    s = D.sub('', s or '')
    s = re.sub('[\u0625\u0623\u0622\u0671]', '\u0627', s).replace('\u0649', '\u064a').replace('\u0629', '\u0647')
    return re.sub('[^\u0621-\u064a]', '', s)
fz = json.load(open('/home/claude/bk/dl/fz/ara-muslim.json'))['hadiths']
fzn = [norm(h['text']) for h in fz]
d = pd.read_parquet('/home/claude/bk/dl/hadith.parquet'); b = d[d.source.str.contains('Muslim')].reset_index(drop=True)
out = []; j = 0; low = 0
for i, r in b.iterrows():
    a = norm(r.text_ar)[:300]
    best, bs = None, 0
    lo, hi = max(0, j - 30), min(len(fz), j + 150)
    for k in range(lo, hi):
        if not fzn[k]: continue
        s = fuzz.ratio(a, fzn[k][:300]) / 100
        if s > bs: bs, best = s, k
        if s > 0.97: break
    if bs < 0.85: low += 1
    out.append((i, fz[best]['hadithnumber'] if best is not None else None, round(bs, 3)))
    if best is not None and bs >= 0.85: j = best
json.dump(out, open('/home/claude/bk/match_muslim.json', 'w'))
print('rows', len(out), 'low', low)
print(sorted(collections.Counter(round(x[2], 1) for x in out).items()))
print('distinct API numbers hit', len({x[1] for x in out if x[2] >= .85}))
