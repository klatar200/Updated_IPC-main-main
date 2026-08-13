/**
 * PLAN-10 phase C — items 11 (A10-045) and 12 (A10-046).
 *
 * Rick can re-skin the whole site from Business Details -> Branding. Two
 * classes of colour ignored him:
 *
 *   A10-045  every TRANSLUCENT accent tint was a literal. --brand-primary-rgb
 *            exists and 53 call sites follow it; the accents never got the same
 *            companion variable, so `rgba(0,190,242,0.15)` is baked in — a cyan
 *            hairline under the header on 110 of 110 public page x viewport
 *            rows, 88 cyan chips on /dashboard, cyan-outlined badges.
 *   A10-046  four SOLID navy literals, two of them the first stop of a
 *            two-stop gradient whose second stop is var(--brand-primary). After
 *            a repalette the product-detail header on all 42 product pages
 *            fades from the OLD navy into the NEW colour.
 *
 * ------------------------------------------------------------------ the arms
 *
 * Three arms, because "does it follow the palette" has two different meanings
 * and only one of them is what Rick experiences:
 *
 *   owner  — the REAL path. /data/site-info.json is intercepted and its
 *            `theme` block rewritten, exactly as saving Business Details ->
 *            Branding would. ThemeInjector then derives every --brand-* custom
 *            property from that data. This arm proves BOTH halves of item 11:
 *            that the two new -rgb variables are derived at all, and that the
 *            call sites consume them.
 *   vars   — the audit's own drill: a :root style tag with !important, which
 *            bypasses ThemeInjector entirely. Extended with the two -rgb
 *            variables item 11 adds, since audit10-repalette.js predates them.
 *            This arm proves the call sites follow the VARIABLES, independent
 *            of the derivation.
 *   default— no repalette at all. Every tracked element must be byte-identical
 *            to the pre-change capture in plan10-repalette-baseline.json. A
 *            repalette fix that changes how the shipped site looks is a
 *            regression, not a fix, and this is the arm that catches it.
 *
 * The `default` arm is per ELEMENT, not a global band — the same reason
 * plan10-header-baseline.json and plan10-dashboard-baseline.json are per row.
 * A whole-page average hides a surface that moved by hiding it among the ones
 * that did not.
 *
 * NOT color-mix(). src/App.jsx's ink block states the reason: an unsupported
 * color-mix() makes the declaration invalid, which drops the colour to
 * `inherit` — failing toward unreadable, which is the entire class of bug this
 * machinery exists to prevent. Relative colour syntax (`rgb(from ...)`) has the
 * identical failure mode and is excluded for the identical reason. The fix
 * mirrors --brand-primary-rgb, which has neither.
 *
 * Usage:
 *   node _harness/plan10-repalette.js                  (needs :8123)
 *   node _harness/plan10-repalette.js --save-baseline  (unmodified tree only)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan10');
const BASELINE_FILE = path.join(__dirname, 'plan10-repalette-baseline.json');
const SAVE = process.argv.includes('--save-baseline');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- the palette
// The audit's test palette, which has no blue in it at all, so anything still
// blue afterwards is unambiguous. Same four owner-settable colours the admin's
// Branding editor writes into data/site-info.json.
const OWNER_THEME = {
  primaryColor: '#8a1c5a',
  darkColor: '#3a1200',
  accentColor: '#ff9d2e',
  accent2Color: '#d2691e',
};

// The `vars` arm, at :root with !important. Everything down to
// --brand-accent1-on-dark is audit10-repalette.js's TEST map verbatim; the two
// -rgb entries at the end are the variables item 11 creates. Injecting the -rgb
// companions is not cheating — --brand-primary-rgb is in the audit's own map
// for precisely this reason, and without it the primary's 53 translucent call
// sites would not follow either. The 4.23 ink and text variables are here for
// the same reason the audit put them here: they are set by ThemeInjector as
// INLINE properties on documentElement, so a :root stylesheet that omits them
// leaves them at the shipped palette and every element they paint reads as a
// leak. Item 11 does not touch that derivation.
const VAR_CSS = ':root{' + Object.entries({
  '--brand-primary': '#8a1c5a',
  '--brand-primary-rgb': '138, 28, 90',
  '--brand-primary-hover': '#6f1648',
  '--brand-dark': '#3a1200',
  '--brand-accent': '#ff9d2e',
  '--brand-accent-2': '#d2691e',
  '--brand-primary-ink': '#ffffff',
  '--brand-dark-ink': '#ffffff',
  '--brand-header-ink': '#ffffff',
  '--brand-primary-ink-rgb': '255, 255, 255',
  '--brand-dark-ink-rgb': '255, 255, 255',
  '--brand-header-ink-rgb': '255, 255, 255',
  '--brand-primary-text': '#8a1c5a',
  '--brand-accent-text': '#a04e13',
  '--brand-accent-on-dark': '#e8873a',
  '--brand-accent-on-footer': '#e8873a',
  '--brand-accent1-on-dark': '#ff9d2e',
  '--brand-accent-rgb': '255, 157, 46',
  '--brand-accent-2-rgb': '210, 105, 30',
  // Item 12's four. Deliberately arbitrary non-navy sentinels rather than the
  // values ThemeInjector would derive: this arm's job is "do the call sites
  // follow the variables", and restating the derivation here would only test
  // the test. Whether the derived values are RIGHT is the `owner` arm's job,
  // and it asserts them explicitly below.
  '--brand-dark-2': '#7a2200',
  '--brand-dark-panel': '#6b1e00',
  '--brand-dark-drawer': '#5c1a00',
  '--brand-primary-deep': '#8a3c1e',
}).map(([k, v]) => `${k}:${v} !important;`).join('') + '}';

// ------------------------------------------------------------- what to hunt
// A10-045's two accent literals, as computed-value triples.
const ACCENT_LITERALS = [
  { name: 'accent #00bef2',   rgb: '0, 190, 242' },
  { name: 'accent-2 #119ec8', rgb: '17, 158, 200' },
];
// A10-046's four navy literals. NOT the footer's #0a2240 / rgb(10, 34, 64) and
// NOT its #1a3a5c border: src/index.css states in terms that the footer is a
// hardcoded surface and NOT an owner-set colour, A10-046 excludes both, and the
// .ipc-skip link matches the footer deliberately.
const NAVY_LITERALS = [
  { name: 'product header stop 0 #0a2a52', rgb: '10, 42, 82' },
  { name: 'industries stop 0 #003d7a',     rgb: '0, 61, 122' },
  { name: 'dropdown panel #0e2847',        rgb: '14, 40, 71' },
  { name: 'mobile drawer #0a2444',         rgb: '10, 36, 68' },
];
const HUNT = [...ACCENT_LITERALS, ...NAVY_LITERALS];

// Every colour the shipped palette paints, so the `default` arm captures the
// brand-painting elements structurally rather than by naming them. Includes the
// deliberate footer pair, so a change down there would still be caught.
const TRACKED = [
  '0, 190, 242', '17, 158, 200', '0, 93, 163', '13, 45, 82', '0, 78, 140',
  '10, 42, 82', '0, 61, 122', '14, 40, 71', '10, 36, 68',
  '10, 34, 64', '26, 58, 92',
];

// ---------------------------------------------------------------- the states
const D = { width: 1440, height: 900 };
const M = { width: 390, height: 844 };

const STATES = [
  { slug: 'home',                      url: '/',                             vp: D },
  { slug: 'products',                  url: '/products',                     vp: D },
  { slug: 'products_IP38FE',           url: '/products?productId=IP38FE',    vp: D },
  { slug: 'dashboard',                 url: '/dashboard',                    vp: D },
  { slug: 'contact',                   url: '/contact',                      vp: D },
  { slug: 'industries',                url: '/industries',                   vp: D },
  {
    slug: 'home_megadropdown', url: '/', vp: D,
    // aria-haspopup is how the trigger identifies itself; the panel opens on
    // mouseenter as well as click. Same shape audit10-repalette.js drives.
    open: async (page) => {
      const btn = page.locator('button[aria-haspopup="true"]').first();
      await btn.hover().catch(() => {});
      await page.waitForTimeout(250);
      if (!(await page.locator('.ipc-dropdown-panel').count())) await btn.click().catch(() => {});
      await page.waitForTimeout(400);
      return (await page.locator('.ipc-dropdown-panel').count()) > 0;
    },
  },
  {
    slug: 'home_mobile_drawer', url: '/', vp: M,
    open: async (page) => {
      await page.click('button[aria-label="Open menu"]').catch(() => {});
      await page.waitForTimeout(500);
      return (await page.locator('[role="dialog"]').count()) > 0;
    },
  },
];

// ----------------------------------------------------------------- measuring
// Read in the browser, not from the source (PLAN-10 §1.7). Document order is
// the element key: this plan changes colour VALUES only, never the DOM, so a
// shifted index is itself a finding and the `default` arm reports it as one.
const SCAN = `(() => {
  const PROPS = ['backgroundColor','backgroundImage','borderTopColor','borderRightColor',
                 'borderBottomColor','borderLeftColor','color','fill','stroke'];
  const TRACKED = ${JSON.stringify(TRACKED)};
  const all = document.querySelectorAll('*');
  const out = [];
  for (let i = 0; i < all.length; i++) {
    const cs = getComputedStyle(all[i]);
    const s = {};
    let joined = '';
    for (const p of PROPS) { s[p] = cs[p]; joined += cs[p] + '|'; }
    if (!TRACKED.some((t) => joined.indexOf(t) > -1)) continue;
    out.push({ i, tag: all[i].tagName,
               cls: (all[i].getAttribute('class') || '').slice(0, 48), s });
  }
  return out;
})()`;

// Every gradient on the page, in document order, for the per-STOP diff item 12
// needs: a gradient whose string changes can still have a stop that did not.
const GRADS = `(() => [...document.querySelectorAll('*')]
  .map((e) => getComputedStyle(e).backgroundImage)
  .filter((v) => /linear-gradient/.test(v)))()`;

// The three named surfaces item 11's acceptance 2 calls out. Located
// STRUCTURALLY — by class shape and by "has a translucent tint at all" — never
// by the cyan value itself, or the probe would stop finding them the moment the
// fix worked and every assertion would pass vacuously.
const NAMED = `(() => {
  const tinted = (v) => /^rgba\\(/.test(v) && !/,\\s*0\\)$/.test(v);
  const h = document.querySelector('header');
  // The hero's "Bolingbrook, IL" eyebrow pill: the one inline-flex chip in the
  // hero that carries both a tint and a 1px outline.
  const badge = [...document.querySelectorAll('div.inline-flex.tracking-widest')]
    .filter((e) => { const cs = getComputedStyle(e); return tinted(cs.backgroundColor) && cs.borderTopWidth === '1px'; })[0] || null;
  // /dashboard's part-type chips: uppercase spans on a translucent tint.
  const chips = [...document.querySelectorAll('span')]
    .filter((e) => { const cs = getComputedStyle(e); return tinted(cs.backgroundColor) && cs.textTransform === 'uppercase'; });
  return {
    headerBorderBottom: h ? getComputedStyle(h).borderBottomColor : null,
    badgeBorder: badge ? getComputedStyle(badge).borderTopColor : null,
    badgeBg: badge ? getComputedStyle(badge).backgroundColor : null,
    chipCount: chips.length,
    chipBg: chips.length ? getComputedStyle(chips[0]).backgroundColor : null,
    accentRgbVar: getComputedStyle(document.documentElement).getPropertyValue('--brand-accent-rgb').trim(),
    accent2RgbVar: getComputedStyle(document.documentElement).getPropertyValue('--brand-accent-2-rgb').trim(),
    brandPrimary: getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim(),
    brandDark: getComputedStyle(document.documentElement).getPropertyValue('--brand-dark').trim(),
    shades: ['--brand-dark-2', '--brand-dark-panel', '--brand-dark-drawer', '--brand-primary-deep']
      .reduce((o, k) => (o[k] = getComputedStyle(document.documentElement).getPropertyValue(k).trim(), o), {}),
  };
})()`;

function hunt(scan) {
  // Which of the literals still paint, and on how many elements.
  const found = {};
  for (const lit of HUNT) {
    let n = 0;
    const where = [];
    for (const el of scan) {
      const joined = Object.values(el.s).join('|');
      if (joined.indexOf(lit.rgb) > -1) {
        n++;
        if (where.length < 3) where.push(`${el.tag}${el.cls ? '.' + el.cls.split(/\s+/)[0] : ''}`);
      }
    }
    if (n) found[lit.name] = { count: n, where };
  }
  return found;
}

function stopsOf(s) { return s.match(/rgba?\([^)]+\)/g) || []; }

function frozenStops(before, after) {
  const out = [];
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    if (before[i] === after[i]) continue;      // wholly unmoved -> not this finding
    const b = stopsOf(before[i]), a = stopsOf(after[i]);
    for (let s = 0; s < Math.min(b.length, a.length); s++) {
      if (b[s] === a[s]) out.push({ el: i, stop: s, colour: b[s], before: before[i], after: after[i] });
    }
  }
  return out;
}

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `\n         <- ${detail}` : ''}`);
}

async function settle(page) {
  // Scroll the page so lazy/in-view content has painted before we read it.
  await page.evaluate(`(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  })()`);
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await launch();
  const captured = {};

  for (const st of STATES) {
    const ctx = await browser.newContext({ viewport: st.vp });

    // ---- arm `default` + arm `vars`, in one context -----------------------
    const page = await ctx.newPage();
    await page.goto(BASE + st.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await settle(page);
    if (st.open) await st.open(page);

    const defaultScan = await page.evaluate(SCAN);
    const defaultGrads = await page.evaluate(GRADS);
    const defaultNamed = await page.evaluate(NAMED);

    await page.addStyleTag({ content: VAR_CSS });
    await page.waitForTimeout(400);
    if (st.open) await st.open(page);
    const varsScan = await page.evaluate(SCAN);
    const varsGrads = await page.evaluate(GRADS);
    const varsNamed = await page.evaluate(NAMED);
    await page.close();

    // ---- arm `owner`: rewrite the theme in /data/site-info.json -----------
    const page2 = await ctx.newPage();
    let intercepted = false;
    await page2.route('**/data/site-info.json*', async (route) => {
      const res = await route.fetch();
      let body;
      try { body = JSON.parse(await res.text()); } catch { return route.fulfill({ response: res }); }
      body.theme = { ...(body.theme || {}), ...OWNER_THEME };
      intercepted = true;
      await route.fulfill({
        response: res,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
    await page2.goto(BASE + st.url, { waitUntil: 'networkidle' });
    await page2.waitForTimeout(600);
    await settle(page2);
    if (st.open) await st.open(page2);
    const ownerScan = await page2.evaluate(SCAN);
    const ownerGrads = await page2.evaluate(GRADS);
    const ownerNamed = await page2.evaluate(NAMED);
    await page2.close();
    await ctx.close();

    captured[st.slug] = {
      intercepted,
      default: { scan: defaultScan, grads: defaultGrads, named: defaultNamed },
      vars:    { scan: varsScan,    grads: varsGrads,    named: varsNamed },
      owner:   { scan: ownerScan,   grads: ownerGrads,   named: ownerNamed },
    };
    process.stdout.write(`  · ${st.slug.padEnd(22)} ${defaultScan.length} tracked els, ` +
      `${defaultGrads.length} gradients${st.open ? ', opened' : ''}\n`);
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'repalette.json'), JSON.stringify(captured, null, 2));

  // ------------------------------------------------------------- baseline IO
  if (SAVE) {
    const base = {
      _note: 'Computed paint properties of every brand-painting element, in document ' +
             'order, captured from the UNMODIFIED tree with the DEFAULT palette. A ' +
             'repalette change that alters the default render is a regression, not a ' +
             'fix, and this is the arm that catches it. Per element, not a global band ' +
             '— an average hides a surface that moved among the ones that did not. ' +
             'RE-BASING IS A DELIBERATE, REVIEWED ACT, NOT A WAY TO QUIET THE SUITE: ' +
             'regenerating a baseline that a regression is hiding in launders the ' +
             'regression, so name the per-element delta first and record why every ' +
             'difference is intended. The first capture was taken 2026-08-10, before ' +
             'PLAN-10 phase C. It was re-based on 2026-08-13 after that phase and the ' +
             'UX audit (PR #42) both merged and legitimately changed the DOM around the ' +
             'palette: five element-set mismatches, all explained in ' +
             'audit-runs/audit4.md D-02, against which every gradient and both live ' +
             'arms still passed. Run it from a tree that builds clean and whose other ' +
             'suites pass — a baseline captured over a broken build is worse than a ' +
             'stale one.',
      captured: new Date().toISOString().slice(0, 10),
      rebased_over: 'PLAN-10 phase C + UX audit PR #42 (audit-runs/audit4.md D-02)',
      states: {},
    };
    for (const slug of Object.keys(captured)) {
      base.states[slug] = {
        scan: captured[slug].default.scan,
        grads: captured[slug].default.grads,
        named: captured[slug].default.named,
      };
    }
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(base, null, 2));
    console.log(`\nbaseline saved -> ${BASELINE_FILE}`);
    process.exit(0);
  }

  const BASELINE = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).states;

  // ═══════════════════════════════════════════════ item 11 — accent tints ══
  console.log('\nitem 11 · A10-045 — translucent accent tints follow the owner palette');

  for (const arm of ['owner', 'vars']) {
    const leaks = {};
    for (const slug of Object.keys(captured)) {
      const f = hunt(captured[slug][arm].scan);
      for (const lit of ACCENT_LITERALS) if (f[lit.name]) {
        leaks[slug] = leaks[slug] || {};
        leaks[slug][lit.name] = f[lit.name];
      }
    }
    const total = Object.values(leaks).reduce(
      (a, s) => a + Object.values(s).reduce((b, v) => b + v.count, 0), 0);
    note(total === 0,
      `[${arm}] after a repalette, rgba(0,190,242,..) and rgba(17,158,200,..) paint on ` +
      `0 elements across ${STATES.length} page-states (was 120)`,
      Object.entries(leaks).slice(0, 4).map(([s, v]) =>
        `${s}: ` + Object.entries(v).map(([n, d]) => `${n} x${d.count} (${d.where.join(', ')})`).join('; ')
      ).join('\n            '));
  }

  // The derivation itself: the two variables must EXIST and must move with the
  // owner's colour. Without this, the call sites could be following a variable
  // that is permanently at its index.css default and nothing would look wrong.
  const home = captured.home;
  note(home.default.named.accentRgbVar === '0, 190, 242' &&
       home.default.named.accent2RgbVar === '17, 158, 200',
    `--brand-accent-rgb / --brand-accent-2-rgb exist and default to the shipped palette ` +
    `("${home.default.named.accentRgbVar}" / "${home.default.named.accent2RgbVar}", was "" / "")`);
  note(home.owner.named.accentRgbVar === '255, 157, 46' &&
       home.owner.named.accent2RgbVar === '210, 105, 30',
    `ThemeInjector derives both from the owner's accentColor / accent2Color ` +
    `("${home.owner.named.accentRgbVar}" / "${home.owner.named.accent2RgbVar}")`);

  // Acceptance 2, by name: the header hairline, the homepage badge and the
  // /dashboard chips are the three surfaces the finding leads with.
  const hairlineMoved = Object.keys(captured).filter((slug) => {
    const d = captured[slug].default.named.headerBorderBottom;
    const o = captured[slug].owner.named.headerBorderBottom;
    return d && o && d !== o;
  });
  note(hairlineMoved.length === STATES.length,
    `the header hairline repaints on ${hairlineMoved.length}/${STATES.length} page-states ` +
    `(${home.default.named.headerBorderBottom} -> ${home.owner.named.headerBorderBottom})`,
    Object.keys(captured).filter((s) => !hairlineMoved.includes(s)).join(', '));

  // Each of the two below asserts the DEFAULT value is the audited cyan as well
  // as that it moves, so a probe that stopped finding the element could not
  // pass by measuring nothing.
  note(/^rgba\(0, 190, 242/.test(home.default.named.badgeBorder || '') &&
       !/0, 190, 242/.test(home.owner.named.badgeBorder || ''),
    `the homepage badge outline is cyan by default and repaints ` +
    `(${home.default.named.badgeBorder} -> ${home.owner.named.badgeBorder})`);

  const dash = captured.dashboard;
  // 84, not 42: /dashboard keeps both renders in the DOM — the desktop <td>
  // chip and the mobile card chip — and only one is shown per viewport.
  note(dash.default.named.chipCount === 84 &&
       /^rgba\(17, 158, 200/.test(dash.default.named.chipBg || '') &&
       !/17, 158, 200/.test(dash.owner.named.chipBg || ''),
    `/dashboard's ${dash.default.named.chipCount} part-type chips are cyan-tinted by ` +
    `default and repaint (${dash.default.named.chipBg} -> ${dash.owner.named.chipBg})`);

  // ═════════════════════════════════════════ item 12 — navy solids/stops ══
  console.log('\nitem 12 · A10-046 — the navy literals follow the owner palette');

  for (const arm of ['owner', 'vars']) {
    const leaks = {};
    for (const slug of Object.keys(captured)) {
      const f = hunt(captured[slug][arm].scan);
      for (const lit of NAVY_LITERALS) if (f[lit.name]) {
        leaks[slug] = leaks[slug] || {};
        leaks[slug][lit.name] = f[lit.name];
      }
    }
    const total = Object.values(leaks).reduce(
      (a, s) => a + Object.values(s).reduce((b, v) => b + v.count, 0), 0);
    note(total === 0,
      `[${arm}] after a repalette, the four navy literals paint on 0 elements`,
      Object.entries(leaks).slice(0, 4).map(([s, v]) =>
        `${s}: ` + Object.entries(v).map(([n, d]) => `${n} x${d.count} (${d.where.join(', ')})`).join('; ')
      ).join('\n            '));
  }

  // The derivation itself. Byte-identity on the shipped palette is not a happy
  // accident of the formula — it is the whole reason the formula is anchored on
  // the shipped base — so it is asserted directly, in the variables, as well as
  // through the rendered pixels in the `default` arm below.
  const SHIPPED = {
    '--brand-dark-2': 'rgb(10, 42, 82)',
    '--brand-dark-panel': 'rgb(14, 40, 71)',
    '--brand-dark-drawer': 'rgb(10, 36, 68)',
    '--brand-primary-deep': 'rgb(0, 61, 122)',
  };
  const wrong = Object.keys(SHIPPED).filter((k) => home.default.named.shades[k] !== SHIPPED[k]);
  note(wrong.length === 0,
    'at the default palette ThemeInjector re-derives all four shades to exactly their ' +
    'former literal, so the deployed site does not change',
    wrong.map((k) => `${k}: ${SHIPPED[k]} expected, got "${home.default.named.shades[k]}"`).join('\n            '));

  const stuck = Object.keys(SHIPPED).filter((k) => home.owner.named.shades[k] === SHIPPED[k]);
  note(stuck.length === 0,
    `on the owner's palette all four shades move ` +
    `(${Object.entries(home.owner.named.shades).map(([k, v]) => `${k.replace('--brand-', '')} ${v}`).join(', ')})`,
    stuck.join(', '));

  // Per-STOP, because a gradient whose string changes can still hold a stop
  // that did not move — which is exactly what A10-046 measured.
  for (const arm of ['owner', 'vars']) {
    for (const slug of ['products_IP38FE', 'industries']) {
      const frozen = frozenStops(captured[slug].default.grads, captured[slug][arm].grads);
      note(frozen.length === 0,
        `[${arm}] ${slug}: 0 frozen stops in any changed gradient ` +
        `(${captured[slug].default.grads.length} sampled; was 1 and 5)`,
        frozen.slice(0, 2).map((f) => `stop ${f.stop} stuck at ${f.colour}\n            ${f.before}\n            -> ${f.after}`).join('\n            '));
    }
  }

  // The two solid panels, by name.
  for (const [slug, label] of [['home_megadropdown', 'mega-dropdown panel'], ['home_mobile_drawer', 'mobile drawer']]) {
    const before = captured[slug].default.scan;
    const after = captured[slug].owner.scan;
    const lit = slug === 'home_megadropdown' ? '14, 40, 71' : '10, 36, 68';
    const stuck = after.filter((e) => Object.values(e.s).join('|').indexOf(lit) > -1);
    const had = before.filter((e) => Object.values(e.s).join('|').indexOf(lit) > -1);
    note(had.length > 0 && stuck.length === 0,
      `[owner] the ${label} background moves (${had.length} element(s) painted rgb(${lit}) ` +
      `by default, ${stuck.length} after)`,
      stuck.slice(0, 3).map((e) => `${e.tag}.${e.cls}`).join(', '));
  }

  // ══════════════════════════ both items — the shipped site does not change ══
  console.log('\nitems 11 + 12 · the DEFAULT palette renders byte-identically');

  for (const slug of Object.keys(captured)) {
    const now = captured[slug].default.scan;
    const was = (BASELINE[slug] || {}).scan;
    if (!was) { note(false, `${slug}: no pre-change baseline`, 'run --save-baseline on the unmodified tree'); continue; }

    if (now.length !== was.length) {
      note(false, `${slug}: the brand-painting element set is unchanged`,
        `${was.length} elements before, ${now.length} now — the fix moved a surface into or out of the palette`);
      continue;
    }
    const drift = [];
    for (let k = 0; k < was.length; k++) {
      for (const p of Object.keys(was[k].s)) {
        if (was[k].s[p] !== now[k].s[p]) {
          drift.push(`${was[k].tag}${was[k].cls ? '.' + was[k].cls.split(/\s+/)[0] : ''} ` +
                     `${p}: ${was[k].s[p]} -> ${now[k].s[p]}`);
        }
      }
    }
    note(drift.length === 0,
      `${slug}: all ${now.length} brand-painting elements byte-identical to the pre-change capture`,
      drift.slice(0, 6).join('\n            ') + (drift.length > 6 ? `\n            (+${drift.length - 6} more)` : ''));
  }

  for (const slug of Object.keys(captured)) {
    const now = captured[slug].default.grads;
    const was = (BASELINE[slug] || {}).grads || [];
    const bad = [];
    for (let k = 0; k < Math.max(now.length, was.length); k++) {
      if (now[k] !== was[k]) bad.push(`[${k}] ${was[k] || '(absent)'}\n            -> ${now[k] || '(absent)'}`);
    }
    note(bad.length === 0,
      `${slug}: all ${now.length} gradients byte-identical to the pre-change capture`,
      bad.slice(0, 3).join('\n            '));
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-repalette ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'repalette.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
