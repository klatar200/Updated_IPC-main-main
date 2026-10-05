/**
 * G1 (admin audit 2026-10-05, WHATS_LEFT §1ap) — the Catalog & Brochure PDFs
 * page (admin/marketing-pdfs.php).
 *
 * Business Details → Catalog PDF URL and each service's Brochure PDF URL only
 * pointed at a file; nothing in the dashboard could put one on the server.
 * The page uploads into pdfs/marketing/ and points the footer catalog link or
 * a Services brochure at it. What it must hold:
 *
 *   auth     signed out → sign-in page; a POST without the CSRF token → 403, nothing stored
 *   upload   a PDF chosen for the catalog lands under a safe name made from its
 *            own name, and the footer link on the PUBLIC site points at it
 *   never-overwrite  the same name again is saved as -2; the first file is untouched
 *   refuse   a non-PDF named .pdf is refused, nothing stored; "x.php.pdf" is stored without the dots
 *   use/stop an existing PDF becomes a service's brochure (default link text);
 *            "Stop using" takes the catalog link off the site, the file stays
 *   damaged  with site-info.json damaged, a catalog upload is refused BEFORE the file is stored
 *   audit    each change is logged as marketing-pdf
 *   phone    the page fits 390 px
 *   links    Business Details' Catalog PDF box links to the page
 *
 * Own copy of the mirror (_harness/out/mp-site) and its own php -S on :8744.
 *
 *   npm run build && sh _harness/sync.sh && node _harness/marketingpdfs.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { adminHttp } = require('./adminhttp');
const { launch } = require('./browser');

const H = __dirname;
const SITE = path.join(H, 'out', 'mp-site');
const PORT = 8744;
const BASE = `http://127.0.0.1:${PORT}`;
const MK = path.join(SITE, 'pdfs', 'marketing');
const results = [];
const note = (ok, label, detail) => { results.push({ ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`); };
const info = () => JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'site-info.json'), 'utf8'));
const content = () => JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'content.json'), 'utf8'));
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const pdf = (tag) => Buffer.from(`%PDF-1.4\n% ${tag}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
const lastLog = () => JSON.parse(fs.readFileSync(path.join(SITE, 'admin', 'admin-log.jsonl'), 'utf8').trim().split('\n').pop());
function multipart(fields, files) {
  const b = '----mp' + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [k, v] of fields) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const [k, name, buf, type] of files) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`), buf, Buffer.from('\r\n'));
  parts.push(Buffer.from(`--${b}--\r\n`));
  return { body: Buffer.concat(parts), type: 'multipart/form-data; boundary=' + b };
}
async function up(a, name, buf, target, csrf) {
  const g = await a.req('GET', '/admin/marketing-pdfs.php');
  const m = multipart([['csrf_token', csrf === undefined ? a.csrfOf(g.body) : csrf], ['action', 'upload'], ['target', target]], [['pdf_file', name, buf, 'application/pdf']]);
  return a.req('POST', '/admin/marketing-pdfs.php', m.body, { 'Content-Type': m.type, 'Content-Length': m.body.length });
}
async function act(a, pairs) {
  const g = await a.req('GET', '/admin/marketing-pdfs.php');
  return a.post('/admin/marketing-pdfs.php', [['csrf_token', a.csrfOf(g.body)], ...pairs]);
}
const footerCatalog = async (browser) => {
  const p = await (await browser.newContext()).newPage();
  await p.goto(BASE + '/?_=' + Date.now(), { waitUntil: 'networkidle' });
  const href = await p.evaluate(() => { const a = [...document.querySelectorAll('footer a')].find((x) => /catalog \(PDF\)/i.test(x.textContent)); return a ? a.getAttribute('href') : null; });
  await p.context().close();
  return href;
};

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) { console.log(`marketingpdfs: port ${PORT} in use`); process.exit(2); }
  fs.rmSync(SITE, { recursive: true, force: true });
  execFileSync('cp', ['-r', path.join(H, 'site'), SITE]);
  for (const f of ['products-all.json', 'site-info.json', 'content.json']) fs.copyFileSync(path.join(H, 'pristine', f), path.join(SITE, 'data', f));
  const before = new Set(fs.readdirSync(MK));
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(H, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const browser = await launch();
  const a = adminHttp(PORT);
  try {
    // auth
    const anon = await adminHttp(PORT).req('GET', '/admin/marketing-pdfs.php');
    note(anon.status === 302 && /auth\.php/.test(anon.headers.location || ''), 'auth: signed out, the page sends you to sign in', `${anon.status} ${anon.headers.location}`);
    await a.login('audit-pass-123');
    const forged = await up(a, 'forged.pdf', pdf('F'), 'catalog', 'not-the-token');
    note(forged.status === 403 && !fs.existsSync(path.join(MK, 'forged.pdf')) && info().catalogPdfUrl === '', 'auth: a POST without the right CSRF token is refused and stores nothing', `status ${forged.status}`);

    // upload for the catalog
    const r1 = await up(a, 'IPC Catalog 2026!.pdf', pdf('CAT-ONE'), 'catalog');
    const f1 = path.join(MK, 'IPC-Catalog-2026.pdf');
    note(r1.status === 302 && fs.existsSync(f1) && info().catalogPdfUrl === '/pdfs/marketing/IPC-Catalog-2026.pdf',
      'upload: a PDF chosen for the catalog is stored under a safe name and becomes the Catalog PDF URL', `status ${r1.status}, url ${info().catalogPdfUrl}`);
    const l1 = lastLog();
    note(l1.action === 'marketing-pdf' && /IPC-Catalog-2026\.pdf/.test(l1.detail), 'audit: the upload is logged as marketing-pdf', JSON.stringify(l1));
    note(await footerCatalog(browser) === '/pdfs/marketing/IPC-Catalog-2026.pdf', 'upload: the public footer\'s "Full product catalog (PDF)" link points at it');
    const served = await a.req('GET', '/pdfs/marketing/IPC-Catalog-2026.pdf');
    note(served.status === 200 && /CAT-ONE/.test(served.body), 'upload: the file is served at that address');

    // never overwrite
    const h1 = md5(f1);
    await up(a, 'IPC Catalog 2026!.pdf', pdf('CAT-TWO'), 'none');
    note(md5(f1) === h1 && fs.existsSync(path.join(MK, 'IPC-Catalog-2026-2.pdf')), 'never-overwrite: the same name again is saved as -2 and the first file is untouched');

    // refuse
    const png = execFileSync('php', ['-r', '$i=imagecreatetruecolor(4,4);ob_start();imagepng($i);echo ob_get_clean();']);
    const n0 = fs.readdirSync(MK).length;
    const r2 = await up(a, 'fake.pdf', png, 'none');
    note(r2.status === 200 && /Only PDF files are accepted/.test(r2.body) && fs.readdirSync(MK).length === n0, 'refuse: a picture named .pdf is refused and nothing is stored');
    await up(a, 'x.php.pdf', pdf('DOTS'), 'none');
    note(fs.existsSync(path.join(MK, 'x-php.pdf')) && !fs.readdirSync(MK).some((n) => /\.php/i.test(n)), 'refuse: "x.php.pdf" is stored as x-php.pdf — no dots from the visitor\'s name');

    // use / stop
    await act(a, [['action', 'use'], ['file', 'IPC-Catalog-2026-2.pdf'], ['target', 'service:0']]);
    const s0 = content().services[0];
    note(s0.brochure && s0.brochure.url === '/pdfs/marketing/IPC-Catalog-2026-2.pdf' && s0.brochure.label === 'Download brochure',
      'use: an existing PDF becomes a service brochure, with the default link text', JSON.stringify(s0.brochure));
    const s2label = content().services[2].brochure.label;
    await act(a, [['action', 'use'], ['file', 'Tubing-Kits.pdf'], ['target', 'service:2']]);
    note(content().services[2].brochure.label === s2label, 'use: re-pointing a brochure keeps its link text');
    await act(a, [['action', 'stop'], ['target', 'catalog']]);
    note(info().catalogPdfUrl === '' && fs.existsSync(f1) && await footerCatalog(browser) === null, 'stop: "Stop using" takes the catalog link off the site and keeps the file');

    // damaged
    const si = path.join(SITE, 'data', 'site-info.json');
    const good = fs.readFileSync(si, 'utf8');
    fs.writeFileSync(si, good.replace(/\}\s*$/, ',}'));
    const n1 = fs.readdirSync(MK).length;
    const r3 = await up(a, 'damaged-test.pdf', pdf('D'), 'catalog');
    note(/damaged/.test(r3.body) && fs.readdirSync(MK).length === n1, 'damaged: with site-info.json damaged, a catalog upload is refused before the file is stored');
    fs.writeFileSync(si, good);

    // phone + links
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const ph = await ctx.newPage();
    await ph.goto(BASE + '/admin/auth.php'); await ph.fill('input[name=password]', 'audit-pass-123');
    await Promise.all([ph.waitForNavigation(), ph.press('input[name=password]', 'Enter')]);
    await ph.goto(BASE + '/admin/marketing-pdfs.php', { waitUntil: 'networkidle' });
    const w = await ph.evaluate(() => document.documentElement.scrollWidth);
    note(w <= 390, 'phone: the page fits a 390 px screen', `scrollWidth ${w}`);
    await ctx.close();
    const set = await a.req('GET', '/admin/settings.php');
    note(/id="catalogPdfUrl"[\s\S]{0,400}href="marketing-pdfs\.php"/.test(set.body), 'links: Business Details\' Catalog PDF box links to the page');
  } finally {
    await browser.close();
    srv.kill();
    fs.rmSync(SITE, { recursive: true, force: true });
  }
  const bad = results.filter((x) => !x.ok).length;
  console.log(`\nmarketingpdfs ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
