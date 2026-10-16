/* Islamic Internet Archives – search as you type.
   Any <input data-suggest> gets a drop-down of the nearest authors, subjects and works.
   Matching ignores accents and ʿ/ʾ, matches the start of any word ("t" finds Taha),
   and tolerates small spelling mistakes ("abdurahman", "qutub", "mawdudi"/"maududi"). */
(function () {
  'use strict';

  // ---------- matching (also used by the Library and Authors pages via window.IAMatch) ----------
  var STOP = { the: 1, of: 1, and: 1, in: 1, a: 1, an: 1, to: 1, al: 1, el: 1, on: 1, for: 1, wa: 1, fi: 1 };

  function norm(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[ʿʾ'’`]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }
  // spelling variants common in transliteration: ou/u, ee/i, oo/u, dh/z, w/v, k/q, double letters
  function loose(w) {
    return w.replace(/ou/g, 'u').replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/dh/g, 'z')
      .replace(/w/g, 'v').replace(/q/g, 'k').replace(/(.)\1+/g, '$1');
  }
  function words(s) { return norm(s).split(' ').filter(Boolean); }

  // edit distance with an early cut-off
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // how well one typed word t matches one word w: 4 exact, 3 start of word, 2 inside word, 1 close spelling, 0 no
  function tokenScore(t, w) {
    if (w === t) return 4;
    if (w.indexOf(t) === 0) return 3;
    if (t.length >= 3 && w.indexOf(t) > 0) return 2;
    if (t.length >= 3) {
      var lt = loose(t), lw = loose(w);
      if (lw === lt || lw.indexOf(lt) === 0) return 2.5;
      var max = t.length >= 7 ? 2 : 1;
      if (dist(lt, lw, max) <= max) return 1;
      if (lw.length > lt.length && dist(lt, lw.slice(0, lt.length), max) <= max) return 1;
    }
    return 0;
  }

  // score a list of words against the typed words; 0 = not every typed word matched
  function score(qWords, itemWords, strict) {
    var total = 0, hit = 0;
    for (var i = 0; i < qWords.length; i++) {
      var t = qWords[i], best = 0;
      for (var k = 0; k < itemWords.length && best < 4; k++) {
        var w = itemWords[k];
        if (STOP[w] && t.length < 3 && w !== t) continue;
        var s = tokenScore(t, w);
        if (s > best) best = s;
      }
      if (best) hit++;
      total += best;
    }
    if (strict && hit < qWords.length) return 0;
    return hit ? total + hit * 2 : 0;
  }

  window.IAMatch = { norm: norm, words: words, score: score, tokenScore: tokenScore, quranHits: quranHits };

  // Quran-section entries that match typed words (used by the Library's "also in the Quran section" note)
  function quranHits(q, limit) {
    return load().then(function () {
      var qw = words(q), r = [];
      if (!qw.length) return r;
      index.q.forEach(function (it) { var s = score(qw, it.w, true); if (s) r.push([s, it]); });
      r.sort(function (x, y) { return y[0] - x[0]; });
      return r.slice(0, limit || 8).map(function (x) { return x[1]; });
    });
  }

  // ---------- the drop-down ----------
  var index = null, loading = null;
  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) loading = fetch('/search-index.json').then(function (r) { return r.json(); }).then(function (d) {
      function prep(list, kind) {
        return list.map(function (x) { return { kind: kind, name: x[0], url: x[1], note: x[3], w: words(x[0] + ' ' + x[2]), nw: words(x[0]) }; });
      }
      index = { a: prep(d.a, 'Author'), s: prep(d.s, 'Subject'), w: prep(d.w, 'Work'), q: prep(d.q || [], 'Quran') };
      return index;
    });
    return loading;
  }

  function find(q) {
    var qw = words(q);
    if (!qw.length) return { items: [], near: false };
    var one = qw.length === 1 && qw[0].length < 3;
    function run(strict) {
      function pick(list, limit, nameOnly) {
        var r = [];
        list.forEach(function (it) {
          var s = score(qw, nameOnly ? it.nw : it.w, strict);
          if (!s) return;
          if (norm(it.name).indexOf(qw.join(' ')) === 0) s += 6; // the name starts with what was typed
          r.push([s, it]);
        });
        r.sort(function (x, y) { return y[0] - x[0] || x[1].name.length - y[1].name.length; });
        return r.slice(0, limit).map(function (x) { return x[1]; });
      }
      // with one or two letters, only look at the start of names, so "t" lists Taha rather than every "the"
      return pick(index.a, 6, false).concat(pick(index.s, 3, false), pick(index.q, one ? 2 : 5, one), pick(index.w, one ? 4 : 7, one));
    }
    var items = run(true);
    if (items.length) return { items: items, near: !items.some(function (it) { return exact(qw, it); }) };
    return { items: run(false), near: true };
  }
  function exact(qw, it) { return qw.every(function (t) { return it.w.some(function (w) { return w.indexOf(t) === 0; }); }); }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function attach(input) {
    var box = document.createElement('div');
    box.className = 'suggest';
    box.id = (input.id || 'q') + '-suggest';
    box.setAttribute('role', 'listbox');
    box.hidden = true;
    var wrap = input.parentNode;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    wrap.appendChild(box);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', box.id);
    input.setAttribute('aria-expanded', 'false');
    var active = -1, links = [];

    function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
    function setActive(i) {
      links.forEach(function (l, k) { l.classList.toggle('on', k === i); l.setAttribute('aria-selected', String(k === i)); });
      active = i;
      if (links[i]) links[i].scrollIntoView({ block: 'nearest' });
    }
    function show() {
      var q = input.value;
      if (!q.trim()) { close(); return; }
      load().then(function () {
        if (input.value !== q) return;
        var res = find(q), html = '', last = '';
        if (!res.items.length) {
          html = '<p class="suggest-note">Nothing close to “' + esc(q) + '”. Try fewer letters or another spelling.</p>';
        } else {
          if (res.near) html += '<p class="suggest-note">No exact match for “' + esc(q) + '”. Nearest matches:</p>';
          res.items.forEach(function (it, i) {
            if (it.kind !== last) { html += '<p class="suggest-head">' + (it.kind === 'Quran' ? 'Quran section' : it.kind + 's') + '</p>'; last = it.kind; }
            html += '<a role="option" id="' + box.id + '-' + i + '" href="' + it.url + '"><span class="suggest-name">' + esc(it.name) + '</span>' + (it.note ? '<span class="suggest-meta">' + esc(it.note) + '</span>' : '') + '</a>';
          });
        }
        if (input.dataset.suggest !== 'nav') html += '<p class="suggest-foot">Press Enter to search all text for “' + esc(q) + '”</p>';
        box.innerHTML = html;
        // sit directly under the input, whatever the layout around it
        box.style.left = input.offsetLeft + 'px';
        box.style.top = (input.offsetTop + input.offsetHeight + 4) + 'px';
        box.style.width = Math.max(input.offsetWidth, 280) + 'px';
        links = Array.prototype.slice.call(box.querySelectorAll('a'));
        active = -1;
        box.hidden = false;
        input.setAttribute('aria-expanded', 'true');
      });
    }

    input.addEventListener('focus', function () { load(); if (input.value.trim()) show(); });
    input.addEventListener('input', show);
    input.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, links.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, -1)); }
      else if (e.key === 'Escape') { close(); }
      else if (e.key === 'Enter' && active >= 0 && links[active]) { e.preventDefault(); location.href = links[active].href; }
      else if (e.key === 'Enter') { close(); }
    });
    document.addEventListener('click', function (e) { if (e.target !== input && !box.contains(e.target)) close(); });
  }

  function init() { document.querySelectorAll('input[data-suggest]').forEach(attach); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
