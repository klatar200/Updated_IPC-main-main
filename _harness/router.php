<?php
/**
 * Router for `php -S` that emulates the parts of public/.htaccess that matter
 * to the test suites:
 *
 *   RewriteCond %{REQUEST_FILENAME} !-f
 *   RewriteCond %{REQUEST_FILENAME} !-d
 *   RewriteRule ^ index.html [QSA,L]
 *
 * i.e. an existing file or directory is served as-is; anything else falls
 * through to the SPA shell. Without this a direct load of /products or
 * /company 404s under php -S and every deep-link check fails for the wrong
 * reason.
 *
 * NOT emulated (php -S ignores .htaccess and .user.ini entirely — see
 * GUARDRAILS 4.3): the SetEnvIf-scoped cache headers, the dotfile block, the
 * admin/ and data/ file-blocking rules, and every limit in public/.user.ini.
 * Anything depending on those is [UNVERIFIED] locally.
 */

$root = __DIR__ . '/site';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = rawurldecode($path);

// Containment: never let ".." climb out of the mirror.
$full = realpath($root . $path);
$realRoot = realpath($root);

if ($full !== false && $realRoot !== false && strpos($full, $realRoot) === 0) {
    if (is_dir($full)) {
        // A directory: serve its index.php / index.html if present, as Apache would.
        foreach (['index.php', 'index.html'] as $idx) {
            if (file_exists($full . '/' . $idx)) {
                if (substr($idx, -4) === '.php') { return false; }  // let php -S execute it
                readfile($full . '/' . $idx);
                return true;
            }
        }
    } elseif (is_file($full)) {
        return false;   // php -S serves it (and executes .php)
    }
}

// No such file or directory -> the SPA shell, 200, exactly like the rewrite.
$shell = $root . '/index.html';
if (file_exists($shell)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($shell);
    return true;
}
http_response_code(404);
echo 'harness: no index.html in the mirror';
return true;
