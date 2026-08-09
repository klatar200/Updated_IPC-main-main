/**
 * PLAN-8 severity-C items that are code, not owner actions.
 *
 * C34 new-window links · C38 noscript · C40 form degradation ·
 * C43 logo alt · C44 empty card band · C46 mid-word truncation ·
 * C49 spec-table overflow · C50 marquee name.
 *
 * C30, C31, C33, C37, C39 and C41 have their own concerns and are asserted
 * separately or noted in the handback; C29 is listed at the end of this file
 * as explicitly out of scope with its reason.
 *
 * Usage: node _harness/plan8-polish.js       (needs :8123)
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-polish');
const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries',
                '/services', '/about', '/faq', '/contact', '/privacy'];

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** Every link that opens a new tab, with the name a screen reader would read. */
const READ_BLANK_LINKS = () =>
  [...document.querySelectorAll('a[target="_blank"]')].map((a) => ({
    href: (a.getAttribute('href') || '').slice(0, 60),
    rel: a.getAttribute('rel') || '',
    // innerText drops sr-only content in some engines; textContent keeps it,
    // and an aria-label overrides both.
    name: (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim(),
  }));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const rec = { blank: [], marquee: null, alts: [], forms: null, noscript: null, band: null, names: [], tables: [] };

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    for (const r of ROUTES) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      for (const l of await page.evaluate(READ_BLANK_LINKS)) rec.blank.push({ route: r, ...l });
      for (const a of await page.evaluate(() =>
        [...document.querySelectorAll('img')].map((i) => i.getAttribute('alt'))
      )) rec.alts.push({ route: r, alt: a });
    }
    // Product pages carry the datasheet download and the branded placeholder.
    for (const id of ['IP33PO', 'IP13SP']) {
      await page.goto(`${BASE}/products?productId=${id}`, { waitUntil: 'networkidle' });
      for (const l of await page.evaluate(READ_BLANK_LINKS)) rec.blank.push({ route: id, ...l });
      for (const a of await page.evaluate(() =>
        [...document.querySelectorAll('img')].map((i) => i.getAttribute('alt'))
      )) rec.alts.push({ route: id, alt: a });
    }

    // C50 — the marquee's accessible name, with motion allowed.
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    rec.marquee = await page.evaluate(() => {
      const t = document.querySelector('.ipc-marquee-track');
      if (!t) return null;
      return {
        role: t.getAttribute('role'),
        label: t.getAttribute('aria-label'),
        tabIndex: t.getAttribute('tabindex'),
      };
    });

    // C40 — both forms declare a real submission target.
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    rec.forms = await page.evaluate(() =>
      [...document.querySelectorAll('form')].map((f) => ({
        method: (f.getAttribute('method') || '').toLowerCase(),
        action: f.getAttribute('action') || '',
      }))
    );

    // C44 — no service card ends in an empty strip.
    await page.goto(BASE + '/services', { waitUntil: 'networkidle' });
    rec.band = await page.evaluate(() => {
      const empties = [];
      for (const el of document.querySelectorAll('div,a')) {
        const cs = getComputedStyle(el);
        if (!/^1px/.test(cs.borderTopWidth) || cs.backgroundColor !== 'rgb(248, 250, 252)') continue;
        const r = el.getBoundingClientRect();
        if (r.height < 8 || r.height > 90) continue;
        if (!el.textContent.trim()) empties.push({ h: Math.round(r.height), w: Math.round(r.width) });
      }
      return empties;
    });

    // C49 — no spec table scrolls horizontally at 1440.
    for (const p of products) {
      await page.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, { waitUntil: 'networkidle' });
      const bad = await page.evaluate(() => {
        const out = [];
        for (const t of document.querySelectorAll('main table')) {
          let w = t.parentElement;
          while (w && getComputedStyle(w).overflowX !== 'auto' && w !== document.body) w = w.parentElement;
          if (w && t.getBoundingClientRect().width > w.clientWidth + 1) {
            out.push(`${Math.round(t.getBoundingClientRect().width)} in ${w.clientWidth}`);
          }
        }
        return out;
      });
      if (bad.length) rec.tables.push({ id: p.id, bad });
    }
    await ctx.close();

    // C46 — product names must not be cut mid-word on the mobile list.
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mp = await mctx.newPage();
    await mp.goto(`${BASE}/products?productId=IP33PO`, { waitUntil: 'networkidle' });
    rec.names = await mp.evaluate(() =>
      [...document.querySelectorAll('div')]
        .filter((d) => d.children.length === 0 && getComputedStyle(d).webkitLineClamp !== 'none')
        .map((d) => ({
          text: d.textContent.trim().slice(0, 44),
          clamp: getComputedStyle(d).webkitLineClamp,
          nowrap: getComputedStyle(d).whiteSpace === 'nowrap',
          ellipsis: getComputedStyle(d).textOverflow === 'ellipsis',
        }))
    );
    await mp.screenshot({ path: path.join(OUT, 'mobile-names.png'), fullPage: false });
    await mctx.close();

    // ── C30 / C31 — industry deep links ───────────────────────────────────
    const ictx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ip = await ictx.newPage();

    await ip.goto(BASE + '/', { waitUntil: 'networkidle' });
    rec.marketCards = await ip.evaluate(() =>
      [...document.querySelectorAll('a[href*="/industries"]')].map((a) => a.getAttribute('href'))
    );

    await ip.goto(BASE + '/industries', { waitUntil: 'networkidle' });
    rec.industryIds = await ip.evaluate(() =>
      [...document.querySelectorAll('[id^="industry-"]')].map((e) => e.id)
    );
    rec.industryCtas = await ip.evaluate(() =>
      [...document.querySelectorAll('a[href*="/contact"]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => /industry=/.test(h))
    );

    // A COLD LOAD of a fragment. The browser cannot resolve it — the section
    // does not exist until React renders — so this is the case that proves
    // IndustriesPage's own effect works and not just the click handler.
    await ip.goto(BASE + '/industries#industry-medical', { waitUntil: 'networkidle' });
    await ip.waitForTimeout(1200);
    rec.coldAnchor = await ip.evaluate(() => {
      const el = document.getElementById('industry-medical');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), scrolled: Math.round(window.scrollY) };
    });

    // An IN-APP click, which goes through PageLink instead.
    await ip.goto(BASE + '/', { waitUntil: 'networkidle' });
    await ip.locator('a[href*="industry-medical"]').first().click();
    await ip.waitForTimeout(1400);
    rec.clickAnchor = await ip.evaluate(() => {
      const el = document.getElementById('industry-medical');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), scrolled: Math.round(window.scrollY), hash: location.hash };
    });

    // C31 — the industry reaches the form.
    await ip.goto(BASE + '/contact?industry=Medical%20Devices', { waitUntil: 'networkidle' });
    rec.contactPrefill = await ip.evaluate(() => {
      const ta = document.querySelector('textarea[name="additionalNotes"]');
      return ta ? ta.value : null;
    });
    await ictx.close();

    // C38 — the noscript fallback, read out of the served HTML.
    const res = await fetch(BASE + '/');
    const html = await res.text();
    const m = html.match(/<noscript>([\s\S]*?)<\/noscript>/i);
    rec.noscript = m ? m[1] : null;
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'polish.json'), JSON.stringify(rec, null, 2));

  // ── C34 ───────────────────────────────────────────────────────────────────
  const noRef = rec.blank.filter((l) => !/noreferrer/.test(l.rel));
  note(noRef.length === 0,
    `all ${rec.blank.length} new-tab links carry rel="noopener noreferrer"`,
    noRef.map((l) => `${l.route} ${l.href} rel="${l.rel}"`).join('\n         '));

  const unannounced = rec.blank.filter((l) => !/new (tab|window)/i.test(l.name));
  note(unannounced.length === 0,
    'every new-tab link says so in its accessible name',
    unannounced.map((l) => `${l.route} ${l.href} -> ${JSON.stringify(l.name.slice(0, 60))}`).join('\n         '));

  // ── C43 ───────────────────────────────────────────────────────────────────
  const badAlt = rec.alts.filter((a) => a.alt && /^ipc logo$/i.test(a.alt.trim()));
  note(badAlt.length === 0,
    `no image is described as "IPC logo" (${rec.alts.length} images checked)`,
    [...new Set(badAlt.map((a) => a.route))].join(', '));

  // ── C50 ───────────────────────────────────────────────────────────────────
  const mq = rec.marquee || {};
  note(mq.tabIndex === '0' && mq.role === 'group' && !!mq.label,
    `the trust marquee is a named group, not an anonymous tab stop ` +
    `(role=${mq.role}, label=${JSON.stringify(mq.label)})`);

  // ── C40 ───────────────────────────────────────────────────────────────────
  const badForm = (rec.forms || []).filter((f) => f.method !== 'post' || !/contact\.php$/.test(f.action));
  note((rec.forms || []).length >= 1 && badForm.length === 0,
    `every contact form posts to contact.php (${(rec.forms || []).length} form(s))`,
    JSON.stringify(rec.forms));

  // ── C44 ───────────────────────────────────────────────────────────────────
  note((rec.band || []).length === 0,
    'no service card renders an empty footer strip',
    JSON.stringify(rec.band));

  // ── C46 ───────────────────────────────────────────────────────────────────
  const cut = rec.names.filter((n) => n.nowrap && n.ellipsis);
  note(rec.names.length > 0 && cut.length === 0,
    `@390 product names wrap instead of being cut mid-word ` +
    `(${rec.names.length} clamped names, line-clamp ${rec.names[0] ? rec.names[0].clamp : '?'})`,
    JSON.stringify(cut.slice(0, 3)));

  // ── C49 ───────────────────────────────────────────────────────────────────
  note(rec.tables.length === 0,
    `no spec table scrolls horizontally at 1440, across all ${products.length} product pages`,
    rec.tables.map((t) => `${t.id}: ${t.bad.join(', ')}`).join('\n         '));

  // ── C38 ───────────────────────────────────────────────────────────────────
  const ns = rec.noscript || '';
  note(!!rec.noscript, 'index.html ships a <noscript> block');
  note(/tel:/.test(ns) && /Insulation Products Corporation/i.test(ns),
    'the noscript block names the company and carries a working tel: link',
    JSON.stringify(ns.slice(0, 80)));

  // ── C30 ───────────────────────────────────────────────────────────────────
  const framed = (rec.marketCards || []).filter((h) => /#industry-/.test(h));
  note(framed.length >= 5 && new Set(framed).size === framed.length,
    `the homepage market cards deep-link to distinct sections (${framed.length} of ` +
    `${(rec.marketCards || []).length} links, all different)`,
    JSON.stringify(rec.marketCards));

  note((rec.industryIds || []).length >= 5,
    `/industries carries an id per section (${(rec.industryIds || []).join(', ')}) — it had zero`);

  // The assertion that actually matters, and the one whose absence let three
  // dangling fragments ship: every fragment a card emits must resolve to a
  // section that exists. Testing one anchor by hand passed because `medical`
  // is spelled the same in both lists and `auto`/`aero` are not.
  const ids = new Set(rec.industryIds || []);
  const dangling = framed
    .map((h) => h.split('#')[1])
    .filter((f) => !ids.has(f));
  note(dangling.length === 0,
    `every market-card fragment resolves to a real section (${framed.length} checked)`,
    dangling.map((f) => `#${f} has no matching id`).join(', '));

  note(rec.coldAnchor && Math.abs(rec.coldAnchor.top) < 120 && rec.coldAnchor.scrolled > 200,
    `a COLD load of /industries#industry-medical lands on the section ` +
    `(top=${rec.coldAnchor ? rec.coldAnchor.top : '?'}, scrollY=${rec.coldAnchor ? rec.coldAnchor.scrolled : '?'})`,
    JSON.stringify(rec.coldAnchor));

  note(rec.clickAnchor && Math.abs(rec.clickAnchor.top) < 120 && rec.clickAnchor.scrolled > 200,
    `an IN-APP click from the homepage lands on it too, and the URL carries the fragment ` +
    `(top=${rec.clickAnchor ? rec.clickAnchor.top : '?'}, hash=${rec.clickAnchor ? rec.clickAnchor.hash : '?'})`,
    JSON.stringify(rec.clickAnchor));

  // ── C31 ───────────────────────────────────────────────────────────────────
  note((rec.industryCtas || []).length >= 5,
    `each industry's quote link carries its own industry (${(rec.industryCtas || []).length} links)`,
    JSON.stringify(rec.industryCtas));

  note(/Medical Devices/.test(rec.contactPrefill || ''),
    `the contact form arrives with the industry in it (${JSON.stringify(rec.contactPrefill)})`);

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-polish ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'polish.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
