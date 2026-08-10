/**
 * AUDIT-10 pass-2 — the last block of re-measurements.
 *
 *   ph      /contact placeholders sliced at 390 (the A10-009 class, different page)
 *   card    /dashboard's MOBILE card at 390 — the partType pill against the title
 *   clear   the "✕ Clear filter" control: is it really painted, and how big
 *   bar     the fixed RFQ bar AT REST and mid-scroll — does it cover the rail?
 *           (twelve reviewers saw it over the catalog rail in fullPage captures;
 *           Playwright paints position:fixed onto the expanded canvas, so this
 *           has to be settled by scrolling, not by looking)
 *
 * Usage: node _harness/audit10-p2last.js <section>   (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const ISSUES = path.join(OUT, 'issues');
const LIB = 'Liberation Sans';
const VPS = [{ n: 'mobile-390', w: 390, h: 844 }, { n: 'tablet-834', w: 834, h: 1112 }];

async function ctxFor(browser, w, h, font) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  if (font) await ctx.addInitScript((f) => {
    const apply = () => { const s = document.createElement('style'); s.textContent = `*,*::before,*::after{font-family:"${f}"!important}`; document.head.appendChild(s); };
    if (document.readyState !== 'loading') apply(); else document.addEventListener('DOMContentLoaded', apply);
  }, font);
  return ctx;
}

// ── ph ──────────────────────────────────────────────────────────────────────
async function ph(browser) {
  // Measure the placeholder's natural width against the field's inner width by
  // painting the same string into a detached span with the field's own font.
  const probe = () => {
    const out = [];
    for (const el of document.querySelectorAll('input, textarea')) {
      const p = el.getAttribute('placeholder');
      if (!p || el.type === 'hidden') continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const avail = r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
        - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0);
      const span = document.createElement('span');
      span.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px';
      span.style.font = cs.font || `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
      span.style.letterSpacing = cs.letterSpacing;
      span.textContent = p;
      document.body.appendChild(span);
      const need = span.getBoundingClientRect().width;
      span.remove();
      out.push({
        name: el.name || el.id, placeholder: p,
        fieldW: +r.width.toFixed(1), avail: +avail.toFixed(1),
        need: +need.toFixed(1), cut: +Math.max(0, need - avail).toFixed(1),
        fontSize: cs.fontSize,
      });
    }
    return out;
  };
  for (const font of [null, LIB]) for (const vp of VPS) {
    const ctx = await ctxFor(browser, vp.w, vp.h, font);
    const page = await ctx.newPage();
    for (const url of ['/contact', '/dashboard', '/datasheets']) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const d = await page.evaluate(probe);
      const cut = d.filter((x) => x.cut > 1);
      console.log(`[${vp.n}/${font || 'shipped'}] ${url}: ${cut.length} of ${d.length} placeholders cut`);
      for (const x of cut) console.log(`     ${x.name}: avail=${x.avail} need=${x.need} cut=${x.cut}px  "${x.placeholder}"`);
    }
    await ctx.close();
  }
}

// ── card ────────────────────────────────────────────────────────────────────
async function card(browser) {
  const probe = () => {
    // the mobile product card: SKU + title on the left, partType pill on the right
    const pills = [...document.querySelectorAll('span, div')].filter((el) => {
      const cs = getComputedStyle(el);
      const t = (el.textContent || '').trim();
      return t && el.children.length === 0 && cs.textTransform === 'uppercase' &&
        parseFloat(cs.borderRadius) >= 8 && el.getBoundingClientRect().width > 40;
    });
    const out = [];
    for (const pill of pills.slice(0, 60)) {
      const row = pill.parentElement;
      if (!row) continue;
      const title = [...row.querySelectorAll('h2,h3,h4,a,div')].find((c) => !c.contains(pill) && (c.textContent || '').trim().length > 8);
      if (!title) continue;
      const tr = title.getBoundingClientRect(), pr = pill.getBoundingClientRect(), rr = row.getBoundingClientRect();
      const rng = document.createRange(); rng.selectNodeContents(title);
      const lines = [...rng.getClientRects()].filter((x) => x.width > 0.5);
      out.push({
        pill: (pill.textContent || '').trim().slice(0, 30), pillW: +pr.width.toFixed(1),
        title: (title.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 44),
        titleW: +tr.width.toFixed(1), rowW: +rr.width.toFixed(1),
        titleLines: lines.length,
        widestLine: lines.length ? +Math.max(...lines.map((l) => l.width)).toFixed(1) : 0,
        overlapPx: +Math.max(0, Math.min(tr.right, pr.right) - Math.max(tr.left, pr.left)).toFixed(1),
        gap: +(pr.left - tr.right).toFixed(1),
      });
    }
    return out;
  };
  for (const font of [null, LIB]) for (const vp of VPS) {
    const ctx = await ctxFor(browser, vp.w, vp.h, font);
    const page = await ctx.newPage();
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 15)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(400);
    const d = await page.evaluate(probe);
    const bad = d.filter((x) => x.titleLines >= 4 || x.overlapPx > 0.5 || x.gap < 4);
    console.log(`\n[${vp.n}/${font || 'shipped'}] /dashboard: ${d.length} pill rows; ${bad.length} with title >=4 lines or pill collision`);
    for (const x of bad.slice(0, 12)) console.log(`   "${x.title}" pill="${x.pill}"(${x.pillW}px) titleW=${x.titleW} lines=${x.titleLines} widest=${x.widestLine} gap=${x.gap} overlap=${x.overlapPx}`);
    const maxLines = d.length ? Math.max(...d.map((x) => x.titleLines)) : 0;
    console.log(`   max title lines: ${maxLines}; min gap between title and pill: ${d.length ? Math.min(...d.map((x) => x.gap)).toFixed(1) : 'n/a'}px`);
    await ctx.close();
  }
}

// ── clear ───────────────────────────────────────────────────────────────────
async function clear(browser) {
  for (const vp of VPS) {
    const ctx = await ctxFor(browser, vp.w, vp.h, null);
    const page = await ctx.newPage();
    for (const fam of ['Tape', 'Adhesive']) {
      await page.goto(BASE + '/dashboard?family=' + encodeURIComponent(fam), { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const d = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /Clear filter/i.test(x.textContent || ''));
        if (!b) return { present: false };
        const r = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        let hiddenAncestor = null, p = b.parentElement;
        while (p && p !== document.body) { const pcs = getComputedStyle(p); const pr = p.getBoundingClientRect(); if (pr.height < 2 || pcs.display === 'none' || pcs.visibility === 'hidden') { hiddenAncestor = p.tagName + '.' + (typeof p.className === 'string' ? p.className.slice(0, 30) : ''); break; } p = p.parentElement; }
        return {
          present: true, w: +r.width.toFixed(1), h: +r.height.toFixed(1),
          top: +r.top.toFixed(1), left: +r.left.toFixed(1),
          fontSize: cs.fontSize, padding: cs.padding, display: cs.display,
          inViewport: r.top >= 0 && r.top < window.innerHeight,
          hiddenAncestor,
          text: (b.textContent || '').trim(),
        };
      });
      console.log(`[${vp.n}] /dashboard?family=${fam}: ${JSON.stringify(d)}`);
      if (d.present && vp.n === 'mobile-390' && fam === 'Tape') {
        fs.mkdirSync(ISSUES, { recursive: true });
        await page.locator('button', { hasText: 'Clear filter' }).first().scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(200);
        const b = await page.locator('button', { hasText: 'Clear filter' }).first().boundingBox();
        if (b) await page.screenshot({ path: path.join(ISSUES, 'CLEARFILTER__mobile-390__dashboard-family-Tape.png'), clip: { x: Math.max(0, b.x - 30), y: Math.max(0, b.y - 40), width: Math.min(390, b.width + 120), height: b.height + 80 } });
      }
    }
    await ctx.close();
  }
}

// ── bar ─────────────────────────────────────────────────────────────────────
async function bar(browser) {
  const probe = () => {
    const vh = window.innerHeight;
    const fixed = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.position === 'fixed' && r.width > 1 && r.height > 1;
    });
    return {
      scrollY: Math.round(window.scrollY), vh,
      bodyClass: document.body.className,
      bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
      bars: fixed.map((el) => {
        const r = el.getBoundingClientRect();
        const covered = [];
        for (const c of document.querySelectorAll('a,button,p,h1,h2,h3,span,div')) {
          if (el.contains(c) || c.contains(el)) continue;
          if (c.children.length > 1) continue;
          const t = (c.textContent || '').trim();
          if (!t) continue;
          const cr = c.getBoundingClientRect();
          if (cr.width < 4 || cr.height < 4) continue;
          if (cr.bottom <= r.top || cr.top >= r.bottom) continue;
          if (cr.right <= r.left || cr.left >= r.right) continue;
          covered.push(`"${t.replace(/\s+/g, ' ').slice(0, 40)}" [${cr.top.toFixed(0)}-${cr.bottom.toFixed(0)}]`);
          if (covered.length >= 5) break;
        }
        return {
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
          top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1),
          onScreen: r.top < vh && r.bottom > 0,
          covered,
        };
      }),
    };
  };
  for (const vp of VPS) {
    const ctx = await ctxFor(browser, vp.w, vp.h, null);
    const page = await ctx.newPage();
    for (const id of ['IP33PO', 'IP52EC']) {
      await page.goto(BASE + '/products?productId=' + encodeURIComponent(id), { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      console.log(`\n[${vp.n}] ${id} AT REST: ${JSON.stringify(await page.evaluate(probe))}`);
      for (const y of [400, 900, 1600]) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(450);
        const d = await page.evaluate(probe);
        const on = d.bars.filter((b) => b.onScreen);
        console.log(`  scrollY=${d.scrollY} bodyClass="${d.bodyClass}" padB=${d.bodyPaddingBottom} bars onScreen=${on.length} ${JSON.stringify(on.map((b) => ({ band: [b.top, b.bottom], covers: b.covered })))}`);
      }
    }
    await ctx.close();
  }
}

(async () => {
  const which = process.argv[2] || 'all';
  fs.mkdirSync(ISSUES, { recursive: true });
  const browser = await launch();
  try {
    if (which === 'all' || which === 'ph') await ph(browser);
    if (which === 'all' || which === 'card') await card(browser);
    if (which === 'all' || which === 'clear') await clear(browser);
    if (which === 'all' || which === 'bar') await bar(browser);
  } finally { await browser.close(); }
})();
