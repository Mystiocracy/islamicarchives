// Islamic Archives admin: edits the site's content files in GitHub and publishes them as one commit.
// No server: the browser talks to the GitHub API with a fine-grained token you paste in once.
import * as YAML from './yaml.js';

const REPO = 'Mystiocracy/islamicarchives';
const BRANCH = 'main';
const API = 'https://api.github.com';
const PHOTO_EXT = ['jpg', 'jpeg', 'png', 'webp'];

// ---------- tiny helpers ----------
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
let toastTimer;
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), err ? 7000 : 3500);
}
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʿʾ'’`]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const pretty = (slug) => slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const initials = (n) => n.replace(/\(.*?\)/g, '').split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const store = () => (localStorage.getItem('ia_token') ? localStorage : sessionStorage);
const safe = (fn) => { try { return fn(); } catch { return null; } };

// ---------- GitHub ----------
let token = safe(() => localStorage.getItem('ia_token') || sessionStorage.getItem('ia_token'));
async function gh(path, opts = {}) {
  const r = await fetch(path.startsWith('http') ? path : `${API}/repos/${REPO}${path}`, {
    ...opts,
    headers: { Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) {
    let m = ''; try { m = (await r.json()).message; } catch {}
    const e = new Error(r.status === 401 ? 'GitHub rejected the token. Sign in again with a new one.' : r.status === 403 || r.status === 404 ? `GitHub says no (${r.status}). Check the token has "Contents: Read and write" on ${REPO}. ${m || ''}` : `GitHub error ${r.status}: ${m}`);
    e.status = r.status; throw e;
  }
  return opts.raw ? r : r.status === 204 ? null : r.json();
}

// ---------- state ----------
const S = {
  head: null, baseTree: null, tree: new Map(),   // path -> {sha}
  index: null,                                   // site search index (labels)
  texts: new Map(),                              // path -> text (original)
  pending: new Map(),                            // path -> {text} | {b64, preview} | {del:true}
  view: 'dashboard', user: null,
};
const dirty = () => S.pending.size > 0;
window.addEventListener('beforeunload', (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

async function loadRepo() {
  const ref = await gh(`/git/ref/heads/${BRANCH}`);
  S.head = ref.object.sha;
  const c = await gh(`/git/commits/${S.head}`);
  S.baseTree = c.tree.sha;
  const t = await gh(`/git/trees/${S.baseTree}?recursive=1`);
  if (t.truncated) toast('The repository is very large; some files may be missing from the lists.', true);
  S.tree = new Map(t.tree.filter((x) => x.type === 'blob').map((x) => [x.path, { sha: x.sha }]));
  S.texts.clear();
  try { S.index = await (await fetch('/search-index.json', { cache: 'no-store' })).json(); } catch { S.index = { a: [], s: [], w: [] }; }
}
async function getText(path) {
  if (S.pending.has(path) && S.pending.get(path).text != null) return S.pending.get(path).text;
  if (S.texts.has(path)) return S.texts.get(path);
  const f = S.tree.get(path); if (!f) return null;
  const r = await gh(`/git/blobs/${f.sha}`, { raw: true });
  const text = await r.text(); S.texts.set(path, text); return text;
}
const exists = (p) => (S.pending.has(p) ? !S.pending.get(p).del : S.tree.has(p));

function parseDoc(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text || '');
  return m ? { data: YAML.parse(m[1]) || {}, body: m[2] } : { data: {}, body: text || '' };
}
function stringifyDoc(data, body) {
  const y = YAML.stringify(data, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' }).trimEnd();
  return `---\n${y}\n---\n${body || ''}`;
}

// ---------- schemas (mirror .pages.yml and src/content.config.ts) ----------
const TYPES = ['Book', 'Pamphlet', 'Article', 'Chapter', 'Essay', 'Policy paper', 'Speech', 'Review', 'Collection', 'Anthology', 'Translation', 'Novel', 'Memoir', 'Letters', 'Bibliography', 'Interview', 'Paper', 'Video'];
const LANGS = ['English', 'Arabic', 'Urdu', 'Persian', 'Bengali', 'Hindi', 'French', 'Turkish', 'Malay', 'Bosnian', 'Malayalam', 'Other'];
const KINDS = {
  authors: { label: 'Authors', one: 'author', dir: 'content/authors', title: 'name', fields: [
    ['name', 'Name', 'string', { req: 1 }], ['nameNative', 'Name in original script', 'string'],
    ['nativeLang', 'Original script language', 'select', { options: ['', 'ar', 'ur', 'fa'] }],
    ['born', 'Year born', 'number'], ['died', 'Year died (empty if living)', 'number'],
    ['region', 'Region', 'string'], ['roles', 'Roles', 'string', { hint: 'e.g. Poet, philosopher, lawyer' }],
    ['sortAs', 'Sort as (A–Z list)', 'string', { hint: 'Name to file the author under, e.g. Taha' }],
    ['featured', 'Feature on the home page', 'bool'], ['draft', 'Hide this author and all their works', 'bool'],
    ['sources', 'Biography sources (one link per line)', 'list', { wide: 1 }],
    ['@body', 'Short biography', 'body', { wide: 1 }]] },
  works: { label: 'Works', one: 'work', dir: 'content/works', title: 'title', fields: [
    ['title', 'Title', 'string', { req: 1, wide: 1 }],
    ['author', 'Author', 'ref', { req: 1, ref: 'authors' }], ['coAuthors', 'Co-authors (if any)', 'string'],
    ['byline', 'Byline (writer, when filed under an institution)', 'string'], ['titleOriginal', 'Title in original script', 'string'],
    ['year', 'Year first published', 'number'], ['language', 'Language', 'combo', { options: LANGS }],
    ['type', 'Type', 'select', { options: TYPES }],
    ['rights', 'Rights status', 'select', { req: 1, options: [['public-domain', 'Public domain – host the full text'], ['permission', 'Permission granted – host the full text'], ['link-only', 'In copyright – link to the free copy only']] }],
    ['subjects', 'Subjects', 'refs', { ref: 'subjects', wide: 1 }],
    ['keywords', 'Keywords (one per line)', 'list', { wide: 1 }],
    ['venue', 'Where it was published', 'string'], ['rightsNote', 'Rights note', 'string'],
    ['summary', 'Summary', 'text', { wide: 1 }],
    ['sourceUrl', 'Link to free copy (Read at source)', 'string'], ['sourceLabel', 'Name of the source website', 'string'],
    ['infoUrl', 'Catalogue or publisher page', 'string'], ['sourceEdition', 'Source edition used for the text', 'string'],
    ['sourceNote', 'Extra source note', 'text', { wide: 1 }], ['contents', 'Chapter list (one per line)', 'list', { wide: 1 }],
    ['added', 'Date added to the archive', 'date'], ['reader', 'Read chapter by chapter (text lives in content/chapters)', 'bool'],
    ['draft', 'Hide from the site (draft)', 'bool'],
    ['@body', 'Full text (leave empty for link-only works)', 'body', { wide: 1 }]] },
  subjects: { label: 'Subjects', one: 'subject', dir: 'content/subjects', title: 'name', fields: [
    ['name', 'Subject name', 'string', { req: 1 }], ['order', 'Position in lists (1 = first)', 'number'],
    ['featured', 'Show on the home page', 'bool'], ['draft', 'Hide this subject', 'bool'], ['@body', 'Short description', 'body', { wide: 1 }]] },
  eras: { label: 'Eras', one: 'era', dir: 'content/eras', title: 'name', fields: [
    ['name', 'Era name', 'string', { req: 1 }], ['from', 'First year', 'number', { req: 1 }], ['to', 'Last year (9999 = today)', 'number', { req: 1 }],
    ['order', 'Order', 'number'], ['draft', 'Hide this era', 'bool'], ['@body', 'Short description', 'body', { wide: 1 }]] },
};

// ---------- form builder ----------
function labelOf(kind, id) {
  const idx = S.index || {};
  const pick = kind === 'authors' ? idx.a : kind === 'subjects' ? idx.s : kind === 'works' ? idx.w : null;
  const hit = (pick || []).find((x) => x[1] === `/${kind}/${id}/`);
  return hit ? hit[0] : pretty(id);
}
const idsOf = (kind) => [...S.tree.keys()].filter((p) => p.startsWith(KINDS[kind].dir + '/') && p.endsWith('.md')).map((p) => p.slice(KINDS[kind].dir.length + 1, -3));
const idOfRef = (v) => (typeof v === 'string' ? v.replace(/^.*\//, '').replace(/\.md$/, '') : v);

function buildField(spec, data, body) {
  const [key, label, type, o = {}] = spec;
  const val = key === '@body' ? body : data[key];
  let input, get;
  const id = 'f_' + key.replace('@', '');
  if (type === 'bool') {
    input = h('input', { type: 'checkbox', id }); input.checked = !!val; get = () => input.checked;
    return { key, wide: o.wide, el: h('div', { class: 'f' }, h('label', { class: 'check', for: id }, input, label)), get, empty: (v) => !v };
  }
  if (type === 'string' || type === 'combo') {
    input = h('input', { type: 'text', id, value: val ?? '', list: type === 'combo' ? id + '_l' : null });
    get = () => input.value.trim();
  } else if (type === 'number') {
    input = h('input', { type: 'number', id, value: val ?? '' }); get = () => (input.value === '' ? undefined : Number(input.value));
  } else if (type === 'date') {
    input = h('input', { type: 'date', id, value: val ? String(val instanceof Date ? val.toISOString() : val).slice(0, 10) : '' }); get = () => input.value;
  } else if (type === 'text' || type === 'body') {
    input = h('textarea', { id, rows: type === 'body' ? 16 : 3, class: type === 'body' ? 'mono' : '' }); input.value = val ?? ''; get = () => input.value;
  } else if (type === 'list') {
    input = h('textarea', { id, rows: 3 }); input.value = Array.isArray(val) ? val.join('\n') : ''; get = () => input.value.split('\n').map((s) => s.trim()).filter(Boolean);
  } else if (type === 'select') {
    const opts = o.req || (o.options || []).includes('') ? o.options : [['', '— default —'], ...o.options];
    input = h('select', { id }, (opts || []).map((op) => { const [v, l] = Array.isArray(op) ? op : [op, op || '—']; return h('option', { value: v }, l); }));
    input.value = val ?? ''; if (input.value !== String(val ?? '')) { input.append(h('option', { value: val }, val)); input.value = val; }
    get = () => input.value;
  } else if (type === 'ref') {
    const cur = idOfRef(val);
    const ids = new Set(idsOf(o.ref)); if (cur) ids.add(cur);
    const opts = [...ids].map((i) => [i, labelOf(o.ref, i)]).sort((a, b) => a[1].localeCompare(b[1]));
    input = h('select', { id }, h('option', { value: '' }, '— choose —'), opts.map(([i, l]) => h('option', { value: i }, l)));
    input.value = cur || ''; get = () => input.value;
  } else if (type === 'refs') {
    const cur = new Set((val || []).map(idOfRef));
    const all = new Set([...idsOf(o.ref), ...cur]);
    const boxes = [...all].map((i) => [i, labelOf(o.ref, i)]).sort((a, b) => a[1].localeCompare(b[1])).map(([i, l]) => { const c = h('input', { type: 'checkbox', value: i }); c.checked = cur.has(i); return h('label', {}, c, l); });
    input = h('div', { class: 'multi', id }, boxes);
    get = () => [...input.querySelectorAll('input:checked')].map((c) => c.value);
  }
  const wrap = h('div', { class: 'f' + (o.wide ? ' wide' : '') }, h('label', { for: id }, label, o.req ? h('span', { class: 'req' }, ' *') : ''), input, o.hint ? h('span', { class: 'hint' }, o.hint) : null);
  if (type === 'combo') wrap.append(h('datalist', { id: id + '_l' }, o.options.map((x) => h('option', { value: x }))));
  return { key, wide: o.wide, el: wrap, get, req: o.req };
}

// ---------- shell ----------
const app = $('#app');
function shell(content) {
  const n = S.pending.size;
  app.replaceChildren(
    h('header', { class: 'top' }, h('div', { class: 'top-in' },
      h('h1', {}, 'Islamic Archives · Admin'),
      h('a', { href: '/', target: '_blank', rel: 'noopener' }, 'View site ↗'),
      h('button', { class: 'btn ' + (n ? 'btn-saffron' : 'btn-quiet'), onclick: () => go('changes') }, 'Changes ', h('span', { class: 'badge' }, String(n))),
      h('button', { class: 'btn btn-quiet', onclick: signOut }, 'Sign out'))),
    h('nav', { class: 'tabs' }, h('div', { class: 'tabs-in' },
      [['dashboard', 'Dashboard'], ['authors', 'Authors'], ['works', 'Works'], ['subjects', 'Subjects'], ['eras', 'Eras'], ['data', 'Data files']].map(([v, l]) =>
        h('button', { class: 'tab', 'aria-current': String(S.view === v), onclick: () => go(v) }, l)))),
    h('main', {}, content));
  window.scrollTo(0, 0);
}
function go(view, arg) {
  S.view = view; S.arg = arg;
  if (view === 'dashboard') return viewDashboard();
  if (KINDS[view]) return viewList(view);
  if (view === 'data') return viewData();
  if (view === 'changes') return viewChanges();
}
const confirmLeave = () => true;

// ---------- sign in ----------
function viewLogin(err) {
  const inp = h('input', { type: 'password', id: 'tok', placeholder: 'github_pat_…', autocomplete: 'off' });
  const rem = h('input', { type: 'checkbox', id: 'rem' }); rem.checked = true;
  app.replaceChildren(h('div', { class: 'login' },
    h('h1', {}, 'Islamic Archives admin'),
    h('p', { class: 'muted', style: 'margin:0' }, 'Edit authors, works, subjects and photos here, then publish. Changes go to your GitHub repository and the site rebuilds by itself.'),
    h('div', { class: 'card pad', style: 'display:flex;flex-direction:column;gap:14px' },
      h('b', {}, 'One-time setup: create an access token'),
      h('ol', {}, h('li', {}, 'Open ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'GitHub → fine-grained token'), '.'),
        h('li', {}, 'Repository access: “Only select repositories” → ', h('b', {}, REPO), '.'),
        h('li', {}, 'Permissions → Repository → ', h('b', {}, 'Contents: Read and write'), '. Nothing else.'),
        h('li', {}, 'Generate, copy, and paste it below.')),
      err ? h('div', { class: 'note', style: 'background:#fbeceb;border-color:#e3b9b5;color:#6f1a15' }, err) : null,
      h('div', { class: 'f' }, h('label', { for: 'tok' }, 'GitHub token'), inp),
      h('label', { class: 'check', for: 'rem' }, rem, 'Remember on this device'),
      h('button', { class: 'btn', onclick: async (ev) => { token = inp.value.trim(); if (!token) return; ev.target.disabled = true; safe(() => { localStorage.removeItem('ia_token'); sessionStorage.removeItem('ia_token'); (rem.checked ? localStorage : sessionStorage).setItem('ia_token', token); }); await boot(); } }, 'Sign in')),
    h('div', { class: 'note' }, 'The token stays in this browser only. Use it on your own devices, and delete it on GitHub if a device is lost. Anyone opening this page without it can see nothing and change nothing.')));
}
function signOut() {
  if (dirty() && !confirm('You have unpublished changes. Sign out and lose them?')) return;
  safe(() => { localStorage.removeItem('ia_token'); sessionStorage.removeItem('ia_token'); }); token = null; S.pending.clear(); viewLogin();
}

// ---------- dashboard ----------
const hasPhoto = (id) => PHOTO_EXT.some((e) => exists(`public/authors/${id}.${e}`));
function avatar(id, name) {
  const a = h('span', { class: 'av' }, initials(name));
  const pend = S.pending.get(`public/authors/${id}.jpg`);
  const src = pend && pend.preview ? pend.preview : hasPhoto(id) ? `/authors/${id}.jpg?${S.head?.slice(0, 7)}` : null;
  if (src) { const img = h('img', { src, alt: '', loading: 'lazy' }); img.onerror = () => img.remove(); a.replaceChildren(img); }
  return a;
}
async function viewDashboard() {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, idsOf(k).length]));
  const noPhoto = idsOf('authors').filter((id) => !hasPhoto(id));
  let commits = [];
  try { commits = await gh(`/commits?sha=${BRANCH}&per_page=5`); } catch {}
  shell([
    h('div', { class: 'grid4' }, Object.entries(KINDS).map(([k, v]) => h('button', { class: 'card stat', onclick: () => go(k) }, h('b', {}, String(counts[k])), h('span', {}, v.label)))),
    h('section', { class: 'card pad', style: 'display:flex;flex-direction:column;gap:12px' },
      h('h2', { style: 'font-size:22px' }, `Authors without a photo (${noPhoto.length})`),
      h('p', { class: 'muted small', style: 'margin:0' }, 'Click an author, drop a picture on the photo box, then publish. It appears in a circle on the home page, the A–Z list and their page.'),
      h('div', { class: 'chips' }, noPhoto.map((id) => h('button', { class: 'chip', onclick: () => editEntry('authors', id) }, avatar(id, labelOf('authors', id)), labelOf('authors', id))))),
    h('section', { class: 'card pad', style: 'display:flex;flex-direction:column;gap:10px' },
      h('h2', { style: 'font-size:22px' }, 'Recent publishes'),
      commits.map((c) => h('div', { class: 'small' }, h('b', {}, new Date(c.commit.author.date).toLocaleString()), ' · ', c.commit.message.split('\n')[0])),
      h('p', { class: 'small muted', style: 'margin:6px 0 0' }, 'After each publish the site rebuilds in about 2–4 minutes. ', h('a', { href: `https://github.com/${REPO}/actions`, target: '_blank', rel: 'noopener' }, 'Watch the build ↗'))),
  ]);
}

// ---------- lists ----------
async function viewList(kind) {
  const K = KINDS[kind];
  let limit = 120;
  const q = h('input', { type: 'search', placeholder: `Search ${K.label.toLowerCase()}…`, 'aria-label': 'Search' });
  const noPhotoOnly = h('input', { type: 'checkbox', id: 'np' });
  const listEl = h('div', { class: 'card' });
  const rowsFor = () => {
    const ids = new Set(idsOf(kind));
    for (const [p, v] of S.pending) if (p.startsWith(K.dir + '/') && !v.del) ids.add(p.slice(K.dir.length + 1, -3));
    const idx = S.index || {};
    const info = new Map((kind === 'works' ? idx.w : []).map((x) => [x[1], x]));
    let rows = [...ids].map((id) => {
      const path = `${K.dir}/${id}.md`, pend = S.pending.get(path);
      const w = info.get(`/works/${id}/`);
      return { id, path, title: kind === 'works' ? (w ? w[0] : pretty(id)) : labelOf(kind, id), sub: kind === 'works' && w ? [w[3], w[4]].filter(Boolean).join(' · ') : id, pend, hay: (id + ' ' + (w ? w.join(' ') : labelOf(kind, id))).toLowerCase() };
    });
    for (const [p, v] of S.pending) if (v.del && p.startsWith(K.dir + '/')) { const id = p.slice(K.dir.length + 1, -3); if (!ids.has(id)) rows.push({ id, path: p, title: labelOf(kind, id), sub: id, pend: v, hay: id }); }
    const term = q.value.trim().toLowerCase();
    if (term) rows = rows.filter((r) => term.split(/\s+/).every((t) => r.hay.includes(t)));
    if (kind === 'authors' && noPhotoOnly.checked) rows = rows.filter((r) => !hasPhoto(r.id));
    return rows.sort((a, b) => (kind === 'eras' ? a.id.localeCompare(b.id) : a.title.localeCompare(b.title)));
  };
  const paint = () => {
    const rows = rowsFor();
    listEl.replaceChildren(...rows.slice(0, limit).map((r) => h('button', { class: 'row', onclick: () => editEntry(kind, r.id) },
      kind === 'authors' ? avatar(r.id, r.title) : null,
      h('span', { class: 't' }, h('b', {}, r.title), h('span', {}, r.sub)),
      r.pend ? h('span', { class: 'tag ' + (r.pend.del ? 'del' : S.tree.has(r.path) ? '' : 'new') }, r.pend.del ? 'to delete' : S.tree.has(r.path) ? 'edited' : 'new') : null)),
      rows.length > limit ? h('button', { class: 'row', style: 'justify-content:center;color:var(--green);font-weight:600', onclick: () => { limit += 200; paint(); } }, `Show more (${rows.length - limit} left)`) : null,
      rows.length ? null : h('p', { class: 'pad muted', style: 'margin:0' }, 'Nothing found.'));
    count.textContent = `${rows.length} shown`;
  };
  const count = h('span', { class: 'muted small' });
  q.addEventListener('input', () => { limit = 120; paint(); }); noPhotoOnly.addEventListener('change', paint);
  shell([
    h('h2', { style: 'font-size:28px' }, K.label),
    h('div', { class: 'toolbar' }, q,
      kind === 'authors' ? h('label', { class: 'check', for: 'np', style: 'font-weight:500' }, noPhotoOnly, 'No photo yet') : null,
      count, h('button', { class: 'btn', onclick: () => editEntry(kind, null) }, `+ New ${K.one}`)),
    listEl]);
  paint();
}

// ---------- entry editor ----------
async function editEntry(kind, id) {
  const K = KINDS[kind];
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const path = id ? `${K.dir}/${id}.md` : null;
  let doc = { data: {}, body: '' };
  try { if (path) doc = parseDoc(await getText(path)); } catch (e) { toast(e.message, true); return go(kind); }
  const fields = K.fields.map((f) => buildField(f, doc.data, doc.body));
  const known = new Set(K.fields.map((f) => f[0]));
  const extras = Object.keys(doc.data).filter((k) => !known.has(k));
  const newId = h('input', { type: 'text', id: 'newid', placeholder: 'auto from the name/title', value: '' });
  let photoUI = null;
  if (kind === 'authors' && id) photoUI = photoBox(id, doc);

  const stage = () => {
    for (const f of fields) if (f.req && (f.get() === '' || f.get() == null)) { toast(`“${f.key}” is required.`, true); $('#f_' + f.key).focus(); return; }
    const data = { ...doc.data }; let body = doc.body;
    for (const f of fields) {
      const v = f.get();
      if (f.key === '@body') { body = v; continue; }
      const empty = v === undefined || v === '' || (Array.isArray(v) && !v.length) || (v === false && !(f.key in doc.data));
      if (empty) delete data[f.key]; else data[f.key] = v;
    }
    // keep the field order tidy: schema fields first, anything else after
    const ordered = {}; for (const f of K.fields) if (f[0] in data) ordered[f[0]] = data[f[0]];
    for (const k of Object.keys(data)) if (!(k in ordered)) ordered[k] = data[k];
    let finalId = id;
    if (!finalId) {
      finalId = slugify(newId.value) || slugify(kind === 'works' ? `${ordered.author || ''} ${ordered.title || ''}`.slice(0, 90) : String(ordered[K.title] || ''));
      if (!finalId) return toast('Could not make a file name; type one in “File name”.', true);
      if (exists(`${K.dir}/${finalId}.md`)) return toast(`A ${K.one} with the file name “${finalId}” already exists.`, true);
    }
    const p = `${K.dir}/${finalId}.md`, text = stringifyDoc(ordered, body);
    if (S.tree.has(p) && (S.texts.get(p) === text)) S.pending.delete(p); else S.pending.set(p, { text });
    toast('Added to your changes. Publish when you are ready.');
    go(kind);
  };
  const del = () => {
    if (!confirm(`Delete this ${K.one}? It is removed when you publish.${kind === 'authors' ? ' Their works must be reassigned or deleted too, or the site build will fail.' : ''}`)) return;
    if (S.tree.has(path)) S.pending.set(path, { del: true }); else S.pending.delete(path);
    go(kind);
  };
  shell([
    h('div', { class: 'crumb' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); go(kind); } }, '← ' + K.label)),
    h('h2', { style: 'font-size:28px' }, id ? labelOf(kind, id) : `New ${K.one}`),
    id ? null : h('div', { class: 'f' }, h('label', { for: 'newid' }, 'File name (optional)'), newId, h('span', { class: 'hint' }, 'Letters, digits and hyphens. Becomes the web address and cannot be changed later.')),
    photoUI,
    h('div', { class: 'form card pad' }, fields.map((f) => f.el)),
    extras.length ? h('p', { class: 'muted small' }, 'Other fields kept as they are: ', extras.join(', ')) : null,
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: stage }, 'Add to changes'),
      h('button', { class: 'btn btn-quiet', onclick: () => go(kind) }, 'Cancel'),
      id ? h('a', { class: 'btn btn-quiet', target: '_blank', rel: 'noopener', href: `/${kind}/${id}/` }, 'View on site ↗') : null,
      id ? h('button', { class: 'btn btn-danger', style: 'margin-left:auto', onclick: del }, 'Delete') : null)]);
}

// ---------- photo upload ----------
async function cropToJpeg(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height), sx = (bmp.width - s) / 2, sy = bmp.height > bmp.width ? (bmp.height - s) * 0.15 : 0;
  const c = document.createElement('canvas'); c.width = c.height = 320;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 320, 320); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, sx, sy, s, s, 0, 0, 320, 320);
  const dataUrl = c.toDataURL('image/jpeg', 0.85);
  return { preview: dataUrl, b64: dataUrl.split(',')[1] };
}
async function creditsWithout(id) {
  const p = 'public/authors/credits.json';
  const t = await getText(p); if (t == null) return;
  const j = JSON.parse(t); if (!(id in j)) return;
  delete j[id]; S.pending.set(p, { text: JSON.stringify(j, null, 1) + '\n' });
}
function photoBox(id, doc) {
  const name = doc.data.name || id, jpg = `public/authors/${id}.jpg`;
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const big = h('div', { class: 'big' }, initials(name));
  const status = h('div', { class: 'small muted' });
  const paint = () => {
    const pend = S.pending.get(jpg);
    const src = pend && pend.preview ? pend.preview : hasPhoto(id) ? `/authors/${id}.jpg?${S.head?.slice(0, 7)}` : null;
    big.replaceChildren(src ? h('img', { src, alt: '' }) : initials(name));
    status.textContent = pend && pend.preview ? 'New photo ready. Press “Publish” in Changes to put it online.' : pend && pend.del ? 'Photo will be removed when you publish.' : hasPhoto(id) ? 'Shown in a circle on the site.' : 'No photo yet; the site shows initials.';
  };
  const take = async (f) => {
    if (!f || !f.type.startsWith('image/')) return toast('Please choose an image file (JPG, PNG or WebP).', true);
    try {
      S.pending.set(jpg, await cropToJpeg(f));
      for (const e of PHOTO_EXT) if (e !== 'jpg' && S.tree.has(`public/authors/${id}.${e}`)) S.pending.set(`public/authors/${id}.${e}`, { del: true });
      await creditsWithout(id);
      if (doc.data.photo) { const p = `${KINDS.authors.dir}/${id}.md`; const t = parseDoc(await getText(p)); delete t.data.photo; S.pending.set(p, { text: stringifyDoc(t.data, t.body) }); doc.data.photo = undefined; }
      paint(); $('.badge').textContent = String(S.pending.size);
    } catch (e) { toast('Could not read that image: ' + e.message, true); }
  };
  const box = h('div', { class: 'photo-box' }, big,
    h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
      h('b', {}, 'Photo'),
      h('span', { class: 'small muted' }, 'Drop a picture here or choose one. It is cropped to a square (faces stay near the top) and shrunk to about 15 KB.'),
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        h('button', { class: 'btn btn-quiet', onclick: () => file.click() }, 'Choose picture…'),
        h('button', { class: 'btn btn-danger', onclick: async () => {
          if (S.pending.get(jpg)?.preview) S.pending.delete(jpg);
          else for (const e of PHOTO_EXT) if (S.tree.has(`public/authors/${id}.${e}`)) S.pending.set(`public/authors/${id}.${e}`, { del: true });
          await creditsWithout(id); paint(); $('.badge').textContent = String(S.pending.size);
        } }, 'Remove photo')),
      status), file);
  file.addEventListener('change', () => take(file.files[0]));
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag'));
  box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('drag'); take(e.dataTransfer.files[0]); });
  paint(); return box;
}

// ---------- data files (JSON) ----------
async function viewData() {
  const files = [...S.tree.keys()].filter((p) => /^src\/data\/.+\.json$/.test(p));
  shell([h('h2', { style: 'font-size:28px' }, 'Data files'),
    h('p', { class: 'muted', style: 'margin:0' }, 'The JSON tables behind the Quran section. Edit carefully: the file must stay valid JSON.'),
    h('div', { class: 'card' }, files.map((p) => h('button', { class: 'row', onclick: () => editData(p) }, h('span', { class: 't' }, h('b', {}, p.split('/').pop()), h('span', {}, p)), S.pending.has(p) ? h('span', { class: 'tag' }, 'edited') : null)))]);
}
async function editData(p) {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const text = await getText(p);
  const ta = h('textarea', { rows: 28, class: 'mono', spellcheck: 'false' }); ta.value = text;
  shell([h('div', { class: 'crumb' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); go('data'); } }, '← Data files')),
    h('h2', { style: 'font-size:28px' }, p.split('/').pop()), ta,
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => { try { JSON.parse(ta.value); } catch (e) { return toast('Not valid JSON: ' + e.message, true); } if (ta.value === S.texts.get(p)) S.pending.delete(p); else S.pending.set(p, { text: ta.value }); toast('Added to your changes.'); go('data'); } }, 'Add to changes'),
      h('button', { class: 'btn btn-quiet', onclick: () => go('data') }, 'Cancel'))]);
}

// ---------- changes & publish ----------
function describe(p, v) {
  if (v.del) return ['to delete', 'del'];
  if (v.b64) return ['photo', ''];
  return S.tree.has(p) ? ['edited', ''] : ['new', 'new'];
}
function viewChanges() {
  const msg = h('input', { type: 'text', value: `Update archive via admin (${S.pending.size} file${S.pending.size === 1 ? '' : 's'})` });
  const entries = [...S.pending].sort((a, b) => a[0].localeCompare(b[0]));
  const btn = h('button', { class: 'btn btn-saffron', disabled: !entries.length, onclick: () => publish(msg.value.trim() || 'Update archive via admin', btn) }, 'Publish to the site');
  shell([h('h2', { style: 'font-size:28px' }, 'Your changes'),
    entries.length ? h('div', { class: 'card' }, entries.map(([p, v]) => { const [l, c] = describe(p, v); return h('div', { class: 'row', style: 'cursor:default' },
      v.preview ? h('span', { class: 'av' }, h('img', { src: v.preview, alt: '' })) : null,
      h('span', { class: 't' }, h('b', {}, p), h('span', {}, v.text ? `${Math.round(v.text.length / 1024 * 10) / 10} KB` : '')), h('span', { class: 'tag ' + c }, l),
      h('button', { class: 'btn btn-quiet', onclick: () => { S.pending.delete(p); viewChanges(); } }, 'Discard')); }))
      : h('p', { class: 'card pad muted', style: 'margin:0' }, 'Nothing waiting. Edit something and choose “Add to changes”.'),
    entries.length ? h('div', { class: 'card pad', style: 'display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'f' }, h('label', {}, 'Note for the history (optional)'), msg),
      h('p', { class: 'small muted', style: 'margin:0' }, 'Everything above goes online as one update, and the site rebuilds in about 2–4 minutes.'), h('div', {}, btn)) : null]);
}
async function publish(message, btn) {
  btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const tree = [];
      for (const [path, v] of S.pending) {
        if (v.del) { tree.push({ path, mode: '100644', type: 'blob', sha: null }); continue; }
        const b = await gh('/git/blobs', { method: 'POST', body: v.b64 ? { content: v.b64, encoding: 'base64' } : { content: v.text, encoding: 'utf-8' } });
        tree.push({ path, mode: '100644', type: 'blob', sha: b.sha });
      }
      const t = await gh('/git/trees', { method: 'POST', body: { base_tree: S.baseTree, tree } });
      const c = await gh('/git/commits', { method: 'POST', body: { message, tree: t.sha, parents: [S.head] } });
      try { await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: c.sha } }); break; }
      catch (e) { if (e.status !== 422 || attempt) throw e; const ref = await gh(`/git/ref/heads/${BRANCH}`); S.head = ref.object.sha; S.baseTree = (await gh(`/git/commits/${S.head}`)).tree.sha; }
    }
    const n = S.pending.size; S.pending.clear();
    await loadRepo();
    shell([h('h2', { style: 'font-size:28px' }, 'Published'), h('div', { class: 'card pad', style: 'display:flex;flex-direction:column;gap:12px' },
      h('p', { style: 'margin:0' }, `${n} file${n === 1 ? '' : 's'} sent to GitHub. The site is rebuilding and will show the changes in about 2–4 minutes.`),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, h('a', { class: 'btn', href: `https://github.com/${REPO}/actions`, target: '_blank', rel: 'noopener' }, 'Watch the build ↗'), h('button', { class: 'btn btn-quiet', onclick: () => go('dashboard') }, 'Back to dashboard')))]);
  } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Publish to the site'; }
}

// ---------- boot ----------
async function boot() {
  if (!token) return viewLogin();
  app.replaceChildren(h('p', { style: 'padding:40px' }, 'Connecting to GitHub…'));
  try { await loadRepo(); }
  catch (e) { safe(() => { localStorage.removeItem('ia_token'); sessionStorage.removeItem('ia_token'); }); token = null; return viewLogin(e.message); }
  go('dashboard');
}
boot();
