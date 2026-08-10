/**
 * AUDIT-10 pass-6 step 6.2 / 6.5(c) — the two things the class sweep cannot do.
 *
 * PART A — DEAD HOVER UTILITIES.
 * Roughly half this site's controls are styled with an inline `style={{...}}`
 * object and a Tailwind className side by side. An inline declaration beats any
 * class rule, so `className="hover:bg-blue-700"` on an element that also sets
 * `style={{ background: ... }}` declares a hover state the browser can never
 * paint. This walks every element on every route, pairs each `hover:` utility
 * with the CSS property it would set, and flags the ones whose property is
 * occupied by the element's own inline style — then MEASURES the hover to
 * confirm the utility really is dead rather than merely suspicious.
 *
 * Only bg/text/border can collide: brightness (filter), shadow (box-shadow),
 * translate (transform) and opacity are properties these inline objects do not
 * set, so those utilities win normally. The probe encodes that mapping rather
 * than assuming it.
 *
 * PART B — INLINE-STYLED COMPONENT CLASSES.
 * The 6.1 census signature is tag + className, so every inline-styled control
 * on the site collapses into one bucket called `a` (2,337 elements) or
 * `button` (125). Sampling three of those samples three unrelated components.
 * Part B names the real components — navbar link, mega-menu trigger, mega-menu
 * item, sidebar family header, sort header, FAQ row, inline tel/mailto,
 * approval chip, sticky RFQ — and sweeps each one specifically.
 *
 * Output: _harness/out/audit10/p6/comp-<viewport>.json
 * Usage:  node _harness/audit10-p6comp.js [viewport]        (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');

const VIEWPORTS = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-834': { width: 834, height: 1112 },
  'mobile-390': { width: 390, height: 844 },
};
const ROUTES = ['/', '/products', '/services', '/industries', '/about', '/contact',
                '/dashboard', '/datasheets', '/faq', '/privacy', '/products?productId=CC'];

/* Tailwind hover utility prefix -> [computed property, inline-style properties
   that would override it]. */
const MAP = [
  ['bg-', 'backgroundColor', ['background', 'backgroundColor']],
  ['text-', 'color', ['color']],
  ['border-', 'borderTopColor', ['border', 'borderColor', 'borderTopColor']],
];

const SCAN = `
window.__cmp = {
  dead: () => {
    const out = [];
    for (const el of document.querySelectorAll('[class*="hover:"]')) {
      const cls = typeof el.className === 'string' ? el.className : '';
      const utils = cls.split(/\\s+/).filter((c) => c.startsWith('hover:'));
      if (!utils.length) continue;
      const inline = el.getAttribute('style') || '';
      for (const u of utils) {
        const bare = u.slice(6);
        for (const [pfx, prop, inlineProps] of ${JSON.stringify(MAP)}) {
          if (!bare.startsWith(pfx)) continue;
          const occupied = inlineProps.filter((p) => {
            const kebab = p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
            return new RegExp('(^|;)\\\\s*' + kebab + '\\\\s*:', 'i').test(inline);
          });
          if (occupied.length) {
            out.push({
              util: u, prop, occupiedBy: occupied,
              text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 46),
              cls: cls.slice(0, 110),
              inline: inline.slice(0, 150),
              path: (() => { const p = []; let n = el;
                while (n && n !== document.body) { p.unshift(n.tagName.toLowerCase()); n = n.parentElement; }
                return p.slice(-4).join('>'); })(),
            });
          }
        }
      }
    }
    return out;
  },
  style: (el) => {
    const cs = getComputedStyle(el);
    return { backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage,
      color: cs.color, borderTopColor: cs.borderTopColor, borderTopWidth: cs.borderTopWidth,
      boxShadow: cs.boxShadow, transform: cs.transform, filter: cs.filter, opacity: cs.opacity,
      textDecorationLine: cs.textDecorationLine, cursor: cs.cursor,
      animationPlayState: cs.animationPlayState, outlineStyle: cs.outlineStyle };
  },
  /* sel narrows the candidate set — text alone matched a sidebar link when the
     subject was a product card, and matched the navbar CTA when the subject
     was the sticky RFQ bar. Both would have been recorded as components with
     no hover state that in fact have one. */
  find: (text, nth, sel) => {
    const els = [...document.querySelectorAll(sel || 'a,button,summary,[role="button"]')]
      .filter((e) => (e.textContent || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().includes(text));
    const el = els[nth || 0];
    if (!el) return null;
    el.setAttribute('data-cmp', '1');
    const r = el.getBoundingClientRect();
    return { rect: { x: r.x, y: r.y, w: r.width, h: r.height },
             text: (el.textContent || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50),
             cls: (typeof el.className === 'string' ? el.className : '').slice(0, 90),
             tag: el.tagName.toLowerCase(),
             style: window.__cmp.style(el),
             count: els.length };
  },
  after: () => {
    const el = document.querySelector('[data-cmp]');
    return el ? window.__cmp.style(el) : null;
  },
  clear: () => { const e = document.querySelector('[data-cmp]'); if (e) e.removeAttribute('data-cmp'); },
};
`;

/* PART B subjects: url, visible text, nth, label, optional CSS narrowing.
 *
 * "Home" on `/` is deliberately NOT the navbar-link subject: it is the CURRENT
 * page there, and the handler is guarded by `if (currentPage !== "home")`, so
 * measuring it would record "no hover state" for a control that correctly has
 * none in that state. The navbar link is sampled from /about, where Home is
 * not current. */
const COMPONENTS = [
  ['/about', 'Home', 0, 'navbar link, NOT current page (inline onMouseEnter)', 'header nav a'],
  ['/', 'Home', 0, 'navbar link, IS current page (handler guarded — expect none)', 'header nav a'],
  ['/', 'Products', 0, 'mega-menu trigger (inline-styled)', 'button[aria-haspopup]'],
  ['/', 'Request a Quote', 0, 'navbar CTA (inline-styled)', 'header a'],
  ['/', 'View Full Catalog', 0, 'SectionHeader action — className hover:bg-blue-700 + inline background', 'a'],
  ['/', 'Browse Products', 0, 'hero primary CTA', 'a'],
  ['/', 'Talk to Our Sales Team', 0, 'dark-band CTA', 'a'],
  ['/', '630.771.0700', 0, 'footer tel link', 'footer a[href^="tel:"]'],
  ['/', 'sales@insulationproducts.com', 0, 'footer mailto link', 'footer a[href^="mailto:"]'],
  ['/', 'Product Catalog', 0, 'footer nav link', 'footer a'],
  ['/', 'Automotive', 0, 'homepage industry card — hover:border-blue-500 + inline border', 'button,a'],
  ['/products', 'All (', 0, 'catalog family filter chip', 'button.ipc-tap'],
  ['/products', 'Nonmetallic', 0, 'product card', 'a.bg-white'],
  ['/dashboard', 'Product Name', 0, 'sort header (.ipc-sort-btn)', 'button.ipc-sort-btn'],
  ['/dashboard', 'UL Recognized', 0, 'approval filter chip', 'button'],
  ['/faq', 'What types of heat shrink', 0, 'FAQ accordion row', 'button[aria-expanded]'],
  ['/datasheets', 'Data Sheet', 0, 'datasheet row PDF link', 'a[href$=".pdf"],a.ipc-tap'],
  ['/products?productId=CC', 'Polyolefin Heat Shrink', 0, 'sidebar family accordion header', 'button.w-full'],
  ['/products?productId=CC', 'Download PDF', 0, 'product datasheet CTA', 'a.ipc-touch'],
  ['/products?productId=CC', 'Request a Quote', 0, 'sticky RFQ bar CTA', 'div[style*="fixed"] a, a.flex-shrink-0'],
  ['/industries', 'Automotive', 0, 'industry card (deep-link target)', 'div[id],a,button'],
  ['/services', 'Browse All Products', 0, 'sidebar CTA — className hover:text-white + inline color', 'a'],
  ['/contact', 'Contact our team', 0, 'inline body link (.ipc-inline-link)', 'a.ipc-inline-link,a'],
  ['/about', 'Founded', 0, 'about timeline card — hover:border-blue-400 + inline border', 'div.bg-white'],
  ['/services', 'Request a Quote', 0, 'services CTA', 'a'],
];

(async () => {
  const vpName = process.argv[2] || 'desktop-1440';
  const vp = VIEWPORTS[vpName];
  if (!vp) { console.error('unknown viewport ' + vpName); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await launch();
  const dead = [];
  const comps = [];
  try {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();

    // ── PART A ────────────────────────────────────────────────────────────
    for (const url of ROUTES) {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(300);
      await page.addScriptTag({ content: SCAN });
      const found = await page.evaluate(() => window.__cmp.dead());
      for (const f of found) dead.push({ url, ...f });
      process.stdout.write('a');
    }

    // ── PART B ────────────────────────────────────────────────────────────
    for (const [url, text, nth, label, sel] of COMPONENTS) {
      const rec = { url, text, nth, label, sel, viewport: vpName };
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(320);
        await page.addScriptTag({ content: SCAN });
        await page.mouse.move(2, 2);
        const f = await page.evaluate(([t, n, s]) => window.__cmp.find(t, n, s), [text, nth, sel || null]);
        if (!f) { rec.error = 'not found'; comps.push(rec); continue; }
        rec.found = { text: f.text, tag: f.tag, cls: f.cls, matches: f.count };
        rec.cursor = f.style.cursor;
        // bring it on screen, then re-read the rect
        await page.evaluate(() => document.querySelector('[data-cmp]')
          .scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.waitForTimeout(180);
        const r2 = await page.evaluate(() => {
          const r = document.querySelector('[data-cmp]').getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        await page.mouse.move(2, 2);
        await page.waitForTimeout(260);
        const before = await page.evaluate(() => window.__cmp.after());
        await page.mouse.move(r2.x + r2.w / 2, r2.y + r2.h / 2);
        await page.waitForTimeout(420);
        const hov = await page.evaluate(() => window.__cmp.after());
        await page.mouse.down();
        await page.waitForTimeout(90);
        const act = await page.evaluate(() => window.__cmp.after());
        await page.mouse.move(r2.x + r2.w / 2 + 300, r2.y + r2.h / 2 + 300);
        await page.mouse.up();
        await page.waitForTimeout(420);
        const rev = await page.evaluate(() => window.__cmp.after());

        const d = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k}: ${a[k]} -> ${b[k]}`);
        rec.hoverDelta = d(before, hov);
        rec.activeDelta = d(hov, act);
        rec.reverted = d(before, rev).length === 0;
        rec.rect = r2;
        await page.evaluate(() => window.__cmp.clear());
      } catch (e) { rec.error = String(e).slice(0, 200); }
      comps.push(rec);
      process.stdout.write('b');
    }
    await ctx.close();
  } finally { await browser.close(); }

  // ── report ────────────────────────────────────────────────────────────────
  // Dedupe part A by (util, cls, text): the same component repeats per card.
  const byKey = new Map();
  for (const d of dead) {
    const k = `${d.util}|${d.cls}|${d.text}`;
    if (!byKey.has(k)) byKey.set(k, { ...d, urls: new Set(), n: 0 });
    byKey.get(k).urls.add(d.url); byKey.get(k).n++;
  }
  const deadList = [...byKey.values()].map((d) => ({ ...d, urls: [...d.urls] }));

  fs.writeFileSync(path.join(OUT, `comp-${vpName}.json`),
    JSON.stringify({ viewport: vpName, deadHoverUtilities: deadList, rawDeadCount: dead.length, components: comps }, null, 1));

  console.log(`\n\n══ PART A — hover: utilities whose property is occupied by an inline style @ ${vpName}`);
  console.log(`${dead.length} element occurrences, ${deadList.length} distinct declarations`);
  for (const d of deadList) {
    console.log(`\n  ${d.util}   (${d.n} elements on ${d.urls.join(', ')})`);
    console.log(`    text     ${JSON.stringify(d.text)}`);
    console.log(`    occupied ${d.occupiedBy.join(', ')} in inline style`);
    console.log(`    inline   ${d.inline}`);
  }

  console.log(`\n\n══ PART B — named component classes @ ${vpName}`);
  console.log('hover active cursor    component');
  for (const c of comps) {
    if (c.error) { console.log(`  ERROR  ${c.url} ${JSON.stringify(c.text)} — ${c.error}`); continue; }
    const h = (c.hoverDelta || []).length, a = (c.activeDelta || []).length;
    const flag = h === 0 ? '   <<< NO HOVER STATE' : '';
    console.log(`${String(h).padStart(5)} ${String(a).padStart(6)} ${String(c.cursor).padEnd(9)} ${c.label}${flag}`);
    if (h) console.log(`        hover: ${(c.hoverDelta || []).join(' | ').slice(0, 150)}`);
    if (!c.reverted) console.log(`        WARNING: hover state did not revert when the pointer left`);
  }
  const none = comps.filter((c) => !c.error && (c.hoverDelta || []).length === 0);
  console.log(`\ncomponents with no hover state: ${none.length}/${comps.filter((c) => !c.error).length}`);
  console.log(`record -> ${path.join(OUT, `comp-${vpName}.json`)}`);
})();
