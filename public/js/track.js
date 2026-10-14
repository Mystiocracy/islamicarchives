// Counts downloads, "read at source" / "watch" clicks and searches as GoatCounter events.
(function () {
  function count(path, title) {
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: path, title: title, event: true });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var m = href.match(/^\/downloads\/(.+)$/);
    if (m) return count('download/' + m[1], 'Download: ' + m[1]);
    if (/^https?:/.test(href) && a.host !== location.host) {
      var work = location.pathname.match(/^\/works\/([^/]+)/);
      count('out/' + (work ? work[1] : location.pathname.replace(/^\/|\/$/g, '') || 'home') + ' -> ' + a.host, 'Outbound: ' + a.host);
    }
  });
  document.addEventListener('submit', function (e) {
    var q = e.target.querySelector && e.target.querySelector('input[name="q"]');
    if (q && q.value.trim()) count('search/' + q.value.trim().toLowerCase().slice(0, 60), 'Search: ' + q.value.trim());
  });
})();
