/**
 * Business Details → Branding → Homepage layout (Keagan 2026-10-17).
 *
 * The homepage has three designs, Classic (the original), Bold and Light,
 * chosen by site-info.json theme.homeLayout through settings.php. This holds
 * the switch end to end through the real admin, and holds Bold and Light to
 * the rules Classic is already held to by other suites:
 *
 *   1. With no homeLayout stored (a pristine site-info.json) the homepage is
 *      Classic — nothing changes for a site that never touched the setting.
 *   2. Choosing a layout on Business Details and pressing Save stores it and
 *      the homepage renders it; the dropdown then shows it selected.
 *   3. A crafted POST with an unlisted layout saves "classic", never the value.
 *   4. Bold and Light at 390 / 768 / 1024 / 1440: no horizontal page scroll,
 *      no console or page error, one h1, every Products & Services card and
 *      every market, and the same live datasheet count Classic shows.
 *   5. No hero text is painted over a photograph: Bold's copy box never
 *      intersects its photo (1024/1440); Light's copy sits on an opaque card.
 *   6. Every text element inside each layout meets WCAG AA (4.5:1, or 3:1 for
 *      large text) against the opaque background it sits on, on the shipped
 *      palette and on two pale owner palettes.
 *   7. Light's card photos: the defaults map is identical in content.php and
 *      App.jsx; every shipped card shows its photo (loaded, not broken); a
 *      card's Photo box is PREFILLED with that picture on Page Content (so the
 *      first save keeps it); an unsafe path is refused and nothing is saved;
 *      an emptied box saves "" and the tile shows its icon instead.
 *   8. Switching back to Classic renders Classic again.
 *   9. Distributor, Corporate and Classic distributor, with the catalog fetch
 *      blocked, print no "0 products" style count (audit 2026-10-17).
 *
 * Restores site-info.json and content.json byte for byte and asserts it.
 * Usage: node _harness/homelayout.js      (needs the mirror on :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const ROOT = path.join(__dirname, '..');
const SITE_INFO = path.join(__dirname, 'site', 'data', 'site-info.json');
const CONTENT = path.join(__dirname, 'site', 'data', 'content.json');

let pass = 0, fail = 0;
const ok = (c, m, detail = '') => {
  c ? pass++ : fail++;
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}${c || !detail ? '' : '\n         <- ' + detail}`);
};

const PALETTES = {
  shipped: null,
  'pale dark #d0dcea': { darkColor: '#d0dcea' },
  'bright primary #ffd400': { primaryColor: '#ffd400' },
};
// cards/markets: elements that must number the Page Content features/markets;
// families: elements that must number the catalog's product families;
// stats: the layout shows the stats band (so the datasheet count is checked).
const LAYOUTS = {
  bold: { root: '.ipcb', cards: '#ipc-sec-features .ipcb-feat, #ipc-sec-features .ipcb-row', markets: '#ipc-sec-markets .ipcb-ind-item', stats: true },
  light: { root: '.ipcl', cards: '#ipc-sec-features .ipcl-tile', markets: '#ipc-sec-markets .ipcl-ind-card', stats: true },
  distributor: { root: '.ipcd', families: '.ipcd-fam-tile:not(.ipcd-fam-all)', markets: '#ipc-sec-markets .ipcd-ind-card' },
  corporate: { root: '.ipcc', families: '.ipcc-cols a', stats: true },
  sidebar: { root: '.ipcs', families: '.ipcs-cats a', featured: '.ipcs-card' },
};
const ALL_LAYOUTS = ['classic', ...Object.keys(LAYOUTS)];

function writeTheme(original, patch) {
  const j = JSON.parse(original);
  j.theme = { ...(j.theme || {}), ...patch };
  fs.writeFileSync(SITE_INFO, JSON.stringify(j, null, 4));
}

// Runs in the page: every element with its own text inside `root`, scored
// against the first opaque background behind it (translucent layers
// composited). Returns the failures.
const SCORE = (rootSel) => {
  const root = document.querySelector(rootSel);
  if (!root) return { scored: 0, bad: ['no ' + rootSel] };
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]));
  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; }
    }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = layers[i][3] >= 1 ? layers[i].slice(0, 3) : over(layers[i], base);
    return base;
  };
  const bad = [];
  let scored = 0;
  for (const el of root.querySelectorAll('*')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('.sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bgc = backdrop(el);
    const ink = fg[3] < 1 ? over(fg, bgc) : fg.slice(0, 3);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(ink, bgc);
    scored++;
    if (got < need) bad.push(`${got.toFixed(2)}:1 (needs ${need}) "${el.textContent.trim().slice(0, 40)}"`);
  }
  return { scored, bad };
};

(async () => {
  const originalSite = fs.readFileSync(SITE_INFO, 'utf8');
  const originalContent = fs.readFileSync(CONTENT, 'utf8');
  const content = JSON.parse(originalContent);
  const browser = await launch();
  try {
    // ── 7a. the photo defaults agree in PHP and JS ───────────────────────
    const php = fs.readFileSync(path.join(ROOT, 'admin', 'content.php'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf8');
    const phpMap = {}, jsMap = {};
    const pm = /const FEATURE_PHOTO_DEFAULTS = \[([\s\S]*?)\];/.exec(php);
    if (pm) for (const [, k, v] of pm[1].matchAll(/'(\w+)'\s*=>\s*'([^']+)'/g)) phpMap[k] = v;
    const jm = /const FEATURE_PHOTO_DEFAULTS = \{([\s\S]*?)\};/.exec(js);
    if (jm) for (const [, k, v] of jm[1].matchAll(/(\w+):\s*"([^"]+)"/g)) jsMap[k] = v;
    ok(Object.keys(phpMap).length >= 6 && JSON.stringify(phpMap) === JSON.stringify(jsMap),
      'FEATURE_PHOTO_DEFAULTS is identical in admin/content.php and src/App.jsx', `php ${JSON.stringify(phpMap)} js ${JSON.stringify(jsMap)}`);
    const missing = Object.values(phpMap).filter((p) => !fs.existsSync(path.join(__dirname, 'site', p)));
    ok(missing.length === 0, 'every default card photo is a file the site serves', missing.join(', '));

    // ── 1. default is Classic ─────────────────────────────────────────────
    const stored = JSON.parse(originalSite);
    const pristineHasNone = !(stored.theme && stored.theme.homeLayout);
    const pub = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pub.goto(BASE + '/', { waitUntil: 'networkidle' });
    const classic0 = await pub.evaluate(() => {
      const stat = [...document.querySelectorAll('#ipc-sec-stats .min-w-0')].find((c) => /Datasheets/i.test(c.textContent));
      return {
        other: !!document.querySelector('.ipcb, .ipcl'),
        proof: !!document.querySelector('#ipc-sec-heroProofPoints'),
        datasheets: stat ? stat.firstElementChild.textContent.trim() : null,
      };
    });
    ok(pristineHasNone && !classic0.other && classic0.proof,
      'with no homeLayout stored the homepage is Classic (proof cards present, no Bold/Light markup)', JSON.stringify({ pristineHasNone, ...classic0 }));

    // ── 2. choosing each layout in Business Details ──────────────────────
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adm = await ctx.newPage();
    await adm.goto(BASE + '/admin/settings.php', { waitUntil: 'domcontentloaded' });
    if (await adm.$('input[type=password]')) {
      await adm.fill('input[type=password]', PW);
      await adm.click('button[type=submit]');
      await adm.waitForLoadState('domcontentloaded');
      await adm.goto(BASE + '/admin/settings.php', { waitUntil: 'domcontentloaded' });
    }
    const opts = await adm.evaluate(() => {
      const s = document.querySelector('select[name=theme_layout]');
      return s ? { label: s.labels && s.labels[0] ? s.labels[0].textContent.trim() : null, values: [...s.options].map((o) => o.value) } : null;
    });
    ok(opts && opts.label === 'Homepage layout' && JSON.stringify(opts.values) === JSON.stringify(ALL_LAYOUTS),
      `Business Details offers a labelled "Homepage layout" select: ${ALL_LAYOUTS.join(', ')}`, JSON.stringify(opts));
    const appList = /const HOME_LAYOUTS = \[([^\]]*)\]/.exec(js);
    ok(appList && JSON.stringify([...appList[1].matchAll(/"(\w+)"/g)].map((m) => m[1])) === JSON.stringify(ALL_LAYOUTS),
      'HOME_LAYOUTS in src/App.jsx lists the same layouts in the same order', appList ? appList[1] : 'not found');
    const choose = async (value) => {
      await adm.goto(BASE + '/admin/settings.php', { waitUntil: 'domcontentloaded' });
      await adm.selectOption('select[name=theme_layout]', value);
      await adm.click('.form-actions button[type=submit]');
      await adm.waitForLoadState('domcontentloaded');
    };
    for (const value of Object.keys(LAYOUTS)) {
      await choose(value);
      const saved = JSON.parse(fs.readFileSync(SITE_INFO, 'utf8'));
      await adm.goto(BASE + '/admin/settings.php', { waitUntil: 'domcontentloaded' });
      const shown = await adm.$eval('select[name=theme_layout]', (s) => s.value);
      await pub.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
      const rendered = await pub.evaluate((sel) => !!document.querySelector(sel), LAYOUTS[value].root);
      ok(saved.theme && saved.theme.homeLayout === value && shown === value && rendered,
        `choosing ${value} stores "${value}", shows it selected, and the homepage renders it`,
        JSON.stringify({ stored: saved.theme && saved.theme.homeLayout, shown, rendered }));
    }

    // ── 3. a crafted value saves as Classic ──────────────────────────────
    const crafted = await adm.evaluate(async () => {
      // The Business Details form itself — the first <form> on the page is
      // the header's Sign Out (a first draft of this check posted that).
      const f = document.querySelector('select[name=theme_layout]').form;
      const fd = new FormData(f);
      fd.set('theme_layout', '<script>x</script>');
      const r = await fetch(f.action || location.href, { method: 'POST', body: fd, credentials: 'same-origin' });
      return r.status;
    });
    const afterCraft = JSON.parse(fs.readFileSync(SITE_INFO, 'utf8'));
    ok(crafted < 400 && afterCraft.theme.homeLayout === 'classic',
      'a POST with an unlisted layout stores "classic", not the value', `status ${crafted}, stored ${JSON.stringify(afterCraft.theme.homeLayout)}`);

    // ── 4–6 for each layout ──────────────────────────────────────────────
    const features = (content.features || []).length;
    const markets = (content.markets || []).length;
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'site', 'data', 'products-all.json'), 'utf8'));
    const familyNames = [...new Set(catalog.map((p) => p.partType).filter(Boolean))];
    const familiesWithPhoto = familyNames.filter((n) => catalog.some((p) => p.partType === n && p.photoUrl)).length;
    const expect = {
      cards: features,
      markets,
      families: familyNames.length,
      featured: Math.min(4, familiesWithPhoto),
    };
    for (const [layout, L] of Object.entries(LAYOUTS)) {
      writeTheme(originalSite, { homeLayout: layout });
      const base = fs.readFileSync(SITE_INFO, 'utf8');
      for (const width of [390, 768, 1024, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        await page.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
        await page.evaluate(async () => { for (let y = 0; y < 5000; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
        await page.waitForTimeout(400);
        const r = await page.evaluate((L) => {
          const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
          const stat = [...document.querySelectorAll('#ipc-sec-stats .min-w-0')].find((c) => /Datasheets/i.test(c.textContent));
          const tilesImg = [...document.querySelectorAll('.ipcl-tile img')];
          const card = document.querySelector('.ipcl-card');
          return {
            here: !!document.querySelector(L.root),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            h1: document.querySelectorAll('h1').length,
            counts: Object.fromEntries(['cards', 'markets', 'families', 'featured']
              .filter((k) => L[k]).map((k) => [k, document.querySelectorAll(L[k]).length])),
            brokenImgs: [...document.querySelectorAll(L.root + ' img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
            datasheets: stat ? stat.firstElementChild.textContent.trim() : null,
            copy: box('.ipcb-hero-copy'),
            photo: box('.ipcb-hero-photo'),
            photoAbs: (() => { const e = document.querySelector('.ipcb-hero-photo'); return e ? getComputedStyle(e).position : null; })(),
            tileImgs: tilesImg.length,
            tileLoaded: tilesImg.filter((i) => i.complete && i.naturalWidth > 0).length,
            cardBg: card ? getComputedStyle(card).backgroundColor : null,
          };
        }, L);
        ok(r.here && r.overflow <= 0 && r.h1 === 1 && errors.length === 0,
          `${layout} ${width}: renders with no horizontal scroll, one h1, no console or page error`,
          JSON.stringify({ here: r.here, overflow: r.overflow, h1: r.h1, errors: errors.slice(0, 2) }));
        const want = Object.fromEntries(Object.keys(r.counts).map((k) => [k, expect[k]]));
        ok(JSON.stringify(r.counts) === JSON.stringify(want) && r.brokenImgs.length === 0,
          `${layout} ${width}: every item is shown (${Object.entries(want).map(([k, v]) => `${v} ${k}`).join(', ')}) and no picture is broken`,
          `saw ${JSON.stringify(r.counts)}; broken ${r.brokenImgs.join(', ')}`);
        if (L.stats && width === 1440) {
          ok(classic0.datasheets && r.datasheets === classic0.datasheets,
            `${layout}: the datasheet stat is the same live count Classic shows (decision 50)`, `${r.datasheets} vs Classic ${classic0.datasheets}`);
        }
        if (layout === 'bold' && width >= 1024) {
          const c = r.copy, p = r.photo;
          const hit = c && p && !(c.r <= p.l || c.l >= p.r || c.b <= p.t || c.t >= p.b);
          ok(c && p && r.photoAbs === 'absolute' && !hit,
            `bold ${width}: no hero text is painted over the photograph (PLAN-7)`, JSON.stringify({ copy: c, photo: p }));
        }
        if (layout === 'light' && width === 1440) {
          ok(r.cardBg === 'rgb(255, 255, 255)', 'light: the hero copy sits on an opaque white card, not on the photograph', String(r.cardBg));
          ok(r.tileImgs === features && r.tileLoaded === features,
            `light: every shipped card shows its photo (${features} tiles, all loaded)`, `${r.tileLoaded}/${r.tileImgs} of ${features}`);
        }
        await page.close();
      }
      // 9 (audit 2026-10-17) — the homepage is outside the catalog gate. With
      // the catalog fetch blocked, a catalog-driven layout must not print a
      // count it does not have ("0 products across 0 families" shipped).
      if (L.families || L.featured) {
        const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
        await page.route('**/data/products-all.json*', (rt) => rt.abort());
        await page.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        const z = await page.evaluate((root) => {
          const t = (document.querySelector(root) || {}).innerText || '';
          return { here: !!document.querySelector(root), zero: t.match(/\b0 (products?|datasheets?|PDFs?|famil\w+)\b|All 0\b/gi) || [] };
        }, L.root);
        ok(z.here && z.zero.length === 0, `${layout}: with the catalog unavailable, no "0 products" style count is shown (decision 50)`, z.zero.join(' | '));
        await page.close();
      }
      for (const [name, patch] of Object.entries(PALETTES)) {
        writeTheme(base, patch || {});
        for (const width of [390, 1440]) {
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
          await page.waitForTimeout(300);
          const s = await page.evaluate(SCORE, L.root);
          ok(s.scored > 60 && s.bad.length === 0,
            `${layout} — ${name} @${width}: every text element meets WCAG AA (${s.scored} scored)`, s.bad.slice(0, 6).join(' | '));
          await page.close();
        }
      }
      fs.writeFileSync(SITE_INFO, base);
    }

    // ── 6b. the industry layouts' links into the Product Index ───────────
    writeTheme(originalSite, { homeLayout: 'distributor' });
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
      await page.fill('#home-search', 'IP33TW');
      await page.press('#home-search', 'Enter');
      await page.waitForURL(/\/dashboard/, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      const s = await page.evaluate(() => ({
        path: location.pathname, search: location.search,
        boxes: [...document.querySelectorAll('input[placeholder^="Part ID"]')].map((i) => i.value),
        hit: /IP33TW/.test(document.body.innerText),
      }));
      ok(s.path === '/dashboard' && !/q=/.test(s.search) && s.boxes.includes('IP33TW') && s.hit,
        'distributor: a part-number search opens the Product Index already searched, and the URL is cleaned', JSON.stringify(s));
      await page.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
      const badge = await page.$('.ipcd-badge');
      const name = badge ? await badge.evaluate((b) => b.firstChild.textContent.trim()) : null;
      if (badge) await badge.click();
      await page.waitForTimeout(800);
      const a = await page.evaluate((n) => ({
        path: location.pathname, search: location.search,
        pressed: n ? !!document.querySelector(`button[data-ipc-approval="${n}"][aria-pressed="true"]`) : false,
      }), name);
      ok(name && a.path === '/dashboard' && !/approval=/.test(a.search) && a.pressed,
        `distributor: the "${name}" approval badge opens the Product Index filtered to it, and the URL is cleaned`, JSON.stringify(a));
      await page.close();
    }
    writeTheme(originalSite, { homeLayout: 'sidebar' });
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
      const links = await page.evaluate(() => [...document.querySelectorAll('.ipcs-card')].map((c) => ({
        details: (c.querySelector('a:not(.ipcs-pdf)') || {}).getAttribute ? c.querySelector('a:not(.ipcs-pdf)').getAttribute('href') : null,
        pdf: c.querySelector('a.ipcs-pdf') ? c.querySelector('a.ipcs-pdf').getAttribute('href') : null,
      })));
      const statuses = [];
      for (const l of links) if (l.pdf) statuses.push((await page.request.get(BASE + l.pdf)).status());
      ok(links.length > 0 && links.every((l) => /^\/products\?productId=/.test(l.details || '') && /^\/pdfs\//.test(l.pdf || '')) && statuses.every((s) => s === 200),
        `sidebar: each featured card links to its product page and a data sheet that answers 200 (${links.length} cards)`, JSON.stringify({ links, statuses }));
      await page.close();
    }

    // ── 7b–d. Light card photos through Page Content ─────────────────────
    writeTheme(originalSite, { homeLayout: 'light' });
    await adm.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
    const prefilled = await adm.evaluate(() =>
      [...document.querySelectorAll('input[name^="features["][name$="[photo]"]')].map((i) => i.value));
    const expectPrefill = (content.features || []).map((f) => (f.photo !== undefined ? f.photo : phpMap[f.iconKey] || ''));
    ok(JSON.stringify(prefilled) === JSON.stringify(expectPrefill),
      'Page Content prefills each card\'s Photo box with the picture the site shows for it', JSON.stringify(prefilled));
    const saveContent = async () => {
      await adm.getByRole('button', { name: 'Save Content' }).first().click();
      await adm.waitForLoadState('domcontentloaded');
    };
    // An unsafe path is refused.
    await adm.fill('input[name="features[0][photo]"]', 'javascript:alert(1)');
    await saveContent();
    const errShown = await adm.evaluate(() => /Photo box on the/.test(document.body.innerText));
    ok(errShown && fs.readFileSync(CONTENT, 'utf8') === originalContent,
      'an unsafe Photo path is refused, naming the card, and content.json is not written', `error shown ${errShown}`);
    // An emptied box saves "" and the tile shows its icon.
    await adm.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
    await adm.fill('input[name="features[0][photo]"]', '');
    await saveContent();
    const savedC = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
    await pub.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
    const first = await pub.evaluate(() => {
      const t = document.querySelector('.ipcl-tile');
      return t ? { img: !!t.querySelector('img'), icon: !!t.querySelector('.ipcl-tile-icon') } : null;
    });
    ok(savedC.features && savedC.features[0].photo === '' && first && !first.img && first.icon,
      'an emptied Photo box saves "" and that tile shows its icon instead of a photo',
      JSON.stringify({ stored: savedC.features && savedC.features[0].photo, first }));
    fs.writeFileSync(CONTENT, originalContent);

    // ── 10. every layout is edited on Page Content, and its marks are true ─
    // For each layout: a marker is typed into every homepage box through the
    // real form and saved; the homepage must show exactly the boxes
    // content.php's HOME_LAYOUT_USES says that layout shows, and Page Content
    // must mark exactly the others "Not shown by your current homepage layout".
    const usesBlock = /const HOME_LAYOUT_USES = \[([\s\S]*?)\n\];/.exec(php);
    const USES = {};
    for (const m of (usesBlock ? usesBlock[1] : '').matchAll(/'([\w.]+)'\s*=>\s*\[([^\]]*)\]/g)) {
      USES[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]);
    }
    ok(Object.keys(USES).length > 30, `content.php HOME_LAYOUT_USES parsed (${Object.keys(USES).length} boxes)`);
    // Boxes every layout shows, so the map leaves them out.
    for (const k of ['hero.badge', 'hero.headlineLine1', 'hero.headlineLine3']) USES[k] = ALL_LAYOUTS;
    const LIST_BOX = { features: 'features[0][title]', stats: 'stats[0][label]', markets: 'markets[0][label]', heroProofPoints: 'heroProofPoints[0][label]', heroTrust: 'heroTrust[0][text]' };
    const PHOTO = { heroPhoto: 'featured-category-1.jpg', bandTeamPhoto: 'featured-category-2.jpg', bandBuildingPhoto: 'featured-category-3.jpg', boldHeroPhoto: 'main-banner-1349x414.jpg', boldFeaturePhoto: 'spiralwrap-1.jpg' };
    const boxName = (k) => LIST_BOX[k] || `copy[${k.split('.')[0]}][${k.split('.')[1]}]`;
    const keys = Object.keys(USES).filter((k) => !/Page$/.test(k)); // page selects carry no text
    const token = (k) => ('zq' + k.replace(/\W/g, '') + 'zq').toLowerCase();
    // A copy box whose key the stored content.json does not have shows the
    // site's built-in text, never an empty box (boldSubhead shipped empty
    // while three layouts printed its default — audit 2026-10-17).
    {
      fs.writeFileSync(CONTENT, originalContent);
      await adm.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
      const absent = keys.filter((k) => !LIST_BOX[k] && (((content.copy || {})[k.split('.')[0]] || {})[k.split('.')[1]]) === undefined);
      const vals = await adm.evaluate((names) => names.map((n) => (document.querySelector(`[name="${n}"]`) || {}).value), absent.map(boxName));
      const empty = absent.filter((k, i) => !vals[i]);
      ok(absent.length > 0 && empty.length === 0, `Page Content prefills every homepage box not yet stored (${absent.length}) with the text the site shows`, empty.join(', '));
    }
    for (const layout of ALL_LAYOUTS) {
      fs.writeFileSync(CONTENT, originalContent);
      writeTheme(originalSite, { homeLayout: layout });
      await adm.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
      const marks = await adm.evaluate(({ keys, names, lists }) => Object.fromEntries(keys.map((k) => {
        if (lists.includes(k)) return [k, !!document.querySelector(`fieldset[data-section="${k}"] > .layout-off`)];
        const box = document.querySelector(`[name="${names[k]}"]`);
        return [k, box ? !!box.closest('.form-group').querySelector('.layout-off') : 'missing'];
      })), { keys, names: Object.fromEntries(keys.map((k) => [k, boxName(k)])), lists: Object.keys(LIST_BOX) });
      const wrongMarks = keys.filter((k) => marks[k] !== !USES[k].includes(layout));
      ok(wrongMarks.length === 0, `${layout}: Page Content marks exactly the homepage boxes this layout does not show`,
        wrongMarks.map((k) => `${k}=${marks[k]}`).join(', '));
      for (const k of keys) {
        const v = k.startsWith('siteImages.') ? `images/site/${PHOTO[k.split('.')[1]]}` : token(k);
        await adm.fill(`[name="${boxName(k)}"]`, v);
      }
      await saveContent();
      const savedNow = fs.readFileSync(CONTENT, 'utf8');
      ok(keys.filter((k) => !k.startsWith('siteImages.')).every((k) => savedNow.includes(token(k))),
        `${layout}: every homepage box saved through Page Content`, savedNow === originalContent ? 'content.json not written' : '');
      await pub.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
      await pub.evaluate(async () => { for (let y = 0; y < 6000; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } });
      const seen = await pub.evaluate(() => ({ text: document.body.innerText.toLowerCase(), imgs: [...document.querySelectorAll('img')].map((i) => i.getAttribute('src') || '') }));
      const wrongSite = keys.filter((k) => {
        const shown = k.startsWith('siteImages.')
          ? seen.imgs.some((s) => s.endsWith('/' + PHOTO[k.split('.')[1]]))
          : seen.text.includes(token(k));
        return shown !== USES[k].includes(layout);
      });
      ok(wrongSite.length === 0, `${layout}: the homepage shows every edited box this layout uses (${keys.filter((k) => USES[k].includes(layout)).length}) and none it does not`,
        wrongSite.map((k) => `${k} ${USES[k].includes(layout) ? 'expected, missing' : 'not expected, shown'}`).join(', '));
    }
    fs.writeFileSync(CONTENT, originalContent);
    // The defaults Page Content prefills for the new headings are the ones the site shows.
    const jsHl = /homeLayouts: \{([\s\S]*?)\n  \},/.exec(js);
    const jsMapHl = Object.fromEntries([...(jsHl ? jsHl[1] : '').matchAll(/(\w+): "([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const phpMapHl = Object.fromEntries([...php.matchAll(/\['key' => '(\w+)',\s*'type' => 'text', 'label' => '(?:Distributor catalog|Corporate|Classic distributor)[^']*',\s*'default' => '([^']*)'/g)].map((m) => [m[1], m[2]]));
    ok(Object.keys(jsMapHl).length === 17 && JSON.stringify(jsMapHl) === JSON.stringify(phpMapHl),
      'the homeLayouts headings default to the same 17 values in content.php and App.jsx', JSON.stringify({ js: jsMapHl, php: phpMapHl }));
    const jsBs = (/boldSubhead:\s*"([^"]*)"/.exec(js) || [])[1];
    const phpBs = (/'key' => 'boldSubhead'[\s\S]*?'default' => '([^']*)'/.exec(php) || [])[1];
    ok(jsBs && jsBs === phpBs, 'the short sub-headline box prefills the same sentence the site shows by default', JSON.stringify({ js: jsBs, php: phpBs }));

    // ── 8. back to Classic ───────────────────────────────────────────────
    await choose('classic');
    await pub.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
    const classic1 = await pub.evaluate(() => !document.querySelector('.ipcb, .ipcl') && !!document.querySelector('#ipc-sec-heroProofPoints'));
    ok(classic1, 'switching back to Classic in Business Details renders Classic again');
  } finally {
    await browser.close();
    fs.writeFileSync(SITE_INFO, originalSite);
    fs.writeFileSync(CONTENT, originalContent);
  }
  ok(fs.readFileSync(SITE_INFO, 'utf8') === originalSite && fs.readFileSync(CONTENT, 'utf8') === originalContent,
    'site-info.json and content.json restored byte for byte');
  console.log(`\nhomelayout ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
