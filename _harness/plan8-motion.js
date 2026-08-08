/**
 * PLAN-8 B14 — prefers-reduced-motion is honoured.
 *
 * src/index.css had a reduced-motion block that disabled exactly one thing,
 * `.ipc-skeleton`. The homepage trust marquee kept scrolling straight through
 * it: measured under an emulated reduce preference, 1 infinite animation still
 * running.
 *
 * The audit found ONE. This asserts ZERO, over every route, and it found a
 * third the audit never mentioned — the submit-button spinner.
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
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'motion.json'), JSON.stringify(rec, null, 2));

  // ── B14 ───────────────────────────────────────────────────────────────────
  const stillRunning = Object.entries(rec.reduce).filter(([, v]) => v.length);
  note(stillRunning.length === 0,
    `zero infinite animations under prefers-reduced-motion, across all ${ROUTES.length} routes`,
    stillRunning.map(([r, v]) => `${r}: ${v.map((x) => `${x.name} on .${x.cls}`).join(', ')}`).join('\n         '));

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
