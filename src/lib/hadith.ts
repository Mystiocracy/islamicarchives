// Ṣaḥīḥ al-Bukhārī: texts (sunnah.com numbering) and their chains, read once per build.
import fs from 'node:fs';

export type Hadith = { n: string; num: number; book: number; inbook: number; ar: string; en: string; chains: number[][] };
export type Book = { k: number; name: string; ar: string; first: string; last: string; count: number };
export type Person = { n: string; k?: string; g?: number; b?: number; d?: number; gr?: string; h: number };

let cache: { books: Book[]; hadiths: Hadith[]; people: Record<string, Person> } | null = null;

export function bukhari() {
  if (!cache) {
    const t = JSON.parse(fs.readFileSync('content/hadith/bukhari.json', 'utf8'));
    const n = JSON.parse(fs.readFileSync('public/hadith/bukhari-narrators.json', 'utf8'));
    cache = { books: t.books, hadiths: t.hadiths, people: n.p };
  }
  return cache;
}

let mcache: { books: Book[]; hadiths: Hadith[]; people: Record<string, Person> } | null = null;

/** Ṣaḥīḥ Muslim: texts and chains, numbered as on sunnah.com ("8a", "8b", ... share the number 8). */
export function muslim() {
  if (!mcache) {
    const t = JSON.parse(fs.readFileSync('content/hadith/muslim.json', 'utf8'));
    const n = JSON.parse(fs.readFileSync('public/hadith/muslim-narrators.json', 'utf8'));
    mcache = { books: t.books, hadiths: t.hadiths, people: n.p };
  }
  return mcache;
}
/** sunnah.com's own book / ḥadīth-in-book address, the same pair the data carries (the running number alone repeats across books) */
export const muslimUrl = (h: Hadith) => `https://sunnah.com/muslim/${h.book}/${h.inbook}`;

/** Arabic without vowel marks, so that searches typed without them still match. */
export const plainArabic = (s: string) =>
  s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[إأآٱ]/g, 'ا');

/** Plain Arabic plus each word without its attached particles (wa-, fa-, bi-, li-, ka-, al-), so that a search
 *  for النيات or نيات also finds بالنيات. Used only in the hidden copy that the search index reads. */
export function searchArabic(s: string) {
  const plain = plainArabic(s);
  const extra = new Set<string>();
  for (const w of plain.split(/[^\u0621-\u064A]+/)) {
    if (w.length < 4) continue;
    let x = w.replace(/^(وب|ول|فب|فل|و|ف|ب|ل|ك)(?=ال)/, '');
    if (x === w) x = w.replace(/^(و|ف)(?=[بلك]?ال|.{3,})/, '');
    if (x !== w && x.length >= 3) extra.add(x);
    const y = x.replace(/^(ال|لل)/, '');
    if (y !== x && y.length >= 3) extra.add(y);
  }
  return plain + ' ' + [...extra].join(' ');
}

/** "1" -> 1, "402b" -> "402" (sunnah.com's own link for the second narration under 402 is the same page) */
export const sunnahUrl = (h: Hadith) => `https://sunnah.com/bukhari:${String(h.num).split('.')[0]}`;

export const ARCHIVED = '2026-10-20';
export const MUSLIM_ARCHIVED = '2026-10-24';
