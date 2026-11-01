/**
 * PLAN-13 guard suite — can the owner find his way around the dashboard?
 *
 * Written FIRST (PLAN-13 Phase 0), against the dashboard as it stood on
 * 2026-10-31, and expected to fail there for the reasons PLAN-13 §2 measured.
 * Each later phase turns its own rows green; none of them may turn one red.
 *
 *   U1  the menu bar is on screen after scrolling, on every page that scrolls,
 *       at 1440 and 390 (A1: it was position:static on 14 of 15 pages)
 *   U2  no visible text under 12px (C1: 984 such elements on Page Content)
 *   U3  the menu entry holding the current page is marked at >= 3:1 against
 *       the bar (A5: a 2px #005da3 underline on #0d2d52 is 2.0:1)
 *   U4  the save button of each long form is on screen at the top, middle and
 *       bottom of the page (D1: Business Details' was 4,127px down)
 *   U5  at 390 the first five products' Edit controls are on screen without
 *       sideways scrolling (E2: every action sat off-screen in the table)
 *   U6  Site Images & Logo and Catalog & Brochure PDFs are in the menu on every
 *       page (A3: reachable only from links inside other pages)
 *   U7  the bar shows at most six top-level entries at 1440 (A2, PLAN-13 §3.1)
 *   U8  on a phone the bar is one row, at most 80px tall (A6: three rows)
 *
 * Read-only: signs in to the mirror and saves nothing.
 * Usage: node _harness/admin-ux.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'admin-ux');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  'index.php', 'add.php', 'edit.php?sku=IP33PO', 'settings.php', 'content.php',
  'site-images.php', 'marketing-pdfs.php', 'inquiries.php', 'backups.php',
  'audit-log.php', 'password.php', 'help.php', 'upload-pdf.php?sku=IP33PO',
  'upload-image.php?sku=IP33PO', 'delete.php?sku=IP33PO',
];
// The long forms and the label of the button that saves each one.
const FORMS = [
  ['settings.php', /^Save Business Details/],
  ['add.php', /^Add Product/],
  ['edit.php?sku=IP33PO', /^Save Changes/],
  ['content.php', /^Save Content/],
];

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };
const name = (pg) => pg.replace(/\?.*/, '');

// WCAG relative luminance contrast of two computed rgb()/rgba() strings.
const CONTRAST = `(a, b) => {
  const lum = (c) => {
    const [r, g, bl] = c.match(/[\\d.]+/g).slice(0, 3).map(Number).map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}`;

(async () => {
  const b = await launch();
  const contexts = {};
  for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage();
    await p.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
    if (await p.$('input[type=password]')) {
      await p.fill('input[type=password]', PW);
      await p.click('button[type=submit]');
      await p.waitForLoadState('domcontentloaded');
    }
    contexts[w] = { ctx, p };
  }
  const open = async (w, pg) => {
    const { p } = contexts[w];
    await p.goto(BASE + '/admin/' + pg, { waitUntil: 'networkidle' });
    await p.evaluate(() => scrollTo(0, 0));
    return p;
  };
  const results = {};

  console.log('\n── U1 menu bar still on screen after scrolling ──');
  for (const w of [1440, 390]) {
    for (const pg of PAGES) {
      const p = await open(w, pg);
      const r = await p.evaluate(async () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        if (max < 200) return { skip: true };
        scrollTo(0, Math.round(max * 0.6));
        await new Promise((res) => setTimeout(res, 120));
        const hdr = document.querySelector('.ipc-admin-header');
        const rc = hdr && hdr.getBoundingClientRect();
        return { skip: false, top: rc && Math.round(rc.top), bottom: rc && Math.round(rc.bottom), ih: innerHeight };
      });
      if (r.skip) { console.log(`  n/a  ${w} ${name(pg)} does not scroll`); continue; }
      ok(r.top !== null && r.top >= -1 && r.bottom > 0 && r.bottom <= r.ih,
        `${w} ${name(pg).padEnd(18)} bar at top ${r.top}, bottom ${r.bottom} after scrolling 60%`);
    }
  }

  console.log('\n── U2 no visible text under 12px (1440) ──');
  for (const pg of PAGES) {
    const p = await open(1440, pg);
    const r = await p.evaluate(() => {
      const small = [];
      for (const e of document.querySelectorAll('body *')) {
        const rc = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        if (!rc.width || !rc.height || s.visibility === 'hidden' || s.display === 'none') continue;
        if (rc.width <= 1 && rc.height <= 1) continue; // screen-reader-only text, never seen
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        // SVG text is drawn at font-size × the picture's scale, so measure what
        // reaches the screen (Help's header diagram is a scaled <svg>).
        const scale = e instanceof SVGElement && e.getScreenCTM ? Math.abs(e.getScreenCTM().a) : 1;
        const px = parseFloat(s.fontSize) * scale;
        if (px < 12) small.push(`${px.toFixed(1)}px ${e.tagName.toLowerCase()} "${e.textContent.trim().slice(0, 30)}"`);
      }
      return small;
    });
    results[`U2:${name(pg)}`] = r;
    ok(r.length === 0, `${name(pg).padEnd(18)} ${r.length} text elements under 12px${r.length ? ' e.g. ' + r.slice(0, 2).join(' | ') : ''}`);
  }

  console.log('\n── U3 current menu entry marked at >= 3:1 (1440) ──');
  for (const pg of PAGES) {
    const p = await open(1440, pg);
    const r = await p.evaluate(`(() => {
      const contrast = ${CONTRAST};
      const hdr = document.querySelector('.ipc-admin-header');
      if (!hdr) return { why: 'no header' };
      const bar = getComputedStyle(hdr).backgroundColor;
      const cur = hdr.querySelector('[aria-current="page"], .current');
      if (!cur) return { why: 'no entry is marked as current' };
      // The visible marker is the entry itself, or the <summary> of the
      // drop-down that holds it while that drop-down is closed.
      const det = cur.closest('details');
      const el = det && !det.open ? det.querySelector('summary') : cur;
      const s = getComputedStyle(el);
      const solid = (c) => c && !/rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)|transparent/.test(c);
      if (solid(s.backgroundColor) && s.backgroundColor !== bar) return { kind: 'fill', ratio: contrast(s.backgroundColor, bar) };
      if (parseFloat(s.borderBottomWidth) > 0 && solid(s.borderBottomColor)) return { kind: 'underline', ratio: contrast(s.borderBottomColor, bar) };
      return { why: 'marked in the markup but nothing visible distinguishes it' };
    })()`);
    ok(!r.why && r.ratio >= 3,
      `${name(pg).padEnd(18)} ${r.why ? r.why : `${r.kind} ${r.ratio.toFixed(2)}:1 against the bar`}`);
  }

  console.log('\n── U4 save button on screen at top, middle and bottom ──');
  for (const w of [1440, 390]) {
    for (const [pg, label] of FORMS) {
      const p = await open(w, pg);
      const seen = await p.evaluate(async (src) => {
        const re = new RegExp(src);
        const btn = [...document.querySelectorAll('main button[type=submit], main input[type=submit]')]
          .find((x) => re.test((x.innerText || x.value || '').trim()));
        if (!btn) return null;
        const out = [];
        const max = document.documentElement.scrollHeight - innerHeight;
        for (const f of [0, 0.5, 1]) {
          scrollTo(0, Math.round(max * f));
          await new Promise((res) => setTimeout(res, 120));
          const rc = btn.getBoundingClientRect();
          out.push(rc.top >= 0 && rc.bottom <= innerHeight && rc.height > 0);
        }
        return out;
      }, label.source);
      ok(seen && seen.every(Boolean),
        `${w} ${name(pg).padEnd(14)} save on screen at top/middle/bottom: ${seen ? seen.map((v) => (v ? 'yes' : 'no')).join('/') : 'button not found'}`);
    }
  }

  console.log('\n── U5 phone: product Edit controls on screen without sideways scrolling ──');
  {
    const p = await open(390, 'index.php');
    const r = await p.evaluate(async () => {
      const edits = [...document.querySelectorAll('main a[href*="edit.php?sku="]')].slice(0, 5);
      const out = [];
      for (const a of edits) {
        const y = a.getBoundingClientRect().top + scrollY - innerHeight / 2;
        scrollTo(0, Math.max(0, y));
        await new Promise((res) => setTimeout(res, 60));
        const rc = a.getBoundingClientRect();
        const cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
        const inView = rc.left >= 0 && rc.right <= innerWidth && rc.width > 0;
        const hit = inView && a.contains(document.elementFromPoint(cx, cy));
        out.push({ sku: decodeURIComponent(a.href.split('sku=')[1] || ''), left: Math.round(rc.left), right: Math.round(rc.right), hit });
      }
      return out;
    });
    ok(r.length === 5, `found the first five products' Edit controls (${r.length})`);
    for (const e of r) ok(e.hit, `${e.sku.padEnd(22)} Edit at x=${e.left}–${e.right} of 390, ${e.hit ? 'visible and tappable' : 'off-screen or covered'}`);
  }

  console.log('\n── U6 Site Images & Catalog PDFs are in the menu (1440) ──');
  for (const pg of PAGES) {
    const p = await open(1440, pg);
    const r = await p.evaluate(() => {
      const hdr = document.querySelector('.ipc-admin-header');
      return hdr ? [!!hdr.querySelector('a[href$="site-images.php"]'), !!hdr.querySelector('a[href$="marketing-pdfs.php"]')] : [false, false];
    });
    ok(r[0] && r[1], `${name(pg).padEnd(18)} site-images ${r[0] ? 'yes' : 'no'}, marketing-pdfs ${r[1] ? 'yes' : 'no'}`);
  }

  console.log('\n── U7 / U8 the bar itself ──');
  {
    const p = await open(1440, 'index.php');
    const r = await p.evaluate(() => {
      const hdr = document.querySelector('.ipc-admin-header');
      const logo = hdr.querySelector('.logo');
      const items = [...hdr.querySelectorAll('a, button, summary')].filter((e) => {
        if (logo && logo.contains(e)) return false;
        // The links inside a CLOSED <details> keep a layout box in Chromium
        // (226x40 measured) but are not painted; checkVisibility() is the
        // browser's own answer to "can this be seen".
        if (e.checkVisibility && !e.checkVisibility()) return false;
        const rc = e.getBoundingClientRect();
        return rc.width > 0 && rc.height > 0;
      });
      return items.map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 24));
    });
    ok(r.length <= 6, `1440: ${r.length} top-level entries visible (at most 6): ${r.join(' · ')}`);
    const q = await open(390, 'index.php');
    const h = await q.evaluate(() => Math.round(document.querySelector('.ipc-admin-header').getBoundingClientRect().height));
    results.U8 = h;
    ok(h <= 80, `390: bar is ${h}px tall (at most 80)`);
  }

  fs.writeFileSync(path.join(OUT, 'admin-ux.json'), JSON.stringify({ pass, fail, results }, null, 2));
  console.log(`\nadmin-ux ${pass}/${pass + fail}`);
  for (const { ctx } of Object.values(contexts)) await ctx.close();
  await b.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
