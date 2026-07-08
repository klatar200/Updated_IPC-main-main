/*
 * Scroll-spy for the Help & Documentation sidebar (help.php).
 *
 * Highlights the table-of-contents link for whichever section is currently
 * in view as the visitor scrolls, and removes the highlight once they scroll
 * past it. Uses IntersectionObserver so it's smooth and cheap (no scroll-event
 * polling). If IntersectionObserver isn't available, the page still works
 * fine — the links just won't highlight.
 */
(function () {
  "use strict";

  var toc = document.querySelector(".help-toc");
  if (!toc) return;

  var sections = Array.prototype.slice.call(
    document.querySelectorAll(".help-content .help-section[id]")
  );
  if (!sections.length) return;

  // Map each section id -> its sidebar link, and record top-to-bottom order.
  var linkMap = {};
  Array.prototype.forEach.call(toc.querySelectorAll('a[href^="#"]'), function (a) {
    linkMap[a.getAttribute("href").slice(1)] = a;
  });
  var order = sections.map(function (s) { return s.id; });
  var lastId = order[order.length - 1];

  if (!("IntersectionObserver" in window)) return;

  var activeSet = Object.create(null);
  var currentActive = null;

  // True once the page can't scroll any further. Short trailing sections
  // (like the last one) may never cross into the "trigger band" below —
  // there just isn't enough room left to scroll them up that far — so
  // without this check the second-to-last section would stay highlighted
  // forever once you hit the bottom of the page.
  function isAtBottom() {
    var doc = document.documentElement;
    return window.innerHeight + Math.ceil(window.scrollY) >= doc.scrollHeight - 2;
  }

  // Among all sections currently inside the "trigger band" near the top of
  // the viewport, the correct one to highlight is the last one in document
  // order (i.e. the one we've most recently scrolled into).
  function pickActive() {
    if (isAtBottom()) return lastId;
    var chosen = null;
    for (var i = 0; i < order.length; i++) {
      if (activeSet[order[i]]) chosen = order[i];
    }
    return chosen;
  }

  function applyActive(id) {
    if (id === currentActive) return;
    if (currentActive && linkMap[currentActive]) {
      linkMap[currentActive].classList.remove("active");
    }
    if (id && linkMap[id]) {
      linkMap[id].classList.add("active");
      // Keep the active link visible inside the scrolling sidebar itself.
      var link = linkMap[id];
      var tocRect = toc.getBoundingClientRect();
      var linkRect = link.getBoundingClientRect();
      if (linkRect.top < tocRect.top || linkRect.bottom > tocRect.bottom) {
        link.scrollIntoView({ block: "nearest" });
      }
    }
    currentActive = id;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        activeSet[entry.target.id] = entry.isIntersecting;
      });
      applyActive(pickActive());
    },
    {
      root: null,
      // Trigger band = top ~45% of the viewport, offset below the sticky
      // 60px header so a section counts as "current" once its heading
      // clears the header, and stops counting once it scrolls back above it.
      rootMargin: "-96px 0px -55% 0px",
      threshold: 0
    }
  );

  sections.forEach(function (s) { observer.observe(s); });

  // Backstop for the "stuck at bottom" case: intersection thresholds only
  // fire on crossings, but reaching the bottom of the page is a scroll
  // position fact that might not coincide with one. A light, rAF-throttled
  // scroll/resize listener re-checks isAtBottom() so the last item still
  // lights up correctly even if no new intersection event happens to fire.
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      applyActive(pickActive());
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  window.addEventListener("load", function () {
    applyActive(pickActive());
  });
})();
