/**
 * Decision mockups for the brand-colour items still open in WHATS_LEFT.md §2.
 *
 * Screenshots the REAL pages with each candidate applied as an override — not a
 * hand-built mock, so what you see is what would ship.
 *
 *   out/mockups/arrows-*.png   the 124 "→" bullets on /industries
 *   out/mockups/chips-*.png    the 41 type chips on /dashboard
 *   out/mockups/eyebrow-*.png  the page-header eyebrow on /products
 *
 * ─── What running this turned up (2026-08-07) ───────────────────────────────
 *
 * `brandtext.js` scores a gradient background across the ELEMENT'S BOX. For a
 * short run of text in a wide block that is the wrong extent, and it changes
 * the conclusion:
 *
 *   page eyebrow <div>   box 1232px    text ink 83px    (7%)
 *
 * Sampled across the box, the eyebrow's gradient runs rgb(2,99,166) →
 * rgb(14,148,195), and white scores 3.48:1 at the far end — which is where
 * WHATS_LEFT §2's "nothing passes AA there without changing the page-header
 * design" came from. Sampled under the ACTUAL GLYPHS the background barely
 * moves, rgb(1,99,166) → rgb(3,103,169), and **white measures 5.97–6.29:1**.
 * The fix is one line, not a redesign.
 *
 * The measured failure itself was never wrong — the current colour scores
 * 1.13–1.20 either way. What the box-extent measurement got wrong was the
 * evaluation of the CANDIDATES. Anything that sits on a gradient and does not
 * fill its box is suspect; anything on a solid background is unaffected, which
 * is why the 124 arrows (on white) and 41 chips (on a flat tint) are accurate.
 *
 * Measuring ink extent instead of box extent is the fix for `brandtext.js`.
 *
 * ─── A trap this script fell into, kept as a warning ────────────────────────
 *
 * ThemeInjector sets the brand variables INLINE on <html>. A stylesheet
 * `:root { --brand-accent: … }` override is therefore silently ignored, and the
 * first run of this script produced two IDENTICAL "before/after" screenshots
 * that looked like a no-op change. Override with
 * `documentElement.style.setProperty()`, and where the call site carries its own
 * inline `color:` (the dashboard chips do), set that with `'important'`.
 * Always confirm the mockup actually moved before drawing a conclusion from it.
 *
 * Usage: node _harness/mockup-brandtext.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'mockups');

/**
 * ThemeInjector sets the brand variables INLINE on <html>, which beats any
 * stylesheet `:root` rule — a `addStyleTag(':root{--brand-accent:…}')` override
 * is silently ignored, which is how the first pass of this script produced two
 * identical "before/after" screenshots. Set the property on the element.
 */
const shot = async (page, url, { vars, css } = {}, file, clip) => {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  if (vars) {
    await page.evaluate((v) => {
      for (const [k, val] of Object.entries(v)) document.documentElement.style.setProperty(k, val);
    }, vars);
  }
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, file), clip });
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ── 1. the "→" bullets, currently --brand-accent #00BEF2 on white, 2.18:1 ──
  const arrowClip = { x: 80, y: 470, width: 660, height: 250 };
  await shot(page, '/industries', {}, 'arrows-A-current-00BEF2.png', arrowClip);
  await shot(page, '/industries',
    { vars: { '--brand-accent': '#0d7594' } }, 'arrows-B-accent-text-0d7594.png', arrowClip);
  await shot(page, '/industries',
    { vars: { '--brand-accent': '#6b7280' } }, 'arrows-C-neutral-grey.png', arrowClip);

  // ── 2. the type chips, --brand-accent-2 on a pale tint, 2.79:1 ─────────────
  const chipClip = { x: 80, y: 560, width: 900, height: 260 };
  await shot(page, '/dashboard', {}, 'chips-A-current.png', chipClip);
  await shot(page, '/dashboard',
    { vars: { '--brand-accent-on-footer': '#0d7594', '--brand-accent-2': '#0d7594' } },
    'chips-B-accent-text-0d7594.png', chipClip);

  // ── 3. the page-header eyebrow, 1.20:1 — nothing passes on the gradient ────
  const eyeClip = { x: 60, y: 60, width: 900, height: 210 };
  await shot(page, '/products', {}, 'eyebrow-A-current.png', eyeClip);
  // white ink: best of the plain colours at 3.48:1 worst — still under 4.5 at 12px
  await shot(page, '/products',
    { css: '.ipc-page-header > div > div:first-child { color: #ffffff !important; }' },
    'eyebrow-B-white.png', eyeClip);
  // solid chip behind it: passes trivially and keeps the two-tone
  await shot(page, '/products',
    { css: `.ipc-page-header > div > div:first-child {
       color: #ffffff !important; background: rgba(10,34,64,0.85);
       display: inline-block; padding: 4px 10px; border-radius: 4px; }` },
    'eyebrow-C-solid-chip.png', eyeClip);
  // darken the gradient's right stop so one ink serves the whole band
  await shot(page, '/products',
    { css: `.ipc-page-header { background: linear-gradient(135deg, var(--brand-primary) 0%, #0b4c66 100%) !important; }
     .ipc-page-header > div > div:first-child { color: #ffffff !important; }` },
    'eyebrow-D-darker-gradient.png', eyeClip);
  // drop the eyebrow entirely
  await shot(page, '/products',
    { css: '.ipc-page-header > div > div:first-child { display: none !important; }' },
    'eyebrow-E-removed.png', eyeClip);

  await browser.close();
  console.log('mockups -> ' + OUT);
  console.log(fs.readdirSync(OUT).sort().join('\n'));
})();
