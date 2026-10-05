<?php
require_once 'config.php';
require_auth();

/**
 * Marketing PDFs — the full-catalog PDF and the Services brochures.
 *
 * Admin audit 2026-10-05, G1 (WHATS_LEFT §1ap, Keagan: "yes to G1"). Business
 * Details → Catalog PDF URL and each Value-Added Service's Brochure PDF URL
 * only POINT at a file; nothing in the dashboard could put one on the server,
 * so the footer catalog link the FAQ promises was an FTP job.
 *
 * Rules, each on purpose (the Site Images & Logo page's, applied to PDFs):
 * - The SAME checks as a product data sheet (uploaded_pdf_problem()).
 * - Files go to pdfs/marketing/, where the shipped brochures already live,
 *   under a name made from the uploaded file's own name (letters, digits and
 *   dashes), and an upload NEVER overwrites: a second "catalog.pdf" becomes
 *   catalog-2.pdf, because an older backup may still point at the first.
 * - This page never deletes a file. Choosing where a PDF is used changes one
 *   value, read fresh from disk under the data lock (WHATS_LEFT §1an); Business
 *   Details and Page Content keep their own stale-tab checks.
 * - A damaged data file is never saved over (NEW-N2-1).
 */

/** Every PDF in pdfs/marketing/, newest first: name → [url, size, mtime]. */
function marketing_pdfs(): array {
    $out = [];
    if (!is_dir(MARKETING_PDF_DIR)) return $out;
    foreach (@scandir(MARKETING_PDF_DIR) ?: [] as $n) {
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/i', $n) || !is_file(MARKETING_PDF_DIR . $n)) continue;
        $out[$n] = ['url' => MARKETING_PDF_URL . $n, 'size' => (int)@filesize(MARKETING_PDF_DIR . $n), 'mtime' => (int)@filemtime(MARKETING_PDF_DIR . $n)];
    }
    uasort($out, static fn($a, $b) => $b['mtime'] <=> $a['mtime']);
    return $out;
}

/** A safe file name from the uploaded one, never an existing file's. */
function marketing_pdf_name(string $original): string {
    $stem = (string)preg_replace('/[^A-Za-z0-9]+/', '-', pathinfo($original, PATHINFO_FILENAME));
    $stem = trim(substr(trim($stem, '-'), 0, 60), '-');
    if ($stem === '') $stem = 'document';
    $name = $stem . '.pdf';
    for ($n = 2; file_exists(MARKETING_PDF_DIR . $name) && $n < 1000; $n++) $name = $stem . '-' . $n . '.pdf';
    return $name;
}

/** Where each URL is used now: url → list of human labels. */
function marketing_pdf_uses(array $info, array $content): array {
    $uses = [];
    $cat = (string)($info['catalogPdfUrl'] ?? '');
    if ($cat !== '') $uses[$cat][] = 'Full product catalog (footer link)';
    foreach ((array)($content['services'] ?? []) as $sv) {
        $u = is_array($sv) ? (string)($sv['brochure']['url'] ?? '') : '';
        if ($u !== '') $uses[$u][] = 'Brochure: ' . ($sv['title'] ?? 'service');
    }
    return $uses;
}

/**
 * Point one target at $url ('' = stop using it there). $target is "catalog" or
 * "service:<index>". The caller holds the data lock for the file it changes.
 */
function marketing_pdf_assign(string $target, string $url, array &$errors): string {
    if ($target === 'catalog') {
        if (data_file_damaged(SITE_INFO_JSON)) { $errors[] = 'The saved business details (data/site-info.json) are damaged and cannot be read, so nothing was saved. Go to Backups and restore the most recent Business Details entry, then try again.'; return ''; }
        $info = load_site_info();
        $info['catalogPdfUrl'] = $url;
        if (!save_site_info($info)) { $errors[] = 'Could not save data/site-info.json. Check that the data/ folder is writable.'; return ''; }
        return 'the full product catalog link in the footer';
    }
    if (!preg_match('/^service:(\d+)$/', $target, $m)) { $errors[] = 'Choose where to use this PDF.'; return ''; }
    if (data_file_damaged(CONTENT_JSON)) { $errors[] = 'The saved page content (data/content.json) is damaged and cannot be read, so nothing was saved. Go to Backups and restore the most recent Page Content entry, then try again.'; return ''; }
    $content = load_content();
    $i = (int)$m[1];
    if (!isset($content['services'][$i]) || !is_array($content['services'][$i])) { $errors[] = 'That service no longer exists — reload this page.'; return ''; }
    $sv = &$content['services'][$i];
    if ($url === '') {
        unset($sv['brochure']);
    } else {
        $label = is_array($sv['brochure'] ?? null) ? (string)($sv['brochure']['label'] ?? '') : '';
        $sv['brochure'] = ['url' => $url, 'label' => $label !== '' ? $label : 'Download brochure'];
    }
    $title = (string)($sv['title'] ?? 'service');
    unset($sv);
    if (!save_content($content)) { $errors[] = 'Could not save data/content.json. Check that the data/ folder is writable.'; return ''; }
    return 'the brochure link on the "' . $title . '" service card';
}

$errors  = [];
$flash   = flash_take();
$success = $flash['type'] === 'success' ? $flash['msg'] : '';
if ($flash['type'] === 'error' && $flash['msg'] !== '') $errors[] = $flash['msg'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = as_str($_POST['action'] ?? null);
    $target = as_str($_POST['target'] ?? null);
    $lockFor = $target === 'catalog' ? 'site-info' : (strpos($target, 'service:') === 0 ? 'content' : '');
    if ($lockFor !== '') data_write_lock($lockFor);   // before the read (WHATS_LEFT §1an)

    if ($action === 'upload') {
        if (!upload_field_is_single('pdf_file')) {
            $errors[] = 'Please choose one PDF at a time.';
        } elseif (!isset($_FILES['pdf_file']) || $_FILES['pdf_file']['error'] !== UPLOAD_ERR_OK) {
            $errors[] = upload_error_message($_FILES['pdf_file']['error'] ?? UPLOAD_ERR_NO_FILE, 'PDF');
        } elseif (!is_dir(MARKETING_PDF_DIR) && !@mkdir(MARKETING_PDF_DIR, 0755, true) && !is_dir(MARKETING_PDF_DIR)) {
            $errors[] = 'Could not create the pdfs/marketing folder on the server. Create public_html/pdfs/marketing/ over FTP and make it writable (755).';
        } elseif (($p = uploaded_pdf_problem($_FILES['pdf_file'])) !== '') {
            $errors[] = $p;
        } elseif ($target !== '' && $target !== 'none' && $lockFor === '') {
            $errors[] = 'Choose where to use this PDF.';
        } elseif ($lockFor === 'site-info' && data_file_damaged(SITE_INFO_JSON)) {
            // Checked BEFORE the file is stored, so a damaged data file never
            // leaves an orphan PDF behind.
            $errors[] = 'The saved business details (data/site-info.json) are damaged and cannot be read, so nothing was saved. Go to Backups and restore the most recent Business Details entry, then try again.';
        } elseif ($lockFor === 'content' && data_file_damaged(CONTENT_JSON)) {
            $errors[] = 'The saved page content (data/content.json) is damaged and cannot be read, so nothing was saved. Go to Backups and restore the most recent Page Content entry, then try again.';
        } else {
            $name = marketing_pdf_name((string)$_FILES['pdf_file']['name']);
            if (!move_uploaded_file($_FILES['pdf_file']['tmp_name'], MARKETING_PDF_DIR . $name)) {
                $errors[] = 'Upload failed. Check write permissions on the /pdfs/marketing/ folder.';
            } else {
                $url = MARKETING_PDF_URL . $name;
                $where = $lockFor !== '' ? marketing_pdf_assign($target, $url, $errors) : '';
                audit_log('marketing-pdf', $name, 'Uploaded ' . $name . ($where !== '' ? ' and used it for ' . $where : ''));
                if (empty($errors)) {
                    flash_redirect($name . ' uploaded' . ($where !== '' ? ' and now used for ' . $where . '. The website shows it within about a minute.' : '. Choose below where to use it.'), 'success', 'marketing-pdfs.php');
                }
            }
        }
    } elseif ($action === 'use' || $action === 'stop') {
        $file = as_str($_POST['file'] ?? null);
        $all  = marketing_pdfs();
        if ($action === 'use' && !isset($all[$file])) {
            $errors[] = 'Pick a PDF from the list.';
        } elseif ($lockFor === '') {
            $errors[] = 'Choose where to use this PDF.';
        } else {
            $url = $action === 'use' ? $all[$file]['url'] : '';
            $where = marketing_pdf_assign($target, $url, $errors);
            if ($where !== '') {
                audit_log('marketing-pdf', $action === 'use' ? $file : $target, $action === 'use' ? $file . ' now used for ' . $where : 'Stopped using a PDF for ' . $where);
                flash_redirect($action === 'use'
                    ? $file . ' is now used for ' . $where . '. The website shows it within about a minute.'
                    : 'Removed the PDF from ' . $where . ' (the file itself stays on the server).', 'success', 'marketing-pdfs.php');
            }
        }
    } else {
        $errors[] = 'Unknown action.';
    }
}

$info     = load_site_info();
$content  = load_content();
$pdfs     = marketing_pdfs();
$uses     = marketing_pdf_uses($info, $content);
$services = [];
foreach ((array)($content['services'] ?? []) as $i => $sv) if (is_array($sv)) $services[$i] = (string)($sv['title'] ?? ('Service ' . ($i + 1)));
$csrf     = csrf_token();
$targetOptions = function (bool $withNone) use ($services) {
    $o = $withNone ? '<option value="none">Just upload it — I will choose later</option>' : '<option value="">Use it for…</option>';
    $o .= '<option value="catalog">Full product catalog (link in the footer of every page)</option>';
    foreach ($services as $i => $t) $o .= '<option value="service:' . (int)$i . '">Brochure on the Services page — ' . h($t) . '</option>';
    return $o;
};
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><link rel="icon" type="image/svg+xml" href="logo.svg" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Catalog &amp; Brochure PDFs</title>
  <?= admin_head() ?>
  <style>
    main { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
    .row select, .row input[type=file] { flex: 1 1 240px; min-width: 0; }
    input[type=file] { padding: 8px; border: 2px dashed #d1d9e0; border-radius: 8px; font-size: 13px; }
    select { padding: 8px; border: 1px solid #d1d9e0; border-radius: 8px; font-size: 13px; background: #fff; max-width: 100%; }
    .btn { display: inline-flex; align-items: center; padding: 9px 16px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #005da3; color: #fff; }
    .btn-secondary { background: #f0f4f8; color: #141414; border: 1px solid #d1d9e0; }
    .btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-size: 12px; padding: 6px 12px; }
    .hint { font-size: 11px; color: #6b7280; margin-top: 6px; }
    .pdf { border-top: 1px solid #f0f4f8; padding: 14px 0; }
    .pdf:first-of-type { border-top: none; }
    .pdf-name { font-weight: 600; font-size: 14px; word-break: break-all; }
    .pdf-meta { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .uses { margin: 8px 0 0; padding: 0; list-style: none; }
    .uses li { font-size: 12px; color: #166534; background: #f0fdf4; border-radius: 5px; padding: 3px 8px; margin: 4px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .uses form { margin: 0 0 0 auto; }
  </style>
</head>
<body>
<?php $navActive = ''; include 'nav.php'; ?>
<main>
  <h1>Catalog &amp; Brochure PDFs</h1>
  <p class="sub">PDFs that are not a single product's data sheet: your full product catalog (linked in the footer of every page) and the brochures on the Services page. Upload one here and choose where it is used. Product data sheets are separate — use the <strong>PDF</strong> button on the Products page.</p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>
  <?php if ($success !== ''): ?>
    <div class="alert-success">✅ <?= h($success) ?></div>
  <?php endif; ?>

  <section class="card" id="upload">
    <div class="card-title">Upload a PDF</div>
    <form method="POST" enctype="multipart/form-data">
      <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
      <input type="hidden" name="action" value="upload">
      <label for="pdf_file">PDF file (max <?= h(min_upload_label(20)) ?>)</label>
      <div class="row"><input type="file" id="pdf_file" name="pdf_file" accept=".pdf,application/pdf" required></div>
      <label for="target" style="margin-top:12px">Use it for</label>
      <div class="row">
        <select id="target" name="target"><?= $targetOptions(true) ?></select>
        <button type="submit" class="btn btn-primary">Upload →</button>
      </div>
      <div class="hint">An upload never replaces a file already on the server: a second file with the same name is saved as "…-2.pdf".</div>
    </form>
  </section>

  <section class="card" id="files">
    <div class="card-title">PDFs on the server</div>
    <?php if (!$pdfs): ?>
      <p class="hint">None yet.</p>
    <?php endif; ?>
    <?php foreach ($pdfs as $name => $p): ?>
      <div class="pdf" data-pdf="<?= h($name) ?>">
        <div class="pdf-name"><a href="<?= h($p['url']) ?>" target="_blank" rel="noopener"><?= h($name) ?></a></div>
        <div class="pdf-meta"><?= h(number_format($p['size'] / 1024 / 1024, 1)) ?> MB · <?= h(date('Y-m-d', $p['mtime'])) ?> · <code><?= h($p['url']) ?></code></div>
        <?php if (!empty($uses[$p['url']])): ?>
          <ul class="uses">
            <?php foreach ($uses[$p['url']] as $label):
              $tgt = $label === 'Full product catalog (footer link)' ? 'catalog' : '';
              if ($tgt === '') foreach ($services as $i => $t) if ($label === 'Brochure: ' . $t && (($content['services'][$i]['brochure']['url'] ?? '') === $p['url'])) { $tgt = 'service:' . $i; break; } ?>
              <li>✓ Used for: <?= h($label) ?>
                <?php if ($tgt !== ''): ?>
                <form method="POST" data-confirm="Stop using this PDF there? The link disappears from the website; the file stays on the server.">
                  <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                  <input type="hidden" name="action" value="stop">
                  <input type="hidden" name="target" value="<?= h($tgt) ?>">
                  <button type="submit" class="btn btn-danger">Stop using</button>
                </form>
                <?php endif; ?>
              </li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>
        <form method="POST">
          <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
          <input type="hidden" name="action" value="use">
          <input type="hidden" name="file" value="<?= h($name) ?>">
          <div class="row">
            <select name="target" required aria-label="Use <?= h($name) ?> for"><?= $targetOptions(false) ?></select>
            <button type="submit" class="btn btn-secondary">Use This PDF</button>
          </div>
        </form>
      </div>
    <?php endforeach; ?>
  </section>

  <p class="hint">Nothing on this page deletes a file from the server. The link text of a brochure is set in Page Content → Value-Added Services; <strong>Backups</strong> can put a previous choice back.</p>
</main>
<script src="confirm.js"></script>
</body>
</html>
