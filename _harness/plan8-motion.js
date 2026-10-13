/**
 * PLAN-8 B14 — prefers-reduced-motion is honoured.
 *
 * src/index.css had a reduced-motion block that disabled exactly one thing,
 * `.ipc-skeleton`. The homepage trust marquee kept scrolling straight through
 * it: measured under an emulated reduce preference, 1 infinite animation still
 * running.
 *
 * The audit found ONE. This asserts ZERO, over every route, and it found a
 * third the audit never mentioned — the submit-button spinner. The spinner and
 * the loading skeleton exist only in transient states (a submit in flight, a
 * catalog still loading), so each is held in that state and measured on its
 * own, with a motion-allowed control.
 *
 * The marquee has a catch that makes the obvious fix wrong. Its track is
 * duplicated 2x so translateX(-50%) can wrap seamlessly, so `animation: none`
 * on its own leaves every certification printed twice with no explanation.
 * This suite checks the doubling is gone too, not just the motion.
 *
 * Usage: node _harness/plan8-motion.js        (needs :8123)
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-motion');
const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries',
                '/services', '/about', '/faq', '/contact', '/privacy'];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/**
 * Every element the browser is actually animating without end.
 *
 * Read from getComputedStyle, not from the stylesheet: a rule can be present
 * and overridden, which is exactly what happened to the first draft of the
 * spinner's reduced-motion override — a media query adds no specificity, so a
 * rule placed before the declaration it means to beat silently loses.
 */
const infiniteAnimations = () => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const names = (cs.animationName || 'none').split(',').map((s) => s.trim());
    const counts = (cs.animationIterationCount || '1').split(',').map((s) => s.trim());
    names.forEach((n, i) => {
      if (n === 'none') return;
      const c = counts[i] !== undefined ? counts[i] : counts[0];
      if (c !== 'infinite') return;
      // A paused animation is still an animation for this purpose.
      out.push({
        name: n,
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 48),
        tag: el.tagName.toLowerCase(),
        state: cs.animationPlayState,
      });
    });
  }
  return out;
};

/**
 * The two animations that exist only in a TRANSIENT state the route scan never
 * sees: the submit spinner (mounted only while a quote request is in flight)
 * and the loading skeleton (only while the catalog is loading). The scan runs
 * after networkidle, so deleting either one's reduced-motion rule left this
 * suite 8/8 (AUDIT-12 A12-L13-14-1, A12-L13-21-1). Each is held in its state —
 * the request is routed and never answered — and its computed animation read.
 */
async function transient(browser, reducedMotion) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
  const out = {};
  try {
    const p = await ctx.newPage();
    await p.route('**/contact.php*', () => {});            // hold the POST: the spinner stays mounted
    await p.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    await p.locator('input[name="name"]:visible').first().fill('Motion Probe');
    await p.locator('input[name="email"]:visible').first().fill('motion@example.com');
    await p.locator('input[name="company"]:visible').first().fill('Probe Co');
    const part = p.locator('input[name="partNumber"]:visible').first(); if (await part.count()) await part.fill('IP33PO');
    const qty = p.locator('input[name="quantity"]:visible').first(); if (await qty.count()) await qty.fill('500 ft');
    await p.locator('form button[type="submit"]:visible').first().click();
    await p.waitForSelector('.ipc-btn-spinner', { timeout: 5000 }).catch(() => {});
    out.spinner = await p.evaluate(() => {
      const el = document.querySelector('.ipc-btn-spinner');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { name: cs.animationName, count: cs.animationIterationCount };
    });
    const q = await ctx.newPage();
    await q.route('**/data/products-all.json*', () => {});  // hold the catalog: the skeleton stays up
    await q.goto(BASE + '/products', { waitUntil: 'domcontentloaded' });
    await q.waitForSelector('.ipc-skeleton', { timeout: 5000 }).catch(() => {});
    out.skeleton = await q.evaluate(() => {
      const els = [...document.querySelectorAll('.ipc-skeleton')];
      if (!els.length) return null;
      const cs = getComputedStyle(els[0]);
      return { n: els.length, name: cs.animationName, count: cs.animationIterationCount,
        infinite: els.filter((e) => getComputedStyle(e).animationIterationCount === 'infinite').length };
    });
  } finally {
    await ctx.close();
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const rec = { reduce: {}, normal: {} };

  try {
    // ── with reduce emulated ──────────────────────────────────────────────
    const rctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const rpage = await rctx.newPage();
    for (const r of ROUTES) {
      await rpage.goto(BASE + r, { waitUntil: 'networkidle' });
      rec.reduce[r] = await rpage.evaluate(infiniteAnimations);
    }
    await rpage.goto(BASE + '/', { waitUntil: 'networkidle' });
    rec.reduceMarquee = await rpage.evaluate(() => {
      const t = document.querySelector('.ipc-marquee-track');
      if (!t) return null;
      return {
        items: t.children.length,
        tabIndex: t.getAttribute('tabindex'),
        animation: getComputedStyle(t).animationName,
        width: Math.round(t.getBoundingClientRect().width),
        parentWidth: Math.round(t.parentElement.getBoundingClientRect().width),
        text: t.innerText.replace(/\s+/g, ' ').trim().slice(0, 120),
      };
    });
    await rpage.screenshot({ path: path.join(OUT, 'home-reduce.png'), fullPage: false });
    await rctx.close();

    // ── with motion allowed — the marquee must be UNCHANGED ───────────────
    const nctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference',
    });
    const npage = await nctx.newPage();
    for (const r of ROUTES) {
      await npage.goto(BASE + r, { waitUntil: 'networkidle' });
      rec.normal[r] = await npage.evaluate(infiniteAnimations);
    }
    await npage.goto(BASE + '/', { waitUntil: 'networkidle' });
    rec.normalMarquee = await npage.evaluate(() => {
      const t = document.querySelector('.ipc-marquee-track');
      if (!t) return null;
      return {
        items: t.children.length,
        tabIndex: t.getAttribute('tabindex'),
        animation: getComputedStyle(t).animationName,
      };
    });
    await npage.screenshot({ path: path.join(OUT, 'home-normal.png'), fullPage: false });
    await nctx.close();

    rec.transientReduce = await transient(browser, 'reduce');
    rec.transientNormal = await transient(browser, 'no-preference');
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'motion.json'), JSON.stringify(rec, null, 2));

  // ── B14 ───────────────────────────────────────────────────────────────────
  const stillRunning = Object.entries(rec.reduce).filter(([, v]) => v.length);
  note(stillRunning.length === 0,
    `zero infinite animations under prefers-reduced-motion, across all ${ROUTES.length} routes`,
    stillRunning.map(([r, v]) => `${r}: ${v.map((x) => `${x.name} on .${x.cls}`).join(', ')}`).join('\n         '));

  // The transient states. The no-preference run is the control that proves
  // each state was reached and really animates when motion is allowed.
  const tr = rec.transientReduce || {}, tn = rec.transientNormal || {};
  note(!!tn.spinner && tn.spinner.count === 'infinite',
    'control: with motion allowed, the submit spinner is mounted and spinning while a request is in flight',
    JSON.stringify(tn.spinner));
  note(!!tr.spinner && tr.spinner.name === 'none' && tr.spinner.count !== 'infinite',
    'the submit-button spinner does not spin under prefers-reduced-motion',
    JSON.stringify(tr.spinner));
  note(!!tn.skeleton && tn.skeleton.infinite > 0,
    'control: with motion allowed, the catalog loading skeleton is up and shimmering while the catalog loads',
    JSON.stringify(tn.skeleton));
  note(!!tr.skeleton && tr.skeleton.infinite === 0 && tr.skeleton.name === 'none',
    'the loading skeleton does not shimmer under prefers-reduced-motion',
    JSON.stringify(tr.skeleton));

  const rm = rec.reduceMarquee;
  note(rm && rm.animation === 'none',
    `the trust marquee is not animating under reduce (animationName=${rm ? rm.animation : '?'})`);

  const nm = rec.normalMarquee;
  note(rm && nm && rm.items * 2 === nm.items,
    `the duplicated half of the track is gone under reduce — ${rm ? rm.items : '?'} items vs ` +
    `${nm ? nm.items : '?'} with motion allowed. animation:none alone would leave every ` +
    `certification printed twice`);

  note(rm && rm.tabIndex === null,
    'under reduce the track is not a tab stop — the tabIndex exists only to pause the scroll',
    `tabindex=${rm ? rm.tabIndex : '?'}`);
  note(nm && nm.tabIndex === '0',
    'with motion allowed the track is still focusable, so a keyboard user can still pause it',
    `tabindex=${nm ? nm.tabIndex : '?'}`);

  note(rm && rm.width <= rm.parentWidth + 1,
    `under reduce the strip fits its container (${rm ? rm.width : '?'}px in ${rm ? rm.parentWidth : '?'}px) ` +
    `— a frozen max-content track would leave half the certifications off-screen`);

  note(rm && rm.text.length > 10,
    `the trust content is still readable under reduce: ${JSON.stringify(rm ? rm.text.slice(0, 60) : '')}`);

  // With motion allowed, the marquee must still be doing its job.
  note(nm && nm.animation === 'ipc-marquee',
    `with motion allowed the marquee is unchanged (animationName=${nm ? nm.animation : '?'})`);

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-motion ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'motion.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
