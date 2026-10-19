"""Build the Ṣaḥīḥ al-Bukhārī text + chain data for islamicarchives.org.

Texts and numbering: fawazahmed0/hadith-api editions ara-bukhari / eng-bukhari (sunnah.com numbering).
Chains: Kaggle Hadith Narrators dataset (Almoooo/dataset_hadith), matched to those numbers by Arabic text.
"""
import json, re, collections
import pandas as pd

REPO = '/home/claude/islamicarchives/'
ara = json.load(open('/home/claude/bk/dl/fz/ara-bukhari.json'))
eng = json.load(open('/home/claude/bk/dl/fz/eng-bukhari.json'))
match = json.load(open('/home/claude/bk/match.json'))
narr = json.load(open(REPO + 'public/hadith/bukhari-narrators.json'))
P = {int(k): v for k, v in narr['p'].items()}

d = pd.read_parquet('/home/claude/bk/dl/hadith.parquet')
b = d[d.source.str.contains('Bukhari')].reset_index(drop=True)

DIAC = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭـ]')


def plain_ar(s):
    s = DIAC.sub('', s)
    return re.sub('[إأآٱ]', 'ا', s)


def slug(num):
    if float(num).is_integer():
        return str(int(num))
    whole, frac = str(num).split('.')
    return whole + 'abcdefghij'[int(frac) - 1]


# --- assign each dataset row (chain) to a sunnah.com number
row_num = []
prev = None
for (hid, dno, num, score) in match:
    if score < 0.85:
        num = prev  # an extra narration with no close text match: keep it with the hadith before it
    row_num.append(num)
    if num is not None:
        prev = num

chains = collections.defaultdict(list)
arbooks = {}
for i, r in b.iterrows():
    num = row_num[i]
    ch = [int(x) for x in str(r.chain_indx).split(',') if x.strip()]
    if num is None:
        continue
    if ch and ch not in chains[num]:
        chains[num].append(ch)

eng_by = {h['hadithnumber']: h for h in eng['hadiths']}
books = []
secs = eng['metadata']['sections']
arsecs = ara['metadata']['sections']
for i, r in b.iterrows():  # Arabic book titles from the dataset ("English - كتاب ...")
    num = row_num[i]
    if num is None:
        continue
    bk = eng_by[num]['reference']['book']
    if bk not in arbooks and ' - ' in r.chapter:
        arbooks[bk] = r.chapter.split(' - ', 1)[1].strip()

hadiths = []
for h in ara['hadiths']:
    num = h['hadithnumber']
    e = eng_by.get(num, {})
    ar = h['text'].strip()
    en = (e.get('text') or '').strip()
    if not ar and not en:
        continue
    bk = h['reference']['book']
    hadiths.append(dict(n=slug(num), num=num, book=bk, inbook=h['reference']['hadith'], ar=ar, en=en,
                        chains=chains.get(num, [])))

for k, name in secs.items():
    k = int(k)
    if not name:
        continue
    hs = [h for h in hadiths if h['book'] == k]
    if not hs:
        continue
    books.append(dict(k=k, name=name, ar=arbooks.get(k, arsecs.get(str(k), '')), first=hs[0]['n'], last=hs[-1]['n'], count=len(hs)))

import os
os.makedirs(REPO + 'content/hadith', exist_ok=True)
json.dump(dict(books=books, hadiths=hadiths), open(REPO + 'content/hadith/bukhari.json', 'w'), ensure_ascii=False, separators=(',', ':'))

# --- recompute the narrator network on sunnah.com numbers
edge = collections.defaultdict(set)
through = collections.defaultdict(set)
for h in hadiths:
    for ch in h['chains']:
        full = [0] + ch
        if P.get(ch[-1], {}).get('g') == 1:
            full.append(-1)
        for a, c in zip(full, full[1:]):
            if a != c:
                edge[(c, a)].add(h['num'])
        for x in full:
            through[x].add(h['num'])
order = {h['num']: i for i, h in enumerate(hadiths)}
for k in P:
    P[k]['h'] = len(through.get(k, ()))
by_num = {h['num']: h['n'] for h in hadiths}
narr['p'] = {str(k): v for k, v in P.items()}
narr['e'] = [[t, s, len(hs)] for (t, s), hs in edge.items()]
narr['x'] = {f'{t}_{s}': [by_num[n] for n in sorted(hs, key=order.get)] for (t, s), hs in edge.items()}
narr['nh'] = sum(1 for h in hadiths if h['chains'])
narr['nt'] = len(hadiths)
json.dump(narr, open(REPO + 'public/hadith/bukhari-narrators.json', 'w'), ensure_ascii=False, separators=(',', ':'))

# --- short lines for the lists in the narrator card
def snip(h):
    t = re.sub(r'\s+', ' ', h['en'])
    t = re.sub(r'^Narrated [^:]{1,80}:\s*', '', t)
    if not t:
        t = re.sub(r'\s+', ' ', plain_ar(h['ar']))
    return t[:120] + ('…' if len(t) > 120 else '')
json.dump({h['n']: [h['book'], snip(h)] for h in hadiths}, open(REPO + 'public/hadith/bukhari-snips.json', 'w'), ensure_ascii=False, separators=(',', ':'))

print('hadiths', len(hadiths), 'with chains', narr['nh'], 'books', len(books), 'edges', len(narr['e']))
print('no-chain', sum(1 for h in hadiths if not h['chains']), 'multi-chain', sum(1 for h in hadiths if len(h['chains']) > 1))
print('sizes', {f: os.path.getsize(REPO + f) for f in ['content/hadith/bukhari.json', 'public/hadith/bukhari-narrators.json', 'public/hadith/bukhari-snips.json']})
