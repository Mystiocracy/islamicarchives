// Shared by the page templates and the search-index script (plain JS so Node can import it).
/** Arabic without vowel marks, so that searches typed without them still match. */
export const plainArabic = (s) =>
  s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[إأآٱ]/g, 'ا');

/** Plain Arabic plus each word without its attached particles (wa-, fa-, bi-, li-, ka-, al-), so that a search
 *  for النيات or نيات also finds بالنيات. Used only in the hidden copy that the search index reads. */
export function searchArabic(s) {
  const plain = plainArabic(s);
  const extra = new Set();
  for (const w of plain.split(/[^\u0621-\u064A]+/)) {
    if (w.length < 4) continue;
    let x = w.replace(/^(وب|ول|فب|فل|و|ف|ب|ل|ك)(?=ال)/, '');
    if (x === w) x = w.replace(/^(و|ف)(?=[بلك]?ال|.{3,})/, '');
    if (x !== w && x.length >= 3) extra.add(x);
    const y = x.replace(/^(ال|لل)/, '');
    if (y !== x && y.length >= 3) extra.add(y);
  }
  return plain + ' ' + [...extra].join(' ');
}

