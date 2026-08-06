// CSP-compliant confirmation dialogs.
//
// The admin Content-Security-Policy is `script-src 'self'` (no 'unsafe-inline'),
// which blocks inline onclick/onsubmit handlers. So instead of inline
// `onclick="return confirm(...)"`, elements carry a `data-confirm="message"`
// attribute and this external script wires up the prompts.
//
//   <a href="..." data-confirm="Delete X?">Delete</a>
//   <form ... data-confirm="Remove this PDF?">...</form>
//   <button type="button" data-confirm="Remove {it}?"
//           data-confirm-scope=".content-row" data-confirm-from="input.ci">
//
// {it} is substituted at CLICK time with the current text of the first element
// matching data-confirm-from inside the nearest data-confirm-scope ancestor, so
// the prompt names the thing being deleted rather than asking "Are you sure?".
// Resolving at click time (not at render) means a row Rick has just renamed
// still prompts with the name he can see. (PLAN-2 4.13)
(function () {
  function messageFor(el) {
    var msg = el.getAttribute('data-confirm') || '';
    if (msg.indexOf('{it}') < 0) return msg;
    var scopeSel = el.getAttribute('data-confirm-scope');
    var fromSel = el.getAttribute('data-confirm-from');
    var label = '';
    if (scopeSel && fromSel && el.closest) {
      var scope = el.closest(scopeSel);
      var src = scope ? scope.querySelector(fromSel) : null;
      if (src) label = ((src.value != null ? src.value : src.textContent) || '').trim();
    }
    if (label.length > 60) label = label.slice(0, 60) + '…';
    // No usable label (a brand-new, still-empty row) — stay generic rather than
    // printing empty quotes.
    return msg.replace('{it}', label ? '“' + label + '”' : 'this item');
  }

  // Links and buttons: confirm on click, cancel the action if declined.
  //
  // stopPropagation() in the CAPTURE phase is what makes "Cancel" actually
  // cancel: content-editor.js removes the row from a bubble-phase listener, so
  // stopping the event here means that listener never runs. Without the capture
  // phase the row would be gone before the prompt was answered.
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('a[data-confirm], button[data-confirm]') : null;
    if (!el) return;
    if (!window.confirm(messageFor(el))) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Forms: confirm on submit, cancel submission if declined.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form && form.hasAttribute && form.hasAttribute('data-confirm')) {
      if (!window.confirm(form.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    }
  }, true);
})();
