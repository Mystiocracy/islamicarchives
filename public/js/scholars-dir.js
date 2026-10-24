/* Directory of the Muslim Scholars Database (muslimscholars.info), searchable, with a profile panel. */
(function () {
  var BASE = '/hadith/scholars/', root = document.getElementById('sd');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var D = null, N = [], keys = null, list = [], page = 0, sortK = 'id', cur = null, shards = {}, theme = -1, themeSet = null;
  var PER = 100;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString('en-GB'); };
  var ce = function (ah) { return ah > 0 ? Math.round(ah * 0.970229 + 621.5643) : null; };
  var arNorm = function (s) { return String(s).replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ‎]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim(); };
  var enNorm = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[‘’'`ʿʾ\-]/g, '').replace(/\s+/g, ' ').trim(); };

  function filter() {
    var q = $('#sdq').value.trim(), r = $('#sdr').value, c = $('#sdc').value, g = $('#sdg').checked, a = $('#sda').checked;
    var qa = arNorm(q), qe = enNorm(q), qi = /^\d+$/.test(q) ? +q : null;
    if (q && !keys) keys = N.map(function (x) { return [arNorm(x[2]), enNorm(x[1])]; });
    list = [];
    for (var i = 0; i < N.length; i++) {
      var x = N[i];
      if (r !== '' && x[3] !== +r) continue;
      if (c !== '' && x[9] !== +c) continue;
      if (themeSet && !themeSet[i]) continue;
      if (g && !x[7]) continue;
      if (a && x[8] < 0) continue;
      if (q && !(qi === x[0] || (qa && keys[i][0].indexOf(qa) >= 0) || (qe && keys[i][1].indexOf(qe) >= 0))) continue;
      list.push(i);
    }
    var k = sortK;
    list.sort(function (p, q2) {
      var A = N[p], B = N[q2];
      if (k === 'd') return (A[5] == null ? 1e9 : A[5]) - (B[5] == null ? 1e9 : B[5]);
      if (k === 'n') return A[1].localeCompare(B[1]);
      if (k === 'h') return B[10] - A[10];
      if (k === 'g') return (A[4] || 99) - (B[4] || 99);
      return A[0] - B[0];
    });
    page = 0; draw();
  }
  function draw() {
    var s = page * PER, rows = list.slice(s, s + PER);
    $('#sdn').textContent = fmt(list.length) + ' of ' + fmt(N.length);
    $('#sdb').innerHTML = rows.map(function (i) {
      var x = N[i];
      return '<tr data-i="' + i + '"' + (cur === i ? ' class="on"' : '') + '><td class="r">' + x[0] + '</td><td><button type="button" class="sd-n">' + esc(x[1]) + '</button></td><td lang="ar" dir="rtl" class="ar">' + esc(x[2]) + '</td><td>' + esc(D.ranks[x[3]]) + (x[4] ? ' · ' + x[4] : '') + '</td><td>' + (x[9] >= 0 ? esc(D.cities[x[9]]) : '') + '</td><td class="r">' + (x[5] != null ? (x[5] < 0 ? -x[5] + ' BH' : x[5]) : '–') + '</td><td>' + esc(x[7]) + '</td><td class="r">' + (x[10] ? fmt(x[10]) : '') + '</td></tr>';
    }).join('');
    $('#sdpg').innerHTML = (page > 0 ? '<button type="button" data-pg="-1">‹ Previous</button>' : '') + '<span>' + (list.length ? fmt(s + 1) + '–' + fmt(Math.min(s + PER, list.length)) : '') + '</span>' + (s + PER < list.length ? '<button type="button" data-pg="1">Next ›</button>' : '');
  }
  function prof(i) {
    cur = i; var x = N[i], k = Math.floor(i / D.sh);
    root.querySelectorAll('#sdb tr').forEach(function (t) { t.classList.toggle('on', +t.dataset.i === i); });
    if (!shards[k]) shards[k] = fetch(BASE + 'p/' + k + '.json').then(function (r) { return r.json(); });
    shards[k].then(function (S) {
      var p = S[x[0]] || {}, h = '';
      h += '<button type="button" class="sd-x" aria-label="Close">×</button>';
      h += '<p class="eyebrow">' + esc(D.ranks[x[3]]) + (x[4] ? ' · generation ' + x[4] : '') + ' · ID ' + x[0] + '</p>';
      if (x[2]) h += '<h2 lang="ar" dir="rtl" class="ar">' + esc(x[2]) + '</h2>';
      h += '<p class="en">' + esc(x[1]) + (p.kunya ? ' <span class="muted">(' + esc(p.kunya) + ')</span>' : '') + '</p>';
      if (p.fullName) h += '<p class="full">' + esc(p.fullName) + '</p>';
      if (p.taqribVerdict) h += '<p class="verd" lang="ar" dir="rtl">' + esc([p.taqribSigla, p.taqribVerdict].filter(Boolean).join(' – ')) + '</p>';
      h += '<dl>';
      [['Born', p.birth], ['Died', p.death && p.death.replace(/\[\s*Natural\s*\]/, '').replace(/^\(\)$/, '')], ['Lived in', p.places], ['Grade', p.grade], ['Parents', p.parents], ['Siblings', p.siblings], ['Spouses', p.spouses], ['Children', p.children], ['Interests', p.interests && p.interests.join(', ')]].forEach(function (r) { if (r[1] && String(r[1]).trim()) h += '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; });
      if (p.narr) h += '<dt>Narrations</dt><dd>' + Object.keys(p.narr).map(function (b) { return esc(b) + ' ' + p.narr[b]; }).join(' · ') + '</dd>';
      h += '</dl>';
      if (x[8] >= 0) h += '<p><a class="sd-btn" href="/hadith/narrators/#n=' + x[8] + '">Open in the isnad atlas →</a></p>';
      if (p.bio) h += '<h3>Biography</h3><p class="bio">' + esc(p.bio) + '</p>';
      var ppl = function (arr) { return arr.map(function (t) { var j = t[0] != null ? idOf[t[0]] : null; return j != null ? '<button type="button" class="sd-l" data-i="' + j + '">' + esc(t[1]) + '</button>' : '<span>' + esc(t[1]) + '</span>'; }).join(', '); };
      if (p.teachers) h += '<h3>Teachers</h3><p class="ppl">' + ppl(p.teachers) + '</p>';
      if (p.students) h += '<h3>Students</h3><p class="ppl">' + ppl(p.students) + '</p>';
      if (p.kamalFrom) h += '<h3>روى عن · Tahdhīb al-Kamāl</h3><ol class="kam" lang="ar" dir="rtl">' + p.kamalFrom.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>';
      if (p.kamalTo) h += '<h3>روى عنه · Tahdhīb al-Kamāl</h3><ol class="kam" lang="ar" dir="rtl">' + p.kamalTo.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>';
      if (p.nameForms) h += '<h3>Names used in the ḥadīth books</h3><p class="ar forms" lang="ar" dir="rtl">' + p.nameForms.map(esc).join(' · ') + '</p>';
      if (p.tags) h += '<p class="tags">' + p.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</p>';
      if (p.refs) h += '<p class="refs">References: ' + p.refs.map(function (r) { return esc(r[0]) + (r[1] ? ' [' + esc(r[1]) + ']' : ''); }).join(' · ') + '</p>';
      h += '<p class="src">From the <a href="https://muslimscholars.info/manage.php?submit=scholar&amp;ID=' + x[0] + '" target="_blank" rel="noopener">Muslim Scholars Database</a> (Arees Institute)' + (p.lastUpdated ? ', entry updated ' + esc(p.lastUpdated) : '') + '.</p>';
      $('#sdp').innerHTML = h; $('#sdp').hidden = false; root.classList.add('open');
      try { history.replaceState(null, '', '#id=' + x[0]); } catch (e) {}
      $('#sdp').scrollTop = 0;
    });
  }
  var idOf = {};
  root.addEventListener('click', function (e) {
    var t = e.target.closest('tr[data-i]'); if (t) { prof(+t.dataset.i); return; }
    var l = e.target.closest('.sd-l'); if (l) { prof(+l.dataset.i); return; }
    if (e.target.closest('.sd-x')) { $('#sdp').hidden = true; root.classList.remove('open'); cur = null; draw(); return; }
    var pg = e.target.closest('[data-pg]'); if (pg) { page += +pg.dataset.pg; draw(); root.querySelector('.sd-tw').scrollTop = 0; return; }
    var th = e.target.closest('th[data-k]'); if (th) { sortK = th.dataset.k; root.querySelectorAll('th[data-k]').forEach(function (x) { x.removeAttribute('aria-sort'); }); th.setAttribute('aria-sort', 'ascending'); filter(); }
  });
  function setTheme(t) {
    theme = t; themeSet = null;
    if (t >= 0) { themeSet = {}; D.themes[t][1].forEach(function (i) { themeSet[i] = 1; }); }
    root.querySelectorAll('.sd-th button').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.t === t); });
    try { history.replaceState(null, '', t >= 0 ? '#theme=' + t : location.pathname); } catch (e) {}
    filter();
  }
  root.addEventListener('click', function (e) { var b = e.target.closest('.sd-th button'); if (b) setTheme(+b.dataset.t === theme ? -1 : +b.dataset.t); });
  ['#sdq', '#sdr', '#sdc', '#sdg', '#sda'].forEach(function (s) { $(s).addEventListener(s === '#sdq' ? 'input' : 'change', filter); });
  fetch(BASE + 'index.json').then(function (r) { return r.json(); }).then(function (d) {
    D = d; N = d.n; N.forEach(function (x, i) { idOf[x[0]] = i; });
    $('#sdr').innerHTML = '<option value="">All ranks</option>' + d.ranks.map(function (r, i) { return '<option value="' + i + '">' + esc(r) + '</option>'; }).join('');
    $('#sdc').innerHTML = '<option value="">All cities</option>' + d.cities.map(function (r, i) { return '<option value="' + i + '">' + esc(r) + '</option>'; }).join('');
    $('#sdth').innerHTML = d.themes.map(function (t, i) { return '<button type="button" data-t="' + i + '" aria-pressed="false">' + esc(t[0]) + ' <b>' + fmt(t[1].length) + '</b></button>'; }).join('');
    $('#sdload').remove();
    var mt = location.hash.match(/theme=(\d+)/); if (mt) setTheme(+mt[1]); else filter();
    var m = location.hash.match(/id=(\d+)/); if (m && idOf[+m[1]] != null) prof(idOf[+m[1]]);
  });
})();
