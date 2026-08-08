/**
 * One-shot: why do CT and IP49VP print "UL Listed" in the header while their
 * approvals block claims nothing? They are the two the 2026-08-08 audit's A1
 * table does not list, and plan8-certs.js flags them as a 19th and 20th case.
 */
const fs = require('fs');
const path = require('path');
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'plan8-certs', 'certs.json'), 'utf8'));
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));

for (const id of ['CT', 'IP49VP', 'IP3L']) {
  const r = rows.find((x) => x.id === id);
  const p = cat.find((x) => x.id === id);
  console.log('='.repeat(70));
  console.log(id);
  console.log('  header chips   :', JSON.stringify(r.header));
  console.log('  approvals block:', JSON.stringify(r.approvals));
  console.log('  badges         :', JSON.stringify(p.badges));
  console.log('  summary        :', JSON.stringify((p.specificationsSummary || '').slice(0, 200)));
  const rowsTxt = (p.specTable1 && p.specTable1.rows ? p.specTable1.rows : [])
    .map((x) => x.value || '').join(' | ');
  console.log('  specTable1     :', JSON.stringify(rowsTxt.slice(0, 300)));
}
