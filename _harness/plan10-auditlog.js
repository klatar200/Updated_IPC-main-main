/**
 * PLAN-10 item 8 / AUDIT-10 A10-027 — the audit log must record WHICH page was
 * edited.
 *
 * The defect: admin/content.php logged
 *   audit_log('content', 'homepage', 'Homepage content updated')
 * — three string literals — on a form that renders 99 textareas and 446 posted
 * fields covering Homepage, Services, Industries, About, FAQ, Contact,
 * Privacy, SEO, navigation, footer and the product families. Editing the
 * Privacy page's eyebrow produced a row byte-identical to a homepage edit, so
 * the audit log could not answer the only question it exists for.
 *
 * This suite MUTATES real content, so it:
 *   - snapshots _harness/site/data/content.json before it starts,
 *   - restores it from _harness/pristine/ at the end, in a finally block, and
 *   - verifies the restore byte-for-byte before reporting.
 * A suite that leaves the mirror dirty poisons every later run.
 *
 * Saving is done by loading /admin/content.php, editing ONE field in the real
 * form and submitting the real form — not by POSTing a hand-built body. The
 * form carries 446 fields and an optimistic-concurrency signature, and a
 * hand-built POST would either trip the form_complete truncation guard or
 * silently save a stripped document. pass-7 also recorded that the first
 * button[type=submit] on this page is NOT Save Content, so the submit is
 * driven by the button's accessible name.
 *
 * Usage: node _harness/plan10-auditlog.js       (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'plan10');
const MIRROR = path.join(__dirname, 'site', 'data', 'content.json');
const PRISTINE = path.join(__dirname, 'pristine', 'content.json');
const LOG = path.join(__dirname, 'site', 'admin', 'admin-log.jsonl');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `\n         <- ${detail}` : ''}`);
}

async function signIn(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  return page;
}

function tailLog(n = 1) {
  if (!fs.existsSync(LOG)) return [];
  const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-n).map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
}

// Edit `count` fields by their POST name prefix, then submit Save Content.
async function saveWith(page, edits) {
  await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'networkidle' });
  const applied = [];
  for (const { selector, value } of edits) {
    const el = page.locator(selector).first();
    if (!(await el.count())) { applied.push(`${selector}: NOT FOUND`); continue; }
    await el.fill(value);
    applied.push(`${selector} = ${JSON.stringify(value.slice(0, 24))}`);
  }
  // "Save Content" by accessible name — the FIRST button[type=submit] on this
  // page is something else (pass-7's own false negative).
  const save = page.getByRole('button', { name: /save content/i }).first();
  await Promise.all([
    page.waitForURL(/content\.php\?saved=1/, { timeout: 20000 }).catch(() => {}),
    save.click(),
  ]);
  await page.waitForTimeout(400);
  return applied;
}

(async () => {
  const before = fs.readFileSync(MIRROR);
  const browser = await launch();
  let ctx;
  try {
    ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await signIn(ctx);
    const rows = {};

    // Field selectors, taken from the rendered form's real POST names.
    const PRIVACY = 'textarea[name="copy[privacyHeader][eyebrow]"], input[name="copy[privacyHeader][eyebrow]"]';
    const HERO = 'textarea[name="copy[hero][headlineLine1]"], input[name="copy[hero][headlineLine1]"]';
    // SEO is a repeatable $SECTIONS entry, not a $COPY_GROUPS one, so its POST
    // name is seo[0][title] — copy[seoHome][title] does not exist and matched
    // nothing, which made the "two sections" case silently a one-section case.
    const SEO = 'textarea[name="seo[0][title]"], input[name="seo[0][title]"]';

    // ── 0. A SETTLING save, before any assertion ──────────────────────────
    // The stored content.json predates fields the form now renders (PLAN-9
    // item 1 documents this for siteImages), so the FIRST save of anything
    // legitimately materialises those defaults and the diff correctly reports
    // 6 changed sections. That is the code being right, not wrong — but it
    // means "edit only Privacy" is not a single-section save until the file
    // and the form agree. One no-op save reconciles them; every assertion
    // below is made against a settled file.
    const settle = await saveWith(page, []);
    rows.settle = { applied: settle, log: tailLog(1)[0] };

    // ── 1. Privacy only ───────────────────────────────────────────────────
    rows.privacy = { applied: await saveWith(page, [{ selector: PRIVACY, value: 'Privacy Notice A10-027' }]) };
    rows.privacy.log = tailLog(1)[0];

    // ── 2. Homepage hero only ─────────────────────────────────────────────
    rows.hero = { applied: await saveWith(page, [{ selector: HERO, value: '25 Million Feet A10-027' }]) };
    rows.hero.log = tailLog(1)[0];

    // ── 3. Two sections at once ───────────────────────────────────────────
    rows.two = {
      applied: await saveWith(page, [
        { selector: PRIVACY, value: 'Privacy Notice A10-027 two' },
        { selector: SEO, value: 'IPC A10-027 two' },
      ]),
    };
    rows.two.log = tailLog(1)[0];

    // ── 4. No change at all ───────────────────────────────────────────────
    rows.noop = { applied: await saveWith(page, []) };
    rows.noop.log = tailLog(1)[0];

    fs.writeFileSync(path.join(OUT, 'auditlog.json'), JSON.stringify(rows, null, 2));

    const d = (k) => String((rows[k].log || {}).details ?? (rows[k].log || {}).detail ?? (rows[k].log || {}).raw ?? '');
    const sku = (k) => String((rows[k].log || {}).sku ?? '');
    const act = (k) => String((rows[k].log || {}).action ?? '');

    // The settling save is setup, not a case under test.
    const CASES = ['privacy', 'hero', 'two', 'noop'];
    note(CASES.every((k) => rows[k].log),
      'each of the four saves wrote an audit-log row',
      CASES.filter((k) => !rows[k].log).join(', '));

    note(CASES.every((k) => act(k) === 'content'),
      `the action column is still "content" on all four rows (${CASES.map(act).join(', ')})`);

    // ── acceptance 1 — Privacy names Privacy, and not "Homepage" ──────────
    note(/privacy/i.test(d('privacy')) && !/homepage/i.test(d('privacy')),
      `a Privacy-only edit names the Privacy section and does not say "Homepage" — ${JSON.stringify(d('privacy'))}`,
      `was "Homepage content updated"`);
    note(sku('privacy') === 'privacyHeader',
      `its SKU column is the changed group key, not the literal "homepage" (${JSON.stringify(sku('privacy'))})`);

    // ── acceptance 2 — Homepage hero names the hero ───────────────────────
    note(/homepage/i.test(d('hero')) && /hero/i.test(d('hero')),
      `a Homepage-hero edit names the Homepage hero — ${JSON.stringify(d('hero'))}`);
    note(sku('hero') === 'hero', `its SKU column is "hero" (${JSON.stringify(sku('hero'))})`);

    // ── acceptance 3 — two sections name both ─────────────────────────────
    note(/privacy/i.test(d('two')) && /seo|search engine/i.test(d('two')),
      `an edit spanning two sections names both — ${JSON.stringify(d('two'))}`);
    note(sku('two') === 'multiple',
      `its SKU column is "multiple" (${JSON.stringify(sku('two'))})`);

    // ── acceptance 4 — a no-op save still logs, without claiming a change ──
    note(!!rows.noop.log && !/updated:/i.test(d('noop')),
      `a save with no change still logs, and does not claim a section changed — ${JSON.stringify(d('noop'))}`);

    // ── acceptance 5 — no entity-escaped text anywhere in the details ─────
    // 'Products &amp; Services Cards' is stored pre-escaped (A10-039, out of
    // scope); the log must not repeat it. Exercised by editing that section.
    const FEATURE = 'textarea[name="features[0][title]"], input[name="features[0][title]"]';
    rows.amp = { applied: await saveWith(page, [{ selector: FEATURE, value: 'Heat Shrink A10-027' }]) };
    rows.amp.log = tailLog(1)[0];
    fs.writeFileSync(path.join(OUT, 'auditlog.json'), JSON.stringify(rows, null, 2));
    const ampDetail = String((rows.amp.log || {}).details ?? (rows.amp.log || {}).detail ?? '');
    note(/&\s?Services/.test(ampDetail) && !/&amp;/.test(ampDetail),
      `a section whose title is stored pre-escaped logs "&" and not "&amp;" — ${JSON.stringify(ampDetail)}`,
      'html_entity_decode() is applied to the titles before they reach the log line');

    const allDetails = ['privacy', 'hero', 'two', 'noop', 'amp'].map((k) =>
      String((rows[k].log || {}).details ?? (rows[k].log || {}).detail ?? ''));
    note(allDetails.every((s) => !/&amp;|&#\d+;|&quot;|&lt;|&gt;/.test(s)),
      `no entity-escaped text in any of the ${allDetails.length} logged details`,
      allDetails.filter((s) => /&amp;|&#\d+;|&quot;|&lt;|&gt;/.test(s)).join(' | '));

    // ── the page subtitle no longer claims the form edits only the homepage ─
    await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'networkidle' });
    const sub = await page.evaluate(`(() => {
      const p = document.querySelector('p.sub');
      return p ? p.textContent.trim() : null;
    })()`);
    note(!!sub && !/^Edit the homepage sections below/i.test(sub) && /privacy/i.test(sub),
      `the page subtitle describes what the form really edits — ${JSON.stringify((sub || '').slice(0, 90))}`,
      'was "Edit the homepage sections below." on a form that edits every page');
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
    // ── restore the mirror, always ────────────────────────────────────────
    fs.copyFileSync(PRISTINE, MIRROR);
    const nowBuf = fs.readFileSync(MIRROR);
    const pristineBuf = fs.readFileSync(PRISTINE);
    note(nowBuf.equals(pristineBuf),
      `the mirror's content.json was restored from _harness/pristine (${nowBuf.length} bytes)`);
    if (!nowBuf.equals(before)) {
      console.log('  note  the pre-run mirror already differed from pristine; restored to pristine, which is the reference');
    }
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-auditlog ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'auditlog.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
