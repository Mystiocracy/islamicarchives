/* Isnad atlas: Sanadset 650K as a chart. Nothing but that dataset is used. No libraries.
   Data (built by scripts/sanadset/build.py): names-ar.json, names-en.json, books.json, chains.bin, same.json, m/<n>.json */
(function () {
  var BASE = '/hadith/narrators/';
  var root = document.getElementById('ia');
  if (!root) return;
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var fmt = function (n) { return Number(n).toLocaleString('en-GB'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ---------- data
  var AR = [], EN = [], BOOKS = [], SH = 256, SAME = null;
  var C = 0, NN = 0, NB = 0, off, ids, bk, hn, cnt, sumd;
  // ---------- state
  var bookSet = null, req = [], ordered = false, focus = 0, hist = [], sel = null, fcnt = null, view = 'flow', sameOn = false;
  var A = null; // aggregate for the focus narrator under the current filters
  var had = { list: null, shown: 0, title: '' };

  // ---------- helpers
  var DIA = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
  var arKey = function (s) { return s.replace(DIA, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئء]/g, '').replace(/\s+/g, ' ').trim(); };
  var enKey = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[ʿʾ’'`\-]/g, '').replace(/\s+/g, ' ').trim(); };
  var KA = null, KE = null;
  function buildKeys() { if (KA) return; KA = new Array(NN); KE = new Array(NN); for (var i = 0; i < NN; i++) { KA[i] = arKey(AR[i]); KE[i] = enKey(EN[i]); } }
  var isRel = {}, isAmb = {};
  function nm(i, cls) { return '<span lang="ar" dir="rtl" class="ar' + (cls ? ' ' + cls : '') + '">' + esc(AR[i]) + '</span>'; }
  function mark(i) { var g = SAME && SAME.g[i]; return sameOn && g && g.length ? '<span class="sm-mark" title="May be the same person as: ' + esc(g.slice(0, 3).map(function (x) { return AR[x[0]]; }).join(' · ')) + '">≈</span>' : ''; }

  // ---------- load
  function getJSON(u) { return fetch(BASE + u).then(function (r) { return r.json(); }); }
  Promise.all([getJSON('names-ar.json'), getJSON('names-en.json'), getJSON('books.json'), fetch(BASE + 'chains.bin').then(function (r) { return r.arrayBuffer(); }), getJSON('meta.json')]).then(function (r) {
    AR = r[0]; EN = r[1]; BOOKS = r[2]; SH = r[4].shard || 256; NN = AR.length;
    decode(r[3]);
    $('#iaload').remove();
    $('#iaFlowView').hidden = false;
    refilter();
    wireAll();
    var st = parseHash();
    focus = st.n < NN ? st.n : 0;
    render(false);
    getJSON('same.json').then(function (d) { SAME = d; d.r.forEach(function (i) { isRel[i] = 1; }); d.a.forEach(function (i) { isAmb[i] = 1; }); if (view === 'flow') { drawCard(); drawFlow(); } });
  }).catch(function () { var l = $('#iaload'); if (l) l.textContent = 'The atlas data could not be loaded. Please try again.'; });

  function decode(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf);
    C = dv.getUint32(4, true); NB = dv.getUint32(12, true);
    off = new Uint32Array(C + 1); bk = new Uint16Array(C); hn = new Uint32Array(C); ids = new Uint32Array(u8.length);
    var p = 16, q = 0, c, len, j, b, v, s;
    for (c = 0; c < C; c++) {
      off[c] = q;
      v = 0; s = 0; do { b = u8[p++]; v |= (b & 127) << s; s += 7; } while (b & 128); bk[c] = v;
      v = 0; s = 0; do { b = u8[p++]; v |= (b & 127) << s; s += 7; } while (b & 128); hn[c] = v;
      len = 0; s = 0; do { b = u8[p++]; len |= (b & 127) << s; s += 7; } while (b & 128);
      for (j = 0; j < len; j++) { v = 0; s = 0; do { b = u8[p++]; v |= (b & 127) << s; s += 7; } while (b & 128); ids[q++] = v; }
    }
    off[C] = q; ids = ids.subarray(0, q);
    cnt = new Uint32Array(NN); sumd = new Float64Array(NN);
    var seen = new Uint32Array(NN);
    for (c = 0; c < C; c++) {
      var a = off[c], z = off[c + 1];
      for (j = a; j < z; j++) { var id = ids[j]; if (seen[id] !== c + 1) { seen[id] = c + 1; cnt[id]++; sumd[id] += z - j; } }
    }
    cnt[0] = C; sumd[0] = 0;
  }

  // ---------- filters
  function matchReq(c) {
    var a = off[c], z = off[c + 1], n = req.length, pos = new Array(n), k, j;
    for (k = 0; k < n; k++) pos[k] = -1;
    for (j = a; j < z; j++) { var id = ids[j]; for (k = 0; k < n; k++) if (pos[k] < 0 && req[k] === id) pos[k] = j; }
    for (k = 0; k < n; k++) { if (pos[k] < 0) return false; if (ordered && k && !(pos[k - 1] > pos[k])) return false; }
    return true;
  }
  function refilter() {
    var out = new Uint32Array(C), n = 0, c;
    for (c = 0; c < C; c++) {
      if (bookSet && !bookSet[bk[c]]) continue;
      if (req.length && !matchReq(c)) continue;
      out[n++] = c;
    }
    sel = out.subarray(0, n);
    fcnt = new Uint32Array(NN);
    var seen = new Uint32Array(NN);
    for (var k = 0; k < n; k++) { c = sel[k]; for (var j = off[c]; j < off[c + 1]; j++) { var id = ids[j]; if (seen[id] !== k + 1) { seen[id] = k + 1; fcnt[id]++; } } }
    fcnt[0] = n;
    var f = bookSet || req.length;
    $('#iaMatch').textContent = f ? fmt(n) + ' of ' + fmt(C) + ' chains match' : fmt(C) + ' chains';
    updateBookBtn(); drawChips();
    A = null;
  }

  // ---------- aggregate around one narrator
  function aggregate(f) {
    var T = new Map(), S = new Map(), books = new Map(), hits = [], i, j, c, a, z, p, t, s;
    var dist = 0;
    for (i = 0; i < sel.length; i++) {
      c = sel[i]; a = off[c]; z = off[c + 1];
      if (f === 0) { hits.push(c); s = ids[z - 1]; S.set(s, (S.get(s) || 0) + 1); books.set(bk[c], (books.get(bk[c]) || 0) + 1); continue; }
      p = -1; for (j = a; j < z; j++) if (ids[j] === f) { p = j; break; }
      if (p < 0) continue;
      hits.push(c); dist += z - p;
      t = p + 1 < z ? ids[p + 1] : 0; T.set(t, (T.get(t) || 0) + 1);
      if (p > a) { s = ids[p - 1]; S.set(s, (S.get(s) || 0) + 1); }
      books.set(bk[c], (books.get(bk[c]) || 0) + 1);
    }
    var srt = function (m) { return Array.from(m).sort(function (x, y) { return y[1] - x[1] || x[0] - y[0]; }); };
    return { f: f, n: hits.length, hits: hits, T: srt(T), S: srt(S), books: srt(books), dist: hits.length && f ? dist / hits.length : 0 };
  }
  function route(f) {
    var path = [f], seen = {}, cur = f, step = 0;
    seen[f] = 1;
    while (cur !== 0 && step++ < 14) {
      var T = new Map(), i, j, c;
      for (i = 0; i < sel.length; i++) {
        c = sel[i]; var z = off[c + 1], p = -1;
        for (j = off[c]; j < z; j++) if (ids[j] === cur) { p = j; break; }
        if (p < 0) continue;
        var t = p + 1 < z ? ids[p + 1] : 0; T.set(t, (T.get(t) || 0) + 1);
      }
      var best = -1, bc = 0;
      T.forEach(function (n, t) { if (!seen[t] && n > bc) { best = t; bc = n; } });
      if (best < 0) break;
      path.push(best); seen[best] = 1; cur = best;
    }
    return path;
  }

  // ---------- search
  function search(q, limit, onlyIn) {
    buildKeys();
    var isAr = /[؀-ۿ]/.test(q), qk = isAr ? arKey(q) : enKey(q);
    if (!qk) return [];
    var words = qk.split(' '), keys = isAr ? KA : KE, out = [];
    for (var i = 0; i < NN && out.length < 800; i++) {
      if (onlyIn && !fcnt[i]) continue;
      var k = keys[i], ok = true;
      for (var w = 0; w < words.length; w++) if (k.indexOf(words[w]) < 0) { ok = false; break; }
      if (ok) out.push(i);
    }
    out.sort(function (a, b) { var ea = keys[a] === qk ? 1 : 0, eb = keys[b] === qk ? 1 : 0; return eb - ea || (fcnt[b] - fcnt[a]); });
    return out.slice(0, limit || 12);
  }
  function wireSearch(input, box, pick, onlyIn) {
    var sel2 = -1, res = [];
    function close() { box.hidden = true; sel2 = -1; }
    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (!q) { close(); return; }
      res = search(q, 12, onlyIn);
      if (!res.length) { box.hidden = false; box.innerHTML = '<p class="ia-none">No written name like that' + (bookSet || req.length ? ' in the current filter' : '') + '.</p>'; return; }
      box.innerHTML = res.map(function (i) { return '<button type="button" data-i="' + i + '"><span>' + nm(i) + ' <span class="en">' + esc(EN[i]) + '</span></span><small>' + fmt(fcnt[i]) + '</small></button>'; }).join('');
      box.hidden = false; sel2 = -1;
    });
    input.addEventListener('keydown', function (e) {
      var b = box.querySelectorAll('button');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!b.length) return; sel2 = (sel2 + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length; b.forEach(function (x, j) { x.classList.toggle('on', j === sel2); }); }
      else if (e.key === 'Enter') { e.preventDefault(); var t = b[sel2 >= 0 ? sel2 : 0]; if (t) { pick(+t.dataset.i); close(); input.value = ''; } }
      else if (e.key === 'Escape') close();
    });
    box.addEventListener('click', function (e) { var t = e.target.closest('button[data-i]'); if (t) { pick(+t.dataset.i); close(); input.value = ''; } });
    document.addEventListener('click', function (e) { if (!box.contains(e.target) && e.target !== input) close(); });
  }

  // ---------- rendering the chart
  function go(i, push) {
    if (push !== false && focus !== i) hist.push(focus);
    focus = i; had.list = null; render(true);
  }
  function render(save) {
    A = aggregate(focus);
    if (save) writeHash();
    drawRoute(); drawFlow(); drawCard(); drawHad(true);
    $('#iaback').disabled = !hist.length;
  }
  var showAll = { t: false, s: false };
  function item(x, side, max) {
    var i = x[0], w = Math.max(6, Math.round(100 * Math.sqrt(x[1] / max)));
    return '<li><div class="ia-row"><button type="button" class="ia-p" data-i="' + i + '"><span class="nm">' + nm(i) + mark(i) + '<span class="en">' + esc(EN[i]) + '</span></span><span class="bar" style="--w:' + w + '%"><b>' + fmt(x[1]) + '</b></span></button>' +
      '<span class="tools">' + (i ? '<button type="button" class="ia-tb" data-add="' + i + '" title="Only chains that contain this name" aria-label="Add to the chain filter">+</button>' : '') +
      '<button type="button" class="ia-tb" data-link="' + side + ':' + i + '" title="Show the ḥadīth along this link" aria-label="Show the ḥadīth along this link">ḥ</button></span></div></li>';
  }
  function drawFlow() {
    var d = A, lim = 10, pageMax = 60;
    var col = function (list, side, label, empty) {
      var shown = list.slice(0, showAll[side] ? pageMax : lim), mx = list.length ? list[0][1] : 1;
      return '<div class="ia-col ia-' + side + '"><h3>' + label + ' <span>' + fmt(list.length) + '</span></h3>' +
        (shown.length ? '<ol>' + shown.map(function (x) { return item(x, side, Math.max(mx, 1)); }).join('') + '</ol>' : '<p class="ia-none">' + empty + '</p>') +
        (list.length > lim ? '<button type="button" class="ia-more" data-side="' + side + '">' + (showAll[side] ? 'Show fewer' : 'Show ' + (Math.min(pageMax, list.length) - lim) + ' more') + '</button>' : '') +
        (list.length > pageMax && showAll[side] ? '<p class="ia-note">The ' + pageMax + ' most frequent are shown, of ' + fmt(list.length) + '.</p>' : '') + '</div>';
    };
    var mx = Math.max(d.T.length ? d.T[0][1] : 1, d.S.length ? d.S[0][1] : 1);
    var gt = col(d.T, 't', focus === 0 ? 'Receives from' : 'Narrates from', focus === 0 ? 'The source of the ḥadīth.' : 'No teacher in these chains.');
    // keep both columns on one scale
    $('#iaflow').innerHTML = '<svg class="ia-svg" aria-hidden="true"></svg>' + gt +
      '<div class="ia-mid"><div class="ia-me">' + nm(focus) + '<span class="en">' + esc(EN[focus]) + '</span><span class="h">' + fmt(d.n) + ' chains</span></div></div>' +
      col(d.S, 's', focus === 0 ? 'Heard by' : 'Narrated to', 'No student in these chains.');
    requestAnimationFrame(curves);
  }
  function curves() {
    var flow = $('#iaflow'), svg = $('.ia-svg', flow), me = $('.ia-me', flow);
    if (!svg || getComputedStyle(svg).display === 'none') return;
    var fb = flow.getBoundingClientRect(), mb = me.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + fb.width + ' ' + fb.height); svg.setAttribute('width', fb.width); svg.setAttribute('height', fb.height);
    var cy = mb.top - fb.top + mb.height / 2, out = '';
    ['t', 's'].forEach(function (side) {
      flow.querySelectorAll('.ia-' + side + ' .ia-p').forEach(function (p) {
        var r = p.getBoundingClientRect(), y = r.top - fb.top + r.height / 2;
        var w = parseFloat(p.querySelector('.bar').style.getPropertyValue('--w')) || 6, sw = Math.max(1.2, w / 100 * 16);
        var x0 = side === 't' ? r.right - fb.left + 2 : r.left - fb.left - 2, x1 = side === 't' ? mb.left - fb.left : mb.right - fb.left, mx = (x0 + x1) / 2;
        out += '<path class="' + side + '" d="M' + x0.toFixed(1) + ',' + y.toFixed(1) + ' C' + mx.toFixed(1) + ',' + y.toFixed(1) + ' ' + mx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + x1.toFixed(1) + ',' + cy.toFixed(1) + '" stroke-width="' + sw.toFixed(1) + '"/>';
      });
    });
    svg.innerHTML = out;
  }
  function drawRoute() {
    var el = $('#iaroute');
    if (focus === 0 || !A.n) { el.innerHTML = focus === 0 ? '<span class="lab">The Prophet ﷺ is the end of every chain in Sanadset</span>' : '<span class="muted">This name is not in any chain that matches the filters.</span>'; return; }
    var path = route(focus).reverse();
    el.innerHTML = '<span class="lab">Busiest route to the Prophet ﷺ</span><ol>' + path.map(function (j) {
      return '<li><button type="button" class="ia-p' + (j === focus ? ' here' : '') + '" data-i="' + j + '">' + nm(j) + (j ? '<span class="en">' + esc(EN[j]) + '</span>' : '') + '</button></li>';
    }).join('') + '</ol>';
  }
  function ord(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function drawCard() {
    var i = focus, d = A, h = '';
    h += '<p class="eyebrow">' + (i === 0 ? 'The end of every chain' : 'Name as written in the chains') + '</p>';
    h += '<h2 lang="ar" dir="rtl" class="ar">' + esc(AR[i]) + '</h2>';
    h += '<p class="en-name">' + esc(EN[i]) + ' <span class="muted" style="font:400 12px var(--sans)">(machine transliteration)</span></p>';
    if (i === 0) h += '<p class="note">Sanadset does not list the Prophet ﷺ as a narrator. Chains end at the last person named, usually a Companion reporting from him; the dataset does not say which reports stop short of him.</p>';
    if (isRel[i]) h += '<p class="warn">An expression such as “his father” or “his grandfather”. It stands for a different person in each chain.</p>';
    else if (isAmb[i]) h += '<p class="warn">A short name that may stand for several different people (see below). Its links can mix them.</p>';
    h += '<dl>';
    h += '<dt>Chains</dt><dd>' + fmt(d.n) + (bookSet || req.length ? ' in the filter' : '') + (i && (bookSet || req.length) ? ' · ' + fmt(cnt[i]) + ' in all' : '') + '</dd>';
    if (i) h += '<dt>Typical link</dt><dd>' + (d.n ? (d.dist).toFixed(1) : '–') + ' from the end of the chain</dd>';
    h += '<dt>Teachers</dt><dd>' + fmt(d.T.length) + ' different</dd><dt>Students</dt><dd>' + fmt(d.S.length) + ' different</dd><dt>Books</dt><dd>' + fmt(d.books.length) + '</dd></dl>';
    h += '<div class="acts">' + (i ? '<button type="button" data-add="' + i + '">Only chains with this name</button>' : '') + '<button type="button" data-hadith="1">Show the ḥadīth</button></div>';
    if (d.books.length) {
      var mb = d.books[0][1];
      h += '<h3>Books</h3><ul class="books">' + d.books.slice(0, 8).map(function (x) {
        var b = BOOKS[x[0]];
        return '<li><span class="bn" title="' + esc(b[0]) + '">' + esc(b[1] || b[0]) + '</span><span class="bb" style="--w:' + Math.max(4, Math.round(100 * x[1] / mb)) + '%"></span><span class="bc">' + fmt(x[1]) + '</span></li>';
      }).join('') + '</ul>';
    }
    var g = SAME && SAME.g[i];
    if (g && g.length) {
      h += '<h3>May be the same person</h3><p class="note">Suggested by comparing how the names are written and who they narrate from and to. These are hints, not part of Sanadset. The counts are kept apart and the names are not merged.</p><ul class="sames">' + g.map(function (x) {
        var why = x[2] === 's' ? 'same name, spelled differently' : 'part of the other name · ' + Math.round(x[1] * 100) + '% shared teachers and students';
        return '<li><span><button type="button" class="ia-l" data-i="' + x[0] + '">' + nm(x[0]) + '</button><span class="en">' + esc(EN[x[0]]) + '</span></span><span><small>' + fmt(cnt[x[0]]) + ' chains</small><small>' + why + '</small></span></li>';
      }).join('') + '</ul>';
    }
    $('#iacard').innerHTML = h;
  }

  // ---------- hadith panel
  var shards = {};
  function shard(k) { if (!shards[k]) shards[k] = fetch(BASE + 'm/' + k + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }); return shards[k]; }
  function drawHad(reset) {
    if (reset || !had.list) { had.list = A.hits; had.shown = 0; had.title = focus === 0 ? 'Ḥadīth in the chains that match' : 'Ḥadīth with ' + AR[focus]; }
    $('#hadH').innerHTML = esc(had.title).replace(/^(.*?)(\S*[؀-ۿ].*)$/, '$1<span lang="ar" dir="rtl" class="ar">$2</span>') + ' <span class="muted" style="font:400 15px var(--sans)">' + fmt(had.list.length) + '</span>';
    $('#hadList').innerHTML = '';
    more();
  }
  function more() {
    var list = had.list, from = had.shown, to = Math.min(list.length, from + 20), i;
    if (!list.length) { $('#hadList').innerHTML = '<p class="hd-note">No ḥadīth match the filters.</p>'; $('#hadMore').hidden = true; return; }
    var html = '';
    for (i = from; i < to; i++) html += hadItem(list[i], i);
    $('#hadList').insertAdjacentHTML('beforeend', html);
    had.shown = to; $('#hadMore').hidden = to >= list.length;
    $('#hadMore').textContent = 'Show ' + Math.min(20, list.length - to) + ' more';
    for (i = from; i < to; i++) fill(list[i], i);
  }
  function hadItem(c, k) {
    var b = BOOKS[bk[c]], ch = [], j;
    for (j = off[c]; j < off[c + 1]; j++) { var id = ids[j]; ch.push('<button type="button" class="ia-l' + (id === focus ? ' f' : '') + '" data-i="' + id + '">' + nm(id) + '</button>'); }
    return '<article class="hd-i" id="hi' + k + '"><p class="bk"><span>' + esc(b[1] || b[0]) + '</span><span class="n">no. ' + hn[c] + '</span><span class="n" lang="ar" dir="rtl">' + esc(b[0]) + '</span></p>' +
      '<p class="ch">' + ch.join('<span class="sep">›</span>') + '<span class="sep">› ' + 'النبي ﷺ</span></p><p class="tx" lang="ar" dir="rtl">…</p></article>';
  }
  function fill(c, k) {
    shard(Math.floor(c / SH)).then(function (a) {
      var t = a[c % SH] || '', el = document.querySelector('#hi' + k + ' .tx');
      if (!el) return;
      if (t.length > 420) { el.textContent = t.slice(0, 420) + '…'; el.insertAdjacentHTML('afterend', '<button type="button" class="more" data-full="' + c + '" data-k="' + k + '">Read the whole text</button>'); }
      else el.textContent = t;
    }).catch(function () { var el = document.querySelector('#hi' + k + ' .tx'); if (el) { el.textContent = 'The text of this ḥadīth is not available in this copy of the site.'; el.style.fontFamily = 'var(--sans)'; el.style.fontSize = '14px'; el.style.color = 'var(--muted)'; el.style.textAlign = 'left'; el.dir = 'ltr'; } });
  }
  function linkHits(side, other) {
    var out = [], i, j, c, z, p, t;
    for (i = 0; i < A.hits.length; i++) {
      c = A.hits[i]; z = off[c + 1];
      if (focus === 0) { if (side === 's' && ids[z - 1] === other) out.push(c); continue; }
      p = -1; for (j = off[c]; j < z; j++) if (ids[j] === focus) { p = j; break; }
      if (side === 't') { t = p + 1 < z ? ids[p + 1] : 0; if (t === other) out.push(c); }
      else if (p > off[c] && ids[p - 1] === other) out.push(c);
    }
    return out;
  }

  // ---------- filters UI
  function updateBookBtn() {
    var b = $('#bkBtn'), n = bookSet ? bookSet.reduce(function (s, x) { return s + x; }, 0) : NB;
    var six = bookSet && n === 6 && BOOKS.every(function (x, i) { return !!x[3] === !!bookSet[i]; });
    b.textContent = !bookSet ? 'Books: all ' + fmt(NB) : six ? 'Books: the Six Books' : n === 0 ? 'Books: none' : n <= 2 ? 'Books: ' + BOOKS.map(function (x, i) { return bookSet[i] ? (x[1] || x[0]) : null; }).filter(Boolean).join(', ') : 'Books: ' + n + ' chosen';
    b.classList.toggle('on', !!bookSet);
  }
  function drawBookList() {
    var q = $('#bkq').value.trim(), qk = q ? (/[؀-ۿ]/.test(q) ? arKey(q) : enKey(q)) : '', isAr = /[؀-ۿ]/.test(q), out = [];
    for (var i = 0; i < NB && out.length < 200; i++) {
      if (qk) { var k = isAr ? arKey(BOOKS[i][0]) : enKey(BOOKS[i][1] || BOOKS[i][0]); if (k.indexOf(qk) < 0) continue; }
      out.push(i);
    }
    $('#bkList').innerHTML = out.map(function (i) {
      var b = BOOKS[i], on = !bookSet || bookSet[i];
      return '<li><label><input type="checkbox" data-b="' + i + '"' + (bookSet && bookSet[i] ? ' checked' : '') + '><span class="bn"><span lang="ar" dir="rtl" class="ar">' + esc(b[0]) + '</span><span class="en">' + esc(b[1]) + '</span></span><span class="bc">' + fmt(b[2]) + '</span></label></li>';
    }).join('') || '<li class="ia-none">No book by that name.</li>';
  }
  function setBooks(set) { bookSet = set; had.list = null; refilter(); drawBookList(); postFilter(); }
  function postFilter() { if (view === 'index') { ixPage = 0; drawIndex(); } else { A = aggregate(focus); drawRoute(); drawFlow(); drawCard(); drawHad(true); } writeHash(); }
  function drawChips() {
    var ol = $('#reqChips');
    ol.innerHTML = req.map(function (i, k) { return '<li>' + nm(i) + '<button type="button" data-rm="' + k + '" aria-label="Remove">×</button></li>'; }).join('');
    ol.parentNode.classList.toggle('ord', ordered && req.length > 1);
  }
  function addReq(i) {
    if (i === 0 || req.indexOf(i) >= 0) return;
    req.push(i); had.list = null; refilter(); postFilter();
  }

  // ---------- all narrators table
  var ixSort = 'f', ixPage = 0;
  function drawIndex() {
    var q = $('#ixq').value.trim(), list;
    if (q) list = search(q, 5000, true);
    else { list = []; for (var i = 1; i < NN; i++) if (fcnt[i]) list.push(i); }
    var key = { f: function (i) { return fcnt[i]; }, a: function (i) { return cnt[i]; }, d: function (i) { return -(sumd[i] / cnt[i]); } }[ixSort];
    list.sort(function (a, b) { return key(b) - key(a) || a - b; });
    var start = ixPage * 100, page = list.slice(start, start + 100);
    $('#ixn').textContent = fmt(list.length) + ' written names';
    $('#ixb').innerHTML = page.map(function (i, j) {
      return '<tr><td class="r">' + fmt(start + j + 1) + '</td><td><button type="button" class="ia-l" data-i="' + i + '">' + nm(i) + '</button>' + mark(i) + '</td><td>' + esc(EN[i]) + '</td><td class="r">' + fmt(fcnt[i]) + '</td><td class="r">' + fmt(cnt[i]) + '</td><td class="r">' + (sumd[i] / cnt[i]).toFixed(1) + '</td></tr>';
    }).join('');
    $('#ixpg').innerHTML = (ixPage > 0 ? '<button type="button" data-pg="-1">‹ Previous 100</button>' : '') + (start + 100 < list.length ? '<button type="button" data-pg="1">Next 100 ›</button>' : '');
  }
  function setView(v) {
    view = v;
    $('#vFlow').setAttribute('aria-pressed', v === 'flow'); $('#vIndex').setAttribute('aria-pressed', v === 'index');
    $('#iaFlowView').hidden = v !== 'flow'; $('#iaIndexView').hidden = v !== 'index';
    if (v === 'index') { ixPage = 0; drawIndex(); } else { render(false); }
  }

  // ---------- address
  function writeHash() {
    var h = '#n=' + focus;
    if (req.length) h += '&r=' + req.join(',') + (ordered ? '&o=1' : '');
    if (bookSet) h += '&b=' + bookSet.reduce(function (a, x, i) { if (x) a.push(i); return a; }, []).join(',');
    try { history.replaceState(null, '', h); } catch (e) {}
  }
  function parseHash() {
    var o = { n: 0 }, h = location.hash.replace(/^#/, '');
    h.split('&').forEach(function (kv) {
      var p = kv.split('='), v = p[1] || '';
      if (p[0] === 'n' && /^\d+$/.test(v)) o.n = +v;
      if (p[0] === 'r') req = v.split(',').filter(Boolean).map(Number).filter(function (x) { return x > 0 && x < NN; });
      if (p[0] === 'o') ordered = v === '1';
      if (p[0] === 'b') { bookSet = new Uint8Array(NB); v.split(',').filter(Boolean).forEach(function (x) { if (+x < NB) bookSet[+x] = 1; }); }
    });
    if (req.length || bookSet) { refilter(); }
    $('#reqOrd').checked = ordered;
    return o;
  }

  // ---------- wiring
  function wireAll() {
    wireSearch($('#iaq'), $('#iares'), function (i) { if (view === 'index') setView('flow'); go(i); }, false);
    wireSearch($('#reqq'), $('#reqres'), addReq, false);
    $('#vFlow').addEventListener('click', function () { setView('flow'); });
    $('#vIndex').addEventListener('click', function () { setView('index'); });
    $('#iaprophet').addEventListener('click', function () { if (view === 'index') view = 'flow', setView('flow'); go(0); });
    $('#iaback').addEventListener('click', function () { if (hist.length) { had.list = null; focus = hist.pop(); render(true); } });
    $('#reqOrd').addEventListener('change', function (e) { ordered = e.target.checked; had.list = null; refilter(); postFilter(); });
    $('#sameOn').addEventListener('change', function (e) { sameOn = e.target.checked; if (view === 'flow') { drawFlow(); } else drawIndex(); });
    $('#bkBtn').addEventListener('click', function () { var p = $('#bkPop'); p.hidden = !p.hidden; $('#bkBtn').setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden) { drawBookList(); $('#bkq').focus(); } });
    $('#bkq').addEventListener('input', drawBookList);
    $('#bkAll').addEventListener('click', function () { setBooks(null); });
    $('#bkNone').addEventListener('click', function () { setBooks(new Uint8Array(NB)); });
    $('#bkSix').addEventListener('click', function () { var s = new Uint8Array(NB); BOOKS.forEach(function (b, i) { if (b[3]) s[i] = 1; }); setBooks(s); });
    $('#bkList').addEventListener('change', function (e) {
      var b = e.target.closest('input[data-b]'); if (!b) return;
      var s = bookSet ? new Uint8Array(bookSet) : new Uint8Array(NB);
      s[+b.dataset.b] = b.checked ? 1 : 0;
      bookSet = s; had.list = null; refilter(); postFilter();
    });
    document.addEventListener('click', function (e) { var p = $('#bkPop'); if (!p.hidden && !p.contains(e.target) && e.target !== $('#bkBtn')) { p.hidden = true; $('#bkBtn').setAttribute('aria-expanded', 'false'); } });
    $('#reqChips').addEventListener('click', function (e) { var r = e.target.closest('[data-rm]'); if (r) { req.splice(+r.dataset.rm, 1); had.list = null; refilter(); postFilter(); } });
    $('#ixq').addEventListener('input', function () { ixPage = 0; drawIndex(); });
    root.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-add]'))) { addReq(+t.dataset.add); return; }
      if ((t = e.target.closest('[data-link]'))) {
        var p = t.dataset.link.split(':'), side = p[0], other = +p[1];
        had.list = linkHits(side, other); had.shown = 0;
        had.title = side === 't' ? 'Ḥadīth: ' + AR[focus] + ' from ' + AR[other] : 'Ḥadīth: ' + AR[other] + ' from ' + AR[focus];
        drawHad(false); $('#iaHad').scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
      }
      if ((t = e.target.closest('[data-hadith]'))) { had.list = null; drawHad(true); $('#iaHad').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if ((t = e.target.closest('[data-full]'))) {
        var c = +t.dataset.full, k = t.dataset.k;
        shard(Math.floor(c / SH)).then(function (a) { var el = document.querySelector('#hi' + k + ' .tx'); if (el) el.textContent = a[c % SH]; t.remove(); });
        return;
      }
      if ((t = e.target.closest('[data-i]')) && (t.classList.contains('ia-p') || t.classList.contains('ia-l')) && !t.closest('.ia-pop') && !t.closest('.ia-res')) {
        if (view === 'index') { setView('flow'); }
        go(+t.dataset.i);
        if (!t.closest('.hd-i')) window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 12, behavior: 'smooth' });
        return;
      }
      if ((t = e.target.closest('.ia-more[data-side]'))) { showAll[t.dataset.side] = !showAll[t.dataset.side]; drawFlow(); return; }
      if ((t = e.target.closest('[data-pg]'))) { ixPage += +t.dataset.pg; drawIndex(); return; }
      if ((t = e.target.closest('th[data-k]'))) { ixSort = t.dataset.k; ixPage = 0; root.querySelectorAll('th[data-k]').forEach(function (x) { x.removeAttribute('aria-sort'); }); t.setAttribute('aria-sort', 'descending'); drawIndex(); }
    });
    $('#hadMore').addEventListener('click', more);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(curves, 120); });
  }
})();
