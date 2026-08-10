/**
 * AUDIT-10 pass-6 — third verification round, two items only.
 *
 * A. CONTACT SERVER-ERROR ALERT FOCUS. audit10-p6verify2.js filled only
 *    name/email/company, so native validation blocked the submit at a required
 *    field it never filled and the request never reached contact.php — seven
 *    attempts, no alert, focus parked on an <input>. That measured the native
 *    path a second time, not the documented one. Here the RFQ tab is filled
 *    the way plan8-lead.js fills it (partNumber, quantity included), one
 *    successful submit proves the form works, and then the 5-per-10-minutes
 *    rate limit is tripped deliberately to force a SERVER error whose panel is
 *    the role="alert" region focus is documented to move to.
 *
 * B. REDUCED-MOTION, SECOND MEASUREMENT. Two one-shot motions were measured
 *    once each under `reduce`: the sticky RFQ bar's 0.45s spring slide
 *    (App.jsx:8971) and the FAQ panel's 0.3s max-height collapse. A single
 *    reading cannot be CONFIRMED, and plan8-motion does not cover either
 *    (it asserts zero INFINITE animations, and both of these are one-shot).
 *
 * Output: _harness/out/audit10/p6/verify3.json
 * Usage:  node _harness/audit10-p6verify3.js      (needs :8123)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');
const SHOTS = path.join(OUT, 'verify3');

const clearLimiter = () => {
  for (const f of fs.readdirSync(os.tmpdir())) {
    if (f.startsWith('ipc_rl_')) { try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {} }
  }
};

/** Fill the RFQ tab exactly as plan8-lead.js does. */
async function fillRfq(page, tag) {
  await page.locator('input[name="name"]:visible').first().fill('Audit Tester ' + tag);
  await page.locator('input[name="email"]:visible').first().fill('audit@example.com');
  const company = page.locator('input[name="company"]:visible').first();
  if (await company.count()) await company.fill('Audit Co');
  const part = page.locator('input[name="partNumber"]:visible').first();
  if (await part.count()) await part.fill('IP33PO');
  const qty = page.locator('input[name="quantity"]:visible').first();
  if (await qty.count()) await qty.fill('500 ft');
}

const readState = () => {
  const a = document.activeElement;
  const alert = document.querySelector('[role="alert"]');
  return {
    alertPresent: !!alert,
    alertKind: alert ? alert.getAttribute('data-error-kind') : null,
    alertTabIndex: alert ? alert.getAttribute('tabindex') : null,
    alertText: alert ? alert.textContent.replace(/\s+/g, ' ').trim().slice(0, 110) : null,
    activeIsAlert: !!(alert && a === alert),
    activeTag: a.tagName.toLowerCase(),
    activeRole: a.getAttribute('role'),
    activeName: a.getAttribute('name'),
    invalidFields: document.querySelectorAll('input:invalid, textarea:invalid').length,
    success: /Received|Thank/i.test(document.body.textContent || ''),
  };
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await launch();
  const results = { contact: { attempts: [] }, reduce: {} };
  try {
    // ══ A. contact: real submits until the rate limiter answers ══════════
    clearLimiter();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    for (let i = 1; i <= 8; i++) {
      await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await fillRfq(page, String(i));
      await page.locator('form button[type="submit"]:visible').first().click();
      await page.waitForTimeout(2000);
      const s = await page.evaluate(readState);
      results.contact.attempts.push({ n: i, ...s });
      process.stdout.write(s.success ? '+' : s.alertPresent ? '!' : '.');
      if (s.alertPresent) {
        await page.screenshot({ path: path.join(SHOTS, 'contact-server-error.png'), fullPage: false });
        // second reading of the same state, after the alert has settled
        await page.waitForTimeout(800);
        results.contact.settled = await page.evaluate(readState);
        break;
      }
    }
    await ctx.close();
    clearLimiter();

    // ══ B. reduced-motion, second measurement ════════════════════════════
    for (const mode of ['no-preference', 'reduce']) {
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: mode });
      const p = await c.newPage();
      const rec = {};

      // B1 — sticky RFQ bar spring slide
      await p.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
      await p.waitForTimeout(500);
      rec.stickyBefore = await p.evaluate(() => {
        const bar = [...document.querySelectorAll('div')].find((d) =>
          getComputedStyle(d).position === 'fixed' && d.getBoundingClientRect().height > 40
          && /quote/i.test(d.textContent || ''));
        if (!bar) return null;
        const cs = getComputedStyle(bar);
        return { transform: cs.transform, transitionProperty: cs.transitionProperty,
                 transitionDuration: cs.transitionDuration, transitionTimingFunction: cs.transitionTimingFunction,
                 top: Math.round(bar.getBoundingClientRect().top) };
      });
      await p.evaluate(() => window.scrollTo(0, 900));
      const slide = [];
      for (const w of [70, 90, 120, 200, 400, 1500]) {
        await p.waitForTimeout(w);
        slide.push(await p.evaluate(() => {
          const bar = [...document.querySelectorAll('div')].find((d) =>
            getComputedStyle(d).position === 'fixed' && d.getBoundingClientRect().height > 40
            && /quote/i.test(d.textContent || ''));
          if (!bar) return null;
          const cs = getComputedStyle(bar);
          const m = new DOMMatrixReadOnly(cs.transform);
          return { translateY: Math.round(m.m42 * 100) / 100, top: Math.round(bar.getBoundingClientRect().top) };
        }));
      }
      rec.stickySlide = slide;
      rec.stickyMoved = slide.some((f) => f && Math.abs(f.translateY) > 1);
      rec.stickyOvershoot = slide.some((f) => f && f.translateY < -0.5);

      // B2 — FAQ panel max-height collapse
      await p.goto(BASE + '/faq', { waitUntil: 'networkidle' });
      await p.waitForTimeout(400);
      await p.evaluate(() => { document.body.focus();
        document.documentElement.setAttribute('tabindex', '-1'); document.documentElement.focus(); });
      let on = false;
      for (let i = 0; i < 60 && !on; i++) {
        await p.keyboard.press('Tab');
        on = await p.evaluate(() => (document.activeElement.getAttribute('aria-controls') || '').startsWith('faq-panel'));
      }
      rec.faqReached = on;
      if (on) {
        rec.faqPanelTransition = await p.evaluate(() => {
          const id = document.activeElement.getAttribute('aria-controls');
          const el = document.getElementById(id);
          const cs = getComputedStyle(el);
          return { transitionProperty: cs.transitionProperty, transitionDuration: cs.transitionDuration };
        });
        await p.keyboard.press('Enter');
        const frames = [];
        for (const w of [80, 60, 80, 600]) {
          await p.waitForTimeout(w);
          frames.push(await p.evaluate(() => {
            const id = document.activeElement.getAttribute('aria-controls');
            const el = document.getElementById(id);
            const cs = getComputedStyle(el);
            return { maxHeight: cs.maxHeight, height: Math.round(el.getBoundingClientRect().height) };
          }));
        }
        rec.faqOpenFrames = frames;
        // a genuinely instant open shows the final height on the first frame
        const finalH = frames[frames.length - 1].height;
        rec.faqAnimated = frames.slice(0, 3).some((f) => f.height > 0 && f.height < finalH - 5);
        rec.faqFinalHeight = finalH;
      }
      results.reduce[mode] = rec;
      await c.close();
      process.stdout.write('r');
    }
  } finally { await browser.close(); }

  fs.writeFileSync(path.join(OUT, 'verify3.json'), JSON.stringify(results, null, 1));

  console.log('\n\n══ A. contact form: submits until the server answers with an error ══');
  for (const a of results.contact.attempts) {
    console.log(`  attempt ${a.n}: success=${a.success} invalidFields=${a.invalidFields} alert=${a.alertPresent} kind=${a.alertKind} tabindex=${a.alertTabIndex} focusIsAlert=${a.activeIsAlert} active=<${a.activeTag}${a.activeName ? ' name=' + a.activeName : ''}>`);
    if (a.alertText) console.log(`             ${JSON.stringify(a.alertText)}`);
  }
  if (results.contact.settled) {
    console.log(`  settled re-read: focusIsAlert=${results.contact.settled.activeIsAlert} active=<${results.contact.settled.activeTag}> role=${results.contact.settled.activeRole}`);
  }

  console.log('\n══ B. reduced-motion, second measurement ══');
  for (const [mode, r] of Object.entries(results.reduce)) {
    console.log(`\n  prefers-reduced-motion: ${mode}`);
    console.log(`    sticky bar at rest: ${JSON.stringify(r.stickyBefore)}`);
    console.log(`    sticky slide frames (translateY): ${JSON.stringify(r.stickySlide)}`);
    console.log(`    sticky ANIMATED: ${r.stickyMoved} · overshoots past its resting place: ${r.stickyOvershoot}`);
    console.log(`    faq panel transition: ${JSON.stringify(r.faqPanelTransition)}`);
    console.log(`    faq open frames: ${JSON.stringify(r.faqOpenFrames)}`);
    console.log(`    faq ANIMATED: ${r.faqAnimated} (final height ${r.faqFinalHeight}px)`);
  }
  console.log(`\nrecord -> ${path.join(OUT, 'verify3.json')}`);
})();
