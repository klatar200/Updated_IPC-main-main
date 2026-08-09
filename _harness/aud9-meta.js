/**
 * 2026-08-09 audit probe — head metadata on not-found and alias ?productId= URLs.
 *
 * ProductPage matches a productId by exact id, exact sku, punctuation/case-
 * insensitive whole SKU, then whole segment (App.jsx:8655-8666). PageMeta
 * matches by EXACT id only (App.jsx:6973-6976) and canonicalFor() receives the
 * RAW param (App.jsx:7081). Hypothesis: alias and garbage ids render a product
 * detail whose <title>/<link rel=canonical>/BreadcrumbList disagree.
 */
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const CASES = [
  { name: 'control-exact', url: '/products?productId=CC' },
  { name: 'garbage-id', url: '/products?productId=NOPE-XYZ-123' },
  { name: 'alias-lowercase', url: '/products?productId=cc' },
  { name: 'alias-punct', url: '/products?productId=IP12GA%20-%20IP1274'.replace('IP12GA%20-%20IP1274', encodeURIComponent('ip12ga-ip1274')) },
];

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const c of CASES) {
    await page.goto(BASE + c.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const ld = q('#breadcrumb-ld');
      let lastItem = null, crumbNames = null;
      if (ld) {
        try {
          const j = JSON.parse(ld.text);
          const items = j.itemListElement || [];
          lastItem = items.length ? items[items.length - 1].item : null;
          crumbNames = items.map((i) => i.name).join(' > ');
        } catch (e) { lastItem = 'PARSE-ERROR'; }
      }
      const alertEl = q('[role="alert"]');
      // the product detail's own <h1> (the detail header renders the name)
      const h1s = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim());
      return {
        title: document.title,
        canonical: q('link[rel="canonical"]') ? q('link[rel="canonical"]').href : null,
        robots: q('meta[name="robots"]') ? q('meta[name="robots"]').content : null,
        ogUrl: q('meta[property="og:url"]') ? q('meta[property="og:url"]').content : null,
        banner: alertEl ? alertEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) : null,
        h1s,
        crumbNames,
        crumbLastItem: lastItem,
      };
    });
    console.log('### ' + c.name + '  ' + c.url);
    console.log(JSON.stringify(r, null, 1));
  }
  await browser.close();
})();
