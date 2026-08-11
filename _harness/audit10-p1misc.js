/**
 * AUDIT-10 pass-1 targeted verification of the remaining screenshot leads.
 *
 * Each block turns one reviewer impression into a number, at both large
 * viewports, over two separate navigations (guardrails `twice_means_twice`).
 *
 *   navActive     which navbar item carries the active treatment, per page
 *   faqChips      the /faq category chip scroller: hidden px + which chip is cut
 *   contactCards  /contact left-rail cards: does any value paint past its card
 *   dashSearch    /dashboard search input: placeholder width vs field width
 *   familyFilter  /dashboard?family=… : chips rendered, chip matched, row count
 *   homeBand      the PLAN-9 two-figure band: figure boxes, image boxes,
 *                 letterboxing (painted image vs its frame), bottom-edge delta
 *   industryCards /industries cards: trailing empty space inside each card
 *   relatedGrid   product related-products row: declared columns vs cards
 *
 * Output: _harness/out/audit10/p1misc.json  (gitignored)
 * Usage:  node _harness/audit10-p1misc.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
];

/* eslint-disable no-undef */
const R = 'const R=(n)=>Math.round(n*10)/10;';

function navActive() {
  const R2 = (n) => Math.round(n * 10) / 10;
  const header = document.querySelector('header');
  const items = [...header.querySelectorAll('a,button')].map((el) => {
    const cs = getComputedStyle(el);
    return {
      t: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
      color: cs.color,
      borderBottom: cs.borderBottomWidth + ' ' + cs.borderBottomColor,
      w: R2(el.getBoundingClientRect().width),
    };
  });
  const active = items.filter((i) => parseFloat(i.borderBottom) >= 2);
  return { items, activeCount: active.length, active: active.map((a) => a.t) };
}

function faqChips() {
  const R2 = (n) => Math.round(n * 10) / 10;
  const box = document.querySelector('div.flex.gap-3.overflow-x-auto');
  if (!box) return { missing: true };
  const r = box.getBoundingClientRect();
  const chips = [...box.children].map((c) => {
    const cr = c.getBoundingClientRect();
    return {
      t: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
      x: R2(cr.left), right: R2(cr.right), w: R2(cr.width),
      hiddenPx: R2(Math.max(0, cr.right - r.right)),
    };
  });
  return {
    boxW: R2(r.width), scrollW: R2(box.scrollWidth), hiddenPx: R2(box.scrollWidth - box.clientWidth),
    chipCount: chips.length, chipsCut: chips.filter((c) => c.hiddenPx > 0.5),
    lastFullyVisible: chips.filter((c) => c.hiddenPx <= 0.5).length,
    nextSibling: box.nextElementSibling
      ? (box.nextElementSibling.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) : null,
  };
}

function contactCards() {
  const R2 = (n) => Math.round(n * 10) / 10;
  const out = [];
  const rng = document.createRange();
  for (const el of document.querySelectorAll('div,a,p,span')) {
    const cs = getComputedStyle(el);
    if (parseFloat(cs.borderTopWidth) < 1) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.height < 40 || r.width > 700) continue;
    let maxRight = r.left;
    let who = '';
    for (const n of el.querySelectorAll('*')) {
      for (const t of n.childNodes) {
        if (t.nodeType !== 3 || !t.textContent.trim()) continue;
        rng.selectNodeContents(t);
        for (const b of rng.getClientRects()) {
          if (b.width < 1) continue;
          if (b.right > maxRight) { maxRight = b.right; who = t.textContent.trim().slice(0, 40); }
        }
      }
    }
    const padR = parseFloat(cs.paddingRight) || 0;
    const over = maxRight - (r.right - padR - parseFloat(cs.borderRightWidth || 0));
    if (over > 0.5) {
      out.push({
        cardW: R2(r.width), y: R2(r.top + window.scrollY),
        overflowPastPadding: R2(over),
        overflowPastBorder: R2(maxRight - r.right),
        text: who,
      });
    }
  }
  return out.slice(0, 10);
}

function dashSearch() {
  const R2 = (n) => Math.round(n * 10) / 10;
  const inp = document.querySelector('input[type="text"], input:not([type])');
  if (!inp) return { missing: true };
  const r = inp.getBoundingClientRect();
  const cs = getComputedStyle(inp);
  const ph = inp.getAttribute('placeholder') || '';
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const need = cv.measureText(ph).width;
  const avail = r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  return {
    fieldW: R2(r.width), availW: R2(avail), placeholder: ph,
    placeholderW: R2(need), cutPx: R2(Math.max(0, need - avail)),
  };
}

function familyFilter() {
  const R2 = (n) => Math.round(n * 10) / 10;
  const chips = [...document.querySelectorAll('button')]
    .filter((b) => {
      const r = b.getBoundingClientRect();
      return r.height > 20 && r.height < 46 && r.top < 700 && /^[A-Za-z0-9 &/\-.]+$/.test((b.textContent || '').trim());
    })
    .map((b) => ({
      t: (b.textContent || '').trim().slice(0, 30),
      bg: getComputedStyle(b).backgroundColor,
      color: getComputedStyle(b).color,
    }));
  const rows = document.querySelectorAll('tbody tr').length;
  const body = (document.body.textContent || '').replace(/\s+/g, ' ');
  const showing = (body.match(/Showing[^.]{0,40}/) || [''])[0];
  const noRes = /No products found|No results/.test(body);
  return {
    chipCount: chips.length, chips: chips.map((c) => c.t),
    rows, showing, noResults: noRes,
    tableHeaderPresent: !!document.querySelector('thead'),
    headerCells: document.querySelectorAll('thead th').length,
  };
}

function homeBand() {
  const R2 = (n) => Math.round(n * 10) / 10;
  const figs = [...document.querySelectorAll('figure')];
  if (!figs.length) return { missing: true };
  return figs.map((f) => {
    const fr = f.getBoundingClientRect();
    const img = f.querySelector('img');
    const ir = img ? img.getBoundingClientRect() : null;
    const cs = img ? getComputedStyle(img) : null;
    return {
      figW: R2(fr.width), figH: R2(fr.height), figY: R2(fr.top + window.scrollY),
      figBottom: R2(fr.bottom + window.scrollY),
      imgW: ir ? R2(ir.width) : null, imgH: ir ? R2(ir.height) : null,
      gapLeft: ir ? R2(ir.left - fr.left) : null,
      gapRight: ir ? R2(fr.right - ir.right) : null,
      gapTop: ir ? R2(ir.top - fr.top) : null,
      gapBottom: ir ? R2(fr.bottom - ir.bottom) : null,
      fit: cs ? cs.objectFit : null, ratio: cs ? cs.aspectRatio : null,
      nat: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
      natRatio: img && img.naturalHeight ? R2(img.naturalWidth / img.naturalHeight) : null,
      paintRatio: ir && ir.height ? R2(ir.width / ir.height) : null,
      upscale: img && img.naturalWidth ? R2((ir.width / img.naturalWidth) * 100) / 100 : null,
      alt: img ? img.getAttribute('alt') : null,
      captions: f.querySelectorAll('figcaption').length,
    };
  });
}

function industryCards() {
  const R2 = (n) => Math.round(n * 10) / 10;
  const out = [];
  for (const el of document.querySelectorAll('div')) {
    const cs = getComputedStyle(el);
    if (cs.display !== 'grid') continue;
    const kids = [...el.children];
    if (kids.length < 2) continue;
    const tops = kids.map((k) => k.getBoundingClientRect().top);
    if (Math.max(...tops) - Math.min(...tops) > 2) continue;
    for (const k of kids) {
      const kr = k.getBoundingClientRect();
      if (kr.height < 80) continue;
      let bottom = kr.top;
      for (const n of k.querySelectorAll('*')) {
        const nr = n.getBoundingClientRect();
        if (nr.height > 0 && nr.bottom > bottom) bottom = nr.bottom;
      }
      const padB = parseFloat(getComputedStyle(k).paddingBottom) || 0;
      const gap = kr.bottom - padB - bottom;
      if (gap > 40 && out.length < 20) {
        out.push({
          w: R2(kr.width), h: R2(kr.height), trailingGap: R2(gap),
          y: R2(kr.top + window.scrollY),
          text: (k.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        });
      }
    }
  }
  return out;
}
/* eslint-enable no-undef */

const JOBS = [
  ['/', 'homeBand', homeBand],
  ['/faq', 'faqChips', faqChips],
  ['/contact', 'contactCards', contactCards],
  ['/dashboard', 'dashSearch', dashSearch],
  ['/dashboard', 'familyFilter', familyFilter],
  ['/dashboard?family=' + encodeURIComponent('Heat Shrink Tubing'), 'familyFilter', familyFilter],
  ['/dashboard?family=Tape', 'familyFilter', familyFilter],
  ['/industries', 'industryCards', industryCards],
  ['/', 'navActive', navActive],
  ['/products', 'navActive', navActive],
  ['/dashboard', 'navActive', navActive],
  ['/datasheets', 'navActive', navActive],
  ['/contact', 'navActive', navActive],
  ['/about', 'navActive', navActive],
  ['/faq', 'navActive', navActive],
  ['/services', 'navActive', navActive],
  ['/industries', 'navActive', navActive],
  ['/privacy', 'navActive', navActive],
  ['/products?productId=CC', 'navActive', navActive],
];

(async () => {
  const browser = await launch();
  const runs = [[], []];
  for (let pass = 0; pass < 2; pass++) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      for (const [url, name, fn] of JOBS) {
        try {
          await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
          await page.waitForTimeout(400);
          runs[pass].push({ url, viewport: vp.name, probe: name, result: await page.evaluate(fn) });
        } catch (e) {
          runs[pass].push({ url, viewport: vp.name, probe: name, error: String(e).slice(0, 160) });
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  const same = JSON.stringify(runs[0]) === JSON.stringify(runs[1]);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p1misc.json'), JSON.stringify({ identicalAcrossRuns: same, run1: runs[0], run2: runs[1] }, null, 1));
  console.log('identical across two navigations: ' + same);
  console.log('-> _harness/out/audit10/p1misc.json');
})();
