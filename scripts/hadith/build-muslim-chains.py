"""Add chains of narrators to Ṣaḥīḥ Muslim and build the narrator network.

Chains: Kaggle Hadith Narrators dataset (Almoooo/dataset_hadith), rows matched to sunnah.com numbers by Arabic text
(match-muslim.py). Narrator details: muslimscholars.info pages (see parse-narrators.py).
Writes public/hadith/muslim-narrators.json, public/hadith/muslim-snips.json and adds 'chains' to content/hadith/muslim.json.
"""
import json, re, os, collections, importlib.util
import pandas as pd

REPO = '/home/claude/islamicarchives/'
spec = importlib.util.spec_from_file_location('pn', REPO + 'scripts/hadith/parse-narrators.py')
pn = importlib.util.module_from_spec(spec); spec.loader.exec_module(pn)

data = json.load(open(REPO + 'content/hadith/muslim.json'))
hadiths, books = data['hadiths'], data['books']
by_hn = {h['hn']: h for h in hadiths}
match = json.load(open('/home/claude/bk/match_muslim.json'))
d = pd.read_parquet('/home/claude/bk/dl/hadith.parquet')
b = d[d.source.str.contains('Muslim')].reset_index(drop=True)


def split_chains(ids):
    """The dataset joins every isnad of a ḥadīth into one list. When a name comes back, a new chain starts there:
    it keeps what came before that name and carries on from it (Abū Bakr > Wakīʿ > Shuʿba ... , Wakīʿ > Sufyān ...)."""
    out, cur = [], []
    for x in ids:
        if x in cur:
            if cur not in out:
                out.append(cur)
            cur = cur[:cur.index(x) + 1]
        else:
            cur = cur + [x]
    if cur and cur not in out:
        out.append(cur)
    return [c for c in out if c]


row_hn, prev = [], None
for (i, hn, score) in match:
    if score < 0.85:
        hn = prev  # an extra narration with no close text match: keep it with the ḥadīth before it
    row_hn.append(hn)
    if hn is not None:
        prev = hn

chains = collections.defaultdict(list)
for i, r in b.iterrows():
    hn = row_hn[i]
    if hn not in by_hn:   # the Introduction, or a blank record
        continue
    ids = [int(x) for x in str(r.chain_indx).split(',') if x.strip()]
    for ch in split_chains(ids):
        if ch not in chains[hn]:
            chains[hn].append(ch)
for h in hadiths:
    h['chains'] = chains.get(h['hn'], [])[:6]

ids = sorted({x for h in hadiths for ch in h['chains'] for x in ch})
P, missing = {}, []
for x in ids:
    p = pn.parse(x)
    if p is None:
        missing.append(x)
        p = dict(n=f'Narrator #{x}', k=None, f=None, g=None, b=None, d=None, dp=None, pl=None, gr=None)
    P[x] = p
P[0] = dict(n='Muslim', k='Abu al-Husayn', f='Muslim b. al-Hajjaj b. Muslim al-Qushayri al-Naysaburi', g=None, b=204, d=261,
            dp='Nishapur', pl='Nishapur / Khurasan / Hijaz / Iraq / Syria / Egypt', gr='Compiler')
P[-1] = dict(n='The Prophet Muhammad ﷺ', k='Abu al-Qasim', f=None, g=0, b=-53, d=11, dp='Madinah', pl='Makkah / Madinah', gr=None)

edge, through = collections.defaultdict(set), collections.defaultdict(set)
for h in hadiths:
    for ch in h['chains']:
        full = [0] + ch
        if P[ch[-1]].get('g') == 1:
            full.append(-1)
        for a, c in zip(full, full[1:]):
            if a != c:
                edge[(c, a)].add(h['hn'])
        for x in full:
            through[x].add(h['hn'])
order = {h['hn']: i for i, h in enumerate(hadiths)}
slug = {h['hn']: h['n'] for h in hadiths}
out_p = {}
for x, p in P.items():
    q = {k: v for k, v in p.items() if v is not None}
    q['h'] = len(through.get(x, ()))
    out_p[str(x)] = q
nh = sum(1 for h in hadiths if h['chains'])
ABOUT = ("<strong>About the data.</strong> Chains come from the Hadith Narrators dataset on Kaggle (narrator IDs per ḥadīth, mirrored on "
         "Hugging Face as Almoooo/dataset_hadith), matched to sunnah.com numbering by their Arabic text. Names, dates, generations "
         "(ṭabaqāt, following Ibn Ḥajar's <em>Taqrīb</em>) and grades come from muslimscholars.info. A link between two narrators means "
         "one received a ḥadīth from the other in at least one of Muslim's chains; the number is how many ḥadīth pass through that link. "
         "Muslim often gives a ḥadīth with several chains (joined by <em>taḥwīl</em>); the dataset lists their names in one run, and they were "
         "separated here by starting a new chain wherever a name comes back, so some secondary chains are incomplete and some may be wrong. "
         "Names were matched automatically and may be wrong. Chains that stop at a Companion are joined to the Prophet ﷺ; those that stop at a later narrator are not.")
json.dump(dict(p=out_p, e=[[t, s, len(hs)] for (t, s), hs in edge.items()],
               x={f'{t}_{s}': [slug[n] for n in sorted(hs, key=order.get)] for (t, s), hs in edge.items()},
               nh=nh, nt=len(hadiths), about=ABOUT),
          open(REPO + 'public/hadith/muslim-narrators.json', 'w'), ensure_ascii=False, separators=(',', ':'))


def snip(h):
    t = re.sub(r'\s+', ' ', h['en']).strip()
    if not t:
        t = re.sub(r'\s+', ' ', re.sub('[ؐ-ًؚ-ٰٟۖ-ۭـ]', '', h['ar']))
    return t[:120] + ('…' if len(t) > 120 else '')
json.dump({h['n']: [h['book'], snip(h)] + ([h['chains']] if h['chains'] else []) for h in hadiths},
          open(REPO + 'public/hadith/muslim-snips.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for h in hadiths:
    del h['hn']
json.dump(dict(books=books, hadiths=hadiths), open(REPO + 'content/hadith/muslim.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('hadiths', len(hadiths), 'with chains', nh, 'people', len(out_p) - 2, 'edges', len(edge), 'missing pages', len(missing), missing[:10])
print('multi-chain', sum(1 for h in hadiths if len(h['chains']) > 1), 'no chain', len(hadiths) - nh)
print({f: os.path.getsize(REPO + f) for f in ['content/hadith/muslim.json', 'public/hadith/muslim-narrators.json', 'public/hadith/muslim-snips.json']})
