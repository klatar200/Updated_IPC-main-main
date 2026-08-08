/**
 * Targeted DOM probes for the UI/UX audit. Each probe answers one question the
 * screenshots raised, measured in the browser rather than inferred from source.
 *
 *   node _harness/audit-probe.js
 */
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';

async function main() {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const out = {};

  // ── /products sidebar ────────────────────────────────────────
  await page.goto(BASE + '/products', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  out.sidebar = await page.evaluate(() => {
    // The sidebar panel is the one whose header says "PRODUCT CATALOG".
    const heads = [...document.querySelectorAll('*')].filter(
      (e) => e.children.length === 0 && /PRODUCT CATALOG/i.test(e.textContent || ''));
    const head = heads[0];
    let panel = head;
    for (let i = 0; i < 6 && panel; i += 1) panel = panel.parentElement;
    const scrollers = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4) {
        scrollers.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 80),
          clientH: el.clientHeight, scrollH: el.scrollHeight,
          maxH: cs.maxHeight, text: (el.textContent || '').trim().slice(0, 50),
        });
      }
    }
    const countEl = [...document.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /\d+\s+products?$/i.test((e.textContent || '').trim()));
    // Product links in the sidebar region.
    const links = [...document.querySelectorAll('a[href*="productId="]')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').trim().slice(0, 50),
      y: Math.round(a.getBoundingClientRect().top + window.scrollY),
    }));
    const familyHeaders = [...document.querySelectorAll('button')]
      .filter((b) => /^[A-Z0-9 &\/\-]{4,}$/.test((b.textContent || '').replace(/\d+|▲|▼/g, '').trim()))
      .map((b) => (b.textContent || '').trim().slice(0, 45));
    return {
      countText: countEl ? countEl.textContent.trim() : null,
      scrollers,
      productLinkCount: links.length,
      uniqueProductIds: [...new Set(links.map((l) => decodeURIComponent((l.href.split('productId=')[1] || ''))))].length,
      familyHeaders,
      panelHeight: panel ? Math.round(panel.getBoundingClientRect().height) : null,
    };
  });

  // What is rendered in the detail pane with NO productId?
  out.productsBareLanding = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const detail = document.body.innerText;
    return {
      h1: h1 ? h1.textContent.trim() : null,
      hasProductDetailLabel: /PRODUCT DETAIL/i.test(detail),
      firstDetailHeading: (() => {
        const el = [...document.querySelectorAll('h2,h1')].map((e) => e.textContent.trim());
        return el.slice(0, 6);
      })(),
      url: location.href,
    };
  });

  // ── catalog totals ───────────────────────────────────────────
  out.catalog = await page.evaluate(async () => {
    const r = await fetch('/data/products-all.json');
    const list = await r.json();
    const byType = {};
    for (const p of list) byType[p.partType || '(none)'] = (byType[p.partType || '(none)'] || 0) + 1;
    const ids = list.map((p) => p.id);
    return { total: list.length, byType, dupIds: ids.filter((v, i) => ids.indexOf(v) !== i) };
  });

  // ── mega menus ───────────────────────────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  out.menus = {};
  for (const label of ['Products', 'Company']) {
    const btn = page.locator(`header button:has-text("${label}")`).first();
    await btn.click();
    await page.waitForTimeout(400);
    out.menus[label] = await page.evaluate(() => {
      const open = [...document.querySelectorAll('[aria-expanded="true"]')].map((e) => e.textContent.trim().slice(0, 30));
      const panel = [...document.querySelectorAll('a')].filter((a) => {
        const r = a.getBoundingClientRect();
        return r.top > 50 && r.top < 600 && r.width > 0;
      }).map((a) => ({ text: (a.textContent || '').trim().slice(0, 46), href: a.getAttribute('href') }));
      return { expanded: open, links: panel };
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    out.menus[label].closesOnEscape = await page.evaluate(
      () => document.querySelectorAll('[aria-expanded="true"]').length === 0);
  }

  // ── contact form structure ───────────────────────────────────
  await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  out.contact = await page.evaluate(() => {
    const fields = [...document.querySelectorAll('input,select,textarea')].map((el) => ({
      name: el.name, type: el.type, required: el.required,
      id: el.id, labelled: !!(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)),
      autocomplete: el.getAttribute('autocomplete'),
      inputmode: el.getAttribute('inputmode'),
      placeholder: el.placeholder || null,
    }));
    const forms = [...document.querySelectorAll('form')].map((f) => ({
      action: f.getAttribute('action'), method: f.method,
      fieldCount: f.querySelectorAll('input,select,textarea').length,
      submit: (f.querySelector('[type=submit]') || {}).textContent,
    }));
    return { fields, forms, tabs: [...document.querySelectorAll('[role=tab],button')].map((b) => b.textContent.trim().slice(0, 30)).slice(0, 14) };
  });

  // ── focus visibility / tab order on home ─────────────────────
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const tabbed = [];
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    tabbed.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || el.value || '').trim().slice(0, 34),
        outline: cs.outlineStyle === 'none' ? cs.boxShadow.slice(0, 40) : `${cs.outlineWidth} ${cs.outlineColor}`,
        w: Math.round(r.width), h: Math.round(r.height),
        inView: r.top >= 0 && r.bottom <= innerHeight,
      };
    }));
  }
  out.tabOrder = tabbed;

  // Skip link?
  out.skipLink = await page.evaluate(() => {
    const a = document.querySelector('a[href^="#"]');
    return a ? { text: a.textContent.trim(), href: a.getAttribute('href') } : null;
  });

  await browser.close();
  console.log(JSON.stringify(out, null, 1));
}
main();
