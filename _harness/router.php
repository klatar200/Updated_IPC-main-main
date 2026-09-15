<?php
/**
 * Router for `php -S` that emulates the parts of public/.htaccess that matter
 * to the test suites:
 *
 *   RewriteRule ^sitemap\.xml$ sitemap.php [L]
 *
 *   RewriteCond %{REQUEST_FILENAME} !-f
 *   RewriteCond %{REQUEST_FILENAME} !-d
 *   RewriteRule ^ index.html [QSA,L]
 *
 * The sitemap rule is emulated because the sitemap is generated from the live
 * catalog and `plan5c-sitemap.js` fetches it at its real address. Without it
 * /sitemap.xml falls through to the SPA shell and every assertion in that suite
 * fails for the wrong reason.
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

// A-9.P3-1 — answer for the docroot this server was actually given.
//
// This was `__DIR__ . '/site'`, a constant, while PLAN-11 §3.4 hands the same
// router to a private mirror per agent with `php -S -t <docroot>`. Every one of
// those servers then tested file existence — and `require`d /sitemap.xml —
// against `_harness/site` instead of its own tree. Measured both directions on
// a live private mirror: a file present ONLY in the served docroot came back as
// the SPA shell with a 200 (so a real uploaded photo read as missing, which
// cost one pass a false MIME finding), and /sitemap.xml rendered the SWEEP
// mirror's catalog, so a pass that mutated its own catalog measured the other
// tree. Two passes hit it independently; one lost an hour to it.
//
// `php -S -t <dir>` sets DOCUMENT_ROOT to <dir>, so that is the authority.
// The fallback keeps every existing invocation working unchanged — the sweep
// serves `-t _harness/site`, which is exactly what the old constant resolved
// to, and `_harness/audit9-router-docroot.js` arm E asserts that.
$root = isset($_SERVER['DOCUMENT_ROOT']) && $_SERVER['DOCUMENT_ROOT'] !== ''
    ? rtrim($_SERVER['DOCUMENT_ROOT'], '/')
    : __DIR__ . '/site';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = rawurldecode($path);

// [L] before the catch-all, exactly as in .htaccess.
if ($path === '/sitemap.xml' && is_file($root . '/sitemap.php')) {
    $path = '/sitemap.php';
    $_SERVER['SCRIPT_FILENAME'] = $root . '/sitemap.php';
    require $root . '/sitemap.php';
    return true;
}

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
