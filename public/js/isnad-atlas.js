/* Isnad atlas: narrators across the hadith literature (Sanadset 650K, matched to muslimscholars.info). No libraries. */
(function () {
  var BASE = '/hadith/narrators/';
  var root = document.getElementById('ia');
  if (!root) return;
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var N = [], META = null, SH = 100, shards = {}, cur = null, scope = 'all', hist = [], showAll = { t: false, s: false };
  var GEN = { 1: 'Companion', 2: 'Senior Successor', 3: 'Middle Successor', 4: 'Successor', 5: 'Junior Successor', 6: 'Contemporary of the junior Successors', 7: 'Senior follower of the Successors', 8: 'Middle follower of the Successors', 9: 'Junior follower of the Successors', 10: 'Senior teacher of the compilers', 11: 'Middle teacher of the compilers', 12: 'Junior teacher of the compilers' };
  var fmt = function (n) { return Number(n).toLocaleString('en-GB'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ord = function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  var ce = function (ah) { return Math.round(ah * 0.970229 + 621.5643); };
  var arNorm = function (s) { return String(s).replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim(); };
  var enNorm = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[‘’'`ʿʾ\-]/g, '').replace(/\s+/g, ' ').trim(); };
  var nameOf = function (i) { var n = N[i]; return n ? (n[1] || n[0]) : ''; };
  var cnt = function (row) { return scope === 'six' ? row[2] : row[1]; };
  var hOf = function (i) { return scope === 'six' ? N[i][3] : N[i][2]; };

  function shard(i) {
    var k = Math.floor(i / SH);
    if (!shards[k]) shards[k] = fetch(BASE + 'n/' + k + '.json').then(function (r) { return r.json(); });
    return shards[k].then(function (d) { return d[i]; });
  }

  // ---------- search
  var keys = null;
  function buildKeys() { keys = N.map(function (n) { return [arNorm(n[0]), enNorm(n[1])]; }); }
  function search(q, limit) {
    if (!keys) buildKeys();
    var qa = arNorm(q), qe = enNorm(q), out = [];
    if (!qa && !qe) return out;
    for (var i = 0; i < N.length && out.length < 400; i++) {
      var k = keys[i];
      if ((qa && k[0].indexOf(qa) >= 0) || (qe && k[1] && k[1].indexOf(qe) >= 0)) out.push(i);
    }
    out.sort(function (a, b) { return hOf(b) - hOf(a); });
    return out.slice(0, limit || 12);
  }
  function wireSearch(input, box, pick) {
    var sel = -1, res = [];
    function close() { box.hidden = true; sel = -1; }
    input.addEventListener('input', function () {
      res = search(input.value);
      if (!res.length) { box.hidden = !input.value; box.innerHTML = input.value ? '<p class="ia-none">No narrator by that name.</p>' : ''; return; }
      box.innerHTML = res.map(function (i, j) { var n = N[i]; return '<button type="button" data-i="' + i + '"><span><span lang="ar" dir="rtl" class="ar">' + esc(n[0]) + '</span>' + (n[1] ? ' <span class="en">' + esc(n[1]) + '</span>' : '') + '</span><small>' + fmt(hOf(i)) + '</small></button>'; }).join('');
      box.hidden = false; sel = -1;
    });
    input.addEventListener('keydown', function (e) {
      var b = box.querySelectorAll('button');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!b.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length; b.forEach(function (x, j) { x.classList.toggle('on', j === sel); }); }
      else if (e.key === 'Enter') { e.preventDefault(); var t = b[sel >= 0 ? sel : 0]; if (t) { pick(+t.dataset.i); close(); input.value = ''; } }
      else if (e.key === 'Escape') close();
    });
    box.addEventListener('click', function (e) { var t = e.target.closest('button[data-i]'); if (t) { pick(+t.dataset.i); close(); input.value = ''; } });
    document.addEventListener('click', function (e) { if (!box.contains(e.target) && e.target !== input) close(); });
  }

  // ---------- the flow chart
  function go(i, push) {
    if (cur != null && push !== false && cur !== i) hist.push(cur);
    cur = i; showAll = { t: false, s: false };
    try { history.replaceState(null, '', '#n=' + i); } catch (e) {}
    render();
  }
  function render() {
    var i = cur;
    $('#iaflow').classList.add('busy');
    shard(i).then(function (d) {
      $('#iaflow').classList.remove('busy');
      drawFlow(i, d); drawCard(i, d); drawRoute(i, d);
      $('#iaback').disabled = !hist.length;
    });
  }
  function rows(list, side) {
    var r = list.filter(function (x) { return cnt(x) > 0; }).sort(function (a, b) { return cnt(b) - cnt(a); });
    var lim = showAll[side] ? 60 : 10;
    return { shown: r.slice(0, lim), total: r.length };
  }
  function item(x, side, max) {
    var i = x[0], n = N[i], w = Math.max(6, Math.round(100 * Math.sqrt(cnt(x) / max)));
    return '<li><button type="button" class="ia-p" data-i="' + i + '"' + (n[5] ? ' title="This name may stand for more than one person"' : '') + '>' +
      '<span class="nm"><span lang="ar" dir="rtl" class="ar">' + esc(n[0]) + (n[5] ? ' <span class="amb" aria-label="ambiguous">?</span>' : '') + '</span>' + (n[1] ? '<span class="en">' + esc(n[1]) + '</span>' : '') + '</span>' +
      '<span class="bar" style="--w:' + w + '%"><b>' + fmt(cnt(x)) + '</b></span></button></li>';
  }
  function drawFlow(i, d) {
    var n = N[i], t = rows(d.t, 't'), s = rows(d.s, 's');
    var mt = t.shown.length ? cnt(t.shown[0]) : 1, ms = s.shown.length ? cnt(s.shown[0]) : 1, mx = Math.max(mt, ms);
    var col = function (r, side, label, empty, tot) {
      return '<div class="ia-col ia-' + side + '"><h3>' + label + ' <span>' + fmt(tot) + '</span></h3>' +
        (r.shown.length ? '<ol>' + r.shown.map(function (x) { return item(x, side, mx); }).join('') + '</ol>' : '<p class="ia-none">' + empty + '</p>') +
        (r.total > 10 ? '<button type="button" class="ia-more" data-side="' + side + '">' + (showAll[side] ? 'Show fewer' : 'Show ' + (Math.min(60, r.total) - 10) + ' more') + '</button>' : '') +
        (tot > 60 && showAll[side] ? '<p class="ia-note">The 60 most frequent are shown, of ' + fmt(tot) + '.</p>' : '') + '</div>';
    };
    $('#iaflow').innerHTML = '<svg class="ia-svg" aria-hidden="true"></svg>' +
      col(t, 't', i === 0 ? 'Receives from' : 'Narrates from', i === 0 ? 'The source of the ḥadīth.' : 'No teacher recorded in this scope.', d.nt2) +
      '<div class="ia-mid"><div class="ia-me"><span lang="ar" dir="rtl" class="ar">' + esc(n[0]) + '</span>' + (n[1] ? '<span class="en">' + esc(n[1]) + '</span>' : '') + '<span class="h">' + fmt(hOf(i)) + ' chains</span></div></div>' +
      col(s, 's', i === 0 ? 'Heard by' : 'Narrated to', 'No student recorded in this scope.', d.ns2);
    requestAnimationFrame(curves);
  }
  // ribbons from each teacher and student to the centre
  function curves() {
    var flow = $('#iaflow'), svg = $('.ia-svg', flow), me = $('.ia-me', flow);
    if (!svg || getComputedStyle(svg).display === 'none') return;
    var fb = flow.getBoundingClientRect(), mb = me.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + fb.width + ' ' + fb.height);
    svg.setAttribute('width', fb.width); svg.setAttribute('height', fb.height);
    var cy = mb.top - fb.top + mb.height / 2, out = '';
    ['t', 's'].forEach(function (side) {
      flow.querySelectorAll('.ia-' + side + ' .ia-p').forEach(function (p) {
        var r = p.getBoundingClientRect(), y = r.top - fb.top + r.height / 2;
        var w = parseFloat(p.querySelector('.bar').style.getPropertyValue('--w')) || 6, sw = Math.max(1.2, w / 100 * 16);
        var x0 = side === 't' ? r.right - fb.left + 2 : r.left - fb.left - 2, x1 = side === 't' ? mb.left - fb.left : mb.right - fb.left;
        var mx = (x0 + x1) / 2;
        out += '<path class="' + side + '" d="M' + x0.toFixed(1) + ',' + y.toFixed(1) + ' C' + mx.toFixed(1) + ',' + y.toFixed(1) + ' ' + mx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + x1.toFixed(1) + ',' + cy.toFixed(1) + '" stroke-width="' + sw.toFixed(1) + '"/>';
      });
    });
    svg.innerHTML = out;
  }
  function drawRoute(i, d) {
    var el = $('#iaroute');
    if (!d.r.length) { el.innerHTML = i === 0 ? '' : '<span class="muted">No route to the Prophet ﷺ in the chains.</span>'; return; }
    var path = [i].concat(d.r).reverse();
    var ends = d.r[d.r.length - 1] === 0;
    el.innerHTML = '<span class="lab">' + (ends ? 'Busiest route to the Prophet ﷺ' : 'Busiest route back') + '</span><ol>' + path.map(function (j) {
      return '<li><button type="button" class="ia-p' + (j === i ? ' here' : '') + '" data-i="' + j + '"><span lang="ar" dir="rtl" class="ar">' + esc(N[j][0]) + '</span>' + (N[j][1] && j !== 0 ? '<span class="en">' + esc(N[j][1]) + '</span>' : '') + '</button></li>';
    }).join('') + '</ol>';
  }
  function drawCard(i, d) {
    var n = N[i], b = d.bio, h = '';
    h += '<p class="eyebrow">' + (i === 0 ? 'The Messenger of Allah' : n[4] ? 'Usually the ' + ord(n[4]) + ' link from the Prophet ﷺ' : 'Narrator') + '</p>';
    h += '<h2 lang="ar" dir="rtl" class="ar">' + esc(n[0]) + '</h2>';
    if (n[1]) h += '<p class="en-name">' + esc(n[1]) + (b && b.k ? ' <span class="muted">(' + esc(b.k) + ')</span>' : '') + '</p>';
    if (b && b.f) h += '<p class="full">' + esc(b.f) + '</p>';
    if (n[5]) h += '<p class="warn">This is a short name as written in the chains. It may stand for more than one person, so its links can mix several narrators.</p>';
    if (d.rel != null) h += '<p class="note">Written in the chains as “his father” or “his grandfather” after <button type="button" class="ia-l" data-i="' + d.rel + '">' + esc(nameOf(d.rel)) + '</button>.</p>';
    if (!b && i !== 0 && !n[5] && d.rel == null) h += '<p class="note">Name as written in the chains; not yet matched to a biographical entry.</p>';
    h += '<dl>';
    if (b) {
      if (b.g) h += '<dt>Generation</dt><dd>' + b.g + ' · ' + (GEN[b.g] || '') + '</dd>';
      if (b.b != null) h += '<dt>Born</dt><dd>' + (b.b < 0 ? -b.b + ' BH' : b.b + ' AH') + (b.b > 0 ? ' (' + ce(b.b) + ' CE)' : '') + '</dd>';
      if (b.d != null) h += '<dt>Died</dt><dd>' + b.d + ' AH (' + ce(b.d) + ' CE)' + (b.dp ? ', ' + esc(b.dp) : '') + '</dd>';
      if (b.pl) h += '<dt>Lived in</dt><dd>' + esc(b.pl) + '</dd>';
      if (b.gr) h += '<dt>Grade</dt><dd>' + esc(b.gr) + '</dd>';
    }
    h += '<dt>Chains</dt><dd>' + fmt(n[2]) + ' in all · ' + fmt(n[3]) + ' in the Six Books</dd>';
    h += '<dt>Links</dt><dd>' + fmt(d.nt2) + ' teachers · ' + fmt(d.ns2) + ' students <span class="muted">(two chains or more)</span></dd>';
    h += '<dt>Books</dt><dd>' + fmt(d.nb) + '</dd>';
    h += '</dl>';
    if (d.b && d.b.length) {
      var mb = d.b[0][1];
      h += '<h3>Where the chains appear</h3><ul class="books">' + d.b.map(function (x) {
        var bk = META.books[x[0]];
        return '<li><span class="bn">' + (bk[1] ? esc(bk[1]) : '<span lang="ar" dir="rtl">' + esc(bk[0]) + '</span>') + '</span><span class="bb" style="--w:' + Math.max(4, Math.round(100 * x[1] / mb)) + '%"></span><span class="bc">' + fmt(x[1]) + '</span></li>';
      }).join('') + '</ul>';
    }
    if (d.f && d.f.length > 1) h += '<h3>Forms of the name</h3><p class="forms" lang="ar" dir="rtl">' + d.f.map(esc).join(' · ') + '</p>';
    if (d.ms) h += '<p class="src"><a href="https://muslimscholars.info/manage.php?submit=scholar&amp;ID=' + d.ms + '" target="_blank" rel="noopener">Full entry on muslimscholars.info ↗</a></p>';
    $('#iacard').innerHTML = h;
  }

  // ---------- index table
  var ixSort = 'h', ixPage = 0, ixList = null;
  function drawIndex() {
    var q = $('#ixq').value.trim(), only = $('#ixonly').checked;
    var list = q ? search(q, 5000) : N.map(function (_, i) { return i; });
    if (only) list = list.filter(function (i) { return N[i][6]; });
    list = list.filter(function (i) { return i > 0 && (scope === 'all' || N[i][3] > 0); });
    var k = ixSort === 'h' ? (scope === 'six' ? 3 : 2) : ixSort === 'h6' ? 3 : 4;
    list.sort(function (a, b) { return k === 4 ? ((N[a][4] || 99) - (N[b][4] || 99) || N[b][2] - N[a][2]) : N[b][k] - N[a][k]; });
    ixList = list;
    var start = ixPage * 100, page = list.slice(start, start + 100);
    $('#ixn').textContent = fmt(list.length) + ' narrators';
    $('#ixb').innerHTML = page.map(function (i, j) {
      var n = N[i];
      return '<tr><td class="r">' + fmt(start + j + 1) + '</td><td><button type="button" class="ia-l" data-i="' + i + '"><span lang="ar" dir="rtl" class="ar">' + esc(n[0]) + '</span>' + (n[5] ? ' <span class="amb">?</span>' : '') + '</button></td><td>' + esc(n[1]) + '</td><td class="r">' + (n[4] || '–') + '</td><td class="r">' + fmt(n[2]) + '</td><td class="r">' + fmt(n[3]) + '</td></tr>';
    }).join('');
    $('#ixpg').innerHTML = (ixPage > 0 ? '<button type="button" data-pg="-1">‹ Previous 100</button>' : '') + (start + 100 < list.length ? '<button type="button" data-pg="1">Next 100 ›</button>' : '');
  }

  // ---------- wiring
  function setView(v) {
    $('#vFlow').setAttribute('aria-pressed', v === 'flow'); $('#vIndex').setAttribute('aria-pressed', v === 'index');
    $('#iaFlowView').hidden = v !== 'flow'; $('#iaIndexView').hidden = v !== 'index';
    if (v === 'index') drawIndex(); else requestAnimationFrame(curves);
  }
  function setScope(s) {
    scope = s;
    $('#sAll').setAttribute('aria-pressed', s === 'all'); $('#sSix').setAttribute('aria-pressed', s === 'six');
    if (!$('#iaIndexView').hidden) { ixPage = 0; drawIndex(); }
    if (cur != null) render();
  }
  root.addEventListener('click', function (e) {
    var p = e.target.closest('[data-i]');
    if (p && (p.classList.contains('ia-p') || p.classList.contains('ia-l'))) { go(+p.dataset.i); if (!$('#iaIndexView').hidden) setView('flow'); window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 12, behavior: 'smooth' }); return; }
    var m = e.target.closest('.ia-more');
    if (m) { showAll[m.dataset.side] = !showAll[m.dataset.side]; shard(cur).then(function (d) { drawFlow(cur, d); }); return; }
    var pg = e.target.closest('[data-pg]');
    if (pg) { ixPage += +pg.dataset.pg; drawIndex(); return; }
    var th = e.target.closest('th[data-k]');
    if (th) { ixSort = th.dataset.k; ixPage = 0; root.querySelectorAll('th[data-k]').forEach(function (x) { x.removeAttribute('aria-sort'); }); th.setAttribute('aria-sort', 'descending'); drawIndex(); }
  });
  $('#iaback').addEventListener('click', function () { if (hist.length) go(hist.pop(), false); });
  $('#vFlow').addEventListener('click', function () { setView('flow'); });
  $('#vIndex').addEventListener('click', function () { setView('index'); });
  $('#sAll').addEventListener('click', function () { setScope('all'); });
  $('#sSix').addEventListener('click', function () { setScope('six'); });
  $('#ixq').addEventListener('input', function () { ixPage = 0; drawIndex(); });
  $('#ixonly').addEventListener('change', function () { ixPage = 0; drawIndex(); });
  window.addEventListener('hashchange', function () { var m = location.hash.match(/n=(\d+)/); if (m && N.length && +m[1] !== cur && +m[1] < N.length) go(+m[1]); });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(curves, 120); });

  fetch(BASE + 'index.json').then(function (r) { return r.json(); }).then(function (D) {
    N = D.n; META = D.meta; SH = META.sh;
    $('#iaload').remove();
    wireSearch($('#iaq'), $('#iares'), function (i) { go(i); });
    var m = location.hash.match(/n=(\d+)/), start = m ? +m[1] : +(root.dataset.start || 0);
    go(start < N.length ? start : 0, false);
  });
})();
