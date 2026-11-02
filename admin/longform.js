/* IPC Admin — the long-form pattern (PLAN-13 Phases 3 and 4).
 *
 * For <form data-long-form> (Business Details, Add Product, Edit Product,
 * Page Content):
 *   - an "On this page" strip of links, one per section, sticky under the
 *     menu bar while the form is in view. A section is a direct child of the
 *     form that is a .card with a .card-title, or carries data-index-title
 *     (Page Content's .page-group: one public page holding several cards).
 *     The link of the section being read is filled in; a section with unsaved
 *     changes gets a dot (unsaved.js marks it and fires ipc:unsaved-sections).
 *     Before this, Business Details' eight sections and Edit's seven had no
 *     index at all (§2 D2), nor Page Content's 34 (B1).
 *   - a Hide/Show button on each section. Nothing starts hidden, and a hidden
 *     section opens again when one of its fields fails the browser's own
 *     check (required, pattern) or its strip link is clicked — a field the
 *     owner cannot see must never be the reason a Save does nothing.
 *   - with data-filter (Page Content), a "Find a box" filter above the strip
 *     that shows only the boxes and list rows whose label, value, section or
 *     page holds every word typed.
 *
 * Progressive enhancement: without JavaScript the form is the plain one, and
 * the save bar (PHP-rendered, styled in admin_head()) still sticks. Nothing
 * here adds a form control with a name, or anything inside the form at all
 * but the Hide/Show buttons, so the POST is unchanged.
 */
(function () {
  "use strict";

  var form = document.querySelector("form[data-long-form]");
  if (!form || !document.querySelector || !Array.prototype.forEach) return;

  var cards = Array.prototype.filter.call(form.children, function (c) {
    return !!titleEl(c) && (c.classList.contains("card") || c.hasAttribute("data-index-title"));
  });
  if (cards.length < 2) return;

  function titleEl(card) {
    for (var i = 0; i < card.children.length; i++) {
      var c = card.children[i].classList;
      if (c.contains("card-title") || c.contains("page-group-title")) return card.children[i];
    }
    return null;
  }
  function titleOf(card) {
    return (card.getAttribute("data-index-title") || titleEl(card).textContent).replace(/\s+/g, " ").trim();
  }
  function sectionOf(el) {
    for (var k = 0; k < cards.length; k++) if (cards[k].contains(el)) return cards[k];
    return null;
  }
  function slug(s) {
    return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  var nav = document.createElement("nav");
  nav.className = "form-index";
  nav.setAttribute("aria-label", "Sections of this form");
  var ol = document.createElement("ol");
  nav.appendChild(ol);
  var links = [];

  cards.forEach(function (card) {
    var title = titleOf(card);
    if (!card.id) {
      var id = "sec-" + slug(title), n = 2;
      while (document.getElementById(id)) id = "sec-" + slug(title) + "-" + n++;
      card.id = id;
    }
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "#" + card.id;
    a.textContent = title;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      setOpen(card, true);
      card.scrollIntoView({ block: "start" });
      var t = titleEl(card);
      t.setAttribute("tabindex", "-1");
      try { t.focus({ preventScroll: true }); } catch (x) { t.focus(); }
      // Near the end of the page the jump may stop short with the page at
      // its bottom, where spy() would mark the last section instead.
      pinned = cards.indexOf(card);
      pinnedY = window.scrollY;
      spy();
    });
    li.appendChild(a);
    ol.appendChild(li);
    links.push(a);

    var b = document.createElement("button");
    b.type = "button";
    b.className = "sec-toggle";
    b.addEventListener("click", function () { setOpen(card, card.classList.contains("is-collapsed")); });
    card.classList.add("has-toggle");
    card.insertBefore(b, titleEl(card).nextSibling);
    setOpen(card, true);
  });
  // Above the form AND its live preview, not inside the form: beside the
  // preview the form column is ~800px and eight links took two rows (90px)
  // of sticky strip; across both columns they fit in one. Outside the form
  // it also cannot touch the POST. product-preview.js wraps the form in its
  // layout at DOMContentLoaded, after this runs, and leaves this in place.
  var host = form.closest(".layout, .ipc-editor-layout") || form;
  host.parentNode.insertBefore(nav, host);

  function setOpen(card, open) {
    card.classList.toggle("is-collapsed", !open);
    var b = card.querySelector(".sec-toggle");
    if (!b) return;
    b.textContent = open ? "Hide" : "Show";
    b.setAttribute("aria-expanded", open ? "true" : "false");
    b.setAttribute("aria-label", (open ? "Hide" : "Show") + " section: " + titleOf(card));
  }

  // A browser that blocks Save on an empty required field focuses that field;
  // if its section is hidden there is nothing to focus and nothing on screen
  // says why Save did nothing. `invalid` fires before the focus, so open it.
  form.addEventListener("invalid", function (e) {
    var card = sectionOf(e.target);
    if (card && card.classList.contains("is-collapsed")) setOpen(card, true);
  }, true);

  // ── "Find a box" (Page Content, PLAN-13 Phase 4) ─────────────────────────
  // 491 boxes on one page (§2 B1). The unit shown or hidden is a list row
  // (.content-row) or a single box (.form-group outside a row); a card whose
  // own title matches keeps everything in it. Hidden boxes still post: this
  // only adds a class, and display:none does not take a field out of a form.
  if (form.hasAttribute("data-filter")) (function () {
    var box = document.createElement("div");
    box.className = "form-filter";
    box.innerHTML = '<label for="form-filter-q">Find a box on this page</label>' +
      '<div class="form-filter-row"><input type="search" id="form-filter-q" autocomplete="off"' +
      ' placeholder="For example: phone, FAQ, hero photo">' +
      '<span class="form-filter-count" role="status" aria-live="polite"></span></div>';
    nav.parentNode.insertBefore(box, nav);
    var q = box.querySelector("input"), out = box.querySelector(".form-filter-count");
    var groups = Array.prototype.slice.call(form.querySelectorAll(".card"));

    function textOf(el) {
      var t = [];
      Array.prototype.forEach.call(el.querySelectorAll("label"), function (l) { t.push(l.textContent); });
      Array.prototype.forEach.call(el.querySelectorAll("input, textarea, select"), function (f) {
        if (f.type === "hidden") return;
        t.push(f.tagName === "SELECT" ? (f.options[f.selectedIndex] || { text: "" }).text : f.value);
      });
      return t.join(" ");
    }
    function has(hay, words) {
      hay = hay.toLowerCase();
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
      return true;
    }
    function units(card) {
      var u = Array.prototype.slice.call(card.querySelectorAll(".content-row"));
      Array.prototype.forEach.call(card.querySelectorAll(".form-group"), function (g) {
        if (!g.closest(".content-row")) u.push(g);
      });
      return u;
    }
    function run() {
      var words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      var hidden = document.querySelectorAll(".f-out");
      for (var i = 0; i < hidden.length; i++) hidden[i].classList.remove("f-out");
      form.classList.toggle("is-filtering", words.length > 0);
      if (!words.length) { out.textContent = ""; measure(); onScroll(); return; }
      cards.forEach(function (c) { setOpen(c, true); });
      var shown = 0;
      groups.forEach(function (card) {
        var sec = sectionOf(card);
        var head = (sec && sec !== card ? titleOf(sec) + " " : "") +
          (card.getAttribute("data-section-title") || (card.querySelector(".card-title") || { textContent: "" }).textContent);
        var us = units(card), any = false;
        if (has(head, words)) { shown += us.length; any = true; }
        else us.forEach(function (u) {
          if (has(head + " " + textOf(u), words)) { shown++; any = true; }
          else u.classList.add("f-out");
        });
        if (!any) card.classList.add("f-out");
      });
      cards.forEach(function (sec, k) {
        if (!sec.classList.contains("card") && !sec.querySelector(".card:not(.f-out)")) sec.classList.add("f-out");
        // The strip lists only the pages that have a match.
        links[k].parentNode.classList.toggle("f-out", sec.classList.contains("f-out"));
      });
      out.textContent = shown ? shown + (shown === 1 ? " match" : " matches")
        : "Nothing matches “" + q.value.trim() + "”";
      measure();
      onScroll();
    }
    var timer = 0;
    q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 120); });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && q.value) { q.value = ""; run(); }
    });
  })();

  // The strip's height, for what must clear it as well as the menu bar:
  // html's scroll-padding-top (a jump to a section, and a field reached with
  // Tab — PLAN-13 Phase 7) and the sticky live previews.
  function measure() {
    document.documentElement.style.setProperty("--form-index-h", nav.offsetHeight + "px");
  }

  // The section being read: the last one whose top has passed under the
  // strip; the last section once the page cannot scroll further.
  var current = -1, ticking = false, pinned = -1, pinnedY = 0;
  function spy() {
    ticking = false;
    if (pinned >= 0 && Math.abs(window.scrollY - pinnedY) < 2) return mark(pinned);
    pinned = -1;
    // A jump parks the card 8px + html's 16px below the strip; 40 clears it.
    var line = nav.getBoundingClientRect().bottom + 40;
    var i = -1;
    for (var k = 0; k < cards.length; k++) {
      if (cards[k].classList.contains("f-out")) continue;
      if (cards[k].getBoundingClientRect().top <= line) i = k;
    }
    var doc = document.documentElement;
    if (i >= 0 && window.innerHeight + Math.ceil(window.scrollY || doc.scrollTop) >= doc.scrollHeight - 2) {
      for (var j = cards.length - 1; j >= 0; j--) if (!cards[j].classList.contains("f-out")) { i = j; break; }
    }
    mark(i);
  }
  function mark(i) {
    if (i === current) return;
    if (current >= 0) links[current].removeAttribute("aria-current");
    current = i;
    if (i < 0) return;
    links[i].setAttribute("aria-current", "true");
    // On a phone the strip is one row that scrolls sideways: keep the current
    // link in it without moving the page.
    var a = links[i], left = a.offsetLeft - ol.offsetLeft;
    if (left < ol.scrollLeft || left + a.offsetWidth > ol.scrollLeft + ol.clientWidth) {
      ol.scrollLeft = Math.max(0, left - 16);
    }
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(spy); }
  }

  document.addEventListener("ipc:unsaved-sections", function () {
    cards.forEach(function (card, k) {
      var on = card.hasAttribute("data-unsaved") || !!card.querySelector("[data-unsaved]");
      links[k].classList.toggle("has-changes", on);
      if (on) links[k].title = "Unsaved changes";
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { measure(); onScroll(); });
  measure();
  spy();
})();
