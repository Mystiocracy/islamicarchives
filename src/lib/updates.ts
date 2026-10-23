import { allAuthors, allWorks, type Work, type Author } from './site';

export type Batch = {
  author: Author;
  works: Work[];
  newAuthor: boolean;
};
export type Day = { date: string; total: number; batches: Batch[]; newAuthors: number };

const day = (d?: Date) => (d ? d.toISOString().slice(0, 10) : '');

/** What was added on each day, newest first: works grouped by author, plus authors whose biography was archived that day. */
export async function updatesByDay(): Promise<Day[]> {
  const works = await allWorks();
  const authors = await allAuthors();
  const byDay = new Map<string, Map<string, Work[]>>();
  for (const w of works) {
    const d = day(w.data.added);
    if (!d) continue;
    const m = byDay.get(d) || new Map<string, Work[]>();
    const list = m.get(w.data.author.id) || [];
    list.push(w);
    m.set(w.data.author.id, list);
    byDay.set(d, m);
  }
  const archivedOn = new Map<string, string>();
  for (const a of authors) {
    const d = day(a.data.archived);
    if (d) archivedOn.set(a.id, d);
  }
  const byId = new Map(authors.map((a) => [a.id, a]));
  const out: Day[] = [];
  const dates = new Set([...byDay.keys(), ...archivedOn.values()]);
  for (const d of [...dates].sort().reverse()) {
    const m = byDay.get(d) || new Map<string, Work[]>();
    const ids = new Set([...m.keys(), ...[...archivedOn].filter(([, v]) => v === d).map(([k]) => k)]);
    const batches: Batch[] = [];
    for (const id of ids) {
      const a = byId.get(id);
      if (!a) continue;
      const ws = (m.get(id) || []).sort((x, y) => (x.data.year ?? 99999) - (y.data.year ?? 99999) || x.data.title.localeCompare(y.data.title));
      batches.push({ author: a, works: ws, newAuthor: archivedOn.get(id) === d });
    }
    batches.sort((x, y) => y.works.length - x.works.length || x.author.data.name.localeCompare(y.author.data.name));
    out.push({ date: d, total: batches.reduce((n, b) => n + b.works.length, 0), batches, newAuthors: batches.filter((b) => b.newAuthor).length });
  }
  return out;
}
