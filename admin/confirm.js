// CSP-compliant confirmation dialogs.
//
// The admin Content-Security-Policy is `script-src 'self'` (no 'unsafe-inline'),
// which blocks inline onclick/onsubmit handlers. So instead of inline
// `onclick="return confirm(...)"`, elements carry a `data-confirm="message"`
// attribute and this external script wires up the prompts.
//
//   <a href="..." data-confirm="Delete X?">Delete</a>
//   <form ... data-confirm="Remove this PDF?">...</form>
(function () {
  // Links / buttons: confirm on click, cancel navigation if declined.
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('a[data-confirm]') : null;
    if (!el) return;
    if (!window.confirm(el.getAttribute('data-confirm'))) {
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
