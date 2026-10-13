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
  }),
});

const subjects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/subjects' }),
  schema: z.object({
    name: z.string(),
    order: z.number().default(100),
    featured: z.boolean().default(true),
  }),
});

const eras = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/eras' }),
  schema: z.object({
    name: z.string(),
    from: z.number(),
    to: z.number(),
    order: z.number().default(100),
  }),
});

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/works' }),
  schema: z.object({
    title: z.string(),
    author: z.preprocess(toId, reference('authors')),
    coAuthors: z.string().optional(),
    year: z.number(),
    language: z.enum(['English', 'Arabic', 'Urdu', 'Persian', 'French', 'Turkish', 'Malay', 'Bosnian', 'Other']).default('English'),
    type: z.enum(['Book', 'Article', 'Chapter', 'Essay', 'Policy paper', 'Speech', 'Review', 'Collection', 'Translation']).default('Article'),
    subjects: z.array(z.preprocess(toId, reference('subjects'))).default([]),
    keywords: z.array(z.string()).default([]),
    venue: z.string().optional(),
    summary: z.string().optional(),
    // public-domain: we host the text; permission: hosted with written permission; link-only: we point to the free copy elsewhere
    rights: z.enum(['public-domain', 'permission', 'link-only']),
    rightsNote: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    sourceEdition: z.string().optional(),
    contents: z.array(z.string()).default([]),
    added: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { authors, subjects, eras, works };
