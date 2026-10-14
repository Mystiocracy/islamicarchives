import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The admin page saves a picked author or subject as its file path ("content/subjects/sufism.md");
// accept that as well as the bare id ("sufism").
const toId = (v: unknown) => (typeof v === 'string' ? v.replace(/^.*\//, '').replace(/\.md$/, '') : v);

const authors = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/authors' }),
  schema: z.object({
    name: z.string(),
    nameNative: z.string().optional(),
    nativeLang: z.string().optional(),
    born: z.number().optional(),
    died: z.number().optional(),
    region: z.string().optional(),
    roles: z.string().optional(),
    featured: z.boolean().default(false),
    // the name to file the author under in A–Z lists, e.g. "Taha" (defaults to the last word of the name)
    sortAs: z.string().optional(),
    // where the biography's facts come from
    sources: z.array(z.string().url()).default([]),
    // hide this author (and all their works) from the site
    draft: z.boolean().default(false),
  }),
});

const subjects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/subjects' }),
  schema: z.object({
    name: z.string(),
    order: z.number().default(100),
    featured: z.boolean().default(true),
    // hide this subject from the site (works keep their other subjects)
    draft: z.boolean().default(false),
  }),
});

const eras = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/eras' }),
  schema: z.object({
    name: z.string(),
    from: z.number(),
    to: z.number(),
    order: z.number().default(100),
    // hide this era from the site
    draft: z.boolean().default(false),
  }),
});

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/works' }),
  schema: z.object({
    title: z.string(),
    author: z.preprocess(toId, reference('authors')),
    coAuthors: z.string().optional(),
    titleOriginal: z.string().optional(),
    year: z.number().optional(),
    language: z.string().default('English'),
    type: z.enum(['Book', 'Pamphlet', 'Article', 'Chapter', 'Essay', 'Policy paper', 'Speech', 'Review', 'Collection', 'Anthology', 'Translation', 'Novel', 'Memoir', 'Letters', 'Bibliography', 'Interview']).default('Article'),
    subjects: z.array(z.preprocess(toId, reference('subjects'))).default([]),
    keywords: z.array(z.string()).default([]),
    venue: z.string().optional(),
    summary: z.string().optional(),
    // public-domain: we host the text; permission: hosted with written permission; link-only: we point to the free copy elsewhere
    rights: z.enum(['public-domain', 'permission', 'link-only']),
    rightsNote: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    // name of the website that hosts the free copy, shown as "Source: …"
    sourceLabel: z.string().optional(),
    // a catalogue or publisher page, for works with no free copy online
    infoUrl: z.string().url().optional(),
    sourceEdition: z.string().optional(),
    // extra note about the source: an alternative link, edition details
    sourceNote: z.string().optional(),
    contents: z.array(z.string()).default([]),
    // the full text is in content/chapters/<work id>/ and is read chapter by chapter
    reader: z.boolean().default(false),
    added: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

// chapters of a work read online one page at a time (made by scripts/epub-to-reader.py); the body is HTML
const chapters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/chapters' }),
  schema: z.object({
    work: z.string(),
    order: z.number(),
    title: z.string(),
    slug: z.string(),
    // printed page range in the source edition, e.g. "1–197"
    pages: z.string().optional(),
    sections: z.array(z.object({ id: z.string(), title: z.string() })).default([]),
  }),
});

export const collections = { authors, subjects, eras, works, chapters };
