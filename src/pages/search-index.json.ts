// A small index of authors, subjects and works for the search-as-you-type suggestions.
import { allAuthors, allSubjects, allWorks } from '../lib/site';
import manuscripts from '../data/manuscripts.json';
import scholars from '../data/scholars.json';

export async function GET() {
  const authors = await allAuthors();
  const names = new Map(authors.map((a) => [a.id, a.data.name]));
  const works = await allWorks();
  const count = new Map<string, number>();
  for (const w of works) count.set(w.data.author.id, (count.get(w.data.author.id) || 0) + 1);
  const subjects = await allSubjects();
  const subjCount = new Map<string, number>();
  for (const w of works) for (const s of w.data.subjects) subjCount.set(s.id, (subjCount.get(s.id) || 0) + 1);

  // Writers with no author page of their own (guest writers of Yaqeen papers, co-authors):
  // still offered in the suggestions, leading to a library search for their name.
  const known = new Set(authors.map((a) => a.data.name.toLowerCase()));
  const writers = new Map<string, number>();
  for (const w of works) {
    for (const field of [w.data.byline, w.data.coAuthors]) {
      if (!field) continue;
      for (let n of field.split(/\s*(?:,|&|\band\b)\s*/)) {
        n = n.replace(/^(translated|edited|compiled|with|by)\b.*?\bby\s+/i, '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
        if (n.length < 4 || !/^[A-ZÀ-ÿʿʾĀ-ž]/.test(n) || known.has(n.toLowerCase())) continue;
        writers.set(n, (writers.get(n) || 0) + 1);
      }
    }
  }

  // the Quran section: its own pages, every manuscript-catalogue entry and every scholar
  const q = [
    ['Quran Hub', '/quran/', 'quran tafseer corpus manuscripts scholars', 'Quran section'],
    ['Tafseer', '/quran/tafsir/', 'tafsir commentary exegesis translation', 'Quran section'],
    ['Quran Word Corpus', '/quran/corpus/', 'word by word roots grammar concordance dictionary', 'Quran section'],
    ['Manuscript catalogue', '/quran/manuscripts/', 'quranic manuscripts codex palimpsest', 'Quran section'],
    ['Manuscripts of the Qur’an Attributable to the First Century of the Hijra', '/quran/manuscripts/first-century-manuscripts/', 'article study guide hijazi kufic radiocarbon dating palaeography islamic awareness first century hijra manuscripts', 'Manuscript catalogue · Article'],
    ['Isnād of the Ten Qirāʾāt', '/quran/manuscripts/qiraat-isnad/', 'qiraat qirat readings isnad tree turuq tariq riwayat rawi hafs warsh qalun nafi asim hamza kisai ibn kathir abu amr ibn amir abu jafar yaqub khalaf ibn al-jazari nashr', 'Manuscript catalogue · Chart'],
    ['Manuscript scholars', '/quran/scholars/', 'quranic manuscripts researchers palaeography', 'Quran section'],
    ['Hadith Hub', '/hadith/', 'hadith sunnah isnad narrators rijal', 'Hadith section'],
    ['Ṣaḥīḥ al-Bukhārī', '/hadith/bukhari/', 'sahih bukhari hadith text arabic english search books', 'Hadith Hub · Text'],
    ['Ṣaḥīḥ Muslim', '/hadith/muslim/', 'sahih muslim hadith text arabic english search books', 'Hadith Hub · Text'],
    ['Narrators of Ṣaḥīḥ Muslim', '/hadith/muslim-narrators/', 'muslim sahih rijal narrators isnad chain tree tabaqat generations grades thiqah ruwat', 'Hadith Hub · Chart'],
    ['Narrators of Ṣaḥīḥ al-Bukhārī', '/hadith/bukhari-narrators/', 'bukhari sahih rijal narrators isnad chain tree tabaqat generations grades thiqah ruwat', 'Hadith Hub · Chart'],
    ...manuscripts.map((m: any) => [m.name, `/quran/manuscripts/#${m.id}`, [m.institution, m.location, m.period, m.kind, m.source].filter(Boolean).join(' '), `Manuscript catalogue · ${m.kind}`]),
    ...scholars.map((m: any) => [m.name, `/quran/scholars/#${m.id}`, [m.nameNative, m.affiliation, m.kind].filter(Boolean).join(' '), `Manuscript scholars · ${m.kind}`]),
  ];

  const out = {
    q,
    // [name, url, extra words to match, note] (works also carry type and language)
    a: authors.map((a) => [a.data.name, `/authors/${a.id}/`, [a.data.nameNative, a.data.sortAs, a.id.replace(/-/g, ' ')].filter(Boolean).join(' '), [a.data.born && (a.data.died ? `${a.data.born}–${a.data.died}` : `b. ${a.data.born}`), `${count.get(a.id) || 0} works`].filter(Boolean).join(' · ')])
      .concat([...writers].map(([n, c]) => [n, `/library/?q=${encodeURIComponent(n)}`, '', `${c} ${c === 1 ? 'work' : 'works'}`])),
    s: subjects.map((s) => [s.data.name, `/subjects/${s.id}/`, '', `${subjCount.get(s.id) || 0} works`]),
    w: works.map((w) => [w.data.title, `/works/${w.id}/`, [w.data.titleOriginal, w.data.byline, w.data.coAuthors, w.data.keywords.join(' ')].filter(Boolean).join(' '), [names.get(w.data.author.id), w.data.year].filter(Boolean).join(' · '), w.data.type, w.data.language || '']),
  };
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}
