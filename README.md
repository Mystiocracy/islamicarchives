# Islamic Archives – Archive of Modern Islamic Thought

The website for **islamicarchives.org**: a free, searchable archive of writings by modern Muslim thinkers, with downloads in EPUB, PDF, Word and plain text, and Send to Kindle / email delivery.

## Adding and editing content

**Easiest: the admin page.** Go to <https://app.pagescms.org>, sign in with GitHub and open this repository. You'll see **Works** and **Authors**.

- *Add an author:* Authors → Add entry → fill in the name, dates, region and a short biography → Save.
- *Add a work:* Works → Add entry → choose the author, fill in the details, pick the **Rights status**, then:
  - **Public domain** or **Permission granted**: paste the full text into *Full text*. The site will host it and generate the downloads.
  - **In copyright – link only**: leave *Full text* empty and put the publisher's free link in *Link to free copy*.
- Press **Save**. The site rebuilds and goes live in about two minutes.

Each work is a Markdown file in `content/works/`, and each author is one in `content/authors/`, so you can also add or edit files directly on GitHub.

## How the site is built

- [Astro](https://astro.build) turns the files in `content/` into pages (`src/pages/`).
- [Pagefind](https://pagefind.app) builds the full-text search index.
- `scripts/make-downloads.mjs` uses pandoc (and WeasyPrint for PDF) to make the downloads into `dist/downloads/`.
- `functions/api/send.js` is a Cloudflare Pages Function that emails a download to a reader's Kindle or inbox.
- `.github/workflows/deploy.yml` builds everything on each push to `main` and deploys it to Cloudflare Pages.

## One-time setup

1. **Cloudflare Pages:** create a Cloudflare API token with the *Cloudflare Pages: Edit* permission, then add two repository secrets in GitHub (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Create a Pages project named `islamicarchives` (Direct Upload), then add the custom domain `islamicarchives.org` to it.
2. **Email delivery:** create a free account at resend.com, verify `islamicarchives.org` as a sending domain, and add `RESEND_API_KEY` and `FROM_ADDRESS` (for example `Islamic Archives <books@islamicarchives.org>`) as environment variables on the Pages project. Until then, the Send buttons show a polite "not switched on yet" message.

## Working locally

```
npm install
npm run dev      # live preview at http://localhost:4321
npm run build    # full build including search and downloads (needs pandoc and weasyprint)
```
