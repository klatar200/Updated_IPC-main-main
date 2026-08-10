/**
 * AUDIT-10 pass-5 step 5.2 — color analysis over the step-5.1 census.
 *
 * Reads plans/audit10/state/stylecensus.json (produced by
 * _harness/audit10-stylecensus.js) and asks the three questions the pass file
 * asks. The only browser work is one page load to resolve the live brand
 * palette; no element is re-measured.
 *
 *   (a) near-duplicates — cluster the painted colors by Euclidean distance in
 *       sRGB, PER ROLE (text ink / background / border / svg fill / svg
 *       stroke). Two almost-identical greys used for the same role is drift;
 *       the same two used one as ink and one as a rule is not, so the roles
 *       are never mixed. Distance < 12 and not identical is the flag.
 *
 *   (b) singletons — every color painted by exactly one or two elements
 *       site-wide, with the class signatures and example selectors that carry
 *       it, so each can be judged as a deliberate accent or a leak.
 *
 *   (c) source mapping — every painted color resolved to one of:
 *         brand-var   : equals a live --brand-* value
 *         tailwind    : equals a value in the Tailwind v3 default palette
 *                       (loaded from node_modules, not retyped)
 *         neutral     : pure white / pure black / the site's #141414 ink
 *         hardcoded   : none of the above — a literal
 *       The mapping is a LEAD, not a verdict. A literal that happens to equal
 *       a brand color still re-themes if it reaches the DOM through a CSS var,
 *       and a literal in a brand ROLE only counts as a leak once the step-5.3
 *       repalette drill shows it does not follow. This step names the
 *       suspects; audit10-repalette.js convicts them.
 *
 * The brand palette is RESOLVED IN THE BROWSER, not read out of src/index.css.
 * ThemeInjector (src/App.jsx:7313) recomputes six of the fourteen variables at
 * runtime from the owner's four colors — --brand-accent-text is #0d7594 live
 * where the stylesheet says #119ec8 — so classifying against the stylesheet
 * defaults labels genuine brand-variable colors (363 painted elements between
 * two of them) as hardcoded literals.
 *
 * Output: _harness/out/audit10/pass5/colorclust.json  (+ a readable stdout
 * digest). Gitignored — the durable numbers go into the finding records.
 *
 * Usage: node _harness/audit10-colorclust.js     (mirror on :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROOT = path.join(__dirname, '..');
const CENSUS = path.join(ROOT, 'plans', 'audit10', 'state', 'stylecensus.json');
const OUTDIR = path.join(ROOT, '_harness', 'out', 'audit10', 'pass5');

const census = JSON.parse(fs.readFileSync(CENSUS, 'utf8'));

const cssText = fs.readFileSync(path.join(ROOT, 'src', 'index.css'), 'utf8');
const VAR_NAMES = [...new Set([...cssText.matchAll(/(--brand-[a-z0-9-]+)\s*:/gi)].map((m) => m[1]))]
  .filter((n) => !n.endsWith('-rgb'));

// ── Tailwind v3 default palette, loaded from the installed package ──────────
const tw = {};
try {
  const twColors = require(path.join(ROOT, 'node_modules', 'tailwindcss', 'colors.js'));
  for (const [name, val] of Object.entries(twColors)) {
    if (typeof val === 'string') tw[val.toLowerCase()] = name;
    else if (val && typeof val === 'object')
      for (const [shade, hex] of Object.entries(val))
        if (typeof hex === 'string' && !tw[hex.toLowerCase()]) tw[hex.toLowerCase()] = `${name}-${shade}`;
  }
} catch (e) {
  console.error('WARN: tailwind palette not loadable (' + e.message + ')');
}

// ── Color parsing ───────────────────────────────────────────────────────────
function parseHex(h) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
}
function parseRgb(v) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.%]+))?\s*\)/i.exec(v || '');
  if (!m) return parseHex(v);
  const a = m[4] === undefined ? 1 : (String(m[4]).endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a };
}
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
const dist = (a, b) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

// Roles are kept apart on purpose — see the header.
const ROLES = {
  color: 'text ink',
  backgroundColor: 'background',
  borderColor: 'border',
  svgFill: 'svg fill',
  svgStroke: 'svg stroke',
};
const NEUTRAL = { '#ffffff': 'white', '#000000': 'black', '#141414': 'site ink (INK_DARK)' };

// The variables that carry a BRAND HUE. The three --brand-*-ink variables are
// deliberately excluded from the proximity test in (c): they resolve to
// #ffffff on this palette, so every near-white grey on the site sits within 60
// of one and the "brand role" filter degenerates into "is pale".
const CHROMATIC = (n) => !n.includes('-ink');

/** Read the live resolved value of each brand variable from a real page. */
const READ = (names) => {
  const cs = getComputedStyle(document.documentElement);
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
  document.body.appendChild(probe);
  const out = {};
  for (const n of names) {
    const raw = cs.getPropertyValue(n).trim();
    probe.style.color = '';
    probe.style.color = `var(${n})`;
    out[n] = { raw, computed: getComputedStyle(probe).color };
  }
  probe.remove();
  return out;
};

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(400);
  const live = await page.evaluate(READ, VAR_NAMES);
  await browser.close();

  const brandVars = {};
  for (const [k, v] of Object.entries(live)) {
    const c = parseRgb(v.computed) || parseHex(v.raw);
    if (c) brandVars[k] = hex(c);
  }
  const brandByHex = {};
  for (const [k, h] of Object.entries(brandVars)) (brandByHex[h] = brandByHex[h] || []).push(k);

  function classify(h) {
    if (brandByHex[h]) return { source: 'brand-var', name: brandByHex[h].join(' / ') };
    if (NEUTRAL[h]) return { source: 'neutral', name: NEUTRAL[h] };
    if (tw[h]) return { source: 'tailwind', name: tw[h] };
    return { source: 'hardcoded', name: '' };
  }

  // ── Flatten the census into per-role color rows ───────────────────────────
  const roles = {};
  for (const [prop, label] of Object.entries(ROLES)) {
    const bucket = (roles[prop] = { label, rows: [] });
    for (const [value, e] of Object.entries(census.census[prop] || {})) {
      const c = parseRgb(value);
      if (!c) continue;
      const h = hex(c);
      bucket.rows.push({
        value, hex: h, alpha: c.a, rgb: [c.r, c.g, c.b],
        count: e.count, pageCount: e.pageCount, pages: e.pages,
        sigs: Object.entries(e.sigs).sort((x, y) => y[1] - x[1]).slice(0, 6),
        selectors: e.selectors,
        ...classify(h),
      });
    }
    bucket.rows.sort((a, b) => b.count - a.count);
  }

  // ── (a) near-duplicate clusters, within one role ──────────────────────────
  const nearDupes = [];
  for (const [prop, bucket] of Object.entries(roles)) {
    const opaque = bucket.rows.filter((r) => r.alpha === 1);
    for (let i = 0; i < opaque.length; i++)
      for (let j = i + 1; j < opaque.length; j++) {
        const A = opaque[i], B = opaque[j];
        const d = dist({ r: A.rgb[0], g: A.rgb[1], b: A.rgb[2] }, { r: B.rgb[0], g: B.rgb[1], b: B.rgb[2] });
        if (d > 0 && d < 12)
          nearDupes.push({
            role: bucket.label, prop, distance: +d.toFixed(2),
            bothCommon: A.count >= 3 && B.count >= 3,
            sharedSigs: A.sigs.map((s) => s[0]).filter((s) => B.sigs.some((t) => t[0] === s)),
            a: { hex: A.hex, count: A.count, pageCount: A.pageCount, source: A.source, name: A.name, sigs: A.sigs, pages: A.pages.slice(0, 3), selectors: A.selectors },
            b: { hex: B.hex, count: B.count, pageCount: B.pageCount, source: B.source, name: B.name, sigs: B.sigs, pages: B.pages.slice(0, 3), selectors: B.selectors },
          });
      }
  }
  nearDupes.sort((x, y) => x.distance - y.distance);

  // ── (b) singletons ────────────────────────────────────────────────────────
  const singletons = [];
  for (const bucket of Object.values(roles))
    for (const r of bucket.rows) if (r.count <= 2) singletons.push({ role: bucket.label, ...r });
  singletons.sort((a, b) => a.count - b.count || a.hex.localeCompare(b.hex));

  // ── (c) source mapping ────────────────────────────────────────────────────
  const bySource = {};
  for (const bucket of Object.values(roles))
    for (const r of bucket.rows) {
      const k = bucket.label + ' :: ' + r.source;
      const s = (bySource[k] = bySource[k] || { distinctValues: 0, elements: 0, values: [] });
      s.distinctValues++;
      s.elements += r.count;
      if (s.values.length < 40) s.values.push(`${r.hex}${r.alpha < 1 ? '@' + r.alpha : ''} x${r.count}${r.name ? ' (' + r.name + ')' : ''}`);
    }

  const brandRgbs = Object.entries(brandVars)
    .filter(([k]) => CHROMATIC(k))
    .map(([k, v]) => ({ k, c: parseHex(v) }))
    .filter((x) => x.c);
  const repaletteSuspects = [];
  for (const bucket of Object.values(roles))
    for (const r of bucket.rows) {
      if (r.source !== 'hardcoded' && r.source !== 'tailwind') continue;
      let best = null;
      for (const bv of brandRgbs) {
        const d = dist({ r: r.rgb[0], g: r.rgb[1], b: r.rgb[2] }, bv.c);
        if (!best || d < best.d) best = { d: +d.toFixed(1), varName: bv.k, varHex: hex(bv.c) };
      }
      if (best && best.d <= 60)
        repaletteSuspects.push({
          role: bucket.label, hex: r.hex, alpha: r.alpha, source: r.source, name: r.name,
          count: r.count, pageCount: r.pageCount, nearest: best,
          sigs: r.sigs, selectors: r.selectors, pages: r.pages.slice(0, 4),
        });
    }
  repaletteSuspects.sort((a, b) => a.nearest.d - b.nearest.d);

  fs.mkdirSync(OUTDIR, { recursive: true });
  const out = {
    generated_from: 'plans/audit10/state/stylecensus.json (' + census.generated + ')',
    pagesCaptured: census.pagesCaptured,
    brandVarsLive: brandVars,
    brandVarsStatic: Object.fromEntries([...cssText.matchAll(/(--brand-[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()])),
    totals: Object.fromEntries(Object.entries(roles).map(([, b]) => [b.label, b.rows.length])),
    bySource, nearDupes, singletons, repaletteSuspects,
  };
  fs.writeFileSync(path.join(OUTDIR, 'colorclust.json'), JSON.stringify(out, null, 1));

  const P = console.log;
  P('census: ' + census.pagesCaptured + ' pages');
  P('live brand palette: ' + JSON.stringify(brandVars));
  const drifted = Object.entries(brandVars).filter(([k, v]) => out.brandVarsStatic[k] && parseHex(out.brandVarsStatic[k]) && hex(parseHex(out.brandVarsStatic[k])) !== v);
  P('vars whose live value differs from the index.css default: ' + JSON.stringify(drifted));
  P('distinct colors per role: ' + JSON.stringify(out.totals));
  P('\n── source mapping ──');
  for (const [k, v] of Object.entries(bySource))
    P(`  ${k.padEnd(28)} ${String(v.distinctValues).padStart(3)} values / ${String(v.elements).padStart(6)} elements`);
  P(`\n── near-duplicates (same role, sRGB distance < 12) ── ${nearDupes.length} (${nearDupes.filter((d) => d.bothCommon).length} where both are used 3+ times)`);
  for (const d of nearDupes)
    P(`  ${d.distance.toFixed(2).padStart(5)}  ${d.role.padEnd(11)} ${d.a.hex} x${String(d.a.count).padEnd(6)}(${d.a.source}) vs ${d.b.hex} x${String(d.b.count).padEnd(6)}(${d.b.source})${d.sharedSigs.length ? '  SHARED CLASS: ' + d.sharedSigs.join(',') : ''}`);
  P(`\n── singletons (count <= 2) ── ${singletons.length}`);
  for (const s of singletons)
    P(`  ${s.role.padEnd(11)} ${s.value.padEnd(26)} x${s.count} ${s.source}${s.name ? '/' + s.name : ''}  ${s.sigs.map((x) => x[0]).join(',')}  ${s.pages[0] || ''}`);
  P(`\n── non-brand-var colors within 60 of a chromatic brand var (5.3 suspects) ── ${repaletteSuspects.length}`);
  for (const s of repaletteSuspects)
    P(`  d=${String(s.nearest.d).padStart(5)} to ${s.nearest.varName}(${s.nearest.varHex})  ${s.role.padEnd(11)} ${s.hex}${s.alpha < 1 ? '@' + s.alpha : ''} x${s.count} on ${s.pageCount}p (${s.source})  ${s.sigs.map((x) => x[0]).slice(0, 3).join(',')}`);
  P('\n-> ' + path.join(OUTDIR, 'colorclust.json'));
})();
