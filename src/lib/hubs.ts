import hubs from '../data/subject-hubs.json';

export type HubPath = { work: string; note: string };
export type Hub = { intro: string[]; related: string[]; path: HubPath[] };

/** The hand-written part of a subject page: introduction, reading path, related subjects. */
export function hubOf(subjectId: string): Hub | undefined {
  return (hubs as Record<string, Hub>)[subjectId];
}
