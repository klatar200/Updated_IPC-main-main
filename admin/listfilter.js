/* IPC Admin — filters that apply as you type (PLAN-13 Phase 6, §2 F1/F2).
 *
 * For <form method="GET" data-live-filter="#results">: the form is a plain
 * query-string filter, and without JavaScript its Filter button submits it —
 * the page does every bit of the filtering and paging on the server. With
 * JavaScript, typing or picking an option fetches that same URL, swaps in its
 * #results and puts the URL in the address bar (replaceState), so Back, a
 * bookmark and a reload all show what is on screen. One source of truth: the
 * server's filter. Inquiries and Audit Log.
 *
 * Requests carry `X-Requested-With: fetch`. inquiries.php reads it so a
 * filter does not count as "looking" at the leads again (see there).
 */
(function () {
  "use strict";

  var form = document.querySelector("form[data-live-filter]");
  if (!form || !window.fetch || !window.DOMParser || !window.URLSearchParams || !window.FormData) return;
  var sel = form.getAttribute("data-live-filter");
  var target = document.querySelector(sel);
  if (!target) return;
  form.classList.add("is-live");   // CSS hides the Filter button: it is not needed

  function urlFor(extra) {
    var out = new URLSearchParams();
    new FormData(form).forEach(function (v, k) { if (v !== "") out.append(k, v); });
    if (extra) Object.keys(extra).forEach(function (k) { out.set(k, extra[k]); });
    var qs = out.toString();
    return location.pathname + (qs ? "?" + qs : "");
  }

  var seq = 0, timer = 0;
  function load(u) {
    var mine = ++seq;
    target.setAttribute("aria-busy", "true");
    fetch(u, { credentials: "same-origin", headers: { "X-Requested-With": "fetch" } })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (html) {
        if (mine !== seq) return;
        var fresh = new DOMParser().parseFromString(html, "text/html").querySelector(sel);
        // No results block: most likely the sign-in page (the session ended).
        // A real navigation shows it, and the filter is in the URL.
        if (!fresh) { location.href = u; return; }
        target.innerHTML = fresh.innerHTML;
        history.replaceState(null, "", u);
      })
      .catch(function () { if (mine === seq) location.href = u; })
      .then(function () { if (mine === seq) target.removeAttribute("aria-busy"); });
  }

  form.addEventListener("input", function (e) {
    clearTimeout(timer);
    var typing = e.target && /^(text|search)$/.test(e.target.type || "");
    timer = setTimeout(function () { load(urlFor()); }, typing ? 300 : 0);
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearTimeout(timer);
    load(urlFor());
  });
  // Paging links inside the results stay on this page too.
  target.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-page]");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    e.preventDefault();
    load(a.getAttribute("href"));
    form.scrollIntoView({ block: "start" });
  });
})();
