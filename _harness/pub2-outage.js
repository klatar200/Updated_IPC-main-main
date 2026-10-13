/**
 * PUB-2 — a catalog outage must not tell search engines the product pages are
 * gone. audit-runs/audit-2026-09-27.md PUB-2 / §6.
 *
 * useProducts() hands back [] both while loading and when the fetch fails or
 * hits its 12 s abort, and PageMeta treated [] as "no such part": every
 * /products?productId=… URL got title "Part not found", robots noindex and no
 * canonical for as long as the outage lasted — one 503 during Googlebot's
 * render could de-index the product pages. The body meanwhile said "Catalog
 * Unavailable". /products and /dashboard kept their heads; only product URLs
 * were hit.
 *
 * Intercepts /data/products-all.json in the browser (no mirror change):
 *   outage-503 / outage-abort   no noindex, title is not "Part not found",
 *                               and no canonical pointing at /products
 *   outage-hang                 a never-answering catalog request, on a phone,
 *                               ends in Catalog Unavailable + Retry + call link
 *                               (AUDIT-12 A12-L13-W5-G3-1)
 *   control-normal              the real product: self-canonical, no noindex
 *   control-unknown             a missing id WITH the catalog loaded still
 *                               gets noindex + "Part not found" (A5 / item 3)
 *
 *   node _harness/pub2-outage.js           (serves from :8123)
 *   PUB2_BASE=http://127.0.0.1:8705 node _harness/pub2-outage.js
 */
const { launch } = require('./browser');

const BASE = process.env.PUB2_BASE || 'http://127.0.0.1:8123';
const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

(async () => {
  const browser = await launch();
  try {
    const head = async (url, mode) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      if (mode === '503') await page.route('**/data/products-all.json*', (r) => r.fulfill({ status: 503, body: 'down' }));
      if (mode === 'abort') await page.route('**/data/products-all.json*', (r) => r.abort('timedout'));
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const h = await page.evaluate(() => ({
        title: document.title,
        robots: document.querySelector('meta[name="robots"]')?.content || null,
        canonical: document.querySelector('link[rel="canonical"]')?.href || null,
        body: document.body.innerText.slice(0, 400),
      }));
      await ctx.close();
      return h;
    };
    const url = '/products?productId=IP12GA';

    for (const mode of ['503', 'abort']) {
      const h = await head(url, mode);
      note(/Catalog Unavailable/i.test(h.body), `outage-${mode}: the page body shows the outage (setup)`, h.body.slice(0, 120));
      note(h.robots !== 'noindex', `outage-${mode}: no noindex on a product URL while the catalog is unavailable`, `robots=${h.robots}`);
      note(!/Part not found/i.test(h.title), `outage-${mode}: the title does not claim the part is gone`, `title=${h.title}`);
      note(!h.canonical || /productId=IP12GA/.test(h.canonical),
        `outage-${mode}: no canonical pointing the product URL somewhere else`, `canonical=${h.canonical}`);
    }

    // ── outage-hang: the origin accepts and never answers (DEPLOY_READINESS T2.1)
    // r.abort('timedout') above rejects the fetch AT ONCE, never through the
    // 12 s AbortController, so a loader that swallowed AbortError (skeleton
    // forever) passed every check here (AUDIT-12 A12-L13-W5-G3-1). A phone
    // visitor whose catalog request simply hangs must, after the abort, get
    // the Catalog Unavailable panel with Retry and a tap-to-call number.
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await page.route('**/data/products-all.json*', () => {});     // never answered
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => /Catalog Unavailable/i.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
      const h = await page.evaluate(() => ({
        unavailable: /Catalog Unavailable/i.test(document.body.innerText),
        retry: [...document.querySelectorAll('button')].some((b) => /^\s*Retry\s*$/.test(b.textContent || '')),
        tel: [...document.querySelectorAll('a[href^="tel:"]')].some((a) => /tel:\+?\d{7,}/.test(a.getAttribute('href') || '')),
        skeletons: document.querySelectorAll('.ipc-skeleton').length,
      }));
      await ctx.close();
      note(h.unavailable && h.retry && h.tel && h.skeletons === 0,
        'outage-hang: a never-answering catalog request ends, on a phone, in "Catalog Unavailable" with Retry and a call link — not a skeleton forever',
        JSON.stringify(h));
    }

    const n = await head(url, null);
    note(n.robots === null && /productId=IP12GA$/.test(n.canonical || ''), 'control-normal: the real product is self-canonical and indexable',
      `robots=${n.robots} canonical=${n.canonical}`);
    const u = await head('/products?productId=NOSUCHPART', null);
    note(u.robots === 'noindex' && /Part not found/.test(u.title) && !u.canonical,
      'control-unknown: a missing id with the catalog loaded is still a soft-404 (noindex, no canonical)',
      `robots=${u.robots} title=${u.title} canonical=${u.canonical}`);
  } finally {
    await browser.close();
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\npub2-outage ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
