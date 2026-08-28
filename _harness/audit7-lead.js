/**
 * Audit 7, findings A-7.1 through A-7.6 — the lead path, the session store,
 * and the two gaps in audit 6's own fixes.
 *
 * Written against the UNFIXED tree and watched to fail, per GUARDRAILS 4.4.
 *
 * `audit7.js` covers A-7.8/9/10 (the render-side catalog guards and the fetch
 * timeout) and needs a browser for every arm. These six are HTTP, filesystem
 * and PHP-level, so they live in their own file rather than bolting a second
 * mode onto a browser suite. Both are named in `_harness/README.md`.
 *
 * Needs the mirror on :8123 (started with -t _harness/site, php-mail.ini).
 *
 * Usage: node _harness/audit7-lead.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = 'http://127.0.0.1:8123';
const ROOT = path.join(__dirname, '..');
const MIRROR_ADMIN = path.join(__dirname, 'site', 'admin');
const INQUIRIES = path.join(MIRROR_ADMIN, 'inquiries.jsonl');
const FAIL_MARKER = path.join(MIRROR_ADMIN, '.inquiry-log-failed.json');
const SESS_DIR = (() => {
  try {
    const out = execFileSync('php', ['-c', path.join(__dirname, 'php-mail.ini'), '-r',
      'echo ini_get("session.save_path") ?: sys_get_temp_dir();'], { encoding: 'utf8' });
    return out.trim();
  } catch { return '/tmp'; }
})();

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const logLines = () => {
  try {
    return fs.readFileSync(INQUIRIES, 'utf8').split('\n').filter((l) => l.trim() !== '').length;
  } catch { return 0; }
};
const sessCount = () => {
  try { return fs.readdirSync(SESS_DIR).filter((f) => f.startsWith('sess_')).length; }
  catch { return -1; }
};

/** POST a urlencoded body, returning {status, headers, body}. */
async function post(fields, headers = {}) {
  const res = await fetch(`${BASE}/contact.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  });
  return { status: res.status, ctype: res.headers.get('content-type') || '', body: await res.text() };
}

/**
 * The rate limiter is 5 per IP per 10 minutes and every request here comes from
 * 127.0.0.1, so a suite that just fires submissions hits its own 429 and every
 * assertion after that measures the limiter. Clear the limiter file between
 * arms — it is keyed md5(ip) under the system temp dir, exactly as
 * contact.php computes it.
 */
function clearLimiter() {
  const md5 = require('crypto').createHash('md5').update('127.0.0.1').digest('hex');
  for (const f of [`ipc_rl_${md5}.json`]) {
    try { fs.unlinkSync(path.join('/tmp', f)); } catch { /* not there */ }
  }
  // The auto-reply cap is keyed on the address; drop those too so a repeated
  // address in a later arm is not silently capped.
  try {
    for (const f of fs.readdirSync('/tmp')) {
      if (f.startsWith('ipc_ar_')) fs.unlinkSync(path.join('/tmp', f));
    }
  } catch { /* ignore */ }
}

const RFQ = {
  form_type: 'rfq',
  name: 'Jane Smith',
  company: 'Acme Corp',
  phone: '555-0100',
  partNumber: 'IP38FE',
  quantity: '500 ft',
};

(async () => {
  // ── A-7.1 — the 422 is the only exit that keeps no record ────────────────
  //
  // Reachable by a real customer because the browser and the server disagree
  // about what an email address is: type="email" accepts a dotless domain
  // (HTML5 permits intranet addresses), FILTER_VALIDATE_EMAIL rejects it. A
  // dropped ".com" is an ordinary typo.
  for (const [tag, email] of [
    ['dotless domain (browser ACCEPTS this)', 'jane@acmecorp'],
    ['comma for a dot', 'jane.smith@company,com'],
  ]) {
    clearLimiter();
    const before = logLines();
    const r = await post({ ...RFQ, email });
    const after = logLines();
    note(
      r.status === 422,
      `A-7.1 [${tag}] — still rejected with 422`,
      r.status !== 422 ? `got ${r.status}; the arm is not testing the 422 path` : ''
    );
    note(
      after - before === 1,
      `A-7.1 [${tag}] — the rejected lead is recorded`,
      after - before !== 1
        ? `inquiry log delta ${after - before}, expected +1 — the lead left no trace at all`
        : ''
    );
  }

  // CONTROL: a valid submission must still be logged exactly once. If this
  // fails the log-delta assertions above are measuring something else.
  clearLimiter();
  {
    const before = logLines();
    const r = await post({ ...RFQ, email: 'jane@acme.com' });
    const after = logLines();
    note(
      r.status === 200 && after - before === 1,
      'A-7.1 CONTROL — a valid submission is 200 and logged exactly once',
      `status ${r.status}, log delta ${after - before}`
    );
  }

  // ── A-7.2 — the no-JS submitter gets raw JSON ────────────────────────────
  //
  // Both forms carry method/action deliberately — that native-submit path is
  // why A-5.3 exists. A-5.3 made it SUCCEED; it did not make the visitor able
  // to tell. A native form navigation sends Accept: text/html; fetch() with no
  // explicit Accept sends */*, so Accept is a clean discriminator.
  clearLimiter();
  {
    const r = await post(
      { ...RFQ, email: 'jane@acme.com' },
      { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    );
    const isHtml = /text\/html/i.test(r.ctype);
    const hasHeading = /<h1[\s>]/i.test(r.body);
    const hasPhone = /630\.771\.0700/.test(r.body);
    const hasLinkBack = /<a\s[^>]*href=/i.test(r.body);
    note(r.status === 200, 'A-7.2 — the native submit still succeeds', `status ${r.status}`);
    note(
      isHtml,
      'A-7.2 — a browser navigation gets text/html, not application/json',
      !isHtml ? `Content-Type: ${r.ctype}; body starts ${JSON.stringify(r.body.slice(0, 40))}` : ''
    );
    note(
      hasHeading && hasPhone && hasLinkBack,
      'A-7.2 — that page has a heading, the phone number and a way back',
      `heading=${hasHeading} phone=${hasPhone} link=${hasLinkBack}`
    );
  }

  // The 422 variant: an error must be readable too, not raw JSON.
  clearLimiter();
  {
    const r = await post(
      { ...RFQ, email: 'jane@acmecorp' },
      { Accept: 'text/html,application/xhtml+xml' }
    );
    note(
      r.status === 422 && /text\/html/i.test(r.ctype) && /<h1[\s>]/i.test(r.body),
      'A-7.2 — a rejected native submit is a readable page too',
      `status ${r.status}, ctype ${r.ctype}`
    );
  }

  // CONTROL: the fetch() path must be UNCHANGED — still JSON, still parseable.
  // This is what separates "content negotiation" from "broke the AJAX form".
  clearLimiter();
  {
    const r = await post({ ...RFQ, email: 'jane@acme.com' }, { Accept: '*/*' });
    let parsed = null;
    try { parsed = JSON.parse(r.body); } catch { /* stays null */ }
    note(
      /application\/json/i.test(r.ctype) && parsed && parsed.ok === true,
      'A-7.2 CONTROL — the fetch() path still gets {"ok":true} as JSON',
      `ctype ${r.ctype}, body ${JSON.stringify(r.body.slice(0, 60))}`
    );
  }
  // And with no Accept header at all, which is what some fetch stacks send.
  clearLimiter();
  {
    const res = await fetch(`${BASE}/contact.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...RFQ, email: 'jane@acme.com' }).toString(),
    });
    const ct = res.headers.get('content-type') || '';
    const body = await res.text();
    note(
      /application\/json/i.test(ct) && /"ok"\s*:\s*true/.test(body),
      'A-7.2 CONTROL — no Accept header at all still gets JSON',
      `ctype ${ct}, body ${JSON.stringify(body.slice(0, 60))}`
    );
  }

  // ── A-7.3 — anonymous /admin/ping.php mints an 8-hour session file ───────
  {
    const before = sessCount();
    for (let i = 0; i < 10; i++) {
      await fetch(`${BASE}/admin/ping.php`, { headers: { 'Cache-Control': 'no-cache' } });
    }
    const after = sessCount();
    note(
      before >= 0,
      'A-7.3 — the session save path is readable, so this arm can measure',
      before < 0 ? `cannot read ${SESS_DIR}` : ''
    );
    note(
      after - before === 0,
      'A-7.3 — 10 anonymous ping.php requests create no session files',
      after - before !== 0
        ? `${after - before} new sess_ files in ${SESS_DIR}; each lives 8 hours ` +
          '(gc_maxlifetime 28800), and ping.php is unauthenticated and machine-polled'
        : ''
    );
    // The answer must not change: no cookie cannot be authenticated.
    const r = await fetch(`${BASE}/admin/ping.php`);
    const body = await r.text();
    note(
      r.status === 200 && /"ok"\s*:\s*false/.test(body),
      'A-7.3 — ping.php still answers {"ok":false} for an anonymous caller',
      `status ${r.status}, body ${JSON.stringify(body.slice(0, 40))}`
    );
  }
  // CONTROL: auth.php genuinely needs a session on GET (it renders a CSRF
  // token), so it must STILL mint one. Without this the fix could have been
  // "stop starting sessions everywhere", which would break login.
  {
    const before = sessCount();
    await fetch(`${BASE}/admin/auth.php`);
    const after = sessCount();
    note(
      after - before === 1,
      'A-7.3 CONTROL — auth.php still starts a session (it renders a CSRF token)',
      `delta ${after - before}, expected +1`
    );
  }

  // ── A-7.4 — a failed inquiry-log write is silent ─────────────────────────
  //
  // Injected by replacing inquiries.jsonl with a DIRECTORY: file_put_contents
  // then fails even for root, which chmod would not achieve in this container.
  clearLimiter();
  {
    const saved = INQUIRIES + '.audit7-saved';
    let injected = false;
    try {
      if (fs.existsSync(INQUIRIES)) fs.renameSync(INQUIRIES, saved);
      try { fs.unlinkSync(FAIL_MARKER); } catch { /* not there */ }
      fs.mkdirSync(INQUIRIES);
      injected = true;

      const r = await post({ ...RFQ, email: 'jane@acme.com' });
      note(
        r.status === 200,
        'A-7.4 — the visitor still gets 200 when only the log write fails',
        `status ${r.status} — the mail went, so telling them to resend would be wrong`
      );
      note(
        fs.existsSync(FAIL_MARKER),
        'A-7.4 — the failure leaves a signal the dashboard can read',
        !fs.existsSync(FAIL_MARKER)
          ? 'no marker written — mail ok + log fails is the one outcome that is ' +
            'silent, and A-5.6 made this log the record the owner is told to trust'
          : ''
      );
    } finally {
      if (injected) { try { fs.rmdirSync(INQUIRIES); } catch { /* ignore */ } }
      if (fs.existsSync(saved)) fs.renameSync(saved, INQUIRIES);
      try { fs.unlinkSync(FAIL_MARKER); } catch { /* ignore */ }
    }
    // CONTROL: with the log writable again, no marker is produced.
    clearLimiter();
    const r2 = await post({ ...RFQ, email: 'jane@acme.com' });
    note(
      r2.status === 200 && !fs.existsSync(FAIL_MARKER),
      'A-7.4 CONTROL — a healthy log write leaves no marker behind',
      `status ${r2.status}, marker=${fs.existsSync(FAIL_MARKER)}`
    );
  }

  // ── A-7.5 — the owner-facing guide still says 30 backups ─────────────────
  {
    const doc = fs.readFileSync(path.join(ROOT, 'Editing-Your-Site-Content.md'), 'utf8');
    const keep = (() => {
      const m = fs.readFileSync(path.join(ROOT, 'admin', 'config.php'), 'utf8')
        .match(/define\('BACKUP_KEEP',\s*(\d+)\)/);
      return m ? m[1] : '?';
    })();
    note(
      !/\b30 most recent\b/.test(doc),
      'A-7.5 — the owner guide no longer says 30 backups',
      /\b30 most recent\b/.test(doc) ? `BACKUP_KEEP is ${keep}` : ''
    );
    note(
      new RegExp(`\\b${keep} most recent\\b`).test(doc),
      `A-7.5 — the owner guide names the live BACKUP_KEEP (${keep})`,
      ''
    );
  }

  // ── A-7.6 — a photo too large to resize ships silently at full size ──────
  //
  // Exercises the real function on a real over-ceiling image rather than
  // reading the source: build one just past IMG_MAX_PIXELS, call
  // image_downscale_in_place(), and require it to say WHY it declined.
  {
    const php = `
      require '${path.join(ROOT, 'admin', 'config.php').replace(/'/g, "\\'")}';
      $dir = sys_get_temp_dir() . '/ipc-audit7-img';
      @mkdir($dir);
      // Just over IMG_MAX_PIXELS (40 MP) and wider than IMG_MAX_WIDTH.
      $w = 8000; $h = 5200;                       // 41.6 MP
      $im = imagecreatetruecolor($w, $h);
      $p = $dir . '/huge.jpg';
      imagejpeg($im, $p, 40);
      imagedestroy($im);
      $reason = null;
      $ok = image_downscale_in_place($p, 'jpg', $reason);
      echo json_encode(['ok' => $ok, 'reason' => $reason, 'px' => $w * $h, 'cap' => IMG_MAX_PIXELS]);
      @unlink($p); @rmdir($dir);
    `;
    let out = '';
    try {
      out = execFileSync('php', ['-d', 'memory_limit=1024M', '-r', php], { encoding: 'utf8', timeout: 120000 });
    } catch (e) {
      out = String((e.stdout || '') + (e.stderr || ''));
    }
    let parsed = null;
    try { parsed = JSON.parse(out.trim().split('\n').pop()); } catch { /* stays null */ }
    note(
      parsed && parsed.ok === false,
      'A-7.6 — an over-ceiling image is still left at its original size',
      parsed ? `returned ${JSON.stringify(parsed)}` : `unparseable: ${out.slice(0, 200)}`
    );
    note(
      parsed && parsed.reason === 'too-many-pixels',
      'A-7.6 — and the caller is told WHY, so it can say something different',
      parsed
        ? `reason=${JSON.stringify(parsed.reason)} — indistinguishable from "already a sensible size", ` +
          'so the owner gets the same message for a 41 MP upload as for a correct one'
        : ''
    );
    const up = fs.readFileSync(path.join(ROOT, 'admin', 'upload-image.php'), 'utf8');
    note(
      /too-many-pixels/.test(up),
      'A-7.6 — upload-image.php branches on that reason',
      !/too-many-pixels/.test(up) ? 'the success message never mentions the ceiling' : ''
    );
  }

  clearLimiter();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\naudit7-lead ${pass}/${results.length}`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
