// Product list live search, category filter and row menus — external file so
// it complies with the admin Content-Security-Policy (script-src 'self'; no
// inline scripts allowed).
(function () {
  var input    = document.getElementById('productSearch');
  var empty    = document.getElementById('searchEmpty');
  var count    = document.getElementById('searchCount');
  var rows     = Array.prototype.slice.call(document.querySelectorAll('tr[data-search]'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));
  var chips    = Array.prototype.slice.call(document.querySelectorAll('.cat-chips a[data-cat]'));
  if (!input) return;

  var total = rows.length;
  // PLAN-13 Phase 5 (§2 E4) — the category chips are links to each section's
  // id, which is what they do without JavaScript. Here they filter instead:
  // one category, or All. The search box works inside the chosen category.
  var cat = '';

  function apply() {
    var q = input.value.trim().toLowerCase();
    var visibleCount = 0;

    sections.forEach(function (sec) {
      var inCat = cat === '' || sec.getAttribute('data-cat') === cat;
      var shown = 0;
      Array.prototype.forEach.call(sec.querySelectorAll('tr[data-search]'), function (row) {
        // NEW-N2-14 (audit 2026-09-27) — lower-cased HERE, not in PHP. index.php
        // used strtolower(), which is ASCII-only (and under a Latin-1 locale
        // breaks UTF-8 so h() returns ""), while this side lower-cases Unicode:
        // an "Ö" typed in the box never matched the "Ö" in a name.
        var match = inCat && (q === '' || (row.getAttribute('data-search') || '').toLowerCase().indexOf(q) !== -1);
        row.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      // Hide a category section entirely when none of its rows match.
      sec.style.display = shown ? '' : 'none';
      visibleCount += shown;
    });

    empty.style.display = visibleCount ? 'none' : '';
    count.textContent = q === '' && cat === ''
      ? ''
      : visibleCount + ' of ' + total + (visibleCount === 1 ? ' product' : ' products');
  }

  input.addEventListener('input', apply);

  chips.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      cat = a.getAttribute('data-cat') || '';
      chips.forEach(function (c) {
        if (c === a) c.setAttribute('aria-current', 'true');
        else c.removeAttribute('aria-current');
      });
      apply();
    });
  });

  // ── The More menu on each row (<details class="row-more">) ───────────────
  // Native <details> already opens by click, tap and keyboard; this keeps one
  // open at a time and closes it on Escape (focus back on More) or a click
  // anywhere else, as the menu bar's drop-downs do (nav.js).
  var menus = Array.prototype.slice.call(document.querySelectorAll('details.row-more'));
  menus.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      menus.forEach(function (o) { if (o !== d && o.open) o.open = false; });
    });
  });
  document.addEventListener('click', function (e) {
    menus.forEach(function (d) { if (d.open && !d.contains(e.target)) d.open = false; });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    menus.forEach(function (d) {
      if (!d.open) return;
      d.open = false;
      var s = d.querySelector('summary');
      if (s) s.focus();
    });
  });
})();
