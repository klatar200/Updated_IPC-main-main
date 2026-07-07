<?php
/**
 * IPC contact / RFQ mail handler.
 * Lives at public_html/contact.php — served by Apache as PHP.
 * Called via fetch() POST from the React SPA ContactPage.
 *
 * Security measures:
 *   - POST-only, JSON response
 *   - Same-origin referer check
 *   - Honeypot field ("website") — bots fill it in, humans leave it blank
 *   - Per-IP rate limit: 5 submissions per 10-minute window
 *   - All input stripped and HTML-entity encoded before use in email body
 *   - No SQL, no file writes except the rate-limit temp file
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// ── POST only ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

// ── Same-origin referer check ──────────────────────────────────
// Blocks cross-site form submissions. Not foolproof on its own, but layered
// with the honeypot it stops the overwhelming majority of abuse.
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$host    = $_SERVER['HTTP_HOST']    ?? '';
if ($host !== '' && strpos($referer, $host) === false) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Forbidden']);
    exit;
}

// ── Honeypot ───────────────────────────────────────────────────
// The "website" field is hidden from humans (off-screen CSS in the form).
// Bots that fill every field will populate it; we silently accept and discard.
if (!empty($_POST['website'])) {
    echo json_encode(['ok' => true]);
    exit;
}

// ── Rate limit: 5 per IP per 10 minutes ───────────────────────
$ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$safeIp   = preg_replace('/[^a-fA-F0-9:.]/', '', $ip);
$rateFile = sys_get_temp_dir() . '/ipc_rl_' . md5($safeIp) . '.json';
$now      = time();
$window   = 600; // seconds
$maxHits  = 5;

$hits = [];
if (file_exists($rateFile)) {
    $hits = json_decode(file_get_contents($rateFile), true);
    if (!is_array($hits)) $hits = [];
}
// Drop timestamps outside the window
$hits = array_values(array_filter($hits, function ($t) use ($now, $window) {
    return ($now - $t) < $window;
}));
if (count($hits) >= $maxHits) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'Too many submissions. Please try again in a few minutes, or call 630.771.0700 directly.']);
    exit;
}
$hits[] = $now;
file_put_contents($rateFile, json_encode($hits), LOCK_EX);

// ── Sanitise helper ────────────────────────────────────────────
function s(string $val): string {
    return htmlspecialchars(strip_tags(trim($val)), ENT_QUOTES, 'UTF-8');
}

// ── Routing ────────────────────────────────────────────────────
$formType = trim($_POST['form_type'] ?? 'message');
$to       = 'sales@insulationproducts.com';

if ($formType === 'rfq') {

    // ── RFQ form ───────────────────────────────────────────────
    $name        = s($_POST['name']            ?? '');
    $rawEmail    = trim($_POST['email']        ?? '');
    $email       = filter_var($rawEmail, FILTER_VALIDATE_EMAIL) ? $rawEmail : '';
    $phone       = s($_POST['phone']           ?? '');
    $company     = s($_POST['company']         ?? '');
    $partNumber  = s($_POST['partNumber']      ?? '');
    $material    = s($_POST['material']        ?? '');
    $quantity    = s($_POST['quantity']        ?? '');
    $reqDate     = s($_POST['requiredDate']    ?? '');
    $specialReqs = s($_POST['specialReqs']     ?? '');
    $notes       = s($_POST['additionalNotes'] ?? '');

    if ($name === '' || $email === '') {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'Name and a valid email address are required.']);
        exit;
    }

    $subject = 'IPC Quote Request — ' . ($partNumber !== '' ? $partNumber : 'General RFQ') . ' — ' . $name;
    $body    = "IPC QUOTE REQUEST\n"
             . "=================\n\n"
             . "Name:            {$name}\n"
             . "Company:         {$company}\n"
             . "Email:           {$email}\n"
             . "Phone:           {$phone}\n\n"
             . "Part Number:     {$partNumber}\n"
             . "Material Type:   {$material}\n"
             . "Quantity:        {$quantity}\n"
             . "Required By:     {$reqDate}\n\n"
             . "Special Requirements:\n{$specialReqs}\n\n"
             . "Additional Notes:\n{$notes}\n\n"
             . "---\n"
             . "Submitted: " . date('Y-m-d H:i:s T') . "\n"
             . "IP:        {$ip}\n";

    $replyTo = $email;

} else {

    // ── General message form ───────────────────────────────────
    $name    = s($_POST['name']    ?? '');
    $rawEmail = trim($_POST['email'] ?? '');
    $email   = filter_var($rawEmail, FILTER_VALIDATE_EMAIL) ? $rawEmail : '';
    $phone   = s($_POST['phone']   ?? '');
    $company = s($_POST['company'] ?? '');
    $subj    = s($_POST['subject'] ?? '');
    $message = s($_POST['message'] ?? '');

    if ($name === '' || $email === '' || $message === '') {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'Name, a valid email address, and a message are required.']);
        exit;
    }

    $subject = 'IPC Contact Form — ' . ($subj !== '' ? $subj : 'General Inquiry') . ' — ' . $name;
    $body    = "IPC CONTACT FORM\n"
             . "================\n\n"
             . "Name:    {$name}\n"
             . "Company: {$company}\n"
             . "Email:   {$email}\n"
             . "Phone:   {$phone}\n"
             . "Subject: {$subj}\n\n"
             . "Message:\n{$message}\n\n"
             . "---\n"
             . "Submitted: " . date('Y-m-d H:i:s T') . "\n"
             . "IP:        {$ip}\n";

    $replyTo = $email;
}

// ── Send to IPC sales team ──────────────────────────────────────
// Reply-To is set to the visitor's email so sales can reply directly.
// From is a no-reply on the domain — Network Solutions requires the From
// address to exist on the account to pass their outbound spam filter.
$headers  = "From: IPC Website <noreply@insulationproducts.com>\r\n";
$headers .= "Reply-To: {$replyTo}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "X-Mailer: PHP/" . PHP_VERSION . "\r\n";

$sent = mail($to, $subject, $body, $headers);

if (!$sent) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => 'The mail server could not send your message. Please call 630.771.0700 or email sales@insulationproducts.com directly.',
    ]);
    exit;
}

// ── Auto-reply to visitor ───────────────────────────────────────
// Best-effort only — we never fail the request if this one doesn't go through.
if ($formType === 'rfq') {
    $replySubject = 'We received your quote request — Insulation Products Corporation';
    $replyBody    = "Hello {$name},\n\n"
                  . "Thank you for submitting a quote request to Insulation Products Corporation.\n\n"
                  . "Our sales team will review your request and respond within one business day —\n"
                  . "often the same day for in-stock items.\n\n"
                  . "YOUR REQUEST SUMMARY\n"
                  . "--------------------\n"
                  . "Part Number:   {$partNumber}\n"
                  . "Material Type: {$material}\n"
                  . "Quantity:      {$quantity}\n"
                  . "Required By:   {$reqDate}\n\n"
                  . "For urgent needs, reach us directly:\n"
                  . "  Phone: 630.771.0700 (Mon-Fri, 8am-5pm CT)\n"
                  . "  Fax:   630.771.0701\n"
                  . "  Email: sales@insulationproducts.com\n\n"
                  . "Insulation Products Corporation\n"
                  . "250 Gibraltar Dr, Bolingbrook, IL 60440\n"
                  . "www.insulationproducts.com\n";
} else {
    $replySubject = 'We received your message — Insulation Products Corporation';
    $replyBody    = "Hello {$name},\n\n"
                  . "Thank you for contacting Insulation Products Corporation.\n\n"
                  . "Our team will respond within one business day.\n\n"
                  . "For urgent needs, reach us directly:\n"
                  . "  Phone: 630.771.0700 (Mon-Fri, 8am-5pm CT)\n"
                  . "  Fax:   630.771.0701\n"
                  . "  Email: sales@insulationproducts.com\n\n"
                  . "Insulation Products Corporation\n"
                  . "250 Gibraltar Dr, Bolingbrook, IL 60440\n"
                  . "www.insulationproducts.com\n";
}

$replyHeaders  = "From: Insulation Products Corporation <noreply@insulationproducts.com>\r\n";
$replyHeaders .= "Reply-To: sales@insulationproducts.com\r\n";
$replyHeaders .= "MIME-Version: 1.0\r\n";
$replyHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
$replyHeaders .= "X-Mailer: PHP/" . PHP_VERSION . "\r\n";

@mail($replyTo, $replySubject, $replyBody, $replyHeaders); // best-effort, no error check

echo json_encode(['ok' => true]);
