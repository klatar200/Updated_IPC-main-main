/**
 * Accessibility / interaction sweep for the UI/UX audit.
 *
 *  - every text-painting element scored against its COMPOSITED background
 *    (walks up through transparent ancestors, composites alpha, WCAG luminance)
 *  - elements that are keyboard-focusable while visually hidden
 *  - touch-target sizes at 390 px
 *  - prefers-reduced-motion honoured?
 *  - focus-ring screenshots for the primary nav + hero CTAs
 *
 *   node _harness/audit-a11y.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit');
const ROUTES = ['/', '/products', '/products?productId=IP33PO', '/dashboard', '/datasheets',
  '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];

// Serialised into the page. Returns every text-bearing leaf with its contrast.
const CONTRAST_SRC = `(() => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => {
    const m = String(s).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, a, bg) => fg.map((c, i) => Math.round(a * c + (1 - a) * bg[i]));

  // The opaque paint behind an element, walking ancestors and compositing.
  function backdrop(el) {
    let stack = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const bg = parse(cs.backgroundColor);
      const hasImg = cs.backgroundImage && cs.backgroundImage !== 'none';
      if (hasImg) stack.push({ gradient: true, cs: cs.backgroundImage });
      if (bg && bg.a > 0) {
        stack.push({ rgb: bg.rgb, a: bg.a });
        if (bg.a === 1 && !hasImg) break;
      }
      n = n.parentElement;
    }
    // Gradients: fall back to the element's own paint via elementFromPoint sampling
    // is not available here, so mark them and score against the last solid.
    let base = [255, 255, 255];
    let sawGradient = false;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const s = stack[i];
      if (s.gradient) { sawGradient = true; continue; }
      base = over(s.rgb, s.a, base);
    }
    return { rgb: base, gradient: sawGradient };
  }

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    // Only elements that paint their own text.
    const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!direct) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bd = backdrop(el);
    const fgc = fg.a < 1 ? over(fg.rgb, fg.a, bd.rgb) : fg.rgb;
    const l1 = lum(fgc), l2 = lum(bd.rgb);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    out.push({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 52),
      color: cs.color, bg: 'rgb(' + bd.rgb.join(',') + ')',
      gradient: bd.gradient,
      px, bold, ratio: Math.round(ratio * 100) / 100, need, pass: ratio >= need,
      cls: String(el.className || '').slice(0, 60),
    });
  }
  return out;
})()`;

async function main() {
  const browser = await launch();
  const result = { contrast: {}, hiddenFocusable: {}, tapTargets: {}, reducedMotion: null };

  // ── contrast + hidden-focusable, desktop ─────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const rows = await page.evaluate(CONTRAST_SRC);
    result.contrast[route] = rows.filter((r) => !r.pass);

    result.hiddenFocusable[route] = await page.evaluate(() => {
      const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
      const bad = [];
      for (const el of document.querySelectorAll(sel)) {
        if (el.disabled) continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // Visually hidden but still in the tab order.
        let hiddenBy = null;
        if (cs.visibility === 'hidden') hiddenBy = 'visibility:hidden';
        else if (+cs.opacity === 0) hiddenBy = 'opacity:0';
        else {
          let n = el;
          while (n && n !== document.body) {
            const c = getComputedStyle(n);
            if (+c.opacity === 0) { hiddenBy = 'ancestor opacity:0'; break; }
            if (c.visibility === 'hidden') { hiddenBy = 'ancestor visibility:hidden'; break; }
            n = n.parentElement;
          }
        }
        const offscreen = r.width === 0 || r.height === 0;
        if (hiddenBy || (offscreen && !el.closest('[hidden]'))) {
          bad.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.value || '').trim().slice(0, 44),
            hiddenBy: hiddenBy || 'zero-size',
            ariaHidden: el.closest('[aria-hidden="true"]') ? true : false,
            inert: el.closest('[inert]') ? true : false,
          });
        }
      }
      return bad;
    });
  }
  await ctx.close();

  // ── touch targets at 390 ─────────────────────────────────────
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const mp = await mctx.newPage();
  for (const route of ROUTES) {
    await mp.goto(BASE + route, { waitUntil: 'networkidle' });
    await mp.waitForTimeout(900);
    result.tapTargets[route] = await mp.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('a[href],button,input,select,[role=button]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (getComputedStyle(el).visibility === 'hidden') continue;
        if (r.width < 44 || r.height < 44) {
          bad.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 38),
            w: Math.round(r.width), h: Math.round(r.height),
          });
        }
      }
      return bad;
    });
  }
  await mctx.close();

  // ── prefers-reduced-motion ───────────────────────────────────
  const rctx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce',
  });
  const rp = await rctx.newPage();
  await rp.goto(BASE + '/', { waitUntil: 'networkidle' });
  await rp.waitForTimeout(1000);
  result.reducedMotion = await rp.evaluate(() => {
    const moving = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      const dur = parseFloat(cs.animationDuration) || 0;
      if (dur > 0 && cs.animationName !== 'none' && cs.animationIterationCount === 'infinite') {
        moving.push({
          tag: el.tagName.toLowerCase(), name: cs.animationName,
          dur: cs.animationDuration, cls: String(el.className || '').slice(0, 60),
        });
      }
    }
    return { infiniteAnimations: moving, mq: matchMedia('(prefers-reduced-motion: reduce)').matches };
  });
  await rctx.close();

  // ── focus ring screenshots ───────────────────────────────────
  const fctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const fp = await fctx.newPage();
  await fp.goto(BASE + '/', { waitUntil: 'networkidle' });
  await fp.waitForTimeout(900);
  fs.mkdirSync(path.join(OUT, 'focus'), { recursive: true });
  for (let i = 1; i <= 12; i += 1) {
    await fp.keyboard.press('Tab');
    await fp.waitForTimeout(120);
  }
  await fp.screenshot({ path: path.join(OUT, 'focus', 'home-tab12.png'), clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  // Re-tab from scratch and shoot the navbar band at each of the first 5 stops.
  await fp.goto(BASE + '/', { waitUntil: 'networkidle' });
  await fp.waitForTimeout(600);
  for (let i = 1; i <= 5; i += 1) {
    await fp.keyboard.press('Tab');
    await fp.waitForTimeout(150);
    await fp.screenshot({ path: path.join(OUT, 'focus', `nav-stop${i}.png`), clip: { x: 0, y: 0, width: 1440, height: 260 } });
  }
  await fctx.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'a11y.json'), JSON.stringify(result, null, 1));
  console.log('wrote a11y.json');
}
main();
