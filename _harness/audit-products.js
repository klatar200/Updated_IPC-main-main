/**
 * Sweep every product detail page and every route for content/layout defects
 * that only show up product-by-product.
 *
 *   node _harness/audit-products.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit');

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const catalog = JSON.parse(fs.readFileSync('data/products-all.json', 'utf8'));
  const rows = [];

  for (const p of catalog) {
    const url = `/products?productId=${encodeURIComponent(p.id)}`;
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(650);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const imgs = [...document.images].filter((i) => /products|placehold/.test(i.currentSrc || i.src));
      const main = document.querySelector('main');
      const txt = main ? main.innerText : '';
      const over = [];
      for (const el of document.querySelectorAll('main *')) {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > de.clientWidth + 1) over.push((el.textContent || '').trim().slice(0, 40));
      }
      // horizontally scrolling regions inside main
      const hscroll = [];
      for (const el of document.querySelectorAll('main *')) {
        if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) {
          hscroll.push({ cls: String(el.className || '').slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth });
        }
      }
      return {
        photo: imgs.length ? { src: imgs[0].currentSrc || imgs[0].src, nw: imgs[0].naturalWidth,
          alt: imgs[0].alt, painted: Math.round(imgs[0].getBoundingClientRect().width) } : null,
        hasDescription: /Product Detail/i.test(txt),
        pdfLink: !!document.querySelector('a[href*=".pdf"]'),
        specTables: document.querySelectorAll('main table').length,
        badges: [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0
          && /^(UL|cUL|CSA|MIL|RoHS|FDA|USP|ISO|UL-94|UL VW)/.test((e.textContent || '').trim())).length,
        overflow: over.slice(0, 5),
        hscroll,
        scrollHeight: de.scrollHeight,
        emptyPanels: [...document.querySelectorAll('main div')].filter((d) => {
          const b = d.getBoundingClientRect();
          return b.height > 60 && b.width > 200 && !(d.innerText || '').trim() && d.children.length === 0;
        }).length,
        notFoundBanner: /not found|no longer/i.test(txt),
      };
    });
    rows.push({ id: p.id, url, ...r });
    process.stdout.write('.');
  }
  console.log('');

  // external links + rel/target audit across routes
  const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries', '/services',
    '/about', '/faq', '/contact', '/privacy'];
  const links = {};
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    links[route] = await page.evaluate(() => {
      const out = { external: [], newTab: [], emptyHref: [], tel: [], mailto: [], generic: [] };
      for (const a of document.querySelectorAll('a')) {
        const h = a.getAttribute('href') || '';
        const t = (a.textContent || '').trim();
        if (!h || h === '#') out.emptyHref.push(t.slice(0, 40));
        else if (/^https?:/.test(h) && !h.includes(location.host)) out.external.push({ h, t: t.slice(0, 30), rel: a.getAttribute('rel'), target: a.getAttribute('target') });
        else if (h.startsWith('tel:')) out.tel.push(h);
        else if (h.startsWith('mailto:')) out.mailto.push(h);
        if (a.getAttribute('target') === '_blank') out.newTab.push({ t: t.slice(0, 34), rel: a.getAttribute('rel'), announced: /new (window|tab)/i.test(a.getAttribute('aria-label') || a.textContent || '') });
        if (/^(click here|read more|learn more|here|more)$/i.test(t)) out.generic.push(t);
      }
      return out;
    });
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'products.json'), JSON.stringify({ rows, links }, null, 1));
  console.log('wrote products.json');
})();
