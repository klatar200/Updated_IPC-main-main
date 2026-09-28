/**
 * C2 — text must stay readable on every palette the admin ACCEPTS, not only
 * on the shipped one: NEW-N1-4 (an ink token derived from the wrong surface),
 * NEW-N1-5 (hardcoded white on surfaces that follow --brand-dark), NEW-N1-6
 * (onMouseLeave writing hardcoded white back over a themed ink).
 * audit-runs/audit-2026-09-27.md §7.2 / §9.2. The shipped palette is
 * unaffected by all three, which is why nothing else in the harness sees them.
 *
 * Method: every element that paints its own text is scored against its real
 * composited backdrop (backdrop.js, the same code brandtext.js uses), on 9
 * routes × 2 widths, with the mobile drawer and both desktop menus opened, and
 * after hovering-then-leaving every link and button in the header and main
 * (N1-6 only shows AFTER a hover). Once at the shipped palette, then at each
 * test palette. A PALETTE-INDUCED failure is an element that clears 3:1 at the
 * shipped palette and falls below 3:1 at a test palette. 3:1, not 4.5: this
 * catches "unreadable because of the owner's colour", not the open brand
 * decisions brandtext.js already tracks at the shipped palette.
 *
 * Own `php -S` on :8722 over SITE (default: the mirror). Restores
 * site-info.json in a finally.
 *
 *   node _harness/lowsC2-palettes.js [--list]
 *   LOWSC2_SITE=<dir> node _harness/lowsC2-palettes.js   # another built site
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');
const { SOURCE, ratio } = require('./backdrop');

const SITE = process.env.LOWSC2_SITE || path.join(__dirname, 'site');
const PRISTINE = process.env.LOWSC2_PRISTINE || path.join(__dirname, 'pristine', 'site-info.json');
const INFO = path.join(SITE, 'data', 'site-info.json');
const PORT = 8722;
const BASE = `http://127.0.0.1:${PORT}`;
const ROUTES = ['/', '/products', '/dashboard', '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];
const LIST = process.argv.includes('--list');

// Palettes the admin accepts (settings.php validates only #rrggbb). The first
// three are the register's own measurements; the last two are the pale-dark
// case N1-5 names.
const PALETTES = [
  { name: 'primary #ffd400', theme: { primaryColor: '#ffd400' } },
  { name: 'primary #f7941d', theme: { primaryColor: '#f7941d' } },
  { name: 'primary #d0dcea', theme: { primaryColor: '#d0dcea' } },
  { name: 'dark #d0dcea', theme: { darkColor: '#d0dcea' } },
  { name: 'dark #f2e6c9', theme: { darkColor: '#f2e6c9' } },
];

const PROBE = () => {
  function ownText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }
  function sig(el) {
    const parts = [];
    let e = el;
    for (let i = 0; e && e !== document.body && i < 6; i++, e = e.parentElement) {
      const idx = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0;
      parts.unshift(`${e.tagName.toLowerCase()}${idx}`);
    }
    return parts.join('>') + '|' + (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  }
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!ownText(el) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const fg = window.__ipcParse(cs.color);
    const back = window.__ipcBackdrop(el);
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // Where the colour and the backdrop come from, for --list: the nearest
    // inline `color:` and the nearest painted ancestor's inline background.
    let p = el, src = '';
    while (!src && p && p !== document.body) { src = ((p.getAttribute('style') || '').match(/(?:^|;)\s*color:\s*([^;]*)/) || [, ''])[1]; p = p.parentElement; }
    let q = el, bsrc = '';
    while (q && q !== document.body) {
      const qs = getComputedStyle(q);
      if (qs.backgroundImage !== 'none' || qs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        bsrc = ((q.getAttribute('style') || '').match(/background[^;]*/) || ['class=' + (q.className || '').toString().slice(0, 40)])[0];
        break;
      }
      q = q.parentElement;
    }
    out.push({ key: sig(el), fg, back, large: size >= 24 || (weight >= 700 && size >= 18.66), src: `${src || cs.color} ON ${bsrc}` });
  }
  return out;
};

async function hoverAway(page) {
  const handles = await page.$$('header a, header button, nav a, nav button, main a, main button');
  for (const h of handles.slice(0, 160)) {
    try {
      if (!(await h.isVisible())) continue;
      await h.hover({ timeout: 300 });
      await page.mouse.move(2, 2);
    } catch { /* detached or covered: skip */ }
  }
}

const srcOf = new Map();
async function scan(browser) {
  const res = new Map();
  for (const route of ROUTES) {
    for (const w of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      await page.evaluate(SOURCE);
      const states = [['base', async () => {}], ['hovered', () => hoverAway(page)]];
      if (w === 390) states.push(['drawer', async () => { const b = page.locator('button[aria-label*="enu" i]').first(); if (await b.count()) { await b.click(); await page.waitForTimeout(300); } }]);
      if (w === 1440) states.push(['menus', async () => { const t = page.locator('button[aria-haspopup="true"]').first(); if (await t.count()) { await t.hover(); await page.waitForTimeout(250); } }]);
      for (const [state, act] of states) {
        await act();
        await page.evaluate(SOURCE);
        for (const r of await page.evaluate(PROBE)) {
          const [a, b] = r.back;
          const fgA = window_over(r.fg, a), fgB = window_over(r.fg, b);
          const v = Math.min(ratio(fgA, a), ratio(fgB, b));
          const k = `${route}@${w}:${state}:${r.key}`;
          if (!res.has(k) || res.get(k) > v) res.set(k, v);
          srcOf.set(k, r.src);
        }
      }
      await ctx.close();
    }
  }
  return res;
}
// Composite a possibly-translucent foreground over its backdrop (node side).
function window_over(fg, bg) {
  const a = fg.length > 3 ? fg[3] : 1;
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a)));
}

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`lowsC2-palettes: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  fs.copyFileSync(PRISTINE, INFO);
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  let browser = null;
  let bad = 0;
  const results = [];
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));
    const shipped = await scan(browser);
    for (const p of PALETTES) {
      const info = JSON.parse(fs.readFileSync(PRISTINE, 'utf8'));
      info.theme = { ...info.theme, ...p.theme };
      fs.writeFileSync(INFO, JSON.stringify(info, null, 4));
      const now = await scan(browser);
      const induced = [];
      for (const [k, v] of now) {
        const was = shipped.get(k);
        if (was !== undefined && was >= 3 && v < 3) induced.push([k, was, v]);
      }
      induced.sort((x, y) => x[2] - y[2]);
      const ok = induced.length === 0;
      if (!ok) bad++;
      results.push(ok);
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${p.name}: ${induced.length} text element(s) readable at the shipped palette fall below 3:1`);
      for (const [k, was, v] of induced.slice(0, LIST ? 400 : 8)) console.log(`       ${v.toFixed(2)} (was ${was.toFixed(2)})  ${k}${LIST ? `\n              ${srcOf.get(k)}` : ''}`);
    }
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.copyFileSync(PRISTINE, INFO);
  }
  console.log(`\nlowsC2-palettes ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
