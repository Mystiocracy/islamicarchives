/* Generations (ṭabaqāt) chart, from the Directory of Muslim Scholars data. */
(function () {
  var root = document.getElementById('tq');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString('en-GB'); };
  var GEN = ['', 'The Companions', 'Senior Successors', 'Middle Successors (1st)', 'Middle Successors (2nd)', 'Junior Successors', 'Youngest Successors',
    'Senior followers of the Successors', 'Middle followers of the Successors', 'Junior followers of the Successors', 'Senior teachers of the compilers', 'Middle teachers of the compilers', 'Junior teachers of the compilers'];
  var EX = ['', 'Abū Bakr, ʿĀʾisha, Abū Hurayra', 'Saʿīd ibn al-Musayyib, ʿAlqama', 'al-Ḥasan al-Baṣrī, Ibn Sīrīn', 'al-Zuhrī, Qatāda', 'al-Aʿmash', 'Ibn Jurayj, Abū Ḥanīfa',
    'Mālik, al-Thawrī, Shuʿba', 'Ibn ʿUyayna, Ibn ʿUlayya', 'al-Shāfiʿī, Wakīʿ, ʿAbd al-Razzāq', 'Aḥmad, Ibn Abī Shayba', 'al-Dhuhlī, ʿAbd ibn Ḥumayd', 'al-Tirmidhī and his peers'];
  var D, city = -1, open = {};
  function gen(x) { return x[4] || (D.ranks[x[3]] === 'Comp.(RA)' ? 1 : 0); }
  function draw() {
    var rows = {}, grid = {};
    D.n.forEach(function (x) {
      var g = gen(x); if (!g) return;
      (grid[g] = grid[g] || {})[x[9]] = ((grid[g] || {})[x[9]] || 0) + 1;
      if (city >= 0 && x[9] !== city) return;
      (rows[g] = rows[g] || []).push(x);
    });
    // city × generation grid
    var cols = D.cities.map(function (c, i) { return i; });
    var mx = 1; for (var g = 1; g <= 12; g++) cols.forEach(function (c) { mx = Math.max(mx, (grid[g] || {})[c] || 0); });
    var h = '<table class="tq-grid"><thead><tr><th>Generation</th>' + cols.map(function (c) { return '<th><button type="button" data-c="' + c + '"' + (c === city ? ' class="on"' : '') + '>' + esc(D.cities[c]) + '</button></th>'; }).join('') + '</tr></thead><tbody>';
    for (g = 1; g <= 12; g++) {
      h += '<tr><th>' + g + '</th>' + cols.map(function (c) { var v = (grid[g] || {})[c] || 0; var a = v ? 0.08 + 0.85 * Math.sqrt(v / mx) : 0; return '<td style="--a:' + a.toFixed(2) + '" title="' + esc(D.cities[c]) + ', generation ' + g + ': ' + v + '"><button type="button" data-c="' + c + '" data-g="' + g + '">' + (v || '') + '</button></td>'; }).join('') + '</tr>';
    }
    $('#tqgrid').innerHTML = h + '</tbody></table>';
    // generation bands
    var out = '';
    for (g = 1; g <= 12; g++) {
      var r = (rows[g] || []).sort(function (a, b) { return b[10] - a[10] || a[0] - b[0]; });
      var lim = open[g] ? 400 : 28, top = r.length ? Math.max(1, r[0][10]) : 1;
      out += '<section class="tq-band" id="g' + g + '"><div class="tq-h"><span class="tq-n">' + g + '</span><div><h3>' + GEN[g] + '</h3><p>' + EX[g] + '</p></div><span class="tq-c">' + fmt(r.length) + '</span></div><div class="tq-chips">' +
        r.slice(0, lim).map(function (x) { var w = x[10] ? 1 + 0.35 * Math.sqrt(x[10] / top) : 1; return '<a href="/hadith/scholars/#id=' + x[0] + '" style="--s:' + w.toFixed(2) + '"' + (x[10] ? ' class="atl"' : '') + ' title="' + esc(x[1]) + (x[10] ? ' · ' + fmt(x[10]) + ' chains in the atlas' : '') + '"><span lang="ar" dir="rtl">' + esc(x[2] || x[1]) + '</span><small>' + esc(x[1]) + '</small></a>'; }).join('') +
        (r.length > lim ? '<button type="button" class="tq-more" data-g="' + g + '">' + fmt(r.length - lim) + ' more</button>' : '') + (r.length === 0 ? '<p class="muted">No one recorded here.</p>' : '') + '</div></section>';
    }
    $('#tqbands').innerHTML = out;
    $('#tqcity').textContent = city >= 0 ? D.cities[city] : 'all cities';
    $('#tqall').hidden = city < 0;
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]');
    if (b) { var c = +b.dataset.c; city = (c === city && !b.dataset.g) ? -1 : c; open = {}; draw(); if (b.dataset.g) document.getElementById('g' + b.dataset.g).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    var m = e.target.closest('.tq-more'); if (m) { open[m.dataset.g] = 1; draw(); return; }
    if (e.target.closest('#tqall')) { city = -1; draw(); }
  });
  fetch('/hadith/scholars/index.json').then(function (r) { return r.json(); }).then(function (d) { D = d; $('#tqload').remove(); draw(); });
})();
