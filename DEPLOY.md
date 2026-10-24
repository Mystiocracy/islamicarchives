# Publishing the site from your computer

GitHub only keeps a backup of the code. The live site is published from your computer with one command; no build or deploy runs on GitHub any more.

## One-time setup (about 20 minutes)

1. **Install** (Windows: the installers or `winget`; Mac: `brew`):
   - Node.js 22 (nodejs.org)
   - Git (git-scm.com)
   - Python 3 (python.org)
   - pandoc (pandoc.org) and WeasyPrint (`pip install weasyprint`), which make the EPUB, Word and PDF downloads
2. **Get the code:** `git clone https://github.com/Mystiocracy/islamicarchives.git`, then in that folder `npm ci`.
3. **FTP login:** in hPanel → Files → FTP Accounts, find the host and username and set a password. Copy `.deploy.env.example` to `.deploy.env` and fill it in. `.deploy.env` is never uploaded to GitHub.
4. **Sanadset text** (once, and again only if the Sanadset data changes):
   `python scripts/sanadset/build.py "C:\Users\ABAG-93\Downloads\sanadset (1).csv"`
   This writes the ḥadīth text files into `public/hadith/narrators/m/` (about 330 MB, ignored by git). It takes about a minute.

## Every time you change the site

```
git pull                # only if the change was made somewhere else
npm run deploy
```

It builds the site, compares it with what is on the server, uploads only new or changed files, deletes files it uploaded earlier that no longer exist, and prints "Live site answers: 200". The first run uploads everything (about 520 MB); later runs are small.

- `npm run deploy -- --dry` shows what would change and uploads nothing.
- `npm run deploy -- --no-build` uploads the existing `dist/` folder without rebuilding.
- `npm run deploy -- --full` uploads every file again.

If a run stops half-way, run it again; it carries on.

## What it never touches

The mail settings and PHP library for Send to Kindle (`api/config.php`, `api/vendor/`), and anything else on the server that this script did not upload.

## Backup to GitHub

`git add -A && git commit -m "..." && git push` after changing things. This does not publish anything.

## Notes

- The page `/admin/` saves through GitHub. A change saved there lands in GitHub only; `git pull` it and deploy to publish it.
- The old GitHub build ("Build and deploy") is kept as a manual fallback only. Do not run it: it has no Sanadset text and would clear it from the server.
