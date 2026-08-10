/**
 * AUDIT-10 pass-5 steps 5.4 + 5.5 — typography scale, radii, shadows, borders.
 *
 * Pure analysis over plans/audit10/state/stylecensus.json. Nothing is
 * re-measured here: 5.1 already walked every rendered element on 132 page x
 * viewport combinations and recorded, for every value, the class signatures
 * that paint it. This inverts that index (value -> signatures becomes
 * signature -> values) and asks the two questions the pass file asks.
 *
 * 5.4 typography
 *   - the fontSize x fontWeight pairs, with the component classes using each
 *   - sizes painted by only one or two elements site-wide (off-scale)
 *   - line-height outliers: < 1.2 on body-sized text, > 2 on heading-sized
 *   - fontFamily values that are not the site stack (a raw sans-serif/Times
 *     leak). The site stack is read from the census's own bodyFont-bearing
 *     values, not retyped.
 *   (the heading-level inversion check is a browser measurement and lives in
 *    _harness/audit10-headings.js — the census aggregates across pages and
 *    cannot answer a per-page ordering question)
 *
 * 5.5 radii / shadows / borders
 *   - every borderRadius with its class signatures, then SAME-CLASS DRIFT:
 *     one class signature painting two or more different radii
 *   - the same for boxShadow, plus one-off shadows (<= 2 elements)
 *   - border colors grouped by the background they sit on (census borderCtx)
 *
 * A class signature here is `tag.first.three.classes`, which is what the
 * census recorded. Tailwind utility classes are part of the signature, so
 * "same class" means genuinely the same component treatment, not merely the
 * same tag.
 *
 * Output: _harness/out/audit10/pass5/tokens.json + stdout digest.
 * Usage: node _harness/audit10-tokens.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CENSUS = path.join(ROOT, 'plans', 'audit10', 'state', 'stylecensus.json');
const OUTDIR = path.join(ROOT, '_harness', 'out', 'audit10', 'pass5');
const census = JSON.parse(fs.readFileSync(CENSUS, 'utf8')).census;

/** value -> {sigs} becomes sig -> [{value, n}] */
function invert(prop) {
  const bySig = {};
  for (const [value, e] of Object.entries(census[prop] || {}))
    for (const [sig, n] of Object.entries(e.sigs || {}))
      (bySig[sig] = bySig[sig] || []).push({ value, n });
  for (const sig of Object.keys(bySig)) bySig[sig].sort((a, b) => b.n - a.n);
  return bySig;
}
const rows = (prop) =>
  Object.entries(census[prop] || {})
    .map(([value, e]) => ({ value, count: e.count, pageCount: e.pageCount, pages: e.pages, sigs: Object.entries(e.sigs).sort((a, b) => b[1] - a[1]), selectors: e.selectors }))
    .sort((a, b) => b.count - a.count);

const out = {};

// ── 5.4a  fontSize x fontWeight ─────────────────────────────────────────────
out.typePairs = rows('typePair').map((r) => ({
  size: r.value.split('|')[0], weight: r.value.split('|')[1],
  count: r.count, pageCount: r.pageCount,
  classes: r.sigs.slice(0, 6).map(([s, n]) => `${s} x${n}`),
}));

// ── 5.4b  off-scale sizes ───────────────────────────────────────────────────
const sizeRows = rows('fontSize');
out.fontSizes = sizeRows.map((r) => ({ size: r.value, count: r.count, pageCount: r.pageCount, classes: r.sigs.slice(0, 5).map(([s, n]) => `${s} x${n}`), selectors: r.selectors }));
out.offScaleSizes = sizeRows.filter((r) => r.count <= 2);
// Non-integer px sizes are a rem/em cascade artifact rather than a chosen step.
out.fractionalSizes = sizeRows.filter((r) => !/^\d+px$/.test(r.value));

// ── 5.4c  line-height outliers ──────────────────────────────────────────────
out.lineHeightOutliers = [];
for (const r of rows('lineHeight')) {
  const [sizeS, lhS] = r.value.split('|');
  const size = parseFloat(sizeS);
  if (lhS === 'normal') continue;                    // UA default, not a token
  const lh = parseFloat(lhS);
  if (!isFinite(lh) || !isFinite(size) || !size) continue;
  const ratio = lh / size;
  const headingSized = size >= 24;
  if ((!headingSized && ratio < 1.2) || (headingSized && ratio > 2))
    out.lineHeightOutliers.push({
      fontSize: sizeS, lineHeight: lhS, ratio: +ratio.toFixed(3),
      kind: headingSized ? 'heading >2' : 'body <1.2',
      count: r.count, pageCount: r.pageCount, classes: r.sigs.slice(0, 5).map(([s, n]) => `${s} x${n}`), selectors: r.selectors,
    });
}
out.lineHeightOutliers.sort((a, b) => b.count - a.count);

// ── 5.4d  fontFamily stack ──────────────────────────────────────────────────
const famRows = rows('fontFamily');
const dominant = famRows[0] ? famRows[0].value : '';
out.fontFamilies = famRows.map((r) => ({
  family: r.value, count: r.count, pageCount: r.pageCount,
  isDominantStack: r.value === dominant,
  classes: r.sigs.slice(0, 5).map(([s, n]) => `${s} x${n}`), selectors: r.selectors, pages: r.pages.slice(0, 4),
}));
out.dominantStack = dominant;

// ── 5.5a  radius drift within one class signature ───────────────────────────
function drift(prop) {
  const bySig = invert(prop);
  const d = [];
  for (const [sig, vals] of Object.entries(bySig)) {
    const distinct = [...new Set(vals.map((v) => v.value))];
    if (distinct.length > 1)
      d.push({ sig, distinct, detail: vals.map((v) => `${v.value} x${v.n}`), total: vals.reduce((s, v) => s + v.n, 0) });
  }
  return d.sort((a, b) => b.total - a.total);
}
out.radii = rows('borderRadius').map((r) => ({ radius: r.value, count: r.count, pageCount: r.pageCount, classes: r.sigs.slice(0, 6).map(([s, n]) => `${s} x${n}`), selectors: r.selectors }));
out.radiusDrift = drift('borderRadius');
out.oneOffRadii = out.radii.filter((r) => r.count <= 2);

// ── 5.5b  shadows ───────────────────────────────────────────────────────────
out.shadows = rows('boxShadow').map((r) => ({ shadow: r.value, count: r.count, pageCount: r.pageCount, classes: r.sigs.slice(0, 6).map(([s, n]) => `${s} x${n}`), selectors: r.selectors }));
out.shadowDrift = drift('boxShadow');
out.oneOffShadows = out.shadows.filter((r) => r.count <= 2);

// ── 5.5c  border color per background ───────────────────────────────────────
const ctx = {};
for (const r of rows('borderCtx')) {
  const [border, , bg] = r.value.split('|');
  (ctx[bg] = ctx[bg] || []).push({ border, count: r.count, classes: r.sigs.slice(0, 4).map(([s, n]) => `${s} x${n}`) });
}
for (const k of Object.keys(ctx)) ctx[k].sort((a, b) => b.count - a.count);
out.borderByBackground = ctx;
// Two or more DIFFERENT border colors on the same background, both common
// enough not to be a one-off, is the drift this step is looking for.
out.borderDriftPerBackground = Object.entries(ctx)
  .filter(([, list]) => list.filter((x) => x.count >= 3).length > 1)
  .map(([bg, list]) => ({ background: bg, borders: list.filter((x) => x.count >= 3) }));

out.letterSpacing = rows('letterSpacing').map((r) => ({ value: r.value, count: r.count, classes: r.sigs.slice(0, 4).map(([s, n]) => `${s} x${n}`) }));

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, 'tokens.json'), JSON.stringify(out, null, 1));

// ── digest ──────────────────────────────────────────────────────────────────
const P = (s) => console.log(s);
P(`fontSize values: ${out.fontSizes.length}  (off-scale <=2 elements: ${out.offScaleSizes.length}, fractional: ${out.fractionalSizes.length})`);
for (const r of out.offScaleSizes) P(`  off-scale ${r.value.padEnd(10)} x${r.count} on ${r.pageCount}p  ${r.sigs.slice(0, 3).map((s) => s[0]).join(',')}  ${r.selectors[0] || ''}`);
for (const r of out.fractionalSizes) P(`  fractional ${r.value.padEnd(10)} x${r.count} on ${r.pageCount}p  ${r.sigs.slice(0, 3).map((s) => s[0]).join(',')}`);
P(`\ntypePairs: ${out.typePairs.length}`);
P(`\nfontFamily values: ${out.fontFamilies.length}`);
for (const f of out.fontFamilies) P(`  ${f.isDominantStack ? '*' : ' '} ${f.family.slice(0, 70).padEnd(72)} x${f.count} on ${f.pageCount}p  ${f.classes.slice(0, 2).join(', ')}`);
P(`\nline-height outliers: ${out.lineHeightOutliers.length}`);
for (const l of out.lineHeightOutliers) P(`  ${l.kind}  ${l.fontSize}/${l.lineHeight} = ${l.ratio}  x${l.count} on ${l.pageCount}p  ${l.classes.slice(0, 3).join(', ')}`);
P(`\nborderRadius values: ${out.radii.length}   same-class drift: ${out.radiusDrift.length}   one-off: ${out.oneOffRadii.length}`);
for (const d of out.radiusDrift.slice(0, 25)) P(`  DRIFT ${d.sig.padEnd(48)} ${d.detail.join('  ')}`);
for (const r of out.oneOffRadii) P(`  one-off ${r.radius.padEnd(22)} x${r.count}  ${r.classes.slice(0, 2).join(', ')}`);
P(`\nboxShadow values: ${out.shadows.length}   same-class drift: ${out.shadowDrift.length}   one-off: ${out.oneOffShadows.length}`);
for (const d of out.shadowDrift.slice(0, 20)) P(`  DRIFT ${d.sig.padEnd(40)} ${d.detail.map((x) => x.slice(0, 46)).join(' | ')}`);
for (const r of out.oneOffShadows) P(`  one-off ${r.shadow.slice(0, 62).padEnd(64)} x${r.count} ${r.classes.slice(0, 2).join(', ')}`);
P(`\nborders: ${Object.keys(ctx).length} distinct backgrounds; drift on ${out.borderDriftPerBackground.length}`);
for (const b of out.borderDriftPerBackground) P(`  on ${b.background.padEnd(26)} ${b.borders.map((x) => x.border + ' x' + x.count).join('  ')}`);
P(`\n-> ${path.join(OUTDIR, 'tokens.json')}`);
