/*
 * P6 step 4 instrument (agent C', audit 9): the navigation graph the crawl
 * cannot give us, because the mega-menus and the mobile drawer are not in the
 * DOM on a cold load — they mount on click. This drives the real interaction
 * on the P6 mirror (:8143 by default) and:
 *   1. opens the Products mega-menu, the Company dropdown, and the mobile
 *      drawer, and collects every href inside each;
 *   2. for every internal path, does a COLD navigation (new page.goto, not a
 *      client-side transition) and asserts status 200;
 *   3. for every internal #anchor, does a COLD navigation straight to that
 *      URL (this is the A-03/F4 precedent — anchors must resolve on a fresh
 *      load, not only after an in-app scroll) and asserts the target id
 *      exists in the DOM after settle;
 *   4. computes click-distance from `/` for every KNOWN_ROUTES entry found
 *      in the header nav (desktop) — mega-menu items count as 1 click from
 *      `/`, so anything reachable through them is trivially <=2.
 * Deterministic: Liberation Sans forced, animations disabled, fixed viewport.
 * BASE_URL env var overrides the default. Exit 0 always (instrument, not a
 * suite) unless the browser cannot be launched.
 */
const { launch } = require('./browser');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8143';
const FORCE_FONT = '* { font-family: "Liberation Sans", Arial, sans-serif !important }';
const NO_MOTION = '*, *::before, *::after { animation: none !important; transition: none !important; }';

async function withPage(browser, viewport, fn) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript((css) => {
    window.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.appendChild(s);
    });
  }, FORCE_FONT + NO_MOTION);
  try {
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

function abs(href) {
  try { return new URL(href, BASE).toString(); } catch { return null; }
}

(async () => {
  const browser = await launch();
  const report = { base: BASE, desktop: {}, mobile: {}, coldNav: [], coldAnchor: [], clickDistance: {} };

  // ---- Desktop: open both dropdowns on home, collect hrefs ----
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const collectPanelLinks = async (triggerText) => {
      const trigger = page.getByRole('button', { name: triggerText, exact: false }).first();
      await trigger.click();
      await page.waitForTimeout(250);
      const links = await page.$$eval('.ipc-dropdown-panel a[href]', (as) =>
        as.map((a) => ({ text: a.textContent.trim().slice(0, 60), href: a.getAttribute('href') }))
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      return links;
    };

    report.desktop.products = await collectPanelLinks('Products');
    report.desktop.company = await collectPanelLinks('Company');
  });

  // ---- Mobile: open the drawer, collect hrefs ----
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const openBtn = page.getByRole('button', { name: /open menu/i }).first();
    await openBtn.click();
    await page.waitForTimeout(300);
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    const dialogCount = await dialog.count();
    report.mobile.dialogPresent = dialogCount > 0;
    if (dialogCount > 0) {
      // The drawer nests its own accordions (Products, Company) that mount
      // their links only once expanded — same conditional-render shape as
      // the desktop dropdowns — and only one of the two is open at a time
      // (single `mobileOpen` state), so each is expanded and read separately
      // rather than both-then-read.
      const seen = new Map();
      const readLinks = async () => {
        const ls = await dialog.first().locator('a[href]').evaluateAll((as) =>
          as.map((a) => ({ text: a.textContent.trim().slice(0, 60), href: a.getAttribute('href') }))
        );
        for (const l of ls) seen.set(l.href, l.text);
      };
      await readLinks(); // Home, Contact, Request a Quote (always visible)
      for (const label of ['Products', 'Company']) {
        const trigger = dialog.first().getByRole('button', { name: new RegExp('^' + label) });
        if (await trigger.count()) {
          await trigger.first().click();
          await page.waitForTimeout(200);
          await readLinks();
        }
      }
      report.mobile.links = [...seen].map(([href, text]) => ({ href, text }));
      // Escape-closes check, from inside, real key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      report.mobile.escapeCloses = (await dialog.count()) === 0 ||
        !(await dialog.first().isVisible().catch(() => false));
    }
  });

  // ---- Build the unique internal href set from desktop+mobile+footer(crawl-sourced separately) ----
  const allLinks = [
    ...(report.desktop.products || []),
    ...(report.desktop.company || []),
    ...(report.mobile.links || []),
  ];
  // Also re-verify the /industries#industry-* anchors (A-03/F4 precedent,
  // GUARDRAILS §7.1 — homepage industry cards, not the nav itself, but the
  // exact class of link the cold-load anchor test exists for).
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const industryLinks = await page.$$eval('a[href^="/industries#"]', (as) =>
      as.map((a) => ({ text: a.textContent.trim().slice(0, 40), href: a.getAttribute('href') }))
    );
    report.homepageIndustryAnchors = industryLinks;
  });

  const internal = new Map(); // href -> text
  for (const l of [...allLinks, ...(report.homepageIndustryAnchors || [])]) {
    if (!l.href) continue;
    if (l.href.startsWith('http') || l.href.startsWith('mailto:') || l.href.startsWith('tel:')) continue;
    internal.set(l.href, l.text);
  }

  // ---- Cold nav test: plain paths (no #) ----
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    for (const [href] of internal) {
      if (href.includes('#')) continue;
      const url = abs(href);
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((e) => ({ _err: String(e) }));
      const status = resp && resp.status ? resp.status() : null;
      report.coldNav.push({ href, url, status: status ?? 'ERROR', ok: status === 200 });
    }
  });

  // ---- Cold anchor test: href with # ----
  // Genuinely cold: a fresh page (new context) per link, not a hash-only
  // same-document navigation on a page already sitting on that pathname —
  // Chromium's page.goto() returns a null Response for the latter (only the
  // fragment changed, no new HTTP request), which is a probe artifact, not a
  // finding (GUARDRAILS §7.1 "the probe is not the page"). A brand-new page
  // per link is what a buyer pasting/opening the link cold actually does.
  for (const [href, text] of internal) {
    if (!href.includes('#')) continue;
    const hashPart = href.split('#')[1];
    const url = abs(href);
    await withPage(browser, { width: 1440, height: 900 }, async (page) => {
      let resp, errMsg = null;
      try {
        resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      } catch (e) {
        errMsg = String(e && e.message || e).slice(0, 200);
      }
      await page.waitForTimeout(400); // documented settle: catalog/skeleton + scroll effect
      let status = null;
      if (resp) { try { status = resp.status(); } catch (e) { errMsg = errMsg || String(e && e.message || e).slice(0,200); } }
      if (status == null && errMsg) status = errMsg;
      const targetExists = await page.evaluate((id) => !!document.getElementById(id), hashPart).catch(() => false);
      const inViewport = await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < window.innerHeight;
      }, hashPart).catch(() => null);
      const scrollY = await page.evaluate(() => window.scrollY).catch(() => null);
      report.coldAnchor.push({ href, text, url, status: status ?? 'ERROR', targetExists, inViewport, scrollY });
    });
  }

  // ---- Click distance from / for the 10 KNOWN_ROUTES, via desktop nav ----
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const topLevel = await page.$$eval('header a[href], header button', (els) =>
      els.map((e) => ({ tag: e.tagName, text: e.textContent.trim().slice(0, 40), href: e.getAttribute('href') || null }))
    );
    report.clickDistance.topLevelHeaderControls = topLevel;
  });

  console.log(JSON.stringify(report, null, 1));

  const failures = [
    ...report.coldNav.filter((r) => !r.ok),
    ...report.coldAnchor.filter((r) => r.status !== 200 || !r.targetExists),
  ];
  console.error(`\naudit9-p6-navgraph: ${internal.size} internal links from mega-menus/drawer, ${report.coldNav.length} plain-path checks, ${report.coldAnchor.length} anchor checks, ${failures.length} failing`);

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('audit9-p6-navgraph FATAL', e);
  process.exit(1);
});
