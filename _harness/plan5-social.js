/**
 * PLAN-5 4.11b — footer social icons, and the NB4 / invariant-4 promise.
 *
 * v2 4.11 promised these and they were never built: `site.social.*` fed the
 * JSON-LD `sameAs` array and nothing else, so five fields Rick can edit in
 * Business Details had no visible effect on the site at all.
 *
 * All five are in SITE_CLEARABLE, so he is explicitly allowed to empty them,
 * and Editing-Your-Site-Content.md promises a cleared field "disappears from
 * the site properly". The load-bearing assertion is therefore the LAST one:
 * with all five cleared the container must be ABSENT, not present-and-empty.
 * A check written as "the container has no children" would pass against an
 * empty row that still eats 40px of footer.
 *
 * PLAN-6 item 4 (2026-08-07) added instagram and tiktok, taking this to seven.
 * The counts below are derived from KEYS rather than written out, so an eighth
 * platform does not need this file edited in six places.
 *
 * Asserts, at 1440 and 375:
 *   - all seven set       -> seven icons, each href exactly the configured URL
 *   - two cleared         -> five icons, no gap, no placeholder, and the
 *                            survivors are the RIGHT ones
 *   - all seven cleared   -> the element is absent from the DOM entirely
 *   - every icon has an accessible name, read from the real AX tree over CDP
 *   - every icon is target=_blank WITH rel containing noopener and noreferrer
 *   - every icon is keyboard reachable and shows a focus ring on Tab (real key
 *     presses — Chromium will not match :focus-visible for programmatic focus,
 *     so a working indicator would read as absent)
 *   - the icon colour clears 3:1 against the footer it actually sits on
 *   - JSON-LD sameAs still tracks the same fields (the NB4 behaviour this
 *     builds on top of)
 *   - no horizontal overflow at 375
 *   - and the ADMIN half: Business Details offers both new fields, saving
 *     writes them, the other five survive that save, and both reach the public
 *     footer with no rebuild
 *
 * Writes the MIRROR's data/site-info.json only, restores it from pristine/ and
 * proves byte-identity at the end. The repo's data/ is never touched.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5-social.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan5-social');
const MIRROR = path.join(__dirname, 'site', 'data', 'site-info.json');
const PRISTINE = path.join(__dirname, 'pristine', 'site-info.json');
const KEYS = ['twitter', 'facebook', 'linkedin', 'youtube', 'pinterest', 'instagram', 'tiktok'];

/**
 * PLAN-6 item 4 added instagram and tiktok. Their URLs are supplied HERE rather
 * than read from pristine/site-info.json, because that file is a copy of live
 * customer state and the owner has not set them — the suite must not need a
 * data edit to test a code path.
 */
const NEW_URLS = {
  instagram: 'https://www.instagram.com/insulprodcorp',
  tiktok: 'https://www.tiktok.com/@insulprodcorp',
};

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// The icon colour is rgba(255,255,255,0.55) over a rgba(255,255,255,0.06)
// chip over the footer. An earlier draft fed the rgba string straight into the
// luminance helper, which takes the first three numbers and drops the alpha —
// so it scored plain white on navy and reported 15.96:1 for a colour that is
// nothing like white. Composite first.
const parse = (s) => {
  const n = (s.match(/[\d.]+/g) || []).map(Number);
  return { r: n[0] || 0, g: n[1] || 0, b: n[2] || 0, a: n.length > 3 ? n[3] : 1 };
};
const over = (fg, bg) => {
  const f = parse(fg), b = parse(bg);
  const a = f.a + b.a * (1 - f.a) || 1;
  return `rgb(${(f.r * f.a + b.r * b.a * (1 - f.a)) / a}, ` +
         `${(f.g * f.a + b.g * b.a * (1 - f.a)) / a}, ` +
         `${(f.b * f.a + b.b * b.a * (1 - f.a)) / a})`;
};
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const lum = (c) => {
  const [r, g, b] = rgb(c).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

function writeSocial(social) {
  const doc = JSON.parse(fs.readFileSync(PRISTINE, 'utf8'));
  doc.social = social;
  fs.writeFileSync(MIRROR, JSON.stringify(doc, null, 2));
}

/** Every accessible name in the real AX tree. */
async function axNames(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const names = [];
  for (const n of nodes) {
    if (n.ignored) continue;
    const v = n.name && n.name.value;
    if (typeof v === 'string' && v.trim()) names.push(v.trim());
  }
  await cdp.detach();
  return names;
}

const readIcons = (page) =>
  page.evaluate(() => {
    const box = document.querySelector('[data-testid="footer-social"]');
    if (!box) return null;
    const r = box.getBoundingClientRect();
    return {
      width: r.width,
      height: r.height,
      links: [...box.querySelectorAll('a')].map((a) => ({
        href: a.getAttribute('href'),
        rel: a.getAttribute('rel') || '',
        target: a.getAttribute('target') || '',
        aria: a.getAttribute('aria-label') || '',
        svgs: a.querySelectorAll('svg').length,
        color: getComputedStyle(a).color,
        bg: getComputedStyle(a).backgroundColor,
        left: Math.round(a.getBoundingClientRect().left),
        w: Math.round(a.getBoundingClientRect().width),
        h: Math.round(a.getBoundingClientRect().height),
      })),
    };
  });

const sameAs = (page) =>
  page.evaluate(() => {
    const el = document.getElementById('ipc-structured-data');
    if (!el) return null;
    try { return JSON.parse(el.textContent).sameAs ?? null; } catch { return null; }
  });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const full = { ...JSON.parse(fs.readFileSync(PRISTINE, 'utf8')).social, ...NEW_URLS };

  try {
    for (const w of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();

      // ── all seven set ───────────────────────────────────────────────────
      writeSocial({ ...full });
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      let got = await readIcons(page);
      note(got !== null && got.links.length === KEYS.length,
        `${w}px: all ${KEYS.length} set -> ${KEYS.length} icons render`,
        JSON.stringify(got && got.links.length));
      if (got) {
        note(KEYS.every((k) => got.links.some((l) => l.href === full[k])),
          `${w}px: each icon links to exactly the configured URL`,
          JSON.stringify(got.links.map((l) => l.href)));
        note(got.links.every((l) => l.target === '_blank' &&
                                    /noopener/.test(l.rel) && /noreferrer/.test(l.rel)),
          `${w}px: every icon is target=_blank with rel="noopener noreferrer"`,
          JSON.stringify(got.links.map((l) => `${l.target} ${l.rel}`)));
        note(got.links.every((l) => l.svgs === 1),
          `${w}px: each icon is one inline <svg> — no icon font, no remote asset`);

        const names = await axNames(page);
        const named = got.links.filter((l) => names.some((n) => n === l.aria));
        note(named.length === KEYS.length,
          `${w}px: all ${KEYS.length} icons have an accessible name in the real AX tree ` +
          `(${named.length}/${KEYS.length})`,
          JSON.stringify(got.links.map((l) => l.aria)));

        const footerBg = await page.$eval('footer', (f) => getComputedStyle(f).backgroundColor);
        const worst = Math.min(...got.links.map((l) => {
          const chip = over(l.bg, footerBg);          // the 6% white chip on the footer
          return contrast(over(l.color, chip), chip); // the 55% white glyph on the chip
        }));
        note(worst >= 3,
          `${w}px: icon colour clears 3:1 against the surface it really sits on ` +
          `(worst ${worst.toFixed(2)}:1)`,
          `glyph ${got.links[0].color} on chip ${got.links[0].bg} on footer ${footerBg}`);

        const sa = await sameAs(page);
        note(Array.isArray(sa) && sa.length === KEYS.length,
          `${w}px: JSON-LD sameAs still carries all ${KEYS.length} (NB4 behaviour intact)`,
          JSON.stringify(sa));
      }

      const overflow1 = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      note(overflow1 <= 0, `${w}px: no horizontal overflow with five icons`, `${overflow1}px`);

      // Focus ring — REAL Tab presses. Chromium does not match :focus-visible
      // for programmatic focus, so el.focus() would report a working indicator
      // as absent.
      const ring = got === null ? null : await (async () => {
        await page.evaluate(() =>
          document.querySelector('[data-testid="footer-social"] a').scrollIntoView({ block: 'center' }));
        // Tab from the link just before the row: focus the previous focusable
        // and step forward until the first social link has focus.
        await page.evaluate(() => {
          const first = document.querySelector('[data-testid="footer-social"] a');
          const all = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')];
          const i = all.indexOf(first);
          if (i > 0) all[i - 1].focus();
        });
        for (let i = 0; i < 3; i++) {
          await page.keyboard.press('Tab');
          const hit = await page.evaluate(() =>
            document.activeElement?.closest('[data-testid="footer-social"]') !== null &&
            document.activeElement?.tagName === 'A');
          if (hit) {
            return page.evaluate(() => {
              const el = document.activeElement;
              const cs = getComputedStyle(el);
              return { matches: el.matches(':focus-visible'),
                       outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor,
                       outlineStyle: cs.outlineStyle };
            });
          }
        }
        return null;
      })();
      note(ring !== null && ring.matches && parseFloat(ring.outlineWidth) >= 2 && ring.outlineStyle !== 'none',
        `${w}px: the icons are keyboard reachable and show a visible focus ring on Tab`,
        JSON.stringify(ring));

      await page.screenshot({ path: path.join(OUT, `all-${w}.png`), fullPage: false });

      // ── two cleared ─────────────────────────────────────────────────────
      const partial = { ...full, twitter: '', youtube: '' };
      writeSocial(partial);
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      got = await readIcons(page);
      const want = KEYS.filter((k) => partial[k]);
      note(got !== null && got.links.length === KEYS.length - 2,
        `${w}px: two cleared -> exactly ${KEYS.length - 2} icons`,
        JSON.stringify(got && got.links.length));
      note(got !== null && want.every((k) => got.links.some((l) => l.href === partial[k])) &&
           !got.links.some((l) => !l.href),
        `${w}px: the survivors are the right ones, with no placeholder`,
        JSON.stringify(got && got.links.map((l) => l.href)));
      // "No gaps" measured between the icons themselves, NOT from the row's
      // width: the row is a block-level flex container and stretches to the
      // footer column whether it holds three icons or five, so its width says
      // nothing. Consecutive left edges must be exactly icon-width + gap; a
      // rendered-but-empty slot would double one of the steps.
      const steps = got === null ? [] :
        got.links.slice(1).map((l, i) => l.left - got.links[i].left);
      note(got !== null && got.links.length === KEYS.length - 2 &&
           steps.every((d) => d === got.links[0].w + 8),
        `${w}px: no gap where the cleared icons were — steps between icons are ` +
        `${JSON.stringify(steps)} for ${got && got.links[0] && got.links[0].w}px icons at an 8px gap`,
        JSON.stringify(steps));
      await page.screenshot({ path: path.join(OUT, `partial-${w}.png`), fullPage: false });

      // ── all cleared ─────────────────────────────────────────────────────
      writeSocial(Object.fromEntries(KEYS.map((k) => [k, ''])));
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      const present = await page.evaluate(() =>
        document.querySelectorAll('[data-testid="footer-social"]').length);
      note(present === 0,
        `${w}px: all ${KEYS.length} cleared -> the container is ABSENT from the DOM (not empty)`,
        `${present} element(s) still in the document`);
      const sa0 = await sameAs(page);
      note(sa0 === null || sa0 === undefined,
        `${w}px: all ${KEYS.length} cleared -> JSON-LD omits sameAs entirely (NB4)`, JSON.stringify(sa0));
      const overflow0 = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      note(overflow0 <= 0, `${w}px: no horizontal overflow with none`, `${overflow0}px`);
      await page.screenshot({ path: path.join(OUT, `none-${w}.png`), fullPage: false });

      await ctx.close();
    }
  } finally {
    fs.copyFileSync(PRISTINE, MIRROR);
    await browser.close();
  }

  /**
   * The ADMIN half. Everything above writes site-info.json directly, which
   * proves the site renders what the file says — but the item is "the owner can
   * set these", and nothing above goes anywhere near settings.php. A field that
   * renders correctly and cannot be saved is not a feature.
   *
   * Restores the mirror afterwards; the byte-identity check below covers it.
   */
  const admin = await launch();
  try {
    const ctx = await admin.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', 'audit-pass-123');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    await page.goto(`${BASE}/admin/settings.php`, { waitUntil: 'domcontentloaded' });
    const present = await page.evaluate(() =>
      ['social_instagram', 'social_tiktok'].filter((id) => document.getElementById(id)));
    note(present.length === 2,
      'Business Details offers an Instagram and a TikTok field',
      `found: ${JSON.stringify(present)}`);

    for (const [id, v] of [['social_instagram', NEW_URLS.instagram], ['social_tiktok', NEW_URLS.tiktok]]) {
      await page.fill(`#${id}`, v);
    }
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      // nav.php renders a Sign Out form ABOVE this one, so a bare
      // button[type=submit] matches the wrong form.
      page.click('form:has(#social_instagram) button:has-text("Save")'),
    ]);

    const saved = JSON.parse(fs.readFileSync(MIRROR, 'utf8')).social || {};
    note(saved.instagram === NEW_URLS.instagram && saved.tiktok === NEW_URLS.tiktok,
      'saving Business Details writes both new URLs to site-info.json',
      JSON.stringify({ instagram: saved.instagram, tiktok: saved.tiktok }));
    // settings.php rebuilds the file wholesale (invariant 4) — the five that
    // were already there must survive a save that only touched the new two.
    note(['twitter', 'facebook', 'linkedin', 'youtube', 'pinterest']
           .every((k) => saved[k] === full[k]),
      'the original five are untouched by that save',
      JSON.stringify(saved));

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const live = await readIcons(page);
    note(live !== null && live.links.some((l) => l.href === NEW_URLS.instagram) &&
         live.links.some((l) => l.href === NEW_URLS.tiktok),
      'both reach the public footer from the admin, with no rebuild',
      JSON.stringify(live && live.links.map((l) => l.href)));

    await ctx.close();
  } finally {
    fs.copyFileSync(PRISTINE, MIRROR);
    await admin.close();
  }

  const identical = fs.readFileSync(PRISTINE).equals(fs.readFileSync(MIRROR));
  note(identical, 'the mirror\'s site-info.json is byte-identical to pristine afterwards');

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5-social: ${results.length - bad}/${results.length}`);
  console.log(`screenshots -> ${OUT}`);
  process.exit(bad ? 1 : 0);
})();
