/*
 * Full-product live preview for add.php / edit.php.
 *
 * Progressive enhancement: moves the form into a two-column layout with a
 * sticky preview panel on the right that mirrors the public product page, and
 * updates as ANY field changes. On narrow screens the panel drops below the
 * form. Reads the same field names the PHP backend uses.
 *
 * Any section that has no data yet shows a muted PLACEHOLDER example so a blank
 * form still reveals the skeletal structure of a product; the placeholder is
 * replaced by real content the moment that field is filled in.
 */
(function () {
  "use strict";

  function fld(n) { return document.querySelector('[name="' + n + '"]'); }
  function val(n) { var e = fld(n); return e ? e.value : ""; }
  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function lines(s) {
    return (s || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  // Muted example data shown when a section is still empty.
  var SAMPLE = {
    name: "Product name",
    meta: "SKU-123 &nbsp;·&nbsp; Part type &nbsp;·&nbsp; Operating temperature",
    badges: ["Flame retardant", "RoHS compliant", "2:1 shrink ratio"],
    pdf: "Data sheet",
    summary: "U/L 224 · RoHS · -55°C to 135°C · 600V",
    descr: ["A short product description. Each line you enter becomes its own paragraph on the product page."],
    spec1: [
      { label: "Material", value: "Polyolefin" },
      { label: "Shrink ratio", value: "2:1" },
      { label: null, value: "RoHS compliant · UL 224 recognized" }
    ],
    size: {
      columnSpans: [
        { label: "Order size", colspan: 1, sub: null },
        { label: "O.D. min", colspan: 1, sub: null },
        { label: "O.D. max", colspan: 1, sub: null }
      ],
      rows: [["1/4\"", ".560\"", ".575\""], ["3/8\"", ".680\"", ".700\""]]
    }
  };

  var CSS =
    // `main{max-width:1340px}` used to live here, overriding edit.php's own
    // 900px so the editor had room for the preview beside it. Both are gone:
    // admin_head() in config.php now gives every content page one container
    // (1280px, then 80vw above 1600) and edit.php's <main> carries
    // .admin-wide. Re-declaring a width here would fight it — and would win
    // below 1600, since this <style> is appended to <head> at runtime and so
    // comes last.
    ".ipc-editor-layout{display:flex;gap:24px;align-items:flex-start;}" +
    ".ipc-editor-layout>form{flex:1 1 auto;min-width:0;}" +
    // D1a — the preview column was a flat 400px, which is why it read as a
    // phone-width view of the site. It is not a mobile layout: the panel is
    // bespoke markup (.pp-name, .pp-meta, .pp-sthead …) that approximates the
    // product page in a single column, so it never reproduces the real
    // two-column desktop layout at any width. Widening it does not make it
    // faithful; it makes the approximation legible, which is what it is for.
    //
    // clamp() rather than another fixed number, so the panel takes a share of
    // the growth once .admin-wide starts widening the page instead of handing
    // every extra pixel to the form. 440px floor at 1280 (up from 400), ~34%
    // of the container above that, capped at 760 so the form never drops below
    // roughly half the width. At 2560 the container is 2048 and the preview
    // lands at ~680px — a panel you can actually read a spec table in.
    ".ipc-preview-col{flex:0 0 clamp(440px, 34%, 760px);min-width:0;}" +
    ".ipc-preview-inner{position:sticky;top:24px;max-height:calc(100vh - 40px);overflow:auto;background:#fff;border:1px solid #e5e9ee;border-radius:12px;box-shadow:0 1px 4px rgba(0,45,82,0.06);}" +
    ".ipc-preview-head{position:sticky;top:0;background:#0d2d52;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;padding:10px 16px;z-index:1;}" +
    ".ipc-preview-body{padding:16px;}" +
    ".ste-prevwrap{display:none !important;}" +
    ".pp-name{font-size:18px;font-weight:800;color:#141414;margin:0 0 6px;}" +
    ".pp-meta{font-size:12px;color:#6b7280;margin-bottom:12px;}" +
    ".pp-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}" +
    ".pp-badge{background:rgba(0,93,163,0.08);color:#005da3;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;}" +
    ".pp-pdfs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}" +
    ".pp-pdf{background:#005da3;color:#fff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:6px;}" +
    ".pp-img{max-width:100%;border-radius:8px;border:1px solid #e5e9ee;display:block;margin-bottom:6px;}" +
    ".pp-imgph{height:120px;border:1px dashed #d1d9e0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#aeb8c4;font-size:12px;margin-bottom:12px;background:#f8fafc;}" +
    ".pp-cap{font-size:11px;color:#9ca3af;margin-bottom:12px;font-style:italic;}" +
    ".pp-summary{font-size:12px;color:#374151;background:#f0f4f8;border-radius:8px;padding:8px 10px;margin-bottom:12px;}" +
    ".pp-p{font-size:13px;color:#4b5563;line-height:1.5;margin:0 0 8px;}" +
    ".pp-block{margin-bottom:14px;}" +
    ".pp-sthead{font-size:12px;font-weight:700;color:#fff;background:#0d2d52;padding:6px 10px;border-radius:8px 8px 0 0;}" +
    ".pp-slist{border:1px solid #e5e9ee;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;}" +
    ".pp-sr{padding:6px 10px;font-size:12px;border-bottom:1px solid #f0f4f8;color:#4b5563;}" +
    ".pp-sr:last-child{border-bottom:none;}" +
    ".pp-sl{color:#005da3;font-weight:600;}" +
    ".pp-note{color:#6b7280;}" +
    ".pp-gwrap{overflow-x:auto;border:1px solid #e5e9ee;border-radius:8px;margin-top:4px;}" +
    ".pp-gt{border-collapse:collapse;width:100%;font-size:11px;}" +
    ".pp-gt th{background:#0d2d52;color:rgba(255,255,255,0.85);font-weight:600;padding:5px 8px;text-align:left;white-space:pre-line;border:1px solid rgba(255,255,255,0.15);}" +
    ".pp-gt td{padding:5px 8px;border-bottom:1px solid #f0f4f8;color:#141414;}" +
    ".pp-ph{color:#aeb8c4 !important;}" +
    ".pp-ghost{opacity:.5;}" +
    ".pp-ghost-tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#aeb8c4;margin:0 0 12px;}" +
    // D2 — the stacking rule, rechecked. 1024 is still the right breakpoint:
    // at 1025 the container is ~977px inside its padding, the clamp floor puts
    // the preview at 440 and leaves the form 513px, which is still usable;
    // below that the form would start losing fields to wrapping. What did
    // change is `main{max-width:900px}`, dropped for the same reason as above —
    // the shared container owns the page width now, so a stacked editor at
    // 1024 uses the full 1024 instead of being pinned 124px narrower.
    "@media(max-width:1024px){.ipc-editor-layout{flex-direction:column;}.ipc-preview-col{flex:1 1 auto;width:100%;}.ipc-preview-inner{position:static;max-height:none;}}";

  function injectCSS() {
    var s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function specBlock(rows, title) {
    var body = rows.map(function (r) {
      if (!r) return "";
      var isNote = r.label == null || String(r.label).trim() === "";
      if (isNote) return '<div class="pp-sr pp-note">' + esc(r.value) + "</div>";
      return '<div class="pp-sr"><span class="pp-sl">' + esc(r.label) + "</span> " + esc(r.value) + "</div>";
    }).join("");
    return '<div class="pp-block"><div class="pp-sthead">' + esc(title) + '</div><div class="pp-slist">' + body + "</div></div>";
  }

  function sizeBlock(o) {
    var cs = Array.isArray(o.columnSpans) ? o.columnSpans : [];
    var rs = Array.isArray(o.rows) ? o.rows : [];
    var hasSub = cs.some(function (c) { return c && Array.isArray(c.sub); });
    var head = "<tr>" + cs.map(function (c) {
      var span = c && c.colspan > 1 ? c.colspan : 1;
      var rsp = hasSub ? ' rowspan="' + (c && c.colspan > 1 ? 1 : 2) + '"' : "";
      return '<th colspan="' + span + '"' + rsp + ">" + esc(c && c.label) + "</th>";
    }).join("") + "</tr>";
    var sub = "";
    if (hasSub) {
      sub = "<tr>" + cs.filter(function (c) { return c && c.colspan > 1 && Array.isArray(c.sub); })
        .map(function (c) { return c.sub.map(function (s) { return "<th>" + esc(s) + "</th>"; }).join(""); })
        .join("") + "</tr>";
    }
    var body = rs.map(function (r) {
      return "<tr>" + (Array.isArray(r) ? r : []).map(function (cell) { return "<td>" + esc(cell) + "</td>"; }).join("") + "</tr>";
    }).join("");
    return '<div class="pp-block"><div class="pp-gwrap"><table class="pp-gt"><thead>' + head + sub + "</thead><tbody>" + body + "</tbody></table></div></div>";
  }

  function realPdfs() {
    var btns = "";
    var lbl = val("pdfLabel");
    if (lbl && lbl.trim()) btns += '<span class="pp-pdf">' + esc(lbl.trim()) + "</span>";
    lines(val("additionalPdfs")).forEach(function (l) {
      var parts = l.split("|");
      var label = (parts[1] || "").trim() || (parts[0] || "").trim();
      if (label) btns += '<span class="pp-pdf">' + esc(label) + "</span>";
    });
    return btns;
  }

  function ghost(inner) { return '<div class="pp-ghost">' + inner + "</div>"; }

  function render(content) {
    var html = "";

    var nameV = val("name").trim();
    // A div, not an h3. This panel is a PICTURE of the public product card, not
    // a section of the admin page, and it was the admin page's outline that it
    // joined: add.php and edit.php both go <h1> straight to this <h3>, so a
    // screen reader announcing the page structure hears a level skipped and a
    // heading that is really a form preview. The class carries all the styling,
    // so the panel looks identical. (audit-runs/audit4.md D-05)
    html += nameV ? '<div class="pp-name">' + esc(nameV) + "</div>" : '<div class="pp-name pp-ph">' + SAMPLE.name + "</div>";

    var metaParts = [esc(val("sku")), esc(val("partType")), esc(val("operatingTemp"))].filter(Boolean);
    html += metaParts.length
      ? '<div class="pp-meta">' + metaParts.join(" &nbsp;·&nbsp; ") + "</div>"
      : '<div class="pp-meta pp-ph">' + SAMPLE.meta + "</div>";

    var badges = lines(val("badges"));
    var badgeHtml = function (arr) {
      return '<div class="pp-badges">' + arr.map(function (b) { return '<span class="pp-badge">' + esc(b) + "</span>"; }).join("") + "</div>";
    };
    html += badges.length ? badgeHtml(badges) : ghost(badgeHtml(SAMPLE.badges));

    var pdfHtml = realPdfs();
    html += pdfHtml ? '<div class="pp-pdfs">' + pdfHtml + "</div>" : ghost('<div class="pp-pdfs"><span class="pp-pdf">' + SAMPLE.pdf + "</span></div>");

    var photo = val("photoUrl").trim();
    if (photo && photo.indexOf("placehold") === -1) {
      html += '<img class="pp-img" src="' + esc(photo) + '" alt="">';
      var cap = esc(val("caption"));
      if (cap) html += '<div class="pp-cap">' + cap + "</div>";
    } else {
      html += '<div class="pp-imgph">Product photo</div>';
    }

    var sum = val("specificationsSummary").trim();
    html += sum ? '<div class="pp-summary">' + esc(sum) + "</div>" : '<div class="pp-summary pp-ph">' + SAMPLE.summary + "</div>";

    var descr = lines(val("description"));
    var descrHtml = function (arr) { return arr.map(function (p) { return '<p class="pp-p">' + esc(p) + "</p>"; }).join(""); };
    html += descr.length ? descrHtml(descr) : ghost(descrHtml(SAMPLE.descr));

    var rows1;
    try { rows1 = JSON.parse(val("specTable1_rows") || "[]"); } catch (e) { rows1 = []; }
    html += (Array.isArray(rows1) && rows1.length)
      ? specBlock(rows1, val("specTable1_title") || "Specifications:")
      : ghost(specBlock(SAMPLE.spec1, "Specifications:"));

    var o2;
    try { o2 = JSON.parse(val("specTable2_json") || "{}"); } catch (e) { o2 = {}; }
    var has2 = (Array.isArray(o2.columnSpans) && o2.columnSpans.length) || (Array.isArray(o2.rows) && o2.rows.length);
    html += has2 ? sizeBlock(o2) : ghost(sizeBlock(SAMPLE.size));

    content.innerHTML = html;
  }

  function init() {
    var form = document.querySelector("main form");
    if (!form) return;
    injectCSS();

    var layout = document.createElement("div");
    layout.className = "ipc-editor-layout";
    form.parentNode.insertBefore(layout, form);
    layout.appendChild(form);

    var aside = document.createElement("aside");
    aside.className = "ipc-preview-col";
    aside.innerHTML =
      '<div class="ipc-preview-inner"><div class="ipc-preview-head">Live preview — what the website shows</div><div class="ipc-preview-body"></div></div>';
    layout.appendChild(aside);
    var content = aside.querySelector(".ipc-preview-body");

    var rerender = function () { render(content); };
    form.addEventListener("input", rerender);
    form.addEventListener("change", rerender);
    form.addEventListener("click", function () { setTimeout(rerender, 0); });
    rerender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
