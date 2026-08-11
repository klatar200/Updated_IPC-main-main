/**
 * AUDIT-10 pass-6 step 6.2 — is the focus indicator actually VISIBLE, and does
 * it clear 3:1 against the ground it is drawn on?
 *
 * The computed-style walk (audit10-p6tabwalk.js) answers a weaker question. It
 * says every focused element gets `outline-style: auto` with a computed
 * `outline-color: rgb(16, 16, 16)`, but `auto` is Chromium's own ring and the
 * UA does not paint what that computed colour says: it strokes a dark inner
 * ring AND a light outer ring precisely so it survives both light and dark
 * grounds. Scoring rgb(16,16,16) against a navy navbar with a contrast formula
 * would manufacture a site-wide finding out of a value the browser never
 * paints. So this probe reads PIXELS.
 *
 * Method, per subject:
 *   A. navigate, reset the focus starting point, press Tab exactly N times
 *      (N from the tabwalk record) so the subject is focused BY A REAL KEY,
 *      then record its viewport rect + scrollY and screenshot a clip padded
 *      8px on every side — the ring lives outside the border box.
 *   B. reload, scroll to that exact scrollY, park the mouse at 0,0, screenshot
 *      the identical clip with nothing focused.
 *   C. decode both PNGs on a canvas in a blank page (no image decoder exists
 *      in node here; audit10-assets.js uses the same trick) and diff them.
 *      Every changed pixel is ring; score each changed pixel's AFTER colour
 *      against its own BEFORE colour, which is by construction the ground that
 *      pixel was painted on.
 *
 * Reported per subject: changed-pixel count and the best contrast any ring
 * pixel achieves against its own ground. A subject with 0 changed pixels has
 * no visible focus indicator at all, whatever its computed style says.
 *
 * Output: _harness/out/audit10/p6/ring-<viewport>.json + before/after PNGs
 * Usage:  node _harness/audit10-p6ring.js [viewport]     (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');
const SHOTS = path.join(OUT, 'ring');

const VIEWPORTS = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-834': { width: 834, height: 1112 },
  'mobile-390': { width: 390, height: 844 },
};
const PAD = 8;

/**
 * Subjects are named by (url, the text the tab stop carries). The tab index is
 * looked up in the tabwalk record rather than hardcoded, so this file does not
 * fossilise a stop number that shifts the moment a link is added.
 */
const SUBJECTS = [
  { url: '/', match: 'Skip to main content', note: 'designed ring (.ipc-skip) — control' },
  { url: '/', match: 'Home', note: 'navbar link on navy' },
  { url: '/', match: 'Products▼', note: 'mega-menu trigger on navy' },
  { url: '/', match: 'Request a Quote', note: 'navbar CTA on navy', first: true },
  { url: '/', match: 'Browse Products →', note: 'hero primary CTA on dark hero' },
  { url: '/', match: 'Talk to Our Sales Team', note: 'CTA on dark band' },
  { url: '/', match: 'X (formerly Twitter)', note: 'designed ring (.ipc-social-link) — control' },
  { url: '/', match: '630.771.0700', note: 'footer tel link on #0a2240' },
  { url: '/', match: 'Product Catalog', note: 'footer nav link on #0a2240' },
  { url: '/', match: 'View Full Catalog →', note: 'catalog CTA' },
  { url: '/products', match: 'Home', note: 'breadcrumb / nav on navy' },
  { url: '/dashboard', match: 'Product Name', note: 'designed ring (.ipc-sort-btn) on dark header row — control' },
  { url: '/faq', match: 'What types of heat shrink', note: 'FAQ accordion button on white' },
  { url: '/contact', match: 'Your name', note: 'contact text input on white' },
  { url: '/contact', match: 'Submit Quote Request', note: 'contact submit button' },
  { url: '/datasheets', match: 'Filter by part number', note: 'datasheets filter input (JS onFocus ring)' },
  { url: '/products?productId=CC', match: 'Download PDF', note: 'product datasheet CTA' },
  { url: '/products?productId=CC', match: 'Request a Quote \u2192', note: 'sticky RFQ bar CTA' },
  { url: '/industries', match: 'Request a Quote \u2192', note: 'industry card CTA' },
  { url: '/services', match: 'Request a Quote', note: 'services CTA' },
];

const DIFF = `
window.__ring = async (beforeB64, afterB64) => {
  const load = (b64) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = 'data:image/png;base64,' + b64;
  });
  const [a, b] = await Promise.all([load(beforeB64), load(afterB64)]);
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
  const px = (im) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    return g.getImageData(0, 0, w, h).data;
  };
  const A = px(a), B = px(b);
  const lum = (r, g, bl) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  let changed = 0, best = 0, bestPx = null;
  const hist = {};
  for (let i = 0; i < A.length; i += 4) {
    const dr = Math.abs(A[i] - B[i]), dg = Math.abs(A[i+1] - B[i+1]), db = Math.abs(A[i+2] - B[i+2]);
    if (dr + dg + db < 12) continue;             // anti-alias / compression noise floor
    changed++;
    const r = ratio(lum(B[i], B[i+1], B[i+2]), lum(A[i], A[i+1], A[i+2]));
    const key = B[i] + ',' + B[i+1] + ',' + B[i+2];
    hist[key] = (hist[key] || 0) + 1;
    if (r > best) {
      best = r;
      bestPx = {
        xy: [((i / 4) % w), Math.floor((i / 4) / w)],
        ground: 'rgb(' + A[i] + ', ' + A[i+1] + ', ' + A[i+2] + ')',
        ring: 'rgb(' + B[i] + ', ' + B[i+1] + ', ' + B[i+2] + ')',
      };
    }
  }
  const top = Object.entries(hist).sort((x, y) => y[1] - x[1]).slice(0, 4)
    .map(([k, v]) => 'rgb(' + k + ') x' + v);
  return { w, h, changed, best: Math.round(best * 100) / 100, bestPx, topRingColors: top };
};
`;

(async () => {
  const vpName = process.argv[2] || 'desktop-1440';
  const vp = VIEWPORTS[vpName];
  if (!vp) { console.error('unknown viewport ' + vpName); process.exit(2); }
  fs.mkdirSync(SHOTS, { recursive: true });

  const walkFile = path.join(OUT, `tabwalk-${vpName}.json`);
  if (!fs.existsSync(walkFile)) {
    console.error('run audit10-p6tabwalk.js ' + vpName + ' first'); process.exit(2);
  }
  const walk = JSON.parse(fs.readFileSync(walkFile, 'utf8'));

  const browser = await launch();
  const out = [];
  try {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const scratch = await ctx.newPage();
    await scratch.goto('about:blank');
    await scratch.addScriptTag({ content: DIFF });

    for (const s of SUBJECTS) {
      const rec = { ...s, viewport: vpName };
      const wp = walk.pages[s.url];
      if (!wp) { rec.error = 'page not in tabwalk record'; out.push(rec); continue; }
      const hits = wp.stops
        .map((st, i) => ({ st, i }))
        .filter(({ st }) => (st.text || '').includes(s.match));
      if (!hits.length) { rec.error = `no tab stop matching ${JSON.stringify(s.match)}`; out.push(rec); continue; }
      const pick = s.last ? hits[hits.length - 1] : hits[0];
      const nTabs = pick.i + 1;
      rec.tabIndex = nTabs;
      rec.stopText = pick.st.text;
      rec.sig = pick.st.sig;

      try {
        // ── A: focused, by a real key ──────────────────────────────────────
        await page.goto(BASE + s.url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(350);
        await page.mouse.move(0, 0);
        await page.evaluate(() => { window.scrollTo(0, 0); document.body.focus(); });
        for (let i = 0; i < nTabs; i++) await page.keyboard.press('Tab');
        await page.waitForTimeout(320);
        const geo = await page.evaluate(() => {
          const a = document.activeElement;
          const r = a.getBoundingClientRect();
          return {
            text: (a.textContent || a.getAttribute('aria-label') || a.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
            focusVisible: a.matches(':focus-visible'),
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            scrollY: window.scrollY,
            outlineStyle: getComputedStyle(a).outlineStyle,
          };
        });
        rec.landedOn = geo.text;
        rec.focusVisible = geo.focusVisible;
        rec.outlineStyle = geo.outlineStyle;
        if (!geo.text.includes(s.match)) rec.warn = `Tab x${nTabs} landed on ${JSON.stringify(geo.text)}`;

        const clip = {
          x: Math.max(0, Math.floor(geo.rect.x) - PAD),
          y: Math.max(0, Math.floor(geo.rect.y) - PAD),
          width: Math.min(vp.width - Math.max(0, Math.floor(geo.rect.x) - PAD), Math.ceil(geo.rect.w) + PAD * 2),
          height: Math.min(vp.height - Math.max(0, Math.floor(geo.rect.y) - PAD), Math.ceil(geo.rect.h) + PAD * 2),
        };
        if (clip.width < 4 || clip.height < 4) { rec.error = 'subject not on screen'; out.push(rec); continue; }
        const slug = (s.url + '_' + s.match).replace(/[^a-z0-9]+/gi, '_').slice(0, 70);
        const afterPath = path.join(SHOTS, `${vpName}__${slug}__focused.png`);
        const afterBuf = await page.screenshot({ clip, path: afterPath });

        // ── B: identical clip, identical scroll, nothing focused ───────────
        await page.goto(BASE + s.url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(350);
        await page.mouse.move(0, 0);
        await page.evaluate((y) => window.scrollTo(0, y), geo.scrollY);
        await page.waitForTimeout(320);
        const beforePath = path.join(SHOTS, `${vpName}__${slug}__default.png`);
        const beforeBuf = await page.screenshot({ clip, path: beforePath });

        const d = await scratch.evaluate(
          ([b, a]) => window.__ring(b, a),
          [beforeBuf.toString('base64'), afterBuf.toString('base64')]
        );
        Object.assign(rec, d, { clip, shots: { before: beforePath, after: afterPath } });
      } catch (e) {
        rec.error = String(e).slice(0, 220);
      }
      out.push(rec);
      process.stdout.write('.');
    }
    await ctx.close();
  } finally {
    await browser.close();
  }

  const file = path.join(OUT, `ring-${vpName}.json`);
  fs.writeFileSync(file, JSON.stringify({ viewport: vpName, subjects: out }, null, 1));

  console.log(`\n\n── focus-ring pixel measurement @ ${vpName}`);
  console.log('ring-px  best   fv    subject');
  for (const r of out) {
    if (r.error) { console.log(`   ERROR                ${r.url} ${JSON.stringify(r.match)} — ${r.error}`); continue; }
    const flag = r.changed === 0 ? '  <<< NO VISIBLE INDICATOR'
      : r.best < 3 ? `  <<< ${r.best}:1 BELOW 3:1` : '';
    console.log(`${String(r.changed).padStart(7)}  ${String(r.best).padStart(5)}  ${r.focusVisible ? 'yes' : 'NO '}  ${r.url} ${JSON.stringify(r.match)} — ${r.note}${flag}`);
    if (r.warn) console.log(`         warn: ${r.warn}`);
    if (r.topRingColors) console.log(`         ring colours: ${r.topRingColors.join('  ')}   ground@best ${r.bestPx ? r.bestPx.ground : '?'}`);
  }
  console.log(`\nrecord -> ${file}`);
})();
