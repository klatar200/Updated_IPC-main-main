/*
 * P9 step 2 instrument (agent C', audit 9): real-key keyboard reachability
 * and focus-order/trap checks for the surfaces the brief names — the mobile
 * drawer, both contact-form tabs, the desktop mega-menus, the FAQ accordion,
 * and the dashboard's sortable table headers. Real Tab/Enter/Escape only
 * (GUARDRAILS §7.1 / §7.3 — `:focus-visible` does not match `.focus()`).
 * BASE_URL overrides the default (:8143). Exit 0 unless the browser itself
 * cannot launch; this is an instrument, not a suite, so it never fails on a
 * finding — it just reports.
 */
const { launch } = require('./browser');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8143';
const FORCE = '* { font-family: "Liberation Sans", Arial, sans-serif !important } *,*::before,*::after{animation:none!important;transition:none!important;}';

async function withPage(browser, viewport, fn) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript((css) => {
    window.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    });
  }, FORCE);
  try { return await fn(page); } finally { await ctx.close(); }
}

async function activeInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'BODY', text: null };
    const cs = getComputedStyle(el);
    let ring = null;
    try { ring = el.matches(':focus-visible'); } catch { ring = null; }
    return {
      tag: el.tagName,
      type: el.getAttribute('type'),
      role: el.getAttribute('role'),
      text: (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40),
      isSortBtn: !!el.getAttribute('data-sort-key'),
      ariaExpanded: el.getAttribute('aria-expanded'),
      // aria-sort correctly lives on the ancestor <th> per the WAI-ARIA
      // table-sort pattern, not on the nested <button> that receives focus —
      // check the closest th, not the focused element itself.
      ariaSort: el.closest('th') ? el.closest('th').getAttribute('aria-sort') : el.getAttribute('aria-sort'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 40),
      focusVisible: ring,
    };
  });
}

async function tab(page, n = 1) { for (let i = 0; i < n; i++) await page.keyboard.press('Tab'); }

(async () => {
  const browser = await launch();
  const out = {};

  // ---- 1. Mobile drawer: reach hamburger by Tab, open with Enter, Tab inside, Escape closes ----
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    let steps = [];
    let found = false;
    for (let i = 0; i < 6 && !found; i++) {
      await tab(page, 1);
      const info = await activeInfo(page);
      steps.push(info);
      if (/open menu/i.test(info.text || '')) found = true;
    }
    const trigger = found ? steps[steps.length - 1] : null;
    let opened = false, dialogFocusable = false, escapeCloses = false, ringOnTrigger = null;
    if (found) {
      ringOnTrigger = trigger.focusVisible;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      opened = await page.locator('[role="dialog"][aria-modal="true"]').count() > 0;
      if (opened) {
        await tab(page, 1);
        const inside = await activeInfo(page);
        dialogFocusable = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"][aria-modal="true"]');
          return d ? d.contains(document.activeElement) : false;
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        escapeCloses = (await page.locator('[role="dialog"][aria-modal="true"]').count()) === 0;
      }
    }
    out.mobileDrawer = { reachedByTab: found, tabsToReach: steps.length, ringOnTrigger, opened, focusEntersDialog: dialogFocusable, escapeCloses };
  });

  // ---- 2. Desktop mega-menus: reach trigger by Tab from body, open, Tab through items, Escape ----
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const results = {};
    for (const label of ['Products', 'Company']) {
      // reset focus to body between runs
      await page.evaluate(() => document.body.focus());
      let found = false, tabs = 0, info = null;
      for (let i = 0; i < 15 && !found; i++) {
        await tab(page, 1); tabs++;
        info = await activeInfo(page);
        if (info.text === label || (info.text || '').startsWith(label)) found = true;
      }
      let opened = false, escapeCloses = false, itemsTabbedInto = false, ring = info ? info.focusVisible : null;
      if (found) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        opened = (await page.locator('.ipc-dropdown-panel').count()) > 0;
        if (opened) {
          await tab(page, 1);
          const next = await activeInfo(page);
          itemsTabbedInto = await page.evaluate(() => {
            const p = document.querySelector('.ipc-dropdown-panel');
            return p ? p.contains(document.activeElement) : false;
          });
          await page.keyboard.press('Escape');
          await page.waitForTimeout(150);
          escapeCloses = (await page.locator('.ipc-dropdown-panel').count()) === 0;
        }
      }
      results[label] = { reachedByTab: found, tabsToReach: tabs, ring, opened, focusEntersPanel: itemsTabbedInto, escapeCloses };
    }
    out.megaMenus = results;
  });

  // ---- 3. FAQ accordion: Tab to first question, Enter expands, aria-expanded toggles ----
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    // Tab until we reach a button whose text ends with a literal '+' (question trigger)
    let found = false, tabs = 0, info = null;
    for (let i = 0; i < 40 && !found; i++) {
      await tab(page, 1); tabs++;
      info = await activeInfo(page);
      if (/\+$/.test(info.text || '')) found = true;
    }
    let expandedBefore = null, expandedAfter = null, ring = info ? info.focusVisible : null;
    if (found) {
      expandedBefore = info.ariaExpanded;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      const after = await activeInfo(page);
      expandedAfter = after.ariaExpanded;
    }
    out.faq = { reachedByTab: found, tabsToReach: tabs, ring, expandedBefore, expandedAfter, toggled: expandedBefore !== expandedAfter };
  });

  // ---- 4. Dashboard sortable headers: Tab to a column header button, Enter sorts, aria-sort changes ----
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    let found = false, tabs = 0, info = null;
    for (let i = 0; i < 40 && !found; i++) {
      await tab(page, 1); tabs++;
      info = await activeInfo(page);
      if (info.isSortBtn) found = true;
    }
    let sortBefore = null, sortAfter = null, ring = info ? info.focusVisible : null;
    if (found) {
      sortBefore = info.ariaSort;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      const after = await activeInfo(page);
      sortAfter = after.ariaSort;
    }
    out.dashboardSort = { reachedByTab: found, tabsToReach: tabs, ring, sortBefore, sortAfter, changed: sortBefore !== sortAfter };
  });

  // ---- 5. Contact form: both tabs, keyboard-only tab switch + field reachability ----
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    // Tab to the "Send a Message" tab button and activate with Enter
    let found = false, tabs = 0, info = null;
    for (let i = 0; i < 15 && !found; i++) {
      await tab(page, 1); tabs++;
      info = await activeInfo(page);
      if (/Send a Message/i.test(info.text || '')) found = true;
    }
    let switched = false, firstFieldReached = false, ring = info ? info.focusVisible : null;
    if (found) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      switched = await page.evaluate(() => !!document.querySelector('[aria-pressed="true"]')?.textContent?.match(/Send a Message/i));
      await tab(page, 1);
      const f = await activeInfo(page);
      firstFieldReached = f.tag === 'INPUT' || f.tag === 'TEXTAREA' || f.tag === 'SELECT';
    }
    out.contactMessageTab = { reachedByTab: found, tabsToReach: tabs, ring, switchedToMessageTab: switched, firstFieldReachedAfterSwitch: firstFieldReached };
  });

  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error('audit9-p9-keyboard FATAL', e); process.exit(1); });
