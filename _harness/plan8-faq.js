/**
 * PLAN-8 C41 — the FAQ opens fully collapsed with no bulk control.
 *
 * 14 questions, all closed. The category chips jump correctly, but scanning for
 * an answer means 14 clicks.
 *
 * The whole risk of this item is that a bulk toggle bypasses PLAN-4 4.20.
 * 4.20 put `hidden` on each panel at the END of the collapse transition
 * specifically so a collapsed answer leaves the accessibility tree and
 * find-in-page. A bulk control that sets max-height directly, or that flips a
 * shared flag the per-item effect does not observe, reinstates exactly the bug
 * 4.20 fixed — and it does so silently, because the page LOOKS right.
 *
 * So every assertion here is made against the real accessibility tree over CDP
 * (Accessibility.getFullAXTree), never against Playwright's visibility
 * heuristic, which calls a zero-height element hidden and would pass against
 * the very defect this guards. Find-in-page is probed with window.find(),
 * which matches clipped-but-rendered text and does not match display:none.
 *
 * The last two checks are the backstop. FaqItem's collapse effect arms a 400 ms
 * timeout because a zero-duration transition, `prefers-reduced-motion` or a
 * background tab can mean `transitionend` never arrives. Collapsing 14 panels
 * at once is where that matters most, so the suite re-runs the collapse under
 * reduced motion WITH transitions forced off, which is the deterministic form
 * of "the event never fires", and requires all 14 to still leave the tree.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan8-faq.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-faq');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// Same discrimination as plan4-public: the navbar's dropdowns and the mobile
// toggle are ALSO button[aria-expanded] and come first in the document, so a
// bare querySelector measures the wrong widget and passes vacuously.
const FAQ_SETUP = `
  window.__faqBtns = function () {
    return [...document.querySelectorAll('button[aria-expanded]')]
      .filter(function (b) { return b.parentElement && b.parentElement.querySelector('p'); });
  };
  window.__faqPanels = function () {
    return window.__faqBtns().map(function (b) {
      var id = b.getAttribute('aria-controls');
      return (id && document.getElementById(id)) || b.nextElementSibling;
    });
  };
`;

/** Every accessible name / value / description in the real AX tree, as one blob. */
async function axText(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const parts = [];
  for (const n of nodes) {
    if (n.ignored) continue;
    for (const k of ['name', 'value', 'description']) {
      const v = n[k] && n[k].value;
      if (typeof v === 'string' && v.trim()) parts.push(v.trim());
    }
  }
  await cdp.detach();
  return parts.join('\n');
}

/** The bulk control, found by accessible name rather than by a test id. */
const BULK = 'button:has-text("Expand all"), button:has-text("Collapse all")';

/** Probe strings: a distinctive slice of EVERY answer, read from the DOM. */
async function probes(page) {
  return page.evaluate(() => {
    // Read from the panels while they are in the DOM, open or not — textContent
    // works through display:none, which is precisely why the AX tree and
    // window.find() are the things asserted on and this is only the source of
    // the needles.
    return window.__faqPanels().map((p) => {
      const el = p && p.querySelector('p');
      return el ? (el.textContent || '').trim().slice(0, 45) : '';
    }).filter((s) => s.length > 20);
  });
}

const findProbe = (page, q) => page.evaluate((needle) => {
  const r = window.find(needle);
  const s = window.getSelection(); if (s) s.removeAllRanges();
  return r;
}, q);

async function run(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript(FAQ_SETUP);
  await page.goto(`${BASE}/faq`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const total = await page.evaluate(() => window.__faqBtns().length);
  note(total >= 14, 'the FAQ page renders its full question set (navbar toggles excluded)', `count=${total}`);
  if (!total) { await ctx.close(); return; }

  const needles = await probes(page);
  note(needles.length === total, 'an answer body was located for every question to probe with',
    `${needles.length} probes for ${total} questions`);

  // ── the control exists and is honest about its state ──
  const bulk = page.locator(BULK).first();
  const present = await bulk.count();
  note(present > 0, 'C41: the FAQ offers a bulk expand/collapse control');
  if (!present) {
    await page.screenshot({ path: path.join(OUT, 'faq-no-control.png'), fullPage: false });
    await ctx.close();
    return;
  }
  note((await bulk.textContent() || '').includes('Expand all'),
    'C41: with everything collapsed the control offers to EXPAND',
    `label is ${JSON.stringify((await bulk.textContent() || '').trim())}`);

  // ── expand all ──
  await bulk.click();
  await page.waitForTimeout(700);

  const openStates = await page.evaluate(() =>
    window.__faqBtns().map((b) => b.getAttribute('aria-expanded')));
  const allOpen = openStates.every((s) => s === 'true');
  note(allOpen, `C41: expand all sets aria-expanded on all ${total} triggers`,
    `${openStates.filter((s) => s !== 'true').length} still false`);

  const notHiddenOpen = await page.evaluate(() =>
    window.__faqPanels().filter((p) => p && p.hasAttribute('hidden')).length);
  note(notHiddenOpen === 0, `C41: expand all un-hides all ${total} panels`,
    `${notHiddenOpen} panels kept the hidden attribute`);

  const axOpen = await axText(page);
  const missing = needles.filter((n) => !axOpen.includes(n));
  note(missing.length === 0, `C41: expand all puts all ${total} answers in the ACCESSIBILITY TREE`,
    `${missing.length} absent, first: ${JSON.stringify(missing[0] || '')}`);

  const notFound = [];
  for (const n of needles) if (!(await findProbe(page, n))) notFound.push(n);
  note(notFound.length === 0, `C41: expand all makes all ${total} answers findable with window.find()`,
    `${notFound.length} not found, first: ${JSON.stringify(notFound[0] || '')}`);

  note((await bulk.textContent() || '').includes('Collapse all'),
    'C41: once expanded the control offers to COLLAPSE',
    `label is ${JSON.stringify((await bulk.textContent() || '').trim())}`);

  await page.screenshot({ path: path.join(OUT, 'faq-expanded-1440.png'), fullPage: true });

  // ── collapse all ──
  await bulk.click();
  await page.waitForTimeout(900);   // transition (300ms) + the 400ms backstop

  const closedStates = await page.evaluate(() =>
    window.__faqBtns().map((b) => b.getAttribute('aria-expanded')));
  note(closedStates.every((s) => s === 'false'),
    `C41: collapse all clears aria-expanded on all ${total} triggers`,
    `${closedStates.filter((s) => s !== 'false').length} still true`);

  const stillShown = await page.evaluate(() =>
    window.__faqPanels().filter((p) => p && !p.hasAttribute('hidden')).length);
  note(stillShown === 0, `C41: collapse all re-hides all ${total} panels (4.20 is not bypassed)`,
    `${stillShown} panels never got the hidden attribute back`);

  const axClosed = await axText(page);
  const leaked = needles.filter((n) => axClosed.includes(n));
  note(leaked.length === 0, `C41: collapse all removes all ${total} answers from the ACCESSIBILITY TREE`,
    `${leaked.length} still exposed, first: ${JSON.stringify(leaked[0] || '')}`);

  const stillFound = [];
  for (const n of needles) if (await findProbe(page, n)) stillFound.push(n);
  note(stillFound.length === 0, `C41: collapse all makes no answer findable with window.find()`,
    `${stillFound.length} still found, first: ${JSON.stringify(stillFound[0] || '')}`);

  // ── the control does not break single-item toggling ──
  await page.evaluate(() => window.__faqBtns()[3].click());
  await page.waitForTimeout(600);
  const single = await page.evaluate(() =>
    window.__faqBtns().map((b) => b.getAttribute('aria-expanded') === 'true'));
  note(single[3] === true && single.filter(Boolean).length === 1,
    'C41: after a bulk cycle a single question still toggles on its own',
    `${single.filter(Boolean).length} open, index 3 is ${single[3]}`);

  // ── keyboard ──
  await page.goto(`${BASE}/faq`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const reached = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => /Expand all|Collapse all/.test(x.textContent || ''));
    if (!b) return null;
    b.focus();
    return document.activeElement === b;
  });
  note(reached === true, 'C41: the bulk control is focusable');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  const viaKey = await page.evaluate(() =>
    window.__faqBtns().every((b) => b.getAttribute('aria-expanded') === 'true'));
  note(viaKey, 'C41: Enter on the bulk control expands every answer');

  await ctx.close();
}

/**
 * The backstop. `transitionend` is the primary signal that re-applies `hidden`;
 * FaqItem also arms a 400 ms timeout because that event is not guaranteed.
 * Forcing transitions off is the deterministic form of "it never fires" — if
 * the bulk collapse depended on the event alone, all 14 panels would stay in
 * the accessibility tree forever and this is the only check that would notice.
 */
async function backstop(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.addInitScript(FAQ_SETUP);
  await page.goto(`${BASE}/faq`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
  await page.waitForTimeout(400);

  const bulk = page.locator(BULK).first();
  if (!(await bulk.count())) { note(false, 'C41 backstop: bulk control present under reduced motion'); await ctx.close(); return; }

  await bulk.click();                 // expand all
  await page.waitForTimeout(600);
  const total = await page.evaluate(() => window.__faqBtns().length);
  const shown = await page.evaluate(() =>
    window.__faqPanels().filter((p) => p && !p.hasAttribute('hidden')).length);
  note(shown === total,
    `C41 backstop: with transitions OFF, expand all still un-hides all ${total} panels`,
    `${shown}/${total} un-hidden`);

  await bulk.click();                 // collapse all — transitionend will not fire
  await page.waitForTimeout(1200);    // well past the 400ms backstop
  const stranded = await page.evaluate(() =>
    window.__faqPanels().filter((p) => p && !p.hasAttribute('hidden')).length);
  note(stranded === 0,
    `C41 backstop: with transitionend NEVER firing, the timeout still re-hides all ${total} panels`,
    `${stranded} panels stranded in the accessibility tree`);

  const needles = await probes(page);
  const ax = await axText(page);
  const leaked = needles.filter((n) => ax.includes(n));
  note(leaked.length === 0,
    'C41 backstop: no answer is left in the accessibility tree',
    `${leaked.length} leaked, first: ${JSON.stringify(leaked[0] || '')}`);

  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  await run(browser);
  await backstop(browser);
  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan8-faq ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'faq.json'), JSON.stringify(results, null, 2));
  console.log(`record -> ${path.join(OUT, 'faq.json')}`);
  process.exit(pass === results.length ? 0 : 1);
})();
