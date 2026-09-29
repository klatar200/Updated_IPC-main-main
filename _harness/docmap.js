/**
 * Owner-docs map — Help → "Where each part of the site is edited" (admin/help.php
 * #sitemap) is measured, not read off the code, and this suite is the
 * measurement (owner-docs audit 2026-09-29).
 *
 * 1. Writes a unique marker into EVERY text field of Page Content and Business
 *    Details, and into one product's fields, through the real admin forms.
 * 2. Loads every public route at 1440 and 390 (menus hovered, drawer opened,
 *    accordions expanded, Message tab clicked) and submits the contact form in
 *    four states (sent, slow, network error, server error), then reads the
 *    captured mail.
 * 3. Asserts:
 *    - every field reaches the site somewhere (Product Families are checked
 *      where they surface: the Part Type dropdown);
 *    - the specific claims the Help page makes: the fields it calls "not shown
 *      on any page" are in no visible text; Operating Temperature is on the
 *      Product Index only; Image Caption shows twice on the product page; the
 *      Business Details email is the notification recipient; the header
 *      wordmark does not follow Company Name; the auto-reply boxes reach the
 *      customer's email;
 *    - every Page Content card title and every Business Details field is named
 *      in help.php — add a field to content.php or settings.php and this fails
 *      until the Help page says where it shows.
 *
 * Runs over a throwaway COPY of the mirror (own `php -S` on :8723), so it never
 * writes to _harness/site and is safe beside other suites.
 *
 * 4. WHATS_LEFT §2t: the three "nothing found" messages follow a Business
 *    Details phone change (two had 630.771.0700 typed in; the Product Index's
 *    empty-catalog line told the public to "add your first product … in the
 *    dashboard").
 *
 *   node _harness/docmap.js [--where]     # --where prints the field → page map
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { adminHttp } = require('./adminhttp');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const MIRROR = path.join(__dirname, 'site');
const PORT = +(process.env.DOCMAP_PORT || 8723);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'audit-pass-123';
const WHERE = process.argv.includes('--where');
const SKU = 'IP38FE';

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// <template> rows are not submitted by a browser; formFields() would post them
// and the template's "[0]" would overwrite the real first row.
const noTemplates = (html) => html.replace(/<template\b[\s\S]*?<\/template>/gi, '');

let n = 0;
const markers = {};                     // marker → field
const mk = (field) => { const m = `zq${(n++).toString(36)}zq`; markers[m] = field; return m; };
const SKIP_CONTENT = /^(csrf_token|orig_sig|form_complete)$|\[(ctaPrimaryPage|ctaSecondaryPage|iconKey|page)\]$/;
// Fields that must hold a validated value — no marker, checked by name below.
const SKIP_SETTINGS = /^(csrf_token|orig_sig|theme_(primary|dark|accent|accent2)|company_foundedYear|contact_phone|contact_phoneDial|hours_(opens|closes|days))$/;

function markContent(pairs) {
  return pairs.map(([k, v]) => {
    if (SKIP_CONTENT.test(k)) return [k, v];
    if (/\[siteImages\]/.test(k)) return [k, `uploads/site/${mk(k)}.jpg`];
    if (/\[brochure_url\]$/.test(k)) return [k, `/pdfs/${mk(k)}.pdf`];
    if (/^productFamilies\[/.test(k)) return [k, `${v} ${mk(k)}`];
    return [k, v ? `${v} ${mk(k)}` : mk(k)];
  });
}
function markSettings(pairs) {
  return pairs.map(([k, v]) => {
    if (SKIP_SETTINGS.test(k)) return [k, v];
    if (k === 'contact_email') return [k, `${mk(k)}@example.com`];
    if (/^social_/.test(k)) return [k, `https://example.com/${mk(k)}`];
    if (k === 'catalogPdfUrl') return [k, `/pdfs/${mk(k)}.pdf`];
    if (k === 'theme_logo') return [k, `/${mk(k)}.svg`];
    return [k, v ? `${v} ${mk(k)}` : mk(k)];
  });
}
const PRODUCT_FIELDS = ['name', 'caption', 'operatingTemp', 'specificationsSummary', 'badges', 'description'];
function markProduct(pairs) {
  // Prepended, not appended: the Product Index cuts the summary at 90 characters
  // and the description at 110, and the search description at 160.
  return pairs.map(([k, v]) => (PRODUCT_FIELDS.includes(k) ? [k, `${mk('product.' + k)} ${v}`] : [k, v]));
}

const ROUTES = ['/', '/products', `/products?productId=${SKU}`, '/dashboard', '/datasheets', '/industries',
  '/services', '/about', '/faq', '/contact', '/privacy', '/no-such-page'];
const COLLECT = () => {
  const attrs = [];
  for (const el of document.querySelectorAll('*')) {
    for (const a of ['src', 'href', 'placeholder', 'alt', 'aria-label', 'title', 'content']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) attrs.push(v);
    }
  }
  const header = (document.querySelector('header') || document.body).innerText;
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).join('\n');
  return { visible: document.body.innerText, title: document.title, attrs: attrs.join('\n'), ld, header };
};

const seen = {};                        // marker → Set("route part")
const count = {};                       // marker@route → max occurrences in visible text
function record(route, snap) {
  for (const [part, text] of Object.entries(snap)) {
    const low = String(text).toLowerCase();
    for (const m of Object.keys(markers)) {
      if (!low.includes(m)) continue;
      (seen[m] = seen[m] || new Set()).add(`${route} ${part}`);
      if (part === 'visible') {
        const c = low.split(m).length - 1;
        count[`${m}@${route}`] = Math.max(count[`${m}@${route}`] || 0, c);
      }
    }
  }
}

async function crawl(browser) {
  for (const w of [1440, 390]) {
    for (const route of ROUTES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      for (const b of await page.$$('main [aria-expanded="false"]')) { try { await b.click({ timeout: 300 }); } catch { /* covered */ } }
      record(route, await page.evaluate(COLLECT));
      if (w === 1440) {
        for (const t of await page.$$('header button[aria-haspopup="true"]')) {
          try { await t.hover(); await page.waitForTimeout(250); record(route, await page.evaluate(COLLECT)); } catch { /* detached */ }
        }
      } else {
        const b = page.locator('button[aria-label*="enu" i]').first();
        if (await b.count()) { try { await b.click(); await page.waitForTimeout(300); record(route, await page.evaluate(COLLECT)); } catch { /* none */ } }
      }
      if (route === '/contact' && w === 1440) {
        const tab = page.locator('button', { hasText: /message/i }).first();
        if (await tab.count()) { await tab.click(); await page.waitForTimeout(250); record(route, await page.evaluate(COLLECT)); }
      }
      await ctx.close();
    }
  }
  // The contact form's other states: sent (both tabs), in flight, failed.
  const modes = [['sent-rfq', null], ['sent-msg', null], ['slow', 'slow'], ['neterr', 'abort'], ['srverr', '500']];
  for (const [label, how] of modes) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    if (how === 'abort') await page.route('**/contact.php', (r) => r.abort());
    if (how === '500') await page.route('**/contact.php', (r) => r.fulfill({ status: 500, contentType: 'text/html', body: '<h1>500</h1>' }));
    if (how === 'slow') await page.route('**/contact.php', async (r) => { await new Promise((z) => setTimeout(z, 2500)); await r.continue(); });
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    if (label === 'sent-msg') {
      await page.locator('button', { hasText: /message/i }).first().click();
      await page.waitForTimeout(200);
      await page.fill('input[name="subject"]', 'Doc map probe');
      await page.fill('textarea[name="message"]', 'Doc map probe message.');
    } else {
      await page.fill('input[name="quantity"]', '10 ft');
    }
    await page.fill('input[name="name"]', 'Doc Map');
    await page.fill('input[name="email"]', 'docmap@example.com');
    await page.locator('form button[type="submit"]:visible').first().click();
    if (how === 'slow') { await page.waitForTimeout(700); record(`/contact#${label}`, await page.evaluate(COLLECT)); await page.waitForTimeout(3500); }
    else await page.waitForTimeout(2000);
    record(`/contact#${label}`, await page.evaluate(COLLECT));
    await ctx.close();
  }
}

(async () => {
  if (!fs.existsSync(path.join(MIRROR, 'admin', 'config.local.php'))) {
    console.log('docmap: no mirror — run `npm run build && sh _harness/sync.sh` first'); process.exit(2);
  }
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`docmap: port ${PORT} is already in use — stop that server first`); process.exit(2);
  }
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-docmap-'));
  const SITE = path.join(TMP, 'site');
  const MAIL = path.join(TMP, 'mail.log');
  fs.cpSync(MIRROR, SITE, { recursive: true, filter: (p) => !/\/admin\/(\.sessions|.*\.jsonl$|\.login-throttle\.json$|\.inquiries-seen\.json$)/.test(p) });
  for (const f of ['products-all.json', 'content.json', 'site-info.json']) fs.copyFileSync(path.join(__dirname, 'pristine', f), path.join(SITE, 'data', f));
  for (const x of fs.readdirSync(path.join(SITE, 'data'))) if (/\.backup\./.test(x)) fs.rmSync(path.join(SITE, 'data', x));
  fs.copyFileSync(path.join(__dirname, 'fakemail.sh'), path.join(TMP, 'fakemail.sh'));   // php-mail.ini: sendmail_path = ../fakemail.sh
  // Its own temp dir: contact.php keeps its per-IP rate limit and auto-reply
  // cap there, and the shared one fills up after a couple of runs (measured:
  // the second run's submissions were refused as rate-limited).
  const PHPTMP = path.join(TMP, 'phptmp');
  fs.mkdirSync(PHPTMP);
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'), '-d', `sys_temp_dir=${PHPTMP}`, path.join(__dirname, 'router.php')],
    { cwd: SITE, stdio: 'ignore', env: { ...process.env, IPC_MAIL_LOG: MAIL } });
  let browser = null;
  try {
    await new Promise((r) => setTimeout(r, 800));
    const a = adminHttp(PORT);
    if (!(await a.login(PW))) throw new Error('sign-in failed');

    // ── 1. mark every field through the real forms ──
    const cg = await a.req('GET', '/admin/content.php');
    const cardTitles = [...cg.body.matchAll(/<legend class="card-title">([\s\S]*?)<\/legend>/g)].map((m) => dec(m[1].replace(/<[^>]+>/g, '').trim()));
    const cr = await a.post('/admin/content.php', markContent(a.formFields(noTemplates(cg.body), /form_complete/)));
    note(cr.status === 302, 'setup: Page Content saves with a marker in every text field', `status ${cr.status}`);
    const sg = await a.req('GET', '/admin/settings.php');
    const settingNames = a.formFields(sg.body, /orig_sig/).map(([k]) => k);
    const sr = await a.post('/admin/settings.php', markSettings(a.formFields(sg.body, /orig_sig/)));
    note(sr.status === 302, 'setup: Business Details saves with a marker in every text field', `status ${sr.status}`);
    const eg = await a.req('GET', `/admin/edit.php?sku=${SKU}`);
    const er = await a.post(`/admin/edit.php?sku=${SKU}`, markProduct(a.formFields(eg.body, /orig_sig/)));
    note(er.status === 302, `setup: product ${SKU} saves with a marker in its text fields`, `status ${er.status}`);
    const disk = ['content.json', 'site-info.json', 'products-all.json'].map((f) => fs.readFileSync(path.join(SITE, 'data', f), 'utf8').toLowerCase()).join('\n');
    const lost = Object.entries(markers).filter(([m]) => !disk.includes(m)).map(([, f]) => f);
    note(lost.length === 0, `setup: all ${Object.keys(markers).length} markers reached the data files`, lost.slice(0, 8).join(', '));

    // ── 2. crawl ──
    browser = await launch();
    await crawl(browser);
    const mail = fs.existsSync(MAIL) ? fs.readFileSync(MAIL, 'utf8') : '';
    const mailText = (mail.replace(/=\r?\n/g, '') + '\n' + (mail.match(/^[A-Za-z0-9+/=]{40,}$/gm) || []).map((l) => Buffer.from(l, 'base64').toString('utf8')).join('\n')).toLowerCase();
    for (const m of Object.keys(markers)) if (mailText.includes(m)) (seen[m] = seen[m] || new Set()).add('email');
    const addg = await a.req('GET', '/admin/add.php');
    for (const m of Object.keys(markers)) if (addg.body.toLowerCase().includes(m)) (seen[m] = seen[m] || new Set()).add('admin:add.php Part Type');

    const where = (field) => Object.entries(markers).filter(([, f]) => f === field).flatMap(([m]) => [...(seen[m] || [])]);
    const byField = {};
    for (const [m, f] of Object.entries(markers)) byField[f] = [...new Set([...(byField[f] || []), ...(seen[m] || [])])];

    // ── 3a. every field reaches the site (or the email / Part Type list) ──
    const nowhere = Object.entries(byField).filter(([, w]) => !w.length).map(([f]) => f);
    note(nowhere.length === 0, `every one of ${Object.keys(byField).length} marked fields shows up somewhere`, nowhere.join(', '));
    const fam = Object.entries(byField).filter(([f]) => /^productFamilies\[/.test(f));
    note(fam.length > 0 && fam.every(([, w]) => w.includes('admin:add.php Part Type')), 'Product Families feed the Part Type dropdown (Help: "where the Part Type list … comes from")');

    // ── 3b. the Help page's specific claims ──
    const visibleAnywhere = (field) => where(field).some((w) => / visible$/.test(w));
    for (const f of ['company_description', 'addr_country']) {
      note(where(f).length > 0 && !visibleAnywhere(f), `Help: "${f}" is not shown on any page, only to search engines`, where(f).slice(0, 4).join(', '));
    }
    note(!visibleAnywhere('company_shortName') && where('company_shortName').some((w) => / title$/.test(w)),
      'Help: Short Name is not in page text, but can end a product page\'s browser-tab title');
    const ot = where('product.operatingTemp').filter((w) => / visible$/.test(w)).map((w) => w.split(' ')[0]);
    note(ot.length > 0 && ot.every((r) => r === '/dashboard'), 'Help: Operating Temperature appears on the Product Index only', ot.join(', '));
    const capM = Object.keys(markers).find((m) => markers[m] === 'product.caption');
    note((count[`${capM}@/products?productId=${SKU}`] || 0) >= 2, 'Help: Image Caption shows twice on the product page (under the name and under the photo)');
    note(where('product.specificationsSummary').some((w) => w.startsWith('/dashboard ')) && where('product.specificationsSummary').some((w) => w === `/products?productId=${SKU} attrs`),
      'Help: Specifications Summary feeds the Product Index and the product page\'s search description');
    const hdr = await (async () => { const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'networkidle' }); const t = await p.evaluate(() => (document.querySelector('header') || document.body).innerText); await ctx.close(); return t; })();
    const nameM = Object.keys(markers).find((m) => markers[m] === 'company_name');
    note(/INSULATION PRODUCTS/i.test(hdr) && !hdr.toLowerCase().includes(nameM), 'Help: the name beside the logo is fixed — it does not follow Company Name');
    const emailM = Object.keys(markers).find((m) => markers[m] === 'contact_email');
    note(new RegExp(`^To:.*${emailM}@example\\.com`, 'mi').test(mail), 'Help: quote requests are sent to the Business Details email');
    for (const f of ['autoReplyRfqPromise', 'autoReplyMsgPromise', 'autoReplyNotice']) {
      note(where(`copy[contactForm][${f}]`).includes('email'), `Help: the ${f} box reaches the customer's auto-reply email`);
    }
    for (const [f, route] of [['sendingLabel', '/contact#slow'], ['rfqSuccessTitle', '/contact#sent-rfq'], ['msgSuccessTitle', '/contact#sent-msg'], ['networkError', '/contact#neterr'], ['submitError', '/contact#srverr']]) {
      note(where(`copy[contactForm][${f}]`).includes(`${route} visible`), `Help: Contact Page — Form "${f}" shows in the ${route.split('#')[1]} state`);
    }

    // ── 3c. the Help page names every card and every field ──
    const help = dec(fs.readFileSync(path.join(ROOT, 'admin', 'help.php'), 'utf8').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    const missingCards = [...new Set(cardTitles)].filter((t) => t && !help.includes(t));
    note(cardTitles.length >= 31 && missingCards.length === 0, `help.php names all ${new Set(cardTitles).size} Page Content cards`, missingCards.join(' | '));
    // Each Business Details input → the words the Help page uses for it. A new
    // input with no entry here fails: document it, then add it.
    const DOC_TERMS = {
      theme_primary: 'Primary', theme_dark: 'Dark', theme_accent: 'colors', theme_accent2: 'Secondary accent', theme_logo: 'Logo URL',
      company_name: 'Company name', company_shortName: 'Short name', company_foundedYear: 'Founded year', company_slogan: 'Slogan',
      company_description: 'Short Description', contact_phone: 'Phone', contact_phoneDial: 'dial', contact_fax: 'fax', contact_email: 'email',
      addr_street: 'Address', addr_city: 'Address', addr_state: 'Address', addr_zip: 'Address', addr_country: 'Country',
      hours_text: 'Hours (display text)', hours_opens: 'Opens', hours_closes: 'Closes', hours_days: 'Open Days',
      cert_iso: 'ISO', cert_other: 'Other certifications', stats_min: 'Minimum Order', stats_feet: 'Feet In Stock',
      about_paragraphs: 'About story', catalogPdfUrl: 'Catalog PDF URL',
      social_facebook: 'Social links', social_linkedin: 'Social links', social_twitter: 'Social links', social_youtube: 'Social links',
      social_pinterest: 'Social links', social_instagram: 'Social links', social_tiktok: 'Social links',
    };
    // Case-sensitive on purpose: "Feet In Stock" is the field, "feet in stock"
    // is prose that mentions it (a lower-cased match passed with the row deleted).
    const undocumented = settingNames.filter((k) => !/^(csrf_token|orig_sig)$/.test(k)).filter((k) => !DOC_TERMS[k] || !help.includes(DOC_TERMS[k]));
    note(undocumented.length === 0, `help.php covers all ${settingNames.length - 2} Business Details fields`, undocumented.join(', '));

    // ── 4. §2t: empty states follow the Business Details phone ──
    {
      const NEWPHONE = '630.555.0142';
      const g = await a.req('GET', '/admin/settings.php');
      const pairs = a.formFields(g.body, /orig_sig/).map(([k, v]) => (k === 'contact_phone' ? [k, NEWPHONE] : k === 'contact_phoneDial' ? [k, ''] : [k, v]));
      const r = await a.post('/admin/settings.php', pairs);
      note(r.status === 302, '§2t setup: Business Details phone changed to ' + NEWPHONE, `status ${r.status}`);
      const read = async (route, fill) => {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(BASE + route, { waitUntil: 'networkidle' });
        if (fill) { await p.fill(`input[placeholder^="${fill}"]`, 'zzqqxxnomatch'); await p.waitForTimeout(400); }
        const t = await p.evaluate(() => (document.querySelector('main') || document.body).innerText);
        await ctx.close();
        return t;
      };
      const ds = await read('/datasheets', 'Filter by part number');
      note(/No datasheets found/.test(ds) && ds.includes(NEWPHONE) && !ds.includes('630.771.0700'), '§2t: /datasheets "No datasheets found" gives the Business Details phone');
      const pr = await read('/products', 'Search by part number');
      note(/No products found/.test(pr) && pr.includes(NEWPHONE) && !pr.includes('630.771.0700'), '§2t: /products "No products found" gives the Business Details phone');
      const cat = path.join(SITE, 'data', 'products-all.json');
      const keep = fs.readFileSync(cat);
      fs.writeFileSync(cat, '[]');
      const dash = await read('/dashboard');
      fs.writeFileSync(cat, keep);
      note(/No products in the catalog yet/.test(dash) && dash.includes(NEWPHONE) && !/dashboard/i.test(dash.replace(/Product Index/g, '')),
        '§2t: an empty catalog tells the public to call, not to use the admin dashboard', dash.slice(0, 200).replace(/\s+/g, ' '));
    }

    if (WHERE) {
      for (const [f, w] of Object.entries(byField)) console.log(`   ${f.padEnd(40)} ${[...new Set(w.map((x) => x.replace(/ (visible|attrs|title|ld|header)$/, (s) => s)))].slice(0, 6).join(' | ')}`);
    }
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\ndocmap ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
