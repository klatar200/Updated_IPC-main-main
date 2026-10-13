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
  // A-5.21 — tell unsaved.js that the page changed. Deliberately NOT dispatched
  // from reindex(): that also runs once at DOMContentLoaded to normalise
  // server-rendered rows, and arming the guard on page load would prompt on
  // every ordinary navigation. Only the click handlers below are real edits.
  function structural(el) {
    try {
      (el || document).dispatchEvent(new Event('ipc:structural-change', { bubbles: true }));
    } catch (e) { /* older browser: the guard simply stays as it was */ }
  }

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
    structural(wrap);
    var first = clone.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  // Focus the moved row's own arrow; when that arrow has just become disabled
  // (the row reached the top or bottom), its other arrow.
  function keepFocus(row, same, other) {
    var b = row.querySelector('[data-action="' + same + '"]');
    if (!b || b.disabled) b = row.querySelector('[data-action="' + other + '"]');
    if (b && !b.disabled) b.focus();
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
    // A12-L7-W3-G1-5 — keep the keyboard user's place, as spectable-editor.js
    // does (4.30). Moving a focused node blurs it in the browser, and a
    // removed row takes focus with it, so focus landed on <body> and the next
    // Tab-then-Enter acted on a different row.
    if (action === 'remove') {
      e.preventDefault();
      var rowParent = row.parentNode;
      var survivor = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      reindex(section);
      structural(rowParent);
      var next = survivor && survivor.querySelector('[data-action="remove"]');
      if (!next) {
        var host = rowParent.closest('[data-section]');
        next = host && host.querySelector('[data-action="add"]');
      }
      if (next) next.focus();
    } else if (action === 'up') {
      e.preventDefault();
      if (row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
      reindex(section);
      structural(row);
      keepFocus(row, 'up', 'down');
    } else if (action === 'down') {
      e.preventDefault();
      if (row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
      reindex(section);
      structural(row);
      keepFocus(row, 'down', 'up');
    }
  });

  // Normalize names/labels once on load (covers server-rendered rows).
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-section]').forEach(function (s) {
      reindex(s.getAttribute('data-section'));
    });
  });

  /**
   * PLAN-6 item 1 — warn before a family rename orphans the products in it.
   *
   * Each product stores its OWN partType. Renaming "Tape" to "Tapes" in this
   * list does not touch the catalog, so every taped product keeps saying
   * "Tape" and drops out of the renamed family on the public site. That is the
   * correct behaviour — a content save must never bulk-rewrite
   * products-all.json behind the owner — but it is not what anyone expects, so
   * it gets said out loud before the save commits.
   *
   * The server rendered the original name and the product count onto each row,
   * so this compares against what was on disk, not against another input.
   *
   * Deliberately a warning and not a block: it is his catalog, and the fix
   * (re-save those products under the new name) is one he may well be about to
   * do. Confirming proceeds; cancelling leaves the form exactly as typed.
   */
  // ANCHOR ON THE FORM'S OWN CONTENT, not on method="POST". nav.php renders a
  // Sign Out form 850 lines earlier, so querySelector('form[method="POST"]')
  // returns THAT one and this listener silently attaches to the wrong form —
  // which is exactly what happened, and the suite caught it. form_complete is
  // unique to the content form and is the field this whole page is built
  // around, so it is the right thing to match on.
  var completeField = document.querySelector('[name="form_complete"]');
  var form = completeField ? completeField.closest('form') : null;
  if (form) {
    form.addEventListener('submit', function (e) {
      var orphaned = [];
      document.querySelectorAll('[data-ipc-family-count]').forEach(function (row) {
        var was = row.getAttribute('data-ipc-family-name') || '';
        var n = parseInt(row.getAttribute('data-ipc-family-count'), 10) || 0;
        var input = row.querySelector('input[type="text"]');
        var now = input ? input.value.trim() : was;
        if (was !== '' && n > 0 && now !== was) {
          orphaned.push('  • "' + was + '" \u2192 "' + (now || '(removed)') + '" — ' +
                        n + ' product' + (n === 1 ? '' : 's'));
        }
      });
      if (!orphaned.length) return;
      var msg = 'Renaming a product family does not rename the products in it.\n\n' +
                orphaned.join('\n') + '\n\n' +
                'Those products keep their old category, and appear under the old name on the site, ' +
                'until you open each one with Edit, pick the new name in Part Type, and save.\n\n' +
                'Save anyway?';
      if (!window.confirm(msg)) e.preventDefault();
    });
  }
})();
