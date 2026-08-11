/**
 * AUDIT-10 pass-6 — analysis over the tabwalk records.
 *
 * Reads _harness/out/audit10/p6/tabwalk-<viewport>.json and answers, per page
 * and per component class:
 *
 *   1. UNREACHABLE — an element the 6.1 census counts as interactive, that is
 *      rendered, enabled and not tabindex=-1, which no Tab press ever reached.
 *   2. FOCUS INDICATOR — the focused computed style diffed against that same
 *      element's own unfocused baseline. Classifies each class as
 *      designed-ring / UA-auto-ring / none, which is the consistency question
 *      step 6.2 is actually asking.
 *   3. ORDER — Tab sequence versus visual order (top-to-bottom, then
 *      left-to-right within a 12px row band). Reports inversions.
 *   4. TRAPS / ESCAPES — where the walk terminated and why.
 *
 * Nothing here measures the browser; it reduces what the tabwalk measured.
 *
 * Usage: node _harness/audit10-p6analyze.js [viewport]
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out', 'audit10', 'p6');
const vpName = process.argv[2] || 'desktop-1440';
const walk = JSON.parse(fs.readFileSync(path.join(OUT, `tabwalk-${vpName}.json`), 'utf8'));

const IND = ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'boxShadow',
  'borderTopColor', 'borderTopWidth', 'borderBottomColor', 'backgroundColor',
  'backgroundImage', 'color', 'textDecorationLine', 'transform', 'filter', 'opacity'];

const naturallyFocusable = (b) => {
  if (b.tabindex !== null && b.tabindex !== undefined) return Number(b.tabindex) >= 0;
  return ['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(b.tag)
    && !(b.tag === 'a' && !b.href);
};

const report = { viewport: vpName, pages: {}, classes: {}, totals: {} };
let totStops = 0, totUnreachable = 0, totNoIndicator = 0, totInversions = 0, totInversionsAll = 0;

for (const [url, p] of Object.entries(walk.pages)) {
  // Join on the stamped data-p6 index, never on cssPath — see the note in
  // audit10-p6tabwalk.js about the path collisions that manufactured 300+
  // phantom "unreachable" controls.
  const reached = new Set(p.stops.map((s) => s.p6).filter((v) => v !== null && v !== undefined));
  const page = { stops: p.stops.length, escapedAt: p.escapedAt, maxedOut: p.maxedOut,
                 autofocused: p.autofocused, tabBudget: p.tabBudget };
  totStops += p.stops.length;

  // ── 1. unreachable ───────────────────────────────────────────────────────
  page.unreachable = [];
  for (const [key, b] of Object.entries(p.base)) {
    if (reached.has(key)) continue;
    // An element the AUTOFOCUS put focus on before the walk began is reachable
    // by definition — it had focus without a single key press.
    if (p.autofocused && p.autofocused.p6 === key) continue;
    if (!b.rendered || b.disabled) continue;
    // Collapsed-disclosure content is not in the tab order BY DESIGN, and its
    // rect survives the collapse — see the note in audit10-p6tabwalk.js.
    if (b.inClosedDetails || b.visible === false) continue;
    if (b.tag === 'input' && (b.sig || '').includes('@hidden')) continue;
    if (!naturallyFocusable(b)) continue;
    page.unreachable.push({ selector: b.selector, sig: b.sig, text: b.text, box: b.box });
  }
  // A walk that hit its budget did not finish; anything it did not reach is
  // untested, not unreachable.
  if (p.maxedOut) { page.unreachableUnreliable = page.unreachable.length; page.unreachable = []; }
  totUnreachable += page.unreachable.length;

  // ── 2. focus indicator, per stop ─────────────────────────────────────────
  page.noIndicator = [];
  for (const s of p.stops) {
    const b = p.base[s.p6];
    if (!b) { s._nobase = true; continue; }
    const changed = IND.filter((k) => b.base[k] !== s.focused[k]);
    s._delta = changed;
    const cls = report.classes[s.sig] || (report.classes[s.sig] = {
      n: 0, designed: 0, uaAuto: 0, none: 0, pages: new Set(), sample: s.text, kinds: new Set(),
    });
    cls.n++; cls.pages.add(url);
    const hasOutline = s.focused.outlineStyle !== 'none' && s.focused.outlineStyle !== b.base.outlineStyle;
    const isAuto = s.focused.outlineStyle === 'auto';
    const otherInd = changed.some((k) => k.startsWith('boxShadow') || k.startsWith('border') || k === 'backgroundColor');
    if (!changed.length) {
      cls.none++; cls.kinds.add('none');
      page.noIndicator.push({ selector: s.selector, sig: s.sig, text: s.text });
      totNoIndicator++;
    } else if (hasOutline && !isAuto) {
      cls.designed++;
      cls.kinds.add(`designed:${s.focused.outlineWidth} ${s.focused.outlineStyle} ${s.focused.outlineColor}`);
    } else if (isAuto) {
      cls.uaAuto++; cls.kinds.add('ua-auto');
    } else if (otherInd) {
      cls.designed++; cls.kinds.add('designed:non-outline');
    } else {
      cls.none++; cls.kinds.add('none');
      page.noIndicator.push({ selector: s.selector, sig: s.sig, text: s.text });
      totNoIndicator++;
    }
  }

  // ── 3. tab order vs visual order ─────────────────────────────────────────
  // Visual order is (row band, then x). The mobile drawer and any fixed bar
  // are excluded from the comparison by nothing — a fixed element that sits
  // visually first but tabs last is exactly the defect being looked for.
  // The last stop of a walk that WRAPPED is the first element again; including
  // it makes every page look like it has one huge inversion.
  //
  // Visual position comes from the BASELINE box, not from the rect read at the
  // moment Tab landed. Two regions make the live rect useless as an ordering
  // key: the product sidebar is an inner scroll container (its children move
  // under it without changing window.scrollY) and admin/help.php's contents
  // list is sticky. Both produced non-monotonic docY inside a single visually
  // ordered list and six phantom "same-column inversions". The baseline box is
  // the at-rest layout position — what a visitor sees on load — and is stable.
  const body = p.stops.filter((s, i) => !(i === p.stops.length - 1 && s.repeatOf !== undefined));
  const vis = body.map((s, i) => {
    const b = p.base[s.p6];
    return { i, y: b ? b.box.y : s.docY, x: b ? b.box.x : s.docX, text: s.text, sig: s.sig,
             fromBaseline: !!b };
  });
  const sorted = [...vis].sort((a, b) => (Math.abs(a.y - b.y) <= 12 ? a.x - b.x : a.y - b.y));
  page.inversions = [];
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k].i >= sorted[k - 1].i) continue;
    const a = sorted[k], b = sorted[k - 1];
    page.inversions.push({
      tabIndexOfEarlierVisual: a.i, tabIndexOfLaterVisual: b.i,
      earlier: `${a.text} @${a.x},${a.y}`, later: `${b.text} @${b.x},${b.y}`,
      dx: Math.abs(a.x - b.x), dy: Math.abs(a.y - b.y),
      // A multi-column region (footer, contact page) is legitimately traversed
      // column by column: DOM order finishes one column before starting the
      // next, while a top-to-bottom visual scan crosses them. Those are not
      // order defects and flagging them buries the ones that are. Only an
      // inversion INSIDE one column band is significant.
      sameColumn: Math.abs(a.x - b.x) < 100,
    });
  }
  page.significantInversions = page.inversions.filter((v) => v.sameColumn);
  totInversions += page.significantInversions.length;
  totInversionsAll += page.inversions.length;

  report.pages[url] = page;
}

for (const c of Object.values(report.classes)) { c.pages = c.pages.size; c.kinds = [...c.kinds]; }
report.totals = { stops: totStops, unreachable: totUnreachable, noIndicator: totNoIndicator, inversionsAll: totInversionsAll, inversionsSameColumn: totInversions, classes: Object.keys(report.classes).length };

fs.writeFileSync(path.join(OUT, `analysis-${vpName}.json`), JSON.stringify(report, null, 1));

// ── console ────────────────────────────────────────────────────────────────
console.log(`\n══ pass-6 tabwalk analysis @ ${vpName} ══`);
console.log(`pages ${Object.keys(walk.pages).length} · tab stops ${totStops} · classes reached ${report.totals.classes}`);
console.log(`\n── termination ──`);
for (const [url, p] of Object.entries(report.pages)) {
  const how = p.maxedOut ? 'HIT 500-TAB CAP' : p.escapedAt !== null ? `escaped to browser UI after ${p.escapedAt}` : 'wrapped/repeat';
  console.log(`${String(p.stops).padStart(4)} stops  ${how.padEnd(34)} ${url}`);
}
console.log(`\n── unreachable (rendered, enabled, positive tabindex, never focused) — total ${totUnreachable} ──`);
for (const [url, p] of Object.entries(report.pages)) {
  if (!p.unreachable.length) continue;
  console.log(`${url}: ${p.unreachable.length}`);
  for (const u of p.unreachable.slice(0, 12)) console.log(`     ${u.sig.slice(0, 74)} | ${JSON.stringify(u.text).slice(0, 40)} | box ${JSON.stringify(u.box)}`);
  if (p.unreachable.length > 12) console.log(`     … ${p.unreachable.length - 12} more`);
}
console.log(`\n── focus indicator by component class ──`);
const rows = Object.entries(report.classes).sort((a, b) => b[1].n - a[1].n);
console.log(' n   pg  designed ua-auto none  kinds  class');
for (const [sig, c] of rows) {
  console.log(`${String(c.n).padStart(4)} ${String(c.pages).padStart(3)}  ${String(c.designed).padStart(8)} ${String(c.uaAuto).padStart(7)} ${String(c.none).padStart(4)}  ${c.kinds.join('|').slice(0, 44).padEnd(44)} ${sig.slice(0, 70)}`);
}
console.log(`\nclasses with a DESIGNED ring: ${rows.filter(([, c]) => c.designed > 0).length}`);
console.log(`classes on the UA auto ring : ${rows.filter(([, c]) => c.uaAuto > 0 && c.designed === 0).length}`);
console.log(`classes with NO indicator   : ${rows.filter(([, c]) => c.none > 0).length}`);
console.log(`\n── tab-order inversions vs visual order ──`);
console.log(`${totInversionsAll} total, of which ${totInversions} are INSIDE one column band (the significant ones);`);
console.log(`the rest are multi-column regions traversed column-by-column, which is not an order defect.`);
for (const [url, p] of Object.entries(report.pages)) {
  if (!p.significantInversions.length) continue;
  console.log(`${url}: ${p.significantInversions.length} same-column`);
  for (const v of p.significantInversions.slice(0, 8)) {
    console.log(`     visually-earlier ${JSON.stringify(v.earlier).slice(0, 62)} tabs at ${v.tabIndexOfEarlierVisual}`);
    console.log(`     after            ${JSON.stringify(v.later).slice(0, 62)} tabs at ${v.tabIndexOfLaterVisual}   (dx=${v.dx} dy=${v.dy})`);
  }
  if (p.significantInversions.length > 8) console.log(`     … ${p.significantInversions.length - 8} more`);
}
console.log(`\nanalysis -> ${path.join(OUT, `analysis-${vpName}.json`)}`);
