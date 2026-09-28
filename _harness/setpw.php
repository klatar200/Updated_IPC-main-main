<?php
/**
 * Set the admin password to `audit-pass-123` IN THE MIRROR ONLY.
 *
 * Writes _harness/site/admin/config.local.php. Never touches the repo's
 * admin/config.local.php (gitignored, holds the live credential) and never
 * touches admin/config.php (which defines an unsatisfiable sentinel on
 * purpose — GUARDRAILS 2).
 *
 * preg_replace_callback, NOT preg_replace: every bcrypt hash contains
 * "$2y$12$" and those are backreferences in a replacement string. That bug
 * shipped once and made password changes 0% functional (invariant 1).
 *
 * Run after every mirror re-sync — `cp admin/*.php` overwrites nothing here
 * (config.local.php is not in the repo's admin/), but a fresh mirror has no
 * credential at all and every admin suite would 302 to auth.php.
 */

const HARNESS_PW = 'audit-pass-123';

$path = __DIR__ . '/site/admin/config.local.php';
if (!is_dir(dirname($path))) {
    fwrite(STDERR, "setpw: no mirror at " . dirname($path) . " — build it first\n");
    exit(1);
}

// Idempotent ON PURPOSE. Since SEC-4 a session is signed with the stored hash,
// so rewriting it — even for the same password, bcrypt salts differ — signs out
// every browser. sync.sh calls this, and audit9-fixes syncs AFTER logging in:
// an unconditional rewrite read as 4 failures that were the harness, not the
// admin (measured 2026-09-28, sweep6).
if (file_exists($path)
    && preg_match("/define\\(\\s*'ADMIN_PASSWORD_HASH'\\s*,\\s*'([^']+)'\\s*\\)\\s*;/", (string)file_get_contents($path), $cur)
    && password_verify(HARNESS_PW, $cur[1])) {
    echo "setpw: mirror password already '" . HARNESS_PW . "' — left as is\n";
    exit(0);
}

$hash = password_hash(HARNESS_PW, PASSWORD_BCRYPT, ['cost' => 12]);
$defineLine = "define('ADMIN_PASSWORD_HASH', '" . $hash . "');";
$re = "/define\\(\\s*'ADMIN_PASSWORD_HASH'\\s*,\\s*'[^']*'\\s*\\)\\s*;/";

if (file_exists($path)) {
    $body = (string)file_get_contents($path);
    $newBody = preg_replace_callback($re, static function () use ($defineLine) {
        return $defineLine;
    }, $body, 1, $replaced);
    if ($newBody === null) { $replaced = 0; $newBody = $body; }
    if (!$replaced) {
        $newBody = rtrim($newBody) . "\n" . $defineLine . "\n";
    }
} else {
    $newBody = "<?php\n"
             . "// TEST HARNESS CREDENTIAL — throwaway, mirror only.\n"
             . "// Password: " . HARNESS_PW . "\n"
             . "// Delete this file when the session ends (GUARDRAILS 4.2).\n"
             . $defineLine . "\n";
}

if (file_put_contents($path, $newBody, LOCK_EX) === false) {
    fwrite(STDERR, "setpw: could not write $path\n");
    exit(1);
}

// Read back and verify, the way admin_password_write() does.
$check = (string)file_get_contents($path);
$ok = preg_match("/define\\(\\s*'ADMIN_PASSWORD_HASH'\\s*,\\s*'([^']+)'\\s*\\)\\s*;/", $check, $m)
      && password_verify(HARNESS_PW, $m[1]);

if (!$ok) {
    fwrite(STDERR, "setpw: FAILED — written hash does not verify\n");
    exit(1);
}
echo "setpw: mirror password set to '" . HARNESS_PW . "' and verified\n";
