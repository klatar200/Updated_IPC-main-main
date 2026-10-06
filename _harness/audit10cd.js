/**
 * WHATS_LEFT §1at (Keagan 2026-10-06) — the 31 AUDIT-10 C/D findings approved
 * for fixing, one arm per finding, each measured the way the triage measured
 * it (and, where it still applies, the way _harness/AUDIT10-REPORT.md did).
 *
 * Read-only against the sweep mirror on :8123 (the admin is viewed signed in;
 * nothing is saved). `node _harness/audit10cd.js [public|admin]` runs a half.
 *
 *   npm run build && sh _harness/sync.sh && node _harness/audit10cd.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const H = __dirname;
const ROOT = path.join(H, '..');
const BASE = 'http://127.0.0.1:8123';
const LIB = 'Liberation Sans';
const ONLY = process.argv[2] || '';
const results = [];
const note = (ok, label, detail) => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${String(detail).slice(0, 600)}` : ''}`);
};
const catalog = JSON.parse(fs.readFileSync(path.join(H, 'pristine', 'products-all.json'), 'utf8'));
const rows = Array.isArray(catalog) ? catalog : catalog.products;
const ids = rows.map((p) => p.id);
const app = fs.readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf8');

async function ctxFor(browser, w, h, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(opts.touch ? { hasTouch: true, isMobile: true } : {}), ...(opts.reduce ? { reducedMotion: 'reduce' } : {}) });
  if (opts.font) {
    await ctx.addInitScript((f) => {
      const apply = () => { const s = document.createElement('style'); s.textContent = `*,*::before,*::after{font-family:"${f}"!important}`; document.head.appendChild(s); };
      if (document.readyState !== 'loading') apply(); else document.addEventListener('DOMContentLoaded', apply);
    }, opts.font);
  }
  return ctx;
}
const go = async (page, url) => { await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(350); };

/** Visible style snapshot, for "did hover change anything". */
const SNAP = (el) => { const cs = getComputedStyle(el); return [cs.backgroundColor, cs.color, cs.borderTopColor, cs.borderLeftColor, cs.borderBottomColor, cs.textDecorationLine, cs.boxShadow, cs.transform, cs.filter, cs.opacity].join('|'); };

async function publicArms(browser) {
  // ── A10-059 — a sidebar pick lands on the product, not the top of the page
  {
    const bad = [];
    for (const [w, h] of [[834, 1112], [390, 844]]) {
      const ctx = await ctxFor(browser, w, h);
      const page = await ctx.newPage();
      await go(page, '/products?productId=CC');
      const link = await page.evaluateHandle(() => [...document.querySelectorAll('aside a[href*="productId="]')]
        .find((a) => a.getBoundingClientRect().width > 0 && !/productId=CC$/.test(a.getAttribute('href'))));
      await link.asElement().scrollIntoViewIfNeeded();
      await link.asElement().click();
      await page.waitForTimeout(2200);
      const r = await page.evaluate(() => {
        const h1 = document.querySelector('main h1') || document.querySelector('h1');
        const hdr = document.querySelector('header').getBoundingClientRect();
        const t = h1.getBoundingClientRect();
        return { top: Math.round(t.top), headerBottom: Math.round(hdr.bottom), vh: innerHeight };
      });
      if (!(r.top >= r.headerBottom - 1 && r.top < r.vh * 0.5)) bad.push(`${w}: h1 top ${r.top} (header bottom ${r.headerBottom}, viewport ${r.vh})`);
      await ctx.close();
    }
    note(bad.length === 0, 'A10-059: a product picked from the sidebar (834, 390) has its title on screen below the navbar', bad.join('; '));
  }

  // ── A10-003 / A10-004 / A10-005 — product detail voids and the rail, all 42 at 1440 + 1024
  {
    const v3 = [], v4 = [], v5 = [];
    for (const [w, h] of [[1440, 900], [1024, 768]]) {
      const ctx = await ctxFor(browser, w, h);
      const page = await ctx.newPage();
      for (const id of ids) {
        await go(page, '/products?productId=' + encodeURIComponent(id));
        const m = await page.evaluate(() => {
          const inner = (box) => {
            const br = box.getBoundingClientRect();
            let bottom = br.top;
            for (const k of box.querySelectorAll('*')) { const kr = k.getBoundingClientRect(); if (kr.height > 0 && kr.bottom > bottom) bottom = kr.bottom; }
            const cs = getComputedStyle(box);
            return br.bottom - (parseFloat(cs.borderBottomWidth) || 0) - (parseFloat(cs.paddingBottom) || 0) - bottom;
          };
          const photoBox = document.querySelector('[data-ipc-photo-box]');
          const card = photoBox && photoBox.closest('.rounded-2xl');
          const cell = photoBox && photoBox.closest('div.p-5, div[class*="p-5"]');
          const spec = [];
          if (card) for (const el of card.querySelectorAll('div.rounded-xl')) {
            const cs = getComputedStyle(el);
            if (parseFloat(cs.borderTopWidth) === 0) continue;
            if (el.querySelector('table') || el.querySelector('.divide-y')) spec.push(inner(el));
          }
          const rail = document.querySelector('aside .ipc-scroll-cue');
          let railOk = null;
          if (rail && rail.getBoundingClientRect().width > 0) {
            const active = [...rail.querySelectorAll('a[href*="productId="]')].find((a) => getComputedStyle(a).borderLeftColor !== 'rgba(0, 0, 0, 0)' && parseFloat(getComputedStyle(a).borderLeftWidth) >= 3);
            if (active) {
              const rr = rail.getBoundingClientRect(), ar = active.getBoundingClientRect();
              const head = rail.firstElementChild ? rail.firstElementChild.getBoundingClientRect().height : 0;
              railOk = ar.top >= rr.top + head - 1 && ar.bottom <= rr.bottom + 1;
            }
          }
          return { photo: cell ? inner(cell) : 0, spec, railOk };
        });
        if (m.photo > 100) v3.push(`${w}/${id} ${Math.round(m.photo)}px`);
        for (const s of m.spec) if (s > 100) { v4.push(`${w}/${id} ${Math.round(s)}px`); break; }
        if (m.railOk === false) v5.push(`${w}/${id}`);
      }
      await ctx.close();
    }
    note(v3.length === 0, `A10-003: no product photo cell paints more than 100px of empty framed column (42 × 1440/1024)`, `${v3.length}: ${v3.slice(0, 6).join(', ')}`);
    note(v4.length === 0, `A10-004: no spec panel is stretched more than 100px past its content (42 × 1440/1024)`, `${v4.length}: ${v4.slice(0, 6).join(', ')}`);
    note(v5.length === 0, `A10-005: the catalog rail shows the current product's row (42 × 1440/1024)`, `${v5.length}: ${v5.slice(0, 8).join(', ')}`);
  }

  // ── A10-006 / A10-016 — spec tables scroll sideways at 1024 / 834 (Liberation Sans, the report's control)
  {
    const over = { 1024: [], 834: [] };
    for (const [w, h] of [[1024, 768], [834, 1112]]) {
      const ctx = await ctxFor(browser, w, h, { font: LIB });
      const page = await ctx.newPage();
      for (const id of ids) {
        await go(page, '/products?productId=' + encodeURIComponent(id));
        const px = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('table')].map((t) => {
          let sc = t.parentElement; while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowX)) sc = sc.parentElement;
          return sc ? sc.scrollWidth - sc.clientWidth : 0;
        })));
        if (px > 2) over[w].push(`${id} +${px}`);
      }
      await ctx.close();
    }
    note(over[1024].length === 0, 'A10-006: no product spec table scrolls sideways at 1024', `${over[1024].length}/42: ${over[1024].slice(0, 6).join(', ')}`);
    note(over[834].length === 0, 'A10-016: no product spec table scrolls sideways at 834', `${over[834].length}/42: ${over[834].slice(0, 6).join(', ')}`);
  }

  // ── A10-007 — homepage section headings share the left edge at 1440
  {
    const ctx = await ctxFor(browser, 1440, 900);
    const page = await ctx.newPage();
    await go(page, '/');
    const lefts = await page.evaluate(() => {
      const textLeft = (el) => { const r = document.createRange(); r.selectNodeContents(el); const rs = [...r.getClientRects()].filter((x) => x.width > 0); return rs.length ? Math.round(Math.min(...rs.map((x) => x.left))) : null; };
      return [...document.querySelectorAll('main h2')].filter((h) => h.getBoundingClientRect().width > 0 && getComputedStyle(h).textAlign !== 'center')
        .map((h) => ({ t: h.textContent.trim().slice(0, 40), left: textLeft(h) }));
    });
    const container = await page.evaluate(() => Math.round(document.querySelector('main .ipc-container').getBoundingClientRect().left + parseFloat(getComputedStyle(document.querySelector('main .ipc-container')).paddingLeft)));
    const off = lefts.filter((x) => Math.abs(x.left - container) > 2);
    note(off.length === 0, `A10-007: every left-aligned homepage h2 starts at the content edge (${container}px)`, JSON.stringify(off));
    await ctx.close();
  }

  // ── A10-008 — /datasheets lights the Products nav item
  {
    const ctx = await ctxFor(browser, 1440, 900);
    const page = await ctx.newPage();
    const lit = async (url) => { await go(page, url); return page.evaluate(() => [...document.querySelectorAll('header button, header a')].filter((el) => parseFloat(getComputedStyle(el).borderBottomWidth) >= 2 && getComputedStyle(el).borderBottomColor !== 'rgba(0, 0, 0, 0)').map((el) => el.textContent.trim().slice(0, 20))); };
    const ds = await lit('/datasheets');
    const pr = await lit('/products');
    note(ds.length > 0 && JSON.stringify(ds) === JSON.stringify(pr), 'A10-008: /datasheets lights the same nav item as /products', `datasheets ${JSON.stringify(ds)} vs products ${JSON.stringify(pr)}`);
    await ctx.close();
  }

  // ── A10-009 — /dashboard search placeholder fits; A10-018 — /contact special requirements hint fits
  {
    const bad = [];
    for (const font of [null, LIB]) for (const [w, h] of [[1440, 900], [1024, 768], [834, 1112], [390, 844]]) {
      const ctx = await ctxFor(browser, w, h, { font });
      const page = await ctx.newPage();
      for (const [url, sel] of [['/dashboard', 'input[aria-label="Search products"]'], ['/contact', '[name="specialReqs"]']]) {
        await go(page, url);
        const m = await page.evaluate((s) => [...document.querySelectorAll(s)].filter((el) => el.getBoundingClientRect().width > 0).map((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const availW = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
          const availH = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
          const span = document.createElement('div');
          span.style.cssText = `position:absolute;visibility:hidden;left:-9999px;${el.tagName === 'TEXTAREA' ? `width:${availW}px;white-space:pre-wrap;` : 'white-space:pre;'}`;
          span.style.font = cs.font; span.style.letterSpacing = cs.letterSpacing; span.style.lineHeight = cs.lineHeight;
          span.textContent = el.getAttribute('placeholder');
          document.body.appendChild(span); const b = span.getBoundingClientRect(); span.remove();
          return el.tagName === 'TEXTAREA' ? Math.max(0, b.height - availH) : Math.max(0, b.width - availW);
        }), sel);
        for (const cut of m) if (cut > 1) bad.push(`${font || 'shipped'} ${w} ${url} cut ${cut.toFixed(1)}px`);
      }
      await ctx.close();
    }
    note(!bad.some((b) => /dashboard/.test(b)), 'A10-009: the /dashboard search placeholder fits at 1440/1024/834/390 (shipped font and Liberation)', bad.filter((b) => /dashboard/.test(b)).join('; '));
    note(!bad.some((b) => /contact/.test(b)), 'A10-018: the /contact Special Requirements hint is fully visible at every width', bad.filter((b) => /contact/.test(b)).join('; '));
  }

  // ── A10-013 — "Clear filter" is at least 24px tall on a touch phone
  {
    const ctx = await ctxFor(browser, 390, 844, { touch: true });
    const page = await ctx.newPage();
    const hs = [];
    for (const fam of ['Tape', 'Adhesive']) {
      await go(page, '/dashboard?family=' + fam);
      hs.push(...await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /Clear filter/.test(b.textContent) && b.getBoundingClientRect().width > 0).map((b) => +b.getBoundingClientRect().height.toFixed(1))));
    }
    note(hs.length > 0 && hs.every((x) => x >= 24), 'A10-013: "✕ Clear filter" is at least 24px tall at 390 (WCAG 2.5.8)', JSON.stringify(hs));
    await ctx.close();
  }

  // ── A10-014 — footer links do not wrap at 834
  {
    const ctx = await ctxFor(browser, 834, 1112, { font: LIB });
    const page = await ctx.newPage();
    await go(page, '/');
    const wrapped = await page.evaluate(() => [...document.querySelectorAll('footer a')].filter((a) => {
      const r = document.createRange(); r.selectNodeContents(a);
      return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1;
    }).map((a) => a.textContent.trim().slice(0, 30)));
    note(wrapped.length === 0, 'A10-014: no footer link wraps to two lines at 834', JSON.stringify(wrapped));
    await ctx.close();
  }

  // ── A10-017 — chip rails at 390 show there is more (an edge fade). The
  // approved fix said "wrap the FAQ chips"; measured, wrapping grew the sticky
  // FAQ bar from 55px to 181px of an 844px screen, so both rails take the
  // fade instead (WHATS_LEFT §1at). This arm holds the fade on both.
  {
    const ctx = await ctxFor(browser, 390, 844, { touch: true });
    const page = await ctx.newPage();
    const cueOn = () => {
      const r = [...document.querySelectorAll('main div, aside div')].find((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth - el.clientWidth > 2 && el.querySelector('button') && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height < 120);
      if (!r) return 'no overflowing chip rail';
      const cs = getComputedStyle(r);
      const m = (cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none');
      return m ? 'ok' : 'no edge cue';
    };
    for (const url of ['/faq', '/products']) {
      await go(page, url);
      const cue = await page.evaluate(cueOn);
      note(cue === 'ok', `A10-017: the overflowing chip rail on ${url} fades at its edge to show there is more`, cue);
    }
    await ctx.close();
  }

  // ── A10-038 — no fixed-length "…" cuts left in the source
  {
    const cuts = (app.match(/\.slice\(0,\s*\d+\)\s*\+\s*"…"/g) || []).length;
    note(cuts === 0, 'A10-038: no `.slice(0, N) + "…"` cut remains in App.jsx (trimToWord everywhere)', `${cuts} left`);
  }

  // ── A10-051 — /faq heading scale
  {
    const ctx = await ctxFor(browser, 1440, 900);
    const page = await ctx.newPage();
    await go(page, '/faq');
    const m = await page.evaluate(() => {
      const size = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => parseFloat(getComputedStyle(e).fontSize));
      return { h2: Math.min(...size('main h2')), h3: Math.max(0, ...size('main h3')) };
    });
    note(m.h3 <= m.h2, `A10-051: no h3 on /faq is larger than its smallest h2 (${m.h3} vs ${m.h2})`);
    await ctx.close();
  }

  // ── A10-055 — Escape closes a mega-menu opened by hover
  {
    const ctx = await ctxFor(browser, 1440, 900);
    const page = await ctx.newPage();
    await go(page, '/');
    const trig = page.locator('header button[aria-haspopup="true"]').first();
    await trig.hover();
    await page.waitForTimeout(300);
    const panel = page.locator('header button[aria-haspopup="true"] + div, header button[aria-haspopup="true"] ~ div').first();
    await panel.hover().catch(() => {});
    await page.waitForTimeout(200);
    const before = await trig.getAttribute('aria-expanded');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const after = await trig.getAttribute('aria-expanded');
    note(before === 'true' && after === 'false', 'A10-055: Escape closes the Products mega-menu after a hover opened it', `before ${before}, after ${after}`);
    await ctx.close();
  }

  // ── A10-057 — reduced motion: no spring on the RFQ bar, no FAQ collapse animation
  {
    const ctx = await ctxFor(browser, 1440, 900, { reduce: true });
    const page = await ctx.newPage();
    await go(page, '/products?productId=CC');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const samples = [];
    for (let i = 0; i < 8; i++) {
      samples.push(await page.evaluate(() => { const b = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).position === 'fixed' && /Request a Quote/i.test(d.textContent) && d.getBoundingClientRect().height < 200); return b ? Math.round(b.getBoundingClientRect().top) : null; }));
      await page.waitForTimeout(60);
    }
    const tops = samples.filter((x) => x !== null);
    note(new Set(tops).size <= 1, `A10-057: under reduced motion the RFQ bar appears without a spring (${JSON.stringify(tops)})`);
    await go(page, '/faq');
    const tr = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('main button[aria-expanded]')].find((b) => b.getBoundingClientRect().width > 0);
      if (!btn) return 'no faq toggle';
      const id = btn.getAttribute('aria-controls');
      const pnl = id && document.getElementById(id);
      if (!pnl) return 'no panel';
      const cs = getComputedStyle(pnl);
      return cs.transitionProperty === 'none' || cs.transitionDuration.split(',').every((d) => parseFloat(d) === 0) ? 'ok' : cs.transitionProperty + ' ' + cs.transitionDuration;
    });
    note(tr === 'ok', 'A10-057: under reduced motion the FAQ answer panel has no transition', tr);
    await ctx.close();
  }

  // ── A10-058 — opening and closing the mobile menu keeps the reader's place
  {
    const bad = [];
    for (const [w, h] of [[390, 844], [834, 1112]]) {
      const ctx = await ctxFor(browser, w, h, { touch: true });
      const page = await ctx.newPage();
      await go(page, '/products?productId=IP33PO');
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(500);
      const y0 = await page.evaluate(() => Math.round(scrollY));
      await page.click('button[aria-label="Open menu"]');
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const y1 = await page.evaluate(() => Math.round(scrollY));
      if (Math.abs(y1 - y0) > 2) bad.push(`${w}: ${y0} → ${y1}`);
      await ctx.close();
    }
    note(bad.length === 0, 'A10-058: opening and closing the mobile menu returns the page to where the visitor was', bad.join('; '));
  }

  // ── A10-060 / A10-061 — hover feedback actually paints
  {
    const ctx = await ctxFor(browser, 1440, 900);
    const page = await ctx.newPage();
    const dead = [];
    const probe = async (url, label, finder) => {
      await go(page, url);
      const h = await page.evaluateHandle(finder);
      const el = h.asElement();
      if (!el) { dead.push(`${label}: not found`); return; }
      await page.mouse.move(1, 1);
      await page.waitForTimeout(250);
      const a = await el.evaluate((e, s) => (0, eval)(s)(e), SNAP.toString());
      await el.hover();
      await page.waitForTimeout(450);
      const b = await el.evaluate((e, s) => (0, eval)(s)(e), SNAP.toString());
      if (a === b) dead.push(label);
    };
    const byText = (re) => new Function(`return [...document.querySelectorAll('main a, main button')].find((e) => ${re}.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0) || null;`);
    await probe('/', 'A10-060 "View Full Catalog"', byText('/^View Full Catalog/'));
    await probe('/', 'A10-060 "View All Industries"', byText('/^View All Industries/'));
    await probe('/services', 'A10-060 /services "Browse All Products"', byText('/^Browse All Products/'));
    await probe('/about', 'A10-060 /about timeline card', () => [...document.querySelectorAll('main div.bg-white.rounded-xl.px-5.py-4')].find((d) => d.getBoundingClientRect().width > 0) || null);
    await probe('/dashboard', 'A10-061 /dashboard sort header', () => document.querySelector('main th button, main .ipc-sort-btn'));
    await probe('/faq', 'A10-061 /faq question row', () => document.querySelector('main button[aria-expanded]'));
    await probe('/products?productId=CC', 'A10-061 sidebar family head', () => [...document.querySelectorAll('aside .ipc-scroll-cue button[aria-expanded]')].find((b) => b.getBoundingClientRect().width > 0) || null);
    await probe('/dashboard', 'A10-061 /dashboard approval chip', () => [...document.querySelectorAll('main button')].find((b) => /^(UL|CSA|MIL|RoHS|AMS)/.test(b.textContent.trim()) && b.getBoundingClientRect().width > 0) || null);
    note(dead.filter((d) => /A10-060/.test(d)).length === 0, 'A10-060: the four CTAs/cards whose hover never painted now respond', dead.filter((d) => /A10-060/.test(d)).join('; '));
    note(dead.filter((d) => /A10-061/.test(d)).length === 0, 'A10-061: sort headers, FAQ rows, sidebar heads and approval chips give hover feedback', dead.filter((d) => /A10-061/.test(d)).join('; '));
    await ctx.close();
  }

  // ── A10-043 — one apostrophe convention; one term for the grade
  {
    note(!/&rsquo;/.test(app), 'A10-043: no curly-apostrophe entity left in App.jsx (the site uses a straight one)');
    const files = ['src/App.jsx', 'public/index.php', 'data/content.json'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'));
    note(files.every((t) => !/specification-grade/.test(t)), 'A10-043: "specification-grade" is "spec-grade" everywhere it ships');
  }
}

module.exports = { publicArms, note, results, ctxFor, go, BASE };

if (require.main === module) {
  (async () => {
    const browser = await launch();
    try {
      if (!ONLY || ONLY === 'public') await publicArms(browser);
      if (!ONLY || ONLY === 'admin') await require('./audit10cd-admin').adminArms(browser, { note, BASE });
    } finally {
      await browser.close();
    }
    const bad = results.filter((x) => !x).length;
    console.log(`\naudit10cd ${results.length - bad}/${results.length}`);
    process.exit(bad ? 1 : 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
