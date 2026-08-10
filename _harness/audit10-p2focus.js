/**
 * AUDIT-10 pass-2 — the focused re-measurements for the leads the screenshot
 * reviewers and the sweeps raised. Every section measures at the exact URL and
 * viewport and prints the numbers a finding record needs.
 *
 *   form      /contact: where does an empty submit put the first invalid field
 *             relative to the sticky navbar? (the site uses native constraint
 *             validation; scroll-margin-top is set elsewhere in the file for
 *             exactly this hazard, src/App.jsx:10412)
 *   footer    the md:grid-cols-4 footer at 834 — column widths, wrapped links
 *   related   related-product card equality at 834/390
 *   rfq       the "Request Quote" control's chrome and hit box next to the
 *             filled "Download PDF" pill
 *   rows      DOM-vs-painted order for the two containers p2stack flagged
 *   crumb     the breadcrumb at 834 on the longest product name
 *   rail      the ipc-scroll-sm family strip: what is reachable, is there a cue
 *
 * Usage: node _harness/audit10-p2focus.js <section>   (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const ISSUES = path.join(OUT, 'issues');
const LIB = 'Liberation Sans';
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));

async function ctxFor(browser, w, h, font, touch = true) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  if (font) {
    await ctx.addInitScript((f) => {
      const apply = () => { const s = document.createElement('style'); s.textContent = `*,*::before,*::after{font-family:"${f}"!important}`; document.head.appendChild(s); };
      if (document.head) apply(); else document.addEventListener('DOMContentLoaded', apply);
    }, font);
  }
  return ctx;
}
const VPS = [{ n: 'tablet-834', w: 834, h: 1112 }, { n: 'mobile-390', w: 390, h: 844 }];

// ── form ────────────────────────────────────────────────────────────────────
async function form(browser) {
  const rows = [];
  for (const pass of [1, 2]) {                    // twice => CONFIRMED
    for (const vp of VPS) {
      const ctx = await ctxFor(browser, vp.w, vp.h, null, true);
      const page = await ctx.newPage();
      await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const chrome = await page.evaluate(() => {
        const h = document.querySelector('header');
        const r = h ? h.getBoundingClientRect() : null;
        return { headerH: r ? +r.height.toFixed(1) : null, headerPos: h ? getComputedStyle(h).position : null, headerTop: r ? +r.top.toFixed(1) : null, headerZ: h ? getComputedStyle(h).zIndex : null };
      });
      await page.click('form button[type="submit"], form input[type="submit"]').catch(() => {});
      await page.waitForTimeout(1000);
      const after = await page.evaluate(() => {
        const a = document.activeElement;
        const h = document.querySelector('header');
        const hr = h ? h.getBoundingClientRect() : null;
        const ar = a ? a.getBoundingClientRect() : null;
        const lab = a && a.labels && a.labels.length ? a.labels[0] : null;
        const lr = lab ? lab.getBoundingClientRect() : null;
        const coveredPx = (ar && hr) ? Math.max(0, Math.min(ar.bottom, hr.bottom) - Math.max(ar.top, hr.top)) : 0;
        const labCoveredPx = (lr && hr) ? Math.max(0, Math.min(lr.bottom, hr.bottom) - Math.max(lr.top, hr.top)) : 0;
        return {
          scrollY: Math.round(window.scrollY),
          active: a ? `${a.tagName.toLowerCase()}[name=${a.name || ''}]` : null,
          validity: a && a.validity ? { valueMissing: a.validity.valueMissing, valid: a.validity.valid } : null,
          validationMessage: a ? a.validationMessage : null,
          fieldRect: ar ? { top: +ar.top.toFixed(1), bottom: +ar.bottom.toFixed(1), h: +ar.height.toFixed(1) } : null,
          labelText: lab ? lab.textContent.trim().slice(0, 30) : null,
          labelRect: lr ? { top: +lr.top.toFixed(1), bottom: +lr.bottom.toFixed(1) } : null,
          headerRect: hr ? { top: +hr.top.toFixed(1), bottom: +hr.bottom.toFixed(1), h: +hr.height.toFixed(1) } : null,
          fieldPxUnderHeader: +coveredPx.toFixed(1),
          labelPxUnderHeader: +labCoveredPx.toFixed(1),
          fieldFullyUnderHeader: ar && hr ? (ar.bottom <= hr.bottom + 0.5) : null,
          scrollMarginTop: a ? getComputedStyle(a).scrollMarginTop : null,
          formNoValidate: (() => { const f = document.querySelector('form'); return f ? f.noValidate : null; })(),
        };
      });
      if (pass === 1) {
        fs.mkdirSync(ISSUES, { recursive: true });
        await page.screenshot({ path: path.join(ISSUES, `FORMFOCUS__${vp.n}__contact-after-empty-submit.png`) });
      }
      rows.push({ pass, viewport: vp.n, chrome, after });
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'p2f.form.json'), JSON.stringify(rows, null, 1));
  for (const r of rows) {
    console.log(`[pass ${r.pass}] ${r.viewport}: header ${JSON.stringify(r.chrome)}`);
    console.log(`   after empty submit: scrollY=${r.after.scrollY} active=${r.after.active} valueMissing=${r.after.validity && r.after.validity.valueMissing} msg=${JSON.stringify(r.after.validationMessage)}`);
    console.log(`   field ${JSON.stringify(r.after.fieldRect)} vs header ${JSON.stringify(r.after.headerRect)} -> ${r.after.fieldPxUnderHeader}px of the field is under the header (fully hidden: ${r.after.fieldFullyUnderHeader})`);
    console.log(`   its label "${r.after.labelText}" ${JSON.stringify(r.after.labelRect)} -> ${r.after.labelPxUnderHeader}px under the header; scroll-margin-top=${r.after.scrollMarginTop}; form.noValidate=${r.after.formNoValidate}`);
  }
}

// ── footer ──────────────────────────────────────────────────────────────────
async function footer(browser) {
  const probe = () => {
    const f = document.querySelector('footer');
    if (!f) return null;
    const grid = f.querySelector('div.grid');
    const gr = grid ? grid.getBoundingClientRect() : null;
    const cols = grid ? [...grid.children].map((c) => {
      const r = c.getBoundingClientRect();
      const links = [...c.querySelectorAll('a')].map((a) => {
        const ar = a.getBoundingClientRect();
        const rng = document.createRange(); rng.selectNodeContents(a);
        return {
          text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28),
          w: +ar.width.toFixed(1), h: +ar.height.toFixed(1),
          lines: [...rng.getClientRects()].filter((x) => x.width > 0).length,
        };
      });
      return {
        heading: (c.querySelector('h2,h3,h4,div') || {}).textContent ? (c.querySelector('h2,h3,h4,div').textContent || '').trim().slice(0, 24) : '',
        top: +r.top.toFixed(1), left: +r.left.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        links, wrappedLinks: links.filter((l) => l.lines > 1).map((l) => l.text),
      };
    }) : null;
    // the two-up sub-columns inside Quick Links
    const inner = grid ? [...grid.querySelectorAll('div.grid, ul.grid')].map((g) => {
      const r = g.getBoundingClientRect();
      return { cls: (typeof g.className === 'string' ? g.className : '').slice(0, 60), w: +r.width.toFixed(1), tpl: getComputedStyle(g).gridTemplateColumns };
    }) : [];
    return {
      gridClass: grid ? (typeof grid.className === 'string' ? grid.className : '') : null,
      gridTemplateColumns: grid ? getComputedStyle(grid).gridTemplateColumns : null,
      gridWidth: gr ? +gr.width.toFixed(1) : null,
      cols, inner,
      social: [...f.querySelectorAll('.ipc-social-link')].map((s) => { const r = s.getBoundingClientRect(); return `${+r.width.toFixed(1)}x${+r.height.toFixed(1)}`; }),
      footerH: +f.getBoundingClientRect().height.toFixed(1),
    };
  };
  const rows = [];
  for (const font of [null, LIB]) for (const vp of [{ n: 'tablet-834', w: 834, h: 1112 }, { n: 'mobile-390', w: 390, h: 844 }, { n: 'tablet-1024', w: 1024, h: 768 }, { n: 'desktop-1440', w: 1440, h: 900 }]) {
    const ctx = await ctxFor(browser, vp.w, vp.h, font, false);
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    rows.push({ viewport: vp.n, font: font || 'shipped', ...(await page.evaluate(probe)) });
    if (!font && vp.n === 'tablet-834') { fs.mkdirSync(ISSUES, { recursive: true }); await page.screenshot({ path: path.join(ISSUES, 'FOOTER834__tablet-834__footer-grid.png') }); }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'p2f.footer.json'), JSON.stringify(rows, null, 1));
  for (const r of rows) {
    console.log(`\n[${r.viewport}/${r.font}] grid="${r.gridClass}" tpl=${r.gridTemplateColumns} w=${r.gridWidth} footerH=${r.footerH} social=${JSON.stringify(r.social)}`);
    (r.cols || []).forEach((c, i) => console.log(`   col${i} top=${c.top} left=${c.left} w=${c.w} links=${c.links.length} wrapped=${JSON.stringify(c.wrappedLinks)}`));
    console.log(`   inner grids: ${JSON.stringify(r.inner)}`);
  }
}

// ── related ─────────────────────────────────────────────────────────────────
async function related(browser) {
  const probe = () => {
    const heads = [...document.querySelectorAll('h2,h3,h4')].filter((h) => /related/i.test(h.textContent || ''));
    if (!heads.length) return { present: false };
    const sec = heads[0].parentElement;
    const grid = sec.querySelector('div.grid') || [...sec.querySelectorAll('div')].find((d) => /grid/.test(getComputedStyle(d).display));
    if (!grid) return { present: true, grid: false };
    const kids = [...grid.children].map((c) => { const r = c.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), top: +r.top.toFixed(1), text: (c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), clamped: /…|\.\.\.$/.test((c.textContent || '').trim()) }; });
    const rowsMap = new Map();
    for (const k of kids) { const key = Math.round(k.top / 8); rowsMap.set(key, [...(rowsMap.get(key) || []), k]); }
    const spreads = [...rowsMap.values()].map((row) => ({
      n: row.length,
      wSpread: +(Math.max(...row.map((x) => x.w)) - Math.min(...row.map((x) => x.w))).toFixed(1),
      hSpread: +(Math.max(...row.map((x) => x.h)) - Math.min(...row.map((x) => x.h))).toFixed(1),
    }));
    return {
      present: true, grid: true, cards: kids.length,
      tpl: getComputedStyle(grid).gridTemplateColumns,
      alignItems: getComputedStyle(grid).alignItems,
      spreads, clamped: kids.filter((k) => k.clamped).map((k) => k.text),
      cards_detail: kids,
    };
  };
  const rows = [];
  for (const vp of VPS) {
    const ctx = await ctxFor(browser, vp.w, vp.h, null, false);
    const page = await ctx.newPage();
    for (const p of products) {
      const url = '/products?productId=' + encodeURIComponent(p.id);
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      rows.push({ id: p.id, viewport: vp.n, ...(await page.evaluate(probe)) });
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(` ${vp.n} done`);
  }
  fs.writeFileSync(path.join(OUT, 'p2f.related.json'), JSON.stringify(rows, null, 1));
  for (const vp of VPS) {
    const sub = rows.filter((r) => r.viewport === vp.n);
    const absent = sub.filter((r) => !r.present);
    const uneven = sub.filter((r) => (r.spreads || []).some((s) => s.hSpread > 1 || s.wSpread > 1));
    const clamped = sub.filter((r) => (r.clamped || []).length);
    console.log(`\n[${vp.n}] ${sub.length} product pages: ${absent.length} without a Related section, ${uneven.length} with unequal cards, ${clamped.length} with an ellipsis-clamped card name`);
    console.log(`   no Related: ${absent.map((r) => r.id).join(', ')}`);
    for (const r of uneven.slice(0, 12)) console.log(`   uneven ${r.id}: cards=${r.cards} tpl=${r.tpl} align=${r.alignItems} spreads=${JSON.stringify(r.spreads)}`);
    for (const r of clamped.slice(0, 8)) console.log(`   clamped ${r.id}: ${JSON.stringify(r.clamped)}`);
  }
}

// ── rfq ─────────────────────────────────────────────────────────────────────
async function rfq(browser) {
  const probe = () => {
    const out = [];
    for (const el of document.querySelectorAll('a, button')) {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (!/Request Quote|Download PDF|Request Data Sheet|Request a Quote/i.test(t)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1) continue;
      const cs = getComputedStyle(el);
      out.push({
        text: t.slice(0, 30), tag: el.tagName.toLowerCase(),
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        y: Math.round(r.top + window.scrollY),
        bg: cs.backgroundColor, color: cs.color, border: cs.border,
        borderRadius: cs.borderRadius, textDecoration: cs.textDecorationLine,
        padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 50),
        inFixed: (() => { let p = el; while (p) { if (getComputedStyle(p).position === 'fixed') return true; p = p.parentElement; } return false; })(),
      });
    }
    return out;
  };
  const rows = [];
  for (const vp of [...VPS, { n: 'desktop-1440', w: 1440, h: 900 }]) {
    const ctx = await ctxFor(browser, vp.w, vp.h, null, vp.n !== 'desktop-1440');
    const page = await ctx.newPage();
    for (const id of ['IP33PO', 'IP38FE', 'IP52EC']) {
      await page.goto(BASE + '/products?productId=' + encodeURIComponent(id), { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      rows.push({ id, viewport: vp.n, els: await page.evaluate(probe) });
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'p2f.rfq.json'), JSON.stringify(rows, null, 1));
  for (const r of rows) {
    console.log(`\n[${r.viewport}] ${r.id}`);
    for (const e of r.els) console.log(`   <${e.tag}> "${e.text}" ${e.w}x${e.h} bg=${e.bg} border=${e.border} radius=${e.borderRadius} deco=${e.textDecoration} pad=${e.padding} fixed=${e.inFixed}`);
  }
}

// ── rows (the two p2stack reorder leads) ────────────────────────────────────
async function rowsSec(browser) {
  const probe = (sel) => {
    const el = [...document.querySelectorAll('div')].find((d) => (typeof d.className === 'string') && d.className.includes(sel));
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      cls: el.className, display: cs.display, flexWrap: cs.flexWrap, alignItems: cs.alignItems,
      kids: [...el.children].map((c) => {
        const r = c.getBoundingClientRect();
        const rng = document.createRange(); rng.selectNodeContents(c);
        const tr = [...rng.getClientRects()].filter((x) => x.width > 0);
        return {
          tag: c.tagName.toLowerCase(),
          text: (c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34),
          top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), left: +r.left.toFixed(1), right: +r.right.toFixed(1),
          textTop: tr.length ? +Math.min(...tr.map((x) => x.top)).toFixed(1) : null,
          textBottom: tr.length ? +Math.max(...tr.map((x) => x.bottom)).toFixed(1) : null,
        };
      }),
    };
  };
  for (const vp of [...VPS, { n: 'desktop-1440', w: 1440, h: 900 }]) {
    const ctx = await ctxFor(browser, vp.w, vp.h, null, false);
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 15)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(300);
    console.log(`\n[${vp.n}] homepage "mt-12 rounded-xl px-8 py-6" CTA band:`);
    console.log('  ' + JSON.stringify(await page.evaluate(probe, 'mt-12 rounded-xl px-8 py-6'), null, 1));
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    console.log(`[${vp.n}] /contact "lg:hidden mb-5 rounded-xl px-4" direct-contact strip:`);
    console.log('  ' + JSON.stringify(await page.evaluate(probe, 'lg:hidden mb-5 rounded-xl px-4'), null, 1));
    await ctx.close();
  }
}

// ── crumb ───────────────────────────────────────────────────────────────────
async function crumb(browser) {
  const probe = () => {
    const ol = document.querySelector('ol');
    if (!ol) return null;
    const r = ol.getBoundingClientRect();
    return {
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      flexWrap: getComputedStyle(ol).flexWrap,
      items: [...ol.children].map((li) => {
        const lr = li.getBoundingClientRect();
        return { text: (li.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50), top: +lr.top.toFixed(1), left: +lr.left.toFixed(1), w: +lr.width.toFixed(1) };
      }),
      lines: new Set([...ol.children].map((li) => Math.round(li.getBoundingClientRect().top))).size,
    };
  };
  const ids = ['IP64FS-IP65VC-IP66AC-IP67SC', 'IP71NS - IP72PS - IP73PP', 'IP37SH-IP36TH-IP39LH', 'IP75AD', 'CC'];
  for (const vp of VPS) {
    const ctx = await ctxFor(browser, vp.w, vp.h, null, false);
    const page = await ctx.newPage();
    for (const id of ids) {
      if (!products.some((p) => p.id === id)) { console.log(`  (no such id: ${id})`); continue; }
      await page.goto(BASE + '/products?productId=' + encodeURIComponent(id), { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const d = await page.evaluate(probe);
      console.log(`[${vp.n}] ${id}: lines=${d.lines} w=${d.w} items=${JSON.stringify(d.items.map((i) => `${i.text}@(${i.left},${i.top})`))}`);
      if (d.lines > 1 && vp.n === 'tablet-834') { fs.mkdirSync(ISSUES, { recursive: true }); await page.locator('ol').first().screenshot({ path: path.join(ISSUES, `CRUMB__${vp.n}__${id.replace(/[^A-Za-z0-9-]/g, '_')}.png`) }).catch(() => {}); }
    }
    await ctx.close();
  }
}

// ── rail ────────────────────────────────────────────────────────────────────
async function rail(browser) {
  const probe = () => {
    const strips = [...document.querySelectorAll('.ipc-scroll-sm')];
    return strips.map((el) => {
      const r = el.getBoundingClientRect();
      const kids = [...el.querySelectorAll('button')].map((b) => {
        const br = b.getBoundingClientRect();
        return { text: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34), w: +br.width.toFixed(1), h: +br.height.toFixed(1), left: +br.left.toFixed(1), right: +br.right.toFixed(1), visible: br.left >= r.left - 0.5 && br.right <= r.right + 0.5, partial: br.left < r.right && br.right > r.right };
      });
      return {
        clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, hidden: el.scrollWidth - el.clientWidth,
        gutterPx: el.offsetHeight - el.clientHeight,
        total: kids.length, fullyVisible: kids.filter((k) => k.visible).length,
        partiallyVisible: kids.filter((k) => k.partial).map((k) => k.text),
        firstHidden: kids.find((k) => !k.visible && !k.partial) ? kids.find((k) => !k.visible && !k.partial).text : null,
        names: kids.map((k) => k.text),
      };
    });
  };
  for (const vp of VPS) {
    const ctx = await ctxFor(browser, vp.w, vp.h, null, true);
    const page = await ctx.newPage();
    for (const url of ['/products', '/products?productId=CC']) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      console.log(`\n[${vp.n}] ${url}: ${JSON.stringify(await page.evaluate(probe), null, 1)}`);
      fs.mkdirSync(ISSUES, { recursive: true });
      await page.locator('.ipc-scroll-sm').first().screenshot({ path: path.join(ISSUES, `RAIL__${vp.n}__${url.replace(/[^A-Za-z0-9]/g, '_')}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}

(async () => {
  const which = process.argv[2] || 'all';
  fs.mkdirSync(ISSUES, { recursive: true });
  const browser = await launch();
  try {
    if (which === 'all' || which === 'form') await form(browser);
    if (which === 'all' || which === 'footer') await footer(browser);
    if (which === 'all' || which === 'rfq') await rfq(browser);
    if (which === 'all' || which === 'rows') await rowsSec(browser);
    if (which === 'all' || which === 'crumb') await crumb(browser);
    if (which === 'all' || which === 'rail') await rail(browser);
    if (which === 'all' || which === 'related') await related(browser);
  } finally { await browser.close(); }
})();
