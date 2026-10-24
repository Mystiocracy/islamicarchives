// Fills the Quran section pills on the Word Corpus page (a hand-built page) from src/data/quran-nav.json,
// so they always match the other Quran Hub pages. Runs after `astro build`.
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FILE = join(ROOT, 'dist/quran/corpus/index.html');
if (!existsSync(FILE)) process.exit(0);
const items = JSON.parse(readFileSync(join(ROOT, 'src/data/quran-nav.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const links = items.map((i) => `<a href="${esc(i.href)}"${i.key === 'corpus' ? ' aria-current="page"' : ''}>${esc(i.label)}</a>`).join('');
const html = readFileSync(FILE, 'utf8');
const a = html.indexOf('<!--qsub-->'), b = html.indexOf('<!--/qsub-->');
if (a < 0 || b < a) { console.warn('sync-quran-nav: markers not found in the Word Corpus page, pills left as they are'); process.exit(0); }
writeFileSync(FILE, html.slice(0, a) + `<!--qsub--><nav class="qsub" aria-label="Quran section"><div class="qsub-in">\n  ${links}\n</div></nav><!--/qsub-->` + html.slice(b + '<!--/qsub-->'.length));
console.log('sync-quran-nav: Word Corpus pills updated');
