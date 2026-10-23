/* "Copy" button inside a work row's Cite drop-down */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.cite-copy');
  if (!b) return;
  var t = b.parentNode.querySelector('.cite-text');
  if (!t) return;
  var done = function () { var o = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = o; }, 1500); };
  if (navigator.clipboard) navigator.clipboard.writeText(t.textContent).then(done, function () {});
  else { var r = document.createRange(); r.selectNode(t); var s = getSelection(); s.removeAllRanges(); s.addRange(r); try { document.execCommand('copy'); done(); } catch (x) {} }
});
