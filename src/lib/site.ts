import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;
export type Author = CollectionEntry<'authors'>;
export type Subject = CollectionEntry<'subjects'>;
export type Era = CollectionEntry<'eras'>;

export async function allSubjects() {
  const s = await getCollection('subjects');
  return s.sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}

export async function allEras() {
  const e = await getCollection('eras');
  return e.sort((a, b) => a.data.from - b.data.from);
}

/** "1850–1914" style label; a 'to' of 9999 shows as "today". */
export const eraSpan = (e: Era['data']) => `${e.from}–${e.to >= 9999 ? 'today' : e.to + 1}`;

/** The era a year falls in; years before the first era count as the first, later ones as the last. */
export function eraOf(year: number, eras: Era[]) {
  if (!eras.length) return undefined;
  return eras.find((e) => year >= e.data.from && year <= e.data.to) || (year < eras[0].data.from ? eras[0] : eras[eras.length - 1]);
}

export async function subjectNames() {
  const m = new Map<string, string>();
  for (const s of await allSubjects()) m.set(s.id, s.data.name);
  return m;
}

export async function allWorks() {
  const ws = await getCollection('works', ({ data }) => !data.draft);
  return ws.sort((a, b) => a.data.year - b.data.year || a.data.title.localeCompare(b.data.title));
}

export async function allAuthors() {
  const as = await getCollection('authors');
  return as.sort((a, b) => sortName(a.data.name).localeCompare(sortName(b.data.name)));
}

// "Muhammad Iqbal" -> "Iqbal"; strips leading al-/ʿ for sorting
export function sortName(name: string) {
  const last = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).pop() || name;
  return last.replace(/^(al-|el-)/i, '').replace(/^[ʿʾ'’]/, '');
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

export const hosted = (w: Work) => w.data.rights !== 'link-only' && (w.body || '').trim().length > 0;

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
