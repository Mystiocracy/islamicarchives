// Helpers for the Quran section (manuscript catalogue, scholars, tafseer).
export const SITE = 'https://islamicarchives.org';

/** "2026-10-15" -> "15 October 2026" */
export function longDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const stop = (s: string) => s.replace(/[\s.]+$/, '');

export type CatalogueEntry = {
  id: string; name: string; kind: string; period?: string; source?: string; archived: string; url: string;
  institution?: string; location?: string; affiliation?: string; group: string;
};

/** A citation for one catalogue entry: the original page, the date this archive recorded it, and this archive's own address. */
export function citeManuscript(e: CatalogueEntry) {
  const who = e.source || 'Unknown source';
  const where = e.institution || e.location;
  return `${stop(who)}. “${stop(e.name)}.”${where ? ' ' + stop(where) + '.' : ''} ${e.url}. Archived ${longDate(e.archived)} in Islamic Archives, “Quranic manuscript catalogue”, ${SITE}/quran/manuscripts/#${e.id}.`;
}

export function citeScholar(e: CatalogueEntry) {
  return `“${stop(e.name)}.”${e.affiliation ? ' ' + stop(e.affiliation) + '.' : ''} ${e.url}. Archived ${longDate(e.archived)} in Islamic Archives, “Scholars of Quranic manuscripts”, ${SITE}/quran/scholars/#${e.id}.`;
}

/** Order used when sorting by period. */
export const PERIODS = ['1st century AH', '1st–2nd century AH', '2nd century AH', '2nd–3rd century AH', 'Not dated or not applicable'];
