// Cloudflare Pages Function: POST /api/send  { slug, format, to }
// Emails a hosted work's download as an attachment, using the Resend email API.
// Needs these environment variables in Cloudflare Pages (Settings → Environment variables):
//   RESEND_API_KEY   – API key from resend.com, with islamicarchives.org verified as a sending domain
//   FROM_ADDRESS     – e.g. "Islamic Archives <books@islamicarchives.org>"
// Optional: a KV namespace bound as SEND_LIMITS to rate-limit sending per address.

const FORMATS = { epub: 'application/epub+zip', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const MAX_BYTES = 20 * 1024 * 1024; // keep attachments well under mail limits
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY || !env.FROM_ADDRESS) return json({ error: 'Sending is not switched on yet. Please download the file instead.' }, 503);

  let input;
  try { input = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const slug = String(input.slug || '');
  const format = String(input.format || 'epub');
  const to = String(input.to || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,120}$/.test(slug)) return json({ error: 'Unknown work.' }, 400);
  if (!FORMATS[format]) return json({ error: 'Unsupported format.' }, 400);
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to) || to.length > 254) return json({ error: 'Please enter a valid email address.' }, 400);
  const kindle = /@(free\.)?kindle\.com$/i.test(to);
  if (kindle && format !== 'epub') return json({ error: 'Kindle copies are sent as EPUB.' }, 400);

  // simple rate limit: 10 sends per address per day, if a KV namespace is bound
  if (env.SEND_LIMITS) {
    const key = `n:${to.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`;
    const used = parseInt((await env.SEND_LIMITS.get(key)) || '0', 10);
    if (used >= 10) return json({ error: 'Daily sending limit reached for this address. Please try again tomorrow.' }, 429);
    await env.SEND_LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  }

  const origin = new URL(request.url).origin;
  const file = await fetch(`${origin}/downloads/${slug}.${format}`);
  if (!file.ok) return json({ error: 'That file is not available.' }, 404);
  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return json({ error: 'This file is too large to send. Please download it instead.' }, 413);

  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const pageUrl = `${origin}/works/${slug}/`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.FROM_ADDRESS,
      to: [to],
      subject: kindle ? 'Islamic Archives delivery' : 'Your book from Islamic Archives',
      text: `Attached is the ${format.toUpperCase()} you asked for.\n\nWork page: ${pageUrl}\n\nYou received this because someone entered this address at islamicarchives.org. If that wasn't you, you can ignore this message.`,
      attachments: [{ filename: `${slug}.${format}`, content: btoa(bin), content_type: FORMATS[format] }],
    }),
  });
  if (!res.ok) return json({ error: 'Sorry, sending failed. Please try again later.' }, 502);
  return json({ ok: true });
}

export const onRequest = () => json({ error: 'Use POST.' }, 405);
