/**
 * AUDIT-10 pass-1 geometric sweep — desktop-1440 + tablet-1024.
 *
 * The pass-1 rubric expressed as numbers. Screenshot review finds leads; this
 * finds the ones the eye cannot resolve (a 3px edge break, a 1.02 aspect
 * squash, a 2px card-height difference inside a row) and gives every lead a
 * measurement before it is allowed to become a finding.
 *
 * Per page x viewport it records:
 *   chrome      header/footer heights + nav link text set + aria-current target
 *   overflow    documentElement scrollWidth vs clientWidth + protruding els
 *   clipped     elements whose content is cut by overflow:hidden/clip/ellipsis
 *   images      natural vs painted aspect ratio, upscale factor, object-fit
 *   rows        sibling groups sharing a row: width/height spread per row
 *   edges       left-edge histogram of block-level content inside <main>
 *   rhythm      vertical gaps between consecutive top-level sections of <main>
 *   overlaps    intersecting in-flow sibling rectangles
 *   framed      bordered/shadowed boxes with no text, image or svg inside
 *   sticky      position:sticky/fixed elements and their rects at scroll 0
 *
 * Output: _harness/out/audit10/p1sweep.json  (gitignored)
 * Usage:  node _harness/audit10-p1sweep.js [urlSubstringFilter]
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

const URLS = [
  '/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy',
  ...['Tape', 'Heat Shrink Tubing', 'Adhesive'].map((f) => '/dashboard?family=' + encodeURIComponent(f)),
  ...products.map((p) => '/products?productId=' + encodeURIComponent(p.id)),
  '/products?productId=NOPE-XYZ-123',
  '/no-such-page',
];

/* eslint-disable no-undef */
function collect() {
  const R = (n) => Math.round(n * 100) / 100;
  const vw = document.documentElement.clientWidth;
  const sig = (el) => {
    if (!el) return null;
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: R(r.left), y: R(r.top + window.scrollY), w: R(r.width), h: R(r.height) }; };

  // ── chrome ────────────────────────────────────────────────────────────────
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');
  const navLinks = [...document.querySelectorAll('header a')].map((a) => ({
    t: txt(a).slice(0, 40), href: a.getAttribute('href'),
    cur: a.getAttribute('aria-current') || null,
  }));
  const footLinks = [...document.querySelectorAll('footer a')].map((a) => ({
    t: txt(a).slice(0, 40), href: a.getAttribute('href'),
  }));
  const chrome = {
    headerH: header ? R(header.getBoundingClientRect().height) : null,
    footerH: footer ? R(footer.getBoundingClientRect().height) : null,
    headerBg: header ? getComputedStyle(header).backgroundColor : null,
    footerBg: footer ? getComputedStyle(footer).backgroundColor : null,
    navLinkSig: navLinks.map((l) => l.t + '>' + l.href).join('|'),
    navCurrent: navLinks.filter((l) => l.cur).map((l) => l.t + '>' + l.href),
    navCount: navLinks.length,
    footLinkSig: footLinks.map((l) => l.t + '>' + l.href).join('|'),
    footCount: footLinks.length,
  };

  // ── overflow ──────────────────────────────────────────────────────────────
  const overflowX = R(Math.max(
    document.documentElement.scrollWidth - vw,
    document.body ? document.body.scrollWidth - vw : 0
  ));
  const protruding = [];
  if (overflowX > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && protruding.length < 12) {
        protruding.push({ el: sig(el), left: R(r.left), right: R(r.right), text: txt(el).slice(0, 50) });
      }
    }
  }

  // ── clipped text / scrollers ──────────────────────────────────────────────
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const ox = cs.overflowX, oy = cs.overflowY;
    const cutX = el.scrollWidth - el.clientWidth;
    const cutY = el.scrollHeight - el.clientHeight;
    const hidX = ox === 'hidden' || ox === 'clip';
    const hidY = oy === 'hidden' || oy === 'clip';
    const ell = cs.textOverflow === 'ellipsis';
    if ((cutX > 1 && (hidX || ell)) || (cutY > 1 && hidY)) {
      if (clipped.length < 25) {
        clipped.push({
          el: sig(el), cutX: R(cutX), cutY: R(cutY), ox, oy, ellipsis: ell,
          w: R(r.width), h: R(r.height), y: R(r.top + window.scrollY),
          text: txt(el).slice(0, 70),
        });
      }
    }
    if ((cutX > 1 && (ox === 'auto' || ox === 'scroll')) && clipped.length < 25) {
      clipped.push({
        el: sig(el), cutX: R(cutX), cutY: R(cutY), ox, oy, scroller: true,
        w: R(r.width), h: R(r.height), y: R(r.top + window.scrollY),
        text: txt(el).slice(0, 70),
      });
    }
  }

  // ── images ────────────────────────────────────────────────────────────────
  const images = [...document.querySelectorAll('img')].map((i) => {
    const r = i.getBoundingClientRect();
    const cs = getComputedStyle(i);
    const nat = i.naturalWidth && i.naturalHeight ? i.naturalWidth / i.naturalHeight : null;
    const pnt = r.width && r.height ? r.width / r.height : null;
    return {
      src: (i.getAttribute('src') || '').slice(0, 120),
      alt: i.getAttribute('alt'),
      nw: i.naturalWidth, nh: i.naturalHeight,
      w: R(r.width), h: R(r.height), y: R(r.top + window.scrollY),
      fit: cs.objectFit, natRatio: nat ? R(nat) : null, paintRatio: pnt ? R(pnt) : null,
      ratioSkew: nat && pnt ? R(Math.abs(pnt - nat) / nat) : null,
      upscaleW: i.naturalWidth ? R(r.width / i.naturalWidth) : null,
      loading: i.getAttribute('loading'), decoding: i.getAttribute('decoding'),
      broken: i.complete && i.naturalWidth === 0 && !!(i.currentSrc || i.src),
      radius: cs.borderRadius, border: cs.borderTopWidth + ' ' + cs.borderTopColor,
    };
  });

  // ── row / grid integrity ──────────────────────────────────────────────────
  const rows = [];
  const parents = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length >= 2) parents.add(el);
  }
  for (const p of parents) {
    const kids = [...p.children].filter((k) => {
      const r = k.getBoundingClientRect();
      const cs = getComputedStyle(k);
      return r.width > 8 && r.height > 8 && cs.position !== 'absolute' && cs.position !== 'fixed';
    });
    if (kids.length < 2) continue;
    // only groups whose children share a class signature (design intends equality)
    const cls = kids.map((k) => (typeof k.className === 'string' ? k.className.trim() : ''));
    const same = cls.every((c) => c === cls[0]) && kids.every((k) => k.tagName === kids[0].tagName);
    if (!same) continue;
    // bucket into visual rows by top coordinate
    const buckets = new Map();
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      const key = Math.round((r.top + window.scrollY) / 4) * 4;
      let hit = null;
      for (const b of buckets.keys()) if (Math.abs(b - key) <= 8) hit = b;
      const kk = hit === null ? key : hit;
      if (!buckets.has(kk)) buckets.set(kk, []);
      buckets.get(kk).push(k);
    }
    for (const [top, group] of buckets) {
      if (group.length < 2) continue;
      const ws = group.map((k) => k.getBoundingClientRect().width);
      const hs = group.map((k) => k.getBoundingClientRect().height);
      const tops = group.map((k) => k.getBoundingClientRect().top);
      const wSpread = R(Math.max(...ws) - Math.min(...ws));
      const hSpread = R(Math.max(...hs) - Math.min(...hs));
      const tSpread = R(Math.max(...tops) - Math.min(...tops));
      if (wSpread > 1 || hSpread > 1 || tSpread > 1) {
        rows.push({
          parent: sig(p), childSig: sig(group[0]), n: group.length, y: R(top),
          wSpread, hSpread, tSpread,
          widths: ws.map(R), heights: hs.map(R),
          totalKids: kids.length, rowsInGroup: buckets.size,
        });
      }
    }
  }

  // ── left-edge histogram inside <main> ────────────────────────────────────
  const main = document.querySelector('main') || document.body;
  const edges = {};
  for (const el of main.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' || cs.position === 'absolute' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 8) continue;
    const k = String(Math.round(r.left));
    edges[k] = (edges[k] || 0) + 1;
  }

  // ── vertical rhythm of main's top-level sections ─────────────────────────
  const rhythm = [];
  {
    let prev = null;
    for (const c of main.children) {
      const r = c.getBoundingClientRect();
      if (r.height < 4) continue;
      const cs = getComputedStyle(c);
      const entry = {
        el: sig(c), y: R(r.top + window.scrollY), h: R(r.height),
        pt: cs.paddingTop, pb: cs.paddingBottom, mt: cs.marginTop, mb: cs.marginBottom,
        bg: cs.backgroundColor,
        gapFromPrev: prev === null ? null : R(r.top - prev),
      };
      prev = r.bottom;
      rhythm.push(entry);
    }
  }

  // ── overlapping in-flow siblings ─────────────────────────────────────────
  const overlaps = [];
  for (const p of parents) {
    const kids = [...p.children].filter((k) => {
      const cs = getComputedStyle(k);
      const r = k.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && cs.position === 'static' && cs.float === 'none';
    });
    for (let i = 0; i < kids.length && overlaps.length < 15; i++) {
      for (let j = i + 1; j < kids.length && overlaps.length < 15; j++) {
        const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) {
          overlaps.push({
            parent: sig(p), a: sig(kids[i]), b: sig(kids[j]),
            ox: R(ox), oy: R(oy), y: R(a.top + window.scrollY),
            aText: txt(kids[i]).slice(0, 40), bText: txt(kids[j]).slice(0, 40),
          });
        }
      }
    }
  }

  // ── framed emptiness (C44/C37 class) ─────────────────────────────────────
  const framed = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 400) continue;
    const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
    const hasShadow = cs.boxShadow && cs.boxShadow !== 'none';
    if (!hasBorder && !hasShadow) continue;
    if (txt(el)) continue;
    if (el.querySelector('img,svg,video,canvas,input,select,textarea,button')) continue;
    if (framed.length < 15) {
      framed.push({
        el: sig(el), w: R(r.width), h: R(r.height), y: R(r.top + window.scrollY),
        border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
        shadow: (cs.boxShadow || '').slice(0, 60), bg: cs.backgroundColor,
      });
    }
  }

  // ── sticky / fixed at rest ───────────────────────────────────────────────
  const sticky = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'sticky' || cs.position === 'fixed') {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2 && sticky.length < 12) {
        sticky.push({ el: sig(el), pos: cs.position, ...rect(el), z: cs.zIndex, top: cs.top });
      }
    }
  }

  // ── headings ─────────────────────────────────────────────────────────────
  const headings = [...document.querySelectorAll('h1,h2,h3')].map((h) => {
    const r = h.getBoundingClientRect();
    const cs = getComputedStyle(h);
    return {
      tag: h.tagName, text: txt(h).slice(0, 80), y: R(r.top + window.scrollY),
      x: R(r.left), w: R(r.width), h: R(r.height),
      fs: cs.fontSize, lh: cs.lineHeight, fw: cs.fontWeight,
      lines: Math.round(r.height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2)),
    };
  });

  return {
    vw, docH: document.documentElement.scrollHeight, title: document.title,
    chrome, overflowX, protruding, clipped, images, rows, edges, rhythm,
    overlaps, framed, sticky, headings,
  };
}
/* eslint-enable no-undef */

(async () => {
  const filter = process.argv[2] || null;
  const urls = filter ? URLS.filter((u) => u.includes(filter)) : URLS;
  const browser = await launch();
  const out = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const url of urls) {
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 500) {
            window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 20));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(450);
        out.push({ url, viewport: vp.name, ...(await page.evaluate(collect)) });
      } catch (e) {
        out.push({ url, viewport: vp.name, sweepError: String(e).slice(0, 300) });
      }
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(' ' + vp.name + ' done');
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p1sweep.json'), JSON.stringify(out, null, 1));
  console.log('rows: ' + out.length + ' -> _harness/out/audit10/p1sweep.json');
})();
