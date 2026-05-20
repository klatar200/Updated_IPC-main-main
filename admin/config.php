<?php
/**
 * IPC Admin — Shared Configuration
 * Edit these constants to match your server setup.
 */

// Path to products-all.json — relative to document root
define('PRODUCTS_JSON', __DIR__ . '/../data/products-all.json');

// Path to PDF storage folder — relative to document root
define('PDF_DIR', __DIR__ . '/../pdfs/');

// Web URL to the PDF folder (used to build download links)
define('PDF_URL', '/pdfs/');

// Admin session key
define('ADMIN_SESSION_KEY', 'ipc_admin_authenticated');

// ─── IMPORTANT: Rotate the password before deploying! ──────
// The hash below is the shipped default and must be overridden.
//
// DO NOT call password_hash() here — it generates a new random salt
// each time and would break password_verify(). Always store the hash
// as a fixed string.
//
// To rotate the password, create an admin/config.local.php override
// (gitignored) — see admin/README.md for the full flow.
// ────────────────────────────────────────────────────────────
// Load local password override if present (gitignored). Falls back to the
// shipped default hash. Customers should create config.local.php with their
// own hash — see admin/README.md.
if (file_exists(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}
if (!defined('ADMIN_PASSWORD_HASH')) {
    define('ADMIN_PASSWORD_HASH', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
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

function csrf_check(): void {
    $token = $_POST['csrf_token'] ?? '';
    if (!hash_equals(csrf_token(), $token)) {
        http_response_code(403);
        die('Invalid CSRF token. Please go back and try again.');
    }
}

// Harden session cookies BEFORE session_start() — these flags only take
// effect on the cookie that session_start() sets, so they have to be
// configured first.
if (session_status() === PHP_SESSION_NONE) {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
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

// Helper: redirect to login if not authenticated
function require_auth(): void {
    if (!is_authenticated()) {
        header('Location: auth.php');
        exit;
    }
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

// Helper: save products array to JSON
// Uses LOCK_EX to prevent corruption from concurrent writes.
// Creates a timestamped backup before overwriting.
function save_products(array $products): bool {
    $path = PRODUCTS_JSON;
    $dir  = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    // Backup current file before overwriting (#4 — backup-on-write)
    if (file_exists($path)) {
        $backupPath = $dir . '/products-all.backup.' . date('Ymd-His') . '.json';
        @copy($path, $backupPath);
        // Keep only the 5 most recent backups to avoid disk clutter
        $backups = glob($dir . '/products-all.backup.*.json');
        if ($backups && count($backups) > 5) {
            sort($backups); // oldest first
            $toDelete = array_slice($backups, 0, count($backups) - 5);
            foreach ($toDelete as $old) @unlink($old);
        }
    }
    // Sort by SKU before saving
    usort($products, fn($a, $b) => strcmp($a['sku'] ?? '', $b['sku'] ?? ''));
    $json = json_encode($products, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    // LOCK_EX prevents concurrent write corruption (#3)
    return file_put_contents($path, $json, LOCK_EX) !== false;
}

// Helper: write a line to the admin audit log (#6 — audit logging)
function audit_log(string $action, string $sku, string $detail = ''): void {
    $logPath = __DIR__ . '/admin-log.jsonl';
    $entry = json_encode([
        'ts'     => date('Y-m-d H:i:s'),
        'action' => $action,
        'sku'    => $sku,
        'detail' => $detail,
        'ip'     => $_SERVER['REMOTE_ADDR'] ?? '',
        'ua'     => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 120),
    ]) . "\n";
    file_put_contents($logPath, $entry, FILE_APPEND | LOCK_EX);
}

// Helper: find a product by SKU
function find_product(array $products, string $sku): int {
    foreach ($products as $i => $p) {
        if (($p['sku'] ?? '') === $sku) return $i;
    }
    return -1;
}

// Helper: sanitize a string for display.
// No `mixed` type-hint so this works on PHP 7.4+ as well as 8.x — some
// Network Solutions shared-hosting plans still default to older PHP.
function h($val): string {
    return htmlspecialchars((string)($val ?? ''), ENT_QUOTES, 'UTF-8');
}
?>
