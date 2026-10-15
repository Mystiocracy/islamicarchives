import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://islamicarchives.org',
  trailingSlash: 'always',
  // the scholars page moved out of the manuscripts folder
  redirects: { '/quran/manuscripts/scholars/': '/quran/scholars/' },
  build: { format: 'directory' },
});
