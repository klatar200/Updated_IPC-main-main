/**
 * Claims re-audit (2026-09-15) — the composite register.
 *
 * `claims-extract.js` scans string LEAVES, and that granularity has a hole the
 * first run walked straight into: `content.json`'s `stats[1]` is
 * `{value:"42", label:"Products Stocked", sub:"Datasheet published for every
 * one"}`. The claim is all three fields together. Leaf-wise, `"42"` is too
 * short to match anything and `"Products Stocked"` carries neither a digit nor
 * a certification keyword — so the one claim this whole pass started from was
 * invisible to the instrument built to find it.
 *
 * So: the claim-bearing blocks are enumerated by name and each ENTRY is one
 * claim, composed from its own fields. The leaf scan stays as the completeness
 * check — anything it finds that this does not is a block nobody enumerated.
 *
 * Provenance against the last live site is per-claim, same corpus and same
 * generous matcher as `claims-provenance.js`.
 *
 * Usage: node _harness/claims-composite.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'claims');
fs.mkdirSync(OUT, { recursive: true });

const norm = (s) => String(s)
  .replace(/ /g, ' ').replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"').replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ').trim();

const liveFile = path.join(OUT, 'live', 'index-live.js');
const live = fs.existsSync(liveFile)
  ? norm(fs.readFileSync(liveFile, 'utf8')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))))
  : null;

function seen(text) {
  if (!live) return 'NO-CORPUS';
  const t = norm(text);
  if (t.length < 4) return 'SHORT';
  if (live.includes(t)) return 'yes';
  if (t.length >= 40) {
    for (let i = 0; i + 24 <= t.length; i += 8) if (live.includes(t.slice(i, i + 24))) return 'partial';
  }
  return 'no';
}

const rawContent = fs.readFileSync(path.join(ROOT, 'data/content.json'), 'utf8');
const rawInfo = fs.readFileSync(path.join(ROOT, 'data/site-info.json'), 'utf8');
const content = JSON.parse(rawContent);
const info = JSON.parse(rawInfo);

function lineOf(raw, pointerValue) {
  const enc = JSON.stringify(String(pointerValue));
  const i = raw.indexOf(enc);
  if (i < 0) return 0;
  let line = 1; for (let j = 0; j < i; j++) if (raw.charCodeAt(j) === 10) line++;
  return line;
}

const claims = [];
function add(id, source, line, text, parts) {
  // A composite is INHERITED only if every part of it was on the old site.
  const per = parts.map((p) => ({ part: p, seen: seen(p) }));
  const kinds = new Set(per.filter((p) => p.seen !== 'SHORT').map((p) => p.seen));
  const prov = kinds.size === 0 ? 'SHORT'
    : kinds.has('no') ? (kinds.size > 1 ? 'PART-NEW' : 'INTRODUCED')
    : kinds.has('partial') ? 'INHERITED-PARTIAL' : 'INHERITED';
  claims.push({ id, source: `${source}:${line}`, text, provenance: prov, parts: per });
}

// ── content.json — the blocks a visitor reads as assertions ─────────────────
content.stats.forEach((s, i) => add(`STAT-${i + 1}`, 'data/content.json',
  lineOf(rawContent, s.value), `${s.value} — ${s.label} (${s.sub})`, [s.value, s.label, s.sub]));

content.heroProofPoints.forEach((s, i) => add(`HERO-${i + 1}`, 'data/content.json',
  lineOf(rawContent, s.stat), `${s.stat} — ${s.label} (${s.sub})`, [s.stat, s.label, s.sub]));

content.heroTrust.forEach((s, i) => add(`TRUST-${i + 1}`, 'data/content.json',
  lineOf(rawContent, s.text), s.text, [s.text]));

content.certs.forEach((s, i) => add(`CERT-${i + 1}`, 'data/content.json',
  lineOf(rawContent, s.title), `${s.title} — ${s.sub}`, [s.title, s.sub]));

content.milestones.forEach((s, i) => add(`MILE-${i + 1}`, 'data/content.json',
  lineOf(rawContent, s.desc), `${s.year} ${s.label}: ${s.desc}`, [s.desc]));

content.services.forEach((s, i) => add(`SVC-${i + 1}`, 'data/content.json',
  lineOf(rawContent, s.title), `${s.title} — lead time "${s.leadTime}" — ${s.desc}`,
  [s.leadTime, s.desc]));

content.industryDetail.forEach((d, i) => (d.certs || []).forEach((c, j) =>
  add(`IND-${i + 1}.${j + 1}`, 'data/content.json', lineOf(rawContent, c),
    `${d.name}: "${c}"`, [c])));

content.faq.forEach((f, i) => add(`FAQ-${i + 1}`, 'data/content.json',
  lineOf(rawContent, f.question), `Q: ${f.question} / A: ${f.answer}`, [f.answer]));

// ── site-info.json — the company facts ─────────────────────────────────────
add('CO-1', 'data/site-info.json', lineOf(rawInfo, info.company.foundedYear),
  `Founded ${info.company.foundedYear}`, [info.company.foundedYear, info.company.description]);
add('CO-2', 'data/site-info.json', lineOf(rawInfo, info.stats.feetInStock),
  `${info.stats.feetInStock} feet in stock`, [info.stats.feetInStock]);
add('CO-3', 'data/site-info.json', lineOf(rawInfo, info.stats.minimumOrder),
  `${info.stats.minimumOrder} minimum order`, [info.stats.minimumOrder]);
add('CO-4', 'data/site-info.json', lineOf(rawInfo, info.certifications.iso),
  `Certification: ${info.certifications.iso}` +
  (info.certifications.other.length ? ` + ${info.certifications.other.join(', ')}` : ''),
  [info.certifications.iso]);
info.about.paragraphs.forEach((p, i) => add(`ABOUT-${i + 1}`, 'data/site-info.json',
  lineOf(rawInfo, p), p, [p]));

// ── index.html — what a crawler and a social unfurl read ───────────────────
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const htmlLine = (needle) => { const i = html.indexOf(needle); if (i < 0) return 0;
  let l = 1; for (let j = 0; j < i; j++) if (html.charCodeAt(j) === 10) l++; return l; };
for (const m of html.matchAll(/<meta\s+(?:name|property)="(description|og:description|og:title)"\s*\n?\s*content="([^"]+)"/g)) {
  add(`META-${m[1]}`, 'index.html', htmlLine(m[0]), `${m[1]}: ${m[2]}`, [m[2]]);
}
{
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ld) {
    const o = JSON.parse(ld[1]);
    add('LD-founding', 'index.html', htmlLine('"foundingDate"'),
      `JSON-LD foundingDate ${o.foundingDate}`, [o.foundingDate]);
    add('LD-desc', 'index.html', htmlLine('"description"'),
      `JSON-LD description: ${o.description}`, [o.description]);
    add('LD-hours', 'index.html', htmlLine('"openingHoursSpecification"'),
      `JSON-LD hours ${o.openingHoursSpecification.opens}-${o.openingHoursSpecification.closes}, ` +
      `${o.openingHoursSpecification.dayOfWeek.join('/')}`, [o.openingHoursSpecification.opens]);
  }
}

fs.writeFileSync(path.join(OUT, 'composite.json'), JSON.stringify(claims, null, 1));
const tally = {};
claims.forEach((c) => { tally[c.provenance] = (tally[c.provenance] || 0) + 1; });
console.log(`${claims.length} composite claims`);
Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));
console.log('\nNot wholly on the last live site:');
claims.filter((c) => c.provenance === 'INTRODUCED' || c.provenance === 'PART-NEW')
  .forEach((c) => {
    console.log(`\n  [${c.provenance}] ${c.id}  ${c.source}`);
    console.log(`     ${c.text.slice(0, 200)}`);
    c.parts.filter((p) => p.seen === 'no').forEach((p) => console.log(`     NEW -> "${String(p.part).slice(0, 120)}"`));
  });
console.log(`\n-> ${path.join(OUT, 'composite.json')}`);
