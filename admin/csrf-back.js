// The recovery control on csrf_fail_page(), moved out of an inline handler.
//
// The admin Content-Security-Policy is `script-src 'self'` with no
// 'unsafe-inline', so `onclick="history.back()"` is refused by the browser —
// Chromium logs "Refused to execute inline event handler" and the click does
// nothing at all. `php -S` ignores .htaccess (GUARDRAILS 4.3), so this was
// invisible to every local suite and broken only on the live server.
//
// That matters more here than anywhere else in the admin. require_auth()
// renders this page on an expired POST instead of redirecting, because a 302
// turns the POST into a GET and silently discards everything typed — CLAUDE.md
// invariant 12. The page exists to say "your typing is still in the previous
// page, click Back to get it", and Back was the dead control.
//
// admin/confirm.js already solved the same problem for confirmation dialogs;
// this is the same pattern for the one page that renders out of config.php and
// so has no <script> tags of its own. (audit-runs/audit6.md A-6.1)
(function () {
  function wire() {
    var els = document.querySelectorAll('[data-ipc-back]');
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('click', function (e) {
        e.preventDefault();
        history.back();
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
