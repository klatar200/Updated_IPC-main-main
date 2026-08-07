<?php
require_once 'config.php';
require_auth();

/**
 * Change the admin password from inside the admin — no FTP required.
 *
 * Writes a fresh bcrypt hash into admin/config.local.php (the gitignored
 * override that config.php loads before falling back to the shipped default).
 * Safety rails:
 *   - current password must verify first (throttled like the login form)
 *   - the previous config.local.php is backed up (config.local.php.bak.*)
 *   - after writing, the file is read back and the new hash re-verified;
 *     on any mismatch the backup is restored automatically
 * Recovery if the password is ever lost: there is NO shipped default to fall
 * back to (that default used to be printed in the repo docs). Instead, upload
 * an empty file named admin/ALLOW-PASSWORD-RESET over FTP and visit /admin/ —
 * a one-time "Set admin password" screen appears and deletes the flag file
 * once a new password is set. See admin/README.md.
 */

$errors  = [];
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $current = (string)($_POST['current_password'] ?? '');
    $new     = (string)($_POST['new_password'] ?? '');
    $confirm = (string)($_POST['confirm_password'] ?? '');

    // Throttle current-password guesses exactly like the login form — an
    // attacker who hijacks a session shouldn't get free brute-force attempts.
    //
    // This used to be its own sleep(min(8, $failures - 4)), which 4.14 replaced
    // on the login form and left here because password.php was outside that
    // plan's scope boundary. It carried both of 4.14's faults: sleep() is
    // per-connection, so simultaneous attempts all slept at the same time and
    // finished together, and the count was read separately from the write.
    // It now takes a slot from the SAME gate auth.php uses — one flock around
    // the decision and the increment — so the two forms share one budget and
    // neither can be parallelised.
    $clientIp = login_throttle_client_ip();
    $cooloff  = login_attempt_gate($clientIp);

    if ($cooloff > 0) {
        // Refused by the clock, without sleeping. Not counted, and it does not
        // extend the window: an owner who mistypes his current password a few
        // times must not be able to lock himself further out by retrying.
        // password_verify() is deliberately not reached.
        $errors[] = login_cooloff_message($cooloff, 'incorrect current-password attempts');
    } elseif (!ADMIN_PASSWORD_CONFIGURED || !password_verify($current, ADMIN_PASSWORD_HASH)) {
        // The gate already counted this attempt — do NOT count it again.
        $errors[] = 'The current password is incorrect.';
        $armed = login_cooloff_remaining($clientIp);
        if ($armed > 0) {
            $errors[] = login_cooloff_message($armed, 'incorrect current-password attempts');
        }
    } else {
        login_reset_failures($clientIp);
        $errors = array_merge($errors, admin_password_problems($new, $confirm));
    }

    if (empty($errors)) {
        // Shared writer in config.php — same code path as the FTP-unlocked
        // recovery screen in auth.php, so both stay correct together.
        $res = admin_password_write($new);
        if (!$res['ok']) {
            $errors[] = $res['error'];
        } else {
            audit_log('password', 'admin', 'Admin password changed');
            regenerate_session_id();
            $success = 'Password changed. Use the new password the next time you sign in. Store it somewhere safe — there is no "forgot password" email. If it is ever lost, recovery means uploading an empty file named ALLOW-PASSWORD-RESET into the admin folder over FTP, then visiting /admin/ (see admin/README.md).';
        }
    }
}

$navActive = 'password';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Change Password</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    main { max-width: 520px; margin: 0 auto; padding: 40px 24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 20px; }
    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
    input[type=password] { width: 100%; padding: 11px 14px; border: 1px solid #d1d9e0; border-radius: 8px; font-size: 14px; color: #141414; outline: none; }
    input[type=password]:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.1); }
    .hint { font-size: 11px; color: #9ca3af; margin-top: 5px; }
    .btn-primary { width: 100%; padding: 12px; background: #005da3; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { background: #004e8c; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .error-list li { font-size: 13px; margin-bottom: 4px; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    .note { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 8px; padding: 12px 16px; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main>
  <h1>Change Password</h1>
  <p class="sub">Updates the admin sign-in password. Takes effect on your next sign-in; your current session stays active.</p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>
  <?php if ($success): ?>
    <div class="alert-success">✅ <?= h($success) ?></div>
  <?php endif; ?>

  <div class="card">
    <form method="POST" autocomplete="off">
      <div class="form-group">
        <label for="current_password">Current password</label>
        <input type="password" id="current_password" name="current_password" autocomplete="current-password" required />
      </div>
      <div class="form-group">
        <label for="new_password">New password</label>
        <input type="password" id="new_password" name="new_password" autocomplete="new-password" minlength="12" required />
        <div class="hint">At least 12 characters. A short sentence or 4+ random words is both strong and memorable.</div>
      </div>
      <div class="form-group">
        <label for="confirm_password">Repeat new password</label>
        <input type="password" id="confirm_password" name="confirm_password" autocomplete="new-password" minlength="12" required />
      </div>
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="btn-primary">Change Password →</button>
    </form>
    <div class="note">⚠ Store the new password in a password manager. There is no “forgot password” email, and there is no built-in default password to fall back to. If it is lost: over FTP, upload an empty file named <code>ALLOW-PASSWORD-RESET</code> into the <code>admin</code> folder, then open <code>/admin/</code> in a browser — a one-time “Set admin password” screen appears. Deleting <code>config.local.php</code> alone does <strong>not</strong> reset anything; it locks the admin completely.</div>
  </div>
</main>
<script src="unsaved.js" defer></script>
</body>
</html>
