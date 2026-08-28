<?php
/**
 * Session keepalive / liveness probe for admin/unsaved.js.
 *
 * Deliberately does NOT call require_auth() — that would redirect to the login
 * page and the fetch() would follow it, returning 200 and looking "alive".
 * Returns a tiny JSON body instead so the editing page can tell the admin his
 * session has gone BEFORE he clicks Save. (DEPLOY_READINESS_v2 T1.8)
 */
// A-7.3 — do not START a session for a caller that has no session cookie.
//
// This endpoint is unauthenticated by design, has no throttle, and is polled
// automatically by every open editing tab (unsaved.js). Every anonymous hit
// used to mint a session file that lives eight hours, so a stranger could fill
// the session store — and A-5.9's own comment names inode exhaustion as the
// condition under which the CONTACT FORM's rate-limit files stop being
// written, so the two compound.
//
// Nothing is lost: with no cookie there is nothing to look up, and
// is_authenticated() is false either way. A signed-in owner sends the cookie,
// so his keepalive starts a session and behaves exactly as before.
define('IPC_SESSION_OPTIONAL', true);
require_once 'config.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, private');
header('X-Content-Type-Options: nosniff');

echo json_encode(['ok' => is_authenticated()]);
