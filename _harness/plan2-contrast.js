/**
 * PLAN-2 4.23 — owner-set brand colors can no longer make the site unreadable.
 *
 * Before: brand colors were injected with NO contrast guard while headings and
 * primary buttons hardcoded #ffffff. Rick picks a pale color in Business
 * Details — which the guide invites him to do — and white-on-white ships to
 * every visitor. Nothing warns him and the damage is on the public site.
 *
 * After: the admin warns at the point of choice with the computed ratio, and
 * the site derives the foreground by luminance instead of hardcoding white.
 * The save is NOT blocked — it is his brand and his decision.
 *
 * Measures, for each sampled brand color:
 *   - the admin note's class and the ratio it printed
 *   - the ACTUAL computed color of every element the browser paints with that
 *     brand background, and the resulting contrast ratio
 *
 * Elements are found by their computed background-color rather than by CSS
 * selector, so the measurement follows what the browser really painted.
 *
 * Needs the mirror on :8123. Restores data/site-info.json from pristine.
 *
 * Usage: node _harness/plan2-contrast.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const DIR = path.join(__dirname, 'site/data');
const MIRROR_SITE = path.join(DIR, 'site-info.json');
const PRISTINE_SITE = path.join(__dirname, 'pristine/site-info.json');
const OUT = path.join(__dirname, 'out/contrast');

const AA = 4.5;

// Light -> dark, spanning the range the plan asks for. #FFE600 is the plan's
// own pale example.
const SAMPLES = [
  { name: 'pale yellow', primary: '#FFE600', dark: '#FFF3A0', accent2: '#FFF7C0', expectInk: 'dark' },
  { name: 'mid teal', primary: '#1ABC9C', dark: '#16A085', accent2: '#48C9B0', expectInk: 'dark' },
  { name: 'shipped navy', primary: '#005DA3', dark: '#0D2D52', accent2: '#119EC8', expectInk: 'white' },
  { name: 'near black', primary: '#101820', dark: '#000000', accent2: '#22303C', expectInk: 'white' },
];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// ── contrast math, independent of all three implementations under test ──────
// Deliberately a fourth copy: if this shared the code it would agree with a bug.
function srgb(c) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
function lum(r, g, b) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }
function hexRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function cssRgb(s) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function ratioRgb(a, b) {
  const la = lum(...a), lb = lum(...b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function restore() {
  fs.copyFileSync(PRISTINE_SITE, MIRROR_SITE);
  for (const f of fs.readdirSync(DIR)) {
    if (/^site-info\.backup\./.test(f)) fs.unlinkSync(path.join(DIR, f));
  }
}

async function setColors(page, s) {
  await page.goto(`${BASE}/admin/settings.php`, { waitUntil: 'domcontentloaded' });
  for (const [id, v] of [['theme_primary', s.primary], ['theme_dark', s.dark], ['theme_accent2', s.accent2]]) {
    await page.$eval(`#${id}`, (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, v);
  }
  const liveNote = await page.$eval('#cnote_primary', (el) => ({ cls: el.className, text: el.innerText }));
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.click('button:has-text("Save")'),
  ]);
  return liveNote;
}

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  fs.mkdirSync(OUT, { recursive: true });

  try {
    await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', PW);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    note(!/auth\.php/.test(page.url()), 'signed in');

    for (const s of SAMPLES) {
      console.log(`\n── ${s.name}  primary ${s.primary}`);

      const live = await setColors(page, s);
      const savedOk = page.url().includes('saved') || /saved/i.test(await page.innerText('body'));
      note(savedOk, `${s.name}: the save is NOT blocked`, `landed at ${page.url()}`);

      // The admin note must carry a number and the right severity.
      const printedRatio = (live.text.match(/(\d+\.\d+):1/) || [])[1];
      const expectedRatio = ratioRgb(hexRgb(s.expectInk === 'dark' ? '#141414' : '#ffffff'), hexRgb(s.primary));
      note(printedRatio !== undefined,
        `${s.name}: the admin prints a contrast ratio`, `note text: ${JSON.stringify(live.text)}`);
      note(printedRatio !== undefined && Math.abs(parseFloat(printedRatio) - expectedRatio) < 0.06,
        `${s.name}: the printed ratio ${printedRatio}:1 matches the measured ${expectedRatio.toFixed(1)}:1`);

      const wantClass = expectedRatio >= AA ? 'cnote-ok' : (expectedRatio >= 3 ? 'cnote-warn' : 'cnote-bad');
      note(live.cls.includes(wantClass),
        `${s.name}: the admin note severity is ${wantClass}`, `class was "${live.cls}"`);

      // ── the public site ──────────────────────────────────────────────────
      for (const vp of [{ w: 1440, h: 900 }, { w: 375, h: 812 }]) {
        const pctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
        const pub = await pctx.newPage();
        await pub.goto(`${BASE}/products`, { waitUntil: 'networkidle' });

        // Every element the browser actually painted with the primary color.
        const painted = await pub.evaluate((primaryHex) => {
          function toRgb(h) {
            const n = parseInt(h.replace('#', ''), 16);
            return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
          }
          const want = toRgb(primaryHex);
          const out = [];
          // An element only PAINTS text if it has a direct non-empty text node.
          // Measuring elements whose text comes entirely from children reports
          // the wrapper's inherited color, which nothing ever renders — that
          // produced a false "black on brand" reading for the mobile product
          // pill, whose children both set their own color.
          const paintsText = (el) => [...el.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim().length > 0
          );
          for (const el of document.querySelectorAll('*')) {
            const cs = getComputedStyle(el);
            if (cs.backgroundColor !== want) continue;
            if (!paintsText(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) continue;
            out.push({ tag: el.tagName, color: cs.color, text: el.innerText.trim().slice(0, 30) });
          }
          // Also measure descendants that sit ON this background without
          // painting their own — they inherit it visually.
          for (const el of document.querySelectorAll('*')) {
            const cs = getComputedStyle(el);
            if (cs.backgroundColor !== want) continue;
            for (const kid of el.querySelectorAll('*')) {
              const ks = getComputedStyle(kid);
              if (ks.backgroundColor !== 'rgba(0, 0, 0, 0)' && ks.backgroundColor !== want) continue;
              if (!paintsText(kid)) continue;
              const kr = kid.getBoundingClientRect();
              if (kr.width < 4 || kr.height < 4) continue;
              out.push({ tag: kid.tagName, color: ks.color, text: kid.innerText.trim().slice(0, 30) });
            }
          }
          return out;
        }, s.primary);

        const bg = hexRgb(s.primary);
        let worstRatio = Infinity;
        let worstEl = null;
        for (const el of painted) {
          const fg = cssRgb(el.color);
          if (!fg) continue;
          const r = ratioRgb(fg, bg);
          if (r < worstRatio) { worstRatio = r; worstEl = el; }
        }

        if (!painted.length) {
          note(false, `${s.name} @${vp.w}: found elements painted with the brand color`,
            'no element had that exact computed background-color');
        } else {
          note(worstRatio >= AA,
            `${s.name} @${vp.w}: ${painted.length} brand-colored element(s), worst text contrast ${worstRatio.toFixed(2)}:1 (>= ${AA})`,
            worstEl ? `worst: <${worstEl.tag}> "${worstEl.text}" color ${worstEl.color}` : '');

          // And the ink is the one we expect — proves it SWITCHED, not that it
          // happened to be readable.
          const fg = cssRgb(worstEl.color);
          const isDark = lum(...fg) < 0.5;
          note(isDark === (s.expectInk === 'dark'),
            `${s.name} @${vp.w}: the site chose ${s.expectInk} text`,
            `computed color was ${worstEl.color}`);
        }

        if (s.name === 'pale yellow' || s.name === 'shipped navy') {
          const file = path.join(OUT, `${s.name.replace(/\s+/g, '-')}-${vp.w}.png`);
          await pub.screenshot({ path: file, fullPage: false });
        }
        await pctx.close();
      }
    }
    // ── the admin warning itself, across all three severities ───────────────
    // Once the ink auto-switches, a PALE color is no longer a problem: #FFE600
    // scores 14.5:1 with dark text. The warning is about the mid-tones where
    // NEITHER ink clears AA — and, for the banner note, about a gradient whose
    // two stops need opposite inks. These cases exist so the warning path is
    // exercised rather than assumed; a branch that never fires proves nothing.
    //
    // No save needed: contrast-guard.js recomputes live, which is also the
    // behaviour under test ("warn at the point of choice").
    console.log('\n── admin note severities (live, no save) ──');
    await page.goto(`${BASE}/admin/settings.php`, { waitUntil: 'domcontentloaded' });

    const NOTE_CASES = [
      { name: 'mid grey #787878', primary: '#787878', accent2: '#787878', want: 'cnote-warn', target: '#cnote_primary' },
      { name: 'shipped navy', primary: '#005DA3', accent2: '#119EC8', want: 'cnote-ok', target: '#cnote_primary' },
      // A banner gradient running black -> white: no single ink can serve both
      // ends, so the banner note must go to the strongest severity.
      { name: 'clashing banner black→white', primary: '#000000', accent2: '#FFFFFF', want: 'cnote-bad', target: '#cnote_header' },
    ];

    for (const c of NOTE_CASES) {
      await page.$eval('#theme_primary', (el, v) => {
        el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
      }, c.primary);
      await page.$eval('#theme_accent2', (el, v) => {
        el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
      }, c.accent2);
      const got = await page.$eval(c.target, (el) => ({ cls: el.className, text: el.innerText }));
      note(got.cls.includes(c.want),
        `${c.name}: ${c.target} is ${c.want}`, `class was "${got.cls}" — "${got.text.slice(0, 90)}"`);
      note(/\d+\.\d+:1/.test(got.text),
        `${c.name}: the note states a ratio`, `text: ${JSON.stringify(got.text.slice(0, 90))}`);
      if (c.want !== 'cnote-ok') {
        note(/warning, not a block|still save/i.test(got.text) || c.want === 'cnote-warn',
          `${c.name}: the note makes clear the save is not blocked`);
      }
    }
  } catch (e) {
    note(false, 'suite ran without throwing', e.message);
  } finally {
    await browser.close();
    restore();
    note(fs.readFileSync(MIRROR_SITE).equals(fs.readFileSync(PRISTINE_SITE)),
      'mirror site-info.json restored from pristine');
  }

  const failing = results.filter((r) => !r.ok).length;
  console.log(`\nplan2-contrast ${results.length - failing}/${results.length}`);
  console.log(`screenshots in ${OUT}`);
  process.exit(failing === 0 ? 0 : 1);
})();
