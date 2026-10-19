/* Narrators of Ṣaḥīḥ al-Bukhārī: collapsible tree, narrator card, search and index.
   Data: /hadith/bukhari-narrators.json  { p: {id: person}, e: [[teacher, student, count]], x: {"t_s": [hadith nos]}, nh }
   id -1 is the Prophet ﷺ, id 0 is al-Bukhārī; other ids are muslimscholars.info numbers. */
(function () {
  'use strict';
  var GEN = { 0: 'The Prophet ﷺ', 1: 'Companions', 2: 'Senior Successors', 3: 'Middle Successors', 4: 'Successors of the fourth generation', 5: 'Junior Successors', 6: 'Contemporaries of the junior Successors', 7: 'Senior followers of the Successors', 8: 'Middle followers of the Successors', 9: 'Junior followers of the Successors', 10: 'Senior students of the followers', 11: 'Middle students of the followers', 12: 'Junior students of the followers' };
  var PAGE = 12;
  var $ = function (id) { return document.getElementById(id); };
  var host = document.querySelector('.bt');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fold = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʿʾ'`’‘\-]/g, '').toLowerCase(); };
  var yr = function (y) { return y == null ? '' : (y < 0 ? (-y) + ' BH' : y + ' AH'); };
  var ce = function (y) { return Math.round(y * 0.970224 + 621.5643); };
  var short = function (s, n) { n = n || 32; return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  var css = function (v) { return getComputedStyle(host).getPropertyValue(v).trim(); };

  fetch('/hadith/bukhari-narrators.json').then(function (r) { return r.json(); }).then(start).catch(function () {
    $('btload').textContent = 'The narrator data could not be loaded. Please reload the page.';
  });

  function start(DATA) {
    $('btload').hidden = true;
    var P = DATA.p, teachers = {}, students = {};
    DATA.e.forEach(function (e) { (teachers[e[1]] = teachers[e[1]] || []).push([e[0], e[2]]); (students[e[0]] = students[e[0]] || []).push([e[1], e[2]]); });
    [teachers, students].forEach(function (o) { for (var k in o) o[k].sort(function (a, b) { return b[1] - a[1]; }); });
    var gvar = function (id) { var p = P[id] || {}; if (id == -1) return '--prophet'; if (id == 0) return '--compiler'; return p.g >= 1 && p.g <= 12 ? '--g' + p.g : '--gnone'; };
    var gcol = function (id) { return css(gvar(id)); };
    var genLabel = function (id) { if (id == 0) return 'Compiler of the Ṣaḥīḥ'; var p = P[id]; if (!p || p.g == null) return 'Generation not recorded'; return (p.g ? 'Generation ' + p.g + ' · ' : '') + GEN[p.g]; };

    /* ---------- tree ---------- */
    var mode = 'down', rootId = -1, selected = null, uid = 0, root;
    var svg = d3.select('#btsvg'), vp = d3.select('#btvp');
    var zoom = d3.zoom().scaleExtent([0.15, 2.5]).on('zoom', function (e) { vp.attr('transform', e.transform); });
    svg.call(zoom).on('dblclick.zoom', null);
    var kids = function (id) { return (mode === 'down' ? students : teachers)[id] || []; };
    function makeNode(id, count, anc) { return { uid: ++uid, id: id, count: count, anc: anc, children: null, shown: 0, cyc: anc.has(id) }; }
    function expand(n, more) {
      var list = kids(n.id); if (!list.length || n.cyc) return;
      var anc = new Set(n.anc); anc.add(n.id);
      if (!n.children) { n.children = []; n.shown = 0; }
      n.children = n.children.filter(function (c) { return !c.more; });
      var next = list.slice(n.shown, n.shown + (more ? PAGE * 2 : PAGE));
      next.forEach(function (k) { n.children.push(makeNode(k[0], k[1], anc)); });
      n.shown += next.length;
      if (n.shown < list.length) n.children.push({ uid: ++uid, more: true, parentNode: n, left: list.length - n.shown });
    }
    function setRoot(id, dir) {
      if (dir) mode = dir; rootId = id;
      $('dDown').setAttribute('aria-pressed', String(mode === 'down' && id == -1));
      $('dUp').setAttribute('aria-pressed', String(mode === 'up' && id == 0));
      root = makeNode(id, null, new Set()); expand(root);
      render(true); select(id);
    }
    function render(reset, anchor) {
      var h = d3.hierarchy(root, function (d) { return d.children; });
      d3.tree().nodeSize([24, 290]).separation(function (a, b) { return a.parent === b.parent ? 1 : 1.25; })(h);
      var nodes = h.descendants(), links = h.links();
      var maxC = Math.max.apply(null, [1].concat(links.map(function (l) { return l.target.data.count || 1; })));
      var lk = vp.select('.links').selectAll('path').data(links, function (d) { return d.target.data.uid; });
      lk.exit().remove();
      lk.enter().append('path').merge(lk)
        .attr('d', d3.linkHorizontal().x(function (d) { return d.y; }).y(function (d) { return d.x; }))
        .attr('stroke-width', function (d) { return d.target.data.more ? 1 : 0.8 + 4.2 * Math.sqrt((d.target.data.count || 1) / maxC); });
      var nd = vp.select('.nodes').selectAll('g.node').data(nodes, function (d) { return d.data.uid; });
      nd.exit().remove();
      var en = nd.enter().append('g').attr('class', 'node').attr('tabindex', 0).attr('role', 'button');
      en.append('circle'); en.append('text').attr('dy', '0.32em').attr('x', 10);
      var all = en.merge(nd);
      all.attr('transform', function (d) { return 'translate(' + d.y + ',' + d.x + ')'; })
        .classed('more', function (d) { return !!d.data.more; }).classed('cyc', function (d) { return !!d.data.cyc; })
        .classed('sel', function (d) { return !d.data.more && d.data.id === selected; })
        .attr('aria-label', function (d) { return d.data.more ? 'Show ' + d.data.left + ' more' : (P[d.data.id] || {}).n; });
      all.select('circle')
        .attr('r', function (d) { return d.data.more ? 3 : (d.data.id <= 0 ? 7 : 5); })
        .attr('fill', function (d) { return d.data.more ? 'transparent' : gcol(d.data.id); })
        .attr('stroke-dasharray', function (d) { return (!d.data.more && !d.data.children && kids(d.data.id).length && !d.data.cyc) ? '2 1.5' : null; })
        .attr('stroke', function (d) { return (!d.data.more && !d.data.children && kids(d.data.id).length && !d.data.cyc) ? css('--prophet') : null; });
      all.select('text').each(function (d) {
        var t = d3.select(this); t.selectAll('*').remove(); t.text(null);
        if (d.data.more) { t.text('+ ' + d.data.left + ' more'); return; }
        var p = P[d.data.id] || { n: '#' + d.data.id };
        t.append('tspan').text(short(p.n) + (d.data.cyc ? ' (repeats above)' : ''));
        var y = p.d != null ? 'd. ' + (p.d < 0 ? yr(p.d) : p.d) : (p.g === 1 ? 'Companion' : '');
        if (y) t.append('tspan').attr('class', 'yr').attr('dx', 6).text(y);
        if (d.data.count) t.append('tspan').attr('class', 'ct').attr('dx', 6).text(d.data.count);
      });
      all.on('click', function (e, d) { onNode(d); }).on('keydown', function (e, d) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNode(d); } });
      var box = svg.node().getBoundingClientRect();
      if (reset) {
        svg.call(zoom.transform, d3.zoomIdentity.translate(Math.min(150, box.width * 0.12), box.height / 2).scale(box.width < 600 ? 0.8 : 1));
      } else if (anchor) {
        var tr = d3.zoomTransform(svg.node());
        var n = nodes.find(function (x) { return x.data.uid === anchor.uid; });
        if (n) svg.call(zoom.transform, d3.zoomIdentity.translate(anchor.sx - n.y * tr.k, anchor.sy - n.x * tr.k).scale(tr.k));
      }
      drawCrumb();
    }
    function onNode(d) {
      var t = d3.zoomTransform(svg.node());
      var anchor = { uid: d.data.uid, sx: t.applyX(d.y), sy: t.applyY(d.x) };
      if (d.data.more) {
        expand(d.data.parentNode, true);
        anchor = { uid: d.data.parentNode.uid, sx: t.applyX(d.parent.y), sy: t.applyY(d.parent.x) };
        render(false, anchor); return;
      }
      if (d.data.children) { d.data.children = null; d.data.shown = 0; } else expand(d.data);
      selected = d.data.id; render(false, anchor); select(d.data.id);
    }
    function drawCrumb() {
      var p = P[rootId] || {};
      $('btcrumb').innerHTML = '<span>Showing the <strong>' + (mode === 'down' ? 'students' : 'teachers') + '</strong> of <strong>' + esc(p.n) + '</strong> in al-Bukhārī’s chains.</span>' +
        '<button type="button" class="bt-tool" id="btcollapse">Close all branches</button><button type="button" class="bt-tool" id="btfit">Back to the start</button>';
      $('btcollapse').onclick = function () { setRoot(rootId); };
      $('btfit').onclick = function () { render(true); };
    }
    var leg = [[-1, 'The Prophet ﷺ']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (g) { return ['g' + g, g === 1 ? '1 Companions' : String(g)]; })).concat([[0, 'al-Bukhārī']]);
    $('btlegend').innerHTML = leg.map(function (k) { return '<span><i style="background:var(' + (typeof k[0] === 'string' ? '--' + k[0] : gvar(k[0])) + ')"></i>' + k[1] + '</span>'; }).join('') +
      '<span>· generation (ṭabaqa) · number = ḥadīth along that link · dashed ring = more to open</span>';

    /* ---------- narrator card ---------- */
    var card = $('btcard');
    function list(arr, label, key) {
      if (!arr || !arr.length) return '';
      var lim = 8;
      var li = arr.map(function (a, i) {
        var q = P[a[0]] || {};
        return '<li' + (i >= lim ? ' data-extra hidden' : '') + '><button type="button" data-id="' + a[0] + '">' + esc(q.n) + (q.d != null ? ' <span class="yr">d. ' + yr(q.d) + '</span>' : '') + '</button><span class="num">' + a[1] + '</span></li>';
      }).join('');
      return '<h3><span>' + label + '</span><span>' + arr.length + '</span></h3><ul data-list="' + key + '">' + li + '</ul>' + (arr.length > lim ? '<button type="button" class="showall" data-for="' + key + '">Show all ' + arr.length + '</button>' : '');
    }
    function select(id) {
      selected = id;
      vp.selectAll('g.node').classed('sel', function (d) { return !d.data.more && d.data.id === id; });
      var p = P[id]; if (!p) return;
      card.hidden = false;
      var life = [p.b != null ? 'b. ' + yr(p.b) : '', p.d != null ? 'd. ' + yr(p.d) + ' <span class="yr">(c. ' + ce(p.d) + ' CE)</span>' : ''].filter(Boolean).join(' – ');
      var fromHim = (teachers[0] || []).some(function (t) { return t[0] == id; }) ? DATA.x[id + '_0'] : null;
      var what = id == 0 ? 'ḥadīth with a chain' : id == -1 ? 'ḥadīth reaching him' : 'ḥadīth pass through him';
      card.innerHTML = '<button type="button" class="close" aria-label="Close">×</button>' +
        '<div class="eyebrow"><i style="background:' + gcol(id) + '"></i>' + esc(genLabel(id)) + '</div>' +
        '<h2>' + esc(p.n) + '</h2>' + (p.k ? '<p class="kunya">' + esc(p.k) + '</p>' : '') + (p.f ? '<p class="full">' + esc(p.f) + '</p>' : '') +
        '<dl>' + (life ? '<dt>Life</dt><dd>' + life + '</dd>' : '') + (p.dp ? '<dt>Died in</dt><dd>' + esc(p.dp) + '</dd>' : '') +
        (p.pl ? '<dt>Lived in</dt><dd>' + esc(p.pl) + '</dd>' : '') + (p.gr && id > 0 ? '<dt>Grade</dt><dd>' + esc(p.gr) + '</dd>' : '') +
        '<dt>In al-Bukhārī</dt><dd>' + p.h.toLocaleString('en-GB') + ' ' + what + '</dd></dl>' +
        '<div class="actions">' + ((teachers[id] || []).length ? '<button type="button" class="primary" data-root="' + id + '" data-dir="up">Tree of his teachers</button>' : '') +
        ((students[id] || []).length ? '<button type="button" data-root="' + id + '" data-dir="down">Tree of his students</button>' : '') + '</div>' +
        list(teachers[id], id == 0 ? 'His teachers in the Ṣaḥīḥ' : 'Narrates from', 't') + list(students[id], 'Narrated by', 's') +
        (fromHim ? '<p class="ext">Al-Bukhārī heard from him, for example, ḥadīth ' + fromHim.map(function (n) { return '<a href="https://sunnah.com/bukhari:' + n + '" rel="noopener" target="_blank">no. ' + n + '</a>'; }).join(', ') + '.</p>' : '') +
        (id > 0 ? '<p class="ext"><a href="https://muslimscholars.info/manage.php?submit=scholar&amp;ID=' + id + '" rel="noopener" target="_blank">Full entry on muslimscholars.info ↗</a></p>' : '');
      card.querySelector('.close').onclick = function () { card.hidden = true; };
      card.querySelectorAll('[data-root]').forEach(function (b) { b.onclick = function () { showView('tree'); setRoot(+b.dataset.root, b.dataset.dir); }; });
      card.querySelectorAll('li button').forEach(function (b) { b.onclick = function () { select(+b.dataset.id); }; });
      card.querySelectorAll('.showall').forEach(function (b) { b.onclick = function () { card.querySelectorAll('ul[data-list="' + b.dataset.for + '"] [data-extra]').forEach(function (li) { li.hidden = false; }); b.remove(); }; });
      card.scrollTop = 0;
    }

    /* ---------- search ---------- */
    var ids = Object.keys(P).map(Number);
    var idx = ids.map(function (id) { return [id, fold(P[id].n + ' ' + (P[id].k || '') + ' ' + (P[id].f || ''))]; });
    var q = $('btq'), res = $('btres'), hits = [], hi = 0;
    function runSearch() {
      var s = fold(q.value.trim());
      if (s.length < 2) { res.hidden = true; return; }
      var words = s.split(/\s+/);
      hits = idx.filter(function (x) { return words.every(function (w) { return x[1].indexOf(w) >= 0; }); }).map(function (x) { return x[0]; })
        .sort(function (a, b) { return (fold(P[b].n).indexOf(words[0]) === 0) - (fold(P[a].n).indexOf(words[0]) === 0) || P[b].h - P[a].h; }).slice(0, 30);
      hi = 0;
      res.innerHTML = hits.length ? hits.map(function (id, i) { return '<button type="button" data-id="' + id + '"' + (i === 0 ? ' class="on"' : '') + '><span>' + esc(P[id].n) + '</span><small>' + (P[id].d != null ? 'd. ' + yr(P[id].d) + ' · ' : '') + P[id].h + ' ḥadīth</small></button>'; }).join('') : '<button type="button" disabled><span>No narrator by that name</span></button>';
      res.hidden = false;
      res.querySelectorAll('button[data-id]').forEach(function (b) { b.onclick = function () { pick(+b.dataset.id); }; });
    }
    function pick(id) { res.hidden = true; q.value = P[id].n; select(id); }
    q.addEventListener('input', runSearch);
    q.addEventListener('keydown', function (e) {
      if (res.hidden) return;
      var bs = res.querySelectorAll('button[data-id]');
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && bs.length) { e.preventDefault(); hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs.forEach(function (b, i) { b.classList.toggle('on', i === hi); }); bs[hi].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter' && hits[hi] != null) { e.preventDefault(); pick(hits[hi]); }
      else if (e.key === 'Escape') res.hidden = true;
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.bt-search')) res.hidden = true; });

    /* ---------- index ---------- */
    var sortK = 'h', sortDir = -1, ixg = $('ixg');
    Array.from(new Set(ids.map(function (id) { return P[id].g; }).filter(function (g) { return g != null && g > 0; }))).sort(function (a, b) { return a - b; })
      .forEach(function (g) { ixg.insertAdjacentHTML('beforeend', '<option value="' + g + '">' + g + '. ' + (GEN[g] || '') + '</option>'); });
    ixg.insertAdjacentHTML('beforeend', '<option value="none">Not recorded</option>');
    function drawIndex() {
      var s = fold($('ixq').value.trim()), g = ixg.value;
      var rows = ids.filter(function (id) { return id > 0 && (!g || (g === 'none' ? P[id].g == null : P[id].g == g)) && (!s || fold(P[id].n + ' ' + (P[id].k || '') + ' ' + (P[id].dp || '') + ' ' + (P[id].pl || '')).indexOf(s) >= 0); });
      rows.sort(function (a, b) { var x = P[a][sortK], y = P[b][sortK]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir; });
      $('ixn').textContent = rows.length.toLocaleString('en-GB') + ' narrators';
      $('ixb').innerHTML = rows.map(function (id) { var p = P[id]; return '<tr data-id="' + id + '"><td><span class="dot" style="background:' + gcol(id) + '"></span>' + esc(p.n) + '</td><td>' + (p.g != null ? p.g : '–') + '</td><td class="r">' + (p.d != null ? (p.d < 0 ? yr(p.d) : p.d) : '–') + '</td><td>' + esc(p.dp || '') + '</td><td>' + esc(p.gr || '') + '</td><td class="r">' + p.h + '</td></tr>'; }).join('');
      document.querySelectorAll('.bt-index th[data-k]').forEach(function (th) { th.setAttribute('aria-sort', th.dataset.k === sortK ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'); });
    }
    $('ixb').onclick = function (e) { var tr = e.target.closest('tr'); if (tr) select(+tr.dataset.id); };
    document.querySelectorAll('.bt-index th[data-k]').forEach(function (th) { th.onclick = function () { var k = th.dataset.k; sortDir = sortK === k ? -sortDir : (k === 'h' ? -1 : 1); sortK = k; drawIndex(); }; });
    $('ixq').oninput = drawIndex; ixg.onchange = drawIndex;

    function showView(v) {
      $('treeView').hidden = v !== 'tree'; $('indexView').hidden = v !== 'index';
      $('dirSeg').style.visibility = v === 'tree' ? 'visible' : 'hidden';
      $('vTree').setAttribute('aria-pressed', String(v === 'tree')); $('vIndex').setAttribute('aria-pressed', String(v === 'index'));
      if (v === 'index') drawIndex(); else render(false);
    }
    $('vTree').onclick = function () { showView('tree'); };
    $('vIndex').onclick = function () { showView('index'); };
    $('dDown').onclick = function () { showView('tree'); setRoot(-1, 'down'); };
    $('dUp').onclick = function () { showView('tree'); setRoot(0, 'up'); };
    setRoot(-1, 'down');
    if (window.innerWidth <= 860) card.hidden = true;
    if (location.hash === '#index') showView('index');
  }
})();
