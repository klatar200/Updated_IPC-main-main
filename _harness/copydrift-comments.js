/**
 * copydrift.js / dump-copy-groups.php must not be unbalanced by a comment
 * (WHATS_LEFT copy-extractors-are-blind-to-comments, fixed 2026-09-29). Both
 * bracket matchers skipped strings but not comments, so an apostrophe or a
 * bracket in a comment inside COPY_DEFAULTS or $COPY_GROUPS broke the check —
 * content.php even carried a "no apostrophes in comments" rule because of it.
 * Measured before the fix: "PHP Parse error: Unclosed '['".
 *
 * Copies App.jsx and content.php to a temp root with such comments injected,
 * runs copydrift there (IPC_ROOT), and expects the same OK as the real tree.
 *
 *   node _harness/copydrift-comments.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-copydrift-'));
let ok = false;
try {
  fs.mkdirSync(path.join(T, 'src')); fs.mkdirSync(path.join(T, 'admin'));
  const inject = (file, marker, text) => {
    const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const i = s.indexOf(marker);
    if (i < 0) throw new Error(`${marker} not found in ${file}`);
    fs.writeFileSync(path.join(T, file), s.slice(0, i + marker.length) + text + s.slice(i + marker.length));
  };
  inject('src/App.jsx', 'const COPY_DEFAULTS = {', "\n  // Rick's note: a stray } or ` in a comment\n  /* nor ' here { */");
  inject('admin/content.php', '$COPY_GROUPS = [', "\n    // it's a ] in a comment\n    # and another ' ]\n    /* ' ] */");
  const real = spawnSync('node', [path.join(__dirname, 'copydrift.js')], { encoding: 'utf8' });
  const mut = spawnSync('node', [path.join(__dirname, 'copydrift.js')], { encoding: 'utf8', env: { ...process.env, IPC_ROOT: T } });
  const line = (r) => ((r.stdout || '') + (r.stderr || '')).trim().split('\n').pop();
  ok = mut.status === 0 && line(mut) === line(real);
  console.log(`${ok ? 'ok  ' : 'FAIL'} comments with ' ] } \` inside COPY_DEFAULTS and $COPY_GROUPS do not unbalance the extractors${ok ? '' : `\n       → ${line(mut)}`}`);
} finally { fs.rmSync(T, { recursive: true, force: true }); }
console.log(`\ncopydrift-comments ${ok ? 1 : 0}/1`);
process.exit(ok ? 0 : 1);
