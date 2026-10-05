/**
 * WHATS_LEFT §1as (Keagan 2026-10-05) — small text painted in a brand colour,
 * or in a faded ink, reaches WCAG AA on the surface it actually sits on.
 *
 * The decision: such text may use a slightly lighter or darker shade of the
 * brand colour, derived by textSafeOn() from the palette — never hardcoded.
 * This scores every text-painting element in the four regions the open items
 * named, under the shipped navy palette AND a pale one (a derived value that
 * only works for navy is a hardcoded value in disguise):
 *
 *   hero      the homepage hero: badge, proof-point stats and sub-lines,
 *             trust ticker (brand-accent-on-dark-surfaces, NEW-R3-m2-2)
 *   industry  /industries card headers: chip and sub-line on the deep→primary
 *             gradient (brand-accent-on-dark-surfaces)
 *   drawer    the 375 px menu drawer, "By Category" label (NEW-R3-m2-2)
 *   panel     the 1440 px Products mega-menu, its category label (NEW-R3-m2-2)
 *
 * Contrast is measured with backdrop.js (gradients sampled at the glyphs,
 * translucent layers composited), the same core brandtext.js uses.
 * Out of scope here, deliberately: .ipc-page-header (plan5c-eyebrow — its
 * sub-lines are the escalated half of §1as).
 *
 *   npm run build && sh _harness/sync.sh && node _harness/smalltext1as.js   (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const { SOURCE, ratio } = require('./backdrop');

const BASE = 'http://127.0.0.1:8123';
// Elements no text colour can fix on their surface, measured 2026-10-05: the
// pale palette's hero and drawer, where the derived surface sits mid-tone.
// Lower it when a surface decision lands; never raise it.
const SURFACE_RATCHET = 13;
const PALETTES = {
  navy: { primaryColor: '#005DA3', darkColor: '#0D2D52', accentColor: '#00BEF2', accent2Color: '#119EC8' },
  pale: { primaryColor: '#FFE600', darkColor: '#FFF3A0', accentColor: '#FFF7C0', accent2Color: '#FFF7C0' },
};
const BASE_SITE_INFO = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine/site-info.json'), 'utf8'));
const results = [];
const note = (ok, what, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** Every element under `root` that paints its own text, scored on its real backdrop. */
const SCORE = function (sel) {
  const roots = [...document.querySelectorAll(sel)];
  const out = [];
  for (const root of roots) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      let own = false;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) own = true;
      if (!own || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const fg = window.__ipcParse(cs.color);
      if (!fg) continue;
      const back = window.__ipcBackdrop(el);
      const size = parseFloat(cs.fontSize) || 16;
      const weight = parseInt(cs.fontWeight, 10) || 400;
      out.push({
        // The declared colour, so elements sharing one variable are judged
        // together: a variable holds ONE colour for every element that uses it.
        color: cs.color,
        ink: back.map((bg) => window.__ipcOver(fg, bg)),
        back,
        large: size >= 24 || (weight >= 700 && size >= 18.66),
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 28),
      });
    }
  }
  return out;
};

(async () => {
  const browser = await launch();
  const bad = {};
  const seen = {};
  const surface = {};
  try {
    for (const [pal, palette] of Object.entries(PALETTES)) {
      const info = { ...BASE_SITE_INFO, theme: { ...(BASE_SITE_INFO.theme || {}), ...palette } };
      const open = async (route, w) => {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        await page.route('**/site-info.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(info) }));
        await page.goto(BASE + route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(250);
        await page.evaluate(SOURCE);
        return { ctx, page };
      };
      const score = async (region, page, sel, where) => {
        const rows = await page.evaluate(SCORE, sel);
        seen[region] = (seen[region] || 0) + rows.length;
        // A failing element is SURFACE-LIMITED when no single plain ink
        // (white, or the site's #141414) passes for every element that shares
        // its colour in this view — then no value that colour's variable could
        // hold would pass, and only the surface can fix it (§1as escalated
        // that). Judged per colour group, not per element: per element, a card
        // in the light part of a gradient "could pass" with the opposite ink
        // to the card in the dark part, and the one variable cannot be both.
        // Listed, not failed — and counted, so the list cannot grow unseen.
        const minOn = (k, r) => Math.min(ratio(k, r.back[0]), ratio(k, r.back[1]));
        const groupOk = {};
        for (const r of rows) {
          const g = rows.filter((x) => x.color === r.color);
          groupOk[r.color] = [[255, 255, 255], [20, 20, 20]].some((k) => g.every((x) => minOn(k, x) >= (x.large ? 3 : 4.5)));
        }
        for (const r of rows) {
          const need = r.large ? 3 : 4.5;
          const v = Math.min(ratio(r.ink[0], r.back[0]), ratio(r.ink[1], r.back[1]));
          if (v >= need) continue;
          const line = `${pal}${where} <${r.tag}> "${r.text}" ${v.toFixed(2)}:1 (needs ${need})`;
          if (!groupOk[r.color]) (surface[region] = surface[region] || []).push(line);
          else (bad[region] = bad[region] || []).push(line);
        }
      };
      for (const w of [1440, 375]) {
        let { ctx, page } = await open('/', w);
        await score('hero', page, 'main section:first-of-type', ` /@${w}`);
        await ctx.close();
        ({ ctx, page } = await open('/industries', w));
        await score('industry', page, 'main [id^="industry-"]', ` /industries@${w}`);
        await ctx.close();
      }
      let { ctx, page } = await open('/', 375);
      await page.click('button[aria-label="Open menu"]');
      await page.waitForTimeout(400);
      await score('drawer', page, '[role="dialog"], nav[aria-label*="obile"], #mobile-menu', ' drawer@375');
      await ctx.close();
      ({ ctx, page } = await open('/', 1440));
      await page.hover('button[aria-haspopup="true"]');
      await page.waitForTimeout(400);
      await score('panel', page, '[aria-haspopup="true"] + div, [aria-haspopup="true"] ~ div', ' mega-menu@1440');
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  const surf = Object.values(surface).flat();
  if (surf.length) console.log(`     surface-limited (no text colour can pass — the background decides, §1as escalation):\n       ${surf.join('\n       ')}`);
  note(surf.length <= SURFACE_RATCHET, `${surf.length} surface-limited elements (ratchet: must not exceed ${SURFACE_RATCHET})`);
  for (const region of ['hero', 'industry', 'drawer', 'panel']) {
    note(seen[region] > 0, `${region}: the region was found and scored (${seen[region] || 0} text elements, both palettes)`);
    const list = bad[region] || [];
    note(list.length === 0, `${region}: every small text element meets WCAG AA on navy and on a pale palette`, list.slice(0, 8).join('\n         '));
  }
  const n = results.filter((x) => !x).length;
  console.log(`\nsmalltext1as ${results.length - n}/${results.length}`);
  process.exit(n ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
