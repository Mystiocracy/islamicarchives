// The page's visible body text nodes, in source order. public/admin/admin.js counts them the same way
// (same skipped tags), so an edit made in the admin finds the same node here.
import { parse } from 'parse5';

const SKIP = new Set(['script', 'style', 'noscript', 'textarea', 'template', 'svg', 'title']);

export function bodyTextNodes(html) {
  const doc = parse(html, { sourceCodeLocationInfo: true, scriptingEnabled: false });
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes || []) {
      if (c.nodeName === '#text') { if (c.value.trim() && c.sourceCodeLocation) out.push(c); }
      else if (c.childNodes && !SKIP.has(c.nodeName)) walk(c);
    }
  };
  const find = (n, name) => { for (const c of n.childNodes || []) { if (c.nodeName === name) return c; const r = find(c, name); if (r) return r; } };
  const body = find(doc, 'body');
  if (body) walk(body);
  return out;
}

