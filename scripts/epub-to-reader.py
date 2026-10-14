#!/usr/bin/env python3
"""Turn a finished EPUB into chapter pages for the site's online reader.

usage: python3 scripts/epub-to-reader.py BOOK.epub WORK_ID [--scan URL --offsets SPEC]

Writes content/chapters/WORK_ID/NN-<slug>.md (one per readable spine document; the body is cleaned
HTML, shown as-is, not run through Markdown)
and copies the EPUB to public/downloads/WORK_ID.epub, which is also the source of the other downloads.

Printed page markers (<span epub:type="pagebreak" id="page-N">) become small page numbers in the
margin. With --scan, each one links to that page of the scanned edition: --offsets maps printed
page numbers to scan pages, e.g. "roman:-6,1-62:+22,65-:+20" (scan page = printed page + offset).
"""
import argparse, os, re, shutil, sys, zipfile, html
import warnings
from bs4 import BeautifulSoup, NavigableString, XMLParsedAsHTMLWarning
warnings.filterwarnings('ignore', category=XMLParsedAsHTMLWarning)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'cover', 'titlepage', 'copyright', 'nav', 'toc'}
TITLES = {'dedication': 'Dedication', 'epigraphs': 'Epigraphs'}


def roman(s):
    v = {'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100}
    t = 0
    for a, b in zip(s, s[1:] + ' '):
        t += -v[a] if v.get(b, 0) > v[a] else v[a]
    return t


def make_scan_page(spec):
    rules = []
    for part in (spec or '').split(','):
        if not part.strip():
            continue
        rng, off = part.split(':')
        if rng == 'roman':
            rules.append(('roman', None, None, int(off)))
        else:
            a, _, b = rng.partition('-')
            rules.append(('arabic', int(a), int(b) if b else 10 ** 6, int(off)))

    def f(folio):
        if folio.isdigit():
            n = int(folio)
            for kind, a, b, off in rules:
                if kind == 'arabic' and a <= n <= b:
                    return n + off
        elif re.fullmatch(r'[ivxlc]+', folio):
            for kind, a, b, off in rules:
                if kind == 'roman':
                    return roman(folio) + off
        return None
    return f


def slugify(s, limit=48):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    if len(s) > limit:
        s = s[:limit].rsplit('-', 1)[0]
    return s


def clean(doc_id, soup, scan, scan_page):
    body = soup.body
    # the page shows the chapter title itself; drop the decorative header
    title_el = body.find(['h1'])
    title = title_el.get_text(' ', strip=True) if title_el else TITLES.get(doc_id, doc_id.title())
    for hd in body.find_all('header', class_='chapter-head'):
        hd.decompose()
    for img in body.find_all('img'):
        p = img.find_parent('p', class_='ornament')
        (p or img).decompose()
    pages = []
    for sp in body.find_all('span', attrs={'epub:type': 'pagebreak'}):
        folio = sp.get('aria-label') or sp['id'].replace('page-', '')
        pages.append(folio)
        a = soup.new_tag('a')
        a['class'] = 'pg'
        a['id'] = sp['id']
        n = scan_page(folio) if scan else None
        if n:
            a['href'] = f'{scan}#page={n}'
            a['target'] = '_blank'
            a['rel'] = 'noopener'
            a['title'] = f'Printed page {folio}: view this page of the scan at the Chughtai Library'
        else:
            a['title'] = f'Printed page {folio}'
        a.string = folio
        sp.replace_with(a)
    # attributes that only make sense inside an EPUB
    for el in body.find_all(True):
        for k in list(el.attrs):
            if k.startswith('epub:') or k == 'aria-labelledby':
                del el[k]
        if el.name == 'section' and el.get('class') == ['notes']:
            el['aria-label'] = 'Notes'
    # sub-headings for the contents list
    heads = []
    for h in body.find_all('h2', class_='subhead'):
        hid = h.get('id') or f'{doc_id}-s{len(heads) + 1}'
        h['id'] = hid
        txt = re.sub(r'\s+', ' ', ''.join(t for t in h.strings if t.parent.name != 'a' or 'pg' not in (t.parent.get('class') or []))).strip()
        heads.append((hid, txt))
    inner = ''.join(str(c) for c in (body.find('section') or body).contents)
    if body.find('section') and len(body.find_all('section', recursive=False)) > 1:
        inner = ''.join(str(c) for c in body.contents)
    # one block per line, no blank lines inside blocks, so Markdown passes the HTML through untouched
    inner = re.sub(r'\n\s*\n+', '\n', inner).strip()
    inner = inner.replace('<br/>', '<br>')
    return title, heads, pages, inner


def yaml_str(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('epub')
    ap.add_argument('work')
    ap.add_argument('--scan')
    ap.add_argument('--offsets', default='')
    a = ap.parse_args()
    scan_page = make_scan_page(a.offsets)
    z = zipfile.ZipFile(a.epub)
    opf_path = re.search(r'full-path="([^"]+)"', z.read('META-INF/container.xml').decode()).group(1)
    base = os.path.dirname(opf_path)
    opf = BeautifulSoup(z.read(opf_path), 'xml')
    items = {i['id']: i for i in opf.find_all('item')}
    out = os.path.join(ROOT, 'content', 'chapters', a.work)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    n = 0
    held = ''
    for ref in opf.find('spine').find_all('itemref'):
        it = items[ref['idref']]
        if 'nav' in (it.get('properties') or '') or ref['idref'] in SKIP:
            continue
        href = os.path.join(base, it['href'])
        soup = BeautifulSoup(z.read(href), 'lxml')
        title, heads, pages, inner = clean(ref['idref'], soup, a.scan, scan_page)
        if ref['idref'] == 'dedication':
            held = inner          # a one-line dedication goes at the head of the next page
            continue
        if held:
            inner = held + '\n<hr class="sep">\n' + inner
            title = 'Dedication and ' + title if ref['idref'] == 'epigraphs' else title
            held = ''
        n += 1
        slug = slugify(title)
        fm = ['---', f'work: {a.work}', f'order: {n}', f'title: {yaml_str(title)}', f'slug: {slug}']
        if pages:
            fm.append(f'pages: {yaml_str(pages[0] + ("–" + pages[-1] if len(pages) > 1 else ""))}')
        if heads:
            fm.append('sections:')
            for hid, txt in heads:
                fm.append(f'  - id: {hid}')
                fm.append(f'    title: {yaml_str(txt)}')
        fm.append('---')
        with open(os.path.join(out, f'{n:02d}-{slug}.md'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(fm) + '\n' + inner + '\n')
        print(f'{n:02d} {slug:50s} pp.{pages[0] if pages else "-"}–{pages[-1] if pages else "-"} {len(inner):>7} chars, {len(heads)} sections')
    dl = os.path.join(ROOT, 'public', 'downloads')
    os.makedirs(dl, exist_ok=True)
    shutil.copy(a.epub, os.path.join(dl, f'{a.work}.epub'))


if __name__ == '__main__':
    main()
