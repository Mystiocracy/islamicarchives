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
    // a few hundred narrations carry no book in the source data (they sit between numbered ones): file them by number range
    for (const h of t.hadiths as Hadith[]) {
      if (!t.books.some((b: Book) => b.k === h.book)) {
        const b = t.books.find((b: Book) => h.num >= Number(b.first) && h.num <= Number(b.last));
        if (b) h.book = b.k;
      }
    }
    // any still without a book follow the narration before them
    let prevBook = 0;
    for (const h of t.hadiths as Hadith[]) { if (!t.books.some((b: Book) => b.k === h.book)) h.book = prevBook; else prevBook = h.book; }
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

export { plainArabic, searchArabic } from './arabic-search.mjs';

/** "1" -> 1, "402b" -> "402" (sunnah.com's own link for the second narration under 402 is the same page) */
export const sunnahUrl = (h: Hadith) => `https://sunnah.com/bukhari:${String(h.num).split('.')[0]}`;

export const ARCHIVED = '2026-10-20';
export const MUSLIM_ARCHIVED = '2026-10-24';
