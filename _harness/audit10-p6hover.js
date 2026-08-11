/**
 * AUDIT-10 pass-6 step 6.2 (hover + active half) — per component CLASS, not
 * per instance.
 *
 * Reads the 6.1 census (plans/audit10/state/interactives.json), groups its
 * 6,900-odd elements by the `sig` component-class signature, and for every
 * class spot-verifies up to 3 rendered instances — preferring instances on
 * different pages, so a class that only misbehaves in one context is not
 * missed by sampling the same page three times.
 *
 * For each instance:
 *   default  — mouse parked away from the element, nothing focused
 *   hover    — real mouse.move onto the element's centre, waited out its own
 *              transition-duration, diffed against default across the element
 *              AND its subtree (a `group-hover:` rule paints a descendant, so
 *              an element-only diff reports "no hover state" on a control that
 *              plainly has one)
 *   active   — mouse.down, measured, then the pointer is moved 240px away
 *              BEFORE mouse.up so the click never activates. Measuring :active
 *              on a link by pressing it and releasing navigates the page and
 *              the next 40 measurements are taken on the wrong document.
 *   revert   — pointer moved away again; the hover delta must disappear.
 *              A delta that does not revert was a layout/scroll artifact, not
 *              a hover state, and is dropped rather than reported.
 *
 * Output: _harness/out/audit10/p6/hover-<viewport>.json
 * Usage:  node _harness/audit10-p6hover.js [viewport]      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');
const CENSUS = path.join(__dirname, '..', 'plans', 'audit10', 'state', 'interactives.json');

const VIEWPORTS = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-834': { width: 834, height: 1112 },
  'mobile-390': { width: 390, height: 844 },
};
const PER_CLASS = 3;

const PROPS = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow',
  'borderTopColor', 'borderTopWidth', 'borderBottomColor', 'backgroundColor',
  'backgroundImage', 'color', 'opacity', 'transform', 'filter',
  'textDecorationLine', 'textDecorationColor'];

const HELPERS = `
window.__p6h = (() => {
  const style = (el) => {
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of ${JSON.stringify(PROPS)}) o[p] = cs[p];
    o.cursor = cs.cursor;
    o.transitionDuration = cs.transitionDuration;
    return o;
  };
  /* element + up to 40 descendants, so group-hover: rules are seen */
  const snap = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const kids = [...el.querySelectorAll('*')].slice(0, 40);
    return {
      self: style(el),
      kids: kids.map(style),
      rect: (() => { const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    };
  };
  const maxDur = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return 0;
    let m = 0;
    for (const n of [el, ...el.querySelectorAll('*')].slice(0, 41)) {
      for (const d of (getComputedStyle(n).transitionDuration || '0s').split(',')) {
        const v = d.trim().endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000;
        if (!isNaN(v) && v > m) m = v;
      }
    }
    return m;
  };
  return { style, snap, maxDur };
})();
`;

/** Which of PROPS differ, on the element itself or on any descendant. */
function diff(a, b) {
  if (!a || !b) return null;
  const changed = [];
  for (const p of PROPS) {
    if (a.self[p] !== b.self[p]) changed.push(`self.${p}: ${a.self[p]} -> ${b.self[p]}`);
  }
  const n = Math.min(a.kids.length, b.kids.length);
  for (let i = 0; i < n; i++) {
    for (const p of PROPS) {
      if (a.kids[i][p] !== b.kids[i][p]) changed.push(`kid[${i}].${p}: ${a.kids[i][p]} -> ${b.kids[i][p]}`);
    }
  }
  return changed;
}

(async () => {
  const vpName = process.argv[2] || 'desktop-1440';
  const vp = VIEWPORTS[vpName];
  if (!vp) { console.error('unknown viewport ' + vpName); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });

  const census = JSON.parse(fs.readFileSync(CENSUS, 'utf8'));

  // ── choose up to PER_CLASS instances per signature, spread across pages ───
  const bySig = new Map();
  for (const [url, els] of Object.entries(census)) {
    for (const e of els) {
      if (e.hidden) continue;
      if (!bySig.has(e.sig)) bySig.set(e.sig, []);
      bySig.get(e.sig).push({ url, selector: e.selector, text: e.text, tag: e.tag });
    }
  }
  const targets = [];
  for (const [sig, list] of bySig) {
    const picked = [];
    const usedPages = new Set();
    for (const c of list) {                        // first pass: distinct pages
      if (picked.length >= PER_CLASS) break;
      if (usedPages.has(c.url)) continue;
      usedPages.add(c.url); picked.push(c);
    }
    for (const c of list) {                        // top up from anywhere
      if (picked.length >= PER_CLASS) break;
      if (picked.includes(c)) continue;
      picked.push(c);
    }
    picked.forEach((p) => targets.push({ sig, ...p }));
  }
  // hidden-only classes have no instance to sweep — record them explicitly
  const hiddenOnly = [];
  for (const [url, els] of Object.entries(census)) {
    for (const e of els) if (e.hidden && !bySig.has(e.sig)) hiddenOnly.push({ sig: e.sig, url, text: e.text });
  }

  const byPage = new Map();
  for (const t of targets) {
    if (!byPage.has(t.url)) byPage.set(t.url, []);
    byPage.get(t.url).push(t);
  }

  const browser = await launch();
  const results = [];
  try {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const actx = await browser.newContext({ viewport: vp });
    const apage = await actx.newPage();
    await apage.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    await apage.fill('input[type="password"]', PASS);
    await Promise.all([apage.waitForNavigation(), apage.click('button[type="submit"], input[type="submit"]')]);

    for (const [url, list] of byPage) {
      const isAdmin = url.startsWith('/admin');
      const p = isAdmin ? apage : page;
      const nav = url === '/admin/ (signed out)' ? '/admin/' : url;
      if (url === '/admin/ (signed out)') continue;      // signed-out login is swept by the tabwalk
      await p.goto(BASE + nav, { waitUntil: 'networkidle', timeout: 45000 });
      await p.waitForTimeout(300);
      await p.addScriptTag({ content: HELPERS });

      for (const t of list) {
        const r = { ...t, viewport: vpName };
        try {
          const exists = await p.evaluate((s) => !!document.querySelector(s), t.selector);
          if (!exists) { r.error = 'selector not found on re-navigation'; results.push(r); continue; }
          await p.evaluate((s) => document.querySelector(s)
            .scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }), t.selector);
          await p.waitForTimeout(120);

          // park the pointer away from everything, and settle
          await p.mouse.move(2, 2);
          await p.waitForTimeout(260);
          const dur = await p.evaluate((s) => window.__p6h.maxDur(s), t.selector);
          const settle = Math.min(1200, Math.max(220, dur + 120));

          const before = await p.evaluate((s) => window.__p6h.snap(s), t.selector);
          if (!before || before.rect.w === 0 || before.rect.h === 0) {
            r.error = 'not rendered at this viewport'; results.push(r); continue;
          }
          const cx = before.rect.x + before.rect.w / 2;
          const cy = before.rect.y + before.rect.h / 2;

          await p.mouse.move(cx, cy);
          await p.waitForTimeout(settle);
          const hovered = await p.evaluate((s) => window.__p6h.snap(s), t.selector);

          await p.mouse.down();
          await p.waitForTimeout(90);
          const active = await p.evaluate((s) => window.__p6h.snap(s), t.selector);
          await p.mouse.move(cx + 240, cy + 240);      // cancel the click before release
          await p.mouse.up();
          await p.waitForTimeout(settle);
          const reverted = await p.evaluate((s) => window.__p6h.snap(s), t.selector);

          r.cursor = before.self.cursor;
          r.transition = before.self.transitionDuration;
          r.hoverDelta = diff(before, hovered);
          r.activeDelta = diff(hovered, active);
          r.revertDelta = diff(before, reverted);
          r.hoverSticks = (r.revertDelta || []).length > 0;   // did not revert -> not a hover state
          r.rect = before.rect;
        } catch (e) {
          r.error = String(e).slice(0, 200);
        }
        results.push(r);
        process.stdout.write('.');
      }
    }
    await ctx.close(); await actx.close();
  } finally {
    await browser.close();
  }

  const file = path.join(OUT, `hover-${vpName}.json`);
  fs.writeFileSync(file, JSON.stringify({ viewport: vpName, classes: bySig.size, hiddenOnly, results }, null, 1));

  // ── per-class verdicts ───────────────────────────────────────────────────
  const verdict = new Map();
  for (const r of results) {
    if (!verdict.has(r.sig)) verdict.set(r.sig, { n: 0, hover: 0, active: 0, err: 0, sample: r.text, pages: new Set() });
    const v = verdict.get(r.sig);
    v.pages.add(r.url);
    if (r.error) { v.err++; continue; }
    v.n++;
    if ((r.hoverDelta || []).length && !r.hoverSticks) v.hover++;
    if ((r.activeDelta || []).length) v.active++;
  }
  const pointerish = (sig) => /^(a|button|summary)/.test(sig) || sig.includes('@role=button');
  let noHover = 0;
  console.log(`\n\n── hover/active sweep @ ${vpName} — ${verdict.size} classes, ${results.length} instances`);
  for (const [sig, v] of [...verdict].sort((a, b) => a[0].localeCompare(b[0]))) {
    const flag = pointerish(sig) && v.hover === 0 && v.n > 0 ? '  <<< NO HOVER DELTA' : '';
    if (flag) noHover++;
    console.log(`${String(v.n).padStart(2)}inst ${String(v.hover).padStart(2)}hov ${String(v.active).padStart(2)}act ${v.err ? v.err + 'err ' : '    '} ${sig.slice(0, 92)}${flag}`);
  }
  console.log(`\npointer-affordant classes with NO hover delta on any sampled instance: ${noHover}`);
  console.log(`classes present only as hidden elements (not sampled): ${hiddenOnly.length}`);
  console.log(`record -> ${file}`);
})();
