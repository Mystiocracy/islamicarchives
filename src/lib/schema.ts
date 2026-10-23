// schema.org structured data (JSON-LD). Pages pass these objects to <Base jsonld={...}>.
const SITE = 'https://islamicarchives.org';
export const abs = (p: string) => (/^https?:/.test(p) ? p : SITE + (p.startsWith('/') ? p : '/' + p));

export const publisher = { '@type': 'Organization', name: 'Islamic Internet Archives', url: SITE + '/' };

export function breadcrumbs(items: { name: string; href?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(it.href ? { item: abs(it.href) } : {}) })),
  };
}

export const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Islamic Internet Archives',
  alternateName: 'Archive of Modern Islamic Thought',
  url: SITE + '/',
  publisher,
  potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: SITE + '/library/?q={search_term_string}' }, 'query-input': 'required name=search_term_string' },
};

const sameAsOf = (urls: string[]) => urls.filter((u) => /^https?:\/\/([a-z]+\.)?(wikipedia|wikidata)\.org\//.test(u));
export function person(a: { name: string; nameNative?: string; born?: number; died?: number; roles?: string; region?: string; sources: string[] }, url: string, image?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': abs(url) + '#person',
    name: a.name,
    ...(a.nameNative ? { alternateName: a.nameNative } : {}),
    url: abs(url),
    ...(a.born ? { birthDate: String(a.born) } : {}),
    ...(a.died ? { deathDate: String(a.died) } : {}),
    ...(a.roles ? { jobTitle: a.roles } : {}),
    ...(image ? { image: abs(image) } : {}),
    ...(sameAsOf(a.sources).length ? { sameAs: sameAsOf(a.sources) } : {}),
  };
}

const LANG: Record<string, string> = { english: 'en', arabic: 'ar', urdu: 'ur', persian: 'fa', farsi: 'fa', turkish: 'tr', french: 'fr', german: 'de', indonesian: 'id', malay: 'ms', bengali: 'bn', spanish: 'es' };
const lang = (l?: string) => (l ? LANG[l.toLowerCase()] || l : undefined);

export function creative(kind: 'Book' | 'Article', o: { title: string; url: string; authorName: string; authorUrl: string; year?: number; language?: string; summary?: string; source?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': kind === 'Book' ? 'Book' : 'Article',
    name: o.title,
    url: abs(o.url),
    author: { '@type': 'Person', name: o.authorName, url: abs(o.authorUrl) },
    ...(o.year ? { datePublished: String(o.year) } : {}),
    ...(lang(o.language) ? { inLanguage: lang(o.language) } : {}),
    ...(o.summary ? { description: o.summary } : {}),
    ...(o.source ? { isBasedOn: o.source } : {}),
    isAccessibleForFree: true,
    publisher,
  };
}
