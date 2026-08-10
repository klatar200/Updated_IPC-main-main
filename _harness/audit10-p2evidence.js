/**
 * AUDIT-10 pass-2 — targeted re-measurement + issue screenshots.
 *
 * Everything the sweep flagged gets re-measured here at the exact URL and
 * viewport, twice where the finding will claim CONFIRMED, and cropped to an
 * element-scoped PNG under out/audit10/issues/.
 *
 * Sections (argv[2]):
 *   h1        the product page-header <h1> at 390: does the title overflow its
 *             own box, and what does it collide with?
 *   sticky    the fixed RFQ bar at TRUE max scroll (scroll, let the bar mount
 *             and grow <body>, scroll again) — the honest T2.9 test.
 *   sku       compound SKUs wrapping across lines: where, how many, and what
 *             the two halves read as.
 *   dash      the /dashboard table at 834 — 146px of horizontal scroll, under
 *             the shipped face AND under Liberation Sans (the C49 control).
 *   chips     the /faq category chip scroller and the pinned C41 control.
 *   font      Liberation Sans control for every width claim above.
 *
 * Usage: node _harness/audit10-p2evidence.js <section>   (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const ISSUES = path.join(OUT, 'issues');
const LIB = 'Liberation Sans';   // metric-compatible with Arial; the C49 control

const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));

async function ctxFor(browser, w, h, font, touch) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    ...(touch ? { hasTouch: true, isMobile: true } : {}),
  });
  if (font) {
    await ctx.addInitScript((f) => {
      const apply = () => {
        const s = document.createElement('style');
        s.textContent = `*, *::before, *::after { font-family: "${f}" !important; }`;
        document.head.appendChild(s);
      };
      if (document.head) apply(); else document.addEventListener('DOMContentLoaded', apply);
    }, font);
  }
  return ctx;
}

const shot = async (page, selectorOrRect, file, pad = 12) => {
  fs.mkdirSync(ISSUES, { recursive: true });
  try {
    if (typeof selectorOrRect === 'string') {
      const el = page.locator(selectorOrRect).first();
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(250);
      const b = await el.boundingBox();
      if (!b) { await page.screenshot({ path: file }); return; }
      const vp = page.viewportSize();
      await page.screenshot({
        path: file,
        clip: {
          x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad),
          width: Math.min(vp.width - Math.max(0, b.x - pad), b.width + pad * 2),
          height: Math.min(vp.height - Math.max(0, b.y - pad), b.height + pad * 2),
        },
      });
    } else {
      await page.screenshot({ path: file, clip: selectorOrRect });
    }
  } catch (e) { await page.screenshot({ path: file }).catch(() => {}); }
};

// ── h1 ──────────────────────────────────────────────────────────────────────
async function h1(browser) {
  const ids = products.map((p) => p.id);
  const probe = () => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const h of document.querySelectorAll('h1, h2, h3')) {
      const r = h.getBoundingClientRect();
      if (r.width < 2) continue;
      const cs = getComputedStyle(h);
      const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
      const innerR = r.right - padR;
      // widest painted line box inside this heading
      const rng = document.createRange();
      rng.selectNodeContents(h);
      const rects = [...rng.getClientRects()];
      if (!rects.length) continue;
      const maxRight = Math.max(...rects.map((x) => x.right));
      const over = maxRight - innerR;
      if (over <= 0.5) continue;
      out.push({
        tag: h.tagName.toLowerCase(),
        cls: (typeof h.className === 'string' ? h.className : '').slice(0, 60),
        text: (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
        boxLeft: +r.left.toFixed(1), boxRight: +r.right.toFixed(1), boxW: +r.width.toFixed(1),
        paintedRight: +maxRight.toFixed(1),
        overflowPastBox: +over.toFixed(1),
        pastViewport: +Math.max(0, maxRight - vw).toFixed(1),
        parentTag: h.parentElement ? h.parentElement.tagName.toLowerCase() : null,
        parentCls: h.parentElement && typeof h.parentElement.className === 'string' ? h.parentElement.className.slice(0, 60) : '',
        parentDisplay: h.parentElement ? getComputedStyle(h.parentElement).display : null,
        parentOverflow: h.parentElement ? getComputedStyle(h.parentElement).overflow : null,
        parentRight: h.parentElement ? +h.parentElement.getBoundingClientRect().right.toFixed(1) : null,
        minWidth: cs.minWidth, flexShrink: cs.flexShrink, whiteSpace: cs.whiteSpace,
        overflow: cs.overflow, textOverflow: cs.textOverflow,
        lines: rects.length,
        // what sits in the overflowed strip
        collides: (() => {
          const hits = [];
          for (const el of document.querySelectorAll('a,button,span,p,div')) {
            if (h.contains(el) || el.contains(h)) continue;
            if (el.children.length > 1) continue;
            const t = (el.textContent || '').trim();
            if (!t) continue;
            const er = el.getBoundingClientRect();
            if (er.width < 4 || er.height < 4) continue;
            if (er.bottom <= Math.min(...rects.map((x) => x.top)) || er.top >= Math.max(...rects.map((x) => x.bottom))) continue;
            if (er.right <= innerR || er.left >= maxRight) continue;
            hits.push(`${el.tagName.toLowerCase()} "${t.replace(/\s+/g, ' ').slice(0, 30)}" [${er.left.toFixed(1)}-${er.right.toFixed(1)}]`);
            if (hits.length >= 4) break;
          }
          return hits;
        })(),
      });
    }
    return out;
  };
  const results = [];
  for (const font of [null, LIB]) {
    for (const vpn of ['mobile-390', 'tablet-834']) {
      const [w, h] = vpn === 'mobile-390' ? [390, 844] : [834, 1112];
      const ctx = await ctxFor(browser, w, h, font, true);
      const page = await ctx.newPage();
      for (const id of ids) {
        const url = '/products?productId=' + encodeURIComponent(id);
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(250);
        const hits = await page.evaluate(probe);
        if (hits.length) results.push({ id, url, viewport: vpn, font: font || 'shipped', hits });
        process.stdout.write(hits.length ? '!' : '.');
      }
      await ctx.close();
      console.log(` ${vpn} ${font || 'shipped'} done`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'p2ev.h1.json'), JSON.stringify(results, null, 1));
  console.log('\n== headings painting past their own box ==');
  for (const r of results) {
    for (const x of r.hits) {
      console.log(`  [${r.viewport}/${r.font}] ${r.id}: <${x.tag}> "${x.text}" box=${x.boxW}px painted +${x.overflowPastBox}px pastVp=${x.pastViewport} lines=${x.lines} minW=${x.minWidth} parent=${x.parentTag}.${x.parentCls}(${x.parentDisplay}, overflow=${x.parentOverflow}) collides=${JSON.stringify(x.collides)}`);
    }
  }
  // screenshots for the two worst
  const worst = results.filter((r) => r.font === 'shipped').sort((a, b) =>
    Math.max(...b.hits.map((h) => h.overflowPastBox)) - Math.max(...a.hits.map((h) => h.overflowPastBox))).slice(0, 3);
  for (const r of worst) {
    const [w, h] = r.viewport === 'mobile-390' ? [390, 844] : [834, 1112];
    const ctx = await ctxFor(browser, w, h, null, true);
    const page = await ctx.newPage();
    await page.goto(BASE + r.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await shot(page, 'h1', path.join(ISSUES, `H1OVERFLOW__${r.viewport}__${r.id.replace(/[^A-Za-z0-9-]/g, '_')}.png`), 20);
    await ctx.close();
  }
  console.log(`-> ${path.join(OUT, 'p2ev.h1.json')}`);
}

// ── sticky ──────────────────────────────────────────────────────────────────
async function sticky(browser) {
  const ids = products.map((p) => p.id);
  const toBottom = async (page) => {
    // Scroll, wait for the bar to mount and <body> to gain its padding, then
    // scroll again to the NEW bottom. One scroll measures a transient state.
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
    }
  };
  const probe = () => {
    const vh = window.innerHeight, vw = document.documentElement.clientWidth;
    const bars = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.position === 'fixed' && r.width > 1 && r.height > 1 && r.top < vh && r.bottom > 0;
    });
    const covered = [];
    for (const bar of bars) {
      const br = bar.getBoundingClientRect();
      for (const el of document.querySelectorAll('a,button,p,h1,h2,h3,li,span,label,td,th')) {
        if (bar.contains(el) || el.contains(bar)) continue;
        const t = (el.textContent || '').trim();
        if (!t || el.children.length > 2) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        if (r.bottom <= br.top || r.top >= br.bottom) continue;
        if (r.right <= br.left || r.left >= br.right) continue;
        covered.push({ el: el.tagName.toLowerCase(), text: t.replace(/\s+/g, ' ').slice(0, 60), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) });
        if (covered.length >= 6) break;
      }
    }
    return {
      vh, vw,
      scrollY: Math.round(window.scrollY),
      maxScroll: Math.round(document.documentElement.scrollHeight - vh),
      atBottom: Math.abs(window.scrollY - (document.documentElement.scrollHeight - vh)) < 2,
      bodyClass: document.body.className,
      bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
      docHeight: document.documentElement.scrollHeight,
      bars: bars.map((b) => {
        const r = b.getBoundingClientRect();
        return {
          cls: (typeof b.className === 'string' ? b.className : '').slice(0, 40),
          top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1),
          innerOverflow: b.scrollWidth - b.clientWidth,
          childrenPastRight: [...b.querySelectorAll('*')].filter((c) => c.getBoundingClientRect().right > vw + 1)
            .map((c) => `${c.tagName.toLowerCase()} "${(c.textContent || '').trim().slice(0, 22)}" right=${c.getBoundingClientRect().right.toFixed(1)}`).slice(0, 4),
          text: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
        };
      }),
      covered,
    };
  };
  const rows = [];
  for (const vpn of ['mobile-390', 'tablet-834']) {
    const [w, h] = vpn === 'mobile-390' ? [390, 844] : [834, 1112];
    const ctx = await ctxFor(browser, w, h, null, true);
    const page = await ctx.newPage();
    for (const id of ids) {
      const url = '/products?productId=' + encodeURIComponent(id);
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(250);
      const rest = await page.evaluate(probe);
      await toBottom(page);
      const bottom = await page.evaluate(probe);
      rows.push({ id, url, viewport: vpn, rest, bottom });
      process.stdout.write(bottom.covered.length ? '!' : '.');
    }
    await ctx.close();
    console.log(` ${vpn} done`);
  }
  fs.writeFileSync(path.join(OUT, 'p2ev.sticky.json'), JSON.stringify(rows, null, 1));
  const bad = rows.filter((r) => r.bottom.covered.length);
  console.log(`\n== at TRUE max scroll, fixed chrome covers text on ${bad.length} of ${rows.length} product page x viewport ==`);
  for (const r of bad.slice(0, 12)) {
    console.log(`  ${r.viewport} ${r.id}: atBottom=${r.bottom.atBottom} padB=${r.bottom.bodyPaddingBottom} bodyClass="${r.bottom.bodyClass}" bar=${JSON.stringify(r.bottom.bars.map((b) => [b.top, b.bottom]))} covers ${JSON.stringify(r.bottom.covered.map((c) => c.text))}`);
  }
  const restBad = rows.filter((r) => r.rest.bars.length);
  console.log(`== bars present AT REST (scrollY 0): ${restBad.length}`);
  const overflowing = rows.filter((r) => r.bottom.bars.some((b) => b.innerOverflow > 1 || b.childrenPastRight.length));
  console.log(`== bars whose own content overflows: ${overflowing.length}`);
  for (const r of overflowing.slice(0, 10)) console.log(`  ${r.viewport} ${r.id}: ${JSON.stringify(r.bottom.bars.map((b) => ({ io: b.innerOverflow, past: b.childrenPastRight })))}`);
  console.log(`-> ${path.join(OUT, 'p2ev.sticky.json')}`);
}

// ── sku ─────────────────────────────────────────────────────────────────────
async function sku(browser) {
  const probe = () => {
    const out = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const raw = (n.nodeValue || '');
      const m = raw.match(/\b(?:IP|CC|CT|VT)[A-Z0-9]{2,}(?:\s*[-–]\s*(?:IP)?[A-Z0-9]{2,}){1,3}\b/g);
      if (!m) continue;
      for (const tok of m) {
        const i = raw.indexOf(tok);
        if (i < 0) continue;
        range.setStart(n, i); range.setEnd(n, i + tok.length);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        if (rects.length < 2) continue;
        const host = n.parentElement;
        const hr = host.getBoundingClientRect();
        out.push({
          token: tok,
          host: host.tagName.toLowerCase() + (typeof host.className === 'string' && host.className ? '.' + host.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
          hostWidth: +hr.width.toFixed(1),
          lines: rects.length,
          lineWidths: rects.map((r) => +r.width.toFixed(1)),
          y: Math.round(hr.top + window.scrollY),
          fontSize: getComputedStyle(host).fontSize,
          wordBreak: getComputedStyle(host).wordBreak,
          overflowWrap: getComputedStyle(host).overflowWrap,
          context: (host.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
        });
      }
    }
    return out;
  };
  const urls = ['/products', '/dashboard', '/products?productId=CC',
    '/products?productId=IP13SP', '/products?productId=IP35KY',
    '/products?productId=IP64FS-IP65VC-IP66AC-IP67SC',
    '/products?productId=' + encodeURIComponent('IP71NS - IP72PS - IP73PP'),
    '/products?productId=IP17TW-18SW-19LW'];
  const rows = [];
  for (const font of [null, LIB]) {
    for (const vpn of ['mobile-390', 'tablet-834']) {
      const [w, h] = vpn === 'mobile-390' ? [390, 844] : [834, 1112];
      const ctx = await ctxFor(browser, w, h, font, false);
      const page = await ctx.newPage();
      for (const url of urls) {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 15)); } window.scrollTo(0, 0); });
        await page.waitForTimeout(300);
        const hits = await page.evaluate(probe);
        if (hits.length) rows.push({ url, viewport: vpn, font: font || 'shipped', hits });
        process.stdout.write('.');
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'p2ev.sku.json'), JSON.stringify(rows, null, 1));
  console.log('\n== compound SKUs painted across more than one line ==');
  for (const r of rows) for (const x of r.hits) {
    console.log(`  [${r.viewport}/${r.font}] ${r.url} :: "${x.token}" in ${x.lines} lines (widths ${JSON.stringify(x.lineWidths)}) host=${x.host} w=${x.hostWidth} fs=${x.fontSize} ctx="${x.context}"`);
  }
  console.log(`-> ${path.join(OUT, 'p2ev.sku.json')}`);
}

// ── dash ────────────────────────────────────────────────────────────────────
async function dash(browser) {
  const probe = () => {
    const scr = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth - el.clientWidth > 1;
    }).map((el) => ({
      el: el.tagName.toLowerCase(), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
      hidden: el.scrollWidth - el.clientWidth,
    }));
    const tbl = document.querySelector('table');
    const cols = tbl ? [...tbl.querySelectorAll('thead th')].map((th) => ({
      text: (th.textContent || '').trim().slice(0, 20),
      w: +th.getBoundingClientRect().width.toFixed(1),
      scrollW: th.scrollWidth, clientW: th.clientWidth,
    })) : null;
    // painted-text overlap pairs inside the table (A10-001/002's measure)
    let overlaps = 0; const samples = [];
    if (tbl) {
      const cells = [...tbl.querySelectorAll('td, th')];
      const boxes = cells.map((c) => {
        const rng = document.createRange(); rng.selectNodeContents(c);
        const rs = [...rng.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
        return { c, rs, text: (c.textContent || '').trim().slice(0, 25) };
      });
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i].c.parentElement !== boxes[j].c.parentElement) continue;
        let hit = false;
        for (const a of boxes[i].rs) for (const b of boxes[j].rs) {
          if (a.right > b.left + 0.5 && b.right > a.left + 0.5 && a.bottom > b.top + 0.5 && b.bottom > a.top + 0.5) { hit = true; break; }
        }
        if (hit) { overlaps++; if (samples.length < 5) samples.push(`"${boxes[i].text}" x "${boxes[j].text}"`); }
      }
    }
    return {
      docWidth: document.documentElement.clientWidth,
      overflowX: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
      scrollers: scr, cols, overlaps, samples,
      docHeight: document.documentElement.scrollHeight,
      hasTable: !!tbl, cardCount: document.querySelectorAll('[data-product-card]').length,
    };
  };
  const rows = [];
  for (const font of [null, LIB]) {
    for (const vpn of ['tablet-834', 'mobile-390']) {
      const [w, h] = vpn === 'mobile-390' ? [390, 844] : [834, 1112];
      const ctx = await ctxFor(browser, w, h, font, false);
      const page = await ctx.newPage();
      for (const url of ['/dashboard', '/dashboard?family=Tape', '/dashboard?family=Adhesive']) {
        await page.goto(BASE + url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        rows.push({ url, viewport: vpn, font: font || 'shipped', ...(await page.evaluate(probe)) });
      }
      if (!font && vpn === 'tablet-834') {
        await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        await shot(page, 'table', path.join(ISSUES, 'DASH834__tablet-834__dashboard-table-scroll.png'), 6);
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'p2ev.dash.json'), JSON.stringify(rows, null, 1));
  for (const r of rows) {
    console.log(`[${r.viewport}/${r.font}] ${r.url}: hasTable=${r.hasTable} docOverflowX=${r.overflowX} scrollers=${JSON.stringify(r.scrollers)} overlaps=${r.overlaps} ${JSON.stringify(r.samples)}`);
    if (r.cols) console.log(`   cols: ${r.cols.map((c) => `${c.text}=${c.w}`).join(' | ')}`);
  }
  console.log(`-> ${path.join(OUT, 'p2ev.dash.json')}`);
}

// ── chips ───────────────────────────────────────────────────────────────────
async function chips(browser) {
  const probe = () => {
    const strips = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth - el.clientWidth > 1;
    });
    return strips.map((el) => {
      const r = el.getBoundingClientRect();
      const kids = [...el.querySelectorAll('button, a')].map((c) => {
        const cr = c.getBoundingClientRect();
        return {
          text: (c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
          w: +cr.width.toFixed(1), h: +cr.height.toFixed(1),
          left: +cr.left.toFixed(1), right: +cr.right.toFixed(1),
          visible: cr.left >= r.left - 0.5 && cr.right <= r.right + 0.5,
        };
      });
      const cs = getComputedStyle(el);
      return {
        el: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
        clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, hidden: el.scrollWidth - el.clientWidth,
        scrollbarWidth: cs.scrollbarWidth, scrollbarColor: cs.scrollbarColor,
        // the actual painted scrollbar gutter height for a horizontal scroller
        gutter: el.offsetHeight - el.clientHeight,
        total: kids.length, visibleCount: kids.filter((k) => k.visible).length,
        hiddenNames: kids.filter((k) => !k.visible).map((k) => k.text),
        tiny: kids.filter((k) => k.w < 24 || k.h < 24).map((k) => `${k.w}x${k.h} "${k.text}"`),
      };
    });
  };
  const rows = [];
  for (const vpn of ['tablet-834', 'mobile-390']) {
    const [w, h] = vpn === 'mobile-390' ? [390, 844] : [834, 1112];
    const ctx = await ctxFor(browser, w, h, null, true);
    const page = await ctx.newPage();
    for (const url of ['/faq', '/products', '/products?productId=CC']) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const before = await page.evaluate(probe);
      // can it be scrolled to the end, and is the pinned C41 control still there?
      const after = await page.evaluate(() => {
        const strips = [...document.querySelectorAll('body *')].filter((el) => {
          const cs = getComputedStyle(el);
          return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth - el.clientWidth > 1;
        });
        return strips.map((el) => {
          el.scrollLeft = el.scrollWidth;
          const r = el.getBoundingClientRect();
          const kids = [...el.querySelectorAll('button,a')];
          const last = kids[kids.length - 1];
          const lr = last ? last.getBoundingClientRect() : null;
          return {
            scrolledTo: Math.round(el.scrollLeft),
            lastText: last ? (last.textContent || '').trim().slice(0, 30) : null,
            lastVisible: lr ? (lr.left >= r.left - 1 && lr.right <= r.right + 1) : null,
          };
        });
      });
      rows.push({ url, viewport: vpn, before, after });
      if (url === '/faq') await shot(page, 'div.flex.gap-3.overflow-x-auto', path.join(ISSUES, `CHIPS__${vpn}__faq-chip-scroller.png`), 8);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'p2ev.chips.json'), JSON.stringify(rows, null, 1));
  for (const r of rows) {
    console.log(`\n[${r.viewport}] ${r.url}`);
    r.before.forEach((b, i) => console.log(`   ${b.el}: cw=${b.clientWidth} sw=${b.scrollWidth} hidden=${b.hidden} gutter=${b.gutter}px items=${b.visibleCount}/${b.total} tiny=${JSON.stringify(b.tiny)} hiddenNames=${JSON.stringify(b.hiddenNames)} | afterScroll ${JSON.stringify(r.after[i])}`));
  }
  console.log(`-> ${path.join(OUT, 'p2ev.chips.json')}`);
}

(async () => {
  const which = process.argv[2] || 'all';
  fs.mkdirSync(ISSUES, { recursive: true });
  const browser = await launch();
  try {
    if (which === 'all' || which === 'h1') await h1(browser);
    if (which === 'all' || which === 'sticky') await sticky(browser);
    if (which === 'all' || which === 'sku') await sku(browser);
    if (which === 'all' || which === 'dash') await dash(browser);
    if (which === 'all' || which === 'chips') await chips(browser);
  } finally { await browser.close(); }
})();
