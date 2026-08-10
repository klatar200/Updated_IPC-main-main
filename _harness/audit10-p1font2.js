/**
 * AUDIT-10 pass-1 font control, round two.
 *
 * Same rule as audit10-p1font.js (guardrails font_caveat): a width claim on a
 * DejaVu-Sans box is not a finding until it has been re-measured under
 * Liberation Sans, which is metric-compatible with Arial. Applied here to the
 * three remaining width-shaped leads:
 *
 *   faq       the /faq category chip scroller — how much is hidden, which chip
 *   dash      the /dashboard search field — placeholder vs available width
 *   contact   the /contact left-rail cards — text painted past the card border
 *
 * Output: _harness/out/audit10/p1font2.json  (gitignored)
 * Usage:  node _harness/audit10-p1font2.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
];
const FORCE = `*, *::before, *::after { font-family: "Liberation Sans", sans-serif !important; }`;

/* eslint-disable no-undef */
function faq() {
  const R = (n) => Math.round(n * 10) / 10;
  const box = document.querySelector('div.flex.gap-3.overflow-x-auto');
  if (!box) return { missing: true };
  const r = box.getBoundingClientRect();
  const chips = [...box.children].map((c) => {
    const cr = c.getBoundingClientRect();
    return { t: (c.textContent || '').trim().slice(0, 32), hidden: R(Math.max(0, cr.right - r.right)), w: R(cr.width) };
  });
  return {
    boxW: R(r.width), scrollW: R(box.scrollWidth), hiddenPx: R(box.scrollWidth - box.clientWidth),
    chipsCut: chips.filter((c) => c.hidden > 0.5),
  };
}
function dash() {
  const R = (n) => Math.round(n * 10) / 10;
  const inp = [...document.querySelectorAll('input')].find((i) => (i.getAttribute('placeholder') || '').startsWith('Search'));
  if (!inp) return { missing: true };
  const r = inp.getBoundingClientRect();
  const cs = getComputedStyle(inp);
  const ph = inp.getAttribute('placeholder') || '';
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const need = cv.measureText(ph).width;
  const avail = r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  return { fieldW: R(r.width), availW: R(avail), needW: R(need), cutPx: R(Math.max(0, need - avail)), placeholder: ph };
}
function contact() {
  const R = (n) => Math.round(n * 10) / 10;
  const out = [];
  const rng = document.createRange();
  for (const el of document.querySelectorAll('div,a')) {
    const cs = getComputedStyle(el);
    if (parseFloat(cs.borderTopWidth) < 1) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.width > 700 || r.height < 40) continue;
    let maxRight = r.left, who = '';
    for (const n of el.querySelectorAll('*')) {
      for (const t of n.childNodes) {
        if (t.nodeType !== 3 || !t.textContent.trim()) continue;
        rng.selectNodeContents(t);
        for (const b of rng.getClientRects()) {
          if (b.width >= 1 && b.right > maxRight) { maxRight = b.right; who = t.textContent.trim().slice(0, 40); }
        }
      }
    }
    const pastBorder = maxRight - r.right;
    const pastPad = maxRight - (r.right - (parseFloat(cs.paddingRight) || 0));
    if (pastPad > 0.5) out.push({ cardW: R(r.width), y: R(r.top + window.scrollY), pastPadding: R(pastPad), pastBorder: R(pastBorder), text: who });
  }
  return out.slice(0, 8);
}
/* eslint-enable no-undef */

const JOBS = [['/faq', 'faq', faq], ['/dashboard', 'dash', dash], ['/contact', 'contact', contact]];

(async () => {
  const browser = await launch();
  const out = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      for (const [url, name, fn] of JOBS) {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(400);
        const shipped = await page.evaluate(fn);
        await page.addStyleTag({ content: FORCE });
        await page.waitForTimeout(400);
        const narrow = await page.evaluate(fn);
        out.push({ pass: pass + 1, url, viewport: vp.name, probe: name, shipped, narrow });
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p1font2.json'), JSON.stringify(out, null, 1));
  const a = JSON.stringify(out.filter((o) => o.pass === 1).map((o) => [o.url, o.viewport, o.shipped, o.narrow]));
  const b = JSON.stringify(out.filter((o) => o.pass === 2).map((o) => [o.url, o.viewport, o.shipped, o.narrow]));
  console.log('identical across two navigations: ' + (a === b));
  for (const o of out.filter((x) => x.pass === 1)) {
    console.log(`\n-- ${o.probe} ${o.viewport} ${o.url}`);
    console.log('   shipped(DejaVu):    ' + JSON.stringify(o.shipped));
    console.log('   Liberation Sans:    ' + JSON.stringify(o.narrow));
  }
  console.log('\n-> _harness/out/audit10/p1font2.json');
})();
