/* IPC Admin — the long-form pattern (PLAN-13 Phase 3).
 *
 * For <form data-long-form> (Business Details, Add Product, Edit Product):
 *   - an "On this page" strip of links, one per section (.card with a
 *     .card-title), sticky under the menu bar while the form is in view. The
 *     link of the section being read is filled in; a section with unsaved
 *     changes gets a dot (unsaved.js marks it and fires ipc:unsaved-sections).
 *     Before this, Business Details' eight sections and Edit's seven had no
 *     index at all (§2 D2).
 *   - a Hide/Show button on each section. Nothing starts hidden, and a hidden
 *     section opens again when one of its fields fails the browser's own
 *     check (required, pattern) or its strip link is clicked — a field the
 *     owner cannot see must never be the reason a Save does nothing.
 *
 * Progressive enhancement: without JavaScript the form is the plain one, and
 * the save bar (PHP-rendered, styled in admin_head()) still sticks. Nothing
 * here adds a form control with a name, so the POST is unchanged.
 */
(function () {
  "use strict";

  var form = document.querySelector("form[data-long-form]");
  if (!form || !document.querySelector || !Array.prototype.forEach) return;

  var cards = Array.prototype.filter.call(form.children, function (c) {
    return c.classList.contains("card") && titleEl(c);
  });
  if (cards.length < 2) return;

  function titleEl(card) {
    for (var i = 0; i < card.children.length; i++) {
      if (card.children[i].classList.contains("card-title")) return card.children[i];
    }
    return null;
  }
  function titleOf(card) {
    return titleEl(card).textContent.replace(/\s+/g, " ").trim();
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
      // Near the end of the page the jump may stop short with the page at
      // its bottom, where spy() would mark the last section instead.
      pinned = cards.indexOf(card);
      pinnedY = window.scrollY;
      spy();
      var t = titleEl(card);
      t.setAttribute("tabindex", "-1");
      try { t.focus({ preventScroll: true }); } catch (x) { t.focus(); }
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
    var card = e.target && e.target.closest ? e.target.closest("form[data-long-form] > .card") : null;
    if (card && card.classList.contains("is-collapsed")) setOpen(card, true);
  }, true);

  // The strip's height, for what must clear it as well as the menu bar: a
  // jump to a section (html's scroll-padding-top covers only the bar) and the
  // sticky live previews.
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
      if (cards[k].getBoundingClientRect().top <= line) i = k;
    }
    var doc = document.documentElement;
    if (i >= 0 && window.innerHeight + Math.ceil(window.scrollY || doc.scrollTop) >= doc.scrollHeight - 2) i = cards.length - 1;
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
      var on = card.hasAttribute("data-unsaved");
      links[k].classList.toggle("has-changes", on);
      if (on) links[k].title = "Unsaved changes";
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { measure(); onScroll(); });
  measure();
  spy();
})();
