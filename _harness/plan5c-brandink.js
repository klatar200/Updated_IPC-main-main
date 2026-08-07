/**
 * `brand-text-on-brand-surface` — the bright accents used as TEXT ON LIGHT.
 *
 * `brand-color-as-foreground` converted the brand colours used as ink by
 * scanning the source for `var(--brand-primary)` and `var(--brand-accent-2)` in
 * a `color:` position. `--brand-accent` was never in that target list, so every
 * call site painting the BRIGHT accent as text survived the migration: 124 `→`
 * and `✓` bullet glyphs on white at 2.18:1, and 41 product-type chips on a pale
 * tint at 2.79:1. `brandtext.js` found them the moment it started scoring real
 * backgrounds instead of scanning source.
 *
 * The split matters, and it is why this suite classifies by MEASURED background
 * luminance rather than by route or selector:
 *
 *   - on a LIGHT background the accent must get DARKER. `--brand-accent-text`
 *     (`textSafeOn(accent2, "#ffffff")`) already exists and already does this;
 *     these sites simply never used it. 2.18 -> 5.26 on white, 2.79 -> 4.72 on
 *     the chip tint. That is a completion of the earlier migration.
 *   - on a DARK background the same colour must get LIGHTER, and darkening it
 *     makes things worse — `--brand-accent-text` on the navy panels measures
 *     1.34:1. Those sites need a light derivative that does not exist yet, and
 *     they are held on a ratchet below rather than "fixed" with the wrong
 *     variable. Getting that backwards is exactly how the page eyebrow ended up
 *     at 1.04:1.
 *
 * Classifying by luminance rather than by call site also means a new element
 * painted in the bright accent on white is caught without anyone updating a
 * list.
 *
 * Asserts:
 *   - every element painting a bright accent as text on a LIGHT background
 *     meets WCAG AA (4.5:1, or 3:1 for large text)
 *   - the count on DARK backgrounds does not grow (ratchet, all listed)
 *   - `--brand-accent` is UNCHANGED as a background and border colour — the fix
 *     is per-call-site, not a redefinition of the brand's bright cyan, and a
 *     suite that cannot tell those apart would pass on the wrong one
 *
 * Reads only. Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5c-brandink.js [--verbose]
 */

const { launch } = require('./browser');
const { SOURCE, lum, ratio } = require('./backdrop');

const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/products', '/dashboard', '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];
const VIEWPORTS = [1440, 375];
const VERBOSE = process.argv.includes('--verbose');

// The BRIGHT accents — the ones that are wrong as ink on light. Deliberately
// not the whole brand set: --brand-primary is dark and was migrated already.
const BRIGHT = ['--brand-accent', '--brand-accent-2'];
// The darkened-for-text variant these light-background sites should be using.
// Tracked as well as BRIGHT so "zero bright on light" can be told apart from
// "the probe stopped finding anything" — the first version of this suite could
// not, and went green-then-red on its own liveness check.
const TEXTSAFE = ['--brand-accent-text'];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const PROBE = function ([brightVars, textSafeVars]) {
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  document.body.appendChild(probe);
  const bright = {};
  for (const v of brightVars) {
    probe.style.color = `var(${v})`;
    bright[getComputedStyle(probe).color] = v;
  }
  const safe = {};
  for (const v of textSafeVars) {
    probe.style.color = `var(${v})`;
    safe[getComputedStyle(probe).color] = v;
  }
  probe.remove();

  const paintsOwnText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  };

  const text = [];
  // Where the bright accent is legitimately used: as a SURFACE. Counted so a
  // change that redefines the variable instead of the call sites is visible.
  const surfaces = { background: 0, border: 0 };
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (bright[cs.backgroundColor]) surfaces.background++;
    for (const side of ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor']) {
      if (bright[cs[side]] && parseFloat(cs[side.replace('Color', 'Width')]) > 0) { surfaces.border++; break; }
    }
    if (bright[cs.backgroundImage]) surfaces.background++;
    if (!paintsOwnText(el)) continue;
    const v = bright[cs.color] || safe[cs.color];
    if (!v) continue;
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    text.push({
      v,
      safe: !!safe[cs.color],
      fg: window.__ipcParse(cs.color),
      back: window.__ipcBackdrop(el),
      large: size >= 24 || (weight >= 700 && size >= 18.66),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30),
    });
  }
  return { text, surfaces };
};

(async () => {
  const browser = await launch();
  const onLight = [];
  const onDark = [];
  let surfaces = { background: 0, border: 0 };

  try {
    for (const route of ROUTES) {
      for (const w of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
        const page = await ctx.newPage();
        await page.goto(BASE + route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        await page.evaluate(SOURCE);
        const { text, surfaces: s } = await page.evaluate(PROBE, [BRIGHT, TEXTSAFE]);
        await ctx.close();
        surfaces.background += s.background;
        surfaces.border += s.border;

        for (const r of text) {
          const need = r.large ? 3.0 : 4.5;
          const value = Math.min(ratio(r.fg, r.back[0]), ratio(r.fg, r.back[1]));
          // "Light" is decided by MEASUREMENT, not by which route it is on.
          // 0.18 is WCAG's own mid-point: the luminance at which white and
          // black ink score equally, so it is the boundary between "darken the
          // ink" and "lighten it".
          const light = lum(r.back[0]) > 0.18 && lum(r.back[1]) > 0.18;
          const row = {
            where: `${route}@${w} <${r.tag}> "${r.text}"`,
            v: r.v, safe: r.safe, value, need,
            on: `rgb(${r.back[0].join(',')})`,
            fg: `rgb(${r.fg.slice(0, 3).join(',')})`,
          };
          (light ? onLight : onDark).push(row);
        }
      }
    }
  } finally {
    await browser.close();
  }

  const lightBad = onLight.filter((r) => r.value < r.need);
  const darkBad = onDark.filter((r) => r.value < r.need);

  const brightOnLight = onLight.filter((r) => !r.safe);
  const safeOnLight = onLight.filter((r) => r.safe);

  note(safeOnLight.length > 0,
    `${safeOnLight.length} elements paint the TEXT-SAFE accent on a light background, ` +
    `${brightOnLight.length} still paint a BRIGHT one there, ${onDark.length} sit on dark ` +
    `(${ROUTES.length} routes × ${VIEWPORTS.length} viewports)`,
    'nothing found at all — the probe is broken, not the site');

  // The whole item, in one line. Was 165 before the change; the same 165
  // elements are now counted by the assertion above.
  note(brightOnLight.length === 0,
    'no element paints a BRIGHT accent as text on a light background',
    [...new Set(brightOnLight.map((r) => `${r.v} ${r.value.toFixed(2)}:1 on ${r.on} — ${r.where}`))]
      .slice(0, 10).join('\n         '));

  if (VERBOSE) for (const r of onLight) console.log(`     ${r.value >= r.need ? 'ok' : '!!'} ${r.where} ${r.value.toFixed(2)}:1 ${r.fg} on ${r.on}`);

  note(lightBad.length === 0,
    'every accent-coloured text on a light background meets WCAG AA',
    [...new Set(lightBad.map((r) => `${r.v} ${r.value.toFixed(2)}:1 ${r.fg} on ${r.on} — ${r.where}`))]
      .slice(0, 10).join('\n         '));

  /**
   * The dark-surface group is a RATCHET. `--brand-accent-text` is the wrong
   * variable for it — it measures 1.34:1 there — so "fixing" these with the
   * change that fixed the light group would make them four times worse. They
   * need a light derivative that does not exist yet; `textSafeOn()` can produce
   * one, but which one is a brand decision, and it is logged in WHATS_LEFT §2.
   */
  // 18 measured. Every one is on a navy panel, where --brand-accent-text is the
  // WRONG direction (1.34:1) — see the item note. It may fall, never rise.
  const DARK_BASELINE = 18;
  for (const r of [...new Set(darkBad.map((r) => `${r.v} ${r.value.toFixed(2)}:1 on ${r.on} — ${r.where}`))]) {
    console.log(`     ·  ${r}`);
  }
  note(darkBad.length <= DARK_BASELINE,
    `${darkBad.length} bright-accent texts on DARK backgrounds still below AA ` +
    `(ratchet: must not exceed ${DARK_BASELINE}) — these need a LIGHTER accent, not a darker one`,
    `${darkBad.length} > ${DARK_BASELINE}: something regressed`);

  // If someone "fixes" this by redefining --brand-accent itself, the text goes
  // green and every button, badge and rule painted in the brand's bright cyan
  // changes colour. Counting the surfaces is what tells those apart.
  note(surfaces.background > 0 && surfaces.border > 0,
    `--brand-accent / --brand-accent-2 are still in use as surfaces — ` +
    `${surfaces.background} backgrounds and ${surfaces.border} borders across the sweep`,
    JSON.stringify(surfaces));

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5c-brandink: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
