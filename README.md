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

Each push to `main` builds the site and writes the finished files to the `deploy` branch.
Hostinger's Git deployment (hPanel → Websites → islamicarchives.org → Dashboard → Advanced → GIT)
pulls the `deploy` branch into `public_html`, and its auto-deployment webhook (added in GitHub →
Settings → Webhooks) makes that happen after every build.

**Send to Kindle / email:** create the mailbox books@islamicarchives.org in hPanel → Emails, then in
hPanel → File Manager create `public_html/api/config.php` containing:

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

The file is never served to visitors (see `.htaccess`) and is not in the repository. Until it exists,
the Send buttons show a polite "not switched on yet" message.

## Working locally

```
npm install
npm run dev      # live preview at http://localhost:4321
npm run build    # full build including search and downloads (needs pandoc and weasyprint)
```
