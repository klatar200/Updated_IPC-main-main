/**
 * One-shot: how many products would gain "UL Recognized" if APPROVALS also
 * matched the reversed phrasing "Recognized ... Underwriters' Laboratories"?
 *
 * CT's spec table reads "Recognized under the Components program of
 * Underwriters' Laboratories File No. E129972". The shipped regex expects
 * `UL ... Recognized` within 18 characters, so it misses this entirely, and
 * after PLAN-8 A1 removed the second derivation CT shows no UL fact at all.
 * Before widening a regex that both App.jsx and admin/config.php must agree
 * on, measure what else it would move.
 */
const fs = require('fs');
const path = require('path');
const cat = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const CURRENT = /\bU\/?L\b[^.;]{0,18}\bRecognized\b/i;
const ADDITION = /\bRecognized\b[^.;]{0,60}\bUnderwriters'?\s+Laborator(?:y|ies)\b/i;

const hay = (p) =>
  [
    (p.badges || []).join(' | '),
    p.specificationsSummary || '',
    Array.isArray(p.description) ? p.description.join(' ') : String(p.description || ''),
    JSON.stringify(p.specTable1 || {}),
  ].join(' | ');

let gained = 0, already = 0;
for (const p of cat) {
  const h = hay(p);
  const now = CURRENT.test(h);
  const add = ADDITION.test(h);
  if (add && now) { already++; console.log('already matched :', p.id); }
  if (add && !now) { gained++; console.log('WOULD GAIN      :', p.id); }
}
console.log(`\nwould gain UL Recognized: ${gained}   already matched by the current regex: ${already}`);

// Does the phrase appear anywhere the addition does NOT catch? (word-order or
// distance variants that would still be missed)
const mentions = cat.filter((p) => /Underwriters/i.test(hay(p)));
console.log(`products mentioning "Underwriters" at all: ${mentions.length} -> ${mentions.map((p) => p.id).join(', ')}`);
for (const p of mentions) {
  const h = hay(p);
  console.log(`  ${p.id}: current=${CURRENT.test(h)} addition=${ADDITION.test(h)}`);
}
