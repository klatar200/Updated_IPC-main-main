/**
 * AUDIT-10 pass-1 issue-evidence capture.
 *
 * Scrolls a named region into view at a named viewport and writes an
 * element-scoped PNG to _harness/out/audit10/issues/, which is where
 * findings.schema.json's evidence.issue_screenshot points. Screenshots are
 * gitignored and die with the container — the numbers in the finding record
 * are the durable evidence — but pass-7 re-reads these while the container
 * lives, so they are captured properly rather than cropped by eye.
 *
 * Shots are declared in SHOTS below so one run produces the whole set and the
 * exact selector for every finding stays in a tracked file.
 *
 * Usage: node _harness/audit10-p1evidence.js [idFilter]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ISSUES = path.join(__dirname, 'out', 'audit10', 'issues');
const VPS = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-1024': { width: 1024, height: 768 },
};

// id · url · viewport · how to find the element · slug
const SHOTS = [
  // A10-001 — /dashboard part-type pill paints over the Description column
  ['A10-001', '/dashboard', 'desktop-1440',
    () => {
      const tr = [...document.querySelectorAll('tbody tr')]
        .find((r) => /POLYOLEFIN HEAT SHRINK/i.test(r.textContent || ''));
      return tr || null;
    }, 'dashboard-parttype-pill-over-description'],
  ['A10-001', '/dashboard', 'tablet-1024',
    () => {
      const tb = document.querySelector('table');
      return tb || null;
    }, 'dashboard-table'],

  // A10-002 — /dashboard Description column collapses at 1024
  ['A10-002', '/dashboard', 'tablet-1024',
    () => document.querySelector('thead tr'), 'dashboard-header-overprint'],
  ['A10-002', '/dashboard', 'tablet-1024',
    () => document.querySelectorAll('tbody tr')[0] || null, 'dashboard-first-row'],

  // A10-003 — product-detail photo cell is a bordered empty column
  ['A10-003', '/products?productId=IP75AD', 'desktop-1440',
    () => {
      const p = document.querySelector('[data-ipc-photo-box]');
      return p ? p.closest('div[class*="p-5"]').parentElement : null;
    }, 'IP75AD-photo-cell-void'],
  ['A10-003', '/products?productId=IP75AD', 'tablet-1024',
    () => {
      const p = document.querySelector('[data-ipc-photo-box]');
      return p ? p.closest('div[class*="p-5"]').parentElement : null;
    }, 'IP75AD-photo-cell-void'],

  // A10-004 — SpecTable1 panel stretched to the table's height
  ['A10-004', '/products?productId=IP38FE', 'desktop-1440',
    () => {
      for (const el of document.querySelectorAll('div.rounded-xl')) {
        if (el.querySelector('.divide-y') && !el.querySelector('table')) return el.parentElement.parentElement;
      }
      return null;
    }, 'IP38FE-spec-panel-void'],
  ['A10-004', '/products?productId=IP64FS-IP65VC-IP66AC-IP67SC', 'tablet-1024',
    () => {
      for (const el of document.querySelectorAll('div.rounded-xl')) {
        if (el.querySelector('.divide-y') && !el.querySelector('table')) return el.parentElement.parentElement;
      }
      return null;
    }, 'IP64FS-spec-panel-void'],

  // A10-005 — catalog rail never scrolls to the active product
  ['A10-005', '/products?productId=IP25PU', 'desktop-1440',
    () => document.querySelector('aside'), 'sidebar-active-below-fold'],
  ['A10-005', '/products?productId=IP25PU', 'tablet-1024',
    () => document.querySelector('aside'), 'sidebar-active-below-fold'],

  // A10-006 — spec table scrolls horizontally at 1024
  ['A10-006', '/products?productId=IP17TW-18SW-19LW', 'tablet-1024',
    () => {
      for (const el of document.querySelectorAll('div')) {
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'auto' && el.querySelector('table')) return el;
      }
      return null;
    }, 'IP17TW-spec-table-clipped'],

  // A10-007 — FAQ category chip row clipped
  ['A10-007', '/faq', 'desktop-1440',
    () => document.querySelector('div.flex.gap-3.overflow-x-auto')
      ? document.querySelector('div.flex.gap-3.overflow-x-auto').parentElement : null,
    'faq-chip-row-clipped'],
  ['A10-007', '/faq', 'tablet-1024',
    () => document.querySelector('div.flex.gap-3.overflow-x-auto')
      ? document.querySelector('div.flex.gap-3.overflow-x-auto').parentElement : null,
    'faq-chip-row-clipped'],

  // A10-008 — contact email card overflow
  ['A10-008', '/contact', 'tablet-1024',
    () => {
      for (const el of document.querySelectorAll('a,div')) {
        const t = (el.textContent || '').trim();
        if (/^sales@/.test(t) && el.children.length === 0) {
          return el.closest('div[style*="border"]') || el.parentElement;
        }
      }
      return null;
    }, 'contact-email-card'],

  // A10-009 — related-products row leaves an empty 4th cell
  ['A10-009', '/products?productId=IP42MW', 'desktop-1440',
    () => {
      for (const el of document.querySelectorAll('div')) {
        if (/^Related Products/i.test((el.textContent || '').trim()) && el.children.length === 0) {
          return el.parentElement;
        }
      }
      return null;
    }, 'related-row-orphan-cell'],

  // A10-010 — empty bordered spec cells
  ['A10-010', '/products?productId=IP25PU', 'desktop-1440',
    () => {
      for (const el of document.querySelectorAll('div')) {
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'auto' && el.querySelector('table')) return el;
      }
      return null;
    }, 'IP25PU-empty-spec-cells'],
];

(async () => {
  const filter = process.argv[2] || null;
  fs.mkdirSync(ISSUES, { recursive: true });
  const browser = await launch();
  for (const [id, url, vpName, finder, slug] of SHOTS) {
    if (filter && id !== filter) continue;
    const ctx = await browser.newContext({ viewport: VPS[vpName] });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(500);
      const handle = await page.evaluateHandle(finder);
      const el = handle.asElement();
      const out = path.join(ISSUES, `${id}__${vpName}__${slug}.png`);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await el.screenshot({ path: out });
        console.log('ok  ' + path.basename(out));
      } else {
        await page.screenshot({ path: out, fullPage: true });
        console.log('FULLPAGE FALLBACK (selector missed) ' + path.basename(out));
      }
    } catch (e) {
      console.log('ERR ' + id + ' ' + vpName + ' :: ' + String(e).slice(0, 160));
    }
    await ctx.close();
  }
  await browser.close();
  console.log('-> _harness/out/audit10/issues/');
})();
