/**
 * Which brand colors still deserve a warning once the ink auto-switches?
 *
 * 4.23's part 2 (derive the foreground by luminance) removes the problem for
 * pale colors: #FFE600 with dark ink scores 14.5:1. The warning is therefore
 * NOT about lightness — it is about the mid-tones where NEITHER white nor dark
 * ink clears AA. This finds that band so the warning path can be tested.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const cands = [];
for (let v = 0x40; v <= 0xd0; v += 4) {
  const h = v.toString(16).padStart(2, '0');
  cands.push(`#${h}${h}${h}`);
}
// A few saturated mid-tones too — grey is not the only way to land in the band.
cands.push('#7f6a3d', '#8a5a2b', '#946b00', '#0e7a5f', '#3d6ea8', '#a05252', '#6b8e23', '#b8860b');

const php = spawnSync('php', [path.join(__dirname, 'contrastparity.php'), ...cands], { encoding: 'utf8' });
const rows = php.stdout.trim().split('\n').map((l) => {
  const [r, ink] = l.split('|');
  return { ratio: parseFloat(r), ink: ink.trim() };
});

const bad = [], warn = [];
cands.forEach((c, i) => {
  const r = rows[i];
  if (r.ratio < 3.0) bad.push({ c, ...r });
  else if (r.ratio < 4.5) warn.push({ c, ...r });
});

console.log(`scanned ${cands.length} colors\n`);
console.log(`cnote-bad  (best ink < 3.0:1)  — ${bad.length}`);
for (const b of bad.slice(0, 8)) console.log(`   ${b.c}  ${b.ratio.toFixed(2)}:1  ink ${b.ink}`);
console.log(`\ncnote-warn (3.0 <= best ink < 4.5) — ${warn.length}`);
for (const w of warn.slice(0, 12)) console.log(`   ${w.c}  ${w.ratio.toFixed(2)}:1  ink ${w.ink}`);
