/**
 * PLAN-5 4.14 — the login throttle was a delay, not a lockout, and it raced.
 *
 * Two measured faults in the shipped code:
 *
 *   1. sleep(min(8, failures - 4)) is PER CONNECTION. Simultaneous attempts all
 *      slept at the same time and finished together, so the delay bounded a
 *      single-threaded guessing run and bounded nothing against a parallel one.
 *   2. login_register_failure() read with file_get_contents() and wrote with
 *      file_put_contents(..., LOCK_EX). The write was atomic; the read-then-
 *      write pair was not. Two concurrent failures could both read c=3 and both
 *      store c=4 — counts lost under exactly the load the throttle exists for.
 *
 * ─── Why this suite needs its own servers ───────────────────────────────────
 *
 * A single `php -S` answers one request at a time, so neither fault can appear:
 * there is no read-modify-write to interleave and no two connections to sleep
 * concurrently. Run against :8123 the UNFIXED code scores "10 parallel failures
 * produce 10 counts" and "serial and parallel take the same time" — green, and
 * worth nothing. PHP_CLI_SERVER_WORKERS was tried and is not enough either:
 * measured, 8 workers served 8 concurrent sleep(2) requests in 6 s, i.e. about
 * three at a time.
 *
 * So this suite drives a FLEET of ten independent `php -S` instances sharing
 * one docroot — and therefore one admin/.login-throttle.json, which is what the
 * lock actually protects. Measured: 10 x sleep(2) in 2.1 s across 10 distinct
 * PIDs.
 *
 *   for p in 8130 8131 8132 8133 8134 8135 8136 8137 8138 8139; do
 *     php -S 127.0.0.1:$p -t _harness/site -c _harness/php-mail.ini \
 *         _harness/router.php >/dev/null 2>&1 &
 *   done
 *
 * ─── Asserts ────────────────────────────────────────────────────────────────
 *   A  10 genuinely parallel calls to login_register_failure() produce exactly
 *      10 counts. Driven at the helper through a probe the suite writes into
 *      the MIRROR's admin/ and deletes again — the login form cannot show this,
 *      because past the free allowance it deliberately stops counting refused
 *      attempts.
 *   B  parallelism buys nothing: guesses EVALUATED (checked against the hash)
 *      are bounded by the clock, not by how many connections are open. Timings
 *      for serial and parallel runs are printed.
 *   C  the correct password signs in immediately while no cool-off is armed,
 *      and login_reset_failures() clears the streak.
 *   D  Rick cannot be stranded: the cool-off is capped, a refused attempt does
 *      not extend it, and once the window passes a correct password works.
 *
 * The mirror's admin/.login-throttle.json is the only file written. The repo's
 * data/, pdfs/ and uploads/ are never touched.
 *
 * Usage: node _harness/plan5-throttle.js
 */

const fs = require('fs');
const path = require('path');

const PORTS = [8130, 8131, 8132, 8133, 8134, 8135, 8136, 8137, 8138, 8139];
const BASE = `http://127.0.0.1:${PORTS[0]}`;
const PW = 'audit-pass-123';
const SITE_ADMIN = path.join(__dirname, 'site', 'admin');
const THROTTLE = path.join(SITE_ADMIN, '.login-throttle.json');
const PROBE = path.join(SITE_ADMIN, '_plan5-throttle-probe.php');
const FREE = 5;          // LOGIN_FREE_ATTEMPTS
const CAP = 300;         // LOGIN_COOLOFF_MAX

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// Calls exactly one throttle helper and reports the map. Written into the
// MIRROR only, never into the repo's admin/, and removed in the finally block.
const PROBE_SRC = `<?php
require_once __DIR__ . '/config.php';
$ip = 'plan5-probe';
$act = $_GET['act'] ?? 'read';
// Line up the workers on the wall clock so they collide inside the helper.
if ($act === 'fail') {
    $at = (int)($_GET['at'] ?? 0);
    while ($at && microtime(true) * 1000 < $at) usleep(2000);
    login_register_failure($ip);
    echo json_encode(['ok' => true]);
    exit;
}
if ($act === 'reset') { login_reset_failures($ip); echo json_encode(['ok' => true]); exit; }
$map = login_throttle_read();
echo json_encode(['count' => (int)($map[$ip]['c'] ?? 0), 'rec' => $map[$ip] ?? null]);
`;

const readThrottle = () => (fs.existsSync(THROTTLE) ? fs.readFileSync(THROTTLE, 'utf8') : '(absent)');

async function post(body, port = PORTS[0]) {
  const t0 = Date.now();
  const res = await fetch(`http://127.0.0.1:${port}/admin/auth.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    redirect: 'manual',
  });
  const text = res.status === 302 ? '' : await res.text();
  return { status: res.status, ms: Date.now() - t0, text, location: res.headers.get('location') };
}

// A response can carry BOTH strings — the attempt that arms the window says
// "Incorrect password ... Too many failed sign-in attempts". That one WAS
// evaluated against the hash, so the two classes must be exclusive or the
// totals come to more than the number of guesses fired.
const isWrongPw = (t) => /Incorrect password/.test(t);
const isCooloff = (t) => /Too many failed sign-in attempts/.test(t) && !isWrongPw(t);

/** Clear the throttle file outright. A correct password cannot be relied on to
 *  clear it — during a cool-off the correct password is (deliberately) refused,
 *  so the streak survives, and an earlier draft of this suite carried phase B's
 *  armed window into phase C and read it as phase C failing. */
const clearThrottle = () => fs.rmSync(THROTTLE, { force: true });
const strip = (t) => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  try {
    for (const p of PORTS) {
      const r = await fetch(`http://127.0.0.1:${p}/`).catch(() => null);
      if (!r) { console.log(`\nport ${p} is not answering — start the fleet (see the header).`); process.exit(2); }
    }
    fs.writeFileSync(PROBE, PROBE_SRC);

    // ── A — the lock: 10 parallel failures must count 10 ────────────────────
    await fetch(`${BASE}/admin/_plan5-throttle-probe.php?act=reset`);
    const before = readThrottle();
    const at = Date.now() + 1500;                       // common start instant
    await Promise.all(PORTS.map((p) =>
      fetch(`http://127.0.0.1:${p}/admin/_plan5-throttle-probe.php?act=fail&at=${at}`).then((r) => r.text())));
    const after = readThrottle();
    const counted = JSON.parse(
      await fetch(`${BASE}/admin/_plan5-throttle-probe.php?act=read`).then((r) => r.text())).count;
    note(counted === 10, `A: 10 parallel failed attempts produce 10 counted failures (got ${counted})`,
      'counts were lost in the read-modify-write');
    console.log(`       throttle file BEFORE: ${before}`);
    console.log(`       throttle file AFTER : ${after}`);
    await fetch(`${BASE}/admin/_plan5-throttle-probe.php?act=reset`);

    // ── B — parallelism buys nothing ────────────────────────────────────────
    // "Evaluated" = the response said "Incorrect password", i.e. the guess was
    // really checked against the hash. A cool-off response was refused without
    // being checked and is worth nothing to an attacker.
    const GUESSES = 12;
    const run = async (parallel) => {
      clearThrottle();
      const t0 = Date.now();
      const out = parallel
        ? await Promise.all(Array.from({ length: GUESSES },
            (_, i) => post({ password: 'wrong-guess' }, PORTS[i % PORTS.length])))
        : await (async () => {
            const acc = [];
            for (let i = 0; i < GUESSES; i++) acc.push(await post({ password: 'wrong-guess' }));
            return acc;
          })();
      return { ms: Date.now() - t0,
               evaluated: out.filter((r) => isWrongPw(r.text)).length,
               refused: out.filter((r) => isCooloff(r.text)).length };
    };

    const serial = await run(false);
    const parallel = await run(true);
    console.log(`       serial   : ${serial.ms} ms, ${serial.evaluated} evaluated, ${serial.refused} refused`);
    console.log(`       parallel : ${parallel.ms} ms, ${parallel.evaluated} evaluated, ${parallel.refused} refused`);

    // A parallel run can win at most one "window" — connections that read the
    // record before any of them armed the cool-off. That is bounded by the
    // fleet size, not by the guess count, which is the whole claim. It must not
    // approach GUESSES.
    note(parallel.evaluated < GUESSES,
      `B: parallelism cannot amortise the throttle — ${parallel.evaluated} of ${GUESSES} ` +
      `parallel guesses were evaluated, ${parallel.refused} refused by the clock`,
      JSON.stringify(parallel));
    note(parallel.evaluated === serial.evaluated && serial.evaluated <= FREE + 1,
      `B: parallel and serial evaluate the SAME number of guesses ` +
      `(${serial.evaluated} each, the free allowance plus the one that arms the window) — ` +
      `the gate counts attempts under the lock, so opening ten connections wins nothing`,
      JSON.stringify({ serial, parallel }));
    note(serial.ms < 12000,
      `B: no request sleeps — ${GUESSES} serial attempts complete in ${serial.ms} ms ` +
      `(the old code slept up to 8 s per attempt and took ~30 s here)`,
      `${serial.ms} ms`);

    // ── C — a correct password works while no cool-off is armed ─────────────
    clearThrottle();
    for (let i = 0; i < FREE; i++) await post({ password: 'wrong-guess' });
    const stillOpen = await post({ password: PW });
    note(stillOpen.status === 302 && /index\.php/.test(stillOpen.location || ''),
      `C: after ${FREE} failures (the free allowance) the correct password signs in immediately`,
      `status ${stillOpen.status} -> ${stillOpen.location}`);
    note(!/127\.0\.0\.1/.test(readThrottle()),
      "C: login_reset_failures() cleared this IP's streak on success",
      `throttle file: ${readThrottle()}`);

    // ── D — the cool-off engages, is capped, and retrying cannot extend it ──
    clearThrottle();
    for (let i = 0; i <= FREE; i++) await post({ password: 'wrong-guess' });
    const first = await post({ password: 'wrong-guess' });
    note(isCooloff(first.text), 'D: past the free allowance the next attempt is refused by the clock',
      strip(first.text).slice(0, 160));
    note(/wait about/.test(first.text) && /clears itself/.test(first.text),
      'D: the refusal tells Rick how long to wait and that waiting is the whole fix',
      (strip(first.text).match(/Too many[^.]*\.[^.]*\.[^.]*\./) || [''])[0]);

    const recBefore = JSON.parse(readThrottle())['127.0.0.1'];
    for (let i = 0; i < 5; i++) await post({ password: 'wrong-guess' });   // hammer during cool-off
    const recAfter = JSON.parse(readThrottle())['127.0.0.1'];
    note(recAfter.r === recBefore.r && recAfter.c === recBefore.c,
      'D: attempts during the cool-off are neither counted nor allowed to extend it',
      `${JSON.stringify(recBefore)} -> ${JSON.stringify(recAfter)}`);
    note(recAfter.r - recAfter.t <= CAP,
      `D: the cool-off is capped at ${CAP}s so the owner is never stranded ` +
      `(this one is ${recAfter.r - recAfter.t}s)`,
      JSON.stringify(recAfter));

    const during = await post({ password: PW });
    note(during.status !== 302,
      'D: the correct password is refused DURING the cool-off — no oracle, and it costs at most the window',
      `status ${during.status}`);

    const waitMs = (recAfter.r - Math.floor(Date.now() / 1000) + 1) * 1000;
    console.log(`       waiting ${Math.round(waitMs / 1000)}s for the cool-off to expire…`);
    await new Promise((r) => setTimeout(r, Math.max(0, waitMs)));
    const afterWait = await post({ password: PW });
    note(afterWait.status === 302 && /index\.php/.test(afterWait.location || ''),
      'D: once the window passes the correct password signs in — no permanent lockout',
      `status ${afterWait.status} -> ${afterWait.location}`);
  } finally {
    fs.rmSync(PROBE, { force: true });
    fs.rmSync(THROTTLE, { force: true });
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5-throttle: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
