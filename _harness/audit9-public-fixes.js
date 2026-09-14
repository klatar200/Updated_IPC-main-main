/**
 * Audit 9 — acceptance suite for the public-site fixes.
 *
 * Nine arms, one per accepted finding. Written BEFORE the fixes and watched
 * failing against unfixed code (GUARDRAILS §4.4); the "before" run is at
 * _harness/out/audit9/C/public-fixes-BEFORE.txt.
 *
 *   p4-6   the About page writes the street as "Dr", like every other rendering
 *   p4-7   Organization JSON-LD logo follows theme.logoUrl
 *   p4-9   Product JSON-LD carries an absolute `image` (the code half only —
 *          the `offers` half is escalated, not fixed)
 *   p5a-6  one visible name per destination on a product page
 *   p5a-7  the hardcoded "data sheet" strings the record names are one word
 *   p5a-10 every "View Product" link carries a distinct accessible name
 *   p6-1   product <title> ≤ 60 chars AND still contains the SKU
 *   p6-2   product meta description within 50–160, cut on a word boundary
 *   p6-3   /dashboard's eyebrow is not a copy of its own <h1>
 *
 * Needs the mirror on :8123 (bash _harness/sync.sh first — the arms that read
 * the rendered page read the BUILT bundle, not src/).
 *
 * Usage: node _harness/audit9-public-fixes.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = process.env.IPC_BASE || 'http://127.0.0.1:8123';
const ORIGIN = 'https://www.insulationproducts.com';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'audit9', 'C');

const SRC = fs.readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf8');
const products = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'products-all.json'), 'utf8')
);
const siteInfo = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'site-info.json'), 'utf8')
);

const TITLE_CAP = 60;
const DESC_MIN = 50;
const DESC_MAX = 160;

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// Everything the head arms need, read once per page.
const READ_HEAD = () => {
  const q = (s) => document.querySelector(s);
  const ldOf = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.text); } catch (e) { return 'PARSE-ERROR'; }
  };
  return {
    title: document.title,
    desc: q('meta[name="description"]') ? q('meta[name="description"]').content : null,
    orgLd: ldOf('org-ld'),
    productLd: ldOf('product-ld'),
    allLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => { try { return JSON.parse(s.text); } catch (e) { return null; } })
      .filter(Boolean),
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const visit = async (url) => {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
  };

  // ── p4-6 — "250 Gibraltar Dr", one spelling ──────────────────────────────
  await visit('/about');
  const aboutDrive = await page.evaluate(() => {
    const body = document.body.innerText;
    const alts = Array.from(document.querySelectorAll('img')).map((i) => i.alt || '');
    return {
      prose: (body.match(/250 Gibraltar [A-Za-z.]+/g) || []),
      alts: alts.filter((a) => /Gibraltar/.test(a)),
    };
  });
  const p46seen = [...aboutDrive.prose, ...aboutDrive.alts];
  note(
    p46seen.length > 0 && p46seen.every((s) => /Gibraltar Dr\b/.test(s) && !/Gibraltar Drive/.test(s)),
    'p4-6: /about writes the street as "Gibraltar Dr" in prose and in every alt',
    JSON.stringify(p46seen)
  );
  note(
    !/250 Gibraltar Drive/.test(SRC),
    'p4-6: no "250 Gibraltar Drive" left anywhere in src/App.jsx',
    (SRC.match(/.{0,40}250 Gibraltar Drive.{0,20}/g) || []).slice(0, 3).join(' | ')
  );

  // ── p4-7 — Organization logo follows theme.logoUrl ───────────────────────
  await visit('/');
  const home = await page.evaluate(READ_HEAD);
  const org = home.allLd.find(
    (o) => o && (o['@type'] === 'Organization' || (Array.isArray(o['@type']) && o['@type'].includes('Organization')))
  );
  const wantLogo = ORIGIN + (siteInfo.theme && siteInfo.theme.logoUrl ? siteInfo.theme.logoUrl : '/logo.svg');
  note(
    !!org && org.logo === wantLogo,
    'p4-7: Organization JSON-LD logo is the owner-editable theme.logoUrl, made absolute',
    JSON.stringify({ got: org && org.logo, want: wantLogo })
  );

  // ── p4-9 / p6-1 / p6-2 — every product page's head ───────────────────────
  const noImage = [], titleLong = [], titleNoSku = [], descLong = [], descShort = [], descCut = [];
  for (const p of products) {
    await visit('/products?productId=' + encodeURIComponent(p.id));
    const r = await page.evaluate(READ_HEAD);
    const pld = r.productLd && r.productLd !== 'PARSE-ERROR' ? r.productLd : null;

    const realPhoto = p.photoUrl && !String(p.photoUrl).includes('placehold.co');
    if (realPhoto) {
      const want = ORIGIN + p.photoUrl;
      if (!pld || pld.image !== want) noImage.push(`${p.id}: image ${pld && pld.image} != ${want}`);
    } else if (pld && 'image' in pld) {
      noImage.push(`${p.id}: placeholder photo must NOT be asserted as image (${pld.image})`);
    }

    const t = r.title || '';
    if (t.length > TITLE_CAP) titleLong.push(`${p.id}: ${t.length}`);
    const sku = (p.sku || p.id || '').trim();
    if (sku && !t.toUpperCase().includes(sku.toUpperCase())) titleNoSku.push(`${p.id}: ${JSON.stringify(t)}`);

    const d = r.desc || '';
    if (d.length > DESC_MAX) descLong.push(`${p.id}: ${d.length}`);
    if (d.length < DESC_MIN) descShort.push(`${p.id}: ${d.length}`);
    // A bare .slice() leaves a dangling partial word or a trailing separator.
    // The observed defect is a description ending "…, 3000psi, " — a separator
    // with nothing after it. A closing measurement mark (4', 48") is a complete
    // token and must NOT be flagged, or the arm fails on correct output.
    if (/[\s,;:—–-]$/.test(d)) {
      descCut.push(`${p.id}: ends ${JSON.stringify(d.slice(-14))}`);
    }
  }
  note(noImage.length === 0,
    `p4-9: all ${products.length} Product blocks carry an absolute image for a real photo, and none for a placeholder`,
    noImage.slice(0, 3).join(' | '));
  note(titleLong.length === 0,
    `p6-1: all ${products.length} product titles are ≤ ${TITLE_CAP} chars`,
    `${titleLong.length} over: ` + titleLong.slice(0, 4).join(' | '));
  note(titleNoSku.length === 0,
    `p6-1: all ${products.length} product titles still contain the SKU after the cap`,
    titleNoSku.slice(0, 3).join(' | '));
  note(descLong.length === 0,
    `p6-2: all ${products.length} product descriptions are ≤ ${DESC_MAX} chars`,
    `${descLong.length} over: ` + descLong.slice(0, 4).join(' | '));
  note(descShort.length === 0,
    `p6-2: all ${products.length} product descriptions are ≥ ${DESC_MIN} chars`,
    descShort.slice(0, 3).join(' | '));
  note(descCut.length === 0,
    'p6-2: no description ends on a dangling separator or partial clause',
    descCut.slice(0, 3).join(' | '));

  // ── p5a-6 — one visible name per destination on a product page ───────────
  const sample = ['IP35KY', 'CC', 'IP30UV'];
  const badNames = [];
  for (const id of sample) {
    await visit('/products?productId=' + encodeURIComponent(id));
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        // The visible half only: the "(opens in a new tab)" sr-only span is
        // deliberate and correct, and the arrow glyph is decoration.
        text: (a.textContent || '')
          .replace(/\(opens in a new tab\)/g, '')
          .replace(/[→›»]/g, '')
          .replace(/\s+/g, ' ')
          .trim(),
        href: a.getAttribute('href'),
      }))
    );
    // Scoped to the two destinations the record names. The navbar brand and
    // the "Home" nav link both point at "/" under two names by design, and the
    // product self-link is truncated to two different widths by CSS in the
    // breadcrumb and the header — neither is this finding, and including them
    // would make the arm fail forever on things nobody intends to change.
    const inScope = (h) => /^\/pdfs\//.test(h) || /^\/contact\?part=/.test(h);
    const byHref = {};
    for (const l of links) {
      if (!l.href || !inScope(l.href)) continue;
      (byHref[l.href] = byHref[l.href] || new Set()).add(l.text);
    }
    for (const [href, names] of Object.entries(byHref)) {
      if (names.size > 1) badNames.push(`${id} ${href}: ${JSON.stringify([...names])}`);
    }
  }
  note(badNames.length === 0,
    `p5a-6: on ${sample.length} product pages no destination is offered under two different visible names`,
    badNames.slice(0, 4).join(' | '));

  // ── p5a-7 — the hardcoded two-word strings the record names ──────────────
  const seoBlock = (SRC.match(/const SEO_DEFAULT = \[[\s\S]*?\n\];/) || [''])[0];
  note(
    seoBlock.length > 0 && !/data sheets/i.test(seoBlock),
    'p5a-7: SEO_DEFAULT carries no two-word "data sheets"',
    (seoBlock.match(/.{0,50}data sheets.{0,20}/gi) || []).join(' | ')
  );
  await visit('/dashboard');
  const dashIntro = await page.evaluate(() => {
    const h = document.querySelector('.ipc-page-header');
    return h ? h.innerText.replace(/\s+/g, ' ').trim() : '';
  });
  note(
    /datasheets/i.test(dashIntro) && !/data sheets/i.test(dashIntro),
    'p5a-7: /dashboard\'s intro says "datasheets", one word',
    JSON.stringify(dashIntro.slice(-90))
  );

  // ── p6-3 — the eyebrow is not a copy of the h1 ───────────────────────────
  const dash = await page.evaluate(() => {
    const hdr = document.querySelector('.ipc-page-header');
    if (!hdr) return null;
    const h1 = hdr.querySelector('h1');
    // The eyebrow is the first element in the header block, above the h1.
    const kids = Array.from(hdr.querySelectorAll('div, p, span'));
    const eyebrow = kids.find(
      (el) => el.children.length === 0 && (el.textContent || '').trim() && el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING
    );
    return {
      eyebrow: eyebrow ? eyebrow.textContent.trim() : null,
      h1: h1 ? h1.textContent.trim() : null,
    };
  });
  note(
    !!dash && !!dash.eyebrow && !!dash.h1 &&
      dash.eyebrow.toLowerCase() !== dash.h1.toLowerCase(),
    'p6-3: /dashboard\'s eyebrow is a category label, not a repeat of its own h1',
    JSON.stringify(dash)
  );

  // ── p5a-10 — every "View Product" link has a distinct accessible name ────
  const vp = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .filter((a) => /View Product/.test(a.textContent || ''))
      .map((a) => ({ href: a.getAttribute('href'), label: a.getAttribute('aria-label') }))
  );
  const unlabelled = vp.filter((l) => !l.label);
  const labels = new Set(vp.map((l) => l.label));
  note(vp.length > 0 && unlabelled.length === 0,
    `p5a-10: all ${vp.length} "View Product" links carry an aria-label`,
    `${unlabelled.length} without: ` + JSON.stringify(unlabelled.slice(0, 3)));
  note(vp.length > 0 && labels.size === new Set(vp.map((l) => l.href)).size,
    'p5a-10: the accessible names are as distinct as the destinations',
    JSON.stringify({ labels: labels.size, hrefs: new Set(vp.map((l) => l.href)).size }));

  await ctx.close();
  await browser.close();

  const pass = results.filter((x) => x.ok).length;
  console.log(`\naudit9-public-fixes ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'public-fixes.json'), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})();
