import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

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

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/works' }),
  schema: z.object({
    title: z.string(),
    author: reference('authors'),
    coAuthors: z.string().optional(),
    year: z.number(),
    language: z.enum(['English', 'Arabic', 'Urdu', 'Persian', 'French', 'Turkish', 'Malay', 'Bosnian', 'Other']).default('English'),
    type: z.enum(['Book', 'Article', 'Chapter', 'Essay', 'Policy paper', 'Speech', 'Review', 'Collection', 'Translation']).default('Article'),
    subjects: z.array(z.string()).default([]),
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

export const collections = { authors, works };
