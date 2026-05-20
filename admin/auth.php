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

// Handle logout
if (isset($_GET['logout'])) {
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

// Already logged in
if (is_authenticated()) {
    header('Location: index.php');
    exit;
}

// Very small brute-force throttle: track the last few failed attempts in the
// session and add a short delay once we cross a threshold. Not a substitute
// for fail2ban or a strong password, but it makes online dictionary attacks
// noticeably slower.
$_SESSION['login_failures'] = $_SESSION['login_failures'] ?? 0;

// Handle login
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = $_POST['password'] ?? '';
    if ($_SESSION['login_failures'] >= 5) {
        // 1-second sleep per extra failure, capped at 8 seconds. Enough to
        // make a 26^8 dictionary attack take longer than the heat death of
        // the project, without locking out a sleepy admin who fat-fingered.
        sleep(min(8, $_SESSION['login_failures'] - 4));
    }
    if (password_verify($password, ADMIN_PASSWORD_HASH)) {
        // Defeat session fixation: rotate the session id the moment auth
        // succeeds so any pre-set IPCADMIN cookie is invalidated.
        regenerate_session_id();
        $_SESSION[ADMIN_SESSION_KEY] = true;
        $_SESSION['login_failures']  = 0;
        header('Location: index.php');
        exit;
    }
    $_SESSION['login_failures']++;
    $error = 'Incorrect password. Please try again.';
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
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
    <div class="logo-mark">IPC</div>
    <div>
      <div class="logo-text">Insulation Products<br>Corporation</div>
      <div class="logo-sub">Admin Panel</div>
    </div>
  </div>
  <h1>Sign In</h1>
  <p>Enter the admin password to manage products.</p>
  <?php if ($error): ?>
    <div class="error"><?= h($error) ?></div>
  <?php endif; ?>
  <form method="POST">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autofocus placeholder="Admin password" required />
    <button type="submit">Sign In →</button>
  </form>
</div>
</body>
</html>
