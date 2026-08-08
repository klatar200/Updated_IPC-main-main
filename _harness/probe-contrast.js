/**
 * One-shot: where do the last few failing neutral combinations actually live?
 * Reads the record plan8-contrast.js writes.
 */
const fs = require('fs');
const path = require('path');
const rec = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'out', 'plan8-contrast', 'contrast.json'), 'utf8')
);
const WANT = ['rgb(255, 255, 255)|rgb(17,158,200)', 'rgba(255, 255, 255, 0.7)|rgb(0,93,163)',
              'rgb(255, 255, 255)|rgb(51,125,181)'];
for (const c of rec.combos) {
  const key = `${c.color}|${c.on}`;
  if (!WANT.includes(key)) continue;
  console.log('='.repeat(64));
  console.log(`${c.ratio.toFixed(2)}:1  ${c.color} on ${c.on}  x${c.count}`);
  console.log(`  ${c.size}px/${c.weight}  <${c.tag}>  class="${c.cls}"`);
  console.log(`  url   : ${c.url} @${c.width}`);
  console.log(`  text  : ${JSON.stringify(c.text)}`);
}
