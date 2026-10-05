/**
 * §1aq (Keagan 2026-10-05): "Rick should be able to alter the ISO details and
 * data from within the Admin dashboard without issue."
 *
 * Drives the REAL Business Details form (settings.php, in a browser) through
 * every change the owner can make to the certification fields, and reads the
 * public pages after each one:
 *
 *   revision   "ISO 9001:2015" → every current ISO mention on / and /about
 *              carries :2015 (footer, About fact box, homepage band, trust
 *              ticker, certification card, features …) — the history line
 *              "Achieved ISO 9001 registration" does NOT
 *   standard   "AS9100D" → every current mention names AS9100D; history keeps ISO 9001
 *   cleared    "" → the box stays empty (not re-seeded to ISO 9001); footer,
 *              About fact box and homepage band claim nothing; Business Details
 *              lists the Page Content wording that still mentions ISO 9001
 *   plain      "ISO 9001" → the claim is back and no revision shows anywhere
 *   other      Other Certifications lines appear in the footer exactly as
 *              typed, and an emptied box removes them
 *   help       the ISO box hint says how to stop claiming ISO
 *
 * Own copy of the mirror (_harness/out/iso-site) on :8745.
 *
 *   npm run build && sh _harness/sync.sh && node _harness/isoedit.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { launch } = require('./browser');

const H = __dirname;
const SITE = path.join(H, 'out', 'iso-site');
const PORT = 8745;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const note = (ok, label, detail) => { results.push({ ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`); };
const info = () => JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'site-info.json'), 'utf8'));
const HISTORY = /Achieved [A-Z0-9 :.-]* registration/;

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) { console.log(`isoedit: port ${PORT} in use`); process.exit(2); }
  fs.rmSync(SITE, { recursive: true, force: true });
  execFileSync('cp', ['-r', path.join(H, 'site'), SITE]);
  for (const f of ['products-all.json', 'site-info.json', 'content.json']) fs.copyFileSync(path.join(H, 'pristine', f), path.join(SITE, 'data', f));
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(H, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + '/admin/auth.php');
    await page.fill('input[name=password]', 'audit-pass-123');
    await Promise.all([page.waitForNavigation(), page.press('input[name=password]', 'Enter')]);

    const setIso = async (iso, other) => {
      await page.goto(BASE + '/admin/settings.php');
      await page.fill('#cert_iso', iso);
      if (other !== undefined) await page.fill('#cert_other', other);
      await Promise.all([page.waitForNavigation(), page.click('form:has(input[name=orig_sig]) button[type=submit]')]);
      return page.content();
    };
    const pub = async () => {
      const p = await (await browser.newContext()).newPage();
      const out = {};
      for (const route of ['/', '/about']) {
        await p.goto(BASE + route + '?_=' + Date.now(), { waitUntil: 'networkidle' });
        out[route] = await p.evaluate(() => ({
          text: document.body.innerText,
          footer: (document.querySelector('footer') || {}).innerText || '',
          quality: (() => { const r = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Quality'); return r ? r.parentElement.innerText : null; })(),
          band: (() => { const e = [...document.querySelectorAll('p, div')].filter((d) => /has stocked, cut and shipped from/.test(d.textContent)).sort((a, b) => a.textContent.length - b.textContent.length)[0]; return e ? e.textContent.replace(/\s+/g, ' ') : null; })(),
        }));
      }
      await p.context().close();
      return out;
    };
    const tokens = (t) => (t.match(/ISO\s*9001(?::\s*\d{4})?|AS9100D/g) || []);
    const current = (t) => t.replace(HISTORY, '');   // drop the history line before counting claims

    // revision
    await setIso('ISO 9001:2015');
    let s = await pub();
    const all = s['/'].text + '\n' + s['/about'].text;
    const curTok = tokens(current(all));
    note(curTok.length >= 6 && curTok.every((x) => x === 'ISO 9001:2015'), 'revision: every current ISO mention on / and /about carries :2015',
      JSON.stringify(curTok));
    note(/ISO 9001:2015/.test(s['/'].footer) && /ISO 9001:2015 Registered/.test(s['/about'].quality || '') && /ISO 9001:2015 registered/.test(s['/'].band || ''),
      'revision: footer, About fact box and homepage band show it', JSON.stringify({ q: s['/about'].quality, b: s['/'].band }));
    const hist = (s['/about'].text.match(HISTORY) || [''])[0];
    note(/Achieved ISO 9001 registration/.test(hist), 'revision: the 1990s milestone keeps "Achieved ISO 9001 registration" (history)', hist);

    // standard
    await setIso('AS9100D');
    s = await pub();
    const t2 = tokens(current(s['/'].text + '\n' + s['/about'].text));
    note(t2.length >= 6 && t2.every((x) => x === 'AS9100D'), 'standard: every current mention names AS9100D', JSON.stringify(t2));
    note(/Achieved ISO 9001 registration/.test(s['/about'].text), 'standard: history still says ISO 9001');

    // cleared
    const html = await setIso('');
    note(info().certifications.iso === '', 'cleared: the stored ISO box is empty (saved, not refused)', JSON.stringify(info().certifications));
    await page.goto(BASE + '/admin/settings.php');
    note((await page.inputValue('#cert_iso')) === '', 'cleared: reopening Business Details shows the box still empty');
    s = await pub();
    note(!/ISO|AS9100/.test(s['/'].footer), 'cleared: the footer claims no ISO', s['/'].footer.slice(0, 200));
    note(s['/about'].quality === null, 'cleared: the About fact box has no Quality row', String(s['/about'].quality));
    note(/privately held and independent\./.test(s['/'].band || '') && !/registered/.test(s['/'].band || ''), 'cleared: the homepage band ends "privately held and independent."', s['/'].band);
    const box = await page.evaluate(() => (document.getElementById('iso-mentions') || {}).innerText || '');
    note(/Hero Trust Ticker/.test(box) && /Certifications/.test(box) && /Milestones/.test(box), 'cleared: Business Details lists the Page Content wording that still mentions ISO 9001', box.slice(0, 300));

    // plain
    await setIso('ISO 9001');
    s = await pub();
    const t4 = tokens(s['/'].text + '\n' + s['/about'].text);
    note(t4.length >= 7 && t4.every((x) => x === 'ISO 9001') && /ISO 9001/.test(s['/'].footer), 'plain: the claim is back everywhere, and no revision shows', JSON.stringify(t4));
    note(!(await page.content()).includes('id="iso-mentions"'), 'plain: the "still mentions ISO" list is gone');

    // other certifications
    await setIso('ISO 9001', 'AS9100D\nRoHS');
    s = await pub();
    note(/AS9100D/.test(s['/'].footer) && /RoHS/.test(s['/'].footer) && !/ROHS/.test(s['/'].footer), 'other: Other Certifications appear in the footer exactly as typed');
    await setIso('ISO 9001', '');
    s = await pub();
    note(!/AS9100D|RoHS/.test(s['/'].footer), 'other: an emptied Other Certifications box removes them');

    // help
    await page.goto(BASE + '/admin/settings.php');
    const hint = await page.evaluate(() => document.querySelector('#cert_iso').parentElement.innerText);
    note(/Empty this box/.test(hint), 'help: the ISO box hint says how to stop claiming ISO');
  } finally {
    await browser.close();
    srv.kill();
    fs.rmSync(SITE, { recursive: true, force: true });
  }
  const bad = results.filter((x) => !x.ok).length;
  console.log(`\nisoedit ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
