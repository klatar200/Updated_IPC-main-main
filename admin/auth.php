<?php
require_once 'config.php';

// Never let the login screen sit in any cache (browser, proxy, CDN).
header('Cache-Control: no-store, no-cache, must-revalidate, private');
header('Pragma: no-cache');
header('Expires: 0');
// Defense-in-depth headers for the admin surface.
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

$error = '';

// Handle logout — must be a POST carrying a valid CSRF token so a malicious
// page can't force-log-out the admin via a stray <img>/<a> to ?logout=1.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['logout'])) {
    csrf_check(false);               // verify token before tearing the session down
    // A9 — log BEFORE the session is destroyed; audit_log() itself needs no
    // session, but doing it here keeps the line ordered with the sign-in it
    // closes. (audit-runs/audit1.md A-09)
    audit_log('sign-out', '-', 'Signed out');
    $_SESSION = [];                  // clear all session variables
    session_unset();                 // unset individual variables
    session_destroy();               // destroy the session file
    // Expire the session cookie
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    header('Location: auth.php');
    exit;
}

// Already logged in.
// This redirect used to hide the reset window from the one person who can
// close it: upload ALLOW-PASSWORD-RESET while a session is live and you are
// bounced straight to the dashboard, where nothing mentioned it either. The
// dashboard now carries a health-banner entry for the flag with a one-click
// "Close it now" control (index.php), so landing there IS the answer — but the
// banner is what makes this redirect safe, not the redirect itself.
// (AUDIT_v3_FINDINGS B2)
if (is_authenticated()) {
    header('Location: index.php');
    exit;
}

// Brute-force throttle keyed by client IP and persisted to disk (see
// login_* helpers in config.php). Persisting by IP — rather than in the
// session — means an attacker can't reset the counter by discarding the
// session cookie between attempts.
//
// Do NOT overstate this. It used to be sleep(min(8, failures - 4)) per attempt:
// measured, attempts 1-5 returned in ~280 ms, then 1.4 s, 2.3 s, 3.3 s, capped
// at 8 s — and because sleep() is per-connection, ten simultaneous attempts all
// slept together and finished together, so it bounded a single-threaded run and
// nothing else. It is now a cool-off enforced by a stored timestamp
// (login_cooloff_* in config.php), which every parallel connection reads the
// same value of.
//
// What that does NOT change, and must not be claimed otherwise: this is still
// per-IP, so a distributed attacker is unaffected, and the long random password
// is still the actual control here. The throttle only raises the cost of a
// careless one. It is also deliberately capped and self-clearing — there is no
// "forgot password" email and the recovery path is FTP, so stranding the owner
// would be a worse outcome than a slow brute force. (AUDIT_v3_FINDINGS D14, 4.14)
$clientIp = login_throttle_client_ip();

// ─── Recovery mode ──────────────────────────────────────────────────────────
// There is no shipped default password (see config.php). Two states can leave
// nobody able to sign in: the password was forgotten, or config.local.php was
// lost. Both are recovered the same way — upload an empty file named
// admin/ALLOW-PASSWORD-RESET over FTP, which unlocks this one-time form.
// Creating that file requires FTP/file-manager access, a stronger credential
// than the admin password, so this is not a login bypass.
// The window is one hour wide (PASSWORD_RESET_WINDOW in config.php). If the
// flag is on disk but out of date, say so — otherwise the owner who uploaded it
// an hour ago reloads, sees an ordinary password box he cannot satisfy, and
// concludes the documented recovery is broken.
$resetUnlocked = password_reset_unlocked();
$resetExpired  = password_reset_expired();
$notConfigured = !ADMIN_PASSWORD_CONFIGURED;
$resetErrors   = [];

if ($resetUnlocked && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['set_password'])) {
    csrf_check(false);   // recovery happens before any login exists
    $new     = (string)($_POST['new_password'] ?? '');
    $confirm = (string)($_POST['confirm_password'] ?? '');
    $resetErrors = admin_password_problems($new, $confirm, false);
    if (empty($resetErrors)) {
        $res = admin_password_write($new);   // deletes the flag file on success
        if (!$res['ok']) {
            $resetErrors[] = $res['error'];
        } else {
            audit_log('password', 'admin', 'Admin password set via FTP-unlocked recovery');
            regenerate_session_id();
            $_SESSION[ADMIN_SESSION_KEY] = true;
            login_reset_failures($clientIp);
            header('Location: index.php');
            exit;
        }
    }
}

// A reset POST that arrives after the window has already closed — because
// someone else completed the recovery a moment earlier and admin_password_write()
// deleted the flag, or because the hour simply ran out. Without this it fell
// through to the login branch with an empty password and answered a RESET form
// with "Incorrect password." on a Sign In box, giving no hint that somebody
// else had just taken the account. (AUDIT_v3_FINDINGS NB16)
$resetRaced = false;
if (!$resetUnlocked && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['set_password'])) {
    $resetRaced = true;
    $error = 'The password-reset window closed before this form was submitted — either it ran out, '
           . 'or someone else completed the reset first. Your new password was NOT set. '
           . 'If you did not expect that, upload ALLOW-PASSWORD-RESET again immediately and set a new password.';
}

// Handle login
$cooloff = 0;

if (!$resetRaced && !$resetUnlocked && !$notConfigured && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // A-5.7 — raw_str(), not post_str(): trimming would silently change the
    // password that gets verified. `password[]=x` used to fatal here.
    $password = raw_str($_POST['password'] ?? null);
    // Take an attempt slot BEFORE the password is looked at. The count and the
    // decision happen under one lock, so simultaneous connections queue and
    // only the ones inside the free allowance ever reach password_verify().
    $cooloff = login_attempt_gate($clientIp);
    if ($cooloff > 0) {
        // 4.14 — refused by the clock, without sleeping. Nothing here is
        // counted and nothing extends the window: hammering Reload during a
        // cool-off must not make it longer, or an impatient owner locks
        // himself out of his own admin with no reset email to fall back on.
        // password_verify() is deliberately not reached, so a correct password
        // is refused too and the response cannot be used as an oracle.
        $error = login_cooloff_message($cooloff);
    } elseif (password_verify($password, ADMIN_PASSWORD_HASH)) {
        // Defeat session fixation: rotate the session id the moment auth
        // succeeds so any pre-set IPCADMIN cookie is invalidated.
        regenerate_session_id();
        $_SESSION[ADMIN_SESSION_KEY] = true;
        // A9 — the audit log recorded all eleven content actions and no
        // authentication event at all, so on an admin whose only recovery path
        // is an FTP-placed flag file there was no record of who signed in,
        // when, or how many attempts failed first. audit_log() already stores
        // the IP and the user agent. (audit-runs/audit1.md A-09)
        audit_log('sign-in', '-', 'Signed in');
        login_reset_failures($clientIp);   // clear this IP's failure streak
        header('Location: index.php');
        exit;
    } else {
        // The gate above already counted this attempt — do NOT count it again.
        // Ask only whether that attempt armed a window, so the message can say
        // so in the same breath as "wrong password" instead of leaving the next
        // page load to explain it.
        $cooloff = login_cooloff_remaining($clientIp);
        // A9 — the DETAIL must never carry the attempted password or any part
        // of it. The useful facts are the count and whether the attempt armed
        // a cool-off; the IP and user agent are recorded by audit_log() itself.
        audit_log('sign-in-failed', '-',
            'Incorrect password (failure #' . login_failure_count($clientIp) . ' from this address)');
        $error = 'Incorrect password. Please try again.';
        if ($cooloff > 0) $error .= ' ' . login_cooloff_message($cooloff);
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Login</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 40px; width: 360px; box-shadow: 0 4px 24px rgba(0,45,82,0.12); }
    .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
    .logo-mark { width: 44px; height: 44px; background: #005da3; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; color: #fff; letter-spacing: 0.08em; }
    .logo-text { font-size: 13px; font-weight: 700; color: #141414; line-height: 1.3; }
    .logo-sub  { font-size: 10px; color: #6b7280; }
    h1 { font-size: 18px; font-weight: 700; color: #141414; margin: 0 0 6px; }
    p  { font-size: 13px; color: #6b7280; margin: 0 0 24px; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
    input[type=password] { width: 100%; padding: 11px 14px; border: 1px solid #d1d9e0; border-radius: 8px; font-size: 14px; color: #141414; outline: none; transition: border-color 0.15s; }
    input[type=password]:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.1); }
    button { width: 100%; margin-top: 18px; padding: 12px; background: #005da3; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    button:hover { background: #004e8c; }
    .error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">
    <img src="logo.svg" alt="IPC" style="width:44px;height:44px;border-radius:8px;display:block;flex-shrink:0;">
    <div>
      <div class="logo-text">Insulation Products<br>Corporation</div>
      <div class="logo-sub">Admin Panel</div>
    </div>
  </div>
  <?php if ($resetUnlocked): ?>
    <h1>Set Admin Password</h1>
    <p>Recovery mode is unlocked because <code>ALLOW-PASSWORD-RESET</code> is present in the admin folder. Set a new password below — the file is removed automatically and this screen goes away.</p>
    <p><strong>This window closes one hour after the file was uploaded.</strong> If it runs out before you finish, upload the file again to reopen it.</p>
    <?php if ($resetErrors): ?>
      <div class="error"><?php foreach ($resetErrors as $e): ?><div><?= h($e) ?></div><?php endforeach; ?></div>
    <?php endif; ?>
    <form method="POST" autocomplete="off">
      <label for="new_password">New password</label>
      <input type="password" id="new_password" name="new_password" autofocus minlength="12" placeholder="At least 12 characters" required />
      <label for="confirm_password" style="margin-top:14px;">Repeat new password</label>
      <input type="password" id="confirm_password" name="confirm_password" minlength="12" required />
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="set_password" value="1">
      <button type="submit">Set Password &amp; Sign In →</button>
    </form>
  <?php elseif ($notConfigured): ?>
    <h1>Admin Not Configured</h1>
    <p>No admin password is set on this server, and there is no built-in default. <code>admin/config.local.php</code> is missing or damaged.</p>
    <?php if ($resetExpired): ?>
      <div class="error">
        <code>ALLOW-PASSWORD-RESET</code> <strong>is</strong> in the admin folder, but it is more than an hour old, so the recovery window has closed. Delete it over FTP and upload it again — that reopens the window for another hour.
      </div>
    <?php else: ?>
    <div class="error">
      To recover: over FTP, upload an empty file named <code>ALLOW-PASSWORD-RESET</code> into the <code>admin</code> folder, then reload this page. You will be asked to set a new password, and the file is deleted for you. The window stays open for one hour.
    </div>
    <?php endif; ?>
  <?php else: ?>
    <h1>Sign In</h1>
    <p>Enter the admin password to manage products.</p>
    <?php if ($error): ?>
      <div class="error"><?= h($error) ?></div>
    <?php endif; ?>
    <?php if ($resetExpired): ?>
      <div class="error">
        <code>ALLOW-PASSWORD-RESET</code> is still in the admin folder, but it is more than an hour old, so the password-reset screen is closed and your normal password works again. <strong>Please delete that file over FTP.</strong> If you still need to reset the password, delete it and upload it again.
      </div>
    <?php endif; ?>
    <form method="POST">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autofocus placeholder="Admin password" required />
      <button type="submit">Sign In →</button>
    </form>
  <?php endif; ?>
</div>
</body>
</html>
