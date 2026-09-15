/**
 * Audit 9 — independent re-measurement of the six records V1/V2 never reached.
 *
 * A-9.P4-2, A-9.P4-4, A-9.P4-8, A-9.P5a-2, A-9.P5a-3, A-9.P5a-4.
 *
 * All six were raised by pass agent B1 (P4 + P5a) and none was reproduced by
 * either verifier before the usage limit ended both sessions. This re-measures
 * every load-bearing claim in each of them from the primary data, NOT by
 * re-running the record's own `reproduce:` block: where the record counted, this
 * counts differently; where it named instances, this enumerates the whole set
 * and checks the named ones fall out of it.
 *
 * What this is and is not: C is independent of B1, which is the independence
 * PLAN-11 §3.6 asks for (a verifier independent of the raiser). It is NOT a
 * separate agent, and C wrote these records' `outcome:` fields at consolidation.
 * Recorded as "re-measured by C" rather than as V1/V2 verification.
 *
 * Two of the six carry claims about code that this round then CHANGED
 * (A-9.P5a-2's button labels, A-9.P4-8's render guards). Those are measured
 * against the audit base commit as well as against HEAD, so the record's
 * historical claim and today's state are separated rather than conflated.
 *
 * Usage: node _harness/audit9-verify6.js        (no server, no browser)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BASE = '2121597'; // the commit every record was measured on
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const atBase = (p) => {
  try { return execFileSync('git', ['show', `${BASE}:${p}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return null; }
};

const content = json('data/content.json');
const site = json('data/site-info.json');
const products = json('data/products-all.json');

const results = [];
let section = '';
const sec = (s) => { section = s; console.log(`\n${s}`); };
const check = (verdict, what, detail = '') => {
  results.push({ section, verdict, what, detail });
  const tag = { yes: 'REPRODUCED', no: 'NOT-REPRODUCED', adj: 'ADJUSTED' }[verdict];
  console.log(`  ${tag.padEnd(14)} ${what}${detail ? '\n                   → ' + detail : ''}`);
};

// ── A-9.P4-2 ───────────────────────────────────────────────────────────────
sec('A-9.P4-2  "Made in USA" is presented as a certification and is backed by nothing');
{
  // Enumerate the whole certification chip row rather than checking certs[2].
  const certs = content.certs || [];
  const titles = certs.map((c) => c.title);
  const idx = titles.findIndex((t) => /made in usa/i.test(t || ''));
  check(idx >= 0 ? 'yes' : 'no',
    `"Made in USA" renders as one of the ${certs.length} certification chips`,
    `chips: ${JSON.stringify(titles)}${idx >= 0 ? ` — it is chip ${idx}, sub ${JSON.stringify(certs[idx].sub)}` : ''}`);

  const other = (site.certifications && site.certifications.other) || null;
  check(Array.isArray(other) && other.length === 0 ? 'yes' : 'no',
    'site-info.json certifications.other is empty, so no chip in that row is backed by a stored certification',
    `certifications = ${JSON.stringify(site.certifications)}`);

  // The record says exactly one of 42 records claims domestic production.
  const domestic = products.filter((p) => /domestic|made in usa/i.test(JSON.stringify(p)));
  check(domestic.length === 1 && domestic[0].sku === 'IP75AD' ? 'yes' : 'adj',
    'exactly one of the 42 catalog records describes its own production as domestic',
    `${domestic.length} record(s): ${JSON.stringify(domestic.map((p) => p.sku))}` +
    (domestic.length === 1 ? ` — badges ${JSON.stringify(domestic[0].badges)}` : ''));

  // The "supplier, not manufacturer" half — enumerate every self-description.
  const selfDesc = [
    ['site-info company.description', site.company.description],
    ['copy.hero.subhead', content.copy && content.copy.hero && content.copy.hero.subhead],
    ['seo[0].desc', content.seo && content.seo[0] && content.seo[0].desc],
  ].filter(([, v]) => typeof v === 'string');
  const supplier = selfDesc.filter(([, v]) => /supplier|distribut|stocking/i.test(v));
  const manufacturer = selfDesc.filter(([, v]) => /\bmanufactur/i.test(v));
  check(supplier.length > 0 && manufacturer.length === 0 ? 'yes' : 'adj',
    'the company describes itself as a supplier/distributor, never as a manufacturer',
    `supplier-worded: ${supplier.length}/${selfDesc.length} (${supplier.map(([k]) => k).join(', ')}); ` +
    `manufacturer-worded: ${manufacturer.length}`);

  const heroTrust = (content.heroTrust || []).map((t) => t.text);
  const badge = content.copy && content.copy.hero && content.copy.hero.badge;
  const renderings = [
    ...heroTrust.filter((t) => /made in usa/i.test(t || '')).map((t) => `heroTrust: ${JSON.stringify(t)}`),
    ...(/made in usa/i.test(badge || '') ? [`copy.hero.badge: ${JSON.stringify(badge)}`] : []),
    ...(idx >= 0 ? [`certs[${idx}]: ${JSON.stringify(certs[idx].title)}`] : []),
  ];
  check(renderings.length >= 3 ? 'yes' : 'adj',
    'the claim renders in more than one place, unqualified',
    renderings.join(' | '));
}

// ── A-9.P4-4 ───────────────────────────────────────────────────────────────
sec('A-9.P4-4  "42 Products Stocked" is typed by hand and counts a services record');
{
  const stat = (content.stats || []).find((s) => /products stocked/i.test(s.label || ''));
  check(stat ? 'yes' : 'no', 'the homepage stats bar carries a hand-typed "Products Stocked" figure',
    JSON.stringify(stat));
  check(stat && String(stat.value) === String(products.length) ? 'yes' : 'no',
    `the figure (${stat && stat.value}) equals the catalog size (${products.length}) TODAY — the finding is the mechanism, not a wrong number`,
    'nothing links the two: they are edited on different admin screens');

  // Does the admin write content.json when a product is added or deleted?
  // A WRITE, not a mention: add.php carries a comment about content.json and
  // calls ipc_product_families(), which READS it for the family dropdown. The
  // first version of this check matched that comment and read as a refutation.
  const writesContent = (f) => {
    const src = read(f).split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/^\s*#/.test(l))
      .join('\n');
    return /\bsave_content\s*\(/.test(src);
  };
  const writers = ['admin/add.php', 'admin/delete.php'].filter(writesContent);
  check(writers.length === 0 ? 'yes' : 'no',
    'admin/add.php and admin/delete.php never WRITE content.json, so the figure cannot follow the catalog',
    writers.length ? `writes: ${writers.join(', ')}`
      : 'neither calls save_content(); add.php only reads the family list out of it');

  // The over-count half: is VALUE-ADDED a service rather than a stocked part?
  const va = products.find((p) => p.sku === 'VALUE-ADDED');
  const isService = va && !va.operatingTemp && /value-added services/i.test(JSON.stringify(va.description || ''));
  check(isService ? 'yes' : 'adj',
    'one of the 42 records is a services page, not a stocked product',
    va ? `VALUE-ADDED: partType ${JSON.stringify(va.partType)}, operatingTemp ${JSON.stringify(va.operatingTemp)}, ` +
         `badges ${JSON.stringify(va.badges)}` : 'VALUE-ADDED not found');

  const noPdf = products.filter((p) => !p.pdfUrl);
  check(noPdf.length === 0 ? 'yes' : 'no',
    'the sub-line "Datasheet published for every one" holds only because the services record also has a PDF',
    `${products.length - noPdf.length}/${products.length} records carry a pdfUrl; VALUE-ADDED's is ${JSON.stringify(va && va.pdfUrl)}`);
}

// ── A-9.P4-8 ───────────────────────────────────────────────────────────────
sec('A-9.P4-8  five of 42 products have no photograph');
{
  const named = ['IP12GA-IP1274', 'IP13SP', 'IP25PU', 'IP30UV', 'IP47HV'];
  // Enumerate rather than check the five: any record whose photo is a placeholder.
  const placeholder = products.filter((p) => /placehold\.co/.test(p.photoUrl || ''));
  const skus = placeholder.map((p) => p.sku.replace(/\s*-\s*/g, '-'));
  const sameSet = skus.length === named.length && named.every((n) => skus.includes(n));
  check(sameSet ? 'yes' : 'adj',
    `exactly ${named.length} of ${products.length} records sit on the branded placeholder, and they are the five named`,
    `found ${skus.length}: ${JSON.stringify(skus)}`);

  // Executable guards only. Half the occurrences of the string are comments
  // ABOUT the guard, and counting those made the first run of this check read
  // 6 at the base and 8 at HEAD against a record that correctly says 3.
  const guardsIn = (src) => (src || '').split('\n')
    .map((l, i) => ({ l, n: i + 1 }))
    .filter((x) => /placehold\.co/.test(x.l))
    .filter((x) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(x.l))
    .filter((x) => /includes\(/.test(x.l));

  const guards = guardsIn(read('src/App.jsx'));
  const baseGuards = guardsIn(atBase('src/App.jsx'));
  check(baseGuards.length === 3 ? 'yes' : 'adj',
    `the record's "three render guards" is exactly what ${BASE} carried`,
    `at ${BASE}: ${baseGuards.map((g) => ':' + g.n).join(' ')} — the record cites :7507, :8844, :9323`);
  check(guards.length === 3 ? 'yes' : 'adj',
    'the same three guards are still the only places a photo is painted, so nothing is fetched cross-origin',
    `at HEAD: ${guards.map((g) => ':' + g.n).join(' ')} — :5936 is A-9.P4-9's productImageAbs(), which centralised the og:image guard rather than adding one`);
}

// ── A-9.P5a-2 ──────────────────────────────────────────────────────────────
sec('A-9.P5a-2  the FAQ names a button that is not there, and a catalog PDF that does not exist');
{
  const faq = content.faq || [];
  const row = faq.find((f) => /where can i download product data sheets/i.test(f.question || ''));
  check(row ? 'yes' : 'no', 'the FAQ row exists and names a control by name', JSON.stringify(row && row.question));

  const quoted = (row && (row.answer.match(/'([^']+)' button/) || [])[1]) || null;
  // What the product header actually rendered at the audit base, and at HEAD.
  const baseSrc = atBase('src/App.jsx') || '';
  const headSrc = read('src/App.jsx');
  const labelOf = (s) => {
    const m = s.match(/asText\(product\.pdfLabel\) \|\| "([^"]+)"/);
    return m ? m[1] : null;
  };
  const baseLabel = labelOf(baseSrc), headLabel = labelOf(headSrc);
  check(quoted && baseLabel && quoted !== baseLabel ? 'yes' : 'no',
    `the FAQ quotes "${quoted}"; the product header's control was labelled "${baseLabel}" at ${BASE}`,
    'the record reproduces: the name in the FAQ was not the name on the button');
  check(quoted && headLabel && quoted !== headLabel ? 'yes' : 'no',
    `it is STILL not the button's name at HEAD — A-9.P5a-6 unified both PDF controls as "${headLabel}"`,
    'so the FAQ sentence remains an owner edit, and should now name the new label');

  const cat = site.catalogPdfUrl;
  check(cat === '' || cat == null ? 'yes' : 'no',
    'the promised "full IPC product catalog PDF" has no file behind it',
    `site-info.json catalogPdfUrl = ${JSON.stringify(cat)}`);

  // The footer link renders only when the field is safe/non-empty.
  const gated = /isSafeLinkUrl\(\s*site\.catalogPdfUrl|catalogPdfUrl[\s\S]{0,80}isSafeLinkUrl/.test(headSrc);
  check(gated ? 'yes' : 'adj',
    'the footer link is gated on that field, so the FAQ promises a link the site does not render',
    gated ? 'isSafeLinkUrl(site.catalogPdfUrl) gate present' : 'gate not found by pattern — read the footer');
}

// ── A-9.P5a-3 ──────────────────────────────────────────────────────────────
sec('A-9.P5a-3  the privacy policy\'s effective date is older than the policy');
{
  const eff = content.copy && content.copy.privacyHeader && content.copy.privacyHeader.effectiveDate;
  check(!!eff ? 'yes' : 'no', 'the page prints an effective date', JSON.stringify(eff));

  const effDate = new Date(eff);
  // Date the two privacy sections were last materially rewritten, from git —
  // measured, not taken from audit8.md's prose.
  let lastEdit = null;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '-S', 'They are not deleted automatically', '--', 'data/content.json'],
      { cwd: ROOT, encoding: 'utf8' }).trim();
    lastEdit = out || null;
  } catch (e) { /* leave null */ }
  const months = lastEdit ? Math.round((new Date(lastEdit) - effDate) / (1000 * 60 * 60 * 24 * 30.44)) : null;
  check(lastEdit && months > 12 ? 'yes' : 'adj',
    'the policy text was rewritten long after the date it claims to have taken effect',
    `effective date ${JSON.stringify(eff)}; the retention sentence "They are not deleted automatically" ` +
    `entered data/content.json on ${lastEdit} — ${months} months later (record says 20)`);

  const sections = (content.privacySections || []).map((s) => s.heading || s.title);
  check(sections.length > 0 ? 'yes' : 'no',
    'the policy is owner-editable data, so the date is an admin edit and not a code change',
    `${sections.length} privacy sections in content.json`);
}

// ── A-9.P5a-4 ──────────────────────────────────────────────────────────────
sec('A-9.P5a-4  six misspellings in the catalog');
{
  // These six were FIXED on 2026-09-15, after this re-measurement ran. A
  // verification record attests what was true when the finding was raised, so
  // the arms below read the catalog at the audit base commit; the arm after
  // them confirms the fix landed at HEAD. Reading HEAD here would turn a
  // verified finding into a permanent false red in the sweep, which is the
  // defect A-9.D5 was about.
  const baseProducts = JSON.parse(atBase('data/products-all.json'));
  const claims = [
    ['IP69HT', 'caption', /agressive/i, 'aggressive'],
    ['IP63ES', 'description', /apperance/i, 'appearance'],
    ['IP44A2 - IP45A3', 'description', /availble/i, 'available'],
    ['IP35KY', 'specTable1', /transparant/i, 'transparent'],
    ['IP55FL', 'specTable1', /transparant/i, 'transparent'],
    ['IP35KY', 'badges', /Semrigid/i, 'Semi-Rigid'],
  ];
  // Enumerate the catalog for each misspelling rather than checking the named
  // record — that also catches an instance the record missed.
  const blob = (p) => JSON.stringify(p);
  for (const [sku, field, re, right] of claims) {
    const hits = baseProducts.filter((p) => re.test(blob(p)));
    const skus = hits.map((h) => h.sku);
    const named = skus.some((s) => s.replace(/\s/g, '') === sku.replace(/\s/g, ''));
    check(named && hits.length === claims.filter((c) => c[2].source === re.source).length ? 'yes' : (named ? 'adj' : 'no'),
      `"${re.source}" (should be "${right}") is present on ${sku}`,
      `records carrying it: ${JSON.stringify(skus)}`);
  }
  // Is "Semrigid" really the odd one out among badges? The record says to fix
  // it to "Semi-Rigid (the form the other two products use)". Enumerate the
  // whole set rather than trusting that parenthetical — at the BASE, which is
  // the state the record describes.
  const semi = [];
  for (const p of baseProducts) for (const b of (p.badges || [])) if (/semi|semrigid/i.test(b)) semi.push([p.sku, b]);
  const forms = [...new Set(semi.map(([, b]) => b))];
  check(forms.length > 1 ? 'yes' : 'adj',
    'the badge spelling is inconsistent across products, which is why that one is not merely a typo',
    semi.map(([s, b]) => `${s} ${JSON.stringify(b)}`).join(' · '));
  check(forms.length === 2 ? 'yes' : 'adj',
    'the record says to normalise to "the form the other two products use" — implying one other form',
    `there are ${forms.length} forms across ${semi.length} products: ${JSON.stringify(forms)}. ` +
    (forms.length > 2
      ? 'The parenthetical undercounts: IP42MW spells it "Semi-rigid", so the owner edit is a three-way normalisation, not a one-word typo fix. This strengthens A-9.P5a-8 (badge concepts written two ways) rather than contradicting A-9.P5a-4.'
      : ''));

  // …and the state at HEAD, so this file records the outcome as well as the
  // finding. All six spellings are corrected, and the badge family the
  // adjustment above found is one form.
  const stillWrong = claims.filter(([, , re]) => products.some((p) => re.test(blob(p))));
  check(stillWrong.length === 0 ? 'yes' : 'no',
    'AT HEAD: all six are corrected (fixed 2026-09-15, after this verification)',
    stillWrong.length ? `still present: ${JSON.stringify(stillWrong.map((c) => c[2].source))}`
      : 'agressive, apperance, availble, transparant x2, Semrigid — none remains');
  const headForms = [...new Set(products.flatMap((p) => (p.badges || []).filter((b) => /semi|semrigid/i.test(b))))];
  check(headForms.length === 1 ? 'yes' : 'no',
    'AT HEAD: the three semi-rigid spellings are one, the 2-of-3 majority form',
    JSON.stringify(headForms));
}

// ── summary ────────────────────────────────────────────────────────────────
const n = (v) => results.filter((r) => r.verdict === v).length;
console.log(`\naudit9-verify6: ${results.length} claims — ${n('yes')} reproduced, ${n('adj')} reproduced with an adjustment, ${n('no')} NOT reproduced`);
fs.mkdirSync(path.join(__dirname, 'out', 'audit9', 'C'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', 'audit9', 'C', 'verify6.json'), JSON.stringify(results, null, 2));
process.exit(n('no') === 0 ? 0 : 1);
