/**
 * The truncation guard, exercised against a REAL truncating server.
 *
 * :8124 runs max_input_vars=100 with display_errors=Off — the production shape
 * (public/.user.ini). The content form posts ~460 variables (458 on
 * 2026-10-02; plan4-admin.js POSTED_BEFORE holds the count), so PHP genuinely
 * drops everything past the 100th and `form_complete` never arrives. This is
 * not a simulation: the field is not removed by the test, PHP discards it.
 *
 * :8125 is the negative control — same truncation, display_errors=On. If both
 * ports behaved identically the display_errors assertion would be measuring
 * nothing.
 *
 * Asserts the DEPLOY_READINESS_v2 T3.7 behaviour:
 *   - the save is REFUSED (content.json byte-identical to pristine)
 *   - the page says so, in words, naming max_input_vars
 *   - no raw PHP warning leaks into the page on the production-shaped server
 *   - B1: the form comes back holding what was typed, not the disk values
 *
 * Usage: node _harness/plan2-trunc.js      (needs :8123, :8124 and :8125)
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const PW = 'audit-pass-123';
const DIR = path.join(__dirname, 'site/data');
const MIRROR_CONTENT = path.join(DIR, 'content.json');
const PRISTINE_CONTENT = path.join(__dirname, 'pristine/content.json');

const MARKER = 'TRUNCMARK' + process.pid;
// What only a leaked PHP warning produces — never the guard's own message.
const LEAK = /Warning:\s*(PHP\s*)?(Request|Input)|max_input_vars exceeded|on line \d+ in \/|<b>Warning<\/b>/i;

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

function restore() {
  fs.copyFileSync(PRISTINE_CONTENT, MIRROR_CONTENT);
  for (const f of fs.readdirSync(DIR)) {
    if (/^content\.backup\./.test(f)) fs.unlinkSync(path.join(DIR, f));
  }
}

async function submitOn(browser, base) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  await page.goto(`${base}/admin/content.php`, { waitUntil: 'domcontentloaded' });

  // Type into an EARLY field — one of the first 100 variables, so it survives
  // the cut and we can prove the repopulation kept it.
  await page.fill('input[name="copy[hero][headlineLine1]"]', MARKER);

  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.click('button:has-text("Save Content")'),
  ]);
  const body = await page.innerText('body');
  const html = await page.content();
  const url = page.url();
  const heroValue = await page.$eval('input[name="copy[hero][headlineLine1]"]', (el) => el.value)
    .catch(() => '(field missing)');
  await ctx.close();
  return { body, html, url, heroValue };
}

(async () => {
  const browser = await launch();
  try {
    restore();
    const beforeBytes = fs.readFileSync(MIRROR_CONTENT);

    // ── the production-shaped truncating server ────────────────────────────
    const t = await submitOn(browser, 'http://127.0.0.1:8124');

    note(!t.url.includes('saved=1'), 'the truncated save is REFUSED (no ?saved=1 redirect)',
      `landed at ${t.url}`);

    const afterBytes = fs.readFileSync(MIRROR_CONTENT);
    note(afterBytes.equals(beforeBytes),
      'content.json is byte-identical to pristine after the truncated POST');

    note(/did not submit completely/i.test(t.body),
      'the page tells the owner the request was cut off',
      `body did not contain the truncation message`);

    note(/max_input_vars/i.test(t.body),
      'the message names max_input_vars so a developer can act on it');

    note(/NOTHING was saved/i.test(t.body),
      'the message states plainly that nothing was saved');

    // B1: the form must come back holding what was typed.
    note(t.heroValue === MARKER,
      'B1: the field typed before the cut survived into the re-rendered form',
      `hero.headlineLine1 came back as ${JSON.stringify(t.heroValue)}`);

    // display_errors=Off must hold: a raw PHP warning on an admin page is both
    // ugly and a path disclosure.
    const leaked = LEAK.test(t.html);
    note(!leaked, 'no raw PHP warning leaked into the page (display_errors=Off)',
      'found a PHP warning in the response body');

    // ── negative control ───────────────────────────────────────────────────
    // Same truncation, display_errors=On. If this looks identical to :8124 the
    // assertion above is vacuous.
    restore();
    const c = await submitOn(browser, 'http://127.0.0.1:8125');
    // The SAME regex as the check it controls: /Warning|max_input_vars/ also
    // matched the guard's own "(PHP max_input_vars)" sentence, so the control
    // passed even against a display_errors=Off server (AUDIT-12 A12-L13-12-1).
    const controlLeaked = LEAK.test(c.html);
    note(controlLeaked,
      'negative control :8125 (display_errors=On) DOES surface the PHP warning',
      'the two servers behaved identically — the display_errors check proves nothing');

    note(!c.url.includes('saved=1'),
      'negative control: the guard still refuses the save regardless of display_errors');

    const afterControl = fs.readFileSync(MIRROR_CONTENT);
    note(afterControl.equals(beforeBytes),
      'negative control: content.json still byte-identical');

    // ── T3.5 — "That upload was too large for this server" ─────────────────
    // Over post_max_size PHP empties $_POST and $_FILES, and csrf_check()
    // turns that into the too-large page. It renders only with
    // display_errors=Off (public/.user.ini) — on :8123's ini PHP's own warning
    // is output first and the owner sees "session expired" instead — so it is
    // driven here against :8124, the display_errors=Off server. Nothing in the
    // sweep asserted this page before (AUDIT-12 A12-L13-05-W5-3).
    {
      const { adminHttp } = require('./adminhttp');
      const a = adminHttp(8124);
      const signedIn = await a.login(PW);
      const big = Buffer.alloc(25 * 1024 * 1024 + 4096, 0x61);   // > post_max_size = 24M
      const B = '----ipcTooLarge';
      const body = Buffer.concat([Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="f"; filename="big.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        big, Buffer.from(`\r\n--${B}--\r\n`)]);
      const r = await a.req('POST', '/admin/settings.php', body, { 'Content-Type': `multipart/form-data; boundary=${B}`, 'Content-Length': body.length });
      const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(r.body) || [, ''])[1].trim();
      note(signedIn && r.status === 403 && /That upload was too large for this server/.test(h1) && !LEAK.test(r.body),
        'T3.5: an over-post_max_size upload gets the "too large" page, not "session expired" (display_errors=Off)',
        `signed in ${signedIn}; HTTP ${r.status}; <h1> ${JSON.stringify(h1)}`);
    }

    // ── and the untruncated server still saves ─────────────────────────────
    // Otherwise "refused" could just mean the page is broken everywhere.
    restore();
    const ok = await submitOn(browser, 'http://127.0.0.1:8123');
    note(ok.url.includes('saved=1'),
      'control :8123 (stock max_input_vars) SAVES the same form',
      `landed at ${ok.url}`);
    const saved = JSON.parse(fs.readFileSync(MIRROR_CONTENT, 'utf8'));
    note(saved?.copy?.hero?.headlineLine1 === MARKER,
      'control :8123 wrote the typed value to content.json');
  } catch (e) {
    note(false, 'suite ran without throwing', e.message);
  } finally {
    await browser.close();
    restore();
    note(fs.readFileSync(MIRROR_CONTENT).equals(fs.readFileSync(PRISTINE_CONTENT)),
      'mirror content.json restored from pristine');
  }

  const failing = results.filter((r) => !r.ok).length;
  console.log(`\nplan2-trunc ${results.length - failing}/${results.length}`);
  process.exit(failing === 0 ? 0 : 1);
})();
