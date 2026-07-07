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

// ─── Login throttle (persistent, IP-keyed) ────────────────────────────────
// The old throttle counted failures in $_SESSION, which an attacker resets
// simply by not sending the session cookie. This version persists failures
// to a small JSON file keyed by client IP so the delay actually applies to
// scripted attacks. The file lives in admin/ (already writable — audit_log()
// writes here) and is blocked from the web by admin/.htaccess (*.json rule).
define('LOGIN_THROTTLE_FILE', __DIR__ . '/.login-throttle.json');
define('LOGIN_THROTTLE_WINDOW', 900); // forget failures older than 15 minutes

function login_throttle_client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

// Read the throttle map, dropping entries whose last failure is outside the
// window so the file can't grow without bound.
function login_throttle_read(): array {
    if (!file_exists(LOGIN_THROTTLE_FILE)) return [];
    $raw = @file_get_contents(LOGIN_THROTTLE_FILE);
    $map = $raw ? json_decode($raw, true) : [];
    if (!is_array($map)) return [];
    $now = time();
    foreach ($map as $ip => $rec) {
        if (!is_array($rec) || ($now - (int)($rec['t'] ?? 0)) > LOGIN_THROTTLE_WINDOW) {
            unset($map[$ip]);
        }
    }
    return $map;
}

function login_throttle_write(array $map): void {
    @file_put_contents(LOGIN_THROTTLE_FILE, json_encode($map), LOCK_EX);
}

// How many recent failures this IP has accumulated (0 if none / expired).
function login_failure_count(string $ip): int {
    $map = login_throttle_read();
    return (int)($map[$ip]['c'] ?? 0);
}

function login_register_failure(string $ip): void {
    $map = login_throttle_read();
    $map[$ip] = ['c' => (int)($map[$ip]['c'] ?? 0) + 1, 't' => time()];
    login_throttle_write($map);
}

function login_reset_failures(string $ip): void {
    $map = login_throttle_read();
    unset($map[$ip]);
    login_throttle_write($map);
}

// Helper: find a product by SKU
function find_product(array $products, string $sku): int {
    foreach ($products as $i => $p) {
        if (($p['sku'] ?? '') === $sku) return $i;
    }
    return -1;
}

// Helper: derive the canonical PDF filename for a SKU. Single source of truth
// for the sanitization rule (non-alphanumerics → dash, collapse repeats, trim,
// lowercase) so upload, rename, and display all agree on the filename.
function pdf_filename_for_sku(string $sku): string {
    $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $sku); // non-alphanumeric → dash
    $safe = preg_replace('/-{2,}/', '-', $safe);            // collapse repeated dashes
    $safe = trim($safe, '-');                               // trim leading/trailing dashes
    $safe = strtolower($safe);                              // lowercase
    return $safe . '.pdf';
}

// Helper: coerce an arbitrary product row into the exact schema the React app
// and the add/edit forms expect. Used by the JSON importer so a malformed or
// partial row can't land in products-all.json with a broken specTable shape,
// a stringified badge list, or unexpected extra keys. Unknown keys are dropped
// (whitelist), types are coerced, and both spec tables are guaranteed to have
// their container structure.
function normalize_product(array $p): array {
    $str = function ($v) { return is_scalar($v) ? trim((string)$v) : ''; };
    // badges/description accept either an array or a newline-delimited string.
    $toList = function ($v) {
        if (is_array($v)) {
            $items = array_map(function ($x) { return is_scalar($x) ? trim((string)$x) : ''; }, $v);
        } elseif (is_string($v)) {
            $items = array_map('trim', explode("\n", $v));
        } else {
            $items = [];
        }
        return array_values(array_filter($items, function ($x) { return $x !== ''; }));
    };

    $sku = $str($p['sku'] ?? $p['id'] ?? '');

    // specTable1 → { title, rows[] }
    $st1      = is_array($p['specTable1'] ?? null) ? $p['specTable1'] : [];
    $st1Title = $str($st1['title'] ?? 'Specifications:');
    if ($st1Title === '') $st1Title = 'Specifications:';
    $st1Rows  = (isset($st1['rows']) && is_array($st1['rows'])) ? array_values($st1['rows']) : [];

    // specTable2 → { columnSpans[], rows[] }
    $st2      = is_array($p['specTable2'] ?? null) ? $p['specTable2'] : [];
    $st2Cols  = (isset($st2['columnSpans']) && is_array($st2['columnSpans'])) ? array_values($st2['columnSpans']) : [];
    $st2Rows  = (isset($st2['rows']) && is_array($st2['rows'])) ? array_values($st2['rows']) : [];

    return [
        'id'                    => $sku,
        'sku'                   => $sku,
        'name'                  => $str($p['name'] ?? ''),
        'partType'              => $str($p['partType'] ?? ''),
        'caption'               => $str($p['caption'] ?? ''),
        'operatingTemp'         => $str($p['operatingTemp'] ?? ''),
        'specificationsSummary' => $str($p['specificationsSummary'] ?? ''),
        'photoUrl'              => $str($p['photoUrl'] ?? ''),
        'badges'                => $toList($p['badges'] ?? []),
        'description'           => $toList($p['description'] ?? []),
        'specTable1'            => ['title' => $st1Title, 'rows' => $st1Rows],
        'specTable2'            => ['columnSpans' => $st2Cols, 'rows' => $st2Rows],
        // Preserve an existing PDF link if the imported row carries one.
        'pdfUrl'                => $str($p['pdfUrl'] ?? ''),
    ];
}

// Helper: sanitize a string for display.
// No `mixed` type-hint so this works on PHP 7.4+ as well as 8.x — some
// Network Solutions shared-hosting plans still default to older PHP.
function h($val): string {
    return htmlspecialchars((string)($val ?? ''), ENT_QUOTES, 'UTF-8');
}
?>
