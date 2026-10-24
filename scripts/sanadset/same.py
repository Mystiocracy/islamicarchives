"""Hints that two written names may be the same person. Nothing is merged: the page only points from one name to
the other, says why, and keeps their counts apart.

Two kinds of hint, both worked out from the chains alone:
  s  "spelling": the names are identical once case endings, hamza/ya/ta marbuta forms, Abu/Abi/Aba, ibn/bin and
     the article are ignored;
  p  "part of a longer name": one name is a run of words inside the other (al-Zuhri inside Muhammad ibn Muslim ibn
     Shihab al-Zuhri) AND the two have teachers and students in common (cosine similarity of their neighbours).
"""
import re, json, os, math, collections

REL = {'ابيه', 'ابوه', 'ابي', 'ابيها', 'ابيهم', 'جده', 'جدي', 'جدها', 'عمه', 'عمي', 'امه', 'امي', 'اخيه', 'اخي', 'ابنه',
       'ابني', 'ابنها', 'خاله', 'خالي', 'ابيك', 'ابوها', 'ابي', 'جدته', 'عمته', 'اخته', 'زوجته', 'ابن اخيه', 'ابن عمه'}
HON = re.compile(r'\b(رضي الله (?:عنه|عنها|عنهم|عنهما)|رحمه الله|صلي الله عليه وسلم|صلى الله عليه وسلم|عليه السلام)\b')


TAGS = re.compile(r'<[^>]*>|[،,:؛;.()\[\]"\'!؟?]|\bيعني\b')


def key1(n):
    n = TAGS.sub(' ', n)
    n = HON.sub('', n)
    n = n.replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي').replace('ء', '')
    out = []
    for w in n.split():
        if w in ('بن', 'ابن', 'بنت'):
            w = 'ابن'
        elif w in ('ابو', 'ابا', 'ابي'):
            w = 'ابو'
        elif len(w) > 3 and w.startswith('ال'):
            w = w[2:]
        elif len(w) > 4 and w.startswith('وال'):
            w = w[3:]
        out.append(w)
    return ' '.join(out)


def build(recs, nid, order, cnt, out, thr=0.30, verbose=False):
    idn = {i + 1: n for i, n in enumerate(order)}
    tn = collections.defaultdict(collections.Counter)
    for _, _, ns, _ in recs:
        ids = [nid[n] for n in ns]
        for j, a in enumerate(ids):
            if cnt[idn[a]] < 3:
                continue
            c = tn[a]
            if j + 1 < len(ids):
                c[(0, ids[j + 1])] += 1
            if j:
                c[(1, ids[j - 1])] += 1
    for a, c in tn.items():
        for k in c:
            c[k] = math.sqrt(c[k])
    norm = {a: math.sqrt(sum(v * v for v in c.values())) or 1 for a, c in tn.items()}

    def cos(a, b):
        ca, cb = tn.get(a), tn.get(b)
        if not ca or not cb:
            return 0.0
        if len(ca) > len(cb):
            ca, cb = cb, ca
        d = sum(v * cb.get(k, 0) for k, v in ca.items())
        return d / (norm[a] * norm[b])

    hints = collections.defaultdict(dict)   # id -> {other: (score, kind)}
    # spelling groups
    groups = collections.defaultdict(list)
    for i, n in enumerate(order, 1):
        if cnt[n] >= 2 and n not in REL:
            groups[key1(n)].append(i)
    for k, ids in groups.items():
        if len(ids) > 1:
            for a in ids:
                for b in ids:
                    if a != b:
                        hints[a][b] = (1.0, 's')
    # part-of-name
    kmap = collections.defaultdict(list)
    for i, n in enumerate(order, 1):
        if cnt[n] >= 3 and n not in REL:
            kmap[key1(n)].append(i)
    npairs = 0
    for i, n in enumerate(order, 1):
        if cnt[n] < 3 or n in REL:
            continue
        tk = key1(n).split()
        if len(tk) < 2:
            continue
        seen = set()
        for a in range(len(tk)):
            if a and tk[a - 1] == 'ابن' and tk[a] != 'ابن':
                continue
            for b in range(a + 1, min(len(tk), a + 4) + 1):
                if b - a == len(tk):
                    continue
                s = ' '.join(tk[a:b])
                if s in seen or s == 'ابن' or len(s) < 3:
                    continue
                seen.add(s)
                for j in kmap.get(s, ()):
                    if j == i:
                        continue
                    sc = cos(i, j)
                    if sc >= thr:
                        hints[i][j] = (max(hints[i].get(j, (0,))[0], sc), 'p')
                        hints[j][i] = (max(hints[j].get(i, (0,))[0], sc), 'p')
                        npairs += 1
    amb = []
    for a, d in hints.items():
        ps = [b for b, (sc, k) in d.items() if k == 'p' and len(key1(idn[b]).split()) > len(key1(idn[a]).split())]
        ps = sorted(ps, key=lambda b: -d[b][0])[:4]
        if len(ps) >= 2 and any(cos(ps[0], b) < thr for b in ps[1:]):
            amb.append(a)
    res = {}
    for a, d in hints.items():
        top = sorted(d.items(), key=lambda kv: (-kv[1][0], -cnt[idn[kv[0]]]))[:8]
        res[a] = [[b, round(sc, 2), k] for b, (sc, k) in top]
    rel = sorted(nid[n] for n in REL if n in nid)
    json.dump({'r': rel, 'a': sorted(amb), 'g': {str(a): v for a, v in res.items()}}, open(os.path.join(out, 'same.json'), 'w'), separators=(',', ':'))
    if verbose:
        print('hints for', len(res), 'names;', npairs, 'part-of-name pairs')
    return res
