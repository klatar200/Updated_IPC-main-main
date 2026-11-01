/**
 * PLAN-13 Phase 7 — the whole signed-in admin on a phone (390) and a small
 * tablet (768), and from the keyboard.
 *
 * Per page, per width:
 *   W1  the page does not scroll sideways
 *   W2  no control is reachable only by scrolling sideways (inside a
 *       sideways-scrolling box, or past the right edge) — the products-table
 *       defect (§2 E2) generalised
 *   W3  every control is at least 24×24px (WCAG 2.5.8); a link inside a
 *       sentence is exempt, as the criterion allows
 *   W4  all visible text reaches 4.5:1 against what is painted behind it
 *       (3:1 at 24px, or 18.66px bold)
 *   W5  (390) each Audit Log entry's Detail spans its card
 * Per page, at 768, from the keyboard (Tab through the page):
 *   K1  every stop shows a focus indicator (outline or box-shadow)
 *   K2  no stop is hidden under the sticky menu bar or the save bar
 *   K3  no positive tabindex, and the stops run in page order
 *
 * Read-only. Usage: node _harness/plan13-a11y.js [page…]      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'plan13-a11y');
fs.mkdirSync(OUT, { recursive: true });
const ALL = [
  'index.php', 'add.php', 'edit.php?sku=IP33PO', 'settings.php', 'content.php',
  'site-images.php', 'marketing-pdfs.php', 'inquiries.php', 'backups.php',
  'audit-log.php', 'password.php', 'help.php', 'upload-pdf.php?sku=IP33PO',
  'upload-image.php?sku=IP33PO', 'delete.php?sku=IP33PO',
];
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const name = (pg) => pg.replace(/\?.*/, '');

let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}${!c && d ? `\n         <- ${d}` : ''}`); };

const LAYOUT = `(() => {
  const lum = (c) => { const [r, g, b] = c.match(/[\\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const alpha = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return 1; const p = m[1].split(',').map((s) => s.trim()); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;   // a picture: not measurable
      if (alpha(s.backgroundColor) >= 0.95) return s.backgroundColor;
    }
    return 'rgb(255, 255, 255)';
  };
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (!e.checkVisibility || e.checkVisibility()); };
  const scroller = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p; } return null; };
  const label = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' "' + (e.getAttribute('aria-label') || e.textContent || e.value || e.name || '').trim().replace(/\\s+/g, ' ').slice(0, 28) + '"');
  const out = { overflow: document.documentElement.scrollWidth - innerWidth, sideways: [], small: [], contrast: [] };
  const ctrls = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary')].filter(vis);
  // WCAG 2.5.8's spacing exception: an undersized target passes when a 24px
  // circle on its centre touches no other target (nor, for an undersized
  // one, that target's own circle).
  const boxes = ctrls.map((e) => e.getBoundingClientRect());
  const spaced = (i) => {
    const a = boxes[i], cx = a.left + a.width / 2, cy = a.top + a.height / 2;
    for (let j = 0; j < boxes.length; j++) {
      if (j === i) continue;
      const b = boxes[j];
      if (ctrls[j].contains(ctrls[i]) || ctrls[i].contains(ctrls[j])) continue;
      const dx = Math.max(b.left - cx, 0, cx - b.right), dy = Math.max(b.top - cy, 0, cy - b.bottom);
      if (Math.hypot(dx, dy) < 12) return false;
      if ((b.width < 24 || b.height < 24) && Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) < 24) return false;
    }
    return true;
  };
  ctrls.forEach((e, i) => { e._ipcSpaced = spaced(i); });
  for (const e of ctrls) {
    // Sideways-only: inside a box that scrolls sideways, or past the right edge.
    // Deliberate sideways scrollers: the one-row strips (the current item is
    // kept in view) and the size-chart grid, which is columns by nature and
    // says "Swipe the chart sideways" above itself on a phone.
    if (e.closest('.form-index, .cat-chips, .ste-host')) {}
    else {
      const r = e.getBoundingClientRect();
      if (scroller(e) || r.right > innerWidth + 1 || r.left < -1) out.sideways.push(label(e));
    }
    // 24×24, unless a link inside running text.
    const r = e.getBoundingClientRect();
    const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline' && e.parentElement && /\\S/.test([...e.parentElement.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''));
    const isCheck = e.tagName === 'INPUT' && /^(checkbox|radio)$/.test(e.type) && e.labels && e.labels.length;   // the label is the target
    if (!inline && !isCheck && !e._ipcSpaced && (r.width < 24 || r.height < 24)) out.small.push(label(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e)) continue;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (e.closest('svg, .vh, [aria-hidden=true]')) continue;
    const s = getComputedStyle(e);
    if (parseFloat(s.opacity) < 1 && e.closest('[disabled], :disabled')) continue;
    const rr = e.getBoundingClientRect(); if (rr.width <= 1 && rr.height <= 1) continue;
    if (e.matches('input, textarea, select, option')) continue;
    const bg = bgOf(e); if (!bg) continue;
    const px = parseFloat(s.fontSize), bold = parseInt(s.fontWeight, 10) >= 700;
    const need = (px >= 24 || (bold && px >= 18.66)) ? 3 : 4.5;
    const c = ratio(s.color, bg);
    if (c < need - 0.005) out.contrast.push(label(e) + ' ' + c.toFixed(2) + ':1 (' + s.color + ' on ' + bg + ')');
  }
  return out;
})()`;

const FOCUS = `(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return null;
  const s = getComputedStyle(e);
  const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
  const r = e.getBoundingClientRect();
  // What covers its centre? The sticky bar and the save bar are the suspects.
  const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height, 40) / 2));
  const top = document.elementFromPoint(cx, cy);
  const covered = !!(top && !e.contains(top) && !top.contains(e) && top.closest('.ipc-admin-header, .save-bar, .form-index'));
  const all = [...document.querySelectorAll('*')];
  return { tag: e.tagName.toLowerCase(), text: (e.getAttribute('aria-label') || e.textContent || e.name || '').trim().replace(/\\s+/g, ' ').slice(0, 30), ring, covered, idx: all.indexOf(e) };
})()`;

(async () => {
  const b = await launch();
  const report = {};
  for (const [w, h, touch] of [[390, 844, true], [768, 1024, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: w < 500 });
    const p = await ctx.newPage();
    console.log(`\n── ${w}px, signed out ──`);
    {
      // The sign-in page: the one admin page anyone sees before a password.
      await p.goto(BASE + '/admin/auth.php', { waitUntil: 'networkidle' });
      const r = await p.evaluate(LAYOUT);
      ok(r.overflow <= 0 && r.sideways.length === 0, `W1/W2 ${w} auth.php           fits the screen`, `overflow ${r.overflow}; ${r.sideways.join(' | ')}`);
      ok(r.small.length === 0, `W3 ${w} auth.php           controls at least 24×24`, r.small.join(' | '));
      ok(r.contrast.length === 0, `W4 ${w} auth.php           text at least 4.5:1`, r.contrast.slice(0, 3).join(' | '));
    }
    await p.fill('input[type=password]', PW);
    await p.click('button[type=submit]');
    await p.waitForLoadState('domcontentloaded');
    console.log(`\n── ${w}px ──`);
    for (const pg of PAGES) {
      await p.goto(BASE + '/admin/' + pg, { waitUntil: 'networkidle' });
      const r = await p.evaluate(LAYOUT);
      report[`${w} ${pg}`] = r;
      const n = name(pg).padEnd(18);
      ok(r.overflow <= 0, `W1 ${w} ${n} page width`, `scrolls sideways by ${r.overflow}px`);
      ok(r.sideways.length === 0, `W2 ${w} ${n} no control only reachable sideways`, `${r.sideways.length}: ${r.sideways.slice(0, 4).join(' | ')}`);
      ok(r.small.length === 0, `W3 ${w} ${n} controls at least 24×24`, `${r.small.length}: ${r.small.slice(0, 4).join(' | ')}`);
      ok(r.contrast.length === 0, `W4 ${w} ${n} text at least 4.5:1`, `${r.contrast.length}: ${r.contrast.slice(0, 3).join(' | ')}`);

      if (w === 390 && name(pg) === 'audit-log.php') {
        // W5 — the Audit Log on a phone: each entry's detail gets the full width.
        const d = await p.evaluate(() => [...document.querySelectorAll('#log-results td.detail')].slice(0, 20).map((c) => { const r = c.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right) }; }));
        ok(d.length > 0 && d.every((x) => x.w >= 300 && x.right <= 390), `W5 390 audit-log.php      each entry's Detail spans the card (${d.length} checked, narrowest ${d.length ? Math.min(...d.map((x) => x.w)) : 0}px)`);
      }
      if (w !== 768) continue;
      const tabs = [];
      await p.evaluate(() => { document.activeElement && document.activeElement.blur(); scrollTo(0, 0); });
      for (let i = 0; i < 70; i++) {
        await p.keyboard.press('Tab');
        const f = await p.evaluate(FOCUS);
        if (!f) break;
        if (tabs.length && f.idx === tabs[0].idx) break;   // wrapped round
        tabs.push(f);
      }
      const noRing = tabs.filter((t) => !t.ring).map((t) => `${t.tag} "${t.text}"`);
      const hidden = tabs.filter((t) => t.covered).map((t) => `${t.tag} "${t.text}"`);
      const back = tabs.filter((t, i) => i && t.idx < tabs[i - 1].idx).map((t) => `${t.tag} "${t.text}"`);
      const pos = await p.evaluate(() => [...document.querySelectorAll('[tabindex]')].filter((e) => +e.getAttribute('tabindex') > 0).length);
      report[`${w} ${pg}`].tabs = tabs;
      ok(noRing.length === 0, `K1 ${n} every Tab stop shows focus (${tabs.length} stops)`, `${noRing.length}: ${noRing.slice(0, 4).join(' | ')}`);
      ok(hidden.length === 0, `K2 ${n} no Tab stop hidden under a sticky bar`, `${hidden.length}: ${hidden.slice(0, 4).join(' | ')}`);
      ok(pos === 0 && back.length === 0, `K3 ${n} Tab follows the page order`, `positive tabindex ${pos}; backwards: ${back.slice(0, 3).join(' | ')}`);
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nplan13-a11y ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
