/**
 * AUDIT-10 pass-6 steps 6.2 (focus half) and 6.3 — keyboard traversal with REAL
 * Tab presses.
 *
 * Chromium does not match `:focus-visible` for programmatic focus. `el.focus()`
 * followed by `el.matches(':focus-visible')` returns false for every element on
 * the site, which reads as "no focus indicator anywhere" and is an artifact of
 * the probe, not a finding. plan8-keyboard.js learned this and says so in its
 * header; this probe therefore never calls .focus() on a subject. Every focus
 * state recorded here arrived via `page.keyboard.press('Tab')`.
 *
 * Two things are captured in one walk, because both need the same expensive
 * traversal:
 *
 *   6.3  the ORDER — what the Tab sequence actually is, whether it matches
 *        visual order, whether anything is unreachable or traps.
 *   6.2  the STATE — for every element the walk reaches, the computed focus
 *        style diffed against that same element's unfocused baseline, so
 *        "has an indicator" is a delta and not a guess about UA defaults.
 *
 * Baseline styles are collected BEFORE the walk with nothing focused, keyed by
 * the same cssPath() the 6.1 census uses, so the two files join on `selector`.
 *
 * Output: _harness/out/audit10/p6/tabwalk-<viewport>.json
 * Usage:  node _harness/audit10-p6tabwalk.js [viewport]     (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');

const VIEWPORTS = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-834': { width: 834, height: 1112 },
  'mobile-390': { width: 390, height: 844 },
};

const PUBLIC_ROUTES = ['/', '/products', '/services', '/industries', '/about',
                       '/contact', '/dashboard', '/datasheets', '/faq', '/privacy'];
const EXTRA_PUBLIC = ['/products?productId=CC', '/dashboard?family=Tape',
                      '/products?productId=NOPE-XYZ-123', '/no-such-page'];
const ADMIN_PAGES = ['/admin/index.php', '/admin/content.php', '/admin/settings.php',
                     '/admin/add.php', '/admin/edit.php?id=CC', '/admin/backups.php',
                     '/admin/password.php', '/admin/inquiries.php',
                     '/admin/audit-log.php', '/admin/help.php'];

/* Adaptive: a page cannot need more Tab presses than it has focusable
 * elements, plus slack for anything that becomes focusable mid-walk. A flat
 * 500 truncated admin/content.php (1,100 fields) and the truncation then
 * looked exactly like 297 unreachable controls. */
const tabBudget = (n) => Math.min(1600, n + 40);

/* ── shared, injected into the page ──────────────────────────────────────── */
const HELPERS = `
window.__p6 = (() => {
  const cssPath = (el) => {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && n !== document.body) {
      if (n.id) { parts.unshift('#' + n.id); break; }
      let seg = n.tagName.toLowerCase();
      const sibs = n.parentElement
        ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [];
      if (sibs.length > 1) seg += ':nth-of-type(' + (sibs.indexOf(n) + 1) + ')';
      parts.unshift(seg);
      n = n.parentElement;
    }
    return parts.join('>');
  };
  const signature = (el) => {
    const t = el.tagName.toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '')
      .trim().split(/\\s+/).filter(Boolean).sort().join('.');
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
  /* The properties a focus/hover indicator can possibly be expressed in. */
  const style = (el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
      borderTopColor: cs.borderTopColor, borderTopWidth: cs.borderTopWidth,
      borderBottomColor: cs.borderBottomColor, borderBottomWidth: cs.borderBottomWidth,
      backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage,
      color: cs.color, opacity: cs.opacity, transform: cs.transform,
      filter: cs.filter, textDecorationLine: cs.textDecorationLine,
      textDecorationColor: cs.textDecorationColor,
      cursor: cs.cursor, transitionProperty: cs.transitionProperty,
      transitionDuration: cs.transitionDuration,
    };
  };
  /* The nearest ancestor that actually paints, so an indicator's contrast can
     be scored against the ground it is drawn on rather than against a
     transparent parent. */
  const ground = (el) => {
    let n = el.parentElement;
    while (n) {
      const cs = getComputedStyle(n);
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'IMAGE:' + cs.backgroundImage.slice(0, 60);
      n = n.parentElement;
    }
    return 'rgb(255, 255, 255)';
  };
  return { cssPath, signature, style, ground };
})();
`;

const SEL = 'a[href], button, [role="button"], input, select, textarea, summary, [tabindex]';

/** Describe whatever Tab just landed on. */
const describeActive = () => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) {
    return { tag: a ? a.tagName.toLowerCase() : null, escaped: true };
  }
  const r = a.getBoundingClientRect();
  return {
    // Exact identity. cssPath() is NOT unique — two <a> in structurally
    // identical table rows can produce the same path — and the first draft of
    // this probe used it both to detect the wrap and to join against the
    // baseline. The collision ended the walk at the first repeated PATH
    // rather than the first repeated ELEMENT, and every control after that
    // point was then reported "unreachable". data-p6 is stamped once, per
    // element, at baseline time, so a repeat here is a real wrap.
    p6: a.getAttribute('data-p6'),
    selector: window.__p6.cssPath(a),
    sig: window.__p6.signature(a),
    tag: a.tagName.toLowerCase(),
    text: (a.textContent || a.getAttribute('aria-label') || a.getAttribute('placeholder') || '')
      .trim().replace(/\s+/g, ' ').slice(0, 60),
    href: a.getAttribute ? a.getAttribute('href') : null,
    focusVisible: (() => { try { return a.matches(':focus-visible'); } catch (e) { return null; } })(),
    box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    docY: Math.round(r.y + window.scrollY),
    docX: Math.round(r.x + window.scrollX),
    inViewport: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
      && r.right > 0 && r.left < window.innerWidth,
    scrollY: Math.round(window.scrollY),
    ground: window.__p6.ground(a),
    focused: window.__p6.style(a),
  };
};

async function walk(page, url, label) {
  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(350);
  await page.addScriptTag({ content: HELPERS });

  // Every candidate element's UNFOCUSED baseline, keyed by the same cssPath()
  // the 6.1 census uses so the two files join on `selector`.
  const base = await page.evaluate((sel) => {
    const out = {}; const order = []; let i = 0;
    for (const el of document.querySelectorAll(sel)) {
      const key = String(i);
      el.setAttribute('data-p6', key);
      const r = el.getBoundingClientRect();
      out[key] = {
        selector: window.__p6.cssPath(el),
        sig: window.__p6.signature(el),
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '')
          .trim().replace(/\s+/g, ' ').slice(0, 60),
        href: el.getAttribute('href') || null,
        docIndex: i++,
        box: { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) },
        rendered: r.width > 0 && r.height > 0,
        // A non-zero rect is NOT the same as being in the tab order. Content
        // inside a collapsed <details> keeps its last-known geometry (Chromium
        // skips the subtree with content-visibility rather than removing its
        // layout), so admin/inquiries.php's six mailto links and ten of
        // help.php's anchors measured 152x15 and were correctly untabbable.
        // The first draft reported all sixteen as unreachable controls.
        visible: typeof el.checkVisibility === 'function'
          ? el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })
          : r.width > 0 && r.height > 0,
        inClosedDetails: !!el.closest('details:not([open])') && el.tagName !== 'SUMMARY',
        tabindex: el.getAttribute('tabindex'),
        disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
        ariaExpanded: el.getAttribute('aria-expanded'),
        ariaSort: el.getAttribute('aria-sort'),
        ground: window.__p6.ground(el),
        base: window.__p6.style(el),
      };
      order.push(key);
    }
    return { out, order };
  }, SEL);

  // Start the walk from the very top of the document, with nothing focused —
  // the same starting point a visitor has after loading the page and pressing
  // Tab for the first time.
  //
  // `document.activeElement.blur()` is NOT that reset and the first draft of
  // this probe used it. Blurring clears activeElement but leaves Chromium's
  // *sequential focus navigation starting point* on the blurred element, so on
  // a page with an autofocused field (admin/index.php's password input) the
  // first Tab press landed on the SECOND control and the walk reported the
  // first one unreachable. `document.body.focus()` resets the starting point —
  // it is what plan8-keyboard.js uses, and its skip-link assertion is the
  // proof that a first Tab after it really does land on the first element.
  //
  // body.focus() is a no-op on a page that AUTOFOCUSES a field (admin's login
  // does), because body is not focusable and activeElement simply stays where
  // autofocus put it. So record what autofocus did — that is a real part of
  // the page's keyboard behaviour, not noise — and then force the starting
  // point to the document element, which no Tab order contains.
  const autofocused = await page.evaluate(() => {
    const a = document.activeElement;
    const was = a && a !== document.body && a !== document.documentElement
      ? { tag: a.tagName.toLowerCase(), id: a.id || null, p6: a.getAttribute('data-p6') } : null;
    window.scrollTo(0, 0);
    document.body.focus();
    document.documentElement.setAttribute('tabindex', '-1');
    document.documentElement.focus();
    return was;
  });

  const MAX_TABS = tabBudget(Object.keys(base.out).length);
  const stops = [];
  const seen = new Map();
  let escapedAt = null;
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const d = await page.evaluate(describeActive);
    if (d.escaped) { escapedAt = i; break; }          // focus left the document
    stops.push(d);
    // Identity is the stamped data-p6 index, never the cssPath. An element
    // with no stamp appeared after the baseline (a menu that opened) — record
    // it, do not treat it as a repeat.
    const k = d.p6;
    if (k !== null && seen.has(k)) {
      d.repeatOf = seen.get(k);
      if (stops.length - seen.get(k) < 3 && i > 3) { d.trapSuspect = true; }
      break;                                          // wrapped a full cycle
    }
    if (k !== null) seen.set(k, stops.length - 1);
  }
  await page.evaluate(() => document.documentElement.removeAttribute('tabindex'));

  return { url, label, autofocused, base: base.out, docOrder: base.order, stops,
           escapedAt, tabBudget: MAX_TABS, maxedOut: stops.length >= MAX_TABS };
}

(async () => {
  const vpName = process.argv[2] || 'desktop-1440';
  const vp = VIEWPORTS[vpName];
  if (!vp) { console.error('unknown viewport ' + vpName); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await launch();
  const rec = { viewport: vpName, size: vp, pages: {} };
  try {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    for (const url of [...PUBLIC_ROUTES, ...EXTRA_PUBLIC]) {
      rec.pages[url] = await walk(page, url, 'public');
      process.stdout.write(`\n${url}: ${rec.pages[url].stops.length} tab stops`);
    }
    await ctx.close();

    if (vpName === 'desktop-1440') {
      const actx = await browser.newContext({ viewport: vp });
      const apage = await actx.newPage();
      await apage.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
      await apage.addScriptTag({ content: HELPERS });
      rec.pages['/admin/ (signed out)'] = await walk(apage, '/admin/', 'admin-signed-out');
      process.stdout.write(`\n/admin/ (signed out): ${rec.pages['/admin/ (signed out)'].stops.length} tab stops`);
      await apage.fill('input[type="password"]', PASS);
      await Promise.all([apage.waitForNavigation(), apage.click('button[type="submit"], input[type="submit"]')]);
      for (const url of ADMIN_PAGES) {
        rec.pages[url] = await walk(apage, url, 'admin');
        process.stdout.write(`\n${url}: ${rec.pages[url].stops.length} tab stops`);
      }
      await actx.close();
    }
  } finally {
    await browser.close();
  }

  const file = path.join(OUT, `tabwalk-${vpName}.json`);
  fs.writeFileSync(file, JSON.stringify(rec, null, 1));
  console.log(`\n\ntabwalk (${vpName}) -> ${file}`);
  console.log(`pages walked: ${Object.keys(rec.pages).length}`);
  let stops = 0, fv = 0;
  for (const p of Object.values(rec.pages)) {
    stops += p.stops.length;
    fv += p.stops.filter((s) => s.focusVisible).length;
  }
  console.log(`tab stops: ${stops};  matched :focus-visible after a real Tab: ${fv}`);
})();
