import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;
export type Author = CollectionEntry<'authors'>;

export const SUBJECTS = [
  'Hadith studies', 'Islamic law', 'Islam and modernity', 'Colonialism and decolonisation', 'Women and gender',
  'Philosophy and theology', 'Political thought', 'Sufism', 'Economics', 'Slavery and race', 'Education', 'Qurʾānic studies',
];

export const ERAS = [
  { id: '1850-1914', span: '1850–1914', name: 'Reform and the Nahda', from: 0, to: 1913 },
  { id: '1914-1947', span: '1914–1947', name: 'End of empire', from: 1914, to: 1946 },
  { id: '1947-1979', span: '1947–1979', name: 'New states, revival', from: 1947, to: 1978 },
  { id: '1979-2000', span: '1979–2000', name: 'Revolution and renewal', from: 1979, to: 1999 },
  { id: '2000-today', span: '2000–today', name: 'Contemporary voices', from: 2000, to: 9999 },
];

export const eraOf = (year: number) => ERAS.find((e) => year >= e.from && year <= e.to)!;

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
