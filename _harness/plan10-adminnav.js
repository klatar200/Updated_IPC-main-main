/**
 * The admin menu bar works at every width — PLAN-10 item 6 / AUDIT-10 A10-021,
 * rewritten for PLAN-13 Phase 2's grouped sticky bar (2026-10-31).
 *
 * The original defect (A10-021): admin/nav.php hung 11 flat links off a fixed
 * 60px bar. At 390 the nav laid out 95px tall from y = -17, so "Products" and
 * "+ Add Product" painted above the document top (unreachable at any scroll
 * position) and "View Live Site" and "Sign Out" painted below the bar onto the
 * page background at 1.07:1. Rick could neither navigate nor sign out from a
 * phone. This suite measured exactly that and kept it fixed.
 *
 * PLAN-13 Phase 2 replaced the eleven links with six grouped entries
 * (<details> drop-downs) and, below 900px, a Menu button that opens the same
 * groups as a panel under the bar. The failure modes are the same kind —
 * an entry you cannot see, cannot reach or cannot read — so the suite asks
 * the same questions of the new shape:
 *
 *   1. every signed-in page renders the bar (4 viewports x 4 pages)
 *   2. the census: 6 top-level entries and 13 menu links, the SAME on every
 *      page (pages no longer inject their own — PLAN-13 §2 A4)
 *   3. the bar is one row: 60px at 1024 and 1440; at 390 and 834 at most
 *      80px, with the Menu button on screen and tappable
 *   4. 1024 / 1440: every top-level entry, and every link inside each
 *      drop-down once it is opened, is on screen, hit-testable at its own
 *      centre and >= 4.5:1 against what is actually painted under it
 *   5. 390 / 834: with the Menu panel open, every menu link is on screen (or
 *      reachable by scrolling the panel), hit-testable, >= 4.5:1 and at least
 *      44px tall (A12-L7-01-W5-4)
 *   6. keyboard: Tab reaches a drop-down, Enter opens it, Escape closes it and
 *      puts focus back on it
 *   7. JavaScript off: a drop-down still opens (it is a <details>), and on a
 *      phone every link is still on the page
 *   8. the bar stays on screen after scrolling (sticky)
 *   9. no page-level horizontal overflow
 *  10. the Sign Out <form> still carries its CSRF token
 *
 * Contrast is computed against the ACTUAL painted backdrop under each link's
 * midpoint (hit-testing the stack), not against an assumed colour: the whole
 * of A10-021 was links that were no longer on the surface their colour
 * assumed.
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
  'mobile-390': { width: 390, height: 844, touch: true },
  'tablet-834': { width: 834, height: 1112, touch: true },
  'tablet-1024': { width: 1024, height: 768, touch: false },
  'desktop-1440': { width: 1440, height: 900, touch: false },
};
const PHONE = (vp) => VP[vp].width < 900;

// upload-image.php used to inject the most page-specific links (two); it
// stays in the set to prove no page does any more.
const PAGES = ['/admin/home.php', '/admin/index.php', '/admin/settings.php', '/admin/help.php', '/admin/upload-image.php?sku=IP38FE'];
const TOP_ENTRIES = 6;
const MENU_LINKS = 13; // 2 Products + 4 Website + Inquiries + 2 History + Help + Password, View Live Site, Sign Out

// Measures what a person can see and reach in the bar right now.
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
  const backdropAt = (el, x, y) => {
    for (const n of document.elementsFromPoint(x, y)) {
      if (n === el || el.contains(n)) continue;
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg.length >= 3 && (bg[3] === undefined || bg[3] > 0.95)) return bg.slice(0, 3);
    }
    const b = parse(getComputedStyle(document.body).backgroundColor);
    return b.length >= 3 && (b[3] === undefined || b[3] > 0.95) ? b.slice(0, 3) : [255, 255, 255];
  };
  // The element's own fill, when it has a solid one, is what its text sits
  // on (the current-page pill); otherwise what is painted under it.
  const surface = (el, x, y) => {
    const own = parse(getComputedStyle(el).backgroundColor);
    return own.length >= 3 && (own[3] === undefined || own[3] > 0.95) ? own.slice(0, 3) : backdropAt(el, x, y);
  };
  const ratio = (el, x, y) => {
    const fg = parse(getComputedStyle(el).color);
    const bd = surface(el, x, y);
    const a = fg[3] === undefined ? 1 : fg[3];
    const eff = [0, 1, 2].map((i) => fg[i] * a + bd[i] * (1 - a));
    const L1 = lum(...eff), L2 = lum(...bd);
    return Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100;
  };
  const describe = (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const visible = el.checkVisibility ? el.checkVisibility() : (r.width > 0 && r.height > 0);
    const inView = visible && r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5;
    let hit = null;
    if (inView) { const t = document.elementFromPoint(cx, cy); hit = !!(t && (t === el || el.contains(t))); }
    return {
      t: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24),
      top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      visible, inView, hit,
      contrast: visible ? ratio(el, Math.max(1, Math.min(innerWidth - 1, cx)), Math.max(1, Math.min(innerHeight - 1, cy))) : null,
    };
  };
  const tops = [...nav.querySelectorAll(':scope > details > summary, :scope > a')];
  const links = [...nav.querySelectorAll('.nav-pop a, .nav-pop button')];
  const toggle = hdr.querySelector('.menu-toggle');
  const logoutForm = hdr.querySelector('form[action*="auth.php"]');
  return {
    headerHeight: Math.round(hr.height * 10) / 10,
    headerTop: Math.round(hr.top),
    topCount: tops.length,
    linkCount: tops.filter((e) => e.tagName === 'A').length + links.length,
    tops: tops.map(describe),
    links: links.map(describe),
    toggle: toggle ? describe(toggle) : null,
    navDisplay: getComputedStyle(nav).display,
    panelScrolls: nav.scrollHeight > nav.clientHeight + 1,
    csrfInLogoutForm: !!(logoutForm && logoutForm.querySelector('input[name="csrf_token"]')),
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `\n         <- ${detail}` : ''}`);
}
const lbl = (u) => u.replace('/admin/', '').replace(/\?.*/, '');
const bad = (items, pred) => items.filter(pred).map((i) => `"${i.t}"`).join(', ');

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
  let cookies = null;

  for (const vp of Object.keys(VP)) {
    const { width, height, touch } = VP[vp];
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    const page = await signIn(ctx);
    if (!cookies) cookies = await ctx.cookies();
    data[vp] = {};
    for (const url of PAGES) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForSelector('.ipc-admin-header', { state: 'attached' });
      const d = { closed: await page.evaluate(MEASURE) };
      if (d.closed.error) { data[vp][url] = d; continue; }
      if (PHONE(vp)) {
        await page.click('.menu-toggle');
        await page.waitForTimeout(100);
        d.open = await page.evaluate(MEASURE);
        // Links below the fold of a scrolling panel: scroll each into view in
        // turn and measure it there, as a thumb would.
        d.scrolled = [];
        const n = await page.locator('.ipc-admin-header .nav-pop a, .ipc-admin-header .nav-pop button').count();
        for (let i = 0; i < n; i++) {
          const loc = page.locator('.ipc-admin-header .nav-pop a, .ipc-admin-header .nav-pop button').nth(i);
          await loc.scrollIntoViewIfNeeded();
          d.scrolled.push((await page.evaluate(MEASURE)).links[i]);
        }
        await page.click('.menu-toggle');
      } else {
        d.groups = [];
        const summaries = page.locator('.ipc-admin-header nav > details > summary');
        for (let i = 0; i < await summaries.count(); i++) {
          await summaries.nth(i).click();
          await page.waitForTimeout(80);
          const m = await page.evaluate(MEASURE);
          d.groups.push({ name: (await summaries.nth(i).innerText()).trim(),
            open: m.links.filter((l) => l.visible), openCount: await page.locator('.ipc-admin-header details[open]').count() });
        }
        await page.keyboard.press('Escape');
      }
      // Sticky: scroll and look again.
      d.afterScroll = await page.evaluate(async () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        if (max < 200) return { skip: true };
        scrollTo(0, Math.round(max * 0.6));
        await new Promise((r) => setTimeout(r, 120));
        const rc = document.querySelector('.ipc-admin-header').getBoundingClientRect();
        return { top: Math.round(rc.top), bottom: Math.round(rc.bottom) };
      });
      data[vp][url] = d;
    }

    if (vp === 'desktop-1440') {
      // Keyboard: Tab from the logo to the first drop-down, Enter, Escape.
      await page.goto(BASE + '/admin/index.php', { waitUntil: 'networkidle' });
      await page.focus('.ipc-admin-header .logo');
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim());
      await page.keyboard.press('Enter');
      const opened = await page.evaluate(() => !!document.activeElement.closest('details') && document.activeElement.closest('details').open);
      await page.keyboard.press('Tab');
      const intoMenu = await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.nav-pop')));
      await page.keyboard.press('Escape');
      const after = await page.evaluate(() => ({
        open: document.querySelectorAll('.ipc-admin-header details[open]').length,
        focus: document.activeElement && document.activeElement.tagName.toLowerCase(),
      }));
      data.keyboard = { focused, opened, intoMenu, after };
      // An outside click closes an open drop-down. x = 5 is the page margin
      // beside the centred container, so the click lands on nothing that acts.
      await page.click('.ipc-admin-header nav > details:nth-of-type(2) > summary');
      await page.mouse.click(5, 600);
      data.outsideClick = await page.locator('.ipc-admin-header details[open]').count();
    }
    await ctx.close();
    const m = data[vp][PAGES[0]].closed;
    process.stdout.write(`  · ${vp.padEnd(14)} bar ${m.headerHeight}px, ${m.topCount} entries, ${m.linkCount} links${PHONE(vp) ? ', Menu button' : ''}\n`);
  }

  // JavaScript off.
  data.noJs = {};
  for (const vp of ['desktop-1440', 'mobile-390']) {
    const { width, height, touch } = VP[vp];
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, javaScriptEnabled: false });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
    const before = await page.evaluate(MEASURE);
    await page.click('.ipc-admin-header nav > details:nth-of-type(2) > summary');
    const after = await page.evaluate(MEASURE);
    data.noJs[vp] = { before, after };
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'adminnav.json'), JSON.stringify(data, null, 2));

  // ── 1. renders ────────────────────────────────────────────────────────────
  const errs = Object.keys(VP).flatMap((vp) => PAGES.filter((u) => data[vp][u].closed.error).map((u) => `${vp} ${lbl(u)}`));
  note(errs.length === 0, `every signed-in page renders the admin bar (${Object.keys(VP).length} viewports x ${PAGES.length} pages)`, errs.join(', '));
  if (errs.length) { console.log(`\nplan10-adminnav ${results.filter((r) => r.ok).length}/${results.length}`); process.exit(1); }

  // ── 2. census ─────────────────────────────────────────────────────────────
  for (const vp of Object.keys(VP)) {
    const c = PAGES.map((u) => `${data[vp][u].closed.topCount}/${data[vp][u].closed.linkCount}`);
    note(PAGES.every((u) => data[vp][u].closed.topCount === TOP_ENTRIES && data[vp][u].closed.linkCount === MENU_LINKS),
      `${vp}: ${TOP_ENTRIES} top-level entries and ${MENU_LINKS} menu links on every page, none page-specific (${c.join(' · ')})`);
  }

  // ── 3. one row ────────────────────────────────────────────────────────────
  for (const vp of Object.keys(VP)) {
    const hs = PAGES.map((u) => data[vp][u].closed.headerHeight);
    if (PHONE(vp)) {
      const m = data[vp][PAGES[0]].closed;
      note(hs.every((h) => h <= 80) && m.toggle && m.toggle.hit && m.navDisplay === 'none',
        `${vp}: bar is one row (${hs.join('/')}px, at most 80), the menu folded behind a tappable Menu button`,
        `toggle ${JSON.stringify(m.toggle)}, nav display ${m.navDisplay}`);
    } else {
      const m = data[vp][PAGES[0]].closed;
      const rows = new Set(m.tops.map((t) => Math.round((t.top + t.bottom) / 2 / 8))).size;
      note(hs.every((h) => h === 60) && rows === 1,
        `${vp}: bar is 60px and one row on every page (${hs.join('/')}px, ${rows} row)`);
    }
  }

  // ── 4. desktop: entries and every drop-down ───────────────────────────────
  for (const vp of Object.keys(VP).filter((v) => !PHONE(v))) {
    const all = PAGES.flatMap((u) => data[vp][u].closed.tops);
    note(all.every((t) => t.inView && t.hit), `${vp}: every top-level entry is on screen and hit-testable at its centre`,
      bad(all, (t) => !t.inView || !t.hit));
    const worst = all.reduce((a, b) => (a.contrast <= b.contrast ? a : b));
    note(all.every((t) => t.contrast >= 4.5), `${vp}: every top-level entry >= 4.5:1 against what it paints on (worst ${worst.contrast}:1 "${worst.t}")`,
      bad(all, (t) => t.contrast < 4.5));
    const groups = PAGES.flatMap((u) => data[vp][u].groups);
    const shown = groups.reduce((n, g) => n + g.open.length, 0);
    note(groups.every((g) => g.open.length > 0 && g.openCount === 1),
      `${vp}: each of the ${groups.length / PAGES.length} drop-downs opens alone and shows its links (${shown / PAGES.length} links)`,
      groups.filter((g) => !g.open.length || g.openCount !== 1).map((g) => `${g.name}: ${g.open.length} links, ${g.openCount} open`).join(', '));
    const links = groups.flatMap((g) => g.open);
    note(links.every((l) => l.inView && l.hit), `${vp}: every link in an open drop-down is on screen and hit-testable`,
      bad(links, (l) => !l.inView || !l.hit));
    note(links.every((l) => l.contrast >= 4.5), `${vp}: every drop-down link >= 4.5:1 (worst ${Math.min(...links.map((l) => l.contrast))}:1)`,
      bad(links, (l) => l.contrast < 4.5));
  }

  // ── 5. phone: the Menu panel ──────────────────────────────────────────────
  for (const vp of Object.keys(VP).filter(PHONE)) {
    const opens = PAGES.map((u) => data[vp][u]);
    const tops = opens.flatMap((d) => d.open.tops);
    note(opens.every((d) => d.open.navDisplay !== 'none') && tops.every((t) => t.visible && t.hit !== false),
      `${vp}: Menu opens the panel with all ${TOP_ENTRIES} entries`, bad(tops, (t) => !t.visible || t.hit === false));
    const links = opens.flatMap((d) => d.scrolled);
    note(links.length === PAGES.length * (MENU_LINKS - 2) && links.every((l) => l && l.inView && l.hit),
      `${vp}: every link in the panel is on screen (scrolling the panel if needed) and tappable (${links.length})`,
      bad(links.filter(Boolean), (l) => !l.inView || !l.hit));
    note(links.every((l) => l && l.contrast >= 4.5), `${vp}: every panel link >= 4.5:1 against the panel`,
      bad(links.filter(Boolean), (l) => l.contrast < 4.5));
    const small = [...tops, ...links].filter((l) => l && l.h < 44);
    note(small.length === 0, `${vp}: every panel entry and link is at least 44px tall`, small.map((l) => `"${l.t}" ${l.h}px`).join(', '));
  }

  // ── 6. keyboard ───────────────────────────────────────────────────────────
  const k = data.keyboard;
  note(k.focused === 'Products' && k.opened && k.intoMenu,
    `1440 keyboard: Tab reaches "Products", Enter opens it, Tab moves into its links (${JSON.stringify(k.focused)}, open ${k.opened}, into ${k.intoMenu})`);
  note(k.after.open === 0 && k.after.focus === 'summary', `1440 keyboard: Escape closes it and returns focus to the entry (${JSON.stringify(k.after)})`);
  note(data.outsideClick === 0, `1440: a click outside the bar closes an open drop-down (${data.outsideClick} left open)`);

  // ── 7. JavaScript off ─────────────────────────────────────────────────────
  {
    const d = data.noJs['desktop-1440'];
    const before = d.before.links.filter((l) => l.visible).length, after = d.after.links.filter((l) => l.visible).length;
    note(before === 0 && after === 4, `JS off, 1440: drop-downs start closed and "Website" opens on click (${before} -> ${after} links shown)`);
    const p = data.noJs['mobile-390'];
    note(p.before.tops.every((t) => t.visible) && p.after.links.filter((l) => l.visible).length === 4,
      `JS off, 390: all ${TOP_ENTRIES} entries are on the page and a group opens on tap`);
  }

  // ── 8. sticky ─────────────────────────────────────────────────────────────
  for (const vp of Object.keys(VP)) {
    const s = PAGES.map((u) => [u, data[vp][u].afterScroll]).filter(([, r]) => !r.skip);
    note(s.every(([, r]) => r.top === 0 && r.bottom > 0), `${vp}: the bar is still at the top after scrolling 60% (${s.length} pages that scroll)`,
      s.filter(([, r]) => r.top !== 0).map(([u, r]) => `${lbl(u)} top ${r.top}`).join(', '));
  }

  // ── 9. overflow ───────────────────────────────────────────────────────────
  for (const vp of Object.keys(VP)) {
    const o = PAGES.map((u) => data[vp][u].closed.docOverflow);
    note(o.every((x) => x === 0), `${vp}: no page-level horizontal overflow (${o.join('/')}px)`);
  }

  // ── 10. CSRF ──────────────────────────────────────────────────────────────
  const noCsrf = Object.keys(VP).flatMap((vp) => PAGES.filter((u) => !data[vp][u].closed.csrfInLogoutForm).map((u) => `${vp} ${lbl(u)}`));
  note(noCsrf.length === 0, `the Sign Out form still carries its csrf_token on every page x viewport (${Object.keys(VP).length * PAGES.length})`, noCsrf.join(', '));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-adminnav ${results.length - failed}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'adminnav.json')}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
