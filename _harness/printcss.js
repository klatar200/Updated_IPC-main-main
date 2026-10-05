/**
 * A-7.7 (audit 7, closed 2026-10-05 — WHATS_LEFT §1aq) — the print stylesheet.
 *
 * Buyers print spec pages into requisitions. Measured before (audit 7, and
 * again 2026-10-05): ZERO @media print rules; the site header, the 440 px
 * footer and the fixed quote bar printed; the product name began 364 px down;
 * IP33PO took 4 Letter pages. This suite emulates print media in Chromium on
 * three product pages and /about, and asserts:
 *   - at least one @media print rule is loaded
 *   - the site header, footer, quote bar, action buttons and Related Products
 *     are not printed
 *   - no gradient or coloured background is left on the page banner, and
 *     body text prints black
 *   - IP33PO prints on 3 Letter pages or fewer (was 4)
 *   - and the SCREEN view is untouched: header and footer still show
 *
 * Read-only against the mirror on :8123.
 *
 *   node _harness/printcss.js
 */
const { launch } = require('./browser');
const BASE = process.env.PRINT_BASE || 'http://127.0.0.1:8123';
const results = [];
const note = (ok, label, detail) => { results.push({ ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`); };

(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  for (const route of ['/products?productId=IP33PO', '/products?productId=IP12GA', '/products?productId=CC90', '/about']) {
    await p.emulateMedia({ media: 'screen' });
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    const screen = await p.evaluate(() => ({ header: getComputedStyle(document.querySelector('header')).display !== 'none', footer: getComputedStyle(document.querySelector('footer')).display !== 'none' }));
    await p.emulateMedia({ media: 'print' });
    const m = await p.evaluate(() => {
      let rules = 0;
      for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r.media && /print/.test(r.media.mediaText)) rules++; } catch {} }
      const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      const banner = document.querySelector('.ipc-page-header');
      const bcs = banner && getComputedStyle(banner);
      const visibleButtons = [...document.querySelectorAll('button')].filter(shown).length;
      const fixed = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && shown(e)).length;
      const related = [...document.querySelectorAll('div')].some((d) => /^Related Products/.test(d.textContent.trim()) && d.children.length === 0 && shown(d));
      const para = document.querySelector('main p') || document.querySelector('p');
      return { rules, header: shown(document.querySelector('header')), footer: shown(document.querySelector('footer')), visibleButtons, fixed, related,
        bannerBg: bcs ? bcs.backgroundImage + ' ' + bcs.backgroundColor : 'none', ink: para ? getComputedStyle(para).color : '' };
    });
    note(m.rules >= 1, `${route}: a print stylesheet is loaded`, `${m.rules} rules`);
    note(!m.header && !m.footer && m.fixed === 0, `${route}: site header, footer and fixed bars do not print`, JSON.stringify(m));
    note(m.visibleButtons === 0 && !m.related, `${route}: no buttons and no Related Products on paper`, JSON.stringify(m));
    note(!/gradient/.test(m.bannerBg) && /rgba\(0, 0, 0, 0\)|transparent/.test(m.bannerBg) && m.ink === 'rgb(0, 0, 0)', `${route}: banner prints without its colour block, text prints black`, `${m.bannerBg} / ${m.ink}`);
    note(screen.header && screen.footer, `${route}: the screen view still shows the header and footer`);
    if (route.includes('IP33PO')) {
      const pdf = await p.pdf({ format: 'Letter' });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      note(pages <= 3, `${route}: prints on ${pages} Letter page(s) (was 4)`);
    }
  }
  await b.close();
  const bad = results.filter((x) => !x.ok).length;
  console.log(`\nprintcss ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
