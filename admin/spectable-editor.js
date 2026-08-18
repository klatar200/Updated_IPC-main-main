/*
 * Friendly spec-table editors for add.php / edit.php.
 *
 * Progressive enhancement: this finds the two hidden fields the PHP backend
 * already reads — specTable1_rows (a JSON list of {label,value}) and
 * specTable2_json (a JSON {columnSpans, rows} grid) — and replaces the raw
 * JSON textareas with visual editors. The editors write valid JSON straight
 * back into those same fields on every change, so NOTHING on the server side
 * changes. If this script fails or the JSON can't be parsed, the plain
 * textareas remain and stay fully usable.
 */
(function () {
  "use strict";

  var CSS =
    ".ste-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}" +
    ".ste-in{padding:8px 10px;border:1px solid #d1d9e0;border-radius:7px;font-size:13px;font-family:inherit;color:#141414;width:100%;background:#fff;outline:none;}" +
    ".ste-in:focus{border-color:#005da3;box-shadow:0 0 0 3px rgba(0,93,163,0.1);}" +
    ".vh{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}" +
    ".ste-lab{flex:0 0 32%;}" +
    ".ste-val{flex:1;resize:vertical;line-height:1.4;overflow:hidden;min-height:34px;}" +
    ".ste-x{flex:0 0 auto;width:32px;height:34px;border:1px solid #e5e9ee;background:#fff;border-radius:7px;color:#9ca3af;cursor:pointer;font-size:17px;line-height:1;}" +
    ".ste-x:hover{background:#fef2f2;color:#dc2626;border-color:#fecaca;}" +
    ".ste-x.sm{width:26px;height:28px;font-size:14px;}" +
    ".ste-add{padding:7px 12px;border:1px solid #d1d9e0;background:#fff;border-radius:7px;color:#005da3;font-weight:600;font-size:12px;cursor:pointer;}" +
    ".ste-add:hover{background:#f0f4f8;}" +
    ".ste-tool{padding:7px 12px;border:1px solid #d1d9e0;background:#fff;border-radius:7px;color:#141414;font-weight:600;font-size:12px;cursor:pointer;}" +
    ".ste-tool:hover{background:#f0f4f8;}" +
    ".ste-adv{font-size:12px;color:#6b7280;text-decoration:none;margin-left:4px;cursor:pointer;background:none;border:0;padding:2px 4px;font-family:inherit;}" +
    ".ste-adv:hover{color:#005da3;text-decoration:underline;}" +
    ".ste-adv:focus-visible{outline:2px solid #005da3;outline-offset:2px;border-radius:4px;}" +
    ".ste-prevwrap{margin-top:14px;border-top:1px solid #e5e9ee;padding-top:12px;}" +
    ".ste-prevlab{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:8px;}" +
    ".ste-splist{border:1px solid #e5e9ee;border-radius:10px;overflow:hidden;}" +
    ".ste-sprow{padding:8px 12px;font-size:13px;border-bottom:1px solid #f0f4f8;color:#4b5563;}" +
    ".ste-sprow:last-child{border-bottom:none;}" +
    ".ste-splab{color:#005da3;font-weight:600;}" +
    ".ste-note{color:#6b7280;}" +
    ".ste-grid{display:grid;gap:6px;align-items:start;margin-bottom:6px;}" +
    ".ste-grp{display:flex;flex-direction:column;gap:5px;border:1px solid #e5e9ee;border-radius:7px;padding:6px;background:#f8fafc;}" +
    ".ste-gtools{display:flex;gap:4px;flex-wrap:wrap;}" +
    ".ste-mini{font-size:11px;padding:2px 7px;border:1px solid #d1d9e0;border-radius:5px;background:#fff;color:#005da3;cursor:pointer;}" +
    ".ste-mini:hover{background:#eef4fa;}" +
    ".ste-mini.rm{color:#b91c1c;}" +
    ".ste-mini.rm:hover{background:#fef2f2;}" +
    ".ste-subcell{display:flex;gap:3px;align-items:center;}" +
    ".ste-cell{width:100%;padding:6px 8px;border:1px solid #d1d9e0;border-radius:6px;font-size:12px;font-family:inherit;color:#141414;background:#fff;outline:none;box-sizing:border-box;}" +
    ".ste-cell:focus{border-color:#005da3;box-shadow:0 0 0 2px rgba(0,93,163,0.12);}" +
    ".ste-head{font-weight:600;resize:none;line-height:1.3;overflow:hidden;min-height:32px;}" +
    ".ste-bar{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;}" +
    ".ste-gwrap{overflow-x:auto;border:1px solid #e5e9ee;border-radius:10px;}" +
    ".ste-gt{border-collapse:collapse;width:100%;font-size:12px;}" +
    ".ste-gt th{background:#0d2d52;color:rgba(255,255,255,0.85);font-weight:600;padding:7px 10px;text-align:left;white-space:pre-line;border:1px solid rgba(255,255,255,0.15);}" +
    ".ste-gt td{padding:6px 10px;border-bottom:1px solid #f0f4f8;color:#141414;}" +
    ".ste-paste{border:1px dashed #c7d2dd;border-radius:8px;padding:12px;margin-top:10px;background:#f8fafc;}" +
    ".ste-pastehint{font-size:12px;color:#6b7280;margin-bottom:8px;}" +
    ".ste-pastebox{width:100%;min-height:90px;padding:8px;border:1px solid #d1d9e0;border-radius:7px;font-family:monospace;font-size:12px;margin-bottom:8px;box-sizing:border-box;}" +
    ".ste-chk{display:flex;align-items:center;gap:6px;font-size:12px;color:#374151;margin-bottom:10px;}" +
    ".ste-note2{font-size:12px;color:#4b5563;background:#f0f4f8;border-radius:8px;padding:10px 12px;margin-bottom:10px;}" +
    ".ste-advbox{width:100%;padding:10px;border:1px solid #d1d9e0;border-radius:7px;font-family:monospace;font-size:12px;box-sizing:border-box;}" +
    ".ste-bad{color:#dc2626;font-size:12px;padding:8px 12px;}";

  function injectCSS() {
    var s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /* 4.30 — a polite live region per editor. Every structural change here is
   * invisible to a screen reader otherwise: the rows are rebuilt with
   * innerHTML, so nothing is announced and focus lands on the document. */
  function makeAnnouncer(host) {
    var live = document.createElement("div");
    live.className = "vh ste-live";
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    host.appendChild(live);
    return function (msg) {
      // Same text twice in a row is not re-announced, so clear first.
      live.textContent = "";
      window.setTimeout(function () { live.textContent = msg; }, 30);
    };
  }

  function autoGrow(t) {
    t.style.height = "auto";
    t.style.height = Math.max(t.classList.contains("ste-head") ? 32 : 34, t.scrollHeight) + "px";
  }
  function growAll(host) {
    var tas = host.querySelectorAll("textarea");
    for (var i = 0; i < tas.length; i++) autoGrow(tas[i]);
  }
  function structural(el) {
    try {
      (el || document).dispatchEvent(new Event('ipc:structural-change', { bubbles: true }));
    } catch (e) { /* older browser: the guard simply stays as it was */ }
  }

  function hideOriginal(ta) {
    ta.style.display = "none";
    var prev = ta.previousElementSibling;
    if (prev && prev.tagName === "LABEL") prev.style.display = "none";
    var next = ta.nextElementSibling;
    if (next && next.classList && next.classList.contains("hint")) next.style.display = "none";
  }

  /* ---------------- Specifications list (specTable1_rows) ---------------- */
  function enhanceSpecs(ta) {
    var data;
    try {
      data = JSON.parse(ta.value || "[]");
      if (!Array.isArray(data)) return;
    } catch (e) {
      return;
    }
    data = data.map(function (r) {
      return {
        label: r && r.label != null ? String(r.label) : "",
        value: r && r.value != null ? String(r.value) : ""
      };
    });
    if (data.length === 0) data = [{ label: "", value: "" }];

    hideOriginal(ta);
    var wrap = document.createElement("div");
    var rows = document.createElement("div");
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "ste-add";
    addBtn.textContent = "+ Add specification";
    var prevWrap = document.createElement("div");
    prevWrap.className = "ste-prevwrap";
    prevWrap.innerHTML =
      '<div class="ste-prevlab">Live preview — what the website shows</div><div class="ste-splist"></div>';
    wrap.appendChild(rows);
    wrap.appendChild(addBtn);
    wrap.appendChild(prevWrap);
    ta.parentNode.insertBefore(wrap, ta);
    var preview = prevWrap.querySelector(".ste-splist");
    var announce = makeAnnouncer(wrap);

    function serialize() {
      // A-5.11 — the editor keeps one blank row so there is always somewhere to
      // type, and that row used to be SERIALISED. So a product added without
      // ever opening this editor shipped `rows: [{label: null, value: ""}]`,
      // and App.jsx's 4.29 guard is `if (!rows.length) return null` — length 1
      // passes it — so the public page drew a dark "SPECIFICATIONS:" bar over
      // one empty row. Deleting the last row re-seeds it too, so through the
      // visual editor a spec table could never be emptied at all.
      // A row the owner has not filled in is not data: drop the empty ones on
      // the way out, keep them on screen.
      var kept = data.filter(function (r) {
        return String(r.label).trim() !== "" || String(r.value).trim() !== "";
      });
      ta.value = JSON.stringify(
        kept.map(function (r) {
          return { label: r.label.trim() === "" ? null : r.label, value: r.value };
        }),
        null,
        2
      );
    }
    function renderPreview() {
      preview.innerHTML =
        data
          .map(function (r) {
            if (r.label.trim() === "")
              return '<div class="ste-sprow ste-note">' + esc(r.value) + "</div>";
            return '<div class="ste-sprow"><span class="ste-splab">' + esc(r.label) + "</span> " + esc(r.value) + "</div>";
          })
          .join("") || '<div class="ste-sprow ste-note">No specifications yet.</div>';
    }
    /* 4.30 — every remove button said "Remove row". Twenty identical names in a
     * row list is no name at all, so each carries its position and, when the
     * owner has typed one, its label. Recomputed on every rebuild AND whenever
     * the label is edited, or the name goes stale the moment he types. */
    function nameRemove(btn, idx, label) {
      var who = "specification row " + (idx + 1);
      var t = (label || "").trim();
      btn.setAttribute("aria-label", "Remove " + who + (t ? ": " + t : " (no label)"));
    }

    /* Rows are rebuilt with innerHTML, which throws focus to the document on
     * every structural change — building a 20-row table meant 20 round trips
     * back. Callers say where focus should land instead. */
    function buildRows(focus) {
      rows.innerHTML = "";
      data.forEach(function (r, idx) {
        var row = document.createElement("div");
        row.className = "ste-row";
        row.innerHTML =
          '<input class="ste-in ste-lab" placeholder="Label (leave blank for a note)">' +
          '<textarea class="ste-in ste-val" rows="1" placeholder="Value"></textarea>' +
          '<button type="button" class="ste-x">×</button>';
        var lab = row.querySelector(".ste-lab");
        var val = row.querySelector(".ste-val");
        var del = row.querySelector(".ste-x");
        lab.value = r.label;
        val.value = r.value;
        lab.setAttribute("aria-label", "Label, specification row " + (idx + 1));
        val.setAttribute("aria-label", "Value, specification row " + (idx + 1));
        nameRemove(del, idx, r.label);
        lab.addEventListener("input", function () {
          r.label = this.value;
          nameRemove(del, idx, this.value);
          serialize();
          renderPreview();
        });
        val.addEventListener("input", function () {
          r.value = this.value;
          autoGrow(this);
          serialize();
          renderPreview();
        });
        del.addEventListener("click", function () {
          var at = data.indexOf(r);
          data.splice(at, 1);
          if (data.length === 0) data.push({ label: "", value: "" });
          structural(wrap);
          // Land on the nearest SURVIVING row's equivalent control, so a
          // keyboard user can delete several in a row without hunting.
          buildRows({ row: Math.min(at, data.length - 1), sel: ".ste-x" });
          serialize();
          renderPreview();
          announce("Row " + (at + 1) + " removed. " + data.length + " row" + (data.length === 1 ? "" : "s") + " remaining.");
        });
        rows.appendChild(row);
      });
      growAll(rows);
      if (focus) {
        var target = rows.querySelectorAll(".ste-row")[focus.row];
        var el = target && target.querySelector(focus.sel);
        if (el) el.focus();
      }
    }
    addBtn.addEventListener("click", function () {
      data.push({ label: "", value: "" });
      structural(wrap);
      buildRows({ row: data.length - 1, sel: ".ste-lab" });
      serialize();
      renderPreview();
      announce("Row " + data.length + " added.");
    });

    buildRows();
    serialize();
    renderPreview();
    var form = ta.closest("form");
    if (form) form.addEventListener("submit", serialize);
  }

  /* ------------------- Size chart grid (specTable2_json) -------------------
   * Column model: groups = [{label, subs:[]}].
   *   subs empty      -> a plain column (colspan 1, sub null)
   *   subs length >=2 -> a grouped header (colspan N, sub [N labels])
   * Leaf columns (the actual data columns) = sum over groups of max(1, subs.length).
   */
  function enhanceSize(ta) {
    var start;
    try {
      start = JSON.parse(ta.value || "{}");
      if (typeof start !== "object" || start == null || Array.isArray(start)) return;
    } catch (e) {
      return;
    }

    function toGroups(cs) {
      var g = (Array.isArray(cs) ? cs : []).map(function (c) {
        if (c && c.colspan > 1 && Array.isArray(c.sub))
          return { label: c.label != null ? String(c.label) : "", subs: c.sub.map(function (s) { return s == null ? "" : String(s); }) };
        return { label: c && c.label != null ? String(c.label) : "", subs: [] };
      });
      return g;
    }
    var groups = toGroups(start.columnSpans);
    var rows = (Array.isArray(start.rows) ? start.rows : []).map(function (r) {
      return (Array.isArray(r) ? r : []).map(function (x) { return x == null ? "" : String(x); });
    });
    // Advanced-mode state. advMode = the raw-JSON textarea is the live editor;
    // advInvalid = its text does not parse, so a save must be blocked rather
    // than silently serializing the stale visual-editor state.
    var advMode = false, advInvalid = false;

    function leafLen(gi) { return groups[gi].subs.length >= 2 ? groups[gi].subs.length : 1; }
    function leafCount() { var n = 0; for (var i = 0; i < groups.length; i++) n += leafLen(i); return n; }
    function leafStart(gi) { var n = 0; for (var i = 0; i < gi; i++) n += leafLen(i); return n; }
    function fixRows() {
      var n = leafCount();
      rows = rows.map(function (r) {
        r = r.slice();
        while (r.length < n) r.push("");
        if (r.length > n) r = r.slice(0, n);
        return r;
      });
    }
    if (groups.length > 0 && rows.length === 0) rows = [[]];
    if (groups.length === 0) rows = [];
    fixRows();

    hideOriginal(ta);
    var wrap = document.createElement("div");
    var host = document.createElement("div");
    var prevWrap = document.createElement("div");
    prevWrap.className = "ste-prevwrap";
    prevWrap.innerHTML =
      '<div class="ste-prevlab">Live preview — what the website shows</div><div class="ste-gwrap"><table class="ste-gt"></table></div>';
    wrap.appendChild(host);
    wrap.appendChild(prevWrap);
    ta.parentNode.insertBefore(wrap, ta);
    var previewTable = prevWrap.querySelector(".ste-gt");
    var announce = makeAnnouncer(wrap);

    function serialize() {
      // A-5.11, size-grid half. `rows = [[]]` is seeded so the grid has a row to
      // type into, and add.php's own seed is an empty `rows: []` — but this
      // serialised the placeholder, so an untouched Add form posted
      // `rows: [[""]]` and every new product got a one-column "Order Size"
      // table with a single empty cell on its public page. Keep the placeholder
      // visible; do not save it.
      var keptRows = rows.filter(function (r) {
        return (r || []).some(function (c) { return String(c == null ? "" : c).trim() !== ""; });
      });
      ta.value = JSON.stringify(
        {
          columnSpans: groups.map(function (g) {
            return g.subs.length >= 2
              ? { label: g.label, colspan: g.subs.length, sub: g.subs.slice() }
              : { label: g.label, colspan: 1, sub: null };
          }),
          rows: keptRows
        },
        null,
        2
      );
    }
    function renderPreview() {
      var o;
      try { o = JSON.parse(ta.value || "{}"); } catch (e) {
        previewTable.innerHTML = '<tbody><tr><td class="ste-bad">The data isn’t valid yet.</td></tr></tbody>';
        return;
      }
      var cs = Array.isArray(o.columnSpans) ? o.columnSpans : [];
      var rs = Array.isArray(o.rows) ? o.rows : [];
      var hasSub = cs.some(function (c) { return c && Array.isArray(c.sub); });
      var head = "<tr>" + cs.map(function (c) {
        var span = c && c.colspan > 1 ? c.colspan : 1;
        var rspan = hasSub ? ' rowspan="' + (c && c.colspan > 1 ? 1 : 2) + '"' : "";
        return '<th colspan="' + span + '"' + rspan + ">" + esc(c && c.label) + "</th>";
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
      previewTable.innerHTML = "<thead>" + head + sub + "</thead><tbody>" + body + "</tbody>";
    }

    function tpl() { return "repeat(" + leafCount() + ", minmax(92px,1fr)) 34px"; }

    function build() {
      host.innerHTML = "";
      if (groups.length === 0) {
        var empty = document.createElement("div");
        empty.className = "ste-note2";
        empty.textContent = "No size chart for this product yet.";
        host.appendChild(empty);
        var bar0 = document.createElement("div");
        bar0.className = "ste-bar";
        bar0.innerHTML =
          '<button type="button" class="ste-add" data-a="col">+ Add column</button>' +
          '<button type="button" class="ste-adv" data-a="adv">Advanced</button>';
        bar0.querySelector('[data-a="col"]').addEventListener("click", function () {
          groups = [{ label: "Column 1", subs: [] }];
          rows = [[""]];
          serialize(); build(); renderPreview();
        });
        bar0.querySelector('[data-a="adv"]').addEventListener("click", function () { buildAdvanced(); });
        host.appendChild(bar0);
        return;
      }
      var anySub = groups.some(function (g) { return g.subs.length >= 2; });

      var gr = document.createElement("div");
      gr.className = "ste-grid";
      gr.style.gridTemplateColumns = tpl();
      groups.forEach(function (g, gi) {
        var cell = document.createElement("div");
        cell.className = "ste-grp";
        cell.style.gridColumn = "span " + leafLen(gi);
        cell.innerHTML =
          '<textarea class="ste-cell ste-head" rows="1" placeholder="Column heading"></textarea>' +
          '<div class="ste-gtools">' +
          (g.subs.length >= 2
            ? '<button type="button" class="ste-mini" data-act="addsub">+ sub-column</button>'
            : '<button type="button" class="ste-mini" data-act="split">Split into sub-columns</button>') +
          '<button type="button" class="ste-mini rm" data-act="delgrp">Remove</button>' +
          "</div>";
        var hd = cell.querySelector(".ste-head");
        hd.value = g.label;
        hd.addEventListener("input", function () { g.label = this.value; autoGrow(this); serialize(); renderPreview(); });
        var delgrp = cell.querySelector('[data-act="delgrp"]');
        delgrp.setAttribute("aria-label",
          "Remove column " + (gi + 1) + ((g.label || "").trim() ? ": " + (g.label || "").trim() : " (unnamed)"));
        hd.setAttribute("aria-label", "Heading for column " + (gi + 1));
        delgrp.addEventListener("click", function () {
          var s = leafStart(gi), l = leafLen(gi);
          rows.forEach(function (r) { r.splice(s, l); });
          groups.splice(gi, 1);
          if (groups.length === 0) rows = [];
          fixRows(); serialize(); build(); renderPreview();
        });
        var splitBtn = cell.querySelector('[data-act="split"]');
        if (splitBtn) splitBtn.addEventListener("click", function () {
          var s = leafStart(gi);
          g.subs = ["Sub 1", "Sub 2"];
          rows.forEach(function (r) { r.splice(s + 1, 0, ""); });
          fixRows(); serialize(); build(); renderPreview();
        });
        var addsubBtn = cell.querySelector('[data-act="addsub"]');
        if (addsubBtn) addsubBtn.addEventListener("click", function () {
          var s = leafStart(gi), l = leafLen(gi);
          g.subs.push("Sub " + (g.subs.length + 1));
          rows.forEach(function (r) { r.splice(s + l, 0, ""); });
          fixRows(); serialize(); build(); renderPreview();
        });
        gr.appendChild(cell);
      });
      gr.appendChild(document.createElement("div"));
      host.appendChild(gr);

      if (anySub) {
        var sr = document.createElement("div");
        sr.className = "ste-grid";
        sr.style.gridTemplateColumns = tpl();
        groups.forEach(function (g, gi) {
          if (g.subs.length >= 2) {
            g.subs.forEach(function (subLabel, si) {
              var c = document.createElement("div");
              c.className = "ste-subcell";
              c.innerHTML =
                '<textarea class="ste-cell" rows="1" placeholder="Sub heading"></textarea>' +
                '<button type="button" class="ste-x sm">×</button>';
              var t = c.querySelector("textarea");
              t.value = subLabel;
              // 4.30 — every one of these was "Remove sub-column". Name it by
              // the column it belongs to and its own position, and keep the
              // name current as the heading is typed.
              var subWho = function () {
                var g0 = (g.label || "").trim();
                var s0 = (g.subs[si] || "").trim();
                return "Remove sub-column " + (si + 1) + (s0 ? " (" + s0 + ")" : "")
                     + " of " + (g0 || "column " + (gi + 1));
              };
              var subX = c.querySelector(".ste-x");
              subX.setAttribute("aria-label", subWho());
              t.addEventListener("input", function () { subX.setAttribute("aria-label", subWho()); });
              t.setAttribute("aria-label", "Sub heading " + (si + 1) + " of column " + (gi + 1));
              t.addEventListener("input", function () { g.subs[si] = this.value; autoGrow(this); serialize(); renderPreview(); });
              c.querySelector(".ste-x").addEventListener("click", function () {
                var s = leafStart(gi);
                rows.forEach(function (r) { r.splice(s + si, 1); });
                g.subs.splice(si, 1);
                if (g.subs.length < 2) g.subs = []; // collapse back to a plain column
                fixRows(); serialize(); build(); renderPreview();
              });
              sr.appendChild(c);
            });
          } else {
            sr.appendChild(document.createElement("div"));
          }
        });
        sr.appendChild(document.createElement("div"));
        host.appendChild(sr);
      }

      rows.forEach(function (r, ri) {
        var dr = document.createElement("div");
        dr.className = "ste-grid";
        // The header rows use .ste-grid too, so mark the DATA rows — the
        // post-delete focus target has to be a surviving data row, not a header.
        dr.setAttribute("data-srow", String(ri));
        dr.style.gridTemplateColumns = tpl();
        var n = leafCount();
        for (var li = 0; li < n; li++) {
          (function (li) {
            var c = document.createElement("div");
            c.innerHTML = '<input class="ste-cell">';
            var inp = c.querySelector("input");
            inp.value = r[li] || "";
            inp.setAttribute("aria-label", "Size row " + (ri + 1) + ", column " + (li + 1));
            inp.addEventListener("input", function () { r[li] = this.value; serialize(); renderPreview(); });
            dr.appendChild(c);
          })(li);
        }
        var del = document.createElement("button");
        del.type = "button";
        del.className = "ste-x";
        // 4.30 — was "Remove row" on every one of them, in a grid that can run
        // to twenty. The first cell is the size, which is what identifies the
        // row to the person reading it.
        del.setAttribute("aria-label",
          "Remove size row " + (ri + 1) + ((r[0] || "").trim() ? ": " + (r[0] || "").trim() : " (empty)"));
        del.innerHTML = "×";
        del.addEventListener("click", function () {
          rows.splice(ri, 1);
          if (rows.length === 0) rows = [[]];
          structural(host);
          fixRows(); serialize(); build(); renderPreview();
          // build() rebuilds host.innerHTML, so focus is on the document unless
          // it is put back deliberately — land on the nearest surviving row.
          var all = host.querySelectorAll("[data-srow] .ste-x");
          var next = all[Math.min(ri, all.length - 1)];
          if (next) next.focus();
          announce("Size row " + (ri + 1) + " removed. " + rows.length + " row" + (rows.length === 1 ? "" : "s") + " remaining.");
        });
        dr.appendChild(del);
        host.appendChild(dr);
      });

      var bar = document.createElement("div");
      bar.className = "ste-bar";
      bar.innerHTML =
        '<button type="button" class="ste-add" data-a="row">+ Add row</button>' +
        '<button type="button" class="ste-add" data-a="col">+ Add column</button>' +
        '<button type="button" class="ste-tool" data-a="paste">Paste from Excel</button>' +
        '<button type="button" class="ste-adv" data-a="adv">Advanced</button>';
      bar.querySelector('[data-a="row"]').addEventListener("click", function () {
        var n = leafCount(), nr = [];
        for (var i = 0; i < n; i++) nr.push("");
        rows.push(nr); serialize(); build(); renderPreview(); structural(host);
      });
      bar.querySelector('[data-a="col"]').addEventListener("click", function () {
        groups.push({ label: "New column", subs: [] });
        rows.forEach(function (r) { r.push(""); });
        fixRows(); serialize(); build(); renderPreview();
      });
      bar.querySelector('[data-a="paste"]').addEventListener("click", function () { openPaste(); });
      bar.querySelector('[data-a="adv"]').addEventListener("click", function () { buildAdvanced(); });
      host.appendChild(bar);

      var pasteHolder = document.createElement("div");
      host.appendChild(pasteHolder);
      host._paste = pasteHolder;

      growAll(host);
    }

    function openPaste() {
      var holder = host._paste;
      if (!holder) return;
      if (holder.firstChild) { holder.innerHTML = ""; return; }
      holder.innerHTML =
        '<div class="ste-paste">' +
        '<div class="ste-pastehint">Copy a block of cells from Excel or Google Sheets, then paste it below. (This replaces the grid with plain columns.)</div>' +
        '<textarea class="ste-pastebox" placeholder="Paste spreadsheet cells here…"></textarea>' +
        '<label class="ste-chk"><input type="checkbox" class="ste-firsthead" checked> First row is the column headings</label>' +
        '<div><button type="button" class="ste-add" data-p="fill">Fill grid</button> ' +
        '<button type="button" class="ste-tool" data-p="cancel">Cancel</button></div>' +
        "</div>";
      holder.querySelector('[data-p="cancel"]').addEventListener("click", function () { holder.innerHTML = ""; });
      holder.querySelector('[data-p="fill"]').addEventListener("click", function () {
        var txt = holder.querySelector(".ste-pastebox").value.replace(/\r/g, "");
        var lines = txt.split("\n");
        while (lines.length && lines[lines.length - 1] === "") lines.pop();
        if (!lines.length) { holder.innerHTML = ""; return; }
        var matrix = lines.map(function (l) { return l.split("\t"); });
        var firstHead = holder.querySelector(".ste-firsthead").checked;
        var ncols = Math.max.apply(null, matrix.map(function (r) { return r.length; }));
        var cols, data;
        if (firstHead) {
          cols = matrix[0].slice();
          while (cols.length < ncols) cols.push("");
          data = matrix.slice(1);
        } else {
          cols = [];
          for (var i = 0; i < ncols; i++) cols.push("Column " + (i + 1));
          data = matrix;
        }
        groups = cols.map(function (l) { return { label: l, subs: [] }; });
        rows = data.map(function (r) { r = r.slice(); while (r.length < cols.length) r.push(""); return r; });
        if (rows.length === 0) rows = [[]];
        fixRows(); serialize(); build(); renderPreview();
      });
    }

    // Adopt raw Advanced-mode JSON into the closure state (groups/rows).
    // MUST be called on every Advanced edit, not just on "Back": serialize()
    // rebuilds the hidden field FROM groups/rows, so any Advanced edit that
    // did not land here was silently thrown away on submit while the page
    // still said "saved successfully". (DEPLOY_READINESS_v2 T1.5)
    function adoptFromJson(o) {
      groups = toGroups(o.columnSpans);
      rows = (Array.isArray(o.rows) ? o.rows : []).map(function (r) {
        return (Array.isArray(r) ? r : []).map(function (x) { return x == null ? "" : String(x); });
      });
      if (groups.length > 0 && rows.length === 0) rows = [[]];
      if (groups.length === 0) rows = [];
      fixRows();
    }

    function buildAdvanced() {
      host.innerHTML = "";
      var note = document.createElement("div");
      note.className = "ste-note2";
      note.setAttribute("aria-live", "polite");
      var OK_NOTE = "Advanced mode — edit the raw data directly. The live preview updates as you type.";
      note.textContent = OK_NOTE;
      host.appendChild(note);
      var box = document.createElement("textarea");
      box.className = "ste-advbox";
      box.rows = 12;
      box.setAttribute("aria-label", "Size chart data (raw JSON)");
      box.value = ta.value;
      advMode = true;
      advInvalid = false;
      box.addEventListener("input", function () {
        ta.value = this.value;
        var o;
        try { o = JSON.parse(this.value); } catch (err) { o = null; }
        if (o && typeof o === "object") {
          adoptFromJson(o);          // keep groups/rows in step with the text
          advInvalid = false;
          note.textContent = OK_NOTE;
        } else {
          // Leave groups/rows alone but remember the text is unusable, so
          // submit blocks instead of quietly reverting to the old table.
          advInvalid = true;
          note.textContent = "This isn’t valid JSON yet — fix it before saving. Saving is blocked until it parses.";
        }
        renderPreview();
      });
      host.appendChild(box);
      var bar = document.createElement("div");
      bar.className = "ste-bar";
      bar.innerHTML = '<button type="button" class="ste-adv" data-a="back">← Back to the visual editor</button>';
      bar.querySelector('[data-a="back"]').addEventListener("click", function () {
        var o;
        try { o = JSON.parse(ta.value); } catch (err) {
          note.textContent = "The data isn’t valid JSON yet — fix it before switching back.";
          return;
        }
        adoptFromJson(o);
        advMode = false; advInvalid = false;
        serialize(); build(); renderPreview();
      });
      host.appendChild(bar);
    }

    serialize();
    build();
    renderPreview();
    var form = ta.closest("form");
    if (form) {
      form.addEventListener("submit", function (e) {
        if (advMode && advInvalid) {
          // Never let a save proceed while the Advanced text is unparseable —
          // the old code silently serialized the pre-Advanced state instead.
          e.preventDefault();
          var b = host.querySelector(".ste-advbox");
          if (b) b.focus();
          alert("The size chart data in Advanced mode is not valid JSON yet. Fix it (or click “Back to the visual editor”) before saving — nothing was saved.");
          return;
        }
        serialize();
      });
    }
  }

  function init() {
    injectCSS();
    var t1 = document.querySelector('[name="specTable1_rows"]');
    if (t1) enhanceSpecs(t1);
    var t2 = document.querySelector('[name="specTable2_json"]');
    if (t2) enhanceSize(t2);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
/* spec-table editor ready */
