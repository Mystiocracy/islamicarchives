import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;
export type Author = CollectionEntry<'authors'>;
export type Subject = CollectionEntry<'subjects'>;
export type Era = CollectionEntry<'eras'>;

export async function allSubjects() {
  const s = await getCollection('subjects', ({ data }) => !data.draft);
  return s.sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}

export async function allEras() {
  const e = await getCollection('eras', ({ data }) => !data.draft);
  return e.sort((a, b) => a.data.from - b.data.from);
}

/** "1850–1914" style label; a 'to' of 9999 shows as "today". */
export const eraSpan = (e: Era['data']) => `${e.from}–${e.to >= 9999 ? 'today' : e.to + 1}`;

/** The era a year falls in; years before the first era count as the first, later ones as the last. */
export function eraOf(year: number | undefined, eras: Era[]) {
  if (!eras.length || year == null) return undefined;
  return eras.find((e) => year >= e.data.from && year <= e.data.to) || (year < eras[0].data.from ? eras[0] : eras[eras.length - 1]);
}

export async function subjectNames() {
  const m = new Map<string, string>();
  for (const s of await allSubjects()) m.set(s.id, s.data.name);
  return m;
}

export async function allWorks() {
  const hiddenAuthors = new Set((await getCollection('authors', ({ data }) => data.draft)).map((a) => a.id));
  const shown = new Set((await allSubjects()).map((s) => s.id));
  const ws = (await getCollection('works', ({ data }) => !data.draft && !hiddenAuthors.has(data.author.id)))
    // drop hidden subjects from each work
    .map((w) => ({ ...w, data: { ...w.data, subjects: w.data.subjects.filter((s) => shown.has(s.id)) } }));
  return ws.sort((a, b) => (a.data.year ?? 99999) - (b.data.year ?? 99999) || a.data.title.localeCompare(b.data.title));
}

export async function allAuthors() {
  const as = await getCollection('authors', ({ data }) => !data.draft);
  return as.sort((a, b) => authorKey(a).localeCompare(authorKey(b)));
}

// "Muhammad Iqbal" -> "Iqbal"; strips leading al-/ʿ for sorting
export function sortName(name: string) {
  const last = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).pop() || name;
  return plain(last.replace(/^(al-|el-)/i, ''));
}

// strip diacritics and ʿ/ʾ so "Ṭāhā" files under T and "ʿAlī" under A
export function plain(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ʿʾ'’]/g, '');
}

// same normalisation as norm() in public/js/suggest.js, for text that the browser searches
export function searchText(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ʿʾ'’`]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// where an author is filed in A–Z lists
export function authorKey(a: { data: { name: string; sortAs?: string } }) {
  return a.data.sortAs ? plain(a.data.sortAs) : sortName(a.data.name);
}

export function years(a: Author['data']) {
  if (a.born && a.died) return `${a.born}–${a.died}`;
  if (a.born) return `b. ${a.born}`;
  if (a.died) return `d. ${a.died}`;
  return '';
}

export function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, '').replace(/[ʿʾ]/g, '').split(/\s+/).filter((p) => p && !/^(al-|ibn|bin|and|of)$/i.test(p));
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const hosted = (w: Work) => w.data.rights !== 'link-only' && (w.data.reader || (w.body || '').trim().length > 0);

export type Chapter = CollectionEntry<'chapters'>;
/** The chapters of a work that is read chapter by chapter, in reading order. */
export async function chaptersOf(workId: string) {
  const cs = await getCollection('chapters', ({ data }) => data.work === workId);
  return cs.sort((a, b) => a.data.order - b.data.order);
}

export const FORMATS = [
  { ext: 'epub', label: 'EPUB', note: 'Kindle, Kobo, phones, Apple Books' },
  { ext: 'pdf', label: 'PDF', note: 'Print and tablets' },
  { ext: 'docx', label: 'Word', note: 'Editable text' },
  { ext: 'txt', label: 'Plain text', note: 'For research tools' },
];

export const RIGHTS_LABEL: Record<string, string> = {
  'public-domain': 'Public domain',
  permission: 'Published with permission',
  'link-only': 'Link to free copy',
};

// The four groups works are divided into on author pages and in the Library.
export const CATEGORIES = [
  { id: 'books', label: 'Books', types: ['Book', 'Pamphlet', 'Collection', 'Anthology', 'Translation', 'Novel', 'Memoir', 'Letters', 'Bibliography'] },
  { id: 'articles', label: 'Articles & essays', types: ['Article', 'Essay', 'Review', 'Speech', 'Interview'] },
  { id: 'papers', label: 'Papers', types: ['Paper', 'Policy paper', 'Chapter'] },
  { id: 'videos', label: 'Videos', types: ['Video'] },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];
export function categoryOf(type: string): CategoryId {
  return (CATEGORIES.find((c) => (c.types as readonly string[]).includes(type))?.id || 'articles') as CategoryId;
}
