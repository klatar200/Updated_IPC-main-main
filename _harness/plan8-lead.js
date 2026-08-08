/**
 * PLAN-8 Phase D — B16, B17, B18, B22, B26.
 *
 * Every defect here costs a sales enquiry, which is the standard invariant 11
 * is held to.
 *
 * B16. After a successful submit the form is replaced by a "Quote Request
 * Received" panel with no aria-live, no role=status and no role=alert anywhere
 * on the page, and document.activeElement left on <body>. A screen-reader user
 * got silence. The ERROR path was given a proper role=alert region in PLAN-3
 * 4.5; the success path never got the same treatment.
 *
 * B17. The URL stayed /contact, so a refresh lost the confirmation and
 * re-rendered an empty form, and there was no distinct URL to hang an
 * analytics conversion goal on — on a site whose entire purpose is lead
 * capture.
 *
 * B18. Three defects on the panel itself: an emoji where an icon belongs, the
 * contact details, and ~330px of dead space above the footer with no eyebrow
 * over the h1.
 *
 * B22. The Required Delivery Date placeholder suggested a date 13 months in
 * the past.
 *
 * B26. At 390px the form sits below four contact cards and a tip panel.
 *
 * Usage: node _harness/plan8-lead.js       (needs :8123)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-lead');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// contact.php rate-limits 5 per 10 minutes per IP and every request here comes
// from 127.0.0.1. Clear it or the suite measures the 429 instead of the form.
const clearLimiter = () => {
  for (const f of fs.readdirSync(os.tmpdir())) {
    if (f.startsWith('ipc_rl_')) { try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {} }
  }
};

/** Fill and submit the RFQ tab. Returns once the success panel is up. */
async function submitRfq(page) {
  await page.locator('input[name="name"]:visible').first().fill('Harness Tester');
  await page.locator('input[name="email"]:visible').first().fill('harness@example.com');
  await page.locator('input[name="company"]:visible').first().fill('Harness Co');
  const part = page.locator('input[name="partNumber"]:visible').first();
  if (await part.count()) await part.fill('IP33PO');
  const qty = page.locator('input[name="quantity"]:visible').first();
  if (await qty.count()) await qty.fill('500 ft');
  await page.locator('form button[type="submit"]:visible').first().click();
  await page.waitForFunction(
    () => /Received|Thank/i.test(document.body.textContent || ''),
    { timeout: 15000 }
  );
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const rec = {};

  try {
    // ── B22 — placeholders, before anything is submitted ──────────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
      rec.placeholders = await page.evaluate(() =>
        [...document.querySelectorAll('input,textarea')]
          .map((e) => e.getAttribute('placeholder'))
          .filter(Boolean)
      );
      await ctx.close();
    }

    // ── B26 — where is the first field at 390? ────────────────────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
      rec.mobile = await page.evaluate(() => {
        const f = document.querySelector('form input, form textarea, form select');
        const r = f ? f.getBoundingClientRect() : null;
        return {
          firstFieldTop: r ? Math.round(r.top + window.scrollY) : null,
          docHeight: document.documentElement.scrollHeight,
        };
      });
      // Tab order must still match visual order after any CSS reorder.
      rec.mobileTabOrder = await page.evaluate(() => {
        const els = [...document.querySelectorAll('form input, form textarea, form select, form button')]
          .filter((e) => e.offsetParent !== null);
        const tops = els.map((e) => Math.round(e.getBoundingClientRect().top + window.scrollY));
        let monotonic = true;
        for (let i = 1; i < tops.length; i++) if (tops[i] < tops[i - 1] - 4) monotonic = false;
        return { count: els.length, monotonic };
      });
      await page.screenshot({ path: path.join(OUT, 'contact-390.png'), fullPage: true });
      await ctx.close();
    }

    // ── B16 / B17 / B18 — the success state ───────────────────────────────
    {
      clearLimiter();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
      await submitRfq(page);
      await page.waitForTimeout(500);

      rec.success = await page.evaluate(() => {
        const live = [...document.querySelectorAll('[aria-live],[role="status"],[role="alert"]')]
          .map((e) => ({
            role: e.getAttribute('role'),
            live: e.getAttribute('aria-live'),
            text: e.textContent.trim().slice(0, 60),
          }));
        const ae = document.activeElement;
        const h1 = document.querySelector('h1');
        // Emoji = any astral-plane pictograph in the panel.
        const panel = document.querySelector('[role="status"]') || document.body;
        const emoji = (panel.textContent.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []);
        const tel = [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.textContent.trim());
        const mail = [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.textContent.trim());
        // Gap between the last control and the footer.
        const btns = [...document.querySelectorAll('main button, main a')];
        const last = btns.length ? btns[btns.length - 1].getBoundingClientRect().bottom + window.scrollY : null;
        const footer = document.querySelector('footer');
        const fTop = footer ? footer.getBoundingClientRect().top + window.scrollY : null;
        return {
          liveRegions: live,
          activeTag: ae ? ae.tagName : null,
          activeRole: ae ? ae.getAttribute('role') : null,
          activeText: ae ? (ae.textContent || '').trim().slice(0, 50) : null,
          h1: h1 ? h1.textContent.trim() : null,
          eyebrowPresent: !!document.querySelector('[data-ipc-eyebrow]'),
          emoji,
          tel,
          mail,
          gap: last !== null && fTop !== null ? Math.round(fTop - last) : null,
        };
      });
      rec.successUrl = page.url();
      await page.screenshot({ path: path.join(OUT, 'success-1440.png'), fullPage: true });

      // B17 — reload the success URL. It must still show the panel and send
      // no new request.
      let posts = 0;
      page.on('request', (r) => { if (r.method() === 'POST') posts++; });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      rec.afterReload = await page.evaluate(() => ({
        stillConfirmed: /Received|Thank/i.test(document.body.textContent || ''),
        hasForm: !!document.querySelector('form input[name="email"]'),
      }));
      rec.reloadPosts = posts;

      // Back must return to the form without re-submitting.
      await page.goBack({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      rec.afterBack = await page.evaluate(() => ({
        hasForm: !!document.querySelector('form input[name="email"]'),
        url: location.pathname + location.search,
      }));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'lead.json'), JSON.stringify(rec, null, 2));

  // ── B22 ───────────────────────────────────────────────────────────────────
  const dated = rec.placeholders.filter((p) => /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(19|20)\d{2}\b/.test(p));
  // A RATCHET, because this one is half DATA and this plan may not edit
  // data/*.json.
  //
  // The COPY_DEFAULTS value is fixed, so a fresh install has no date in any
  // placeholder. The LIVE string is saved in content.json — the owner typed it
  // and only he can change it — so the rendered form still shows
  // "e.g. ASAP, end of month, 6/30/2025" until he edits it in Page Content.
  // It is on the owner action list.
  //
  // Asserting zero here would go green only after Rick acts, which makes the
  // suite a reminder rather than a test. Asserting "no more than the one known
  // owner-owned string" holds the line against a NEW hardcoded date arriving
  // in code, which is the part this plan controls.
  const OWNER_OWNED = 1;
  note(dated.length <= OWNER_OWNED,
    `at most ${OWNER_OWNED} placeholder carries a literal date, and it is the owner-editable ` +
    `Required-date example whose code default is already dateless ` +
    `(${dated.length} of ${rec.placeholders.length} placeholders)`,
    dated.join(' | '));

  // ── B26 — DEFERRED, and this records the measurement so it is not lost ────
  //
  // At 390 the first form field sits 1,213px down, below four contact cards
  // and a tip panel, on the page whose whole purpose is the form.
  //
  // Not fixed here. The only correct fix is reordering the DOM so the form
  // comes first and restoring the desktop arrangement with `lg:order-*`: a
  // CSS-only reorder leaves tab order following the DOM while the eye follows
  // the layout, which PLAN-8 explicitly rules out and the next assertion
  // detects. That is a ~90-line move of the contact grid's children and it was
  // not attempted rather than half-attempted. Logged in WHATS_LEFT §2.
  //
  // The assertion is inverted deliberately: it asserts the defect is STILL
  // THERE, so that whoever fixes it is forced to come back and flip this line
  // rather than finding a suite that quietly went green on its own.
  note(rec.mobile.firstFieldTop !== null && rec.mobile.firstFieldTop > 900,
    `@390: B26 is still open — the first form field is ${rec.mobile.firstFieldTop}px down ` +
    `(deferred; flip this assertion to < 900 when the DOM order is fixed)`);
  note(rec.mobileTabOrder.monotonic,
    `@390: tab order still follows visual order across ${rec.mobileTabOrder.count} controls`,
    'a CSS-only reorder desyncs them — fix the DOM order instead');

  // ── B16 ───────────────────────────────────────────────────────────────────
  const s = rec.success;
  const status = s.liveRegions.filter((r) => r.role === 'status' || r.live);
  note(status.length > 0,
    `the success panel is an announced region (${s.liveRegions.length} live/status regions on the page)`,
    JSON.stringify(s.liveRegions));
  note(s.activeTag && s.activeTag !== 'BODY',
    `focus moved to the confirmation, not left on <body> (activeElement=${s.activeTag}, role=${s.activeRole})`,
    JSON.stringify({ tag: s.activeTag, text: s.activeText }));

  // ── B17 ───────────────────────────────────────────────────────────────────
  note(/[?&]sent=1/.test(rec.successUrl),
    `the confirmation has its own URL (${rec.successUrl})`);
  note(rec.afterReload.stillConfirmed && !rec.afterReload.hasForm,
    'reloading the confirmation URL still shows the confirmation, not an empty form');
  note(rec.reloadPosts === 0,
    `reloading sent no POST (${rec.reloadPosts})`);
  note(rec.afterBack.hasForm,
    `Back returns to the form (${rec.afterBack.url})`);

  // ── B18 ───────────────────────────────────────────────────────────────────
  note(s.emoji.length === 0,
    'no emoji in the confirmation panel — glyph coverage is a font dependency and this one was already failing',
    s.emoji.join(' '));
  note(s.tel.length > 0 && s.mail.length > 0,
    `phone and email on the confirmation are real links (tel:${s.tel.length}, mailto:${s.mail.length})`);
  note(s.eyebrowPresent,
    'the confirmation page header has an eyebrow like every other page');
  note(s.gap !== null && s.gap < 80,
    `the gap between the last control and the footer is ${s.gap}px (< 80)`);

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-lead ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'lead.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
