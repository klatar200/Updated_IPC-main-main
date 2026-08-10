/**
 * AUDIT-10 pass-6 step 6.1 — interactive-element census.
 *
 * Per page at desktop-1440, enumerate every a[href], button, [role=button],
 * input, select, textarea, summary, [tabindex] and record
 * {selector, tag, text, box} plus a component-class signature (`sig`) the
 * state sweep (audit10-states.js) groups on.
 *
 * Output: plans/audit10/state/interactives.json   {url: [{selector,...}]}
 * (committed — this is the checklist the rest of pass-6 walks).
 *
 * Coverage: the 10 public routes, 3 dashboard family views, all 42 product
 * pages, the 2 error states, the signed-out admin login and the 10 signed-in
 * admin GET pages — same inventory as audit10-crawl.js.
 *
 * Usage: node _harness/audit10-interactives.js     (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, '..', 'plans', 'audit10', 'state', 'interactives.json');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const PUBLIC_ROUTES = [
  '/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy',
];
const FAMILY_VIEWS = ['Tape', 'Heat Shrink Tubing', 'Adhesive']
  .map((f) => '/dashboard?family=' + encodeURIComponent(f));
const ERROR_STATES = ['/products?productId=NOPE-XYZ-123', '/no-such-page'];
const ADMIN_PAGES = [
  '/admin/index.php', '/admin/content.php', '/admin/settings.php',
  '/admin/add.php', '/admin/edit.php?id=CC', '/admin/backups.php',
  '/admin/password.php', '/admin/inquiries.php', '/admin/audit-log.php',
  '/admin/help.php',
];

const collect = () => {
  const SEL = 'a[href], button, [role="button"], input, select, textarea, summary, [tabindex]';
  const els = [...document.querySelectorAll(SEL)];
  const seen = new Set();
  const cssPath = (el) => {
    // Compact, order-stable selector: nearest id ancestor, then nth-of-type path.
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && n !== document.body) {
      if (n.id) { parts.unshift('#' + n.id); break; }
      let seg = n.tagName.toLowerCase();
      const sibs = n.parentElement
        ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [];
      if (sibs.length > 1) seg += `:nth-of-type(${sibs.indexOf(n) + 1})`;
      parts.unshift(seg);
      n = n.parentElement;
    }
    return parts.join('>');
  };
  const signature = (el) => {
    // Component-class identity: tag + stable class list (Tailwind + ipc-*),
    // falling back to structural hints for the inline-styled elements.
    const t = el.tagName.toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '')
      .trim().split(/\s+/).filter(Boolean).sort().join('.');
    let hint = '';
    if (t === 'a') {
      const href = el.getAttribute('href') || '';
      if (href.startsWith('tel:')) hint = '@tel';
      else if (href.startsWith('mailto:')) hint = '@mailto';
      else if (href.startsWith('#')) hint = '@anchor';
      else if (/^https?:/.test(href)) hint = '@ext';
    }
    if (t === 'input') hint = '@' + (el.getAttribute('type') || 'text');
    if (el.getAttribute('role')) hint += '@role=' + el.getAttribute('role');
    return t + (cls ? '.' + cls : '') + hint;
  };
  const out = [];
  for (const el of els) {
    if (seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push({
      selector: cssPath(el),
      tag: el.tagName.toLowerCase(),
      text: (el.value !== undefined && el.tagName === 'INPUT'
        ? (el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.type)
        : (el.textContent || el.getAttribute('aria-label') || '')).trim().replace(/\s+/g, ' ').slice(0, 60),
      box: { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      sig: signature(el),
      hidden: !(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none',
      tabindex: el.getAttribute('tabindex'),
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true' || undefined,
    });
  }
  return out;
};

(async () => {
  const browser = await launch();
  const census = {};
  try {
    const vp = { width: 1440, height: 900 };

    // Public pages (fresh anonymous context).
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const publicUrls = [
      ...PUBLIC_ROUTES, ...FAMILY_VIEWS, ...ERROR_STATES,
      ...products.map((p) => '/products?productId=' + encodeURIComponent(p.id)),
    ];
    for (const url of publicUrls) {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(300);
      census[url] = await page.evaluate(collect);
      process.stdout.write('.');
    }
    await ctx.close();

    // Admin: signed-out login, then the signed-in pages.
    const actx = await browser.newContext({ viewport: vp });
    const apage = await actx.newPage();
    await apage.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    census['/admin/ (signed out)'] = await apage.evaluate(collect);
    if (await apage.$('input[type="password"]')) {
      await apage.fill('input[type="password"]', PASS);
      await Promise.all([apage.waitForNavigation(), apage.click('button[type="submit"], input[type="submit"]')]);
    }
    for (const url of ADMIN_PAGES) {
      await apage.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      census[url] = await apage.evaluate(collect);
      process.stdout.write('.');
    }
    await actx.close();
  } finally {
    await browser.close();
  }

  fs.writeFileSync(OUT, JSON.stringify(census, null, 1));

  // Console summary: per-page counts and the cross-page class signatures.
  const sigs = new Map();
  let total = 0;
  for (const [url, els] of Object.entries(census)) {
    total += els.length;
    console.log(`\n${url}: ${els.length} interactive elements`);
    for (const e of els) {
      const k = e.sig;
      if (!sigs.has(k)) sigs.set(k, { count: 0, pages: new Set(), sample: e.text });
      const s = sigs.get(k);
      s.count++; s.pages.add(url);
    }
  }
  console.log(`\nTOTAL ${total} elements across ${Object.keys(census).length} pages`);
  console.log(`distinct component signatures: ${sigs.size}`);
  const sorted = [...sigs.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [k, v] of sorted) {
    console.log(`${String(v.count).padStart(5)}  ${String(v.pages.size).padStart(3)}pg  ${k.slice(0, 110)}  e.g. ${JSON.stringify(v.sample).slice(0, 40)}`);
  }
  console.log(`\ncensus -> ${OUT}`);
})();
