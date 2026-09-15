/**
 * The ISO certification claim has ONE source, and changing it there reaches
 * every place it renders.
 *
 * Keagan, 2026-09-15: "The ISO cert should be changeable from the admin
 * dashboard and when altered in the single place in the admin dashboard should
 * waterfall down to all of the locations in the web app."
 *
 * The state this was written against: `site-info.json certifications.iso` is
 * editable in Business Details and is read in exactly ONE place in the whole
 * app (`App.jsx:3699`, the About quality row). Every other ISO string on the
 * site is typed separately — three of them as `ISO 9001:2008`, a revision
 * withdrawn in September 2018 (`audit8.md` A-8.5) — in `content.json` and in
 * `App.jsx`'s own prose. Changing the field in the admin moved one row out of
 * ten.
 *
 * How this proves the waterfall, and why it does it this way:
 *
 *   It writes a SENTINEL revision into the mirror's `site-info.json` — a year
 *   that appears nowhere in the repo — and then reads the rendered pages. A
 *   sentinel is used rather than a real revision so a pass cannot come from a
 *   string that was already on the page. Then:
 *
 *     1. no route shows any REVISION except the sentinel, and
 *     2. `ISO 9001:2008` appears NOWHERE, and
 *     3. the count of ISO strings is unchanged from before the swap — a page
 *        that "passes" by no longer mentioning ISO at all is a failure, and
 *        this is the check that catches it, and
 *     4. with an UNVERSIONED source, no route shows a revision at all — the
 *        A-8.5 safe state, reachable from the admin.
 *
 *   TWO NEGATIVE CONTROLS, and the second one changed this suite after it had
 *   already been run:
 *
 *     `ISO 10993-5` (medical, /industries) must be UNTOUCHED. A rewrite broad
 *     enough to catch `ISO 9001:2008` is broad enough to eat it, and that one
 *     is a real product certification on a real datasheet.
 *
 *     `milestones[2]` — "1990s · Achieved ISO 9001 registration" — must NEVER
 *     gain a revision. The first version of this suite asserted that every ISO
 *     string carries the new value, which would have required stamping today's
 *     revision onto a sentence about the 1990s and turning a true historical
 *     statement into a false one. The specification was wrong, not the code:
 *     the waterfall normalises the REVISION, which is a fact about the
 *     certificate IPC holds now, and leaves the bare standard name alone. This
 *     control is what stops anyone "fixing" that back.
 *
 * It restores the mirror's `site-info.json` byte-for-byte at the end, and
 * compares against `_harness/pristine/` (GUARDRAILS 4.2) so a crashed run
 * cannot leave the mirror dirty for the next suite.
 *
 * Usage: node _harness/isowaterfall.js       (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const MIRROR_SI = path.join(__dirname, 'site', 'data', 'site-info.json');
const PRISTINE_SI = path.join(__dirname, 'pristine', 'site-info.json');
const OUT = path.join(__dirname, 'out', 'isowaterfall');
fs.mkdirSync(OUT, { recursive: true });

// A revision that exists nowhere in this repo, so no assertion below can pass
// on a string that was already there. ISO 9001 has no 2031 edition.
const SENTINEL = 'ISO 9001:2031';

// Every route that renders an ISO string today, plus /industries for the
// ISO 10993-5 negative control.
const ROUTES = ['/', '/about', '/faq', '/services', '/industries', '/contact'];

const ISO9001 = /ISO\s*9001(?::\s*\d{4})?/gi;
const ISO10993 = /ISO\s*10993-5/gi;

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `\n         <- ${detail}` : ''}`);
}

async function readPages(browser) {
  const out = {};
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const r of ROUTES) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle' });
    // The ISO strings live in content that renders after both providers have
    // resolved; networkidle alone has raced here before.
    await page.waitForTimeout(350);
    out[r] = await page.evaluate(() => document.body.innerText);
    await page.close();
  }
  await ctx.close();
  return out;
}

const count = (text, re) => (text.match(re) || []).length;
const hits = (text, re) => [...new Set(text.match(re) || [])];

(async () => {
  const original = fs.readFileSync(MIRROR_SI);
  if (fs.existsSync(PRISTINE_SI)) {
    const pristine = fs.readFileSync(PRISTINE_SI);
    if (!original.equals(pristine)) {
      console.log('  !! mirror site-info.json differs from pristine/ BEFORE this run —');
      console.log('     a previous suite left it dirty. Restoring from pristine first.');
      fs.writeFileSync(MIRROR_SI, pristine);
    }
  }

  const browser = await launch();
  try {
    // ── before ────────────────────────────────────────────────────────────
    const before = await readPages(browser);
    const beforeCounts = {};
    for (const r of ROUTES) beforeCounts[r] = count(before[r], ISO9001);
    const totalBefore = Object.values(beforeCounts).reduce((a, b) => a + b, 0);
    console.log(`  · before: ${totalBefore} ISO 9001 strings across ${ROUTES.length} routes ` +
      `(${ROUTES.map((r) => `${r} ${beforeCounts[r]}`).join(', ')})`);
    note(totalBefore > 0, `the site renders ISO 9001 somewhere at all (${totalBefore})`,
      'nothing to waterfall — the suite would pass vacuously');

    // ── swap the single source ────────────────────────────────────────────
    const si = JSON.parse(original.toString('utf8'));
    si.certifications.iso = SENTINEL;
    fs.writeFileSync(MIRROR_SI, JSON.stringify(si, null, 4));

    const after = await readPages(browser);
    fs.writeFileSync(path.join(OUT, 'after.json'), JSON.stringify(after, null, 1));

    // ── 1. no revision on any route except the one the source names ───────
    for (const r of ROUTES) {
      const stale = hits(after[r], ISO9001)
        .map((h) => h.replace(/\s+/g, ' '))
        .filter((h) => /:/.test(h))                       // revision-bearing only
        .filter((h) => h.toUpperCase() !== SENTINEL.toUpperCase());
      note(stale.length === 0,
        `${r}: the only ISO 9001 revision shown is the one in site-info (${beforeCounts[r]} ISO string(s) on the page)`,
        `still showing ${stale.map((s) => JSON.stringify(s)).join(', ')}`);
    }

    // ── 2. the withdrawn revision is gone everywhere ───────────────────────
    const all = ROUTES.map((r) => after[r]).join('\n');
    note(!/ISO\s*9001:\s*2008/i.test(all),
      'ISO 9001:2008 appears on no route once the source says otherwise');

    // ── 3. nothing vanished ───────────────────────────────────────────────
    for (const r of ROUTES) {
      const n = count(after[r], ISO9001);
      note(n === beforeCounts[r],
        `${r}: still renders ${beforeCounts[r]} ISO string(s), not fewer (${n})`,
        'the waterfall must rewrite the claim, not delete it');
    }

    // ── 4. the historical milestone did NOT gain a revision ───────────────
    const milestone = (after['/about'].match(/Achieved ISO\s*9001(?::\s*\d{4})? registration/i) || [])[0];
    note(!!milestone && !/:/.test(milestone),
      `/about: the 1990s milestone still reads "Achieved ISO 9001 registration" with no revision`,
      milestone ? `it now reads ${JSON.stringify(milestone)} — a revision stamped onto a historical sentence`
        : 'the milestone sentence is not on the page — the control proves nothing');

    // ── 5. an unversioned source strips every revision ────────────────────
    const si2 = JSON.parse(original.toString('utf8'));
    si2.certifications.iso = 'ISO 9001';
    fs.writeFileSync(MIRROR_SI, JSON.stringify(si2, null, 4));
    const plain = await readPages(browser);
    const plainAll = ROUTES.map((r) => plain[r]).join('\n');
    note(!/ISO\s*9001\s*:\s*\d{4}/i.test(plainAll),
      'an unversioned "ISO 9001" in site-info leaves no revision anywhere on the site (the A-8.5 safe state)',
      (plainAll.match(/ISO\s*9001\s*:\s*\d{4}/gi) || []).join(', '));
    const plainTotal = ROUTES.reduce((n, r) => n + count(plain[r], ISO9001), 0);
    note(plainTotal === totalBefore,
      `and the claim is still made ${totalBefore} times, not deleted (${plainTotal})`);

    // ── 6. negative control — a different ISO standard is untouched ───────
    const io1 = count(before['/industries'], ISO10993);
    const io2 = count(after['/industries'], ISO10993);
    note(io1 > 0 && io1 === io2,
      `/industries: ISO 10993-5 is untouched by the rewrite (${io1} before, ${io2} after)`,
      io1 === 0 ? 'the control string is not on the page — the check proves nothing'
        : 'the rewrite is eating a different standard');
  } finally {
    fs.writeFileSync(MIRROR_SI, original);
    await browser.close();
  }

  const restored = fs.readFileSync(MIRROR_SI);
  note(restored.equals(original), 'mirror site-info.json restored byte-for-byte');

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nisowaterfall ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})();
