/**
 * Start the three sweep servers with this machine's PHP settings and keep them
 * running until Ctrl+C. Each logs to _harness/out/php<port>.log.
 *
 *   node _harness/servers.js              # 8123, 8124, 8125
 *   node _harness/servers.js 8123         # just the main one
 *
 * Same commands as the README's `php -S …` lines, plus PHP_INI_SCAN_DIR from
 * php-local.js — on Windows that is what loads gd and makes mail() reach
 * fakemail.sh. One process for all three also replaces "start each in its own
 * terminal".
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INI = { 8123: 'php-mail.ini', 8124: 'php-trunc.ini', 8125: 'php-nb2-off.ini' };
const ports = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(INI);
const env = { ...process.env };
if (!env.PHP_INI_SCAN_DIR) env.PHP_INI_SCAN_DIR = require('./php-local').ensure().scanDir;
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

const kids = ports.map((p) => {
  if (!INI[p]) throw new Error(`servers.js: no ini for port ${p} (known: ${Object.keys(INI).join(', ')})`);
  const log = fs.openSync(path.join(__dirname, 'out', `php${p}.log`), 'w');
  const k = spawn('php', ['-S', `127.0.0.1:${p}`, '-t', '_harness/site', '-c', `_harness/${INI[p]}`, '_harness/router.php'],
    { cwd: ROOT, env, stdio: ['ignore', log, log] });
  k.on('exit', (code) => { console.log(`:${p} exited (${code})`); process.exitCode = 1; });
  console.log(`:${p} pid ${k.pid}  ${INI[p]}`);
  return k;
});
const stop = () => { for (const k of kids) k.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
