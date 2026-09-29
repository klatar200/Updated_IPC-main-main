/**
 * Two palette findings, measured in a real browser on the built site
 * (WHATS_LEFT §1al):
 *
 *   NEW-R3-m2-1  shadeOf() applied the shipped per-channel ratios to any base,
 *                tinting it: a pale #d0dcea dark gave a pinkish mega-menu
 *                panel. Off the shipped palette the shade must keep the base's
 *                hue (one uniform factor).
 *   brand-gradient-mixed-ends (product-header half)  the product page's <h1>
 *                was a flat white on dark-2 → primary, both owner colours, so a
 *                pale palette put white on pale. It must be readable (4.5:1)
 *                against BOTH ends.
 *
 * And on the shipped palette nothing moves: the four shades are the shipped
 * literals, the <h1> is white and the SKU line #e2e8f0.
 *
 * Throwaway copy of the mirror, own `php -S` on :8725.
 *
 *   node _harness/r3-shades.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const MIRROR = path.join(__dirname, 'site');
const PORT = 8725;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

const rgb = (s) => (/^#[0-9a-f]{6}$/i.test(String(s).trim()) ? hex(String(s).trim()) : (String(s).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function hue([r, g, b]) {
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  if (!d) return 0;
  const h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };
const lum = ([r, g, b]) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
  .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`r3-shades: port ${PORT} is already in use`); process.exit(2);
  }
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-r3shades-'));
  const SITE = path.join(TMP, 'site');
  fs.cpSync(MIRROR, SITE, { recursive: true, filter: (p) => !/\/(admin|pdfs|uploads)(\/|$)/.test(p) });
  const INFO = path.join(SITE, 'data', 'site-info.json');
  const shipped = fs.readFileSync(path.join(__dirname, 'pristine', 'site-info.json'), 'utf8');
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  let browser = null;
  const measure = async (theme) => {
    const info = JSON.parse(shipped);
    info.theme = { ...info.theme, ...theme };
    fs.writeFileSync(INFO, JSON.stringify(info, null, 4));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/products?productId=IP38FE', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const v = (k) => cs.getPropertyValue(k).trim();
      const h1 = document.querySelector('main h1');
      return {
        dark2: v('--brand-dark-2'), panel: v('--brand-dark-panel'), drawer: v('--brand-dark-drawer'), deep: v('--brand-primary-deep'),
        primary: v('--brand-primary'), h1: h1 ? getComputedStyle(h1).color : '',
        sku: h1 && h1.nextElementSibling ? getComputedStyle(h1.nextElementSibling).color : '',
      };
    });
    await ctx.close();
    return m;
  };
  try {
    await new Promise((r) => setTimeout(r, 700));
    browser = await launch();

    const s = await measure({});
    note(s.dark2 === 'rgb(10, 42, 82)' && s.panel === 'rgb(14, 40, 71)' && s.drawer === 'rgb(10, 36, 68)' && s.deep === 'rgb(0, 61, 122)',
      'shipped palette: the four shades are the shipped literals, unchanged', JSON.stringify([s.dark2, s.panel, s.drawer, s.deep]));
    note(s.h1 === 'rgb(255, 255, 255)' && s.sku === 'rgb(226, 232, 240)', 'shipped palette: product <h1> white and SKU #e2e8f0, unchanged', `${s.h1} / ${s.sku}`);

    for (const base of ['#d0dcea', '#f2e6c9']) {
      const p = await measure({ darkColor: base });
      const worst = Math.max(...[p.dark2, p.panel, p.drawer].map((c) => hueGap(rgb(c), hex(base))));
      note(worst <= 2, `R3-m2-1: dark ${base} — dark-2, panel and drawer keep its hue (worst ${worst.toFixed(1)}°)`, JSON.stringify([p.dark2, p.panel, p.drawer]));
    }
    const d = await measure({ primaryColor: '#d0dcea' });
    const gap = hueGap(rgb(d.deep), hex('#d0dcea'));
    note(gap <= 2, `R3-m2-1: primary #d0dcea — primary-deep keeps its hue (${gap.toFixed(1)}°)`, d.deep);

    for (const theme of [{ primaryColor: '#ffd400', darkColor: '#f2e6c9' }, { primaryColor: '#d0dcea', darkColor: '#d0dcea' }]) {
      const p = await measure(theme);
      const worst = Math.min(ratio(rgb(p.h1), rgb(p.dark2)), ratio(rgb(p.h1), rgb(p.primary)));
      note(worst >= 4.5, `product header: <h1> clears 4.5:1 on both gradient ends at ${JSON.stringify(theme)} (${worst.toFixed(2)})`, `${p.h1} on ${p.dark2} → ${p.primary}`);
      const skuWorst = Math.min(ratio(rgb(p.sku), rgb(p.dark2)), ratio(rgb(p.sku), rgb(p.primary)));
      note(skuWorst >= 4.5, `product header: SKU line clears 4.5:1 there too (${skuWorst.toFixed(2)})`, p.sku);
    }
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nr3-shades ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
