import hist from '../data/history.json';

export type Ruler = { name: string; role: string; when: string };
export type HEntry = {
  group: string; from: number; to: number; when: string; name: string; place: string; text: string;
  wiki?: string; era?: string; countries?: string[]; rulers?: Ruler[];
};
export type TNode = { n: string; kids?: TNode[] };

export const entries: HEntry[] = [...(hist.entries as HEntry[])].sort((a, b) => a.from - b.from || a.to - b.to);
export const groups: Record<string, string> = hist.groups;
export const byName = new Map(entries.map((e) => [e.name, e]));

export const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const entryId = (n: string) => 'h-' + slug(n);

/** Lineage tree: each state sits under the power it grew out of or replaced. */
export const treeDef: TNode = { n: 'Muhammad and the first community', kids: [{ n: 'Rashidun Caliphate', kids: [{ n: 'Umayyad Caliphate', kids: [
  { n: 'Umayyads of al-Andalus', kids: [{ n: 'Almoravids and Almohads', kids: [{ n: 'Nasrid Emirate of Granada' }] }] },
  { n: 'Abbasid Caliphate', kids: [
    { n: 'Fatimid Caliphate', kids: [{ n: 'Ayyubid Sultanate', kids: [{ n: 'Mamluk Sultanate' }] }] },
    { n: 'Ghaznavids', kids: [{ n: 'Delhi Sultanate' }] },
    { n: 'Great Seljuk Empire', kids: [{ n: 'Ottoman Empire', kids: [
      { n: 'Saudi states' },
      { n: 'European colonial rule and the Nahḍa', kids: [{ n: 'End of empire', kids: [{ n: 'New states and revival', kids: [{ n: 'Revolution and renewal', kids: [{ n: 'Contemporary voices' }] }] }] }] } ] }] },
    { n: 'Ilkhanate', kids: [{ n: 'Timurid Empire', kids: [{ n: 'Mughal Empire' }, { n: 'Safavid Empire' }] }] },
  ] } ] }] }] };

/** "Saudi Arabia (Hejaz)" → { name: "Saudi Arabia", note: "Hejaz" } */
export function splitCountry(raw: string): { name: string; note: string } {
  const m = raw.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { name: m[1].trim(), note: m[2].trim() } : { name: raw.trim(), note: '' };
}
/** Entries whose country list is a description, not a list of states. */
export const isCountryLike = (raw: string) => !/^(about|\d+ member)/i.test(raw);

export type CountryPeriod = { entry: HEntry; note: string };
export type Country = { name: string; slug: string; periods: CountryPeriod[] };

export function countryIndex(): Country[] {
  const map = new Map<string, Country>();
  const contemporary = entries.find((e) => e.to >= 9999);
  for (const e of entries) {
    for (const raw of e.countries || []) {
      if (!isCountryLike(raw)) continue;
      const { name, note } = splitCountry(raw);
      let c = map.get(name);
      if (!c) { c = { name, slug: slug(name), periods: [] }; map.set(name, c); }
      if (!c.periods.some((p) => p.entry === e)) c.periods.push({ entry: e, note });
    }
  }
  for (const c of map.values()) {
    if (contemporary && !c.periods.some((p) => p.entry === contemporary)) c.periods.push({ entry: contemporary, note: '' });
    c.periods.sort((a, b) => a.entry.from - b.entry.from || a.entry.to - b.entry.to);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
