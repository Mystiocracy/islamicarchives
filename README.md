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
- `public/api/send.php` emails a download to a reader's Kindle or inbox through the Hostinger mailbox books@islamicarchives.org.
- `.github/workflows/deploy.yml` builds everything on each push to `main` and uploads it to the Hostinger hosting by FTP.

## One-time setup (Hostinger)

Add these repository secrets in GitHub (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
|---|---|
| `FTP_SERVER` | FTP hostname from hPanel → Websites → islamicarchives.org → Dashboard → Files → FTP Accounts |
| `FTP_USERNAME` | FTP username from the same page |
| `FTP_PASSWORD` | FTP password (set or change it on the same page) |
| `SMTP_USER` | `books@islamicarchives.org` (create it in hPanel → Emails) |
| `SMTP_PASSWORD` | that mailbox's password |

The FTP account must open in the website's `public_html` folder (Hostinger's default FTP account for a website does). Until the FTP secrets exist the workflow only builds; until the SMTP secrets exist the Send buttons show a polite "not switched on yet" message.

## Working locally

```
npm install
npm run dev      # live preview at http://localhost:4321
npm run build    # full build including search and downloads (needs pandoc and weasyprint)
```
