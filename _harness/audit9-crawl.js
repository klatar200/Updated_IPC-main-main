/**
 * `_harness/audit9-crawl.js` — I-crawl, a PLAN-11 §3.3 shared instrument.
 *
 * Crawls the 10 public routes derived from `src/App.jsx`'s `SEO_DEFAULT`
 * (grep -n "SEO_DEFAULT" src/App.jsx: the array at 6930-6939, and
 * `KNOWN_ROUTES = new Set(SEO_DEFAULT.map(s => s.page))` at 6959 — home,
 * products, dashboard, datasheets, industries, services, about, faq, contact,
 * privacy; `pageToPath()` maps "home" -> "/" and everything else to "/<page>"),
 * one unknown route (/no-such-page), all 42 product pages
 * (/products?productId=<sku>, one per sku in data/products-all.json), and the
 * 13 admin pages signed in plus auth.php signed out. Public/product routes run
 * at 390x844, 834x1194, 1440x900, 1920x1080, 2560x1440; admin at 390x844 and
 * 1440x900 only.
 *
 * INSTRUMENT, not a suite: never fails on a finding. Exits 1 only if the base
 * URL never answered at all; a single page that could not be reached is
 * recorded and printed, and the run still exits 0.
 *
 * Determinism (GUARDRAILS §7.1 C49 / PLAN-11 §3.3):
 *  - fixed viewport list, no `system-ui` reliance (DejaVu Sans on this image).
 *  - font forced via injected CSS: `* { font-family: "Liberation Sans", Arial,
 *    sans-serif !important }`, after every navigation.
 *  - animations disabled deterministically via CSS injection (transition/
 *    animation: none !important) rather than relying on prefers-reduced-motion
 *    alone (plan8-motion.js: a media query carries no specificity of its own).
 *    Context is created with reducedMotion:'no-preference' (reduced-motion
 *    OFF) so the CSS injection is doing all of the work.
 *  - settle: `waitUntil:'networkidle'`, then (catalog-needing routes only —
 *    which is every public/product route, since `needsCatalog && loading`
 *    gates ALL routes behind one global skeleton, src/App.jsx ~13045-13120)
 *    wait for `.ipc-skeleton` to detach (no-op if never mounted), then a fixed
 *    300ms paint settle. Documented here; nothing else is timing-sensitive.
 *
 * `page.accessibility.snapshot()` is REMOVED in the installed Playwright
 * (1.62.1 — confirmed `undefined` on a live Page by direct probe). This uses
 * `page.locator('body').ariaSnapshot()` instead, and records
 * `ariaSnapshotMethod` on every record so a consumer never assumes otherwise.
 *
 * Usage: node _harness/audit9-crawl.js   (env: BASE_URL, OUT)
 * Serve the mirror first (from the repo root):
 *   cp -r _harness/site _harness/out/audit9/site-Icrawl
 *   nohup setsid php -S 127.0.0.1:8147 -t _harness/out/audit9/site-Icrawl \
 *     -c _harness/php-mail.ini _harness/router.php \
 *     > _harness/out/audit9/servers/8147.log 2>&1 < /dev/null &
 *
 * Writes only under OUT (default `_harness/out/audit9/I-crawl/`, gitignored).
 * One request at a time — no parallel pages against the php -S mirror.
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8147').replace(/\/+$/, '');
const OUT = process.env.OUT || path.join(__dirname, 'out', 'audit9', 'I-crawl');
const ADMIN_PASSWORD = 'audit-pass-123'; // never written into any output file

const FORCE_CSS =
  '* { font-family: "Liberation Sans", Arial, sans-serif !important }\n' +
  '*, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }';

// ── Viewports ─────────────────────────────────────────────────────────────
const VP_MOBILE = { width: 390, height: 844, slug: '390x844', mobile: true };
const VP_TABLET = { width: 834, height: 1194, slug: '834x1194', mobile: true };
const VP_DESK = { width: 1440, height: 900, slug: '1440x900', mobile: false };
const VP_WIDE = { width: 1920, height: 1080, slug: '1920x1080', mobile: false };
const VP_ULTRA = { width: 2560, height: 1440, slug: '2560x1440', mobile: false };
const PUBLIC_VIEWPORTS = [VP_MOBILE, VP_TABLET, VP_DESK, VP_WIDE, VP_ULTRA];
const ADMIN_VIEWPORTS = [VP_MOBILE, VP_DESK];

// ── Routes — derived from SEO_DEFAULT (src/App.jsx:6930-6959); hardcoded so
// the instrument itself stays deterministic even if the app is mid-edit.
const KNOWN_ROUTES = [
  'home', 'products', 'dashboard', 'datasheets', 'industries',
  'services', 'about', 'faq', 'contact', 'privacy',
];
const routeToPath = (page) => (page === 'home' ? '/' : `/${page}`);
const PUBLIC_PAGES = KNOWN_ROUTES.map((r) => ({ slug: r, url: routeToPath(r), catalog: true }));
PUBLIC_PAGES.push({ slug: 'unknown-route', url: '/no-such-page', catalog: true });

// ── Products — every SKU in data/products-all.json ─────────────────────────
const productsRaw = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'products-all.json'), 'utf8')
);
const PRODUCTS = Array.isArray(productsRaw) ? productsRaw : productsRaw.products || [];
const SKUS = PRODUCTS.map((p) => p.sku).filter(Boolean);
const FIRST_SKU = SKUS[0];
const PRODUCT_PAGES = SKUS.map((sku) => ({
  slug: `product-${sku}`, url: `/products?productId=${encodeURIComponent(sku)}`, catalog: true,
}));

// ── Admin pages — 13 signed-in + auth.php signed out ────────────────────────
const q = encodeURIComponent(FIRST_SKU);
const ADMIN_PAGES = [
  { slug: 'admin-index', url: '/admin/index.php' },
  { slug: 'admin-add', url: '/admin/add.php' },
  { slug: 'admin-edit', url: `/admin/edit.php?sku=${q}` },
  { slug: 'admin-delete', url: `/admin/delete.php?sku=${q}` },
  { slug: 'admin-upload-pdf', url: `/admin/upload-pdf.php?sku=${q}` },
  { slug: 'admin-upload-image', url: `/admin/upload-image.php?sku=${q}` },
  { slug: 'admin-settings', url: '/admin/settings.php' },
  { slug: 'admin-content', url: '/admin/content.php' },
  { slug: 'admin-backups', url: '/admin/backups.php' },
  { slug: 'admin-audit-log', url: '/admin/audit-log.php' },
  { slug: 'admin-inquiries', url: '/admin/inquiries.php' },
  { slug: 'admin-password', url: '/admin/password.php' },
  { slug: 'admin-help', url: '/admin/help.php' },
];
const ADMIN_SIGNED_OUT_PAGE = { slug: 'admin-auth-signedout', url: '/admin/auth.php' };

// ── Extraction run in-page ───────────────────────────────────────────────
function extractInPage() {
  const headingOutline = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((el, i) =>
    headingOutline.push({ tag: el.tagName.toLowerCase(), text: el.textContent.trim(), order: i }));

  const landmarkSel = 'header, main, footer, nav[aria-label], [role="dialog"][aria-modal], dialog[aria-modal]';
  const landmarks = [];
  document.querySelectorAll(landmarkSel).forEach((el, i) => {
    let depth = 0;
    for (let p = el.parentElement; p; p = p.parentElement) if (p.matches && p.matches(landmarkSel)) depth++;
    landmarks.push({
      tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || null,
      ariaLabel: el.getAttribute('aria-label') || null, depth, order: i,
    });
  });

  const meta = {
    title: document.title || null,
    description: (document.querySelector('meta[name="description"]') || {}).content || null,
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
    robots: (document.querySelector('meta[name="robots"]') || {}).content || null,
    og: {},
  };
  document.querySelectorAll('meta[property^="og:"]').forEach((el) => {
    meta.og[el.getAttribute('property')] = el.getAttribute('content');
  });

  const jsonLd = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    const raw = el.textContent || '';
    let parsed = null, error = null;
    try { parsed = JSON.parse(raw); } catch (e) { error = String(e && e.message); }
    jsonLd.push({ raw, parsed, error });
  });

  const images = [];
  document.querySelectorAll('img').forEach((el) => {
    const r = el.getBoundingClientRect();
    images.push({
      src: el.currentSrc || el.src || null,
      alt: el.hasAttribute('alt') ? el.getAttribute('alt') : null,
      naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight,
      renderedWidth: Math.round(r.width), renderedHeight: Math.round(r.height),
      loading: el.getAttribute('loading') || null,
    });
  });

  const links = [];
  document.querySelectorAll('a').forEach((el) => links.push({
    text: el.textContent.trim(), href: el.getAttribute('href'), ariaLabel: el.getAttribute('aria-label') || null,
  }));

  function labelFor(el) {
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) return lab.textContent.trim();
    }
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const parts = labelledby.split(/\s+/).map((id) => {
        const t = document.getElementById(id);
        return t ? t.textContent.trim() : '';
      }).filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const parentLabel = el.closest('label');
    return parentLabel ? parentLabel.textContent.trim() : null;
  }

  const formControls = [];
  document.querySelectorAll('input, select, textarea, button').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    formControls.push({
      tag, type: el.getAttribute('type') || (tag === 'select' ? 'select' : tag),
      id: el.id || null, name: el.getAttribute('name') || null, labelText: labelFor(el),
      placeholder: el.getAttribute('placeholder') || null, required: el.hasAttribute('required'),
    });
  });

  return {
    headingOutline, landmarks, meta, jsonLd, images, links, formControls,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasAdminHeader: !!document.querySelector('.ipc-admin-header'),
  };
}

// ── Per-page crawl ────────────────────────────────────────────────────────
async function crawlPage(page, url, opts) {
  const consoleMsgs = [], failedRequests = [], badResponses = [], requests = [];
  let heroImageRequested = false;

  const onConsole = (msg) => { try { consoleMsgs.push({ type: msg.type(), text: msg.text() }); } catch (e) {} };
  const onReqFailed = (req) => { try { failedRequests.push({ url: req.url(), failure: (req.failure() || {}).errorText || null }); } catch (e) {} };
  const onResponse = (resp) => { try { if (resp.status() >= 400) badResponses.push({ url: resp.url(), status: resp.status() }); } catch (e) {} };
  const onReqFinished = async (req) => {
    let bytes = null;
    try { bytes = (await req.sizes()).responseBodySize; } catch (e) {}
    if (bytes == null) {
      try { const r = await req.response(); const cl = r && r.headers()['content-length']; bytes = cl != null ? Number(cl) : null; } catch (e) {}
    }
    const reqUrl = req.url();
    if (reqUrl.indexOf('Marker-Sample-2.jpg') !== -1) heroImageRequested = true;
    requests.push({ url: reqUrl, resourceType: req.resourceType(), bytes });
  };

  page.on('console', onConsole);
  page.on('requestfailed', onReqFailed);
  page.on('response', onResponse);
  page.on('requestfinished', onReqFinished);

  let status = null, navError = null;
  try {
    const resp = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 });
    status = resp ? resp.status() : null;
  } catch (e) { navError = String(e && e.message); }

  await page.addStyleTag({ content: FORCE_CSS }).catch(() => {});

  // Documented settle: networkidle above, then (catalog routes) the global
  // skeleton detaching (or never mounting), then a fixed 300ms paint settle.
  let settleNote = 'networkidle, then 300ms fixed settle';
  if (opts.catalog) {
    await page.waitForSelector('.ipc-skeleton', { state: 'detached', timeout: 15000 }).catch(() => {});
    settleNote = 'networkidle, then .ipc-skeleton detached (or never mounted), then 300ms fixed settle';
  }
  await page.waitForTimeout(300);

  let extracted = {};
  try { extracted = await page.evaluate(extractInPage); } catch (e) { extracted = { evalError: String(e && e.message) }; }

  let ariaSnapshot = null, ariaSnapshotError = null;
  try { ariaSnapshot = await page.locator('body').ariaSnapshot(); } catch (e) { ariaSnapshotError = String(e && e.message); }

  const shot = path.join(OUT, opts.dir, `${opts.viewportSlug}.png`);
  let screenshotError = null;
  try { await page.screenshot({ path: shot, fullPage: true }); } catch (e) { screenshotError = String(e && e.message); }

  page.off('console', onConsole);
  page.off('requestfailed', onReqFailed);
  page.off('response', onResponse);
  page.off('requestfinished', onReqFinished);

  return {
    route: url, slug: opts.slug, viewport: opts.viewportSlug, fetchedUrl: BASE + url,
    status, navError, settleNote,
    console: consoleMsgs, failedRequests, responsesAtLeast400: badResponses, requests, heroImageRequested,
    headingOutline: extracted.headingOutline || [], landmarks: extracted.landmarks || [],
    meta: extracted.meta || {}, jsonLd: extracted.jsonLd || [],
    ariaSnapshot, ariaSnapshotMethod: 'ariaSnapshot (page.accessibility.snapshot removed in playwright 1.62.1)', ariaSnapshotError,
    images: extracted.images || [], links: extracted.links || [], formControls: extracted.formControls || [],
    scrollWidth: extracted.scrollWidth != null ? extracted.scrollWidth : null,
    clientWidth: extracted.clientWidth != null ? extracted.clientWidth : null,
    horizontalOverflow: extracted.scrollWidth != null && extracted.clientWidth != null
      ? extracted.scrollWidth > extracted.clientWidth : null,
    evalError: extracted.evalError || null, screenshotError, screenshot: path.relative(OUT, shot),
    hasAdminHeader: !!extracted.hasAdminHeader,
  };
}

// Sign in — POST admin/auth.php with the csrf token read from the GET form.
// The plain sign-in form (unlike the FTP-unlocked password-reset form) carries
// no csrf_token field and its POST handler never calls csrf_check(), so `csrf`
// below is normally '' — sent anyway per the instruction to read whatever the
// GET form carries; harmless since the endpoint does not require it.
async function adminSignIn(context) {
  const getResp = await context.request.get(BASE + '/admin/auth.php');
  const html = await getResp.text();
  const m = html.match(/name="csrf_token"\s+value="([^"]*)"/);
  await context.request.post(BASE + '/admin/auth.php', { form: { password: ADMIN_PASSWORD, csrf_token: m ? m[1] : '' } });
  return { csrfFoundOnGet: !!m };
}

function summarize(rec) {
  const errs = rec.console.filter((c) => c.type === 'error').length;
  return `${rec.slug.padEnd(20)} @ ${rec.viewport.padEnd(10)} status=${String(rec.status)} ` +
    `console=${rec.console.length}(err ${errs}) failed=${rec.failedRequests.length} ` +
    `>=400=${rec.responsesAtLeast400.length} img=${rec.images.length} links=${rec.links.length} ` +
    `forms=${rec.formControls.length}${rec.navError ? '  NAV-ERROR: ' + rec.navError : ''}`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // Preflight — could this instrument reach the site at all? If not, this is
  // "could not crawl" for the whole run (exit 1), not a finding.
  try {
    if (!(await fetch(BASE + '/').catch(() => null))) throw new Error('fetch returned nothing');
  } catch (e) {
    console.error(`I-crawl: could not reach ${BASE} — ${e && e.message}`);
    process.exitCode = 1;
    return;
  }

  const browser = await launch();
  const index = [];
  const couldNotCrawl = [];
  const totals = { consoleErrors: 0, failedRequests: 0, bad: 0 };
  const slugsCrawled = new Set();
  const viewportsUsed = new Set();

  // One record: crawl `page` in the given already-open `p` Playwright Page,
  // write its JSON + screenshot, fold counts into `totals`/`index`.
  async function doOne(p, pageDef, vp, authNote) {
    slugsCrawled.add(pageDef.slug);
    const dir = path.join(OUT, pageDef.slug);
    fs.mkdirSync(dir, { recursive: true });
    try {
      const rec = await crawlPage(p, pageDef.url, { slug: pageDef.slug, viewportSlug: vp.slug, dir: pageDef.slug, catalog: !!pageDef.catalog });
      if (authNote) {
        rec.signIn = authNote;
        rec.appearsAuthenticated = rec.hasAdminHeader;
      }
      totals.consoleErrors += rec.console.filter((c) => c.type === 'error').length;
      totals.failedRequests += rec.failedRequests.length;
      totals.bad += rec.responsesAtLeast400.length;
      fs.writeFileSync(path.join(dir, `${vp.slug}.json`), JSON.stringify(rec, null, 2));
      index.push({ slug: pageDef.slug, viewport: vp.slug, json: path.relative(OUT, path.join(dir, `${vp.slug}.json`)), screenshot: rec.screenshot });
      console.log('  ' + summarize(rec) + (authNote && !rec.appearsAuthenticated ? '  NOT-AUTHENTICATED' : ''));
    } catch (e) {
      console.log(`  ${pageDef.slug.padEnd(20)} @ ${vp.slug.padEnd(10)} COULD NOT CRAWL: ${e && e.message}`);
      couldNotCrawl.push({ slug: pageDef.slug, viewport: vp.slug, error: String(e && e.message) });
    }
  }

  async function newCtx(vp) {
    return browser.newContext({
      viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1,
      reducedMotion: 'no-preference', ...(vp.mobile ? { hasTouch: true, isMobile: true } : {}),
    });
  }

  // Public + product pages, 5 viewports each.
  const ALL_PUBLIC = [...PUBLIC_PAGES, ...PRODUCT_PAGES];
  for (const vp of PUBLIC_VIEWPORTS) {
    viewportsUsed.add(vp.slug);
    const ctx = await newCtx(vp);
    const page = await ctx.newPage();
    for (const p of ALL_PUBLIC) await doOne(page, p, vp, null);
    await ctx.close();
  }

  // Admin — auth.php signed out, then the 13 signed-in pages. Two viewports.
  for (const vp of ADMIN_VIEWPORTS) {
    viewportsUsed.add(vp.slug);
    const outCtx = await newCtx(vp);
    const outPage = await outCtx.newPage();
    await doOne(outPage, ADMIN_SIGNED_OUT_PAGE, vp, null);
    await outCtx.close();

    const inCtx = await newCtx(vp);
    const signInInfo = await adminSignIn(inCtx);
    const inPage = await inCtx.newPage();
    for (const p of ADMIN_PAGES) await doOne(inPage, p, vp, signInInfo);
    await inCtx.close();
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
    base: BASE, generatedAt: new Date().toISOString(), pages: index, couldNotCrawl,
  }, null, 2));

  console.log(
    `\npages ${slugsCrawled.size} · viewports ${viewportsUsed.size} · ` +
    `console-errors ${totals.consoleErrors} · failed-requests ${totals.failedRequests} · >=400 ${totals.bad}`
  );
  if (couldNotCrawl.length) {
    console.log(`\ncould not crawl (${couldNotCrawl.length}):`);
    for (const c of couldNotCrawl) console.log(`  ${c.slug} @ ${c.viewport}: ${c.error}`);
  }
})();
