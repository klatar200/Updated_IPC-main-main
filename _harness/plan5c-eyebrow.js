/**
 * `page-header-eyebrow-contrast` — is the text in `.ipc-page-header` readable?
 *
 * The open item named one element: the small uppercase eyebrow above each page
 * title, which `brand-color-as-foreground` had set to `--brand-accent-text` (a
 * variable solved for WHITE) on a surface that is a gradient. It measured
 * 1.13-1.20:1 — very close to invisible.
 *
 * This suite deliberately scores the WHOLE page-header text block, not just
 * that one element. Fixing an eyebrow to AA and leaving the paragraph directly
 * beneath it failing would be a worse outcome than leaving both alone, and only
 * measuring the block can tell you whether that is what you just did. Every
 * text-painting descendant of `.ipc-page-header` is scored.
 *
 * Two things this gets right that the item's own table did not:
 *
 *   - the gradient is sampled UNDER THE GLYPHS, not across the element's box.
 *     The eyebrow's <div> is 1232px wide and its ink is 83px; scoring the box
 *     charged the text for 1150px of gradient it never touches, which is where
 *     "nothing passes AA there without changing the page-header design" came
 *     from. See `_harness/backdrop.js`.
 *   - it runs under a PALE palette as well as the shipped navy. `.ipc-page-header`
 *     is `linear-gradient(135deg, var(--brand-primary), var(--brand-accent-2))`
 *     — both ends owner-controlled — so a fix that hardcodes white passes here
 *     and blinds the page the moment Rick picks a light brand colour. 4.23's
 *     `--brand-header-ink` is recomputed per palette against the WORSE gradient
 *     stop; anything at full opacity on that variable inherits the guarantee,
 *     and anything translucent gives it back.
 *
 * Asserts, for all 9 routes × 2 viewports × 2 palettes:
 *   - every text-painting element inside `.ipc-page-header` meets WCAG AA
 *     (4.5:1, or 3:1 where it qualifies as large text)
 *   - the eyebrow specifically is not painted in a brand ACCENT — the accent is
 *     one of the gradient's own stops, so using it as ink there is the 1.00:1
 *     case by construction, whatever the numbers happen to say today
 *
 * Reads only. Nothing under data/ is written — the pale palette is injected by
 * intercepting the site-info.json response, as inkaudit.js does.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5c-eyebrow.js [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const { SOURCE, ratio } = require('./backdrop');

const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/products', '/dashboard', '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];
const VIEWPORTS = [1440, 375];
const VERBOSE = process.argv.includes('--verbose');

// Same two palettes inkaudit.js uses, for the same reason: the shipped colours
// prove nothing about a page whose entire background is owner-controlled.
const PALETTES = {
  navy: { primaryColor: '#005DA3', darkColor: '#0D2D52', accentColor: '#00BEF2', accent2Color: '#119EC8' },
  pale: { primaryColor: '#FFE600', darkColor: '#FFF3A0', accentColor: '#FFF7C0', accent2Color: '#FFF7C0' },
};

const BASE_SITE_INFO = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine/site-info.json'), 'utf8')
);

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/**
 * Everything inside `.ipc-page-header` that paints its own text, with the
 * composited ink and the composited background under both ends of that ink.
 *
 * The eyebrow is identified STRUCTURALLY — the element immediately before the
 * <h1> — not by its Tailwind classes, which are shared with chips and labels
 * elsewhere on the page and would silently start matching something else.
 */
const PROBE = function () {
  const header = document.querySelector('.ipc-page-header');
  if (!header) return null;
  const h1 = header.querySelector('h1');
  const eyebrow = h1 && h1.previousElementSibling;

  const paintsOwnText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  };

  const out = [];
  for (const el of header.querySelectorAll('*')) {
    if (!paintsOwnText(el) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    const back = window.__ipcBackdrop(el);
    const fg = window.__ipcParse(cs.color);
    if (!fg) continue;
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    out.push({
      // The ink is composited over each end separately: a translucent ink over
      // a gradient is a different colour at each end, and taking one of them
      // would understate exactly the case this suite exists to catch.
      ink: back.map((bg) => window.__ipcOver(fg, bg)),
      back,
      alpha: fg[3],
      isEyebrow: el === eyebrow,
      large: size >= 24 || (weight >= 700 && size >= 18.66),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30),
    });
  }
  return out;
};

/** The rgb the named custom properties resolve to, for the accent check. */
const ACCENTS = function (names) {
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  document.body.appendChild(probe);
  const out = {};
  for (const n of names) {
    probe.style.color = `var(${n})`;
    out[n] = getComputedStyle(probe).color;
  }
  probe.remove();
  return out;
};

const ACCENT_VARS = ['--brand-accent', '--brand-accent-2', '--brand-accent-text', '--brand-accent1-on-dark'];

(async () => {
  const browser = await launch();
  const failures = [];
  const eyebrowRows = [];
  let scored = 0;
  let headersSeen = 0;

  try {
    for (const [name, palette] of Object.entries(PALETTES)) {
      const info = { ...BASE_SITE_INFO, theme: { ...(BASE_SITE_INFO.theme || {}), ...palette } };
      for (const route of ROUTES) {
        for (const w of VIEWPORTS) {
          const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
          const page = await ctx.newPage();
          await page.route('**/site-info.json*', (r) =>
            r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(info) }));
          await page.goto(BASE + route, { waitUntil: 'networkidle' });
          await page.waitForTimeout(250);
          await page.evaluate(SOURCE);
          const rows = await page.evaluate(PROBE);
          const accents = await page.evaluate(ACCENTS, ACCENT_VARS);
          await ctx.close();
          if (!rows) continue;   // a route with no page header; /​ has none
          headersSeen++;

          for (const r of rows) {
            scored++;
            const need = r.large ? 3.0 : 4.5;
            const value = Math.min(ratio(r.ink[0], r.back[0]), ratio(r.ink[1], r.back[1]));
            const where = `${name}/${route}@${w} <${r.tag}> "${r.text}"`;
            if (r.isEyebrow) {
              eyebrowRows.push({ where, value, need, alpha: r.alpha, ink: r.ink, accents });
            }
            if (value < need) {
              failures.push(`${where} — ${value.toFixed(2)}:1 (needs ${need}) ink rgb(${r.ink[0].join(',')}) on rgb(${r.back[0].join(',')})`);
            } else if (VERBOSE) {
              console.log(`     ok ${where} ${value.toFixed(2)}:1`);
            }
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  note(headersSeen > 0 && scored > 0,
    `scored ${scored} text-painting elements across ${headersSeen} page headers ` +
    `(${ROUTES.length} routes × ${VIEWPORTS.length} viewports × ${Object.keys(PALETTES).length} palettes)`);

  /**
   * The rest of the header block is a RATCHET, not a pass/fail gate, and the
   * reason is measured rather than assumed: at 375 the 135° gradient carries
   * the header's lower text far enough toward `--brand-accent-2` that NO ink
   * clears 4.5:1 there. Full white on the accent end is 3.12:1 and dark ink on
   * the primary end is 2.72:1, so the sub-lines cannot be fixed by choosing a
   * colour — only by changing the gradient. That is a design decision and it is
   * logged as `page-header-sublines-on-gradient` in WHATS_LEFT §2.
   *
   * A number that may not grow is the honest form for that: the eyebrow is held
   * at AA below, and every remaining failure is PRINTED on every run rather
   * than deferred to a human who will not come back — which is the mistake that
   * kept this whole item alive for two sessions.
   */
  // 39 before the eyebrow fix, 18 after: the 16 intro <p> sub-lines at 0.65
  // alpha, the /dashboard <strong> and the /faq inline link, both of which are
  // already at FULL-opacity header ink and still short at 375. That last pair is
  // the proof that this residue is not a colour choice — nothing is left to
  // choose. Lower this number when the gradient changes; it may never rise.
  const BASELINE = 18;
  for (const f of failures) console.log(`     ·  ${f}`);
  note(failures.length <= BASELINE,
    `${failures.length} header elements still below AA (ratchet: must not exceed ${BASELINE}) ` +
    `— all listed above, see page-header-sublines-on-gradient in WHATS_LEFT §2`,
    `${failures.length} > ${BASELINE}: something regressed`);

  const worstEyebrow = eyebrowRows.slice().sort((a, b) => a.value - b.value)[0];
  note(!!worstEyebrow && worstEyebrow.value >= worstEyebrow.need,
    `the eyebrow's worst case across every route, viewport and palette is ` +
    `${worstEyebrow ? worstEyebrow.value.toFixed(2) : '?'}:1`,
    worstEyebrow ? `${worstEyebrow.where} — ${worstEyebrow.value.toFixed(2)}:1, needs ${worstEyebrow.need}` : 'no eyebrow found');

  // The accent is ONE OF THE GRADIENT'S OWN STOPS. Painting the eyebrow in it
  // is the 1.00:1 case by construction at the far end of the band, so this is
  // asserted structurally and not left to whatever the ratio happens to be on
  // today's palette.
  const onAccent = eyebrowRows.filter((r) => {
    if (r.alpha < 1) return false;   // a translucent ink is not "the accent"
    const painted = `rgb(${r.ink[0].join(', ')})`;
    return Object.values(r.accents).includes(painted);
  });
  note(onAccent.length === 0,
    'the eyebrow is not painted in a brand accent — the accent is a stop of the very gradient it sits on',
    onAccent.slice(0, 4).map((r) => r.where).join('\n         '));

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5c-eyebrow: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
