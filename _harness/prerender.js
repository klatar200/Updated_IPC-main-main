/**
 * A-5.10 / WHATS_LEFT §1ar — public/index.php serves every route's head and a
 * plain-HTML body from the live data, and agrees with the browser.
 *
 * The browser (PageMeta in src/App.jsx) is the source of truth; index.php is a
 * port of it. This suite is the drift guard between the two:
 *
 *   parity    for every route, every product, alias and unknown URLs, the RAW
 *             HTML's title, description, canonical, robots, every og:* and
 *             twitter:card (what an
 *             unfurler or a non-rendering crawler reads) equal what the
 *             browser's DOM holds after the app has rendered
 *   mutated   the same parity after Business Details and Page Content edits
 *             (ISO revision, phone, city, minimum order, company name, an SEO
 *             row deleted, every SEO row deleted, the seo key absent, a
 *             header title changed), with a blank company name and a
 *             whitespace-only phone (invariant 4), and with a hostile product name
 *   body      without JavaScript: the product page names the part, its SKU,
 *             description and data sheet; /products links every product;
 *             every route has an h1 and the site nav
 *   hidden    with JavaScript: the plain-HTML copy is gone after render, is
 *             display:none while the bundle is still on its way, and shows
 *             (with its contact block) once the bundle has failed to load
 *             (A12-L11-W3-G1-1 — that used to be a blank white page)
 *   boot      index.php hands the browser what it read (#ipc-boot, AUDIT-12
 *             decisions 9, 10, 11): with the data file's request failing in
 *             the browser, the page still shows Rick's phone number, leaves
 *             out a Company Claim he emptied, and keeps a product page and
 *             its head instead of "Catalog Unavailable"
 *   og size   a product photo's og:image:width/height is its real size, and
 *             no size is declared for one that cannot be measured (decision 24)
 *   fallback  a damaged content.json or site-info.json → index.html byte for
 *             byte; a damaged catalog → the "pending" product head the
 *             browser also shows (PUB-2); no PHP warning text in any response
 *   headers   text/html, no-store, 200 (unknown routes too — A5)
 *
 * Own copy of the mirror (_harness/out/prerender-site) on :8747.
 *
 *   npm run build && sh _harness/sync.sh && node _harness/prerender.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { launch } = require('./browser');

const H = __dirname;
const SITE = path.join(H, 'out', 'prerender-site');
const PORT = Number(process.env.PRERENDER_PORT) || 8747;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(SITE, 'data');
const results = [];
const note = (ok, label, detail) => {
  results.push({ ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(H, 'pristine', f), 'utf8'));
const writeData = (f, v) => fs.writeFileSync(path.join(DATA, f), typeof v === 'string' ? v : JSON.stringify(v, null, 2));
const pristine = () => { for (const f of ['products-all.json', 'site-info.json', 'content.json']) fs.copyFileSync(path.join(H, 'pristine', f), path.join(DATA, f)); };

const get = (url) => new Promise((resolve, reject) => {
  http.get(BASE + url, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  }).on('error', reject);
});

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** The head as a non-rendering client reads it: the first match of each tag in the raw HTML. */
function rawHead(html) {
  const head = html.slice(0, html.indexOf('</head>'));
  const attr = (tag, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag); return m ? decode(m[1]) : null; };
  const tags = head.match(/<(meta|link)\b[^>]*>/g) || [];
  const meta = (a, k) => { const t = tags.find((x) => x.startsWith('<meta') && attr(x, a) === k); return t ? attr(t, 'content') : null; };
  const canon = tags.find((x) => x.startsWith('<link') && attr(x, 'rel') === 'canonical');
  const t = /<title>([\s\S]*?)<\/title>/.exec(head);
  return {
    title: t ? decode(t[1]) : null,
    description: meta('name', 'description'),
    robots: meta('name', 'robots'),
    canonical: canon ? attr(canon, 'href') : null,
    ogUrl: meta('property', 'og:url'),
    ogTitle: meta('property', 'og:title'),
    ogDescription: meta('property', 'og:description'),
    ogImage: meta('property', 'og:image'),
    ogImageW: meta('property', 'og:image:width'),
    ogImageH: meta('property', 'og:image:height'),
    // Every unfurler-visible tag index.html declares, not ten of them: a fix
    // to og:image:alt in PageMeta alone passed while LinkedIn/Slack kept the
    // old text (AUDIT-12 A12-L13-W5-G1-1).
    ogImageAlt: meta('property', 'og:image:alt'),
    ogType: meta('property', 'og:type'),
    twitterCard: meta('name', 'twitter:card'),
  };
}

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) { console.log(`prerender: port ${PORT} in use`); process.exit(2); }
  fs.rmSync(SITE, { recursive: true, force: true });
  execFileSync('cp', ['-r', path.join(H, 'site'), SITE]);
  pristine();
  // -c php-mail.ini: display_errors=On, as on the :8123 sweep server. Without
  // it the CLI ini's display_errors=Off hid every warning and the "no PHP
  // warning text" arm below could not fail (AUDIT-12 A12-L13-24-2).
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(H, 'php-mail.ini'), path.join(H, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const browser = await launch();
  const jsCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await jsCtx.newPage();
  const noJs = await (await browser.newContext({ javaScriptEnabled: false })).newPage();

  /** The head after the app has rendered — what PageMeta decided. */
  const clientHead = async (url) => {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    return page.evaluate(() => {
      const m = (sel) => { const e = document.querySelector(sel); return e ? e.getAttribute('content') : null; };
      const c = document.querySelector('link[rel="canonical"]');
      return {
        title: document.title,
        description: m('meta[name="description"]'),
        robots: m('meta[name="robots"]'),
        canonical: c ? c.getAttribute('href') : null,
        ogUrl: m('meta[property="og:url"]'),
        ogTitle: m('meta[property="og:title"]'),
        ogDescription: m('meta[property="og:description"]'),
        ogImage: m('meta[property="og:image"]'),
        ogImageW: m('meta[property="og:image:width"]'),
        ogImageH: m('meta[property="og:image:height"]'),
        ogImageAlt: m('meta[property="og:image:alt"]'),
        ogType: m('meta[property="og:type"]'),
        twitterCard: m('meta[name="twitter:card"]'),
      };
    });
  };
  const warned = [];
  const parity = async (urls, label) => {
    const bad = [];
    for (const u of urls) {
      const r = await get(u);
      if (/<b>(Warning|Notice|Deprecated|Fatal error)<\/b>|PHP (Warning|Notice|Deprecated)/.test(r.body)) warned.push(u);
      const s = rawHead(r.body);
      const c = await clientHead(u);
      const diff = Object.keys(c).filter((k) => s[k] !== c[k]);
      if (diff.length) bad.push(`${u}: ${diff.map((k) => `${k} server=${JSON.stringify(s[k])} client=${JSON.stringify(c[k])}`).join('; ')}`);
    }
    note(bad.length === 0, `${label} (${urls.length} URLs)`, bad.slice(0, 4).join('\n         '));
  };

  const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];
  const catalog = readJson('products-all.json');
  const rows = Array.isArray(catalog) ? catalog : catalog.products;
  const productUrls = rows.map((p) => `/products?productId=${encodeURIComponent(p.id)}`);
  const ODD = ['/products?productId=cc', '/products?productId=IP12GA%20-%20IP1274', '/products?productId=zzz-nope',
    '/nope', '/products/CC/extra', '/contact?productId=zzz', '/index.php', '/about?productId=CC', '/products/?family=Tubing'];

  try {
    // ── parity, shipped data ───────────────────────────────────────────────
    const homeRaw = await get('/');
    note(/<link rel="canonical" href="https:\/\/www\.insulationproducts\.com\/"/.test(homeRaw.body),
      'the homepage is served by index.php (raw HTML carries its canonical)', homeRaw.body.slice(0, 200));
    await parity(ROUTES, 'parity: the ten routes, shipped data');
    await parity(productUrls, 'parity: every product, shipped data');
    await parity(ODD, 'parity: alias, unknown-product, unknown-route and stray-param URLs');
    const cc = rawHead((await get('/products?productId=CC')).body);
    note(cc.ogImage === 'https://www.insulationproducts.com/images/products/CC.jpg' && /Conduit Coupling/.test(cc.ogTitle || '')
      && /Conduit Coupling/.test(cc.ogImageAlt || ''),
      'a product link previews as that product (its title and photo, not the homepage card)', JSON.stringify(cc));
    // AUDIT-12 decision 24 (A12-L15-10-1) — the declared size is the photo's
    // real size, for every product with a photo (it was 400x300 for all).
    {
      const wrong = [];
      for (const p of rows) {
        const h = rawHead((await get(`/products?productId=${encodeURIComponent(p.id)}`)).body);
        if (!/\/images\/products\//.test(h.ogImage || '')) continue;
        const nat = await page.evaluate(async (src) => {
          const i = new Image(); i.src = src; await i.decode().catch(() => {}); return [i.naturalWidth, i.naturalHeight];
        }, h.ogImage.replace('https://www.insulationproducts.com', BASE));
        if (h.ogImageW !== String(nat[0]) || h.ogImageH !== String(nat[1])) wrong.push(`${p.id}: declared ${h.ogImageW}x${h.ogImageH}, file ${nat.join('x')}`);
      }
      note(wrong.length === 0, 'og:image:width/height are each product photo\'s real size (decision 24)', wrong.slice(0, 4).join('; '));
    }

    // ── headers ────────────────────────────────────────────────────────────
    const hd = [];
    for (const u of ['/', '/about', '/products?productId=CC', '/nope']) {
      const r = await get(u);
      if (r.status !== 200 || !/^text\/html/.test(r.headers['content-type'] || '') || !/no-store/.test(r.headers['cache-control'] || '')) {
        hd.push(`${u}: ${r.status} ${r.headers['content-type']} ${r.headers['cache-control']}`);
      }
    }
    note(hd.length === 0, 'headers: 200, text/html, no-store — unknown routes stay 200 (A5)', hd.join('; '));

    // ── body without JavaScript ────────────────────────────────────────────
    await noJs.goto(BASE + '/products?productId=CC');
    const ccBody = await noJs.innerText('body');
    const ccPdf = await noJs.$('#ipc-prerender a[href="/pdfs/CC.pdf"]');
    note(/Nonmetallic Liquid-tight Conduit Coupling/.test(await noJs.innerText('#ipc-prerender h1').catch(() => '')) && /\bCC\b/.test(ccBody)
      && /UV rated material/.test(ccBody) && !!ccPdf,
    'no JS: the product page names the part, its SKU, its description and its data sheet', ccBody.slice(0, 300));
    await noJs.goto(BASE + '/products');
    const links = await noJs.$$eval('#ipc-prerender a[href^="/products?productId="]', (a) => a.length);
    note(links === rows.length, `no JS: /products links every product (${links}/${rows.length})`);
    const noH1 = [];
    for (const r of ROUTES) {
      await noJs.goto(BASE + r);
      const h1 = await noJs.$eval('#ipc-prerender h1', (e) => e.textContent.trim()).catch(() => '');
      const nav = await noJs.$$eval('#ipc-prerender nav a', (a) => a.map((x) => x.getAttribute('href')));
      if (!h1 || ROUTES.some((x) => !nav.includes(x))) noH1.push(`${r}: h1=${JSON.stringify(h1)} nav=${nav.length}`);
    }
    note(noH1.length === 0, 'no JS: every route has an h1 and links to all ten routes', noH1.join('; '));
    {
      const inf = readJson('site-info.json');
      inf.contact.phone = '630.555.0199';
      writeData('site-info.json', inf);
      await noJs.goto(BASE + '/contact');
      const t = await noJs.innerText('body');
      const ns = ((await get('/contact')).body.match(/<noscript>([\s\S]*?)<\/noscript>/) || [, ''])[1];
      note(/630\.555\.0199/.test(t) && !/630\.771\.0700/.test(t) && /tel:\+16305550199/.test(ns) && /Insulation Products Corporation/.test(ns),
        'no JS: the contact details follow Business Details — the <noscript> floor (C38) too, with a tel: link to the new number', t.slice(-300));
      pristine();
    }

    // ── hidden when JavaScript runs ────────────────────────────────────────
    await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
    const after = await page.evaluate(() => ({ pre: !!document.getElementById('ipc-prerender'), h1: document.querySelectorAll('h1').length }));
    note(!after.pre && after.h1 === 1, 'with JS: React replaced the plain-HTML copy (no #ipc-prerender, one h1)', JSON.stringify(after));
    const slow = await jsCtx.newPage();
    await slow.route(/\/assets\/.*\.js$/, () => {});   // never answered: the bundle is "on its way"
    await slow.goto(BASE + '/products?productId=CC', { waitUntil: 'commit' });
    await slow.waitForTimeout(1500);
    const dispSlow = await slow.evaluate(() => { const e = document.getElementById('ipc-prerender'); return e ? getComputedStyle(e).display : 'absent'; });
    note(dispSlow === 'none', 'with JS and the bundle still loading: the copy is hidden before paint, never flashed', dispSlow);
    await slow.close();
    const blocked = await jsCtx.newPage();
    await blocked.route(/\/assets\/.*\.js$/, (r) => r.abort());
    await blocked.goto(BASE + '/products?productId=CC', { waitUntil: 'load' });
    const shown = await blocked.evaluate(() => {
      const e = document.getElementById('ipc-prerender');
      return e ? { display: getComputedStyle(e).display, text: e.innerText } : { display: 'absent', text: '' };
    });
    note(shown.display !== 'none' && /Conduit Coupling/.test(shown.text) && /630\.771\.0700/.test(shown.text),
      'with JS but the bundle failed to load: the copy and its phone number show — not a blank page (A12-L11-W3-G1-1)', JSON.stringify(shown).slice(0, 200));
    await blocked.close();

    // ── boot: what index.php read, when the browser's own request fails ───
    {
      const inf = readJson('site-info.json');
      inf.contact.phone = '312.555.0199';
      inf.contact.phoneDial = '+13125550199';
      writeData('site-info.json', inf);
      const con = readJson('content.json');
      con.copy.claims.aboutPpapClaim = '';
      writeData('content.json', con);
      const p = await jsCtx.newPage();
      await p.route('**/data/site-info.json*', (r) => r.fulfill({ status: 500, body: 'down' }));
      await p.route('**/data/content.json*', (r) => r.abort('connectionreset'));
      const seenOld = [];
      await p.goto(BASE + '/about', { waitUntil: 'commit' });
      for (let i = 0; i < 8; i++) {
        await p.waitForTimeout(150);
        const t = await p.evaluate(() => (document.body ? document.body.innerText : ''));
        if (/630\.771\.0700/.test(t)) seenOld.push(i);
      }
      await p.waitForLoadState('networkidle');
      const t = await p.innerText('body');
      note(seenOld.length === 0 && /312\.555\.0199/.test(t) && !/630\.771\.0700/.test(t) && !(await p.$('a[href="tel:+16307710700"]')),
        'boot: site-info.json failing in the browser, the page shows Rick\'s phone number — never the shipped one, not even first (decision 11)',
        `seenOld=${seenOld} new=${/312\.555\.0199/.test(t)}`);
      note(!/Available on request/.test(t) && /Privately Held/.test(t),
        'boot: content.json failing in the browser, a Company Claim Rick emptied stays out (decision 9)', t.slice(0, 200));
      await p.close();
      pristine();

      for (const mode of ['503', 'stall']) {
        const q = await jsCtx.newPage();
        await q.route('**/data/products-all.json*', (r) => (mode === '503' ? r.fulfill({ status: 503, body: 'down' }) : null));
        await q.goto(BASE + '/products?productId=CC', { waitUntil: 'domcontentloaded' });
        await q.waitForTimeout(mode === 'stall' ? 13500 : 1500);
        const body = await q.innerText('main');
        const h1 = await q.$$eval('h1', (a) => a.map((x) => x.textContent.trim()));
        const ds = await q.$('main a[href="/pdfs/CC.pdf"]');
        const ch = await q.evaluate(() => ({
          title: document.title,
          canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
          ogImage: (document.querySelector('meta[property="og:image"]') || {}).content || null,
          ogImageW: (document.querySelector('meta[property="og:image:width"]') || {}).content || null,
        }));
        const sh = rawHead((await get('/products?productId=CC')).body);
        note(!/Catalog Unavailable/.test(body) && h1.length === 1 && /Conduit Coupling/.test(h1[0]) && !!ds
          && ch.title === sh.title && ch.canonical === sh.canonical && ch.ogImage === sh.ogImage && ch.ogImageW === sh.ogImageW,
          `boot: the catalog ${mode === '503' ? 'failing' : 'stalling past 12 s'} in the browser keeps the product page the server sent, and its head (decision 10)`,
          JSON.stringify({ h1, ds: !!ds, ch, server: { title: sh.title, canonical: sh.canonical } }));
        await q.close();
      }
    }

    // ── mutated data ───────────────────────────────────────────────────────
    const info = readJson('site-info.json');
    info.certifications.iso = 'ISO 9001:2015';
    info.contact.phone = '630.555.0100';
    info.address.city = 'Naperville';
    info.stats.minimumOrder = '$75';
    info.stats.feetInStock = '30 million';   // A12-L8-W4-G2-1: both rewriters, both cases
    info.company.name = 'IPC Test Co';
    writeData('site-info.json', info);
    const content = readJson('content.json');
    content.seo = content.seo.filter((s) => s.page !== 'about');
    content.seo.find((s) => s.page === 'products').title = '';
    content.copy.faqHeader = { ...(content.copy.faqHeader || {}), title: 'Questions & Answers' };
    writeData('content.json', content);
    await parity([...ROUTES, ...productUrls.slice(0, 6), ...ODD.slice(0, 4)], 'parity: after Business Details + Page Content edits');
    const home = rawHead((await get('/')).body);
    note(/ISO 9001:2015/.test(home.description || '') && /\$75/.test(home.description || ''),
      'mutated: the homepage description carries the new ISO revision and minimum order', home.description);

    // Invariant 4's server half: index.php's port of mergeSiteInfo's blank-drop.
    // settings.php saves an emptied box as "", and nothing here used a blank
    // field, so deleting the server's blank-drop left this suite 24/24 while
    // every crawler-facing page read "Phone:" with no number (AUDIT-12
    // A12-L13-W5-G1-2). One blank and one whitespace-only field.
    {
      const blank = readJson('site-info.json');
      blank.company.name = '';
      blank.contact.phone = '   ';
      writeData('site-info.json', blank);
      await parity([...ROUTES, '/products?productId=CC', '/products?productId=zzz-nope'], 'parity: a blank company name and a whitespace-only phone are ignored (invariant 4)');
      const cb = (await get('/contact')).body;
      note(!/Phone:\s*<\/p>/.test(cb) && /630\.771\.0700/.test(cb),
        'blank phone: the served page keeps the default number, never "Phone:" alone', (cb.match(/<p>Phone:[^<]*<\/p>/) || ['(no Phone line)'])[0]);
      pristine();
    }

    // AUDIT-12 decisions 14 and 15 — Minimum Order emptied (no minimum) and a
    // move: the minimum-order sentence goes, and a history sentence keeps
    // its town while the current one follows the new City.
    {
      const inf = readJson('site-info.json');
      inf.stats.minimumOrder = '';
      inf.address.city = 'Naperville';
      writeData('site-info.json', inf);
      const con = readJson('content.json');
      con.seo.find((s) => s.page === 'about').desc = 'Incorporated in Bolingbrook, Illinois on July 1, 1974. A stocking distributor in Bolingbrook, IL.';
      writeData('content.json', con);
      await parity(['/', '/about', '/services', '/products?productId=CC'], 'parity: Minimum Order emptied and a new City, with a history sentence (decisions 14, 15)');
      const h = rawHead((await get('/')).body);
      const a = rawHead((await get('/about')).body);
      note(!/minimum order/i.test(h.description || '') && /industrial adhesives\. ISO 9001 registered\.$/.test(h.description || '')
        && a.description === 'Incorporated in Bolingbrook, Illinois on July 1, 1974. A stocking distributor in Naperville, IL.',
        'no minimum: the sentence is gone, not "$50" back; a move rewrites the current town and never the history sentence',
        `home=${h.description} | about=${a.description}`);
      pristine();
    }

    const c2 = readJson('content.json');
    c2.seo = [];
    writeData('content.json', c2);
    await parity(ROUTES, 'parity: every SEO row deleted (invariant 3)');
    delete c2.seo;
    writeData('content.json', c2);
    await parity(ROUTES, 'parity: no seo key at all (defaults)');
    pristine();

    const hostile = readJson('products-all.json');
    const hrows = Array.isArray(hostile) ? hostile : hostile.products;
    hrows[0].name = 'Coupling <script>alert(1)</script> & "Quoted" — ±0.5° tolerance (very long name that will need trimming past sixty)';
    hrows[0].photoUrl = 'https://cdn.example.com/x.jpg?a=1&b="2"';
    hrows[1].pdfUrl = 'javascript:alert(1)';
    hrows[2].photoUrl = '/images/products/no-such-photo.jpg';   // decision 24: nothing to measure
    writeData('products-all.json', hostile);
    const hu = `/products?productId=${encodeURIComponent(hrows[0].id)}`;
    await parity([hu, `/products?productId=${encodeURIComponent(hrows[1].id)}`, `/products?productId=${encodeURIComponent(hrows[2].id)}`, '/products'],
      'parity: a hostile product name, photo URL and data-sheet URL, and a photo that is not on the server');
    {
      const off = rawHead((await get(hu)).body);
      const gone = rawHead((await get(`/products?productId=${encodeURIComponent(hrows[2].id)}`)).body);
      note(off.ogImageW === null && off.ogImageH === null && gone.ogImageW === null && gone.ogImageH === null,
        'a photo on another host, or missing, declares no og:image size rather than a wrong one (decision 24)', JSON.stringify([off.ogImageW, gone.ogImageW]));
    }
    const hb = (await get(hu)).body + (await get(`/products?productId=${encodeURIComponent(hrows[1].id)}`)).body + (await get('/products')).body;
    note(!/<script>alert\(1\)/.test(hb) && !/href="javascript:/.test(hb), 'hostile: nothing from the catalog reaches the page unescaped, and an unsafe data-sheet URL is not linked');
    pristine();

    // ── fallback ───────────────────────────────────────────────────────────
    const shell = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
    writeData('content.json', '{ not json');
    let r = await get('/about');
    note(r.status === 200 && r.body === shell, 'fallback: a damaged content.json serves index.html byte for byte', `${r.status} ${r.body.length} vs ${shell.length}`);
    pristine();
    writeData('site-info.json', '');
    r = await get('/products?productId=CC');
    note(r.status === 200 && r.body === shell, 'fallback: an empty site-info.json serves index.html byte for byte', `${r.status} ${r.body.length} vs ${shell.length}`);
    pristine();
    writeData('products-all.json', '[[[');
    await parity(['/products?productId=CC', '/products', '/about'], 'parity: a damaged catalog gives the pending product head (PUB-2)');
    const pend = rawHead((await get('/products?productId=CC')).body);
    note(pend.canonical === null && pend.robots === null && pend.ogUrl === null, 'damaged catalog: a product URL declares no canonical and no noindex', JSON.stringify(pend));
    pristine();

    note(warned.length === 0, 'no PHP warning or notice text in any response', warned.slice(0, 5).join(', '));

    fs.renameSync(path.join(SITE, 'index.html'), path.join(SITE, 'index.html.bak'));
    r = await get('/about');
    note(r.status === 500, 'no index.html at all: a 500, not an empty 200', String(r.status));
    fs.renameSync(path.join(SITE, 'index.html.bak'), path.join(SITE, 'index.html'));
  } finally {
    await browser.close();
    srv.kill();
    fs.rmSync(SITE, { recursive: true, force: true });
  }
  const bad = results.filter((x) => !x.ok).length;
  console.log(`\nprerender ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
