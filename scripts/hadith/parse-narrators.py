"""Parse muslimscholars.info pages + Bukhari chains into a compact JSON for the page."""
import re, json, os, collections, sys
import pandas as pd
from bs4 import BeautifulSoup

MS = '/home/claude/bk/dl/ms/'
OUT = '/home/claude/bk/data.json'

GEN_RX = re.compile(r'\[\s*\|\s*(\d+)(?:st|nd|rd|th) [Gg]enera')


def field(t, label, stop_labels):
    i = t.find(label)
    if i < 0:
        return None
    j = i + len(label)
    end = len(t)
    for s in stop_labels:
        k = t.find(s, j)
        if 0 <= k < end:
            end = k
    v = t[j:end].strip(' |')
    return re.sub(r'\s*\|\s*', ' ', v).strip() or None


STOPS = ['Full Name:', 'Parents:', 'Siblings:', 'Birth Date/Place:', 'Death Date/Place:', 'Places of Stay:',
         'Area of Interest:', 'Spouse(s):', 'Children :', 'Teachers/', 'Students/', 'Tags :', 'Narrations:', 'Books:']


def year_ah(s):
    if not s:
        return None, None
    m = re.search(r'(\d{1,4})\s*AH', s)
    bh = re.search(r'(\d{1,3})\s*BH', s)
    place = re.search(r'\(([^)]*)\)', s)
    pl = place.group(1).strip() if place else None
    if m:
        return int(m.group(1)), pl
    if bh:
        return -int(bh.group(1)), pl
    return None, pl


def parse(pid):
    p = MS + f'{pid}.html'
    if not os.path.exists(p) or os.path.getsize(p) < 5000:
        return None
    s = BeautifulSoup(open(p, encoding='utf-8', errors='ignore'), 'lxml')
    t = s.get_text(' | ', strip=True)
    i = t.find('Scholar: |')
    if i < 0:
        return None
    head = t[i + 10:i + 400]
    m = re.match(r'\s*(\d+)\s*-\s*(.*?)\s*\|', head)
    if not m:
        return None
    name = m.group(2).strip()
    kunya = None
    mk = re.match(r'(.*?)\s*\[(.*)\]\s*$', name)
    if mk:
        name, kunya = mk.group(1).strip(), mk.group(2).strip()
    g = GEN_RX.search(t[i:i + 500])
    gen = int(g.group(1)) if g else None
    rank = None
    for k in ('Comp.(RA)', 'Follower(Tabi', "Succ. (Taba'", '3rd Century', '4th Century'):
        if k in head:
            rank = k
            break
    rest = t[i:]
    full = field(rest, 'Full Name:', STOPS)
    birth, bpl = year_ah(field(rest, 'Birth Date/Place:', STOPS))
    death, dpl = year_ah(field(rest, 'Death Date/Place:', STOPS))
    places = field(rest, 'Places of Stay:', STOPS)
    interest = field(rest, 'Area of Interest:', STOPS) or ''
    grade = None
    mg = re.search(r'\[Grade:\s*([^\]]+)\]', interest)
    if mg:
        grade = mg.group(1).strip()
    elif 'صحابة' in interest or rank == 'Comp.(RA)':
        grade = 'Companion'
    return dict(n=name, k=kunya, f=full, g=gen, b=birth, d=death, dp=dpl, pl=places, gr=grade)


ABOUT = ("<strong>About the data.</strong> Chains come from the Hadith Narrators dataset on Kaggle (narrator IDs per ḥadīth, "
         "mirrored on Hugging Face as Almoooo/dataset_hadith), which covers 7,370 entries of al-Bukhārī. Names, dates, generations "
         "(ṭabaqāt, following Ibn Ḥajar's <em>Taqrīb</em>) and grades come from muslimscholars.info. A link between two narrators means "
         "one received a ḥadīth from the other in at least one of al-Bukhārī's chains; the number is how many ḥadīth pass through that link. "
         "Al-Bukhārī often repeats a ḥadīth under several chapters, so counts include repeats. The dataset records one chain per ḥadīth, so "
         "secondary chains (and <em>taʿlīq</em> suspended reports) are partly missing, and some names were matched automatically and may be wrong. "
         "Chains that stop at a Companion are joined to the Prophet ﷺ; those that stop at a later narrator are not.")


def main():
    d = pd.read_parquet('/home/claude/bk/dl/hadith.parquet')
    b = d[d.source.str.contains('Bukhari')]
    chains = []
    for _, r in b.iterrows():
        ch = [x.strip() for x in str(r.chain_indx).split(',') if x.strip()]
        if ch:
            chains.append((int(str(r.hadith_no).strip()), [int(x) for x in ch], r.chapter.split(' - ')[0].strip()))
    ids = sorted({x for _, ch, _ in chains for x in ch})
    people = {}
    missing = []
    for x in ids:
        p = parse(x)
        if p is None:
            missing.append(x)
            p = dict(n=f'Narrator #{x}', k=None, f=None, g=None, b=None, d=None, dp=None, pl=None, gr=None)
        people[x] = p
    # edges: student -> teacher (chain[i] heard from chain[i+1]); BUKHARI=0, PROPHET=-1
    edge = collections.defaultdict(set)   # (teacher, student) -> hadith numbers
    narr = collections.defaultdict(set)    # person -> hadith numbers
    for hn, ch, chap in chains:
        full = [0] + ch
        if people[ch[-1]].get('g') == 1:
            full = full + [-1]
        for a, c in zip(full, full[1:]):
            if a == c:
                continue
            edge[(c, a)].add(hn)
        for x in ch:
            narr[x].add(hn)
    people[0] = dict(n='al-Bukhari', k='Abu ʿAbdullah', f='Muhammad b. Ismaʿil b. Ibrahim b. al-Mughira al-Juʿfi al-Bukhari',
                     g=None, b=194, d=256, dp='Khartank, near Samarqand', pl='Bukhara / Nishapur / Baghdad / Hijaz', gr='Compiler')
    people[-1] = dict(n='The Prophet Muhammad ﷺ', k='Abu al-Qasim', f=None, g=0, b=-53, d=11, dp='Madinah', pl='Makkah / Madinah', gr=None)
    narr[0] = {hn for hn, _, _ in chains}
    narr[-1] = {hn for (t, s), hs in edge.items() if t == -1 for hn in hs}
    out_people = {}
    for x, p in people.items():
        q = {k: v for k, v in p.items() if v is not None}
        q['h'] = len(narr.get(x, ()))
        out_people[x] = q
    edges = [[t, s, len(hs)] for (t, s), hs in edge.items()]
    # chapters with example hadith number per edge are too heavy; keep up to 3 hadith numbers per edge
    ex = {f'{t}_{s}': sorted(hs)[:3] for (t, s), hs in edge.items()}
    json.dump(dict(p=out_people, e=edges, x=ex, nh=len(narr[0]), about=ABOUT), open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('people', len(out_people), 'edges', len(edges), 'missing', len(missing), missing[:20])
    gens = collections.Counter(p.get('g') for p in out_people.values())
    print(sorted(gens.items(), key=lambda z: (z[0] is None, z[0] or 0)))
    print('no death', sum(1 for p in out_people.values() if 'd' not in p))
    print('chains', len(chains), 'size', os.path.getsize(OUT))


if __name__ == '__main__':
    main()
