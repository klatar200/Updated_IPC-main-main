/*
 * Reusable repeatable-rows editor for content.php.
 *
 * Each editable section is a container with [data-section="NAME"] holding a
 * .rows list of .content-row items plus a matching <template id="tpl-NAME">.
 * Row fields carry data-field="KEY"; this script keeps their name attributes
 * numbered as NAME[i][KEY] so PHP receives contiguous, grouped rows regardless
 * of adds, removes, or reordering.
 *
 * CSP-safe: external file (script-src 'self'), no inline handlers — all wiring
 * is a single delegated listener.
 */
(function () {
  function rowsOf(section) {
    var wrap = document.querySelector('[data-section="' + section + '"] .rows');
    return wrap ? wrap.querySelectorAll(':scope > .content-row') : [];
  }

  // Must match content.php's field_id() exactly. The id is derived from the
  // posted name rather than a counter, so it survives reordering — but only if
  // both sides compute it the same way. (4.31)
  function fieldId(name) {
    return 'f-' + name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function titleOf(section) {
    var host = document.querySelector('[data-section="' + section + '"]');
    return (host && host.getAttribute('data-section-title')) || '';
  }

  // Renumber every row's fields (and its visible label) after any change.
  function reindex(section) {
    var rows = rowsOf(section);
    var title = titleOf(section);
    Array.prototype.forEach.call(rows, function (row, i) {
      row.querySelectorAll('[data-field]').forEach(function (el) {
        var name = section + '[' + i + '][' + el.getAttribute('data-field') + ']';
        el.name = name;
        // The id, the label's `for`, and the visually-hidden row context all
        // have to move with the name. Leaving any of them behind is worse than
        // never having labelled the form: a stale `for` points a screen reader
        // at a control in a different row. (4.31)
        var id = fieldId(name);
        el.id = id;
        var group = el.closest('.form-group');
        var lab = group && group.querySelector('label');
        if (lab) {
          lab.setAttribute('for', id);
          var ctx = lab.querySelector('[data-rowctx]');
          if (ctx) ctx.textContent = ' — row ' + (i + 1) + (title ? ' of ' + title : '');
        }
      });
      var num = row.querySelector('.row-num');
      if (num) num.textContent = '#' + (i + 1);
      var up = row.querySelector('[data-action="up"]');
      var down = row.querySelector('[data-action="down"]');
      if (up) up.disabled = i === 0;
      if (down) down.disabled = i === rows.length - 1;
      // Same reasoning for the row controls: "Move up" eighteen times over is
      // not a name.
      var where = 'row ' + (i + 1) + (title ? ' of ' + title : '');
      if (up) up.setAttribute('aria-label', 'Move ' + where + ' up');
      if (down) down.setAttribute('aria-label', 'Move ' + where + ' down');
      var rm = row.querySelector('[data-action="remove"]');
      if (rm) rm.setAttribute('aria-label', 'Remove ' + where);
    });
  }

  function sectionOf(el) {
    var host = el.closest('[data-section]');
    return host ? host.getAttribute('data-section') : null;
  }

  function addRow(section) {
    var wrap = document.querySelector('[data-section="' + section + '"] .rows');
    var tpl = document.getElementById('tpl-' + section);
    if (!wrap || !tpl) return;
    var clone = tpl.content.firstElementChild.cloneNode(true);
    wrap.appendChild(clone);
    reindex(section);
    var first = clone.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var action = t.getAttribute('data-action');
    if (action === 'add') {
      e.preventDefault();
      addRow(t.getAttribute('data-section') || sectionOf(t));
      return;
    }
    var row = t.closest('.content-row');
    if (!row) return;
    var section = sectionOf(row);
    if (action === 'remove') {
      e.preventDefault();
      row.remove();
      reindex(section);
    } else if (action === 'up') {
      e.preventDefault();
      if (row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
      reindex(section);
    } else if (action === 'down') {
      e.preventDefault();
      if (row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
      reindex(section);
    }
  });

  // Normalize names/labels once on load (covers server-rendered rows).
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-section]').forEach(function (s) {
      reindex(s.getAttribute('data-section'));
    });
  });
})();
