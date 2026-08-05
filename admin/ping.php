<?php
/**
 * Session keepalive / liveness probe for admin/unsaved.js.
 *
 * Deliberately does NOT call require_auth() — that would redirect to the login
 * page and the fetch() would follow it, returning 200 and looking "alive".
 * Returns a tiny JSON body instead so the editing page can tell the admin his
 * session has gone BEFORE he clicks Save. (DEPLOY_READINESS_v2 T1.8)
 */
require_once 'config.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, private');
header('X-Content-Type-Options: nosniff');

echo json_encode(['ok' => is_authenticated()]);
