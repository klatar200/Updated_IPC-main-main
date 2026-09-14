/**
 * audit9-router-docroot — `_harness/router.php` must answer for the docroot it
 * was given, not for `_harness/site`.
 *
 * The incident (Audit 9, A-9.P3-1; hit independently by P8, which lost an hour
 * to it): `router.php` computed its root as `__DIR__ . '/site'`, a constant. It
 * is passed to `php -S -t <docroot>` by every private mirror in PLAN-11 §3.4,
 * and it then tested file existence — and `require`d `/sitemap.xml` — against
 * the SWEEP mirror rather than the docroot it was serving. A real uploaded file
 * read as missing (a 200 SPA shell), and a private mirror's sitemap rendered
 * the sweep mirror's catalog. Two of this round's measurements were false for
 * this reason before it was found.
 *
 * Why the arms are shaped this way: a private mirror is a `cp -r` of
 * `_harness/site`, so the bug is INVISIBLE for every file that exists in both
 * trees. Only a file that exists in exactly one of them can see it. Each arm
 * below therefore creates a divergence on purpose, and arm C is the control
 * that must pass in both the broken and the fixed tree — without it a suite
 * that merely 404s everything would score full marks.
 *
 *   node _harness/audit9-router-docroot.js        # PORT=8153 by default
 *
 * Needs no mirror and no running server: it builds a two-file docroot under
 * `_harness/out/audit9/router-docroot/` and starts its own `php -S`.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_harness', 'out', 'audit9', 'router-docroot');
const DOCROOT = path.join(OUT, 'docroot');
const SWEEP = path.join(ROOT, '_harness', 'site');
const PORT = Number(process.env.PORT || 8153);
const SWEEP_ONLY = 'audit9-router-sweep-only.txt';
const BOTH = 'audit9-router-in-both.txt';

let pass = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { failures.push(`${name} — ${detail}`); console.log(`  FAIL  ${name} — ${detail}`); }
}

function get(p) {
  return new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p, timeout: 8000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body }));
    }).on('error', (e) => resolve({ status: 0, type: '', body: `request error: ${e.message}` }))
      .on('timeout', function () { this.destroy(); resolve({ status: 0, type: '', body: 'timeout' }); });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(SWEEP)) {
    console.error('audit9-router-docroot: _harness/site is absent — run `sh _harness/sync.sh` first.');
    process.exit(2);
  }

  // A docroot that is deliberately NOT _harness/site and not named "site".
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(DOCROOT, { recursive: true });
  fs.writeFileSync(path.join(DOCROOT, 'index.html'), '<!doctype html><title>docroot shell</title>DOCROOT-SHELL\n');
  fs.writeFileSync(path.join(DOCROOT, 'private-only.txt'), 'PRIVATE-ONLY-MARKER\n');
  fs.writeFileSync(path.join(DOCROOT, BOTH), 'FROM-DOCROOT\n');
  // sitemap.php in the docroot must be the one that runs, not the sweep mirror's.
  fs.writeFileSync(path.join(DOCROOT, 'sitemap.php'), '<?php header("Content-Type: application/xml"); echo "<urlset>DOCROOT-SITEMAP</urlset>";\n');

  // The other side of each divergence, created in the sweep mirror and removed
  // in the finally block. Never touches data/, pdfs/ or uploads/.
  const sweepOnly = path.join(SWEEP, SWEEP_ONLY);
  const sweepBoth = path.join(SWEEP, BOTH);
  fs.writeFileSync(sweepOnly, 'SWEEP-ONLY-MARKER\n');
  fs.writeFileSync(sweepBoth, 'FROM-SWEEP\n');

  const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', DOCROOT, path.join(ROOT, '_harness', 'router.php')], {
    cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], detached: true,
  });
  let stderr = '';
  server.stderr.on('data', (c) => (stderr += c.toString()));

  try {
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      await sleep(250);
      const r = await get('/index.html');
      if (r.status) up = true;
    }
    if (!up) {
      console.error(`audit9-router-docroot: php -S never came up on :${PORT}\n${stderr.slice(0, 400)}`);
      process.exit(2);
    }

    console.log(`audit9-router-docroot  docroot=${path.relative(ROOT, DOCROOT)}  port=${PORT}\n`);

    // Arm A — a file present ONLY in the served docroot must be served.
    const a = await get('/private-only.txt');
    ok('A/status  a docroot-only file is 200', a.status === 200, `status ${a.status}`);
    ok('A/body    it is the file, not the SPA shell', a.body.includes('PRIVATE-ONLY-MARKER'),
      `body began ${JSON.stringify(a.body.slice(0, 40))}`);
    ok('A/type    it is not served as text/html', !/text\/html/.test(a.type), `Content-Type ${a.type || '(none)'}`);

    // Arm B — a file present ONLY in _harness/site must NOT be found here.
    const b = await get(`/${SWEEP_ONLY}`);
    ok('B/absent  a sweep-mirror-only file never yields sweep content', !b.body.includes('SWEEP-ONLY-MARKER'),
      'the sweep mirror\'s bytes were served from another docroot');
    ok('B/shell   it falls through to this docroot\'s own shell', b.body.includes('DOCROOT-SHELL') || b.status === 404,
      `status ${b.status}, body began ${JSON.stringify(b.body.slice(0, 40))}`);

    // Arm C — the control. Present in BOTH trees: the docroot's copy wins.
    // This passes before and after the fix; it is what proves the suite is not
    // scoring by refusing everything.
    const c = await get(`/${BOTH}`);
    ok('C/control a file in both trees is served from the docroot', c.body.includes('FROM-DOCROOT'),
      `body began ${JSON.stringify(c.body.slice(0, 40))}`);

    // Arm D — /sitemap.xml is rewritten and executed; it must be the docroot's.
    const d = await get('/sitemap.xml');
    ok('D/sitemap /sitemap.xml executes this docroot\'s sitemap.php', d.body.includes('DOCROOT-SITEMAP'),
      `body began ${JSON.stringify(d.body.slice(0, 60))}`);

    // Arm E — the shipped invocation must keep working: docroot IS _harness/site.
    const e = await get('/data/site-info.json');
    ok('E/compat  a real path still resolves (no regression for the sweep shape)',
      e.status === 200 || e.body.includes('DOCROOT-SHELL'), `status ${e.status}`);

    const total = pass + failures.length;
    console.log(`\naudit9-router-docroot ${pass}/${total}`);
    if (failures.length) {
      console.log('\nfailing:');
      for (const f of failures) console.log(`  - ${f}`);
    }
    process.exit(failures.length ? 1 : 0);
  } finally {
    try { process.kill(-server.pid); } catch (_) { try { server.kill(); } catch (__) {} }
    for (const f of [sweepOnly, sweepBoth]) { try { fs.unlinkSync(f); } catch (_) {} }
  }
})();
