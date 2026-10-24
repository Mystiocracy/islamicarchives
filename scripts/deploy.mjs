// Publishes the site straight from this computer to Hostinger over FTP. GitHub is not involved.
//
//   npm run deploy            build everything, then upload only what changed
//   npm run deploy -- --dry   build, then only list what would change
//   npm run deploy -- --no-build   upload the existing dist/ without rebuilding
//   npm run deploy -- --full  upload every file again (ignore the server's record)
//
// How it knows what changed: after each deploy it stores `.deploy-manifest.json` (a SHA-1 for every
// file it uploaded) on the server. The next deploy compares dist/ with that record, uploads new or
// changed files, deletes files it uploaded earlier that no longer exist, and leaves everything else
// alone (api/config.php, api/vendor, mail settings, .htaccess edits made on the server, ...).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { posix, join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Writable } from 'node:stream';
import { Client } from 'basic-ftp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const MANIFEST = '.deploy-manifest.json';
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry'), FULL = args.has('--full'), NOBUILD = args.has('--no-build');
const PARALLEL = 4;
const NEVER = [/^api\/vendor\//, /^api\/config\.php$/, /^\.deploy-manifest\.json$/];

const die = (m) => { console.error('\n' + m + '\n'); process.exit(1); };

// ---- settings
const envFile = join(ROOT, '.deploy.env');
if (!existsSync(envFile)) die('Missing .deploy.env. Copy .deploy.env.example to .deploy.env and fill in the FTP details (see DEPLOY.md).');
const cfg = {};
for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !line.trim().startsWith('#')) cfg[m[1]] = m[2];
}
for (const k of ['FTP_HOST', 'FTP_USER', 'FTP_PASS']) if (!cfg[k]) die(`.deploy.env has no ${k}.`);
const BASE = (cfg.FTP_DIR || '.').replace(/\\/g, '/');
const SECURE = (cfg.FTP_SECURE || 'true') !== 'false';

// ---- build
if (!NOBUILD) {
  console.log('Building the site (this takes several minutes)...');
  const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) die('The build failed, so nothing was uploaded.');
}
if (!existsSync(join(DIST, 'index.html'))) die('dist/index.html is missing. Run without --no-build.');
if (!existsSync(join(DIST, 'hadith/narrators/m/0.json')))
  console.log('Note: the Sanadset hadith text files are not on this computer, so they will not be uploaded or changed.\n' +
    '      (To make them: python3 scripts/sanadset/build.py <path to the Sanadset csv>, then deploy again.)\n');

// ---- list and hash local files
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.isFile()) out.push(p);
  }
  return out;
}
const sha = (p) => new Promise((res, rej) => { const h = createHash('sha1'); createReadStream(p).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
console.log('Reading dist/ ...');
const local = new Map();
const files = walk(DIST).map((p) => ({ p, rel: relative(DIST, p).split(sep).join('/') })).filter((f) => !NEVER.some((re) => re.test(f.rel)));
for (let i = 0; i < files.length; i += 64)
  await Promise.all(files.slice(i, i + 64).map(async (f) => local.set(f.rel, { p: f.p, size: statSync(f.p).size, h: await sha(f.p) })));
console.log(`${local.size.toLocaleString()} files, ${(Array.from(local.values()).reduce((s, f) => s + f.size, 0) / 1e6).toFixed(0)} MB`);

// ---- connection helpers
async function connect() {
  const c = new Client(60000);
  await c.access({ host: cfg.FTP_HOST, port: Number(cfg.FTP_PORT || 21), user: cfg.FTP_USER, password: cfg.FTP_PASS, secure: SECURE, secureOptions: { rejectUnauthorized: false } });
  if (BASE !== '.' && BASE !== '') await c.cd(BASE);
  c.home = await c.pwd();
  return c;
}
let first;
try { first = await connect(); } catch (e) { die(`Could not log in to FTP (${e.message}).\nCheck FTP_HOST / FTP_USER / FTP_PASS in .deploy.env, and try FTP_SECURE=false if the connection is refused.`); }
const R = (rel) => rel; // paths are relative to the folder the login is moved into (FTP_DIR)

// ---- what the server already has
let remote = {};
if (!FULL) {
  try {
    const chunks = [];
    await first.downloadTo(new Writable({ write(ch, _e, cb) { chunks.push(ch); cb(); } }), R(MANIFEST));
    remote = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { console.log('No earlier deploy record on the server: every file will be uploaded.'); }
}
const up = [], del = [];
for (const [rel, f] of local) if (remote[rel] !== f.h) up.push(rel);
for (const rel of Object.keys(remote)) if (!local.has(rel) && !NEVER.some((re) => re.test(rel))) del.push(rel);
// pages last, so a visitor never gets a page that points to a file that has not arrived yet
up.sort((a, b) => (/\.html$/.test(a) - /\.html$/.test(b)) || a.localeCompare(b));
const mb = up.reduce((s, r) => s + local.get(r).size, 0) / 1e6;
console.log(`To upload: ${up.length.toLocaleString()} files (${mb.toFixed(1)} MB). To delete: ${del.length.toLocaleString()}.`);
if (DRY) { console.log('Dry run: nothing was changed.'); first.close(); process.exit(0); }
if (!up.length && !del.length) { console.log('The server is already up to date.'); first.close(); process.exit(0); }

// ---- upload
const dirs = new Set();
let done = 0, failed = [];
let queue = up.slice();
async function worker(client) {
  while (queue.length) {
    const rel = queue.shift();
    let ok = false;
    for (let t = 0; t < 4 && !ok; t++) {
      try {
        const d = posix.dirname(rel);
        if (d !== '.' && !dirs.has(d)) { await client.ensureDir(d); dirs.add(d); await client.cd(client.home); }
        await client.uploadFrom(local.get(rel).p, rel);
        ok = true;
      } catch (e) {
        try { client.close(); } catch {}
        await new Promise((r) => setTimeout(r, 1000 * (t + 1)));
        try { client = await connect(); } catch {}
      }
    }
    if (!ok) failed.push(rel);
    if (++done % 250 === 0 || done === up.length) process.stdout.write(`\r  uploaded ${done.toLocaleString()} / ${up.length.toLocaleString()}   `);
  }
  try { client.close(); } catch {}
}
if (up.length) {
  console.log('Uploading...');
  const pool = [first];
  for (let i = 1; i < Math.min(PARALLEL, up.length); i++) pool.push(await connect());
  await Promise.all(pool.map(worker));
  console.log('');
}
if (failed.length) die(`${failed.length} files did not upload (for example ${failed.slice(0, 3).join(', ')}).\nNothing was deleted and the deploy record was not updated; run npm run deploy again to retry.`);

// ---- delete old files, then write the record
const c = await connect();
for (const rel of del) { try { await c.remove(rel, true); } catch {} }
const next = {};
for (const [rel, f] of local) next[rel] = f.h;
for (const [rel, h] of Object.entries(remote)) if (!local.has(rel) && NEVER.some((re) => re.test(rel))) next[rel] = h;
await c.uploadFrom(Readable.from([Buffer.from(JSON.stringify(next))]), MANIFEST);
c.close();

// ---- check the live site
try {
  const r = await fetch('https://islamicarchives.org/', { cache: 'no-store' });
  console.log(`Live site answers: ${r.status}`);
} catch { console.log('Uploaded. (Could not check the live site from here.)'); }
console.log(`Done: ${up.length.toLocaleString()} uploaded, ${del.length.toLocaleString()} deleted.`);
