/**
 * Proves copydrift.js actually catches drift, in BOTH directions.
 *
 * PLAN-2 NB-copy acceptance: "The new drift check fails when you temporarily
 * add a bogus key to $COPY_GROUPS, and passes when you remove it. Show both."
 *
 * The bogus key is added to a COPY of admin/content.php in a temp tree rather
 * than to the real file — same assertion, but the real source is never in a
 * broken state, so an interrupted run cannot leave a fake field in the admin.
 *
 * Usage: node _harness/copydrift-selftest.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const FILES = ['admin/content.php', 'src/App.jsx'];

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-copy-'));
  for (const rel of FILES) {
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, rel), dest);
  }
  return dir;
}

function runDrift(treeRoot) {
  const res = spawnSync(process.execPath, [path.join(__dirname, 'copydrift.js')], {
    env: { ...process.env, IPC_ROOT: treeRoot },
    encoding: 'utf8',
  });
  return { status: res.status, out: res.stdout || '' };
}

const CASES = [
  {
    name: 'bogus key added to $COPY_GROUPS (PHP-only drift)',
    file: 'admin/content.php',
    apply: (s) => s.replace(
      "    'homeFeatures' => ['title' => 'Homepage — “Products & Services” heading', 'fields' => [\n",
      "    'homeFeatures' => ['title' => 'Homepage — “Products & Services” heading', 'fields' => [\n"
      + "        ['key' => 'bogusDriftKey', 'type' => 'text', 'label' => 'Bogus drift probe'],\n"),
    expectFail: true,
    expectIn: 'homeFeatures.bogusDriftKey',
  },
  {
    name: 'whole bogus group added to $COPY_GROUPS',
    file: 'admin/content.php',
    apply: (s) => s.replace(
      "$COPY_GROUPS = [\n",
      "$COPY_GROUPS = [\n"
      + "    'bogusGroup' => ['title' => 'Bogus', 'fields' => [\n"
      + "        ['key' => 'alpha', 'type' => 'text', 'label' => 'Alpha'],\n"
      + "    ]],\n"),
    expectFail: true,
    expectIn: 'whole groups PHP-only: bogusGroup',
  },
  {
    name: 'key removed from COPY_DEFAULTS (the same defect, from the JS side)',
    file: 'src/App.jsx',
    apply: (s) => s.replace('    ctaButton: "Talk to Our Sales Team",\n', ''),
    expectFail: true,
    expectIn: 'homeFeatures.ctaButton',
  },
  {
    name: 'default with no editor (JS-only) is reported but does NOT fail',
    file: 'src/App.jsx',
    apply: (s) => s.replace(
      '  homeFeatures: {\n',
      '  homeFeatures: {\n    orphanDefault: "rendered but not editable",\n'),
    expectFail: false,
    expectIn: 'homeFeatures.orphanDefault',
  },
];

let bad = 0;

// Control first: unmutated copy must be green, or nothing below means anything.
{
  const tree = makeTree();
  const r = runDrift(tree);
  fs.rmSync(tree, { recursive: true, force: true });
  if (r.status !== 0) {
    console.log('FAIL control — the UNMUTATED tree already reports drift:\n' + r.out);
    bad++;
  } else {
    const m = r.out.match(/matched\s+:\s+(\d+)/);
    console.log(`ok   control  unmutated tree is clean (${m ? m[1] : '?'} matched, exit 0)`);
  }
}

for (const c of CASES) {
  const tree = makeTree();
  const target = path.join(tree, c.file);
  const before = fs.readFileSync(target, 'utf8');
  const after = c.apply(before);

  if (after === before) {
    console.log(`FAIL ${c.name}\n       mutation did not apply — pattern no longer matches ${c.file}`);
    bad++;
    fs.rmSync(tree, { recursive: true, force: true });
    continue;
  }
  fs.writeFileSync(target, after);

  const r = runDrift(tree);
  fs.rmSync(tree, { recursive: true, force: true });

  const failedAsExpected = c.expectFail ? r.status === 1 : r.status === 0;
  const named = r.out.includes(c.expectIn);

  if (failedAsExpected && named) {
    console.log(`ok   ${c.name}\n       -> exit ${r.status}, report names "${c.expectIn}"`);
  } else {
    console.log(`FAIL ${c.name}\n       expected exit ${c.expectFail ? 1 : 0}, got ${r.status}; names "${c.expectIn}": ${named}`);
    bad++;
  }
}

console.log(`\ncopydrift-selftest ${CASES.length + 1 - bad}/${CASES.length + 1}`);
process.exit(bad === 0 ? 0 : 1);
