/**
 * PLAN-8 Phase F — B11, B21, B23, A7.
 *
 * B11. The footer paragraph renders "…industrial adhesives.$50 minimum order."
 * on every page. At the JSX, the text ends `adhesives.` on one line and
 * `{site.stats.minimumOrder}` begins the next; JSX strips a newline between
 * text and an expression rather than collapsing it to a space. Asserted on the
 * RENDERED text, and the same shape is swept for site-wide.
 *
 * B21. The Services lead-time banner reads "Standard Lead Time: ≤ 1 week ·
 * ≤ 1 week (JIT by agreement)". The summary de-duplicates exact strings, five
 * services carry "≤ 1 week" and Kitting & Bagging carries the qualified form,
 * so both survive and get joined. It reads like a rendering bug. Driven from
 * three scratch content files, because one shape passing proves nothing:
 * all-identical, five-plus-one-qualified (today's data), and all-different.
 *
 * B23. The product photo is the LCP element on every product page and ships no
 * intrinsic dimensions, so it reserves no space and shifts the layout on load.
 * Every other image on the site has them. Measured as real CLS from a
 * PerformanceObserver on a throttled load — not by reading the attributes,
 * because the fallback panel has to reserve the SAME box or swapping to it
 * shifts the page just as badly.
 *
 * A7. Five products carry a placehold.co photoUrl. The render path already
 * treats such a URL as "no photo", so the branded panel should be the first
 * paint and no third-party request should ever leave the page. Asserted by
 * INTERCEPTING requests across all 42 product pages, not by reading the data.
 *
 * Usage:
 *   node _harness/plan8-chrome.js            (needs :8123)
 *   node _harness/plan8-chrome.js --keep     leave the scratch content in place
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-chrome');
const SITE_CONTENT = path.join(__dirname, 'site', 'data', 'content.json');
const PRISTINE_CONTENT = path.join(__dirname, 'pristine', 'content.json');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);
/** The five the audit names, plus a control with a real photograph. */
const PLACEHOLD = products.filter((p) => /placehold\.co/.test(String(p.photoUrl || '')));
const REAL_PHOTO = products.find((p) => p.photoUrl && !/placehold\.co/.test(p.photoUrl));

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** Cumulative layout shift over a load, from the browser's own observer. */
const CLS_PROBE = `
  window.__ipcCLS = 0; window.__ipcShifts = 0; window.__ipcSources = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__ipcShifts++;
      if (e.hadRecentInput) continue;
      window.__ipcCLS += e.value;
      // WHICH node moved, not just how much. B23 is about the product photo's
      // contribution specifically, and a page-total number cannot tell that
      // apart from anything else on the page that settles late. Measuring the
      // total is how the residual here was nearly blamed on the photo when it
      // is the footer.
      for (const s of (e.sources || [])) {
        const n = s.node;
        window.__ipcSources.push({
          value: +e.value.toFixed(4),
          tag: n ? n.tagName : null,
          src: n && n.currentSrc ? n.currentSrc : null,
          text: n ? (n.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40) : null,
        });
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });
`;

async function measureCls(browser, url, width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(CLS_PROBE);
  // Throttle, or the image lands in the same frame as the layout and no shift
  // is ever recorded — the defect would be invisible on a fast local server.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: 500 * 1024 / 8, uploadThroughput: 500 * 1024 / 8,
  });
  await page.goto(url, { waitUntil: 'load' });

  // Wait for the photo to actually ARRIVE before reading CLS.
  //
  // The first version waited a flat 2500ms after `load` and reported 0.0000 on
  // every page. That was not "no shift" — at 500 kbps the image had not
  // downloaded yet, so the shift it causes had not happened. The assertion was
  // passing because nothing had occurred, which is the worst way for a check
  // to be green. Proved by probe-cls.js: a control shift injected after render
  // measures 0.4374, so the observer was never the problem.
  //
  // Products on the branded fallback have no <img> to wait for, hence the
  // race against a ceiling rather than a hard requirement.
  await Promise.race([
    page.waitForFunction(() => {
      const i = [...document.querySelectorAll('img')].find((x) => /\/images\/products\//.test(x.currentSrc || x.src));
      return i && i.complete && i.naturalWidth > 0;
    }, { timeout: 12000 }).catch(() => {}),
    page.waitForTimeout(12000),
  ]);
  await page.waitForTimeout(1200);

  const out = await page.evaluate(() => ({
    cls: window.__ipcCLS,
    shifts: window.__ipcShifts,
    sources: window.__ipcSources,
    // Did the photo, or the branded panel that replaces it, reserve its box?
    reserved: (() => {
      const el = document.querySelector('[data-ipc-photo-box]');
      return el ? getComputedStyle(el).aspectRatio : null;
    })(),
    photo: (() => {
      const i = [...document.querySelectorAll('img')].find((x) => /\/images\/products\//.test(x.currentSrc || x.src));
      if (!i) return null;
      const r = i.getBoundingClientRect();
      return {
        w: i.getAttribute('width'), h: i.getAttribute('height'),
        box: `${Math.round(r.width)}x${Math.round(r.height)}`,
        loaded: i.complete && i.naturalWidth > 0,
      };
    })(),
  }));
  await ctx.close();
  return out;
}

/** Swap in a scratch content.json, run fn, always restore. */
async function withContent(mutate, fn) {
  const pristine = fs.readFileSync(PRISTINE_CONTENT, 'utf8');
  const doc = JSON.parse(pristine);
  mutate(doc);
  fs.writeFileSync(SITE_CONTENT, JSON.stringify(doc, null, 4));
  try {
    return await fn();
  } finally {
    fs.writeFileSync(SITE_CONTENT, pristine);
  }
}

const readBanner = () => {
  const el = [...document.querySelectorAll('div')].find(
    (d) => d.children.length === 0 && /Standard Lead Time/i.test(d.textContent)
  );
  const wrap = el && el.parentElement;
  return {
    headline: el ? el.textContent.trim() : null,
    block: wrap ? wrap.innerText.replace(/\s+/g, ' ').trim().slice(0, 160) : null,
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const rec = {};

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // ── B11 — the rendered footer text, and a sweep for the same shape ────
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    rec.footerText = await page.evaluate(() => {
      const p = [...document.querySelectorAll('footer p, footer div')]
        .find((e) => /industrial adhesives/i.test(e.textContent));
      return p ? p.innerText.replace(/\s+/g, ' ').trim() : null;
    });

    // The same defect anywhere else: a word character butted straight against
    // a currency/number that came from an expression.
    rec.glued = [];
    for (const route of ['/', '/about', '/services', '/contact', '/faq', '/industries', '/privacy', '/datasheets']) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      const hits = await page.evaluate(() => {
        const out = [];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        for (let el = walk.nextNode(); el; el = walk.nextNode()) {
          if (el.children.length) continue;
          const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
          // A letter or sentence punctuation hard against a currency amount:
          // "adhesives.$50". Deliberately NOT letter-against-digit, which the
          // first version used — it flagged every SKU on the site ("IP33PO")
          // and every phone number ("630.771.0700"), 41 false positives and no
          // real ones. An opening bracket is excluded so "($50 minimum)" is
          // left alone.
          const m = t.match(/[A-Za-z.,;:!?]\$[\d]/g);
          if (m) out.push({ text: t.slice(0, 70), hits: m.slice(0, 3) });
        }
        return out;
      });
      for (const h of hits) rec.glued.push({ route, ...h });
    }

    // ── A7 — intercept every request over all 42 product pages ────────────
    const external = [];
    const imgReqs = [];
    page.on('request', (r) => {
      const u = r.url();
      if (r.resourceType() !== 'image') return;
      imgReqs.push(u);
      if (!u.startsWith(BASE)) external.push(u);
    });
    for (const p of products) {
      await page.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, { waitUntil: 'networkidle' });
    }
    rec.externalImages = [...new Set(external)];
    rec.imageRequests = imgReqs.length;

    // The branded panel must actually be what renders for those five.
    rec.fallbackRenders = [];
    for (const p of PLACEHOLD) {
      await page.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, { waitUntil: 'networkidle' });
      rec.fallbackRenders.push({
        id: p.id,
        branded: await page.evaluate(() => /COMING SOON/i.test(document.body.innerText)),
      });
    }
    await ctx.close();

    // ── B21 — three content shapes ────────────────────────────────────────
    const shapes = {
      allSame: (d) => d.services.forEach((s) => { s.leadTime = '≤ 1 week'; }),
      fivePlusQualified: () => {},                       // today's data, untouched
      allDifferent: (d) => d.services.forEach((s, i) => { s.leadTime = `${i + 1} week${i ? 's' : ''}`; }),
    };
    rec.banner = {};
    for (const [name, mutate] of Object.entries(shapes)) {
      rec.banner[name] = await withContent(mutate, async () => {
        const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const p2 = await c2.newPage();
        await p2.goto(BASE + '/services', { waitUntil: 'networkidle' });
        const b = await p2.evaluate(readBanner);
        await p2.screenshot({ path: path.join(OUT, `banner-${name}.png`), clip: { x: 0, y: 200, width: 1440, height: 400 } });
        await c2.close();
        return b;
      });
    }

    // ── B23 — CLS on a real photo and on the branded fallback ─────────────
    // Both widths. At 1440 the two-column grid's row height is driven by the
    // taller specification column, so a photo with no reserved box can load
    // late and shift nothing — the defect hides. At 390 the layout stacks and
    // the photo is on its own row, which is where the audit measured it
    // painted at 390x260.
    rec.clsReal = await measureCls(browser, `${BASE}/products?productId=${encodeURIComponent(REAL_PHOTO.id)}`);
    rec.clsFallback = await measureCls(browser, `${BASE}/products?productId=${encodeURIComponent(PLACEHOLD[0].id)}`);
    rec.clsReal390 = await measureCls(browser, `${BASE}/products?productId=${encodeURIComponent(REAL_PHOTO.id)}`, 390);
    rec.clsFallback390 = await measureCls(browser, `${BASE}/products?productId=${encodeURIComponent(PLACEHOLD[0].id)}`, 390);
  } finally {
    await browser.close();
  }

  // Never leave the mirror mutated.
  fs.writeFileSync(SITE_CONTENT, fs.readFileSync(PRISTINE_CONTENT, 'utf8'));
  fs.writeFileSync(path.join(OUT, 'chrome.json'), JSON.stringify(rec, null, 2));

  // ── B11 ───────────────────────────────────────────────────────────────────
  note(rec.footerText && /adhesives\.\s\$/.test(rec.footerText),
    'the footer paragraph renders "adhesives. $50 minimum order." with the space',
    JSON.stringify((rec.footerText || '').slice(0, 120)));
  note(rec.glued.length === 0,
    `no other text on 8 routes glues a word to a number (${rec.glued.length} found)`,
    rec.glued.slice(0, 6).map((g) => `${g.route}: ${JSON.stringify(g.text)} -> ${g.hits.join(', ')}`).join('\n         '));

  // ── B21 ───────────────────────────────────────────────────────────────────
  const b = rec.banner;
  note(b.allSame.headline === 'Standard Lead Time: ≤ 1 week',
    `all six identical -> "${b.allSame.headline}"`);
  note(b.fivePlusQualified.headline && !/·/.test(b.fivePlusQualified.headline),
    `five plus one qualified -> "${b.fivePlusQualified.headline}" (no joined duplicate)`,
    JSON.stringify(b.fivePlusQualified));
  // SUPERSEDED BY UX-audit F12, updated 2026-08-13 (audit-runs/audit3.md C-01).
  //
  // This used to require the block to say "differ|except|vary|varies" — B21's
  // original behaviour, where a minority lead time raised "1 service differs —
  // see below". F12 deleted that clause at the owner's instruction, because it
  // named no service and "see below" pointed at nothing: the service cards
  // render title, desc and details and have never rendered leadTime. The code
  // comment in ServicesPage's leadTimeSummary says so and says what to do
  // instead (render svc.leadTime on the cards).
  //
  // The assertion was left pinned to the pre-F12 wording, so it had been red on
  // every run since — a permanently-failing check trains people to ignore the
  // suite, which is the same fault audit2.md B-05 found in plan8-catalog.
  //
  // What B21 still guarantees, and what is checked here now: the majority value
  // is headlined ALONE. The minority qualifier must not be joined into the
  // headline (asserted above), and must not leak into the block either.
  note(!!b.fivePlusQualified.block && !/JIT by agreement/.test(b.fivePlusQualified.block),
    'the minority qualifier is not joined into the banner (F12: the clause was deleted, not reworded)',
    JSON.stringify(b.fivePlusQualified.block));
  note(b.allDifferent.headline && !/·/.test(b.allDifferent.headline),
    `six all different -> "${b.allDifferent.headline}" (not six values joined)`,
    JSON.stringify(b.allDifferent));

  // ── B23 ───────────────────────────────────────────────────────────────────
  // The acceptance is "CLS contribution from the PRODUCT PHOTO is 0", not
  // "page CLS is 0". Those are different claims and only one of them is this
  // item's business — see the note on __ipcSources.
  const CASES = [
    ['@1440 real photo', rec.clsReal],
    ['@1440 branded fallback', rec.clsFallback],
    ['@390 real photo', rec.clsReal390],
    ['@390 branded fallback', rec.clsFallback390],
  ];
  for (const [label, m] of CASES) {
    const fromPhoto = (m.sources || []).filter(
      (s) => (s.src && /\/images\/products\//.test(s.src)) || /COMING SOON/i.test(s.text || '')
    );
    note(fromPhoto.length === 0,
      `${label}: the product photo contributes no layout shift ` +
      `(page total ${m.cls.toFixed(4)}${(m.sources || []).length ? ', from ' +
        [...new Set(m.sources.map((s) => s.tag))].join('/') : ''})`,
      JSON.stringify(fromPhoto));
    note(m.reserved && m.reserved !== 'auto',
      `${label}: the box is reserved before the bytes arrive (aspect-ratio ${m.reserved})`);
  }

  // ── A7 ────────────────────────────────────────────────────────────────────
  note(rec.externalImages.length === 0,
    `zero external image requests across all ${products.length} product pages ` +
    `(${rec.imageRequests} image requests, all same-origin)`,
    rec.externalImages.join('\n         '));
  note(rec.fallbackRenders.every((f) => f.branded),
    `the branded panel renders for all ${PLACEHOLD.length} placehold.co products`,
    rec.fallbackRenders.filter((f) => !f.branded).map((f) => f.id).join(', '));

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-chrome ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'chrome.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
