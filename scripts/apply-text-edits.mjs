// Applies the text edits made in /admin/ (Pages) to the built HTML in dist/.
// Edits live in src/data/text-edits.json: { "/page/": { title?, description?, nodes: [{ i, find, replace }] } }
// `i` is the position of a text node among the page's visible body text (the admin and this script count the same way);
// `find` is the text as the code produces it, and is checked before replacing, so an edit never lands on the wrong text.
// Runs after `astro build`, before the search index is made.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { bodyTextNodes } from './text-nodes.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const FILE = join(ROOT, 'src/data/text-edits.json');
if (!existsSync(FILE)) process.exit(0);
const edits = JSON.parse(readFileSync(FILE, 'utf8') || '{}');

const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escText(s).replace(/"/g, '&quot;');

let done = 0, warned = 0;
for (const [page, e] of Object.entries(edits)) {
  const rel = page.replace(/^\/+/, '').replace(/\/+$/, '');
  const file = resolve(DIST, rel, 'index.html');
  if (!file.startsWith(DIST) || !existsSync(file)) { console.warn(`text-edits: page ${page} not found in the build, skipped`); warned++; continue; }
  let html = readFileSync(file, 'utf8');
  const nodes = bodyTextNodes(html);
  const used = new Set(), jobs = [];
  for (const ed of e.nodes || []) {
    let n = nodes[ed.i];
    if (!(n && !used.has(n) && n.value.trim() === ed.find)) n = nodes.find((x) => !used.has(x) && x.value.trim() === ed.find);   // page changed: look for the same text elsewhere
    if (!n) { console.warn(`text-edits: ${page}: could not find “${ed.find.slice(0, 50)}”, edit skipped (the page text has changed)`); warned++; continue; }
    used.add(n); jobs.push({ s: n.sourceCodeLocation.startOffset, e: n.sourceCodeLocation.endOffset, replace: ed.replace });
  }
  jobs.sort((a, b) => b.s - a.s);
  for (const j of jobs) {
    const raw = html.slice(j.s, j.e);
    html = html.slice(0, j.s) + raw.match(/^\s*/)[0] + escText(j.replace) + raw.match(/\s*$/)[0] + html.slice(j.e);
    done++;
  }
  if (e.title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escText(e.title)}</title>`);
    html = html.replace(/<meta\b[^>]*?(?:name|property)="(?:og:title|twitter:title)"[^>]*>/g, (m) => m.replace(/content="[^"]*"/, () => `content="${escAttr(e.title)}"`));
  }
  if (e.description) html = html.replace(/<meta\b[^>]*?(?:name|property)="(?:description|og:description|twitter:description)"[^>]*>/g, (m) => m.replace(/content="[^"]*"/, () => `content="${escAttr(e.description)}"`));
  writeFileSync(file, html);
}
console.log(`text-edits: ${done} text edit${done === 1 ? '' : 's'} applied${warned ? `, ${warned} warning${warned === 1 ? '' : 's'}` : ''}`);
