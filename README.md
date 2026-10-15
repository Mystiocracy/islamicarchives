# Islamic Archives – Archive of Modern Islamic Thought

The website for **islamicarchives.org**: a free, searchable archive of writings by modern Muslim thinkers, with downloads in EPUB, PDF, Word and plain text, and Send to Kindle / email delivery.

## Adding and editing content

**Easiest: the admin page.** Go to <https://app.pagescms.org>, sign in with GitHub and open this repository. You'll see **Works** and **Authors**.

- *Add an author:* Authors → Add entry → fill in the name, dates, region and a short biography → Save.
- *Add a work:* Works → Add entry → choose the author, fill in the details, pick the **Rights status**, then:
  - **Public domain** or **Permission granted**: paste the full text into *Full text*. The site will host it and generate the downloads.
  - **In copyright – link only**: leave *Full text* empty and put the publisher's free link in *Link to free copy*.
- *Add a photo:* Authors → pick the author → **Photo** → upload → Save. It appears in a circle on the home-page ticker, the A–Z list and the author's page. (Or drop `<author-id>.jpg` into `public/authors/`.) Authors without a photo show their initials.
- Press **Save**. The site rebuilds and goes live in about two minutes.

**Books read chapter by chapter.** For a long book you already have as a finished EPUB, run
`python3 scripts/epub-to-reader.py BOOK.epub WORK_ID [--scan SCAN_PDF_URL --offsets "roman:-6,1-62:+22,65-:+20"]`
and set `reader: true` on the work. This writes one page per chapter into `content/chapters/WORK_ID/`, copies the EPUB to
`public/downloads/WORK_ID.epub` (the Word, PDF and text downloads are made from it), and links each printed page number
to that page of the scan. The book's page then opens with its contents, and every chapter page links back to it.

Each work is a Markdown file in `content/works/`, and each author is one in `content/authors/`, so you can also add or edit files directly on GitHub.

## How the site is built

- [Astro](https://astro.build) turns the files in `content/` into pages (`src/pages/`).
- [Pagefind](https://pagefind.app) builds the full-text search index.
- `scripts/make-downloads.mjs` uses pandoc (and WeasyPrint for PDF) to make the downloads into `dist/downloads/`.
- `public/api/send.php` emails a download to a reader's Kindle or inbox through the Hostinger mailbox books@islamicarchives.org.
- `.github/workflows/deploy.yml` builds everything on each push to `main` and publishes it to the `deploy` branch, which Hostinger pulls into the website.

## One-time setup (Hostinger)

Each push to `main` builds the site and writes the finished files to the `deploy` branch.
Hostinger's Git deployment (hPanel → Websites → islamicarchives.org → Dashboard → Advanced → GIT)
pulls the `deploy` branch into `public_html`, and its auto-deployment webhook (added in GitHub →
Settings → Webhooks) makes that happen after every build.

**Send to Kindle / email:** create the mailbox books@islamicarchives.org in hPanel → Emails, then in
hPanel → File Manager, open `domains/islamicarchives.org/` (the folder that contains `public_html`, not inside it) and create `mail-config.php` containing:

```php
<?php
return [
  "smtp_host" => "smtp.hostinger.com",
  "smtp_port" => 465,
  "smtp_user" => "books@islamicarchives.org",
  "smtp_password" => "THE MAILBOX PASSWORD",
  "from_name" => "Islamic Archives",
];
```

Being outside `public_html`, the file is never served to visitors, is not in the repository, and survives every deploy. (`public_html/api/config.php` still works as a fallback.) Until it exists,
the Send buttons show a polite "not switched on yet" message.

## Working locally

```
npm install
npm run dev      # live preview at http://localhost:4321
npm run build    # full build including search and downloads (needs pandoc and weasyprint)
```
