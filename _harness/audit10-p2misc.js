/**
 * AUDIT-10 pass-2 — the four named small-screen re-verifications that are not
 * whole-site sweeps:
 *
 *   hero   the desktop-only hero photograph must NOT be requested at 390/834.
 *          Request interception, not source reading — the record claims 0 and
 *          pass-2 is told to re-verify rather than re-derive. Also resolves
 *          candidates C-024/C-036 (crawler invisibleImgs=1 on the homepage).
 *   faq    accordion open + closed at both viewports: overflow, chip scroller
 *          reachability (C41's pinned control), panel height.
 *   sticky the RFQ bar at 390/834 on the two-datasheet product and on the
 *          longest product names — at rest, mid-scroll, and at max scroll.
 *   form   /contact at 390: field widths, type/inputmode hints, error
 *          visibility after a real failed submit.
 *
 * Usage: node _harness/audit10-p2misc.js [hero|faq|sticky|form]  (needs :8123)
 * Output: _harness/out/audit10/p2misc.<section>.json
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);
const VIEWPORTS = [
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 900 },   // the positive control
];
const write = (name, data) => {
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, `p2misc.${name}.json`);
  fs.writeFileSync(f, JSON.stringify(data, null, 1));
  console.log(`-> ${f}`);
};

// ── hero ────────────────────────────────────────────────────────────────────
async function hero(browser) {
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const requested = [];
    page.on('request', (r) => {
      const u = r.url();
      if (/\.(jpe?g|png|webp|avif|gif|svg)(\?|$)/i.test(u)) requested.push(u.replace(BASE, ''));
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
    // Full scroll: lazy images only fire once they intersect, so a probe that
    // never scrolls proves nothing about loading="lazy".
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1500);
    const dom = await page.evaluate(() => {
      const pics = [...document.querySelectorAll('picture')].map((p) => {
        const img = p.querySelector('img');
        const r = img ? img.getBoundingClientRect() : null;
        const pr = p.getBoundingClientRect();
        return {
          pictureDisplay: getComputedStyle(p).display,
          pictureClass: (typeof p.className === 'string' ? p.className : ''),
          sources: [...p.querySelectorAll('source')].map((s) => ({ media: s.media, srcset: s.getAttribute('srcset') })),
          imgSrc: img ? img.getAttribute('src') : null,
          imgLoading: img ? img.getAttribute('loading') : null,
          imgComplete: img ? img.complete : null,
          imgNaturalWidth: img ? img.naturalWidth : null,
          imgCurrentSrc: img ? img.currentSrc : null,
          imgDisplay: img ? getComputedStyle(img).display : null,
          imgRect: r ? { w: +r.width.toFixed(1), h: +r.height.toFixed(1) } : null,
        };
      });
      // The crawler's own invisibleImgs predicate, reproduced verbatim.
      const invisible = [...document.querySelectorAll('img')].filter((i) => {
        const r = i.getBoundingClientRect();
        const cs = getComputedStyle(i);
        return r.width === 0 && r.height === 0 && cs.display !== 'none' &&
          !i.closest('[hidden]') && cs.visibility !== 'hidden';
      }).map((i) => ({
        src: (i.getAttribute('src') || '').slice(0, 120),
        computedDisplay: getComputedStyle(i).display,
        parentTag: i.parentElement ? i.parentElement.tagName.toLowerCase() : null,
        parentDisplay: i.parentElement ? getComputedStyle(i.parentElement).display : null,
        parentClass: i.parentElement && typeof i.parentElement.className === 'string' ? i.parentElement.className : '',
        naturalWidth: i.naturalWidth,
      }));
      return { pics, invisible, totalImgs: document.querySelectorAll('img').length };
    });
    rows.push({
      viewport: vp.name,
      heroPhotoRequested: requested.filter((u) => /Marker-Sample/i.test(u)),
      imageRequests: requested,
      ...dom,
    });
    await ctx.close();
  }
  for (const r of rows) {
    console.log(`\n[${r.viewport}] hero photo requests: ${r.heroPhotoRequested.length} ${JSON.stringify(r.heroPhotoRequested)}`);
    console.log(`  image requests total: ${r.imageRequests.length}`);
    console.log(`  <picture> blocks: ${JSON.stringify(r.pics, null, 1)}`);
    console.log(`  crawler-style invisibleImgs: ${r.invisible.length} ${JSON.stringify(r.invisible)}`);
  }
  write('hero', rows);
}

// ── faq ─────────────────────────────────────────────────────────────────────
async function faq(browser) {
  const rows = [];
  const snap = () => {
    const vw = document.documentElement.clientWidth;
    const btns = [...document.querySelectorAll('button[aria-expanded]')];
    const scrollers = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth - el.clientWidth > 1;
    }).map((el) => {
      const r = el.getBoundingClientRect();
      const kids = [...el.children].map((c) => {
        const cr = c.getBoundingClientRect();
        return {
          text: (c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
          left: +cr.left.toFixed(1), right: +cr.right.toFixed(1),
          fullyVisible: cr.left >= r.left - 0.5 && cr.right <= r.right + 0.5,
        };
      });
      return {
        el: el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
        clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
        hidden: el.scrollWidth - el.clientWidth,
        scrollLeft: el.scrollLeft,
        childrenOffscreen: kids.filter((k) => !k.fullyVisible).length,
        childrenTotal: kids.length,
        offscreenNames: kids.filter((k) => !k.fullyVisible).map((k) => k.text),
      };
    });
    return {
      overflowX: Math.round(Math.max(document.documentElement.scrollWidth - vw, document.body.scrollWidth - vw)),
      accordions: btns.length,
      expanded: btns.filter((b) => b.getAttribute('aria-expanded') === 'true').length,
      buttonSizes: btns.map((b) => { const r = b.getBoundingClientRect(); return `${+r.width.toFixed(1)}x${+r.height.toFixed(1)}`; }),
      docHeight: document.documentElement.scrollHeight,
      scrollers,
    };
  };
  for (const vp of VIEWPORTS.filter((v) => v.name !== 'desktop-1440')) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const closed = await page.evaluate(snap);
    await page.screenshot({ path: path.join(OUT, 'menu', `faq-${vp.name}-closed.png`) }).catch(() => {});
    // The hamburger also carries aria-expanded. Clicking it locks <body> and
    // collapses documentElement.scrollHeight to the viewport height, which
    // corrupted the first run of this probe (docH read 1112 at 834).
    await page.evaluate(() => {
      [...document.querySelectorAll('button[aria-expanded]')]
        .filter((b) => b.getAttribute('aria-label') !== 'Open menu' && b.getAttribute('aria-label') !== 'Close menu')
        .forEach((b) => { if (b.getAttribute('aria-expanded') === 'false') b.click(); });
    });
    await page.waitForTimeout(800);
    const open = await page.evaluate(snap);
    await page.screenshot({ path: path.join(OUT, 'menu', `faq-${vp.name}-open.png`), fullPage: true }).catch(() => {});
    rows.push({ viewport: vp.name, closed, open });
    await ctx.close();
  }
  for (const r of rows) {
    console.log(`\n[${r.viewport}] closed: overflowX=${r.closed.overflowX} accordions=${r.closed.accordions} expanded=${r.closed.expanded} docH=${r.closed.docHeight}`);
    console.log(`  closed scrollers: ${JSON.stringify(r.closed.scrollers)}`);
    console.log(`  open:   overflowX=${r.open.overflowX} expanded=${r.open.expanded} docH=${r.open.docHeight}`);
    console.log(`  open scrollers: ${JSON.stringify(r.open.scrollers)}`);
  }
  write('faq', rows);
}

// ── sticky ──────────────────────────────────────────────────────────────────
async function sticky(browser) {
  const byNameLen = [...products].sort((a, b) => String(b.name || '').length - String(a.name || '').length);
  const twoSheets = products.filter((p) => {
    const keys = Object.keys(p).filter((k) => /pdf|datasheet/i.test(k));
    const vals = keys.map((k) => p[k]).filter(Boolean);
    return vals.length >= 2 || (Array.isArray(p.datasheets) && p.datasheets.length >= 2);
  });
  const targets = [...new Set([
    ...twoSheets.slice(0, 3).map((p) => p.id),
    ...byNameLen.slice(0, 4).map((p) => p.id),
    'IP37SH-IP36TH-IP39LH', 'IP17TW-18SW-19LW', 'IP38FE', 'IP33PO',
  ])].filter((id) => products.some((p) => p.id === id));

  const probe = () => {
    const vh = window.innerHeight, vw = document.documentElement.clientWidth;
    const fixed = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.position === 'fixed' && r.width > 1 && r.height > 1;
    }).map((el) => {
      const r = el.getBoundingClientRect();
      const covered = [];
      for (const c of document.querySelectorAll('a,button,p,h1,h2,h3,li,span,label,td,th')) {
        if (el.contains(c) || c.contains(el)) continue;
        const t = (c.textContent || '').trim();
        if (!t || c.children.length > 2) continue;
        const cr = c.getBoundingClientRect();
        if (cr.width < 4 || cr.height < 4) continue;
        if (cr.bottom <= r.top || cr.top >= r.bottom) continue;
        if (cr.right <= r.left || cr.left >= r.right) continue;
        covered.push(`${c.tagName.toLowerCase()} "${t.replace(/\s+/g, ' ').slice(0, 45)}" [${cr.top.toFixed(0)}-${cr.bottom.toFixed(0)}]`);
        if (covered.length >= 6) break;
      }
      return {
        el: el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1),
        left: +r.left.toFixed(1), right: +r.right.toFixed(1),
        scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
        innerOverflow: el.scrollWidth - el.clientWidth,
        offscreenRight: +Math.max(0, r.right - vw).toFixed(1),
        z: getComputedStyle(el).zIndex,
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        childrenPastRight: [...el.querySelectorAll('*')].filter((c) => c.getBoundingClientRect().right > vw + 1)
          .map((c) => `${c.tagName.toLowerCase()} "${(c.textContent || '').trim().slice(0, 25)}" right=${c.getBoundingClientRect().right.toFixed(1)}`).slice(0, 5),
        covered,
      };
    });
    return {
      vh, vw, scrollY: Math.round(window.scrollY),
      bodyClass: document.body.className,
      bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
      docHeight: document.documentElement.scrollHeight,
      fixed,
    };
  };

  const rows = [];
  for (const vp of VIEWPORTS.filter((v) => v.name !== 'desktop-1440')) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    for (const id of targets) {
      const url = '/products?productId=' + encodeURIComponent(id);
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(400);
      const rest = await page.evaluate(probe);
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(500);
      const mid = await page.evaluate(probe);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(600);
      const bottom = await page.evaluate(probe);
      rows.push({ id, url, viewport: vp.name, rest, mid, bottom });
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(` ${vp.name} done`);
  }
  await browser.close === undefined ? null : null;
  for (const r of rows) {
    const b = r.bottom;
    const bar = (b.fixed || []).filter((f) => f.top < b.vh && f.bottom > 0);
    console.log(`\n[${r.viewport}] ${r.id}: bodyClass="${b.bodyClass}" padB=${b.bodyPaddingBottom} fixedAtBottom=${bar.length}`);
    for (const f of bar) {
      console.log(`   ${f.el} band ${f.top}-${f.bottom} (vh=${b.vh}) innerOverflow=${f.innerOverflow} offscreenRight=${f.offscreenRight}`);
      if (f.covered.length) console.log(`      COVERS: ${f.covered.join(' | ')}`);
      if (f.childrenPastRight.length) console.log(`      PAST RIGHT: ${f.childrenPastRight.join(' | ')}`);
    }
    const mid = (r.mid.fixed || []).filter((f) => f.top < r.mid.vh && f.bottom > 0);
    for (const f of mid) {
      if (f.innerOverflow > 1 || f.offscreenRight > 1 || f.childrenPastRight.length) {
        console.log(`   [mid-scroll] ${f.el} innerOverflow=${f.innerOverflow} offscreenRight=${f.offscreenRight} ${JSON.stringify(f.childrenPastRight)}`);
      }
    }
  }
  write('sticky', { targets, rows });
}

// ── form ────────────────────────────────────────────────────────────────────
async function form(browser) {
  const rows = [];
  const snap = () => {
    const vw = document.documentElement.clientWidth;
    const fields = [...document.querySelectorAll('input, select, textarea')].filter((el) => el.type !== 'hidden').map((el) => {
      const r = el.getBoundingClientRect();
      const lab = el.labels && el.labels.length ? el.labels[0].textContent.trim() : (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '');
      return {
        name: el.name || el.id, tag: el.tagName.toLowerCase(), type: el.type,
        inputmode: el.getAttribute('inputmode'), autocomplete: el.getAttribute('autocomplete'),
        required: el.required, label: lab.replace(/\s+/g, ' ').slice(0, 40),
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        left: +r.left.toFixed(1), right: +r.right.toFixed(1),
        pastRight: +Math.max(0, r.right - vw).toFixed(1),
        fontSize: getComputedStyle(el).fontSize,
      };
    });
    const errs = [...document.querySelectorAll('[role="alert"], .error, [aria-invalid="true"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el: el.tagName.toLowerCase(), role: el.getAttribute('role'),
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
        top: +r.top.toFixed(1), h: +r.height.toFixed(1),
        inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
        visible: r.width > 0 && r.height > 0,
      };
    });
    return {
      vw, fields, errs, scrollY: Math.round(window.scrollY),
      overflowX: Math.round(Math.max(document.documentElement.scrollWidth - vw, document.body.scrollWidth - vw)),
    };
  };
  for (const vp of VIEWPORTS.filter((v) => v.name !== 'desktop-1440')) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const idle = await page.evaluate(snap);
    // A real failed submit: fill nothing, press the submit button.
    const before = await page.evaluate(() => window.scrollY);
    await page.click('form button[type="submit"], form input[type="submit"]').catch(() => {});
    await page.waitForTimeout(900);
    const after = await page.evaluate(snap);
    const focused = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { tag: a.tagName.toLowerCase(), name: a.name || a.id || '', top: +r.top.toFixed(1), inViewport: r.top >= 0 && r.bottom <= window.innerHeight };
    });
    await page.screenshot({ path: path.join(OUT, 'menu', `contact-${vp.name}-after-submit.png`), fullPage: true }).catch(() => {});
    rows.push({ viewport: vp.name, idle, afterSubmit: after, scrollBefore: before, focusedAfterSubmit: focused });
    await ctx.close();
  }
  for (const r of rows) {
    console.log(`\n[${r.viewport}] fields:`);
    for (const f of r.idle.fields) console.log(`   ${f.tag}[${f.type}] name=${f.name} w=${f.w} h=${f.h} pastRight=${f.pastRight} inputmode=${f.inputmode} autocomplete=${f.autocomplete} font=${f.fontSize} label="${f.label}"`);
    console.log(`   overflowX idle=${r.idle.overflowX} afterSubmit=${r.afterSubmit.overflowX}`);
    console.log(`   errors after empty submit: ${JSON.stringify(r.afterSubmit.errs)}`);
    console.log(`   focus after submit: ${JSON.stringify(r.focusedAfterSubmit)} (scrollY ${r.scrollBefore} -> ${r.afterSubmit.scrollY})`);
  }
  write('form', rows);
}

(async () => {
  const which = process.argv[2] || 'all';
  fs.mkdirSync(path.join(OUT, 'menu'), { recursive: true });
  const browser = await launch();
  try {
    if (which === 'all' || which === 'hero') await hero(browser);
    if (which === 'all' || which === 'faq') await faq(browser);
    if (which === 'all' || which === 'sticky') await sticky(browser);
    if (which === 'all' || which === 'form') await form(browser);
  } finally {
    await browser.close();
  }
})();
