/**
 * PLAN-10 item 6 / AUDIT-10 A10-021 — the admin header must contain its own
 * navigation at 390.
 *
 * The defect: admin/nav.php sets `.ipc-admin-header { height: 60px; display:
 * flex; align-items: center }` and hangs 11 nav items off it. At 390 the <nav>
 * lays out 95px tall from y = -17, inside a 60px bar that does not clip it
 * (overflow: visible), so it escapes at BOTH ends:
 *
 *   - "Products" and "+ Add Product" paint above y = 0 — off the top of the
 *     document and unreachable at any scroll position.
 *   - "View Live Site" and "Sign Out" paint BELOW the blue bar onto the
 *     rgb(240,244,248) page background while keeping color #fff /
 *     rgba(255,255,255,0.5): 1.07:1 and 1.07:1, against 7.53:1 for the links
 *     that stay on the bar.
 *
 * Rick cannot navigate or sign out from a phone. At 834 and 1024 the nav
 * already wraps to two rows INSIDE the bar and every link is legible, so the
 * layout works — the fixed height is what breaks it.
 *
 * What this suite asserts, on a signed-in page at all four viewports:
 *   1. 390 — 0 nav items with top < 0.
 *   2. 390 — 0 nav items whose box extends past the header's own bottom edge.
 *   3. 390 — minimum link contrast >= 4.5:1 (was 1.07).
 *   4. all four — all 11 items present and hit-testable (elementFromPoint at
 *      each centre returns the link/button or a descendant).
 *   5. 1440 — header height 60px, one row: unchanged.
 *   6. the Sign Out <form> still carries its CSRF token — the fix is CSS, and
 *      restructuring that form would be a security change wearing a layout hat.
 *
 * Contrast is computed against the ACTUAL painted backdrop under each link's
 * midpoint, not against an assumed header colour: the whole defect is that
 * some links are no longer on the header.
 *
 * Usage: node _harness/plan10-adminnav.js       (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'plan10');
fs.mkdirSync(OUT, { recursive: true });

const VP = {
  'mobile-390': { width: 390, height: 844 },
  'tablet-834': { width: 834, height: 1112 },
  'tablet-1024': { width: 1024, height: 768 },
  'desktop-1440': { width: 1440, height: 900 },
};

// Every signed-in admin page includes nav.php, so a fix here is site-wide in
// the admin. Three pages rather than one, because $navExtra lets a page inject
// extra items and a header that fits on index.php could still overflow there.
const PAGES = ['/admin/index.php', '/admin/settings.php', '/admin/help.php'];

const MEASURE = `(() => {
  const hdr = document.querySelector('.ipc-admin-header');
  if (!hdr) return { error: 'no .ipc-admin-header' };
  const nav = hdr.querySelector('nav');
  const hr = hdr.getBoundingClientRect();

  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  // The backdrop is what is PAINTED under the point, found by hit-testing the
  // stack — not by walking DOM ancestors. That distinction is the whole
  // finding: the escaping links are still DOM children of the header, so an
  // ancestor walk reports the header's #0d2d52 and scores them 7.53:1, while
  // what a person sees is white-on-#f0f4f8 at 1.07:1. An ancestor walk here
  // would have reported this defect as already fixed.
  const backdropAt = (el, x, y) => {
    const stack = document.elementsFromPoint(x, y);
    for (const n of stack) {
      // Skip the link and its own descendants only. ANCESTORS stay eligible:
      // hit-testing is geometric, so the header appears in this stack exactly
      // when it really covers the point. That is what separates a link still
      // on the bar (backdrop #0d2d52, 7.53:1) from one that has escaped below
      // it (backdrop #f0f4f8, 1.07:1) — the two cases this finding is about.
      if (n === el || el.contains(n)) continue;
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg.length >= 3 && (bg[3] === undefined || bg[3] > 0.95)) return bg.slice(0, 3);
    }
    const b = parse(getComputedStyle(document.body).backgroundColor);
    return b.length >= 3 && (b[3] === undefined || b[3] > 0.95) ? b.slice(0, 3) : [255, 255, 255];
  };
  const ratio = (el, x, y) => {
    const fg = parse(getComputedStyle(el).color);
    const bd = backdropAt(el, x, y);
    const a = fg[3] === undefined ? 1 : fg[3];
    const eff = [0, 1, 2].map((i) => fg[i] * a + bd[i] * (1 - a));
    const L1 = lum(...eff), L2 = lum(...bd);
    return Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100;
  };

  const items = [...nav.querySelectorAll('a, button')].map((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const inView = cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight;
    let hit = null;
    if (inView) { const t = document.elementFromPoint(cx, cy); hit = !!(t && (t === el || el.contains(t))); }
    return {
      t: (el.textContent || '').trim().slice(0, 20),
      top: Math.round(r.top * 10) / 10,
      bottom: Math.round(r.bottom * 10) / 10,
      aboveDoc: r.top < 0,
      belowBar: Math.round(Math.max(0, r.bottom - hr.bottom) * 10) / 10,
      // Sampled just inside the text's own box rather than at the geometric
      // centre: a link that has escaped the bar is only partly off it, and the
      // centre can still land on the header.
      contrast: ratio(el, Math.max(1, Math.min(innerWidth - 1, cx)),
                          Math.max(1, Math.min(innerHeight - 1, r.bottom - Math.min(3, r.height / 3)))),
      inView, hit,
    };
  });

  const logoutForm = hdr.querySelector('form[action="auth.php"], form[action*="auth.php"]');
  return {
    headerHeight: Math.round(hr.height * 10) / 10,
    headerBottom: Math.round(hr.bottom * 10) / 10,
    headerOverflow: getComputedStyle(hdr).overflow,
    navHeight: Math.round(nav.getBoundingClientRect().height * 10) / 10,
    navTop: Math.round(nav.getBoundingClientRect().top * 10) / 10,
    // How many visual rows the nav occupies. Clustered with an 8px tolerance,
    // not bucketed: items on the SAME row differ in height (the "current"
    // link carries padding-bottom plus a border, the Sign Out control is a
    // button), so their y-centres sit a few px apart and a naive bucket
    // reports the one-row desktop header as two.
    navRows: (() => {
      const cs = items.map((i) => (i.top + i.bottom) / 2).sort((a, b) => a - b);
      let rows = cs.length ? 1 : 0;
      for (let k = 1; k < cs.length; k++) if (cs[k] - cs[k - 1] > 8) rows++;
      return rows;
    })(),
    items,
    csrfInLogoutForm: !!(logoutForm && logoutForm.querySelector('input[name="csrf_token"]')),
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `\n         <- ${detail}` : ''}`);
}

async function signIn(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  return page;
}

(async () => {
  const browser = await launch();
  const data = {};

  for (const vp of Object.keys(VP)) {
    const ctx = await browser.newContext({ viewport: VP[vp] });
    const page = await signIn(ctx);
    data[vp] = {};
    for (const url of PAGES) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForSelector('.ipc-admin-header', { state: 'attached' });
      await page.waitForTimeout(120);
      data[vp][url] = await page.evaluate(MEASURE);
    }
    await ctx.close();
    const m = data[vp][PAGES[0]];
    process.stdout.write(`  · ${vp.padEnd(14)} header ${m.headerHeight}px, nav ${m.navHeight}px ` +
      `from y=${m.navTop}, ${m.items.length} items, ${m.navRows} row(s)\n`);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'adminnav.json'), JSON.stringify(data, null, 2));

  const errs = Object.entries(data).flatMap(([vp, ps]) =>
    Object.entries(ps).filter(([, m]) => m.error).map(([u]) => `${vp}${u}`));
  note(errs.length === 0, `every signed-in page renders the admin header (${Object.keys(VP).length} viewports x ${PAGES.length} pages)`, errs.join(', '));

  const ELEVEN = 11;
  for (const vp of Object.keys(VP)) {
    const counts = Object.values(data[vp]).map((m) => m.items.length);
    note(counts.every((c) => c === ELEVEN),
      `${vp}: all ${ELEVEN} nav items present on every admin page (${counts.join('/')})`,
      'nav items were removed or added — A10-033 already records the header being under-described');
  }

  // ── 1 + 2. mobile-390: the bar contains its own nav ───────────────────────
  const m390 = data['mobile-390'];
  for (const url of PAGES) {
    const m = m390[url];
    const above = m.items.filter((i) => i.aboveDoc);
    note(above.length === 0,
      `mobile-390 ${url.replace('/admin/', '')}: 0 nav items paint above the document top ` +
      `(was 2 — "Products" and "+ Add Product" at y=-14)`,
      above.map((i) => `"${i.t}" top ${i.top}`).join(', '));
    const below = m.items.filter((i) => i.belowBar > 0.5);
    note(below.length === 0,
      `mobile-390 ${url.replace('/admin/', '')}: 0 nav items extend below the header's own bottom edge ` +
      `(header ${m.headerHeight}px, nav ${m.navHeight}px — was 95px of nav in a 60px bar)`,
      below.map((i) => `"${i.t}" ${i.belowBar}px past ${m.headerBottom}`).join(', '));
  }

  // ── 3. contrast against the real backdrop ─────────────────────────────────
  for (const vp of Object.keys(VP)) {
    const all = Object.entries(data[vp]).flatMap(([u, m]) => m.items.map((i) => ({ ...i, u })));
    const worst = all.reduce((a, b) => (a && a.contrast <= b.contrast ? a : b), null);
    const fails = all.filter((i) => i.contrast < 4.5);
    note(fails.length === 0,
      `${vp}: every nav item meets 4.5:1 against the surface it actually paints on ` +
      `(worst ${worst.contrast}:1 on "${worst.t}" — was 1.07:1 at 390)`,
      fails.slice(0, 4).map((i) => `"${i.t}" ${i.contrast}:1`).join(', '));
  }

  // ── 4. hit-testable ───────────────────────────────────────────────────────
  for (const vp of Object.keys(VP)) {
    const miss = Object.entries(data[vp]).flatMap(([u, m]) =>
      m.items.filter((i) => !i.inView || i.hit === false).map((i) => `${u.replace('/admin/', '')} "${i.t}"${i.inView ? '' : ' (out of viewport)'}`));
    note(miss.length === 0,
      `${vp}: all ${ELEVEN} nav items are in the viewport and hit-testable at their own centre`,
      miss.slice(0, 5).join(', '));
  }

  // ── 5. desktop is UNCHANGED ───────────────────────────────────────────────
  for (const vp of ['desktop-1440', 'tablet-1024', 'tablet-834']) {
    const m = data[vp][PAGES[0]];
    const expect = vp === 'desktop-1440' ? { h: 60, rows: 1 } : null;
    if (expect) {
      note(m.headerHeight === expect.h && m.navRows === expect.rows,
        `${vp}: header is still ${expect.h}px and one row — unchanged ` +
        `(${m.headerHeight}px, ${m.navRows} row)`);
    }
    note(m.docOverflow === 0,
      `${vp}: no page-level horizontal overflow (${m.docOverflow}px)`);
  }
  note(m390[PAGES[0]].docOverflow === 0,
    `mobile-390: no page-level horizontal overflow (${m390[PAGES[0]].docOverflow}px)`);

  // ── 6. the CSRF token survived ────────────────────────────────────────────
  const noCsrf = Object.entries(data).flatMap(([vp, ps]) =>
    Object.entries(ps).filter(([, m]) => !m.csrfInLogoutForm).map(([u]) => `${vp}${u}`));
  note(noCsrf.length === 0,
    `the Sign Out form still carries its csrf_token on every page x viewport (${Object.keys(VP).length * PAGES.length})`,
    noCsrf.join(', '));

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-adminnav ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'adminnav.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
