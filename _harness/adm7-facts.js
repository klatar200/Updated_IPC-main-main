/**
 * ADM-7 — a fact edited in Business Details must not stay live anywhere else.
 * audit-runs/audit-2026-09-27.md §3 (ADM-7), extended in §9.
 *
 * Five facts had one Business Details field each and were also typed
 * separately into JSX and into content.json: the hours, the founded year, the
 * city, the minimum order and the feet in stock. Changing a field moved some
 * copies and left the rest, so the homepage showed "$75" and "$50" at once.
 *
 * Own `php -S` on :8708 over the mirror, a real browser, 9 public pages, 16 checks.
 *   control  shipped site-info -> the shipped values ARE visible (proves
 *            the scan can see them at all)
 *   changed  every fact edited -> no page shows an old value in its text,
 *            image alt text, <title> or meta description, and each new value
 *            shows up somewhere on the site
 * Restores the mirror's site-info.json from pristine/ in a finally.
 *
 *   node _harness/adm7-facts.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const INFO = path.join(SITE, 'data', 'site-info.json');
const PRISTINE = path.join(__dirname, 'pristine', 'site-info.json');
const PORT = 8708;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGES = ['/', '/about', '/faq', '/contact', '/services', '/industries', '/privacy', '/products', '/datasheets'];

// old value -> pattern that finds it; new value -> what it becomes.
const FACTS = [
  { name: 'hours', set: (s) => { s.hours.text = 'Mon–Fri, 7am–4pm CT'; }, old: /8am–5pm/, now: /7am–4pm/ },
  { name: 'founded year', set: (s) => { s.company.foundedYear = '1975'; }, old: /(?<!\d)1974(?!\d)/, now: /(?<!\d)1975(?!\d)/ },
  { name: 'city', set: (s) => { s.address.city = 'Naperville'; }, old: /Bolingbrook/, now: /Naperville/ },
  { name: 'minimum order', set: (s) => { s.stats.minimumOrder = '$75'; }, old: /\$50(?![\d,]|\.\d)/, now: /\$75(?![\d,]|\.\d)/ },
  { name: 'feet in stock', set: (s) => { s.stats.feetInStock = '30 million'; }, old: /25\s*M\b|25M\+|25 million/, now: /30\s*M\b|30M\+|30 million/ },
];

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

async function scan(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const out = {};
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    out[p] = await page.evaluate(() => [
      document.body.innerText,
      [...document.querySelectorAll('img[alt]')].map((i) => i.alt).join('\n'),
      document.title,
      (document.querySelector('meta[name="description"]') || {}).content || '',
    ].join('\n'));
  }
  await ctx.close();
  return out;
}

const hits = (texts, re) => Object.entries(texts)
  .map(([p, t]) => {
    const m = t.split('\n').find((l) => re.test(l));
    return m ? `${p}: "${m.trim().slice(0, 90)}"` : null;
  }).filter(Boolean);

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`adm7-facts: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  fs.copyFileSync(PRISTINE, INFO);
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(__dirname, 'router.php')],
    { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));

    const before = await scan(browser);
    for (const f of FACTS) {
      note(hits(before, f.old).length > 0, `control: the shipped ${f.name} is visible somewhere (the scan can see it)`);
    }

    const info = JSON.parse(fs.readFileSync(PRISTINE, 'utf8'));
    for (const f of FACTS) f.set(info);
    fs.writeFileSync(INFO, JSON.stringify(info, null, 4));
    const after = await scan(browser);
    // A page that crashed shows none of the old values either — so "nothing
    // old left" is only evidence on a page that rendered.
    const crashed = Object.entries(after).filter(([, t]) => /Something went wrong/.test(t) || t.length < 400).map(([p]) => p);
    note(crashed.length === 0, `changed: all ${PAGES.length} pages rendered (no error screen)`, crashed.join(', '));
    for (const f of FACTS) {
      const left = hits(after, f.old);
      note(left.length === 0, `changed: no page still shows the old ${f.name}`,
        `${left.length} page(s); first ${left.slice(0, 3).join(' | ')}`);
      note(hits(after, f.now).length > 0, `changed: the new ${f.name} is shown`);
    }
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.copyFileSync(PRISTINE, INFO);
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nadm7-facts ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
