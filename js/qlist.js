/* Islamic Internet Archives – searchable, filterable lists inside the Quran section
   (manuscript catalogue, scholars, tafseer). Same behaviour as the Library:
   type to search (accents and spelling variants tolerated), tick filters, sort, show more. */
(function () {
  'use strict';
  var root = document.querySelector('[data-qlist]');
  if (!root) return;
  var M = window.IAMatch;
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-q-item]'));
  var box = document.getElementById('qresults');
  var q = document.getElementById('qq');
  var sort = document.getElementById('qsort');
  var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-qfilter]'));
  var count = document.getElementById('qcount');
  var none = document.getElementById('qnone');
  var near = document.getElementById('qnear');
  var more = document.getElementById('qmore');
  var PAGE = +(root.dataset.page || 40), limit = PAGE;
  var orig = rows.slice();
  var params = new URLSearchParams(location.search);
  if (params.get('q')) q.value = params.get('q');

  function key(t) { return (t || '').normalize('NFD').replace(/[̀-ͯʼ-ʿ‘-‟'"]/g, '').replace(/^[^a-z0-9؀-￿]+/i, ''); }

  function apply(keep) {
    if (keep !== true) limit = PAGE;
    var term = M ? M.norm(q.value) : q.value.trim().toLowerCase();
    var qw = term ? term.split(' ') : [];
    var sel = {};
    boxes.forEach(function (b) { if (b.checked) (sel[b.dataset.qfilter] = sel[b.dataset.qfilter] || []).push(b.value); });
    function facetsOk(r) {
      for (var k in sel) { if (sel[k].indexOf(r.dataset[k]) === -1) return false; }
      return true;
    }
    var shown = 0;
    rows.forEach(function (r) {
      var ok = facetsOk(r) && (!term || qw.every(function (t) { return r.dataset.text.indexOf(t) !== -1; }));
      if (ok) shown++;
      r.hidden = !ok || shown > limit;
    });
    near.hidden = true;
    if (!shown && term && M) {
      var scored = [];
      rows.forEach(function (r) {
        if (!facetsOk(r)) return;
        r._w = r._w || r.dataset.text.split(' ');
        var sc = M.score(qw, r._w, true) || M.score(qw, r._w, false) / 4;
        if (sc >= 1) scored.push([sc, r]);
      });
      scored.sort(function (x, y) { return y[0] - x[0]; });
      scored.forEach(function (x, i) { x[1].hidden = i >= limit; box.appendChild(x[1]); });
      shown = scored.length;
      if (shown) { near.textContent = 'No exact match for “' + q.value.trim() + '”. Showing the nearest matches.'; near.hidden = false; }
    }
    more.hidden = shown <= limit;
    more.textContent = 'Show more (' + (shown - Math.min(shown, limit)) + ' left)';
    count.textContent = shown;
    none.hidden = shown !== 0;
    box.hidden = shown === 0;
  }

  function order() {
    var m = sort.value;
    rows = orig.slice();
    if (m === 'az' || m === 'za') {
      rows.sort(function (a, b) { var c = key(a.dataset.title).localeCompare(key(b.dataset.title)); return m === 'az' ? c : -c; });
    } else if (m === 'period') {
      rows.sort(function (a, b) { return (+a.dataset.pidx - +b.dataset.pidx) || key(a.dataset.title).localeCompare(key(b.dataset.title)); });
    }
    rows.forEach(function (r) { box.appendChild(r); });
    apply();
  }

  q.addEventListener('input', function () { apply(); });
  sort.addEventListener('change', order);
  boxes.forEach(function (b) { b.addEventListener('change', function () { apply(); }); });
  more.addEventListener('click', function () { limit += PAGE * 2; apply(true); });
  var clear = document.getElementById('qclear');
  if (clear) clear.addEventListener('click', function () { boxes.forEach(function (b) { b.checked = false; }); q.value = ''; sort.value = 'curated'; order(); });
  var fd = document.getElementById('qfilters');
  if (fd && window.matchMedia && window.matchMedia('(max-width: 820px)').matches) fd.open = false;

  // copy buttons on cite tiles
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    var done = function () { var t = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done); else done();
  });

  // an address like /quran/manuscripts/#ia-soth3 opens that entry
  function jump() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    if (!id) return;
    var r = document.getElementById(id);
    if (!r || !r.matches('[data-q-item]')) return;
    boxes.forEach(function (b) { b.checked = false; });
    q.value = '';
    limit = Math.max(limit, rows.indexOf(r) + 1);
    apply(true);
    r.hidden = false;
    r.classList.add('q-target');
    var d = r.querySelector('details'); if (d) d.open = true;
    r.scrollIntoView({ block: 'center' });
  }
  order();
  jump();
  window.addEventListener('hashchange', jump);
})();
