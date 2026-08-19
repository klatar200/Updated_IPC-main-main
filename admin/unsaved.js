/* IPC Admin — unsaved-changes guard + session keepalive.
 *
 * Two failures this file exists to prevent (DEPLOY_READINESS_v2 T1.8):
 *   1. nav.php puts 10 navigation links across the top of every editing page,
 *      and there was no beforeunload handler anywhere in admin/. One stray
 *      click threw away everything typed since the page loaded.
 *   2. The session could expire underneath a long edit, so Save returned a
 *      bare 403. A lightweight ping keeps it alive while the tab is open AND
 *      warns the moment it is gone, instead of at Save time.
 *
 * Include with:  <script src="unsaved.js" defer></script>
 * Opt a form out with  data-no-guard  on the <form>.
 */
(function () {
  "use strict";

  var dirty = false;
  var submitting = false;

  function forms() {
    return Array.prototype.slice.call(document.querySelectorAll("form:not([data-no-guard])"));
  }

  function markDirty() { dirty = true; }

  // A-5.21 — the guard armed only on `input`/`change`, but the content and spec
  // editors mutate the DOM from `click`: removing a row, reordering with the
  // ↑/↓ arrows, adding a row. Reordering the FAQ and then clicking a nav link
  // lost the work silently — and the delete confirm even promises the row "is
  // deleted for good when you click Save Content", which is exactly the state
  // this guard exists to protect. The editors announce those edits by
  // dispatching a bubbling `ipc:structural-change`.
  document.addEventListener("ipc:structural-change", markDirty, true);

  forms().forEach(function (f) {
    f.addEventListener("input", markDirty, true);
    f.addEventListener("change", markDirty, true);
    // A-5.22 — preventDefault() in another listener does not stop this one, and
    // `submitting` was never reset, so any cancelled submit disarmed the guard
    // for the rest of the page's life. Two in-repo listeners cancel submits:
    // the Advanced-mode invalid-JSON block (which even says "nothing was
    // saved") and content-editor's family-rename confirm. After the event has
    // finished dispatching, defaultPrevented tells us the navigation is not
    // happening, so the page is still dirty and still worth protecting.
    f.addEventListener("submit", function (e) {
      submitting = true;
      setTimeout(function () { if (e.defaultPrevented) submitting = false; }, 0);
    });
  });

  // Content/spec editors rebuild their DOM, so catch late-added controls too.
  document.addEventListener("input", function (e) {
    if (e.target && e.target.closest && e.target.closest("form:not([data-no-guard])")) markDirty();
  }, true);

  window.addEventListener("beforeunload", function (e) {
    if (!dirty || submitting) return;
    e.preventDefault();
    e.returnValue = ""; // required for Chrome/Safari to show the native prompt
    return "";
  });

  // ── Session keepalive + expiry warning ────────────────────────────────────
  // ping.php returns {"ok":true} while signed in, {"ok":false} once the
  // session is gone. Every 5 minutes: cheap, and it refreshes the session's
  // last-access time so an open editing tab does not time out.
  var banner = null;
  function showExpired() {
    if (banner) return;
    banner = document.createElement("div");
    banner.setAttribute("role", "alert");
    banner.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:99999;background:#fef2f2;color:#991b1b;" +
      "border-bottom:1px solid #fecaca;padding:12px 16px;font:14px/1.5 system-ui,sans-serif;" +
      "text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)";
    banner.innerHTML =
      "<strong>You have been signed out.</strong> Your typing on this page is safe — " +
      '<a href="auth.php" target="_blank" rel="noopener" style="color:#991b1b;font-weight:700">' +
      "sign in again in a new tab</a>, come back here, and click Save.";
    document.body.appendChild(banner);
  }

  function ping() {
    if (!window.fetch) return;
    fetch("ping.php", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { ok: false }; })
      .then(function (j) { if (!j || j.ok !== true) showExpired(); })
      .catch(function () { /* offline — say nothing, the next ping decides */ });
  }

  setInterval(ping, 5 * 60 * 1000);
})();
