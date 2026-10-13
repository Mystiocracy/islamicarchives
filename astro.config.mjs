import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://islamicarchives.org',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
