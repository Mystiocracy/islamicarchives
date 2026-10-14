// Builds EPUB, PDF, Word and plain-text downloads for every hosted work, plus one EPUB per author.
// Runs after `astro build`; writes into dist/downloads/. Needs pandoc (and weasyprint for PDF).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import YAML from 'yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'dist', 'downloads');
const TMP = join(tmpdir(), 'ia-downloads');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const has = (cmd) => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } };
if (!has('pandoc')) { console.warn('make-downloads: pandoc not found, skipping downloads'); process.exit(0); }
const canPdf = has('weasyprint');
if (!canPdf) console.warn('make-downloads: weasyprint not found, PDFs will be skipped');

const read = (dir) => existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
  const raw = readFileSync(join(dir, f), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return { id: basename(f, '.md'), data: m ? YAML.parse(m[1]) : {}, body: m ? m[2] : raw };
}) : [];

const authors = Object.fromEntries(read(join(ROOT, 'content', 'authors')).map((a) => [a.id, a]));
const works = read(join(ROOT, 'content', 'works'))
  .filter((w) => !w.data.draft && w.data.rights !== 'link-only' && w.body.trim())
  .sort((a, b) => (a.data.year ?? 99999) - (b.data.year ?? 99999));

const EPUB_CSS = join(ROOT, 'scripts', 'epub.css');
const PDF_CSS = join(ROOT, 'scripts', 'pdf.css');
const run = (args) => execFileSync('pandoc', args, { stdio: ['ignore', 'ignore', 'inherit'] });

const idOf = (v) => String(v || '').replace(/^.*\//, '').replace(/\.md$/, '');

function meta(w) {
  const a = authors[idOf(w.data.author)];
  const name = a ? a.data.name : w.data.author;
  const rights = w.data.rights === 'public-domain' ? 'Public domain' : 'Published with permission of the rights holder';
  const url = `https://islamicarchives.org/works/${w.id}/`;
  return { title: w.data.title, author: name + (w.data.coAuthors ? ` and ${w.data.coAuthors}` : ''), date: w.data.year ? String(w.data.year) : undefined, lang: 'en',
    rights: `${rights}. ${w.data.sourceEdition ? 'Source: ' + w.data.sourceEdition + '. ' : ''}From Islamic Archives, ${url}` };
}

function writeSource(file, metadata, body) {
  writeFileSync(file, `---\n${YAML.stringify(metadata)}---\n\n${body}\n\n---\n\n*${metadata.rights}*\n`);
}

let n = 0;
for (const w of works) {
  const m = meta(w);
  const src = join(TMP, `${w.id}.md`);
  writeSource(src, m, w.body);
  const base = join(OUT, w.id);
  run([src, '-o', `${base}.epub`, '--toc', '--toc-depth=2', '--epub-chapter-level=2', '--css', EPUB_CSS, '--epub-title-page=true']);
  run([src, '-o', `${base}.docx`, '--toc']);
  run([src, '-t', 'plain', '--wrap=none', '-s', '-o', `${base}.txt`]);
  if (canPdf) run([src, '-o', `${base}.pdf`, '--pdf-engine=weasyprint', '--css', PDF_CSS, '-s', '--toc']);
  n++;
}

// one EPUB per author with every hosted work as a chapter
const byAuthor = {};
for (const w of works) (byAuthor[idOf(w.data.author)] ||= []).push(w);
for (const [id, ws] of Object.entries(byAuthor)) {
  const a = authors[id];
  const name = a ? a.data.name : id;
  const body = ws.map((w) => `# ${w.data.title}${w.data.year ? ' (' + w.data.year + ')' : ''}\n\n` + w.body.replace(/^(#+) /gm, '#$1 ')).join('\n\n');
  const src = join(TMP, `author-${id}.md`);
  writeSource(src, { title: `${name}: Writings`, author: name, lang: 'en', rights: 'Collected from Islamic Archives, https://islamicarchives.org/authors/' + id + '/. Each work keeps the rights status shown on its page.' }, body);
  run([src, '-o', join(OUT, `author-${id}.epub`), '--toc', '--toc-depth=1', '--css', EPUB_CSS, '--split-level=1']);
}
console.log(`make-downloads: ${n} works, ${Object.keys(byAuthor).length} author collections${canPdf ? '' : ' (no PDFs)'}`);
