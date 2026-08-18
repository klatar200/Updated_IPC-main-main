<?php
/**
 * IPC Admin — Shared Configuration
 * Edit these constants to match your server setup.
 */

// Path to products-all.json — relative to document root
define('PRODUCTS_JSON', __DIR__ . '/../data/products-all.json');

// Path to site-info.json (business details read by the React site) — same folder
define('SITE_INFO_JSON', __DIR__ . '/../data/site-info.json');

// Path to content.json (editable page content — homepage sections, etc.) — same folder
define('CONTENT_JSON', __DIR__ . '/../data/content.json');

// Path to PDF storage folder — relative to document root
define('PDF_DIR', __DIR__ . '/../pdfs/');

// Web URL to the PDF folder (used to build download links)
define('PDF_URL', '/pdfs/');

// Uploaded product images — lives OUTSIDE the Vite build output (like pdfs/)
// so redeploying the React app never clobbers customer-uploaded photos.
// Deployed once to public_html/uploads/images/, then written only by the admin.
define('IMG_DIR', __DIR__ . '/../uploads/images/');
define('IMG_URL', '/uploads/images/');

// Contact/RFQ inquiry log — appended by public_html/contact.php, read by
// admin/inquiries.php. Blocked from the web by admin/.htaccess (*.jsonl rule).
define('INQUIRIES_FILE', __DIR__ . '/inquiries.jsonl');

// Admin session key
define('ADMIN_SESSION_KEY', 'ipc_admin_authenticated');

// ─── Admin password ─────────────────────────────────────────
// There is NO shipped default password. The real hash lives in
// admin/config.local.php (gitignored, deployed by hand). This file only
// defines an intentionally-unsatisfiable sentinel so that a missing or
// damaged config.local.php fails CLOSED (nobody can sign in) instead of
// falling back to a password that is printed in the documentation.
//
// DO NOT call password_hash() here — it generates a new random salt each
// time and would break password_verify(). Always store a fixed string.
//
// RECOVERY (the password is lost, or config.local.php is gone):
//   1. Over FTP, upload an empty file named  admin/ALLOW-PASSWORD-RESET
//   2. Visit /admin/ in a browser — it shows a "Set admin password" form
//   3. Set the new password. The flag file is deleted automatically.
// Creating that file requires FTP/file-manager access, which is a stronger
// credential than the admin password itself, so this is not a bypass.
// The window closes ONE HOUR after the file's timestamp — see
// PASSWORD_RESET_WINDOW below. Re-upload the file to open a fresh hour.
// ────────────────────────────────────────────────────────────
if (file_exists(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}
// Sentinel: not a valid bcrypt digest, so password_verify() returns false for
// every input. ADMIN_PASSWORD_CONFIGURED tells the UI to offer recovery
// instead of an unpassable login box.
define('ADMIN_PASSWORD_SENTINEL', '*not-configured*');
if (!defined('ADMIN_PASSWORD_HASH')) {
    define('ADMIN_PASSWORD_HASH', ADMIN_PASSWORD_SENTINEL);
}
define('ADMIN_PASSWORD_CONFIGURED', ADMIN_PASSWORD_HASH !== ADMIN_PASSWORD_SENTINEL
    && preg_match('/^\$2[aby]\$\d{2}\$.{53}$/', ADMIN_PASSWORD_HASH) === 1);

// Proof-of-FTP flag that unlocks the one-time password-reset screen.
define('PASSWORD_RESET_FLAG', __DIR__ . '/ALLOW-PASSWORD-RESET');
define('LOCAL_CONFIG_PATH', __DIR__ . '/config.local.php');

// The reset window EXPIRES, and it is one hour wide.
//
// This used to be a bare file_exists() with no upper bound. Creating the flag
// needs FTP, so it is not a login bypass — but USING it needs nothing at all:
// csrf_check(false) binds the token to the requester's own session, so any
// unauthenticated client on the internet fetches auth.php, takes the token it
// is handed, POSTs a new password, and owns the account. That was fine as a
// 60-second window and unacceptable as an unbounded one, and the single most
// likely reason a reset is needed (an unwritable admin/ folder — the exact
// condition index.php already banners) is also the reason admin_password_write()
// fails, leaves the flag in place, and sends the owner to phone the developer
// with a world-writable password endpoint live on the public site.
//
// An hour is plenty to upload a file over FTP and type a password. Re-uploading
// or touching the file opens a fresh window. (AUDIT_v3_FINDINGS B2)
define('PASSWORD_RESET_WINDOW', 3600);

function password_reset_unlocked(): bool {
    if (!file_exists(PASSWORD_RESET_FLAG)) return false;
    clearstatcache(true, PASSWORD_RESET_FLAG);   // mtime is cached per request
    $mtime = @filemtime(PASSWORD_RESET_FLAG);
    if ($mtime === false) return false;
    return $mtime > (time() - PASSWORD_RESET_WINDOW);
}

/** The flag file is on disk, whether or not it is still in date. */
function password_reset_flag_present(): bool {
    clearstatcache(true, PASSWORD_RESET_FLAG);
    return file_exists(PASSWORD_RESET_FLAG);
}

/** Present but past its window: the login screen has to explain why the
 *  recovery form it promised is not there, or the owner just sees a password
 *  box he cannot satisfy and assumes the recovery is broken. */
function password_reset_expired(): bool {
    return password_reset_flag_present() && !password_reset_unlocked();
}

/**
 * Write a new admin password hash into admin/config.local.php.
 *
 * Single source of truth — admin/password.php (signed-in change) and
 * admin/auth.php (FTP-unlocked recovery) both call this. Preserves any other
 * defines already in the file, backs the old file up, writes, then reads back
 * and re-verifies; on any mismatch the backup is restored.
 *
 * Returns ['ok' => bool, 'error' => string].
 */
function admin_password_write(string $newPlain): array {
    $path = LOCAL_CONFIG_PATH;
    $hash = password_hash($newPlain, PASSWORD_BCRYPT, ['cost' => 12]);
    $defineLine = "define('ADMIN_PASSWORD_HASH', '" . $hash . "');";
    $re = "/define\\(\\s*'ADMIN_PASSWORD_HASH'\\s*,\\s*'[^']*'\\s*\\)\\s*;/";

    if (file_exists($path)) {
        $body = (string)file_get_contents($path);
        // preg_replace_callback, NOT preg_replace: every bcrypt hash contains
        // "$2y$12$", and preg_replace would eat $2/$12 as backreferences and
        // write a corrupt hash. That bug shipped and made password changes
        // 0% functional. Do not "simplify" this back.
        $newBody = preg_replace_callback($re, static function () use ($defineLine) {
            return $defineLine;
        }, $body, 1, $replaced);
        if ($newBody === null) { $replaced = 0; $newBody = $body; }
        if (!$replaced) {
            $newBody = rtrim($newBody) . "\n\n// Added by the IPC admin on " . date('Y-m-d H:i:s') . "\n" . $defineLine . "\n";
        }
    } else {
        $newBody = "<?php\n"
                 . "/**\n"
                 . " * IPC Admin — LOCAL password override (gitignored).\n"
                 . " * Generated by the IPC admin on " . date('Y-m-d H:i:s') . ".\n"
                 . " * config.php loads this file first, so the hash below is the one that counts.\n"
                 . " * There is no shipped default password to fall back to: if this file is\n"
                 . " * deleted, nobody can sign in until the ALLOW-PASSWORD-RESET recovery is used.\n"
                 . " */\n"
                 . $defineLine . "\n";
    }

    $backupPath = null;
    if (file_exists($path)) {
        $backupPath = $path . '.bak.' . date('Ymd-His');
        for ($i = 1; file_exists($backupPath) && $i < 100; $i++) {
            $backupPath = $path . '.bak.' . date('Ymd-His') . '-' . str_pad((string)$i, 2, '0', STR_PAD_LEFT);
        }
        @copy($path, $backupPath);
        $baks = glob($path . '.bak.*');
        if ($baks && count($baks) > 5) {
            sort($baks);
            foreach (array_slice($baks, 0, count($baks) - 5) as $old) @unlink($old);
        }
    }

    if (@file_put_contents($path, $newBody, LOCK_EX) === false) {
        return ['ok' => false, 'error' => 'Could not write admin/config.local.php — the admin/ folder must be writable by the web server.'];
    }

    // config.local.php is a PHP file, so an opcode cache will keep serving the
    // OLD compiled hash until it revalidates. Measured in the harness: with
    // opcache.revalidate_freq=2 the new password did not work for ~2 seconds
    // after a successful write. On a host with validate_timestamps=Off it
    // would never work. Invalidate explicitly.
    if (function_exists('opcache_invalidate')) {
        @opcache_invalidate($path, true);
    }

    $check = (string)@file_get_contents($path);
    $ok = preg_match("/define\\(\\s*'ADMIN_PASSWORD_HASH'\\s*,\\s*'([^']+)'\\s*\\)\\s*;/", $check, $m)
          && password_verify($newPlain, $m[1]);
    if (!$ok) {
        if ($backupPath && file_exists($backupPath)) @copy($backupPath, $path);
        return ['ok' => false, 'error' => 'Verification of the written file failed — the previous password was restored. Nothing changed.'];
    }
    @unlink(PASSWORD_RESET_FLAG); // a successful write closes any open reset window
    return ['ok' => true, 'error' => ''];
}

/** Shared password-strength rules for both the change and recovery screens. */
function admin_password_problems(string $new, string $confirm, bool $compareToCurrent = true): array {
    $errors = [];
    if (strlen($new) < 12) {
        $errors[] = 'The new password must be at least 12 characters. A short sentence or 4+ random words works well.';
    } elseif (strlen($new) > 200) {
        $errors[] = 'The new password is too long (200 characters max).';
    } elseif ($new !== $confirm) {
        $errors[] = 'The two new-password fields do not match.';
    } elseif ($compareToCurrent && ADMIN_PASSWORD_CONFIGURED && password_verify($new, ADMIN_PASSWORD_HASH)) {
        $errors[] = 'The new password must be different from the current one.';
    }
    return $errors;
}

/**
 * A POST field as a trimmed string, or $default if it is not a string at all.
 *
 * `name[]=x` makes $_POST['name'] an ARRAY, and an array must never reach
 * trim(). On PHP 8 that is an uncaught TypeError — an admin-side 500 with the
 * server path in it. On the target's PHP 7.4 it is WORSE, not better: a
 * warning, trim() returns null, and add.php would go on to create a product
 * with the field silently blank. content.php had the third variant, casting
 * (string)$array and saving the literal text "Array" under a green
 * "✅ Content saved". settings.php already guards this way via sf().
 * (AUDIT_v3_FINDINGS NB12)
 */
function post_str(string $key, string $default = ''): string {
    $v = $_POST[$key] ?? null;
    return is_string($v) ? trim($v) : $default;
}

/** Same guard for a value already pulled out of a nested $_POST array. */
function as_str($v, string $default = ''): string {
    return is_string($v) ? trim($v) : $default;
}

/**
 * Type guard WITHOUT trimming, for values where surrounding whitespace is
 * significant. A password is the case that matters — post_str()/as_str() would
 * silently change what was typed — and it is also the one unauthenticated
 * entry point, where `password[]=x` reached password_verify() as an array and
 * threw an uncaught TypeError. On PHP 8 that is a 500 whose stack trace prints
 * the absolute server path AND the first characters of the live bcrypt hash,
 * to an anonymous client. `display_errors` normally hides it, but that depends
 * on public/.user.ini having been uploaded (it is a dotfile, and the deploy
 * manifest omits it) and it does nothing at all under mod_php — so the page
 * must fail closed on its own. (audit-runs/audit5.md A-5.7)
 */
function raw_str($v, string $default = ''): string {
    return is_string($v) ? $v : $default;
}

// CSRF token helper — call csrf_token() to get/generate, csrf_check() to verify.
// Session is already started by the block at the bottom of this file before any
// page-level code runs, so no need to start it here.
function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * The shared admin stylesheet. Echo it in <head> BEFORE the page's own <style>.
 *
 * Why this exists
 * ---------------
 * There was no shared admin CSS at all: every page restated the reset, the body
 * rule, the buttons, the cards, the form controls and the alert boxes in its
 * own inline <style>, and they had drifted apart. `main { max-width }` alone
 * disagreed nine ways across thirteen pages — 1280, 1340, 1100, 1000, 900, 800,
 * 600, 520, 440 — so the admin had no consistent width at all, and the widest
 * page used barely half of a 2560px screen.
 *
 * ORDER IS THE WHOLE DESIGN. This block is emitted first and carries only the
 * MAJORITY variant of each rule; a page that genuinely differs keeps its own
 * declaration in its own <style>, which comes later in the document and so wins
 * at equal specificity. Nothing here uses !important and nothing here is more
 * specific than a single class, precisely so a page can still override it. That
 * is why extracting these rules changed no page's appearance: the deviating
 * pages still carry their deviations.
 *
 * The dead header rules are NOT here. Six pages carried their own
 * `header { background: #0d2d52; height: 60px; ... }`, plus `.logo`, `.logo-mark`,
 * `.logo-title`, `.logo-sub`, `nav a` and `.logout` — all of it targeting markup
 * that nav.php owns and all of it already outranked by nav.php's
 * `.ipc-admin-header ...` selectors (see the A10-021 note there, which had to
 * add `height: auto` specifically to beat these copies). `.logo-mark` had no
 * matching element on any page at all. Those rules were deleted from the pages
 * rather than moved here. help.php's `header { position: sticky }` was the one
 * live property among them and stays on help.php.
 *
 * auth.php is deliberately not a caller: it is the signed-out login card, has
 * no nav and no <main>, and shares none of this layout.
 */
function admin_head(): string {
    return <<<'CSS'
<style>
  /* ── Reset + page shell ─────────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }

  /* THE container rule. Mirrors .ipc-container on the public site
     (src/index.css) so the admin and the site it edits agree about how wide a
     page is: 1280px up to 1600, then 80% of the viewport.

     80vw AND NOT 80%, for the same reason as the public side — a percentage
     max-width resolves against the containing block, so it would measure
     differently depending on what each page nests <main> inside.

     The crossover is opt-in via .admin-wide rather than applied to every
     <main>, so the four genuinely narrow pages cannot be caught by it by
     accident. Password, Delete and the two upload pages are single-purpose
     forms — one file field, or one confirm button — and 80% of an ultrawide
     screen would stretch a 440px confirmation dialog across two feet of glass.
     They keep their own `main { max-width }` in their own <style>, which wins
     over the 1280px default below by source order. */
  main { width: 100%; max-width: 1280px; margin: 0 auto; padding: 32px 24px; }
  @media (min-width: 1600px) {
    main.admin-wide { max-width: 80vw; }
  }

  /* ── Typography ─────────────────────────────────────────────────────── */
  h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
  .sub { font-size: 13px; color: #6b7280; margin: 0 0 24px; }

  /* ── Cards ──────────────────────────────────────────────────────────── */
  .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 20px; }
  .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin: 0 0 20px; padding-bottom: 8px; border-bottom: 1px solid #e5e9ee; }

  /* ── Forms ──────────────────────────────────────────────────────────── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-group { margin-bottom: 16px; }
  .form-group.full { grid-column: 1 / -1; }
  label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 5px; }
  .hint { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  input[type=text], select, textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d9e0; border-radius: 7px; font-size: 13px; color: #141414; outline: none; font-family: inherit; transition: border-color 0.15s; }
  input[type=text]:focus, select:focus, textarea:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.1); }
  textarea { resize: vertical; }
  .mono { font-family: 'Courier New', monospace; font-size: 12px; }
  .form-actions { display: flex; gap: 10px; justify-content: flex-end; }

  /* ── Buttons ────────────────────────────────────────────────────────── */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; white-space: nowrap; transition: background 0.15s; }
  .btn-primary { background: #005da3; color: #fff; }
  .btn-primary:hover { background: #004e8c; }
  .btn-secondary { background: #fff; color: #141414; border: 1px solid #d1d9e0; }
  .btn-secondary:hover { background: #f0f4f8; }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .btn-edit { background: rgba(0,93,163,0.08); color: #005da3; }
  .btn-edit:hover { background: rgba(0,93,163,0.15); }
  .btn-danger { background: rgba(220,38,38,0.08); color: #dc2626; }
  .btn-danger:hover { background: rgba(220,38,38,0.15); }
  .btn-pdf { background: rgba(0,190,242,0.1); color: #0369a1; }
  .btn-pdf:hover { background: rgba(0,190,242,0.2); }

  /* ── Alerts ─────────────────────────────────────────────────────────── */
  .alert { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; }
  .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
  .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  /* F3 — the "nothing to save" banner. Deliberately informational rather than
     green: the save DID succeed, but telling the owner "Saved" when no byte
     changed is what trained him not to trust the banner. Palette matches
     help.php's .callout-tip. */
  .alert-info { background: #eff8ff; color: #0c4a6e; border: 1px solid #bfe0f7; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
  .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
  .error-list li { font-size: 13px; margin-bottom: 4px; }
</style>
CSS;
}

// A bare `die('Invalid CSRF token…')` was what an admin saw when his session
// expired mid-edit: an unstyled white page, no navigation, no mention that his
// unsaved work was still recoverable, on the one page (long About paragraphs,
// FAQ answers) where he is most likely to have walked away mid-sentence.
// (DEPLOY_READINESS_v2 T1.8)
function csrf_fail_page(string $reason): void {
    http_response_code(403);
    header('Content-Type: text/html; charset=UTF-8');
    $expired  = $reason === 'expired';
    $tooLarge = $reason === 'toolarge';
    if ($tooLarge) {
        $title = 'That upload was too large for this server';
        $lead  = 'The whole request was rejected before it reached the admin, so <strong>nothing was saved</strong>. '
               . 'This server accepts up to <strong>' . h(ini_get('post_max_size') ?: '?') . '</strong> per request and '
               . '<strong>' . h(ini_get('upload_max_filesize') ?: '?') . '</strong> per file. '
               . 'Use a smaller file, or ask your developer to raise the limits in <code>.user.ini</code>.';
    } else {
        $title = $expired ? 'Your sign-in session expired' : 'This form could not be verified';
        $lead  = $expired
            ? 'You were signed out while this page was open, so the save was refused. <strong>Your typing is not lost</strong> — it is still in the previous page.'
            : 'The security token on this form did not match. Nothing was saved.';
    }
    echo '<!doctype html><html lang="en"><head><meta charset="UTF-8">'
       . '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
       . '<title>IPC Admin — ' . h($title) . '</title><style>'
       . '*,*::before,*::after{box-sizing:border-box}'
       . 'body{font-family:system-ui,sans-serif;background:#f0f4f8;margin:0;color:#141414;'
       . 'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}'
       . '.card{background:#fff;border:1px solid #e5e9ee;border-radius:12px;padding:32px;max-width:560px}'
       . 'h1{font-size:20px;font-weight:800;margin:0 0 10px}'
       . 'p{font-size:14px;line-height:1.6;color:#374151;margin:0 0 14px}'
       . 'ol{font-size:14px;line-height:1.7;color:#374151;padding-left:20px;margin:0 0 20px}'
       . '.btn{display:inline-block;padding:11px 18px;border-radius:8px;font-size:14px;font-weight:600;'
       . 'text-decoration:none;border:1px solid #d1d9e0;background:#fff;color:#141414;cursor:pointer;margin-right:8px}'
       . '.btn-primary{background:#005da3;color:#fff;border-color:#005da3}'
       . '</style></head><body><div class="card"><h1>' . h($title) . '</h1><p>' . $lead . '</p>';
    if ($expired) {
        echo '<ol>'
           . '<li>Click <strong>Back to my unsaved page</strong> below — the browser restores what you typed.</li>'
           . '<li>Open <a href="auth.php" target="_blank" rel="noopener">the sign-in page</a> in a <strong>new tab</strong> and sign in again.</li>'
           . '<li>Return to your page and click Save. It will go through.</li>'
           . '</ol>'
           . '<p><button type="button" class="btn btn-primary" onclick="history.back()">← Back to my unsaved page</button>'
           . '<a class="btn" href="auth.php">Sign in again</a></p>';
    } else {
        echo '<p><button type="button" class="btn btn-primary" onclick="history.back()">← Go back</button>'
           . '<a class="btn" href="index.php">Dashboard</a></p>';
    }
    echo '</div></body></html>';
    exit;
}

// $requireAuth = false for the two pre-login POSTs that still carry a token:
// the logout form and the FTP-unlocked password-reset form in auth.php.
function csrf_check(bool $requireAuth = true): void {
    // A request larger than post_max_size arrives with $_POST AND $_FILES both
    // empty, so the CSRF check is what fails first and the admin saw a bare
    // 403 "Invalid CSRF token" for what is really "your file is too big".
    // (DEPLOY_READINESS_v2 T3.5)
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'
        && empty($_POST) && empty($_FILES)
        && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        csrf_fail_page('toolarge');
    }
    $token        = raw_str($_POST['csrf_token'] ?? null);   // A-5.7 — csrf_token[]=x fatalled all 11 mutating pages through this one line
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    // No session token at all means the session itself is gone (expired or
    // garbage-collected), which is a different problem from a mismatched one.
    if ($sessionToken === '' || ($requireAuth && !is_authenticated())) {
        csrf_fail_page('expired');
    }
    if (!hash_equals($sessionToken, $token)) {
        csrf_fail_page('mismatch');
    }
}

// Harden session cookies BEFORE session_start() — these flags only take
// effect on the cookie that session_start() sets, so they have to be
// configured first.
if (session_status() === PHP_SESSION_NONE) {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    // PHP's default session.gc_maxlifetime is 1440s (24 min). The admin writes
    // long-form copy — About paragraphs, FAQ answers, product descriptions —
    // and losing a session mid-sentence is exactly the failure this release is
    // supposed to remove. 8 hours covers a working day. The session cookie is
    // still browser-session-scoped (lifetime 0) so closing the browser signs
    // out. (DEPLOY_READINESS_v2 T1.8)
    @ini_set('session.gc_maxlifetime', '28800');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $secure,   // only send over HTTPS (auto-disabled on plain HTTP for local dev)
        'httponly' => true,      // JS can't read the cookie
        'samesite' => 'Lax',     // mitigate CSRF on top-level navigations
    ]);
    session_name('IPCADMIN');    // hide the default PHPSESSID fingerprint
    session_start();
}

// Call this immediately after a successful password check to prevent session
// fixation. Preserves any flash state by re-copying $_SESSION into the new id.
function regenerate_session_id(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
}

// Helper: check if admin is logged in
function is_authenticated(): bool {
    return !empty($_SESSION[ADMIN_SESSION_KEY]);
}

// Helper: redirect to login if not authenticated.
// On a POST we must NOT redirect: a 302 turns the POST into a GET and throws
// away everything the admin just typed, with no explanation. Render the
// styled "your session expired, your typing is still in the previous page"
// screen instead. (DEPLOY_READINESS_v2 T1.8)
function require_auth(): void {
    if (is_authenticated()) return;
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        csrf_fail_page('expired');
    }
    header('Location: auth.php');
    exit;
}

/**
 * Write JSON to $path so a reader never sees a half-written file.
 *
 * The three save_*() helpers used to end in
 * `file_put_contents($path, $json, LOCK_EX) !== false`, which has two holes:
 *
 *  1. file_put_contents() truncates the target when it opens it, so ANY write
 *     that dies part-way — a quota ceiling, a process killed by the host's
 *     resource limiter — leaves the LIVE file truncated. Every loader maps a
 *     corrupt file onto the same value as a missing one
 *     (`if (!is_array($data)) return []`), so the catalog came back as zero
 *     products with nothing reporting a problem: the dashboard read "0 products
 *     across 0 categories" with no health banner (data_writable() is still
 *     true), and the next Add Product appended to that empty array and saved a
 *     ONE-product catalog under a success message. Reproduced under
 *     `ulimit -f 100`: 102,400 of 300,000 bytes on disk, and load_products()
 *     then returned 0 with "Control character error".
 *  2. It returns the number of bytes WRITTEN, so a short write on a full disk
 *     is a positive integer, and `!== false` called that success.
 *
 * Writing to a temp file in the same directory and rename()-ing over the target
 * fixes both: rename() within a filesystem is atomic, so a reader gets either
 * the whole old file or the whole new one, and a failed write never touches the
 * live file. The byte count is checked before the rename.
 *
 * The temp name ends in `.tmp` on purpose — data/.htaccess blocks that suffix,
 * so a leftover from a killed process is not web-readable.
 * (audit-runs/audit5.md A-5.5)
 */
function json_write_atomic(string $path, string $json): bool {
    $tmp   = $path . '.' . getmypid() . '-' . mt_rand(1000, 999999) . '.tmp';
    $bytes = @file_put_contents($tmp, $json);
    if ($bytes === false || $bytes !== strlen($json)) {
        @unlink($tmp);
        return false;
    }
    // Carry the replaced file's permissions across; a fresh temp file is
    // created under the process umask, which is not always the same thing.
    $perms = @fileperms($path);
    if ($perms !== false) @chmod($tmp, $perms & 0777);
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

// Helper: load products array from JSON
function load_products(): array {
    $path = PRODUCTS_JSON;
    if (!file_exists($path)) return [];
    $json = file_get_contents($path);
    $data = json_decode($json, true);
    if (!is_array($data)) return [];
    // Handle both plain array and { products: [...] } formats
    if (isset($data['products'])) return $data['products'];
    return $data;
}

// ─── Backup-on-write: single source of truth ────────────────────────────────
// Every save_*() routes through backup_before_write(). Two invariants, each of
// which broke a real restore:
//   1. date('Ymd-His') is second-granular. Two POSTs in the same second (a
//      double-click on Save) used to make the second copy() overwrite the
//      first one's backup with the ALREADY-MODIFIED file, leaving zero copies
//      of the pre-edit state. A -NN sequence suffix fixes that.
//   2. Keeping 5 counted *saves*, not *mistakes* — every photo upload, PDF
//      upload, add, delete and restore is a full-catalog save, so an ordinary
//      afternoon rotated the pre-mistake state off the disk. Keep 30.
define('BACKUP_KEEP', 30);

// Returns a path that does not already exist: prefix.backup.YYYYmmdd-His.json,
// then -01, -02 … within the same second.
//
// The sequence is max-already-used + 1, NOT first-free. First-free reuses a
// slot that rotation has just pruned, which scrambles the ordering — measured:
// with 44 same-second saves and keep=30, the surviving set came back as
// seq 1..30 holding a mix of old and new states instead of the newest 30.
function backup_path(string $dir, string $prefix): string {
    $stamp = date('Ymd-His');
    $base  = $dir . '/' . $prefix . '.backup.' . $stamp;
    $used  = -1;
    foreach (glob($base . '*.json') ?: [] as $f) {
        $k = backup_sort_key($f);
        if ($k[1] > $used) $used = $k[1];
    }
    if ($used < 0) return $base . '.json';           // sequence 0 = plain name
    $next = $used + 1;
    // Past 99 this used to fall back to bin2hex(random_bytes(3)), which throws
    // the ordering away entirely: backup_sort_key() cannot rank a random suffix,
    // scores every one of them 99, and pruning then deletes NEWER backups than
    // it keeps (measured with 140 saves inside one second: "monotonic in save
    // order? NO"). Just keep counting — "-100" sorts after "-99" once the
    // sequence is compared as an integer, which it already is.
    // (AUDIT_v3_FINDINGS NB13)
    if ($next > 9999) return $base . '-9999.json';   // absurd; stop allocating
    return $base . '-' . str_pad((string)$next, 2, '0', STR_PAD_LEFT) . '.json';
}

// Copy $path aside, then prune to the BACKUP_KEEP most recent.
//
// Returns the backup that now represents this content — the file just written,
// or the existing newest one when the copy was skipped as a duplicate. Returns
// null when there was nothing to back up (no file yet) or the copy failed.
//
// RETURN-VALUE AUDIT (F1): this has exactly three call sites — save_products(),
// save_site_info() and save_content(), all below — and not one of them looks at
// the result; each calls it as a bare statement. So nothing in the admin can
// mistake the new "skipped" outcome for the pre-existing "failed" one. The
// distinction is still worth making rather than returning null for both, so
// that a future caller which does check gets a truthful answer instead of an
// error for a file that is safely backed up already.
function backup_before_write(string $path, string $prefix): ?string {
    $dir = dirname($path);
    if (!file_exists($path)) return null;

    // F1 — do not copy a file we already have an identical copy of.
    //
    // This ran unconditionally on every write, and eleven save_*() call sites
    // across eight files route through it — every photo upload, PDF upload,
    // add, delete and restore is a full-catalog save. The Backups page filled
    // with runs of entries that were all "42 products / 241 KB", and with
    // BACKUP_KEEP at 30 those duplicates EVICT recoverable states: a busy
    // afternoon could push the real pre-mistake copy off the end of the list,
    // which is exactly what help.php warns about. Skipping identical copies is
    // what makes the 30 slots hold 30 distinct states.
    //
    // Compared against the newest backup only, not all 30: backups are written
    // in order, so anything the current file could duplicate is the last one
    // written. Size first because it settles the common "genuinely changed"
    // case with a stat instead of reading 241KB twice; hash_file() only runs
    // when the sizes already agree.
    $existing = backup_list($dir, $prefix); // oldest first
    if ($existing) {
        $newest = $existing[count($existing) - 1];
        $sizeA = @filesize($path);
        $sizeB = @filesize($newest);
        if ($sizeA !== false && $sizeA === $sizeB) {
            $hashA = @hash_file('sha256', $path);
            $hashB = @hash_file('sha256', $newest);
            if ($hashA !== false && $hashA === $hashB) return $newest;
        }
    }

    $backupPath = backup_path($dir, $prefix);
    if (!@copy($path, $backupPath)) return null;
    $backups = backup_list($dir, $prefix); // oldest first, by parsed (stamp, seq)
    if (count($backups) > BACKUP_KEEP) {
        foreach (array_slice($backups, 0, count($backups) - BACKUP_KEEP) as $old) @unlink($old);
    }
    return $backupPath;
}

// F2 — is this write worth doing at all?
//
// Compares the ENCODED JSON against what is on disk, byte for byte, and not
// the input array against the loaded one. That distinction is the whole point
// for save_products(): it sorts by SKU before encoding, so an array that is
// merely in a different order is not "changed" — the file it would produce is
// identical. Comparing arrays would call that a change and write it.
//
// A missing or unreadable file always needs the write.
function json_write_needed(string $path, string $json): bool {
    if (!is_file($path)) return true;
    $current = @file_get_contents($path);
    return $current === false || $current !== $json;
}

// Set by the three save_*() helpers below; read by the pages that want to say
// "No changes to save" instead of "Saved". A no-op save is a SUCCESS — see the
// note on save_products() — so a page cannot tell the two apart from the bool.
$GLOBALS['ipc_last_save_noop'] = false;

/** True when the most recent save_*() call found the file already correct. */
function last_save_was_noop(): bool {
    return !empty($GLOBALS['ipc_last_save_noop']);
}

// All backups for one prefix, OLDEST FIRST.
//
// Two orderings that look right and are NOT (both measured, not guessed):
//   - Plain sort(): the -NN collision suffix makes "…-120000-01.json" sort
//     BEFORE "…-120000.json", because "-" (0x2D) < "." (0x2E). Pruning by name
//     would delete the NEWEST file of a same-second pair.
//   - filemtime(): 1-second resolution, so every file written inside one
//     second ties and the sort falls back to glob order — the same bug.
// Sort on the parsed (timestamp, sequence) instead. Sequence 0 is the plain
// name, which backup_path() always allocates first within a second.
// The [0-9a-f]{6} alternative is kept only to rank files a PREVIOUS revision
// already wrote; backup_path() no longer emits them. (AUDIT_v3_FINDINGS NB13)
function backup_sort_key(string $file): array {
    if (preg_match('/\.backup\.(\d{8})-(\d{6})(?:-(\d{2,4}|[0-9a-f]{6}))?\.json$/', basename($file), $m)) {
        $seq = !isset($m[3]) || $m[3] === '' ? 0 : (ctype_digit($m[3]) ? (int)$m[3] : 99);
        return [$m[1] . $m[2], $seq];
    }
    return ['00000000000000', 0]; // unparseable name → treat as oldest
}

function backup_list(string $dir, string $prefix): array {
    $files = glob($dir . '/' . $prefix . '.backup.*.json') ?: [];
    usort($files, static function ($a, $b) {
        $ka = backup_sort_key($a);
        $kb = backup_sort_key($b);
        return $ka[0] === $kb[0] ? $ka[1] <=> $kb[1] : strcmp($ka[0], $kb[0]);
    });
    return $files;
}

// Helper: save products array to JSON
// Uses LOCK_EX to prevent corruption from concurrent writes.
// Creates a timestamped backup before overwriting.
// F2 — encode FIRST, then decide whether the write is needed at all. The
// backup no longer happens before we know there is something to back up: a
// save that changes nothing now touches neither the JSON file nor the backup
// folder.
//
// A no-op still returns TRUE. From the owner's point of view he pressed Save
// and the file says what he wanted it to say, which is success; returning
// false would surface "could not save" for a file that is already correct, and
// would strand the optimistic-concurrency pages on an error page instead of
// redirecting and refreshing their signature. Pages that want to word it
// differently read last_save_was_noop().
function save_products(array $products): bool {
    $path = PRODUCTS_JSON;
    $dir  = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    // Sort by SKU before saving
    usort($products, fn($a, $b) => strcmp($a['sku'] ?? '', $b['sku'] ?? ''));
    $json = json_encode($products, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    // json_encode() returns false on invalid UTF-8, which a form post can
    // carry. file_put_contents($path, false) writes an EMPTY FILE and returns
    // 0, which is !== false — so the catalog would be blanked and reported as
    // saved. Fail loudly instead and leave the file alone.
    if ($json === false) { $GLOBALS['ipc_last_save_noop'] = false; return false; }
    if (!json_write_needed($path, $json)) {
        $GLOBALS['ipc_last_save_noop'] = true;
        return true;
    }
    $GLOBALS['ipc_last_save_noop'] = false;
    backup_before_write($path, 'products-all');
    return json_write_atomic($path, $json);   // A-5.5 — temp file + atomic rename
}

// Helper: load business details (site-info.json). Returns [] if missing/invalid.
function load_site_info(): array {
    if (!file_exists(SITE_INFO_JSON)) return [];
    $json = file_get_contents(SITE_INFO_JSON);
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
}

// Helper: save business details. Mirrors save_products(): timestamped backup
// (keep BACKUP_KEEP), LOCK_EX write. The React site reads this file at runtime.
function save_site_info(array $info): bool {
    $path = SITE_INFO_JSON;
    $dir  = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $json = json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) { $GLOBALS['ipc_last_save_noop'] = false; return false; }
    if (!json_write_needed($path, $json)) {          // F2
        $GLOBALS['ipc_last_save_noop'] = true;
        return true;
    }
    $GLOBALS['ipc_last_save_noop'] = false;
    backup_before_write($path, 'site-info');
    return json_write_atomic($path, $json);
}

// Helper: load editable page content (homepage sections, etc.). Returns [] if
// missing so callers can fall back to their seed defaults.
function load_content(): array {
    if (!file_exists(CONTENT_JSON)) return [];
    $json = file_get_contents(CONTENT_JSON);
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
}

/**
 * The built-in product families, in catalogue order.
 *
 * THIS IS A SECOND COPY OF src/App.jsx's FAMILY_ORDER, and that is deliberate.
 * One copy across two languages is not achievable without a build step, and
 * this codebase already has an answer for exactly this shape of problem:
 * `$COPY_GROUPS` here and `COPY_DEFAULTS` in App.jsx are two copies kept honest
 * by `_harness/copydrift.js`, which FAILS the build when they diverge. The same
 * check now covers this list (`lint.php` -> "family drift"), so the pair cannot
 * drift silently the way the three `$partTypes`/FAMILY_ORDER literals could.
 *
 * What changed is not the number of copies — it is that a copy which disagrees
 * is now a build failure instead of an invisible defect.
 */
/**
 * The approval vocabulary, and how a product's approvals are read.
 *
 * Certifications used to live only in free text. Measured 2026-08-07: 112
 * distinct badge strings across 42 products, ~20 of them carrying an approval
 * in 20 different spellings — "U/L CSA", "U/L CSA MIL-Spec.", "U/L CSA and
 * MIL-SPEC", "U/L, MIL-Spec.", "UL & CSA Approved". Nothing could count,
 * filter or list them, and the badge field UNDERSTATED the catalogue: read the
 * whole record and MIL-SPEC goes 5 -> 12 products, UL VW-1 goes 1 -> 11, and
 * products with at least one approval go 23 -> 30.
 *
 * This list is duplicated in src/App.jsx (APPROVALS). PHP and JS cannot share
 * a constant without a build step, so the two are held together by
 * _harness/lint.php's `approval drift` check on the names and, more usefully,
 * by _harness/plan7-approvals.js comparing what each one DERIVES for all 42
 * products. Behaviour is the thing that has to agree; the regex spelling does
 * not.
 */
const IPC_APPROVALS = [
    'UL Recognized', 'UL Listed', 'UL Approved', 'cUL', 'CSA', 'MIL-SPEC',
    'RoHS', 'FDA', 'USP Class VI', 'ISO 10993-5', 'UL VW-1', 'UL-94',
];

/**
 * Word boundaries are load-bearing. Two real badge strings are "Ultra Clear"
 * and "Encapsulating"; both contain the letters "ul", and a naive /ul/i match
 * reports both as UL approvals. That is also the reason this is a migration
 * and not a permanent reader: you cannot recover structured facts from prose
 * reliably, and a page that tries is wrong in ways nobody notices.
 */
const IPC_APPROVAL_PATTERNS = [
    // Second alternative: the reversed, spelled-out phrasing. CT reads
    // "Recognized under the Components program of Underwriters' Laboratories".
    // See the matching comment in src/App.jsx APPROVALS — plan7-approvals.js
    // compares the DERIVED sets, so these two must move together.
    'UL Recognized' => '/\bU\/?L\b[^.;]{0,18}\bRecognized\b|\bRecognized\b[^.;]{0,60}\bUnderwriters\'?\s+Laborator(?:y|ies)\b/i',
    'UL Listed'     => '/\bU\/?L\b[^.;]{0,18}\bListed\b/i',
    'UL Approved'   => '/\bU\/?L\b[^.;]{0,18}\bApproved\b/i',
    'cUL'           => '/\bCUL\b/i',
    'CSA'           => '/\bCSA\b/i',
    'MIL-SPEC'      => '/\bMIL[\s-]?SPEC\b|\bAMS\b/i',
    'RoHS'          => '/\bRoHS\b/i',
    'FDA'           => '/\b(?:US)?FDA\b/i',
    'USP Class VI'  => '/\bUSP\b[^.;]{0,12}\bClass\s*VI\b/i',
    'ISO 10993-5'   => '/\bISO\s?10993/i',
    'UL VW-1'       => '/\bVW-?1\b/i',
    'UL-94'         => '/\bUL-?94\b/i',
];

/** Everything on a product that can legitimately name an approval. */
function ipc_approval_haystack(array $p): string {
    return implode(' | ', [
        implode(' ', (array)($p['badges'] ?? [])),
        (string)($p['specificationsSummary'] ?? ''),
        implode(' ', (array)($p['description'] ?? [])),
        // JSON_UNESCAPED_SLASHES is load-bearing: without it json_encode turns
        // "U/L Recognized" into "U\/L Recognized" and \bU\/?L\b stops matching,
        // so PHP derived one fewer approval than JS for IP17TW-IP18SW-IP19LW.
        // JS's JSON.stringify does not escape slashes. Caught by
        // plan7-approvals.js comparing the two derivations, not by reading them.
        json_encode($p['specTable1'] ?? [], JSON_UNESCAPED_SLASHES),
    ]);
}

/**
 * A product's approvals: the stored field if the product HAS one, otherwise
 * derived from its text.
 *
 * The test is `array_key_exists`, never truthiness. A product whose owner
 * unticked every box stores `approvals: []`, and that means "no approvals" —
 * re-deriving there would resurrect exactly what he removed. This is
 * invariant 3's lesson (mergeContent treats an empty array as a deletion)
 * applied to a new field, and the first draft of this feature had the bug.
 */
function ipc_product_approvals(array $p): array {
    if (array_key_exists('approvals', $p) && is_array($p['approvals'])) {
        // Whitelist on read too: a hand-edited catalogue must not put an
        // unknown string into a filter chip.
        return array_values(array_intersect(IPC_APPROVALS, $p['approvals']));
    }
    $hay = ipc_approval_haystack($p);
    $out = [];
    foreach (IPC_APPROVAL_PATTERNS as $name => $rx) {
        if (preg_match($rx, $hay)) {
            $out[] = $name;
        }
    }
    return $out;
}

const IPC_DEFAULT_FAMILIES = [
    'Polyolefin Heat Shrink', 'PVDF Heat Shrink', 'Dual-Wall Heat Shrink',
    'Medical Grade Heat Shrink', 'Elastomeric Heat Shrink', 'Fiberglass Sleeving',
    'Expandable Sleeving', 'End Cap', 'Tape', 'Adhesive', 'Accessory',
];

/**
 * The product family names, in order — the owner's list if he has one,
 * otherwise the built-in defaults.
 *
 * MIRRORS familyOrder() in src/App.jsx, and the fallback behaviour must match:
 * an EMPTY list falls back rather than being honoured as a deletion. That is a
 * deliberate departure from the "empty array is a real deletion" rule the other
 * content sections follow (invariant 3). Measured reason: with no order the
 * catalogue sidebar initialises every family accordion CLOSED and its 41
 * reachable product links become 0. (It does NOT drop everything into "Other" —
 * that was the first guess and it is wrong; see familyOrder() in src/App.jsx.)
 *
 * These eleven names used to be a literal in add.php and another in edit.php,
 * alongside App.jsx's. `_harness/plan6-families.js` asserts there is now exactly
 * one copy in the tree; `_harness/lint.php` fails the build if a second appears.
 */
function ipc_product_families(): array {
    $rows = load_content()['productFamilies'] ?? null;
    $names = [];
    if (is_array($rows)) {
        foreach ($rows as $r) {
            $n = is_array($r) ? trim((string)($r['name'] ?? '')) : '';
            if ($n !== '' && !in_array($n, $names, true)) $names[] = $n;
        }
    }
    return $names ?: IPC_DEFAULT_FAMILIES;
}

// Helper: save editable page content. Mirrors save_site_info(): timestamped
// backup (keep BACKUP_KEEP), LOCK_EX write. The React site reads this file at runtime.
function save_content(array $content): bool {
    $path = CONTENT_JSON;
    $dir  = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $json = json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) { $GLOBALS['ipc_last_save_noop'] = false; return false; }
    if (!json_write_needed($path, $json)) {          // F2
        $GLOBALS['ipc_last_save_noop'] = true;
        return true;
    }
    $GLOBALS['ipc_last_save_noop'] = false;
    backup_before_write($path, 'content');
    return json_write_atomic($path, $json);
}

/**
 * Every action name audit_log() is ever called with, in display order.
 *
 * ONE list, because there were three and nothing compared them: the `<option>`
 * filter in audit-log.php, the colour switch beside it, and the call sites
 * themselves. That is precisely the shape of DEPLOY_READINESS_v2 4.34, where
 * the filter offered `import` — a feature that exists nowhere in the codebase —
 * so choosing it always returned "No entries match", and nothing could have
 * told anyone. The reverse case is worse and was live until this release: the
 * three sign-in actions A-09 adds would have been written to the log and been
 * unfilterable.
 *
 * `_harness/lint.php`'s "audit-action drift" check compares this list against
 * the literal first argument of every audit_log() call under admin/ and
 * public/, in BOTH directions, and fails the build on either mismatch — the
 * same treatment the family, approval and copy-key lists already get.
 * (audit-runs/audit1.md A-15)
 */
const IPC_AUDIT_ACTIONS = [
    'add', 'edit', 'delete',
    'upload-pdf', 'remove-pdf', 'upload-image', 'remove-image',
    'settings', 'content', 'restore', 'password',
    'sign-in', 'sign-out', 'sign-in-failed',
];

// Helper: write a line to the admin audit log (#6 — audit logging).
// Returns false if the write failed — on a host where the PHP user differs
// from the FTP user, admin/ is not writable and the log, the inquiry file and
// the login throttle ALL silently no-op. admin_writable() surfaces that on the
// dashboard instead of leaving it invisible (DEPLOY_READINESS_v2 §3.3).
// Rotation ceiling for admin-log.jsonl. inquiries.jsonl has had one since B3;
// this file had none, and it grows on every save AND on every failed sign-in —
// so a single credential scanner appends to it forever. Same size and the same
// never-delete-the-archive rule as the inquiry log. (audit-runs/audit5.md A-5.4)
define('ADMIN_LOG_ROTATE_BYTES', 16 * 1024 * 1024);

function audit_log(string $action, string $sku, string $detail = ''): bool {
    $logPath = __DIR__ . '/admin-log.jsonl';
    if (is_file($logPath) && @filesize($logPath) >= ADMIN_LOG_ROTATE_BYTES) {
        @rename($logPath, __DIR__ . '/admin-log-' . date('Y-m-d-His') . '.jsonl');
    }
    $entry = json_encode([
        'ts'     => date('Y-m-d H:i:s'),
        'action' => $action,
        'sku'    => $sku,
        'detail' => $detail,
        'ip'     => $_SERVER['REMOTE_ADDR'] ?? '',
        'ua'     => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 120),
    ]) . "\n";
    return @file_put_contents($logPath, $entry, FILE_APPEND | LOCK_EX) !== false;
}

/**
 * New-lead counter for the admin chrome.
 *
 * `mail()` returning true means the local MTA ACCEPTED the message, nothing
 * more. The far more common shared-hosting outcome — accepted, then
 * SPF/DKIM-rejected, greylisted or spam-foldered at the recipient — is
 * indistinguishable from delivery here, and it was recorded as `sent: true`
 * and rendered with a green "Emailed" badge.
 *
 * The inquiry log is the designed safety net and it is complete: every path,
 * including every rejection, writes a record before exiting. What it lacked was
 * any way to be NOTICED. Nothing in the dashboard, the nav or anywhere else
 * said "leads arrived that you have not read", so a quiet month and a month of
 * silently undelivered quote requests looked exactly the same to the owner.
 *
 * Counting is streamed, so it stays O(1) memory whatever the file grows to, and
 * the seen-marker is a single integer written when the Inquiries page renders.
 * (audit-runs/audit5.md A-5.6)
 */
define('INQUIRIES_SEEN_FILE', __DIR__ . '/.inquiries-seen.json');

function inquiries_total_count(): int {
    $path = __DIR__ . '/inquiries.jsonl';
    $fh = @fopen($path, 'rb');
    if (!$fh) return 0;
    $n = 0;
    while (($chunk = fread($fh, 1024 * 1024)) !== false && $chunk !== '') {
        $n += substr_count($chunk, "\n");
    }
    fclose($fh);
    return $n;
}

function inquiries_seen_state(): array {
    $raw = @file_get_contents(INQUIRIES_SEEN_FILE);
    if ($raw === false) return ['seen' => 0, 'size' => -1];
    $d = json_decode((string)$raw, true);
    if (!is_array($d)) return ['seen' => 0, 'size' => -1];
    return ['seen' => max(0, (int)($d['seen'] ?? 0)), 'size' => (int)($d['size'] ?? -1)];
}

function inquiries_mark_seen(int $n): void {
    $size = @filesize(__DIR__ . '/inquiries.jsonl');
    @file_put_contents(
        INQUIRIES_SEEN_FILE,
        json_encode(['seen' => $n, 'size' => $size === false ? 0 : $size, 'ts' => date('c')]),
        LOCK_EX
    );
}

/** Newlines in [$from, $to) — the bytes appended since the mark. */
function inquiries_count_range(string $path, int $from, int $to): int {
    $fh = @fopen($path, 'rb');
    if (!$fh) return 0;
    if ($from > 0) fseek($fh, $from);
    $n = 0;
    $remaining = $to - $from;
    while ($remaining > 0 && ($chunk = fread($fh, min(1024 * 1024, $remaining))) !== false && $chunk !== '') {
        $n += substr_count($chunk, "\n");
        $remaining -= strlen($chunk);
    }
    fclose($fh);
    return $n;
}

/**
 * Unread count. A seen-marker ABOVE the total means the log rotated at its
 * 16MB ceiling and started again, so the marker no longer refers to this file;
 * treat everything in the new file as unread rather than silently reporting
 * zero, because under-reporting is the failure this whole function exists to
 * prevent.
 */
function inquiries_new_count(): int {
    $path = __DIR__ . '/inquiries.jsonl';
    if (!is_file($path)) return 0;
    $size  = (int)@filesize($path);
    $state = inquiries_seen_state();

    // nav.php calls this on EVERY admin page, and the log is allowed to reach
    // 16MB before it rotates, so counting the whole file each time would put a
    // 16MB read on every page view. The file only ever appends, so the size at
    // the moment of the mark is enough: unchanged means nothing new, and larger
    // means only the appended bytes need counting.
    if ($state['size'] >= 0 && $size === $state['size']) return 0;
    if ($state['size'] >= 0 && $size > $state['size']) {
        return inquiries_count_range($path, $state['size'], $size);
    }

    // Smaller than the mark (the log rotated at its ceiling and started again)
    // or no mark at all: count the file. Treat everything present as unread
    // rather than reporting zero — under-reporting is the failure this exists
    // to prevent.
    $total = inquiries_total_count();
    return $state['size'] < 0 ? max(0, $total - $state['seen']) : $total;
}

// True when the admin/ folder can actually be written by the PHP user.
// Four things depend on it: admin-log.jsonl, inquiries.jsonl,
// .login-throttle.json, and config.local.php (password changes).
function admin_writable(): bool {
    return is_writable(__DIR__);
}

// True when data/ can be written — product/content/settings saves and every
// backup depend on it.
function data_writable(): bool {
    return is_writable(dirname(PRODUCTS_JSON));
}

// ─── Login throttle (persistent, IP-keyed) ────────────────────────────────
// The old throttle counted failures in $_SESSION, which an attacker resets
// simply by not sending the session cookie. This version persists failures
// to a small JSON file keyed by client IP so the delay actually applies to
// scripted attacks. The file lives in admin/ (already writable — audit_log()
// writes here) and is blocked from the web by admin/.htaccess (*.json rule).
define('LOGIN_THROTTLE_FILE', __DIR__ . '/.login-throttle.json');
define('LOGIN_THROTTLE_WINDOW', 900); // forget failures older than 15 minutes

// 4.14 — the throttle used to be sleep(min(8, failures - 4)) on each attempt.
// Two measured problems with that:
//
//   * sleep() is per-connection, so ten simultaneous attempts all slept AT THE
//     SAME TIME and finished together. The delay bounded a single-threaded
//     guessing run and bounded nothing at all against a parallel one.
//   * the counter was a read-modify-write with no lock held ACROSS both
//     halves. login_throttle_write() passed LOCK_EX, but two requests could
//     each read c=3 and each write c=4, so failures went uncounted under
//     exactly the load the throttle exists for.
//
// It is now a cool-off enforced by the clock: past LOGIN_FREE_ATTEMPTS
// failures, further attempts from that IP are refused until a stored
// timestamp passes. Ten parallel connections read the same timestamp and are
// all refused, so there is nothing for parallelism to amortise.
//
// The ceiling is deliberate and low. There is no "forgot password" email; the
// recovery path is FTP, which Rick uses reluctantly, so a permanent lockout is
// a worse outcome than a slow brute force. The window caps at
// LOGIN_COOLOFF_MAX, and a refused attempt is NOT counted and does NOT extend
// it — retrying impatiently cannot dig a deeper hole. If he simply stops for
// LOGIN_THROTTLE_WINDOW the record expires and he has his five free attempts
// back.
//
// What has NOT changed, and must not be claimed otherwise: this is per-IP, so
// a distributed attacker is unaffected, and the long random password is still
// the actual control here. (AUDIT_v3_FINDINGS D14)
define('LOGIN_FREE_ATTEMPTS', 5);   // failures allowed before a cool-off starts
define('LOGIN_COOLOFF_BASE', 15);   // seconds after the first over-limit failure
define('LOGIN_COOLOFF_MAX', 300);   // hard ceiling — Rick must never be stranded

function login_throttle_client_ip(): string {
    // Default: REMOTE_ADDR — correct and unspoofable on direct hosting (F4).
    // If the site is later fronted by a trusted reverse proxy/CDN that presents
    // a single IP, define TRUST_PROXY_FORWARDED = true (e.g. in config.local.php)
    // so the throttle keys on the real client IP from X-Forwarded-For instead of
    // over-blocking everyone behind the proxy. Only enable behind a proxy you
    // trust — X-Forwarded-For is otherwise client-spoofable.
    if (defined('TRUST_PROXY_FORWARDED') && TRUST_PROXY_FORWARDED
        && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $first = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

// Drop entries whose last failure is outside the window so the file can't grow
// without bound.
function login_throttle_prune(array $map): array {
    $now = time();
    foreach ($map as $ip => $rec) {
        if (!is_array($rec) || ($now - (int)($rec['t'] ?? 0)) > LOGIN_THROTTLE_WINDOW) {
            unset($map[$ip]);
        }
    }
    return $map;
}

// Read-only view of the throttle map. Callers that MUTATE must go through
// login_throttle_mutate() instead — reading here and writing separately is the
// unlocked read-modify-write 4.14 is about.
function login_throttle_read(): array {
    if (!file_exists(LOGIN_THROTTLE_FILE)) return [];
    $raw = @file_get_contents(LOGIN_THROTTLE_FILE);
    $map = $raw ? json_decode($raw, true) : [];
    if (!is_array($map)) return [];
    return login_throttle_prune($map);
}

/**
 * 4.14 — read, modify and write the throttle map with ONE exclusive lock held
 * across all three. `$mutator` receives the pruned map by reference and may
 * return a value, which is returned from here.
 *
 * The previous shape read with file_get_contents() and wrote with
 * file_put_contents(..., LOCK_EX): the write was atomic but the read-then-write
 * pair was not, so two concurrent failures could both read c=3 and both store
 * c=4. Opening 'c+' creates the file without truncating it, so the lock can be
 * taken BEFORE anything is read.
 *
 * Returns null and changes nothing when the file cannot be opened — admin/ not
 * being writable already degrades the audit log and the inquiry log silently
 * and raises the dashboard health banner (T3.3); it must not also stop the
 * owner signing in.
 */
function login_throttle_mutate(callable $mutator) {
    $fh = @fopen(LOGIN_THROTTLE_FILE, 'c+');
    if ($fh === false) return null;
    if (!flock($fh, LOCK_EX)) { fclose($fh); return null; }
    $raw = stream_get_contents($fh);
    $map = ($raw !== false && $raw !== '') ? json_decode($raw, true) : [];
    if (!is_array($map)) $map = [];
    $map = login_throttle_prune($map);
    $out = $mutator($map);
    rewind($fh);
    ftruncate($fh, 0);
    fwrite($fh, json_encode($map));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $out;
}

// How many recent failures this IP has accumulated (0 if none / expired).
function login_failure_count(string $ip): int {
    $map = login_throttle_read();
    return (int)($map[$ip]['c'] ?? 0);
}

/**
 * When may this IP try again? Epoch seconds; 0 means "now".
 *
 * The step doubles from LOGIN_COOLOFF_BASE and stops at LOGIN_COOLOFF_MAX:
 * 15s, 30s, 60s, 120s, 240s, then 300s forever. The shift is clamped so a
 * hand-edited counter can't overflow it into a negative.
 */
function login_cooloff_until(int $failures): int {
    if ($failures <= LOGIN_FREE_ATTEMPTS) return 0;
    $steps = min(20, $failures - LOGIN_FREE_ATTEMPTS - 1);
    return time() + (int)min(LOGIN_COOLOFF_MAX, LOGIN_COOLOFF_BASE * (1 << $steps));
}

/** Seconds this IP must still wait before an attempt is even looked at. */
function login_cooloff_remaining(string $ip): int {
    $map = login_throttle_read();
    $until = (int)($map[$ip]['r'] ?? 0);
    $now = time();
    return $until > $now ? $until - $now : 0;
}

/**
 * Take one attempt slot for this IP, atomically. Returns the seconds the caller
 * must wait; 0 means "go ahead and check the password".
 *
 * The counter is bumped on ENTRY, not after a failed check, and the decision
 * and the bump happen under ONE lock. That is what makes the cool-off hold
 * under parallelism: twelve simultaneous connections queue on the lock and each
 * gets its own number, so only the ones inside the free allowance are ever
 * checked against the hash. Counting failures instead let all twelve read
 * "none so far" and all twelve be checked — measured on a ten-server fleet in
 * _harness/plan5-throttle.js, which is the only way either fault shows at all
 * (one `php -S` answers one request at a time).
 *
 * A refused attempt is NOT counted and does NOT extend the window. Retrying
 * impatiently must not make the wait longer: there is no reset email and the
 * recovery path is FTP.
 */
function login_attempt_gate(string $ip): int {
    $wait = 0;
    login_throttle_mutate(function (array &$map) use ($ip, &$wait) {
        $now   = time();
        $until = (int)($map[$ip]['r'] ?? 0);
        if ($until > $now) { $wait = $until - $now; return; }   // refused, unchanged
        $count = (int)($map[$ip]['c'] ?? 0) + 1;
        $map[$ip] = ['c' => $count, 't' => $now, 'r' => login_cooloff_until($count)];
    });
    return $wait;
}

/**
 * Count one failed attempt and return the seconds the caller must now wait
 * (0 if still inside the free allowance).
 *
 * ⚠️ NOT FOR PAGES. Both surfaces that check a password — admin/auth.php and
 * admin/password.php — go through login_attempt_gate() instead, because
 * counting only *failures* still lets a burst of simultaneous connections all
 * read "none so far" and all reach password_verify(). This counts
 * unconditionally and gates nothing, which is exactly the hole 4.14 closed.
 *
 * It survives because _harness/plan5-throttle.js's probe needs a helper that
 * increments without refusing, in order to prove the flock around the
 * read-modify-write actually holds (10 parallel calls must produce 10 counts —
 * before the lock it produced 5). If you are writing a page, you want
 * login_attempt_gate().
 */
function login_register_failure(string $ip): int {
    $wait = 0;
    login_throttle_mutate(function (array &$map) use ($ip, &$wait) {
        $count = (int)($map[$ip]['c'] ?? 0) + 1;
        $until = login_cooloff_until($count);
        $map[$ip] = ['c' => $count, 't' => time(), 'r' => $until];
        $wait = $until > time() ? $until - time() : 0;
    });
    return $wait;
}

function login_reset_failures(string $ip): void {
    login_throttle_mutate(function (array &$map) use ($ip) {
        unset($map[$ip]);
    });
}

/**
 * The cool-off explained to Rick, who is not going to guess that a silent
 * rejection means "wait". It names the number of seconds and says explicitly
 * that waiting is the whole fix, because the alternative reading — "I am
 * locked out, I need the FTP recovery" — sends him to the one procedure this
 * release is trying to keep him away from.
 */
function login_cooloff_message(int $seconds, string $attempts = 'failed sign-in attempts'): string {
    $wait = $seconds >= 60
        ? (int)ceil($seconds / 60) . ' ' . ((int)ceil($seconds / 60) === 1 ? 'minute' : 'minutes')
        : max(1, $seconds) . ' seconds';
    return 'Too many ' . $attempts . ' from this computer. Please wait about '
         . $wait . ' and try again. Waiting is all that is needed — this clears itself, '
         . 'and reloading the page sooner will not make it shorter.';
}

// ─── Contrast math for the owner-set brand colors (4.23) ────────────────────
// MIRRORS src/App.jsx's parseHexColor / relativeLuminance / contrastRatio /
// inkFor. The two must agree: settings.php warns the owner with a number, and
// ThemeInjector picks the foreground that number describes. If one side
// changes, change the other — _harness/contrastparity.js asserts they match.
//
// WCAG 2.1 relative luminance. Ratios run 1 (identical) to 21 (black on white);
// 4.5:1 is the AA threshold for body text, 3:1 for large text and UI.
define('IPC_INK_DARK', '#141414');    // the site's body text color
define('IPC_INK_LIGHT', '#ffffff');
define('IPC_CONTRAST_AA', 4.5);
define('IPC_CONTRAST_LARGE', 3.0);

/** '#abc' or '#aabbcc' -> [r,g,b], or null if it is not a hex color. */
function ipc_parse_hex_color(string $v): ?array {
    if (!preg_match('/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i', trim($v), $m)) return null;
    $h = $m[1];
    if (strlen($h) === 3) $h = $h[0].$h[0].$h[1].$h[1].$h[2].$h[2];
    $n = hexdec($h);
    return [($n >> 16) & 255, ($n >> 8) & 255, $n & 255];
}

function ipc_relative_luminance(array $rgb): float {
    $ch = static function ($c) {
        $s = $c / 255;
        return $s <= 0.03928 ? $s / 12.92 : pow(($s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * $ch($rgb[0]) + 0.7152 * $ch($rgb[1]) + 0.0722 * $ch($rgb[2]);
}

/** WCAG contrast ratio between two hex colors, 1..21. 0.0 on bad input. */
function ipc_contrast_ratio(string $a, string $b): float {
    $ca = ipc_parse_hex_color($a);
    $cb = ipc_parse_hex_color($b);
    if ($ca === null || $cb === null) return 0.0;
    $la = ipc_relative_luminance($ca);
    $lb = ipc_relative_luminance($cb);
    return (max($la, $lb) + 0.05) / (min($la, $lb) + 0.05);
}

/**
 * The foreground the site will actually use on these background(s).
 *
 * Takes a LIST because the page headers and the homepage CTA band are a
 * gradient: the ink must be legible at both ends, so each candidate is scored
 * by its WORST contrast across the stops.
 */
function ipc_ink_for($backgrounds): string {
    $bgs = array_values(array_filter(
        is_array($backgrounds) ? $backgrounds : [$backgrounds],
        static fn($b) => ipc_parse_hex_color((string)$b) !== null
    ));
    if (!$bgs) return IPC_INK_LIGHT;
    $worst = static function (string $ink) use ($bgs): float {
        $r = [];
        foreach ($bgs as $bg) $r[] = ipc_contrast_ratio($ink, (string)$bg);
        return min($r);
    };
    return $worst(IPC_INK_LIGHT) >= $worst(IPC_INK_DARK) ? IPC_INK_LIGHT : IPC_INK_DARK;
}

// ─── Does a product reference resolve on the public site? ───────────────────
// MIRRORS src/App.jsx:6155-6188. The two must agree — if the React lookup
// changes, change this with it.
//
// The site does NOT match product references exactly. It falls back through
// three tiers, and the shipped content.json depends on the second one: the
// Industries page carries references like "IP44A2 & IP45A3" against a catalog
// SKU of "IP44A2-IP45A3". Both normalize to IP44A2IP45A3, so the link works.
//
// An exact-match check here would have flagged 5 of the 18 shipped industry
// references as broken when every one of them resolves — measured, and the
// reason this helper exists instead of an isset() on a SKU map. Warning an
// owner about links that work is worse than not warning at all: he learns to
// ignore the banner. (PLAN-2 4.12)
function ipc_normalize_sku(string $v): string {
    return (string)preg_replace('/[^A-Z0-9]/', '', strtoupper($v));
}

/** True if any "-", "/" or "," separated segment of $sku equals $needle. */
function ipc_sku_segment_match(string $sku, string $needle): bool {
    $n = ipc_normalize_sku($needle);
    if ($n === '') return false;
    foreach (preg_split('/[-\/,]/', $sku) ?: [] as $seg) {
        if (ipc_normalize_sku($seg) === $n) return true;
    }
    return false;
}

/** True if $needle would resolve to a product on the public site. */
function product_reference_resolves(array $products, string $needle): bool {
    if (trim($needle) === '') return false;
    // Tier 1 — exact id or sku.
    foreach ($products as $p) {
        if (($p['sku'] ?? null) === $needle || ($p['id'] ?? null) === $needle) return true;
    }
    // Tier 2 — normalized (strips spaces, dashes, slashes, ampersands, case).
    $n = ipc_normalize_sku($needle);
    foreach ($products as $p) {
        if (ipc_normalize_sku((string)($p['sku'] ?? '')) === $n) return true;
    }
    // Tier 3 — the needle is one segment of a multi-part SKU.
    foreach ($products as $p) {
        if (ipc_sku_segment_match((string)($p['sku'] ?? ''), $needle)
            || ipc_sku_segment_match((string)($p['id'] ?? ''), $needle)) return true;
    }
    return false;
}

/**
 * What is wrong with this SKU? [] means nothing is.
 *
 * add.php and edit.php checked only "non-empty" and "not already taken", so the
 * catalogue would accept literally any string. Measured: `<script>x</script>`
 * and `...` were both stored as live SKUs. The second is the one that actually
 * breaks something — pdf_filename_for_sku() and image_filename_for_sku() strip
 * every non-alphanumeric, so a SKU with none at all derives the filenames
 * `.pdf` and `.png`, and public/.htaccess's `<FilesMatch "^\.">` rule then
 * denies them. The upload reports success and the datasheet link is dead, with
 * nothing anywhere saying why.
 *
 * The rule is deliberately loose, because a rule that rejects a SKU the owner
 * needs is worse than the bug it prevents:
 *
 *   - AT LEAST ONE alphanumeric. This is the whole of the filename fix.
 *   - Only characters the catalogue already uses or the site's three-tier
 *     lookup already understands: letters, digits, space and - _ . / & + ,
 *     (see ipc_sku_segment_match, which splits on -, / and ,). All 42 shipped
 *     SKUs use only letters, digits and "-"; the `id` field additionally
 *     carries " & " and " / " forms, so those stay legal here.
 *   - 64 characters. The longest shipped SKU is 27.
 *
 * Shared here rather than copied into both pages for the reason the family list
 * and the approval vocabulary are shared: two copies of one rule is how they
 * come to disagree. (audit-runs/audit1.md A-06)
 */
function sku_problems(string $sku): array {
    $errors = [];
    if ($sku === '') {
        return ['SKU is required.'];
    }
    if (!preg_match('/[A-Za-z0-9]/', $sku)) {
        $errors[] = 'The SKU must contain at least one letter or number — it is used to name the uploaded data sheet and photo files.';
    }
    if (preg_match('#[^A-Za-z0-9 \-_./&+,]#', $sku)) {
        $errors[] = 'The SKU may only contain letters, numbers, spaces and the characters - _ . / & + , — for example IP33PO or IP44A2 & IP45A3.';
    }
    if (mb_strlen($sku) > 64) {
        $errors[] = 'The SKU is too long (64 characters maximum).';
    }
    return $errors;
}

/**
 * Is an owner-typed link safe to write into a field the site renders as an href?
 *
 * Returns '' when the value is fine, or a ready-to-show message naming $what.
 * An EMPTY value is fine — both callers treat blank as "no link", which is how
 * the owner removes one.
 *
 * The mirror of isSafeLinkUrl() in src/App.jsx: one leading slash for a file on
 * this site, or a full http(s) URL, and nothing else. Two slashes is
 * protocol-relative, not local. Kept deliberately identical in effect to the
 * client-side guard, and both are needed — the client guard is what actually
 * stops a script-scheme href reaching a visitor, including for values already
 * sitting in data/ from before this check existed, while this one is what stops
 * the owner from saving a broken link and getting no explanation for why it
 * never appeared. (audit-runs/audit4.md D-01)
 *
 * Shared rather than copied for the same reason as sku_problems(): settings.php
 * and content.php disagreeing about what a link is would be the next defect.
 * This is looser than edit.php's F6 rule for additionalPdfs, which also
 * requires a .pdf target — do not consolidate them; F6 being stricter is the
 * point of F6.
 */
function link_url_problem(string $url, string $what): string {
    $u = trim($url);
    if ($u === '') return '';
    if (strpos($u, '//') === 0) {
        return $what . ' must start with a single / for a file on this site, or with http:// or https://.';
    }
    if ($u[0] === '/') return '';
    if (preg_match('#^https?://\S+$#i', $u)) return '';
    return $what . ' is not a valid link — use a path on this site such as /pdfs/catalog.pdf, or a full address starting http:// or https://.';
}

// Helper: find a product by SKU
function find_product(array $products, string $sku): int {
    foreach ($products as $i => $p) {
        if (($p['sku'] ?? '') === $sku) return $i;
    }
    return -1;
}

// Helper: derive the canonical PDF filename for a SKU. Single source of truth
// for the sanitization rule (non-alphanumerics → dash, collapse repeats, trim)
// so upload, rename, and display all agree on the filename.
//
// NOTE: case is PRESERVED. The live catalog's PDFs are named in the SKU's own
// case (e.g. IP33PO.pdf, CC.pdf), and the production server is Linux (case-
// sensitive). Lower-casing here would make a re-upload save a second file
// (ip33po.pdf) beside the real one and break the "replace existing" detection.
function pdf_filename_for_sku(string $sku): string {
    $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $sku); // non-alphanumeric → dash
    $safe = preg_replace('/-{2,}/', '-', $safe);            // collapse repeated dashes
    $safe = trim($safe, '-');                               // trim leading/trailing dashes
    return $safe . '.pdf';
}

// Helper: is a given PDF filename still referenced by any product in the list?
// Used before unlinking a PDF so we never delete a data sheet that another
// product still points at — checks both the primary pdfUrl and any
// additionalPdfs entries (e.g. IP52EC's "Plugged Cap" sheet).
function pdf_in_use(array $products, string $basename): bool {
    if ($basename === '') return false;
    foreach ($products as $p) {
        if (!empty($p['pdfUrl']) && basename($p['pdfUrl']) === $basename) return true;
        if (!empty($p['additionalPdfs']) && is_array($p['additionalPdfs'])) {
            foreach ($p['additionalPdfs'] as $ap) {
                if (!empty($ap['url']) && basename($ap['url']) === $basename) return true;
            }
        }
    }
    return false;
}

// Helper: when a SKU is renamed, map a PDF filename that begins with the old
// SKU onto the new SKU, preserving any "-suffix". Returns the new filename, or
// null if the name doesn't start with the old SKU (leave it alone).
//   IP52EC.pdf             (IP52EC → IP99XX)  -> IP99XX.pdf
//   IP52EC-molded-cap.pdf  (IP52EC → IP99XX)  -> IP99XX-molded-cap.pdf
function pdf_rename_for_sku_change(string $oldName, string $oldSku, string $newSku): ?string {
    $oldBase = substr(pdf_filename_for_sku($oldSku), 0, -4); // strip ".pdf"
    $newBase = substr(pdf_filename_for_sku($newSku), 0, -4);
    if ($oldBase === '' || $newBase === '' || substr($oldName, -4) !== '.pdf') return null;
    if ($oldName === $oldBase . '.pdf')            return $newBase . '.pdf';
    if (strpos($oldName, $oldBase . '-') === 0)    return $newBase . substr($oldName, strlen($oldBase));
    return null;
}

// Helper: best-effort delete of the PDF at $url, but ONLY if no product in
// $products still references it (primary or additional). Strictly scoped to
// PDF_DIR so a tampered URL can't remove anything outside the upload folder.
// Returns 'removed', 'kept' (still in use), or '' (nothing to do).
function pdf_delete_if_unused(array $products, string $url): string {
    $name = basename($url);
    if ($name === '' || $name === '.' || $name === '..') return '';
    if (pdf_in_use($products, $name)) return 'kept';
    $realPdfDir = realpath(PDF_DIR);
    $realFile   = realpath(PDF_DIR . $name);
    if ($realPdfDir && $realFile && strpos($realFile, $realPdfDir) === 0) {
        @unlink($realFile);
        return 'removed';
    }
    return '';
}

// Helper: derive the canonical image filename for a SKU. Same sanitization as
// pdf_filename_for_sku(); the extension comes from the validated upload.
function image_filename_for_sku(string $sku, string $ext): string {
    $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $sku);
    $safe = preg_replace('/-{2,}/', '-', $safe);
    $safe = trim($safe, '-');
    return $safe . '.' . strtolower($ext);
}

// Helper: is an uploaded image filename still referenced by any product's
// photoUrl? Mirrors pdf_in_use() so removal never orphans a shared photo.
function image_in_use(array $products, string $basename): bool {
    if ($basename === '') return false;
    foreach ($products as $p) {
        if (!empty($p['photoUrl']) && basename($p['photoUrl']) === $basename) return true;
    }
    return false;
}

// Turn a PHP upload error code into a message that names the actual cause.
// upload-pdf.php collapsed UPLOAD_ERR_INI_SIZE, _PARTIAL, _NO_TMP_DIR and
// _CANT_WRITE into "Please select a PDF file to upload", which describes none
// of them — and did so on a page that promised "20MB or smaller" while the
// server was rejecting at 2MB. (DEPLOY_READINESS_v2 T3.5)
/**
 * The size limit that ACTUALLY applies to an upload, as a display string.
 *
 * help.php printed the server's upload_max_filesize ("24M") as though it were
 * the ceiling. It is not: upload-pdf.php:79 hard-rejects anything over 20MB and
 * upload-image.php:102 caps photos at 8MB, so the real rule is
 * min(upload_max_filesize, the page's own cap) — and telling the owner to raise
 * .user.ini would not have moved either one. (AUDIT_v3_FINDINGS D6)
 */
function min_upload_label(int $ownCapMb): string {
    $ini   = (string)ini_get('upload_max_filesize');
    $bytes = 0;
    if (preg_match('/^\s*(\d+(?:\.\d+)?)\s*([KMG])?/i', $ini, $m)) {
        $mult  = ['' => 1, 'K' => 1024, 'M' => 1048576, 'G' => 1073741824];
        $bytes = (int)((float)$m[1] * $mult[strtoupper($m[2] ?? '')]);
    }
    $iniMb = $bytes > 0 ? $bytes / 1048576 : $ownCapMb;
    $mb    = min($iniMb, $ownCapMb);
    return ($mb >= 1 ? (string)round($mb) : rtrim(rtrim(number_format($mb, 1), '0'), '.')) . 'MB';
}

function upload_error_message(int $code, string $what = 'file'): string {
    $iniMax = ini_get('upload_max_filesize') ?: '?';
    $postMax = ini_get('post_max_size') ?: '?';
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
            return "That {$what} is larger than this server accepts ({$iniMax} per file, {$postMax} per request). "
                 . "Shrink the {$what} and try again, or ask your developer to raise the limit in .user.ini.";
        case UPLOAD_ERR_FORM_SIZE:
            return "That {$what} is larger than this form accepts. Please use a smaller file.";
        case UPLOAD_ERR_PARTIAL:
            return "The upload was interrupted and only part of the {$what} arrived. Please try again.";
        case UPLOAD_ERR_NO_FILE:
            // "a image" — pick the article from the word. (AUDIT_v3 NB18)
            return 'Please choose ' . (strpos('aeiou', strtolower($what[0] ?? 'f')) !== false ? 'an' : 'a')
                 . " {$what} to upload.";
        case UPLOAD_ERR_NO_TMP_DIR:
            return "The server has no temporary upload folder configured. This is a hosting setting — contact your developer.";
        case UPLOAD_ERR_CANT_WRITE:
            return "The server could not write the {$what} to disk (permissions). Contact your developer.";
        case UPLOAD_ERR_EXTENSION:
            return "A server extension blocked this upload. Contact your developer.";
        default:
            return "The {$what} could not be uploaded (error code {$code}). Please try again.";
    }
}

// Helper: sanitize a string for display.
// No `mixed` type-hint so this works on PHP 7.4+ as well as 8.x — some
// Network Solutions shared-hosting plans still default to older PHP.
function h($val): string {
    return htmlspecialchars((string)($val ?? ''), ENT_QUOTES, 'UTF-8');
}
?>
