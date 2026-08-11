/**
 * AUDIT-10 pass-1 product-page measurement probe.
 *
 * Three claims from the screenshot review, turned into numbers over all 42
 * product pages at desktop-1440 and tablet-1024:
 *
 *  1. bodyTail / specTail — the product-detail card is built from two
 *     `grid md:grid-cols-2` rows whose cells default to align-items:stretch and
 *     carry `md:border-r`. When one cell's content is much shorter than its
 *     neighbour's, the short cell keeps the full row height and the divider
 *     keeps drawing, so the page shows a BORDERED EMPTY REGION. This measures
 *     that region: cell height minus (content bottom + padding-bottom).
 *
 *  2. sidebar — the catalog rail is a fixed-height scroll box. Measures
 *     scrollHeight vs clientHeight, and whether the ACTIVE item (the row for
 *     the product being viewed) is inside the visible window at rest.
 *
 *  3. related — the related-products row is `md:grid-cols-4`. Measures how many
 *     cards it actually holds and how much of the row's track is unused.
 *
 * Output: _harness/out/audit10/p1product.json   (gitignored)
 * Usage:  node _harness/audit10-p1product.js
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
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
];

/* eslint-disable no-undef */
function measure() {
  const R = (n) => Math.round(n * 10) / 10;
  const out = { grids: [], sidebar: null, related: null, photo: null };

  // The detail card: the outer .bg-white.rounded-2xl holding the navy header.
  const card = document.querySelector('[data-ipc-photo-box]')
    ? document.querySelector('[data-ipc-photo-box]').closest('.rounded-2xl')
    : null;
  if (card) {
    // Every direct-child grid of the card with exactly 2 in-flow cells.
    for (const g of card.children) {
      const cs = getComputedStyle(g);
      if (cs.display !== 'grid') continue;
      const cells = [...g.children];
      if (cells.length !== 2) continue;
      const gr = g.getBoundingClientRect();
      const info = { gridH: R(gr.height), cells: [] };
      for (const c of cells) {
        const ccs = getComputedStyle(c);
        const cr = c.getBoundingClientRect();
        let contentBottom = cr.top;
        for (const k of c.querySelectorAll('*')) {
          const kr = k.getBoundingClientRect();
          if (kr.height > 0 && kr.bottom > contentBottom) contentBottom = kr.bottom;
        }
        const padB = parseFloat(ccs.paddingBottom) || 0;
        info.cells.push({
          w: R(cr.width), h: R(cr.height),
          contentH: R(contentBottom - cr.top),
          padB: R(padB),
          emptyTail: R(cr.bottom - contentBottom - padB),
          borderRight: ccs.borderRightWidth + ' ' + ccs.borderRightColor,
          firstText: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        });
      }
      out.grids.push(info);
    }
  }

  // Sidebar rail: the scrollable catalog list.
  {
    const aside = document.querySelector('aside');
    let box = null;
    if (aside) {
      for (const el of aside.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > 0) {
          const r = el.getBoundingClientRect();
          if (r.height > 100) { box = el; break; }
        }
      }
    }
    if (box) {
      const r = box.getBoundingClientRect();
      // the active row: the one whose aria-current is set, else the one whose
      // accent bar / background marks it. Fall back to matching the h1 text.
      const h1 = document.querySelector('h1');
      const want = h1 ? h1.textContent.trim() : null;
      let active = box.querySelector('[aria-current]');
      if (!active && want) {
        for (const b of box.querySelectorAll('button,a')) {
          if ((b.textContent || '').replace(/\s+/g, ' ').includes(want)) { active = b; break; }
        }
      }
      let activeInfo = null;
      if (active) {
        const ar = active.getBoundingClientRect();
        activeInfo = {
          text: (active.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50),
          offsetTopInBox: R(ar.top - r.top + box.scrollTop),
          visibleTop: R(ar.top - r.top),
          h: R(ar.height),
          fullyVisible: ar.top >= r.top - 0.5 && ar.bottom <= r.bottom + 0.5,
          partiallyVisible: ar.bottom > r.top && ar.top < r.bottom,
          clippedPx: R(Math.max(0, ar.bottom - r.bottom) + Math.max(0, r.top - ar.top)),
        };
      }
      out.sidebar = {
        clientH: R(box.clientHeight), scrollH: R(box.scrollHeight),
        scrollTop: R(box.scrollTop),
        hiddenPx: R(box.scrollHeight - box.clientHeight),
        maxH: getComputedStyle(box).maxHeight,
        rowsTotal: box.querySelectorAll('button,a').length,
        active: activeInfo,
        // a row straddling the bottom edge = a glyph sliced in half
        rowsSlicedByBottomEdge: [...box.querySelectorAll('button,a')].filter((b) => {
          const br = b.getBoundingClientRect();
          return br.top < r.bottom - 0.5 && br.bottom > r.bottom + 0.5;
        }).map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
      };
    }
  }

  // Related-products grid.
  {
    let grid = null;
    for (const h of document.querySelectorAll('div')) {
      if (/^Related Products/i.test((h.textContent || '').trim()) && h.children.length === 0) {
        grid = h.parentElement.querySelector('.grid') || h.nextElementSibling;
        break;
      }
    }
    if (grid) {
      const gr = grid.getBoundingClientRect();
      const cs = getComputedStyle(grid);
      const cards = [...grid.children].map((c) => {
        const r = c.getBoundingClientRect();
        return { w: R(r.width), h: R(r.height), x: R(r.left), y: R(r.top) };
      });
      const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
      const used = cards.length ? R(Math.max(...cards.map((c) => c.x + c.w)) - gr.left) : 0;
      out.related = {
        cols, n: cards.length, gridW: R(gr.width), usedW: used,
        unusedW: R(gr.width - used),
        hSpread: cards.length ? R(Math.max(...cards.map((c) => c.h)) - Math.min(...cards.map((c) => c.h))) : 0,
        heights: cards.map((c) => c.h),
      };
    }
  }

  // Photo box.
  {
    const p = document.querySelector('[data-ipc-photo-box]');
    if (p) {
      const r = p.getBoundingClientRect();
      const cs = getComputedStyle(p);
      out.photo = {
        tag: p.tagName, w: R(r.width), h: R(r.height),
        ratio: R(r.width / r.height), aspectRatio: cs.aspectRatio, fit: cs.objectFit,
        nw: p.naturalWidth || null, nh: p.naturalHeight || null,
        natRatio: p.naturalWidth ? R(p.naturalWidth / p.naturalHeight) : null,
        upscale: p.naturalWidth ? R((r.width / p.naturalWidth) * 100) / 100 : null,
      };
    }
  }
  return out;
}
/* eslint-enable no-undef */

(async () => {
  const browser = await launch();
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const p of products) {
      const url = '/products?productId=' + encodeURIComponent(p.id);
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(400);
        rows.push({ id: p.id, url, viewport: vp.name, ...(await page.evaluate(measure)) });
      } catch (e) {
        rows.push({ id: p.id, url, viewport: vp.name, error: String(e).slice(0, 200) });
      }
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(' ' + vp.name + ' done');
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p1product.json'), JSON.stringify(rows, null, 1));
  console.log('rows: ' + rows.length + ' -> _harness/out/audit10/p1product.json');
})();
