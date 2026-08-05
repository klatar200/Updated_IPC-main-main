<?php
require_once 'config.php';
require_auth();

$info   = load_site_info();
$errors = [];
$saved  = isset($_GET['saved']);

// Optimistic-concurrency signature, same mechanism as edit.php:17-31. Without
// it, two tabs open on this page silently clobbered each other: the stale tab's
// save reverted the other tab's change with no warning at all.
// (DEPLOY_READINESS_v2 T1.7)
$storedSig = sha1(json_encode($info));

/**
 * Read one scalar field from $_POST, falling back to the CURRENTLY STORED
 * value when the key is absent entirely.
 *
 * settings.php used to rebuild site-info.json wholesale from $_POST, so any
 * field the request did not carry — a truncated POST, a partial form, a
 * max_input_vars cutoff — was written back as "". That produced
 * "© –2026" in the privacy footer, href="tel:" on every click-to-call link,
 * and an empty "faxNumber" in the JSON-LD. An ABSENT key now keeps the stored
 * value; an EMPTY key is still an intentional clear.
 */
function sf(string $key, $current): string {
    if (!array_key_exists($key, $_POST) || !is_string($_POST[$key])) {
        return is_string($current) ? $current : '';
    }
    return trim($_POST[$key]);
}
/** Same, for the newline/comma-separated list fields. */
function sfList(string $key, $current, string $sep = "\n"): array {
    if (!array_key_exists($key, $_POST) || !is_string($_POST[$key])) {
        return is_array($current) ? array_values($current) : [];
    }
    $parts = $sep === "\n"
        ? preg_split('/\r\n|\r|\n/', $_POST[$key])
        : explode($sep, $_POST[$key]);
    return array_values(array_filter(array_map('trim', $parts), static function ($v) { return $v !== ''; }));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $submittedSig = $_POST['orig_sig'] ?? '';
    if ($submittedSig !== '' && $submittedSig !== $storedSig) {
        $errors[] = 'These business details were changed by another session (or another browser tab) since you opened this page. Your edits were NOT saved. Reload to see the current version, then re-apply your changes — submitting again will overwrite the other change.';
    }

    $cur  = $info['company'] ?? [];
    $curT = $info['contact'] ?? [];
    $curA = $info['address'] ?? [];
    $curH = $info['hours'] ?? [];
    $curC = $info['certifications'] ?? [];
    $curS = $info['stats'] ?? [];
    $curO = $info['social'] ?? [];
    $curTh = $info['theme'] ?? [];

    $updated = [
        'company' => [
            'name'        => sf('company_name',        $cur['name']        ?? ''),
            'shortName'   => sf('company_shortName',   $cur['shortName']   ?? ''),
            'slogan'      => sf('company_slogan',      $cur['slogan']      ?? ''),
            'foundedYear' => sf('company_foundedYear', $cur['foundedYear'] ?? ''),
            'description' => sf('company_description', $cur['description'] ?? ''),
        ],
        'contact' => [
            'phone'     => sf('contact_phone',     $curT['phone']     ?? ''),
            'phoneDial' => sf('contact_phoneDial', $curT['phoneDial'] ?? ''),
            'fax'       => sf('contact_fax',       $curT['fax']       ?? ''),
            'email'     => sf('contact_email',     $curT['email']     ?? ''),
        ],
        'address' => [
            'street'  => sf('addr_street',  $curA['street']  ?? ''),
            'city'    => sf('addr_city',    $curA['city']    ?? ''),
            'state'   => sf('addr_state',   $curA['state']   ?? ''),
            'zip'     => sf('addr_zip',     $curA['zip']     ?? ''),
            'country' => sf('addr_country', $curA['country'] ?? ''),
        ],
        'hours' => [
            'text'   => sf('hours_text',   $curH['text']   ?? ''),
            'opens'  => sf('hours_opens',  $curH['opens']  ?? ''),
            'closes' => sf('hours_closes', $curH['closes'] ?? ''),
            'days'   => sfList('hours_days', $curH['days'] ?? [], ','),
        ],
        'certifications' => [
            'iso'   => sf('cert_iso', $curC['iso'] ?? ''),
            'other' => sfList('cert_other', $curC['other'] ?? []),
        ],
        'stats' => [
            'feetInStock'  => sf('stats_feet', $curS['feetInStock']  ?? ''),
            'minimumOrder' => sf('stats_min',  $curS['minimumOrder'] ?? ''),
        ],
        'social' => [
            'twitter'   => sf('social_twitter',   $curO['twitter']   ?? ''),
            'facebook'  => sf('social_facebook',  $curO['facebook']  ?? ''),
            'linkedin'  => sf('social_linkedin',  $curO['linkedin']  ?? ''),
            'youtube'   => sf('social_youtube',   $curO['youtube']   ?? ''),
            'pinterest' => sf('social_pinterest', $curO['pinterest'] ?? ''),
        ],
        'theme' => [
            'primaryColor' => sf('theme_primary', $curTh['primaryColor'] ?? ''),
            'darkColor'    => sf('theme_dark',    $curTh['darkColor']    ?? ''),
            'accentColor'  => sf('theme_accent',  $curTh['accentColor']  ?? ''),
            'accent2Color' => sf('theme_accent2', $curTh['accent2Color'] ?? ''),
            'logoUrl'      => sf('theme_logo',    $curTh['logoUrl']      ?? ''),
        ],
        'about' => [
            'paragraphs' => sfList('about_paragraphs', $info['about']['paragraphs'] ?? []),
        ],
        'catalogPdfUrl' => sf('catalogPdfUrl', $info['catalogPdfUrl'] ?? ''),
    ];

    if ($updated['company']['name'] === '') $errors[] = 'Company name is required.';
    if ($updated['contact']['email'] !== '' && !filter_var($updated['contact']['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'The email address is not valid.';
    }
    foreach (['twitter', 'facebook', 'linkedin', 'youtube', 'pinterest'] as $s) {
        $u = $updated['social'][$s];
        if ($u !== '' && !preg_match('#^https?://#i', $u)) {
            $errors[] = 'The ' . $s . ' link should be a full URL starting with http:// or https://';
        }
    }

    if (empty($errors)) {
        if (save_site_info($updated)) {
            audit_log('settings', 'site-info', 'Business details updated');
            header('Location: settings.php?saved=1');
            exit;
        }
        $errors[] = 'Failed to save site-info.json. Check file permissions on the data/ folder.';
    }
    $info = $updated; // repopulate the form with submitted values on error
}

// Nested read helpers with graceful fallback.
$c  = $info['company'] ?? [];
$ct = $info['contact'] ?? [];
$ad = $info['address'] ?? [];
$hr = $info['hours'] ?? [];
$ce = $info['certifications'] ?? [];
$sx = $info['stats'] ?? [];
$so = $info['social'] ?? [];
$daysStr  = implode(', ', $hr['days'] ?? []);
$otherStr = implode("\n", $ce['other'] ?? []);
$aboutStr = implode("\n", ($info['about']['paragraphs'] ?? []));
$th = $info['theme'] ?? [];
$navActive = 'settings';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Business Details</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    main { max-width: 1340px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 24px; }
    .layout { display: flex; gap: 24px; align-items: flex-start; }
    .layout > form { flex: 1 1 auto; min-width: 0; }
    .preview-col { flex: 0 0 380px; }
    .preview-inner { position: sticky; top: 24px; max-height: calc(100vh - 40px); overflow: auto; background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,45,82,0.06); }
    .preview-head { position: sticky; top: 0; background: #0d2d52; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; padding: 10px 16px; }
    .preview-body { padding: 16px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin: 0 0 18px; padding-bottom: 8px; border-bottom: 1px solid #e5e9ee; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { margin-bottom: 16px; }
    .form-group.full { grid-column: 1 / -1; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 5px; }
    .hint { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    input[type=text], textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d9e0; border-radius: 7px; font-size: 13px; color: #141414; outline: none; font-family: inherit; }
    input[type=text]:focus, textarea:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.1); }
    textarea { resize: vertical; line-height: 1.5; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .error-list li { font-size: 13px; margin-bottom: 4px; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    .btn { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
    .btn-primary { background: #005da3; color: #fff; }
    .btn-primary:hover { background: #004e8c; }
    .btn-secondary { background: #fff; color: #141414; border: 1px solid #d1d9e0; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 4px; }
    @media(max-width: 1024px) { .layout { flex-direction: column; } .preview-col { flex: 1 1 auto; width: 100%; } .preview-inner { position: static; max-height: none; } .grid-2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main>
  <h1>Business Details</h1>
  <p class="sub">These details appear across the public website — header, footer, contact page, and search-engine data. Changes go live within about a minute.</p>

  <?php if ($saved): ?><div class="alert-success">✅ Business details saved. The website will reflect the changes within ~60 seconds.</div><?php endif; ?>
  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>

  <div class="layout">
    <form method="POST">
      <div class="card">
        <div class="card-title">Branding &amp; Theme</div>
        <div class="grid-2">
          <div class="form-group"><label for="theme_primary">Primary color</label><input type="color" id="theme_primary" name="theme_primary" value="<?= h($th['primaryColor'] ?? '#005da3') ?>" style="height:44px;padding:4px;width:100%;"></div>
          <div class="form-group"><label for="theme_dark">Dark (headers &amp; footer)</label><input type="color" id="theme_dark" name="theme_dark" value="<?= h($th['darkColor'] ?? '#0d2d52') ?>" style="height:44px;padding:4px;width:100%;"></div>
          <div class="form-group"><label for="theme_accent">Accent</label><input type="color" id="theme_accent" name="theme_accent" value="<?= h($th['accentColor'] ?? '#00bef2') ?>" style="height:44px;padding:4px;width:100%;"></div>
          <div class="form-group"><label for="theme_accent2">Secondary accent</label><input type="color" id="theme_accent2" name="theme_accent2" value="<?= h($th['accent2Color'] ?? '#119ec8') ?>" style="height:44px;padding:4px;width:100%;"></div>
          <div class="form-group full">
            <label for="theme_logo">Logo URL</label>
            <input type="text" id="theme_logo" name="theme_logo" value="<?= h($th['logoUrl'] ?? '') ?>" placeholder="/logo.svg or https://…" />
            <div class="hint">Path or URL to your logo (SVG or PNG) — shown in the site header, footer, and product pages. Leave blank to use <code>/logo.svg</code>.</div>
          </div>
        </div>
        <div class="hint">These colors re-skin the entire public website. Changes go live within ~60 seconds.</div>
      </div>

      <div class="card">
        <div class="card-title">Company</div>
        <div class="grid-2">
          <div class="form-group full">
            <label for="company_name">Company Name *</label>
            <input type="text" id="company_name" name="company_name" value="<?= h($c['name'] ?? '') ?>" required />
          </div>
          <div class="form-group">
            <label for="company_shortName">Short Name / Abbreviation</label>
            <input type="text" id="company_shortName" name="company_shortName" value="<?= h($c['shortName'] ?? '') ?>" placeholder="e.g. IPC" />
          </div>
          <div class="form-group">
            <label for="company_foundedYear">Founded Year</label>
            <input type="text" id="company_foundedYear" name="company_foundedYear" value="<?= h($c['foundedYear'] ?? '') ?>" placeholder="e.g. 1974" />
          </div>
          <div class="form-group full">
            <label for="company_slogan">Slogan / Tagline</label>
            <input type="text" id="company_slogan" name="company_slogan" value="<?= h($c['slogan'] ?? '') ?>" />
          </div>
          <div class="form-group full">
            <label for="company_description">Short Description</label>
            <textarea id="company_description" name="company_description" rows="3"><?= h($c['description'] ?? '') ?></textarea>
            <div class="hint">Used in the site footer and search-engine (Schema.org) data.</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Contact</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="contact_phone">Phone (display)</label>
            <input type="text" id="contact_phone" name="contact_phone" value="<?= h($ct['phone'] ?? '') ?>" placeholder="630.771.0700" />
          </div>
          <div class="form-group">
            <label for="contact_phoneDial">Phone (dial link)</label>
            <input type="text" id="contact_phoneDial" name="contact_phoneDial" value="<?= h($ct['phoneDial'] ?? '') ?>" placeholder="+16307710700" />
            <div class="hint">Digits with country code for click-to-call (tel:) links.</div>
          </div>
          <div class="form-group">
            <label for="contact_fax">Fax</label>
            <input type="text" id="contact_fax" name="contact_fax" value="<?= h($ct['fax'] ?? '') ?>" placeholder="630.771.0701" />
          </div>
          <div class="form-group">
            <label for="contact_email">Email</label>
            <input type="text" id="contact_email" name="contact_email" value="<?= h($ct['email'] ?? '') ?>" placeholder="sales@example.com" />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Address</div>
        <div class="grid-2">
          <div class="form-group full">
            <label for="addr_street">Street</label>
            <input type="text" id="addr_street" name="addr_street" value="<?= h($ad['street'] ?? '') ?>" />
          </div>
          <div class="form-group">
            <label for="addr_city">City</label>
            <input type="text" id="addr_city" name="addr_city" value="<?= h($ad['city'] ?? '') ?>" />
          </div>
          <div class="form-group">
            <label for="addr_state">State / Region</label>
            <input type="text" id="addr_state" name="addr_state" value="<?= h($ad['state'] ?? '') ?>" />
          </div>
          <div class="form-group">
            <label for="addr_zip">ZIP / Postal Code</label>
            <input type="text" id="addr_zip" name="addr_zip" value="<?= h($ad['zip'] ?? '') ?>" />
          </div>
          <div class="form-group">
            <label for="addr_country">Country</label>
            <input type="text" id="addr_country" name="addr_country" value="<?= h($ad['country'] ?? '') ?>" placeholder="US" />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Business Hours</div>
        <div class="grid-2">
          <div class="form-group full">
            <label for="hours_text">Hours (display text)</label>
            <input type="text" id="hours_text" name="hours_text" value="<?= h($hr['text'] ?? '') ?>" placeholder="Mon–Fri, 8am–5pm CT" />
          </div>
          <div class="form-group">
            <label for="hours_opens">Opens (24h)</label>
            <input type="text" id="hours_opens" name="hours_opens" value="<?= h($hr['opens'] ?? '') ?>" placeholder="08:00" />
          </div>
          <div class="form-group">
            <label for="hours_closes">Closes (24h)</label>
            <input type="text" id="hours_closes" name="hours_closes" value="<?= h($hr['closes'] ?? '') ?>" placeholder="17:00" />
          </div>
          <div class="form-group full">
            <label for="hours_days">Open Days</label>
            <input type="text" id="hours_days" name="hours_days" value="<?= h($daysStr) ?>" placeholder="Monday, Tuesday, Wednesday, Thursday, Friday" />
            <div class="hint">Comma-separated. Used for search-engine hours data.</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Certifications & Stats</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="cert_iso">ISO Certification</label>
            <input type="text" id="cert_iso" name="cert_iso" value="<?= h($ce['iso'] ?? '') ?>" placeholder="ISO 9001" />
          </div>
          <div class="form-group">
            <label for="stats_min">Minimum Order</label>
            <input type="text" id="stats_min" name="stats_min" value="<?= h($sx['minimumOrder'] ?? '') ?>" placeholder="$50" />
          </div>
          <div class="form-group">
            <label for="stats_feet">Feet In Stock</label>
            <input type="text" id="stats_feet" name="stats_feet" value="<?= h($sx['feetInStock'] ?? '') ?>" placeholder="25 million" />
          </div>
          <div class="form-group full">
            <label for="cert_other">Other Certifications — one per line</label>
            <textarea id="cert_other" name="cert_other" rows="3" placeholder="MIL-SPEC&#10;RoHS Compliant"><?= h($otherStr) ?></textarea>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">About Page</div>
        <div class="form-group full">
          <label for="about_paragraphs">About story — one paragraph per line</label>
          <textarea id="about_paragraphs" name="about_paragraphs" rows="10"><?= h($aboutStr) ?></textarea>
          <div class="hint">Each line becomes a paragraph in the “Our Story” section of the About page. Leave a full sentence/paragraph on each line.</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Social Links</div>
        <div class="grid-2">
          <div class="form-group"><label for="social_facebook">Facebook</label><input type="text" id="social_facebook" name="social_facebook" value="<?= h($so['facebook'] ?? '') ?>" placeholder="https://facebook.com/…" /></div>
          <div class="form-group"><label for="social_linkedin">LinkedIn</label><input type="text" id="social_linkedin" name="social_linkedin" value="<?= h($so['linkedin'] ?? '') ?>" placeholder="https://linkedin.com/company/…" /></div>
          <div class="form-group"><label for="social_twitter">Twitter / X</label><input type="text" id="social_twitter" name="social_twitter" value="<?= h($so['twitter'] ?? '') ?>" placeholder="https://twitter.com/…" /></div>
          <div class="form-group"><label for="social_youtube">YouTube</label><input type="text" id="social_youtube" name="social_youtube" value="<?= h($so['youtube'] ?? '') ?>" placeholder="https://youtube.com/…" /></div>
          <div class="form-group"><label for="social_pinterest">Pinterest</label><input type="text" id="social_pinterest" name="social_pinterest" value="<?= h($so['pinterest'] ?? '') ?>" placeholder="https://pinterest.com/…" /></div>
          <div class="form-group"><label for="catalogPdfUrl">Catalog PDF URL</label><input type="text" id="catalogPdfUrl" name="catalogPdfUrl" value="<?= h($info['catalogPdfUrl'] ?? '') ?>" placeholder="/pdfs/catalog.pdf" /></div>
        </div>
      </div>

      <div class="form-actions">
        <a href="index.php" class="btn btn-secondary">Cancel</a>
        <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
        <input type="hidden" name="orig_sig" value="<?= h($storedSig) ?>">
        <button type="submit" class="btn btn-primary">Save Business Details</button>
      </div>
    </form>

    <aside class="preview-col">
      <div class="preview-inner">
        <div class="preview-head">Live preview</div>
        <div class="preview-body" id="settings-preview"></div>
      </div>
    </aside>
  </div>
</main>
<script src="settings-preview.js"></script>
<script src="unsaved.js" defer></script>
</body>
</html>
