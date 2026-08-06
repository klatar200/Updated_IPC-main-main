/**
 * PLAN-4 public site — 4.19 (sortable product-index headers) and 4.20 (collapsed
 * FAQ answers).
 *
 * 4.19: the sort headers have no tabindex, no scope and no aria-sort. A keyboard
 * user cannot sort at all; a screen-reader user is not told the table is
 * sortable or which column is active.
 *
 * 4.20: collapsed answers use max-height:0, which hides them from EYES only.
 * They stay in the accessibility tree and in find-in-page, so a screen-reader
 * user hears every answer to every question continuously with no indication of
 * which are collapsed.
 *
 * "Not in the accessibility tree" is asserted against the tree itself, over CDP
 * (Accessibility.getFullAXTree) — not by Playwright's visibility heuristic,
 * which calls a zero-height element hidden and would pass against the very bug
 * this item is about. Find-in-page is probed with window.find(), which matches
 * clipped-but-rendered text and not display:none text.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan4-public.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan4');

// WCAG 2.1 relative luminance / contrast ratio, over computed rgb() strings.
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

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

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

// ── 4.20 ──────────────────────────────────────────────────────────────────

// The Navbar's two dropdowns and the mobile-menu toggle are ALSO
// button[aria-expanded] and they come FIRST in the document, so a bare
// querySelector picks up the navbar and every probe below then measures the
// wrong widget and passes vacuously. Discriminate on the accordion's own
// shape: a FAQ trigger's parent holds the answer <p>. Injected into the page
// so both the trigger and its panel resolve the same way everywhere, including
// on the UNFIXED page where aria-controls does not exist yet.
const FAQ_SETUP = `
  window.__faqBtn = function () {
    return [...document.querySelectorAll('button[aria-expanded]')]
      .filter(function (b) { return b.parentElement && b.parentElement.querySelector('p'); })[0] || null;
  };
  window.__faqPanel = function () {
    var b = window.__faqBtn();
    if (!b) return null;
    var id = b.getAttribute('aria-controls');
    return (id && document.getElementById(id)) || b.nextElementSibling;
  };
`;

async function faq(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript(FAQ_SETUP);
  await page.goto(`${BASE}/faq`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const count = await page.evaluate(() =>
    [...document.querySelectorAll('button[aria-expanded]')]
      .filter((b) => b.parentElement && b.parentElement.querySelector('p')).length);
  note(count > 0, '4.20: FAQ accordion triggers found (navbar toggles excluded)', `count=${count}`);
  if (!count) { await ctx.close(); return; }

  const click = () => page.evaluate(() => window.__faqBtn().click());
  const panelHeight = () => page.evaluate(() => {
    const p = window.__faqPanel();
    return p ? Math.round(p.getBoundingClientRect().height) : -1;
  });

  // A distinctive slice of the first answer, read from the DOM so the suite
  // never hardcodes owner-editable copy.
  const answerText = await page.evaluate(() => {
    const p = window.__faqPanel();
    const el = p && p.querySelector('p');
    return el ? (el.textContent || '').trim() : '';
  });
  note(answerText.length > 20, '4.20: an answer body was located to probe with',
    `got ${JSON.stringify(answerText.slice(0, 40))}`);
  if (answerText.length <= 20) { await ctx.close(); return; }
  const probe = answerText.slice(0, 40);

  // ── all collapsed ──
  const allCollapsed = await page.evaluate(() =>
    [...document.querySelectorAll('button[aria-expanded]')]
      .filter((b) => b.parentElement && b.parentElement.querySelector('p'))
      .every((b) => b.getAttribute('aria-expanded') === 'false'));
  note(allCollapsed, '4.20: every answer starts collapsed');

  const axClosed = await axText(page);
  note(!axClosed.includes(probe),
    '4.20: a COLLAPSED answer is absent from the accessibility tree',
    'the answer text is still exposed to screen readers');

  const findProbe = (p) => page.evaluate((q) => {
    const r = window.find(q);
    const s = window.getSelection(); if (s) s.removeAllRanges();
    return r;
  }, p);

  const foundClosed = await findProbe(probe);
  note(foundClosed === false,
    '4.20: find-in-page does not match a collapsed answer',
    `window.find() returned ${foundClosed}`);

  // ── aria wiring ──
  const wiring = await page.evaluate(() => {
    const b = window.__faqBtn();
    const id = b.getAttribute('aria-controls');
    const panel = id ? document.getElementById(id) : null;
    return { controls: id, resolves: !!panel, panelHasAnswer: !!(panel && panel.querySelector('p')) };
  });
  note(!!wiring.controls && wiring.resolves && wiring.panelHasAnswer,
    '4.20: aria-controls resolves to the panel holding the answer',
    JSON.stringify(wiring));

  // ── expand: the animation must survive the fix ──
  const heights = [];
  await click();
  for (let i = 0; i < 10; i++) {
    heights.push(await panelHeight());
    await page.waitForTimeout(40);
  }
  const grew = heights.some((h, i) => i > 0 && h > heights[i - 1]);
  const instant = heights[0] > 0 && heights[0] === heights[heights.length - 1];
  note(grew && !instant, '4.20: expanding still ANIMATES (height grows across frames)',
    `heights=${JSON.stringify(heights)}`);

  await page.waitForTimeout(700);
  const expandedAttr = await page.evaluate(() => window.__faqBtn().getAttribute('aria-expanded'));
  note(expandedAttr === 'true', '4.20: aria-expanded flips to true on open', `got ${expandedAttr}`);

  const axOpen = await axText(page);
  note(axOpen.includes(probe),
    '4.20: an EXPANDED answer IS in the accessibility tree',
    'opening it must actually expose the text');

  const foundOpen = await findProbe(probe);
  note(foundOpen === true, '4.20: find-in-page matches an expanded answer',
    `window.find() returned ${foundOpen}`);

  // ── collapse again: it must LEAVE the tree, not merely never have entered ──
  await click();
  await page.waitForTimeout(800);
  const axReclosed = await axText(page);
  note(!axReclosed.includes(probe),
    '4.20: re-collapsing REMOVES the answer from the tree again',
    'the check a one-way reveal cannot fake');
  const foundReclosed = await findProbe(probe);
  note(foundReclosed === false, '4.20: find-in-page stops matching after re-collapse',
    `window.find() returned ${foundReclosed}`);

  // ── 4.1 interaction: the JSON-LD is built from data, not from the DOM ──
  const ld = await page.evaluate(() => {
    const el = document.getElementById('faq-ld');
    return el ? el.textContent : null;
  });
  note(!!ld && ld.includes(probe.slice(0, 25)),
    '4.20: #faq-ld still contains the answer regardless of collapse state',
    ld ? 'answer missing from JSON-LD' : 'no #faq-ld at all');

  await page.screenshot({ path: path.join(OUT, 'faq-collapsed-1440.png') });
  await ctx.close();
}

// ── 4.19 ──────────────────────────────────────────────────────────────────

/**
 * Drive real Tab presses until `predicate` holds. Programmatic .focus() is not
 * the same test: it proves nothing about tab order, and Chromium will not match
 * :focus-visible for it, so a genuine focus indicator would read as absent.
 */
async function tabUntil(page, predicate, max = 90) {
  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
  });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(predicate)) return i + 1;
  }
  return -1;
}

const IN_THEAD = () => {
  const a = document.activeElement;
  return !!(a && a.closest && a.closest('thead') && a.tagName === 'BUTTON');
};

async function sortHeaders(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const shape = await page.evaluate(() => {
    const ths = [...document.querySelectorAll('table thead th')];
    return {
      total: ths.length,
      withScope: ths.filter((t) => t.getAttribute('scope') === 'col').length,
      withButton: ths.filter((t) => t.querySelector('button')).length,
      tabindexOnTh: ths.filter((t) => t.hasAttribute('tabindex')).length,
      ariaSort: ths.map((t) => t.getAttribute('aria-sort')).filter(Boolean),
    };
  });

  note(shape.total > 0, '4.19: the product-index table was found', JSON.stringify(shape));
  note(shape.withScope === shape.total,
    '4.19: every <th> has scope="col"', `${shape.withScope}/${shape.total}`);
  note(shape.tabindexOnTh === 0,
    '4.19: no tabindex on the <th> itself — the button carries focus',
    `${shape.tabindexOnTh} th elements have tabindex`);
  note(shape.withButton === shape.total - 1,
    '4.19: every SORTABLE header holds a real <button>',
    `buttons in ${shape.withButton} of ${shape.total} th (Action is not sortable)`);
  note(shape.ariaSort.length === 1,
    '4.19: aria-sort is present on exactly ONE column',
    `found ${shape.ariaSort.length}: ${JSON.stringify(shape.ariaSort)}`);

  // ── Tab actually reaches the headers, and reaches ALL of them ──
  const steps = await tabUntil(page, IN_THEAD);
  note(steps > 0, '4.19: Tab reaches a sort control from the top of the page',
    steps < 0 ? 'never reached one in 90 presses' : `after ${steps} presses`);
  if (steps < 0) { await ctx.close(); return; }

  const reachable = await page.evaluate(() => (document.activeElement.dataset.sortKey ? 1 : 0));
  let seen = reachable;
  for (let i = 1; i < shape.total; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(IN_THEAD)) seen++;
    else break;
  }
  note(seen === shape.total - 1,
    '4.19: every sortable header is reachable by Tab, with no trap',
    `reached ${seen} of ${shape.total - 1}`);

  const firstColumn = () => page.evaluate(() =>
    [...document.querySelectorAll('table tbody tr')].slice(0, 6)
      .map((r) => (r.cells[0] ? r.cells[0].textContent.trim() : '')));

  // ── Enter and Space both sort ──
  await tabUntil(page, IN_THEAD);
  const before = await firstColumn();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const afterEnter = await firstColumn();
  note(JSON.stringify(before) !== JSON.stringify(afterEnter),
    '4.19: Enter on a focused header sorts',
    `before=${JSON.stringify(before.slice(0, 3))} after=${JSON.stringify(afterEnter.slice(0, 3))}`);

  await page.keyboard.press(' ');
  await page.waitForTimeout(250);
  const afterSpace = await firstColumn();
  note(JSON.stringify(afterSpace) !== JSON.stringify(afterEnter),
    '4.19: Space on a focused header also sorts',
    `afterEnter=${JSON.stringify(afterEnter.slice(0, 3))} afterSpace=${JSON.stringify(afterSpace.slice(0, 3))}`);

  // ── aria-sort matches what is drawn ──
  const match = await page.evaluate(() => {
    const th = [...document.querySelectorAll('table thead th')].find((t) => t.getAttribute('aria-sort'));
    if (!th) return { ok: false, why: 'no aria-sort anywhere' };
    const dir = th.getAttribute('aria-sort');
    const glyph = th.textContent || '';
    return {
      ok: (dir === 'ascending' && glyph.includes('▲')) || (dir === 'descending' && glyph.includes('▼')),
      dir, glyph: glyph.trim().slice(-3),
    };
  });
  note(match.ok, '4.19: aria-sort matches the direction shown on screen', JSON.stringify(match));

  const stillOne = await page.evaluate(() =>
    [...document.querySelectorAll('table thead th')].filter((t) => t.getAttribute('aria-sort')).length);
  note(stillOne === 1, '4.19: aria-sort stays on exactly one column after sorting',
    `found ${stillOne}`);

  // ── Keyboard result must equal mouse result from the same start ──
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await tabUntil(page, IN_THEAD);
  await page.keyboard.press('Tab');            // second sortable header
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const kbOrder = await firstColumn();

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll('table thead th button')[1].click());
  await page.waitForTimeout(250);
  const mouseOrder = await firstColumn();
  note(JSON.stringify(kbOrder) === JSON.stringify(mouseOrder),
    '4.19: keyboard activation sorts identically to mouse activation',
    `kb=${JSON.stringify(kbOrder.slice(0, 3))}\n         mouse=${JSON.stringify(mouseOrder.slice(0, 3))}`);

  // ── A focus indicator that is actually visible, and meets contrast ──
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await tabUntil(page, IN_THEAD);
  const indicator = await page.evaluate(() => {
    const focused = document.activeElement;
    const other = [...document.querySelectorAll('table thead th button')].find((b) => b !== focused);
    const f = getComputedStyle(focused);
    const o = getComputedStyle(other);
    const desc = (s) => [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow].join(' | ');
    const th = focused.closest('th');
    return {
      focused: desc(f), unfocused: desc(o),
      changed: desc(f) !== desc(o),
      outlineColor: f.outlineColor,
      outlineWidth: parseFloat(f.outlineWidth) || 0,
      bg: getComputedStyle(th).backgroundColor,
      rowBg: getComputedStyle(th.parentElement).backgroundColor,
    };
  });
  note(!!(indicator && indicator.changed && indicator.outlineWidth >= 2),
    '4.19: a Tab-focused sort control shows a visible focus indicator',
    JSON.stringify(indicator));

  const bg = indicator.bg && indicator.bg !== 'rgba(0, 0, 0, 0)' ? indicator.bg : indicator.rowBg;
  const cr = contrast(indicator.outlineColor, bg);
  note(cr >= 3.0, '4.19: the focus indicator meets 3:1 against the header background',
    `${indicator.outlineColor} on ${bg} = ${cr.toFixed(2)}:1`);

  await page.screenshot({ path: path.join(OUT, 'dashboard-sort-1440.png') });
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  await faq(browser);
  await sortHeaders(browser);
  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan4-public: ${pass}/${results.length}`);
  console.log(`screenshots -> ${OUT}`);
  process.exit(pass === results.length ? 0 : 1);
})();
