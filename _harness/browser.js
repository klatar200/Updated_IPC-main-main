/**
 * Shared Chromium launcher for every harness script.
 *
 * The image ships Chromium build 1194 at PLAYWRIGHT_BROWSERS_PATH, but the
 * playwright npm package installed here expects a newer build and refuses to
 * launch ("Executable doesn't exist … chromium_headless_shell-1234"). Running
 * `npx playwright install` is explicitly not the fix in this environment — we
 * point at the pre-installed binary instead.
 *
 * Every script must launch through this module so the path lives in exactly
 * one place when the image's Chromium build changes.
 */

const fs = require('fs');
const { chromium } = require('playwright');

const CANDIDATES = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
];

function executablePath() {
  for (const p of CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;   // fall back to playwright's own resolution
}

async function launch(opts = {}) {
  return chromium.launch({ executablePath: executablePath(), ...opts });
}

module.exports = { launch, executablePath };
