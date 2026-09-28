/**
 * ADM-9b — "Other Certifications" is published site-wide the moment it is
 * saved, so it must appear as typed and the owner must be told.
 * audit-runs/audit-2026-09-27.md §7 (ADM-9b), verified in §9.
 *
 * The footer upper-cased the whole certification line, so "RoHS" went out as
 * "ROHS", and settings.php/help.php said nothing (help.php said the box was
 * "not yet shown on the site").
 *
 * Own `php -S` on :8709 over the mirror, 5 checks:
 *   footer    certifications.other = ["RoHS"] -> the footer shows "RoHS", not
 *             "ROHS"; control: the rest of the line keeps its styling
 *   settings  the cert_other field carries a hint saying it is public
 *   help      help.php no longer says the box is not shown
 * Restores the mirror's site-info.json from pristine/ in a finally.
 *
 *   node _harness/adm9b-othercert.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const INFO = path.join(SITE, 'data', 'site-info.json');
const PRISTINE = path.join(__dirname, 'pristine', 'site-info.json');
const PORT = 8709;
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`adm9b-othercert: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  const info = JSON.parse(fs.readFileSync(PRISTINE, 'utf8'));
  info.certifications.other = ['RoHS'];
  fs.writeFileSync(INFO, JSON.stringify(info, null, 4));
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(__dirname, 'router.php')],
    { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));
    const page = await (await browser.newContext()).newPage();
    await page.goto(BASE + '/about', { waitUntil: 'networkidle' });
    const footer = await page.locator('footer').innerText();
    const line = footer.split('\n').find((l) => /ESTABLISHED/i.test(l)) || '';
    note(/\bRoHS\b/.test(line), 'footer: "RoHS" is shown as typed', `line reads ${JSON.stringify(line)}`);
    note(!/\bROHS\b/.test(line), 'footer: and not as "ROHS"', `line reads ${JSON.stringify(line)}`);
    note(/ESTABLISHED \d{4}/.test(line), 'footer: control — "ESTABLISHED <year>" keeps its capitals', `line reads ${JSON.stringify(line)}`);

    const settings = fs.readFileSync(path.join(ROOT, 'admin', 'settings.php'), 'utf8');
    const field = (/<label for="cert_other">[\s\S]*?<\/div>\s*<\/div>/.exec(settings) || [''])[0];
    const hint = ((/<div class="hint">([\s\S]*?)<\/div>/.exec(field) || [, ''])[1]).replace(/<[^>]*>/g, '');
    note(/every page|footer/i.test(hint),
      'settings: the Other Certifications field says it is published on the site');
    const help = fs.readFileSync(path.join(ROOT, 'admin', 'help.php'), 'utf8');
    note(!/Other certifications[\s\S]{0,80}not yet shown/i.test(help), 'help: no longer says the box is not shown on the site');
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.copyFileSync(PRISTINE, INFO);
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nadm9b-othercert ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
