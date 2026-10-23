// RSS feed of what was added to the archive: one item per author per day.
import { updatesByDay } from '../lib/updates';

const SITE = 'https://islamicarchives.org';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  const days = await updatesByDay();
  const items: string[] = [];
  outer: for (const d of days) {
    for (const b of d.batches) {
      if (items.length >= 60) break outer;
      const name = b.author.data.name;
      const n = b.works.length;
      const title = b.newAuthor
        ? `New author: ${name}${n ? ` (${n} ${n === 1 ? 'work' : 'works'})` : ''}`
        : `${name}: ${n} ${n === 1 ? 'work' : 'works'} added`;
      const list = b.works.slice(0, 8).map((w) => w.data.title);
      const more = n > 8 ? ` and ${n - 8} more` : '';
      const desc = (b.newAuthor && b.author.data.roles ? `${b.author.data.roles}. ` : '') + (list.length ? `Added: ${list.join('; ')}${more}.` : 'Biography archived.');
      items.push(`<item><title>${esc(title)}</title><link>${SITE}/authors/${b.author.id}/</link><guid isPermaLink="false">${d.date}-${b.author.id}</guid><pubDate>${new Date(d.date + 'T12:00:00Z').toUTCString()}</pubDate><description>${esc(desc)}</description></item>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0"><channel><title>Islamic Internet Archives: recently added</title><link>${SITE}/new/</link><description>New authors and works in the Archive of Modern Islamic Thought.</description><language>en</language>${days[0] ? `<lastBuildDate>${new Date(days[0].date + 'T12:00:00Z').toUTCString()}</lastBuildDate>` : ''}\n${items.join('\n')}\n</channel></rss>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
