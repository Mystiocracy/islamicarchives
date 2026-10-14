// A small index of authors, subjects and works for the search-as-you-type suggestions.
import { allAuthors, allSubjects, allWorks } from '../lib/site';

export async function GET() {
  const authors = await allAuthors();
  const names = new Map(authors.map((a) => [a.id, a.data.name]));
  const works = await allWorks();
  const count = new Map<string, number>();
  for (const w of works) count.set(w.data.author.id, (count.get(w.data.author.id) || 0) + 1);
  const subjects = await allSubjects();
  const subjCount = new Map<string, number>();
  for (const w of works) for (const s of w.data.subjects) subjCount.set(s.id, (subjCount.get(s.id) || 0) + 1);

  const out = {
    // [name, url, extra words to match, note] (works also carry type and language)
    a: authors.map((a) => [a.data.name, `/authors/${a.id}/`, [a.data.nameNative, a.data.sortAs, a.id.replace(/-/g, ' ')].filter(Boolean).join(' '), [a.data.born && (a.data.died ? `${a.data.born}–${a.data.died}` : `b. ${a.data.born}`), `${count.get(a.id) || 0} works`].filter(Boolean).join(' · ')]),
    s: subjects.map((s) => [s.data.name, `/subjects/${s.id}/`, '', `${subjCount.get(s.id) || 0} works`]),
    w: works.map((w) => [w.data.title, `/works/${w.id}/`, [w.data.titleOriginal, w.data.keywords.join(' ')].filter(Boolean).join(' '), [names.get(w.data.author.id), w.data.year].filter(Boolean).join(' · '), w.data.type, w.data.language || '']),
  };
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}
