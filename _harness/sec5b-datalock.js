/**
 * SEC-5's lock extended to site-info.json and content.json (WHATS_LEFT §1an,
 * Keagan's decision 2026-10-02).
 *
 * settings.php and content.php carry orig_sig, so two of THEIR saves cannot
 * undo each other — but site-images.php writes one key of each file with no
 * signature, and a backup restore writes a whole file. Either could land inside
 * another save's load → save window and be overwritten by its stale copy.
 *
 * Same method as sec5-lostupdate.js — deterministic, no timing luck. A slow
 * writer is a real PHP process running the MIRROR's config.php the way
 * settings.php / content.php do on a POST (lock, load, wait 1.5 s, change,
 * save); the fast writer is the REAL site-images.php over HTTP, 0.3 s later.
 *
 *   site-info   slow slogan change vs a logo pick → both survive
 *   content     slow FAQ change vs an About-photo pick → both survive
 *   restore     slow writer vs save_site_info() of a backup issued second →
 *               the restore is what ends on disk
 *   no-deadlock a catalog save (edit.php POST, which READS content.json while
 *               holding the catalog lock) does not wait for a held content lock
 *   pages       content.php and settings.php take the lock BEFORE their read
 *
 * Own `php -S` on :8727 over the mirror; restores the mirror's data from
 * _harness/pristine/ in a finally.
 *
 *   node _harness/sec5b-datalock.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { adminHttp } = require('./adminhttp');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const DATA = path.join(SITE, 'data');
const CONFIG = path.join(SITE, 'admin', 'config.php');
const PRISTINE = path.join(__dirname, 'pristine');
const PORT = 8727;
const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

// The slow writer, as settings.php / content.php behave on a POST. It calls
// data_write_lock() only if it exists, so the unfixed tree runs it unlocked.
const slow = (which, sleepMs) => `
  $_SERVER['REQUEST_METHOD'] = 'POST';
  require ${JSON.stringify(CONFIG)};
  if (function_exists('data_write_lock')) data_write_lock(${JSON.stringify(which)});
  if (${JSON.stringify(which)} === 'site-info') {
    $d = load_site_info(); usleep(${sleepMs} * 1000);
    $d['company']['slogan'] = ($d['company']['slogan'] ?? '') . ' SEC5B-SLOW';
    echo save_site_info($d) ? 'saved' : 'failed';
  } else {
    $d = load_content(); usleep(${sleepMs} * 1000);
    $d['faq'][0]['question'] .= ' SEC5B-SLOW';
    echo save_content($d) ? 'saved' : 'failed';
  }
`;
const restore = () => `
  $_SERVER['REQUEST_METHOD'] = 'POST';
  require ${JSON.stringify(CONFIG)};
  echo save_site_info(json_decode(file_get_contents(${JSON.stringify(path.join(PRISTINE, 'site-info.json'))}), true)) ? 'saved' : 'failed';
`;
const holdContent = (ms) => `
  require ${JSON.stringify(CONFIG)};
  if (function_exists('data_write_lock')) data_write_lock('content');
  echo 'held'; usleep(${ms} * 1000);
`;
const run = (code) => new Promise((resolve) => {
  const p = spawn('php', ['-r', code]);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', () => resolve(out.trim()));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const readJ = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const reset = () => { for (const f of ['content.json', 'site-info.json', 'products-all.json']) fs.copyFileSync(path.join(PRISTINE, f), path.join(DATA, f)); };

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', `http://127.0.0.1:${PORT}/`]).status === 0) {
    console.log(`sec5b-datalock: port ${PORT} is already in use`); process.exit(2);
  }
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  const a = adminHttp(PORT);
  try {
    reset();
    await wait(700);
    if (!(await a.login('audit-pass-123'))) throw new Error('sign-in failed');
    const g0 = await a.req('GET', '/admin/site-images.php');   // warm the page before the timed arms
    const csrf0 = a.csrfOf(g0.body);

    // ── site-info ──
    reset();
    let s = run(slow('site-info', 1500));
    await wait(300);
    let f = a.post('/admin/site-images.php', [['csrf_token', csrf0], ['slot', 'logo'], ['action', 'choose'], ['choice', 'images/site/IPC-Building.jpg']]);
    let [rs, rf] = await Promise.all([s, f]);
    let info = readJ('site-info.json');
    note(rs === 'saved' && rf.status === 302, 'site-info: both writers report success', `slow=${rs} page=${rf.status}`);
    note(/SEC5B-SLOW/.test(info.company.slogan), 'site-info: the slow writer\'s slogan change is on disk');
    note(info.theme.logoUrl === '/images/site/IPC-Building.jpg', 'site-info: the logo pick survives the slow save — no lost update',
      `logoUrl is ${JSON.stringify(info.theme.logoUrl)}: the slow writer saved a copy it loaded before the pick`);

    // ── content ──
    reset();
    s = run(slow('content', 1500));
    await wait(300);
    f = a.post('/admin/site-images.php', [['csrf_token', csrf0], ['slot', 'aboutPhoto'], ['action', 'choose'], ['choice', 'images/site/staff.jpg']]);
    [rs, rf] = await Promise.all([s, f]);
    const c = readJ('content.json');
    note(rs === 'saved' && rf.status === 302, 'content: both writers report success', `slow=${rs} page=${rf.status}`);
    note(/SEC5B-SLOW/.test(c.faq[0].question) && c.copy.siteImages.aboutPhoto === 'images/site/staff.jpg',
      'content: the FAQ change and the About-photo pick both survive', `faq0 ${JSON.stringify(c.faq[0].question.slice(-12))}, about ${JSON.stringify(c.copy.siteImages.aboutPhoto)}`);

    // ── restore ──
    reset();
    s = run(slow('site-info', 1500));
    await wait(300);
    const r = run(restore());
    const [rw, rr] = await Promise.all([s, r]);
    note(rw === 'saved' && rr === 'saved' && !/SEC5B-SLOW/.test(readJ('site-info.json').company.slogan),
      'restore: a backup restore issued second is what ends up on disk', `writer=${rw} restore=${rr}`);

    // ── no deadlock: a catalog save reads content.json under the catalog lock ──
    reset();
    const h = run(holdContent(2500));
    await wait(300);
    const eg = await a.req('GET', '/admin/edit.php?sku=IP38FE');
    const t0 = Date.now();
    const ep = await a.post('/admin/edit.php?sku=IP38FE', a.formFields(eg.body, /orig_sig/));
    const took = Date.now() - t0;
    await h;
    note(ep.status === 302 && took < 1500, `no-deadlock: an edit.php save does not wait on a held content lock (${took} ms)`, `status ${ep.status}`);

    // ── the pages lock before they read ──
    for (const [file, which, load] of [['content.php', 'content', 'load_content()'], ['settings.php', 'site-info', 'load_site_info()']]) {
      const src = fs.readFileSync(path.join(ROOT, 'admin', file), 'utf8');
      const li = src.indexOf(`data_write_lock('${which}')`);
      const ri = src.indexOf(load);
      note(li > -1 && li < ri, `pages: ${file} takes the ${which} lock before ${load}`);
    }
  } finally {
    srv.kill();
    reset();
  }
  const bad = results.filter((x) => !x.ok).length;
  console.log(`\nsec5b-datalock ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
