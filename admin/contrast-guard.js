/*
 * 4.23 — live readability warning for the brand colors on Business Details.
 *
 * settings.php renders the same notes server-side, so they are correct on load
 * and without JS. This recomputes them as the color picker moves, because the
 * point of the warning is to be seen BEFORE the owner commits to a color — a
 * warning that only appears after saving arrives after the damage.
 *
 * The math MUST agree with ipc_contrast_ratio()/ipc_ink_for() in
 * admin/config.php and with contrastRatio()/inkFor() in src/App.jsx: the admin
 * promises a number and the public site picks the ink that number describes.
 * _harness/contrastparity.js asserts all three stay in step.
 *
 * External file — the admin CSP is script-src 'self', no inline handlers.
 */
(function () {
  "use strict";

  var INK_DARK = "#141414";
  var INK_LIGHT = "#ffffff";
  var AA = 4.5;
  var LARGE = 3.0;

  function parseHex(v) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v || "").trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function luminance(rgb) {
    function ch(c) {
      var s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]);
  }

  function ratio(a, b) {
    var ca = parseHex(a), cb = parseHex(b);
    if (!ca || !cb) return 0;
    var la = luminance(ca), lb = luminance(cb);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function worst(ink, bgs) {
    var r = Infinity;
    for (var i = 0; i < bgs.length; i++) r = Math.min(r, ratio(ink, bgs[i]));
    return r;
  }

  function inkFor(bgs) {
    var valid = bgs.filter(function (b) { return parseHex(b); });
    if (!valid.length) return INK_LIGHT;
    return worst(INK_LIGHT, valid) >= worst(INK_DARK, valid) ? INK_LIGHT : INK_DARK;
  }

  // Mirrors contrast_note() in settings.php. Kept in the same wording so the
  // note does not visibly change the moment JS takes over from the server.
  function note(bgs, surfaceLabel) {
    var ink = inkFor(bgs);
    var r = worst(ink, bgs.filter(function (b) { return parseHex(b); }));
    if (!isFinite(r)) r = 0;
    var word = ink.toLowerCase() === INK_LIGHT ? "white" : "dark";
    var n = r.toFixed(1);
    if (r >= AA) {
      return {
        cls: "cnote cnote-ok",
        html: "Readable. The site will put <b>" + word + " text</b> on " + surfaceLabel +
              " — contrast <b>" + n + ":1</b> (4.5:1 or more is the standard).",
      };
    }
    if (r >= LARGE) {
      return {
        cls: "cnote cnote-warn",
        html: "⚠️ Borderline. The best text color for " + surfaceLabel + " is <b>" + word +
              "</b>, but it only reaches <b>" + n + ":1</b>. Large headings will be readable; " +
              "smaller text on this color will be hard work. The standard is 4.5:1. " +
              "A darker or stronger shade fixes it.",
      };
    }
    return {
      cls: "cnote cnote-bad",
      html: "⚠️ Hard to read. Even the best text color for " + surfaceLabel + " (<b>" + word +
            "</b>) only reaches <b>" + n + ":1</b>, well under the 4.5:1 standard. " +
            "Visitors will struggle to read this, and so will search engines. " +
            "Please pick a deeper shade. Your changes still save — this is a warning, not a block.",
    };
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function paint(id, bgs, label) {
    var box = document.getElementById(id);
    if (!box) return;
    var n = note(bgs, label);
    box.className = n.cls;
    box.innerHTML = n.html;
  }

  function refresh() {
    var primary = val("theme_primary");
    var dark = val("theme_dark");
    var accent2 = val("theme_accent2");
    paint("cnote_primary", [primary], "buttons and highlights");
    paint("cnote_dark", [dark], "the navigation bar");
    // The page banners are a gradient primary -> accent-2; one ink must work at
    // both ends, so the note is scored on the worse of the two.
    paint("cnote_header", [primary, accent2], "the page banners");
  }

  function wire() {
    ["theme_primary", "theme_dark", "theme_accent2"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      // `input` fires while the native picker is still open, which is exactly
      // when the owner is choosing. `change` alone would wait for the dialog to
      // close and the warning would arrive after the decision.
      el.addEventListener("input", refresh);
      el.addEventListener("change", refresh);
    });
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
