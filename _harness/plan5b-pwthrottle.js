/**
 * `admin/password.php still sleeps` — the change-password form kept the
 * throttle 4.14 replaced everywhere else.
 *
 * It had both of 4.14's faults. `sleep(min(8, $failures - 4))` is
 * per-connection, so simultaneous attempts all slept at the same time and
 * finished together; and `login_failure_count()` then `login_register_failure()`
 * read and wrote the counter separately. It was left alone during PLAN-5
 * because password.php is outside that plan's scope boundary
 * ("admin/auth.php (throttle only), admin/config.php (login_* helpers only)").
 *
 * It now takes a slot from the SAME `login_attempt_gate()` the login form uses,
 * so the two forms share one budget and neither can be parallelised.
 *
 * On parallelism: this suite does NOT re-prove that the gate is atomic — that
 * is `plan5-throttle.js`'s job, it needs a ten-server fleet to show at all, and
 * it is the same function. What is asserted here is that password.php now goes
 * through that gate rather than sleeping, which is the thing that changed.
 *
 * Asserts (signed in, driving the real form):
 *   - nothing sleeps: 12 wrong-current-password submits complete quickly, where
 *     the old code slept 1+2+3+…+8 s
 *   - past the free allowance the form is refused BY THE CLOCK, and says so in
 *     Rick's words — naming the wait and that waiting is the whole fix
 *   - the refusal names *current-password* attempts, not "sign-in" attempts,
 *     because he is already signed in and being told otherwise is confusing
 *   - a refused attempt is neither counted nor allowed to extend the window
 *   - the password is NOT changed on a refused attempt (config.local.php in the
 *     mirror is byte-identical afterwards)
 *   - the correct current password still works while no cool-off is armed, and
 *     clears the streak
 *   - the login form and this form share one budget — burning the allowance
 *     here refuses there too
 *
 * Writes only the MIRROR's admin/.login-throttle.json, and reads (never
 * rewrites) the mirror's config.local.php. The repo's data/ is untouched.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5b-pwthrottle.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const SITE_ADMIN = path.join(__dirname, 'site', 'admin');
const THROTTLE = path.join(SITE_ADMIN, '.login-throttle.json');
const LOCAL_CONFIG = path.join(SITE_ADMIN, 'config.local.php');
const FREE = 5;      // LOGIN_FREE_ATTEMPTS
const CAP = 300;     // LOGIN_COOLOFF_MAX

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const clearThrottle = () => fs.rmSync(THROTTLE, { force: true });
const readThrottle = () => (fs.existsSync(THROTTLE) ? fs.readFileSync(THROTTLE, 'utf8') : '(absent)');
const strip = (t) => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Submit the change-password form. Anchored on the form that owns the fields —
 *  nav.php renders a Sign Out form above it, so a bare button[type=submit]
 *  matches the wrong one. */
async function submit(page, current, next = 'a-perfectly-fine-new-password-42') {
  await page.goto(`${BASE}/admin/password.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('#current_password', current);
  await page.fill('#new_password', next);
  await page.fill('#confirm_password', next);
  const t0 = Date.now();
  await page.click('form:has(#current_password) button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  const body = await page.content();
  return { ms: Date.now() - t0, text: strip(body) };
}

const isCooloff = (t) => /Too many incorrect current-password attempts/.test(t);
const isWrongPw = (t) => /The current password is incorrect/.test(t);

(async () => {
  const browser = await launch();
  const configBefore = fs.readFileSync(LOCAL_CONFIG);

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', PW);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    clearThrottle();

    // ── nothing sleeps ────────────────────────────────────────────────────
    const runs = [];
    for (let i = 0; i < 12; i++) runs.push(await submit(page, 'wrong-current-guess'));
    const total = runs.reduce((a, r) => a + r.ms, 0);
    const evaluated = runs.filter((r) => isWrongPw(r.text)).length;
    const refused = runs.filter((r) => isCooloff(r.text) && !isWrongPw(r.text)).length;
    console.log(`       12 submits: ${total} ms total, ${evaluated} evaluated, ${refused} refused`);
    note(total < 12000,
      `no request sleeps — 12 wrong-password submits took ${total} ms ` +
      `(the old code slept up to 8 s each, ~30 s for this run)`,
      `${total} ms`);
    note(evaluated <= FREE + 1 && refused >= 5,
      `the guess budget is bounded — ${evaluated} of 12 reached password_verify(), ${refused} refused by the clock`,
      JSON.stringify({ evaluated, refused }));

    // ── the refusal explains itself, in the right words ───────────────────
    const refusal = runs.find((r) => isCooloff(r.text) && !isWrongPw(r.text));
    note(!!refusal && /wait about/.test(refusal.text) && /clears itself/.test(refusal.text),
      'the refusal tells Rick how long to wait and that waiting is the whole fix',
      (refusal && (refusal.text.match(/Too many[^.]*\.[^.]*\.[^.]*\./) || [''])[0]) || 'no refusal seen');
    note(!!refusal && !/failed sign-in attempts/.test(refusal.text),
      'it says "current-password attempts", not "sign-in attempts" — he is already signed in',
      (refusal && (refusal.text.match(/Too many [a-z- ]+ from this computer/) || [''])[0]) || '');

    // ── a refused attempt neither counts nor extends, and changes nothing ──
    const recBefore = JSON.parse(readThrottle())['127.0.0.1'];
    for (let i = 0; i < 4; i++) await submit(page, 'wrong-current-guess');
    const recAfter = JSON.parse(readThrottle())['127.0.0.1'];
    note(recAfter.c === recBefore.c && recAfter.r === recBefore.r,
      'attempts during the cool-off are neither counted nor allowed to extend it',
      `${JSON.stringify(recBefore)} -> ${JSON.stringify(recAfter)}`);
    note(recAfter.r - recAfter.t <= CAP,
      `the cool-off is capped at ${CAP}s (this one is ${recAfter.r - recAfter.t}s)`,
      JSON.stringify(recAfter));
    note(fs.readFileSync(LOCAL_CONFIG).equals(configBefore),
      'no refused attempt changed the stored password — config.local.php is byte-identical',
      'the mirror credential file changed');

    // ── the two forms share one budget ────────────────────────────────────
    const loginDuringCooloff = await fetch(`${BASE}/admin/auth.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: PW }).toString(),
      redirect: 'manual',
    });
    const loginBody = loginDuringCooloff.status === 302 ? '' : strip(await loginDuringCooloff.text());
    note(loginDuringCooloff.status !== 302 && /Too many failed sign-in attempts/.test(loginBody),
      'burning the allowance on the password form refuses the LOGIN form too — one shared budget',
      `status ${loginDuringCooloff.status}`);

    // ── the correct current password still works ──────────────────────────
    clearThrottle();
    const good = await submit(page, PW, 'another-perfectly-fine-password-77');
    note(/Password changed/.test(good.text),
      'with no cool-off armed, the correct current password changes the password',
      good.text.slice(0, 200));
    note(!/127\.0\.0\.1/.test(readThrottle()),
      'a successful change clears this IP\'s streak',
      `throttle file: ${readThrottle()}`);

    await ctx.close();
  } finally {
    // Put the mirror's credential back — the suite deliberately changes it.
    fs.writeFileSync(LOCAL_CONFIG, configBefore);
    clearThrottle();
    await browser.close();
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5b-pwthrottle: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
