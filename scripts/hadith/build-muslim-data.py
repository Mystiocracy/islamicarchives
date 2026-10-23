"""Ṣaḥīḥ Muslim -> content/hadith/muslim.json
Reads the hadith-api editions ara-muslim and eng-muslim (github.com/fawazahmed0/hadith-api; English by Abdul Hamid Siddiqui).
Numbering is sunnah.com's: 'arabicnumber' 8.01 -> 8a, 8.02 -> 8b ... The Introduction (muqaddima, book 0) carries no such
number in the data and is left out. Paths below point to the folder where the downloads were kept."""
import json, re, os
DL = '/home/claude/bk/dl/fz/'
REPO = '/home/claude/islamicarchives/'
ara = json.load(open(DL + 'ara-muslim.json'))
eng = json.load(open(DL + 'eng-muslim.json'))
eng_by = {h['hadithnumber']: h for h in eng['hadiths']}

def clean_ar(s):
    s = s.replace('‏', '').replace('‎', '')
    return re.sub(r'[ \t]+', ' ', s).strip()

def slug(an):
    s = str(an)
    if '.' not in s:
        return s
    a, b = s.split('.')
    return a + chr(96 + int(b))

hadiths, seen = [], set()
for h in ara['hadiths']:
    e = eng_by.get(h['hadithnumber'], {})
    an = e.get('arabicnumber') or h.get('arabicnumber')
    if an is None or h['reference']['book'] == 0:
        continue
    ar, en = clean_ar(h['text']), (e.get('text') or '').strip()
    if not ar and not en:
        continue
    n = slug(an)
    assert n not in seen, n
    seen.add(n)
    base = int(str(an).split('.')[0])
    hadiths.append(dict(n=n, hn=h['hadithnumber'], num=base, book=h['reference']['book'], inbook=h['reference']['hadith'], ar=ar, en=en))

books = []
for k, name in eng['metadata']['sections'].items():
    k = int(k)
    name = re.sub(r'\s+', ' ', name).strip()
    hs = [h for h in hadiths if h['book'] == k]
    if k == 0 or not hs:
        continue
    books.append(dict(k=k, name=name, ar='', first=hs[0]['n'], last=hs[-1]['n'], count=len(hs)))

os.makedirs(REPO + 'content/hadith', exist_ok=True)
json.dump(dict(books=books, hadiths=hadiths), open(REPO + 'content/hadith/muslim.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('hadiths', len(hadiths), 'books', len(books), 'unique slugs', len(seen))
