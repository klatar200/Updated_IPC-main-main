/**
 * Per-host PHP settings for the harness, written to _harness/out/php.d/local.ini.
 *
 * Two things the shipped php-*.ini files cannot say portably:
 *
 *  1. Which extensions to load. A Linux distro PHP brings gd/mbstring/fileinfo
 *     in through its conf.d scan directory, which `-c` does not suppress. PHP
 *     for Windows (the winget/zip build) has no php.ini and no scan directory,
 *     so `php -S -c _harness/php-mail.ini` and every CLI `php` a suite spawns
 *     ran with no gd: docmap, siteimages, audit5-medium, lowsA2-admin and
 *     adminaudit11 failed on photo uploads that production handles fine
 *     (measured 2026-11-01). `extension=gd` alone looks in C:\php\ext, so the
 *     absolute extension_dir has to be this machine's.
 *
 *  2. sendmail_path on Windows. PHP for Windows DOES honour sendmail_path, but
 *     runs it through `cmd.exe /c`, which treats `&&` and `>` as its own,
 *     strips the outer double quotes, and does not know single quotes at all.
 *     php-mail.ini's `sh -c '…walk up to fakemail.sh…'` therefore never ran:
 *     mail() returned true, contact.php said "sent", and nothing reached the
 *     mail log. Here it is `sh <absolute path>/fakemail.sh` — no quoting, no
 *     shell metacharacters — and since the path is absolute every private
 *     mirror finds it too, which is all the walk was for.
 *
 * Activated through PHP_INI_SCAN_DIR, which PHP reads even under `-c`. The
 * value starts with the path separator so a distro's compiled-in scan dir is
 * still scanned first. run.js sets it for every suite; a server started by
 * hand needs it on its command line (README, "On Windows").
 *
 *   node _harness/php-local.js        # write the file, print the directory
 *   require('./php-local').ensure()   # same, returns the env value
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = path.join(__dirname, 'out', 'php.d');
const FILE = path.join(DIR, 'local.ini');
const WANT = ['gd', 'mbstring', 'fileinfo'];

// What PHP has WITHOUT this file. With PHP_INI_SCAN_DIR inherited, `php -m`
// listed gd through local.ini itself, so the next ensure() — leadpath12 calls
// it under run.js — rewrote local.ini with no extensions, and every suite
// after it lost gd (measured 2026-11-01: A-7.6 green alone, red in a sweep).
const bareEnv = () => { const e = { ...process.env }; delete e.PHP_INI_SCAN_DIR; return e; };
function php(args) {
  const r = spawnSync('php', ['-n', ...args], { encoding: 'utf8', env: bareEnv() });
  return r.status === 0 ? r.stdout : '';
}

function ensure() {
  const lines = ['; Written by _harness/php-local.js for this machine. Do not commit.'];
  // What a plain `php` already has (its own php.ini and scan dir included).
  const plain = spawnSync('php', ['-m'], { encoding: 'utf8', env: bareEnv() }).stdout || '';
  const have = new Set(plain.split(/\r?\n/).map((s) => s.trim().toLowerCase()));
  const binDir = php(['-r', 'echo dirname(PHP_BINARY);']).trim();
  const extDir = binDir && path.join(binDir, 'ext');
  const missing = WANT.filter((e) => !have.has(e));
  const loadable = !extDir ? [] : missing.filter((e) =>
    fs.existsSync(path.join(extDir, `php_${e}.dll`)) || fs.existsSync(path.join(extDir, `${e}.so`)));
  if (loadable.length) {
    lines.push(`extension_dir = "${extDir.replace(/\\/g, '/')}"`);
    for (const e of loadable) lines.push(`extension = ${e}`);
  }
  if (process.platform === 'win32') {
    const fake = path.join(__dirname, 'fakemail.sh').replace(/\\/g, '/');
    if (/\s/.test(fake)) throw new Error(`php-local: ${fake} has a space; cmd.exe cannot run it unquoted`);
    lines.push(`sendmail_path = "sh ${fake}"`);
  }
  fs.mkdirSync(DIR, { recursive: true });
  const body = lines.join('\n') + '\n';
  if (!fs.existsSync(FILE) || fs.readFileSync(FILE, 'utf8') !== body) fs.writeFileSync(FILE, body);
  return { scanDir: path.delimiter + DIR, file: FILE, loaded: loadable, body };
}

module.exports = { ensure, DIR, FILE };

if (require.main === module) {
  const r = ensure();
  process.stdout.write(r.body);
  console.log(`\nPHP_INI_SCAN_DIR=${r.scanDir}`);
}
