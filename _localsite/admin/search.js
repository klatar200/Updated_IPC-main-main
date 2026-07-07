// Product list live search — external file so it complies with the admin
// Content-Security-Policy (script-src 'self'; no inline scripts allowed).
(function () {
  var input    = document.getElementById('productSearch');
  var empty    = document.getElementById('searchEmpty');
  var count    = document.getElementById('searchCount');
  var rows     = Array.prototype.slice.call(document.querySelectorAll('tr[data-search]'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));
  if (!input) return;

  var total = rows.length;

  function apply() {
    var q = input.value.trim().toLowerCase();
    var visibleCount = 0;

    rows.forEach(function (row) {
      var match = q === '' || row.getAttribute('data-search').indexOf(q) !== -1;
      row.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });

    // Hide a category section entirely when none of its rows match.
    sections.forEach(function (sec) {
      var visible = sec.querySelectorAll('tr[data-search]:not([style*="display: none"])').length;
      sec.style.display = visible ? '' : 'none';
    });

    empty.style.display = visibleCount ? 'none' : '';
    count.textContent = q === ''
      ? ''
      : visibleCount + ' of ' + total + (visibleCount === 1 ? ' match' : ' matches');
  }

  input.addEventListener('input', apply);
})();
