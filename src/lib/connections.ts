import data from '../data/influences.json';
import { entries, entryId, type HEntry } from './history';

export type Edge = { from: string; to: string; kind: string; note: string };
export const edges = data.edges as Edge[];
export const kinds = data.kinds as Record<string, { label: string; out: string; in: string }>;
export const meta = { title: data.title, intro: data.intro, archived: data.archived, source_note: data.source_note };

export type Link = { kind: string; label: string; other: string; note: string };

/** Everything that links this author to others, as "label + other author + note". */
export function connectionsOf(id: string): Link[] {
  const out: Link[] = [];
  for (const e of edges) {
    const k = kinds[e.kind];
    if (!k) continue;
    if (e.from === id) out.push({ kind: e.kind, label: k.out, other: e.to, note: e.note });
    else if (e.to === id) out.push({ kind: e.kind, label: k['in'], other: e.from, note: e.note });
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
