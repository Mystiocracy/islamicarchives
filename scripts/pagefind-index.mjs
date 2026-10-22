// Builds the Pagefind index: every built page, plus one record per ḥadīth of Ṣaḥīḥ al-Bukhārī.
// The ḥadīth are not separate pages any more (a book is read on one page), so they are added as custom records
// whose URL points at the ḥadīth's anchor inside its book page.
import fs from 'node:fs';
import * as pagefind from 'pagefind';
import { searchArabic } from '../src/lib/arabic-search.mjs';

const PER = 100;
const { index } = await pagefind.createIndex({});
const added = await index.addDirectory({ path: 'dist' });
if (added.errors?.length) { console.error(added.errors); process.exit(1); }

const t = JSON.parse(fs.readFileSync('content/hadith/bukhari.json', 'utf8'));
const bookName = Object.fromEntries(t.books.map((b) => [b.k, b.name]));
for (const h of t.hadiths) {
  if (!bookName[h.book]) { const b = t.books.find((b) => h.num >= Number(b.first) && h.num <= Number(b.last)); if (b) h.book = b.k; }
}
let prevBook = 0;
for (const h of t.hadiths) { if (!bookName[h.book]) h.book = prevBook; else prevBook = h.book; }
const seen = {};
let n = 0;
for (const h of t.hadiths) {
  const i = (seen[h.book] = (seen[h.book] ?? -1) + 1);
  const part = Math.floor(i / PER) + 1;
  const url = `/hadith/bukhari/book/${h.book}/${part > 1 ? `p${part}/` : ''}#h${h.n}`;
  const r = await index.addCustomRecord({
    url,
    content: `${h.en || ''} ${h.ar ? searchArabic(h.ar) : ''}`.replace(/\s+/g, ' ').trim(),
    language: 'en',
    meta: { title: `Ṣaḥīḥ al-Bukhārī ${h.n}` },
    filters: { collection: ['Ṣaḥīḥ al-Bukhārī'], book: [bookName[h.book]] },
  });
  if (r.errors?.length) { console.error(h.n, r.errors); process.exit(1); }
  n++;
}
const w = await index.writeFiles({ outputPath: 'dist/pagefind' });
if (w.errors?.length) { console.error(w.errors); process.exit(1); }
console.log(`Pagefind: ${added.page_count} pages + ${n} ḥadīth records indexed`);
await pagefind.close();
