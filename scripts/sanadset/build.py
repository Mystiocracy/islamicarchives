#!/usr/bin/env python3
"""Builds the Isnad Atlas data from Sanadset 650K (Mghari, Bouras & El Hibaoui, 2022; Mendeley Data, CC BY 4.0).

    python3 scripts/sanadset/build.py [path/to/sanadset.csv]

Without a path the official file is downloaded from Mendeley Data to .cache/ and checked against its published
SHA-256. Nothing else is used: every number on the atlas page comes from this one file.

Writes to public/hadith/narrators/:
  names-ar.json   narrator names, one per node, most frequent first (index = node id; id 0 is reserved for the Prophet ﷺ)
  names-en.json   machine-transliterated English spelling of each name (same order)
  books.json      books: [Arabic, English, chains, six-books flag]
  chains.bin      every chain: book, hadith number, narrators (ids), varint-packed
  same.json       "may be the same person" hints between written names (never merged)
  m/<n>.json      the full text (matn) of each ḥadīth, 256 per file, in chain order
"""
import ast, csv, hashlib, json, os, re, sys, collections, math, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'hadith', 'narrators')
URL = 'https://data.mendeley.com/public-files/datasets/5xth87zwb5/files/fe0857fa-73af-4873-b652-60eb7347b811/file_downloaded'
SHA = 'bbe4fd3d9ef797a78c9ddfdc7d31a9d2185c2f7efa0ecee75c9fc46b6dcfb5b3'
SHARD = 256     # ḥadīth per text file (each ḥadīth's full text is kept, exactly as in Sanadset)
sys.path.insert(0, HERE)
import translit as T

csv.field_size_limit(10 ** 9)


def get_csv():
    if len(sys.argv) > 1:
        return sys.argv[1]
    p = os.path.join(ROOT, '.cache', 'sanadset.csv')
    if os.path.exists(p):
        return p
    os.makedirs(os.path.dirname(p), exist_ok=True)
    print('downloading sanadset.csv (1.4 GB) from Mendeley Data …')
    urllib.request.urlretrieve(URL, p)
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if h != SHA:
        raise SystemExit('checksum mismatch: ' + h)
    return p


def varint(n, out):
    while n >= 128:
        out.append((n & 127) | 128)
        n >>= 7
    out.append(n)


def main():
    path = get_csv()
    print('reading', path)
    rd = csv.reader(open(path, encoding='utf-8', newline=''))
    hdr = next(rd)
    assert hdr == ['Hadith', 'Book', 'Num_hadith', 'Matn', 'Sanad', 'Sanad_Length'], hdr

    # ---- pass 1: parse
    recs = []                      # (book, num, [norm names], '')
    md = os.path.join(OUT, 'm')
    os.makedirs(md, exist_ok=True)
    for f in os.listdir(md):
        os.remove(os.path.join(md, f))
    shard = []
    def flush():
        if shard:
            k = (len(recs) - 1) // SHARD
            json.dump(shard[:], open(os.path.join(md, f'{k}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
            shard.clear()
    cnt = collections.Counter()    # chains containing each name
    vform = collections.defaultdict(collections.Counter)   # normalised word -> vowelled spellings
    bookcnt = collections.Counter()
    nrows = nosanad = 0
    for h, b, num, m, s, l in rd:
        nrows += 1
        if s == 'No SANAD':
            nosanad += 1
            continue
        names = ast.literal_eval(s)
        ns = []
        for raw in names:
            n = T.norm(raw)
            if not n:
                continue
            ns.append(n)
            for w in raw.split():
                if T.MARK.search(w):
                    vform[T.norm(w)][w] += 1
        if not ns:
            nosanad += 1
            continue
        for n in set(ns):
            cnt[n] += 1
        bookcnt[b] += 1
        recs.append((b, int(num), ns, ''))
        shard.append(' '.join(m.split()))
        if len(shard) == SHARD:
            flush()
    flush()
    print(f'{nrows:,} reports, {nosanad:,} without a chain, {len(recs):,} chains, {len(cnt):,} distinct names')

    # ---- nodes: most frequent first; id 0 = the Prophet ﷺ (virtual)
    order = sorted(cnt, key=lambda n: (-cnt[n], n))
    nid = {n: i + 1 for i, n in enumerate(order)}
    books = [b for b, _ in bookcnt.most_common()]
    bid = {b: i for i, b in enumerate(books)}

    os.makedirs(OUT, exist_ok=True)
    # ---- chains.bin
    buf = bytearray(b'SNC1')
    for v in (len(recs), len(order) + 1, len(books)):
        buf += v.to_bytes(4, 'little')
    for b, num, ns, _ in recs:
        varint(bid[b], buf); varint(num, buf); varint(len(ns), buf)
        for n in ns:
            varint(nid[n], buf)
    open(os.path.join(OUT, 'chains.bin'), 'wb').write(buf)
    print('chains.bin', len(buf))

    # ---- English spellings
    best = {w: c.most_common(1)[0][0] for w, c in vform.items()}
    ov = json.load(open(os.path.join(HERE, 'token-overrides.json'), encoding='utf-8')) if os.path.exists(os.path.join(HERE, 'token-overrides.json')) else {}
    tok_en = {}
    def tok(w):
        if w not in tok_en:
            tok_en[w] = ov.get(w) or T.spell(w, best.get(w, ''))
        return tok_en[w]
    ar = ['النبي ﷺ'] + order
    en = ['The Prophet ﷺ'] + [T.cap(' '.join(tok(w) for w in n.split())) for n in order]
    json.dump(ar, open(os.path.join(OUT, 'names-ar.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(en, open(os.path.join(OUT, 'names-en.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

    # ---- books
    ben = json.load(open(os.path.join(HERE, 'books-en.json'), encoding='utf-8'))
    ben_ov = json.load(open(os.path.join(HERE, 'books-en-extra.json'), encoding='utf-8')) if os.path.exists(os.path.join(HERE, 'books-en-extra.json')) else {}
    SIX = {'صحيح البخاري', 'صحيح مسلم', 'سنن أبي داود', 'جامع الترمذي', 'سنن النسائى الصغرى', 'سنن ابن ماجه'}
    def book_en(b):
        if b in ben_ov: return ben_ov[b]
        if b in ben: return ben[b]
        return T.cap(' '.join(tok(w) for w in T.norm(b).split()))
    json.dump([[b, book_en(b), bookcnt[b], 1 if b in SIX else 0] for b in books],
              open(os.path.join(OUT, 'books.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

    # ---- meta.json: totals and the most-cited names, for the page text
    top = [[nid[n], n, en[nid[n]], cnt[n]] for n in order[:40]]
    json.dump({'reports': nrows, 'nosanad': nosanad, 'chains': len(recs), 'names': len(order), 'books': len(books),
               'six': sum(bookcnt[b] for b in books if b in SIX), 'shard': SHARD, 'top': top},
              open(os.path.join(OUT, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

    # ---- hints: possibly the same person (never merged)
    import same
    same.build(recs, nid, order, cnt, OUT)


if __name__ == '__main__':
    main()
