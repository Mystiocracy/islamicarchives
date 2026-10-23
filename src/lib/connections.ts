import data from '../data/influences.json';
import { entries, entryId, type HEntry } from './history';

export type Edge = { from: string; to: string; kind: string; note: string; source?: string };
export const edges = data.edges as Edge[];
export const kinds = data.kinds as Record<string, { label: string; out: string; in: string }>;
export const meta = { title: data.title, intro: data.intro, archived: data.archived, source_note: data.source_note };

export type Link = { kind: string; label: string; other: string; note: string; dir: 'out' | 'in'; source?: string };

/** Everything that links this author to others, as "label + other author + note". */
export function connectionsOf(id: string): Link[] {
  const out: Link[] = [];
  for (const e of edges) {
    const k = kinds[e.kind];
    if (!k) continue;
    if (e.from === id) out.push({ kind: e.kind, label: k.out, other: e.to, note: e.note, dir: 'out', source: e.source });
    else if (e.to === id) out.push({ kind: e.kind, label: k['in'], other: e.from, note: e.note, dir: 'in', source: e.source });
  }
  const order = Object.keys(kinds);
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** Authors that appear in at least one link. */
export function connectedIds(): string[] {
  return [...new Set(edges.flatMap((e) => [e.from, e.to]))];
}

/** Periods in the History Hub that overlap a lifetime, from the Ottoman centuries on. */
export function periodsOf(born?: number, died?: number): { name: string; id: string; when: string }[] {
  if (!born) return [];
  const end = died ?? new Date().getFullYear();
  return entries
    .filter((e: HEntry) => e.to >= born && e.from <= end && e.to >= 1750)
    .map((e) => ({ name: e.name, id: entryId(e.name), when: e.when }));
}

/** The six kinds of connection shown on an author page, with teachers and students apart and influences in each direction. */
export const connectionGroups = [
  { id: 'teachers', title: 'Teachers', kind: 'teacher', dir: 'in' },
  { id: 'students', title: 'Students', kind: 'teacher', dir: 'out' },
  { id: 'influenced-by', title: 'Influenced by', kind: 'influence', dir: 'in' },
  { id: 'influenced', title: 'Influenced', kind: 'influence', dir: 'out' },
  { id: 'family', title: 'Family', kind: 'family' },
  { id: 'colleagues', title: 'Worked together', kind: 'colleague' },
  { id: 'debate', title: 'Argued with', kind: 'debate' },
  { id: 'parallel', title: 'Parallel projects', kind: 'parallel' },
] as { id: string; title: string; kind: string; dir?: 'out' | 'in' }[];
