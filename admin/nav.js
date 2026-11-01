/* IPC Admin — the menu bar's behaviour (PLAN-13 Phase 2).
 *
 * nav.php's drop-downs are <details>/<summary>, so opening and closing them
 * needs no script at all and keeps working with JavaScript off. This file
 * adds only what <details> cannot do by itself:
 *   - one drop-down open at a time;
 *   - Escape or a click elsewhere closes it;
 *   - the phone Menu button, which shows the whole menu as a panel under
 *     the bar with every group already open.
 *
 * Loaded straight after the bar and NOT deferred: it marks the bar .has-js
 * before the first paint, which is what hides the full menu behind the Menu
 * button on a phone. External file: the admin CSP is script-src 'self'.
 */
(function () {
  "use strict";

  var hdr = document.querySelector(".ipc-admin-header");
  if (!hdr) return;
  hdr.classList.add("has-js");

  var groups = Array.prototype.slice.call(hdr.querySelectorAll("details.nav-group"));
  var toggle = hdr.querySelector(".menu-toggle");
  var phone = window.matchMedia("(max-width: 899px)");

  function closeAll(except) {
    groups.forEach(function (d) { if (d !== except) d.open = false; });
  }
  function menuOpen() { return hdr.classList.contains("menu-open"); }
  function setMenu(on) {
    hdr.classList.toggle("menu-open", on);
    if (toggle) {
      toggle.setAttribute("aria-expanded", on ? "true" : "false");
      toggle.textContent = on ? "Close" : "Menu";
    }
    // In the phone panel every group starts open, so the menu reads as one
    // list; on the desktop bar they start closed.
    groups.forEach(function (d) { d.open = on; });
  }

  groups.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open && !phone.matches) closeAll(d);
    });
  });

  if (toggle) toggle.addEventListener("click", function () { setMenu(!menuOpen()); });

  document.addEventListener("click", function (e) {
    if (hdr.contains(e.target)) {
      if (phone.matches) return;
      // A click inside the bar but outside every drop-down (the logo, the
      // bar's own background) still closes an open one.
      groups.forEach(function (d) { if (d.open && !d.contains(e.target)) d.open = false; });
      return;
    }
    if (phone.matches) { if (menuOpen()) setMenu(false); return; }
    closeAll(null);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" && e.key !== "Esc") return;
    if (phone.matches && menuOpen()) {
      setMenu(false);
      if (toggle) toggle.focus();
      return;
    }
    var open = groups.filter(function (d) { return d.open; })[0];
    if (open) {
      open.open = false;
      open.querySelector("summary").focus();
    }
  });

  // Crossing the breakpoint (rotating a tablet) starts from a closed menu.
  function reset() { if (menuOpen()) setMenu(false); else closeAll(null); }
  if (phone.addEventListener) phone.addEventListener("change", reset);
  else if (phone.addListener) phone.addListener(reset);
})();
