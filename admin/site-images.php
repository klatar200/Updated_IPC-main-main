<?php
require_once 'config.php';
require_auth();

/**
 * Site Images & Logo — the five page photos (Page Content → Site Images) and
 * the logo (Business Details → Logo URL), with an upload button.
 *
 * WHATS_LEFT §2h "plan7-item-3b-image-picker" (built 2026-09-29). Until now
 * those six were typed paths, and a typed path is how four product photoUrls
 * shipped broken ("/images/site/Marker-Sample-2.jpg", capitalisation and all).
 * Per slot: upload a picture, pick one already on the server, or remove it.
 *
 * Rules, each on purpose:
 * - Uploads go through the SAME checks as a product photo
 *   (uploaded_image_problem(), uploads_protection_problem()) — one copy.
 *   JPG/PNG/WEBP/GIF only; SVG stays refused (a script vector), so an SVG logo
 *   is still a developer job.
 * - The saved name is <slot>-<timestamp>.<ext>, never the visitor's filename,
 *   and a new upload never overwrites an existing file — another slot, or an
 *   older backup of content.json, may still point at it.
 * - The picker OFFERS images/site/ (pictures shipped with the website) but
 *   this page never deletes anything, from there or from uploads/site/:
 *   images/site/ is build output and a delete would be silently undone by the
 *   next deploy (WHATS_LEFT §2h, recorded before this was built).
 * - One key is changed, read fresh from disk, and nothing else in the file is
 *   touched. Page Content and Business Details keep their own stale-tab
 *   checks, so an open copy of either refuses to save over this change.
 * - A damaged data file is never saved over (NEW-N2-1).
 */

$SLOTS = [
    'heroPhoto'         => ['label' => 'Homepage — hero photo',           'where' => 'The large photo beside the headline at the top of the homepage (wide screens only).'],
    'bandTeamPhoto'     => ['label' => 'Homepage — team photo',           'where' => 'The left photo in the band lower on the homepage ("The same team, the same building…").'],
    'bandBuildingPhoto' => ['label' => 'Homepage — building photo',       'where' => 'The right photo in that same homepage band.'],
    'aboutPhoto'        => ['label' => 'About page — photo',              'where' => 'Beside "Our Story" on the About page.'],
    'servicesPhoto'     => ['label' => 'Services page — photo',           'where' => 'Under the banner on the Services page.'],
    'logo'              => ['label' => 'Logo',                            'where' => 'The site header and footer, the placeholder on products with no photo, and the information search engines read.'],
];
$SITE_SHIPPED_DIR = __DIR__ . '/../images/site/';

/** Every picture this page may point a slot at: path as stored → display info. */
function site_image_choices(string $shippedDir): array {
    $out = [];
    foreach ([[SITE_IMG_DIR, SITE_IMG_PATH, 'Your uploads'], [$shippedDir, 'images/site/', 'Built into the website']] as [$dir, $prefix, $group]) {
        if (!is_dir($dir)) continue;
        $names = @scandir($dir) ?: [];
        foreach ($names as $n) {
            if (!preg_match('/^[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$/i', $n) || !is_file($dir . $n)) continue;
            $out[$prefix . $n] = ['name' => $n, 'group' => $group, 'mtime' => (int)@filemtime($dir . $n)];
        }
    }
    uasort($out, static fn($a, $b) => [$a['group'] === 'Your uploads' ? 0 : 1, -$a['mtime']] <=> [$b['group'] === 'Your uploads' ? 0 : 1, -$b['mtime']]);
    return $out;
}

/** What the slot holds now: [path or '' , isBuiltInDefault]. */
function slot_current(string $slot, array $content, array $info): array {
    if ($slot === 'logo') {
        // "" and "/logo.svg" are both the shipped logo (the data ships the
        // latter spelled out); either one is "the original".
        $v = (string)($info['theme']['logoUrl'] ?? '');
        return [$v === '/logo.svg' ? '' : $v, $v === '' || $v === '/logo.svg'];
    }
    $imgs = $content['copy']['siteImages'] ?? [];
    if (!is_array($imgs) || !array_key_exists($slot, $imgs)) return ['', true];
    return [(string)$imgs[$slot], false];
}

/** Write one slot. $value is the stored path ('' = remove / original logo). */
function slot_write(string $slot, string $value, array &$errors): bool {
    if ($slot === 'logo') {
        if (data_file_damaged(SITE_INFO_JSON)) {
            $errors[] = 'The saved business details (data/site-info.json) are damaged and cannot be read, so nothing was saved. Go to Backups and restore the most recent Business Details entry, then try again.';
            return false;
        }
        $url = $value === '' ? '' : '/' . ltrim($value, '/');
        if ($url !== '' && ($p = link_url_problem($url, 'The logo URL')) !== '') { $errors[] = $p; return false; }
        $info = load_site_info();
        $info['theme'] = is_array($info['theme'] ?? null) ? $info['theme'] : [];
        $info['theme']['logoUrl'] = $url;
        if (!save_site_info($info)) { $errors[] = 'Could not save data/site-info.json. Check that the data/ folder is writable.'; return false; }
        return true;
    }
    if (data_file_damaged(CONTENT_JSON)) {
        $errors[] = 'The saved page content (data/content.json) is damaged and cannot be read, so nothing was saved. Go to Backups and restore the most recent Page Content entry, then try again.';
        return false;
    }
    $content = load_content();
    $content['copy'] = is_array($content['copy'] ?? null) ? $content['copy'] : [];
    $content['copy']['siteImages'] = is_array($content['copy']['siteImages'] ?? null) ? $content['copy']['siteImages'] : [];
    $content['copy']['siteImages'][$slot] = $value;
    if (!save_content($content)) { $errors[] = 'Could not save data/content.json. Check that the data/ folder is writable.'; return false; }
    return true;
}

$errors  = [];
$flash   = flash_take();
$success = $flash['type'] === 'success' ? $flash['msg'] : '';
if ($flash['type'] === 'error' && $flash['msg'] !== '') $errors[] = $flash['msg'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $slot   = as_str($_POST['slot'] ?? null);
    $action = as_str($_POST['action'] ?? null);
    // The target file is checked BEFORE anything is uploaded, so a damaged
    // data file never leaves an orphan picture behind.
    $damagedMsg = !isset($SLOTS[$slot]) ? '' : ($slot === 'logo'
        ? (data_file_damaged(SITE_INFO_JSON) ? 'The saved business details (data/site-info.json) are damaged and cannot be read, so nothing was saved. Go to Backups and restore the most recent Business Details entry, then try again.' : '')
        : (data_file_damaged(CONTENT_JSON) ? 'The saved page content (data/content.json) is damaged and cannot be read, so nothing was saved. Go to Backups and restore the most recent Page Content entry, then try again.' : ''));
    if (!isset($SLOTS[$slot])) {
        $errors[] = 'Unknown picture slot.';
    } elseif ($damagedMsg !== '') {
        $errors[] = $damagedMsg;
    } elseif ($action === 'remove') {
        if (slot_write($slot, '', $errors)) {
            audit_log('site-image', $slot, $slot === 'logo' ? 'Logo reset to the original' : $SLOTS[$slot]['label'] . ': photo removed');
            flash_redirect($slot === 'logo'
                ? 'The original logo is back on the website.'
                : $SLOTS[$slot]['label'] . ': the photo was removed from the page.', 'success', 'site-images.php');
        }
    } elseif ($action === 'choose') {
        $choice  = as_str($_POST['choice'] ?? null);
        $choices = site_image_choices($SITE_SHIPPED_DIR);
        if (!isset($choices[$choice])) {
            $errors[] = 'Pick a picture from the list.';
        } elseif (slot_write($slot, $choice, $errors)) {
            audit_log('site-image', $slot, $SLOTS[$slot]['label'] . ' → ' . $choice);
            flash_redirect($SLOTS[$slot]['label'] . ' now uses ' . $choices[$choice]['name'] . '. The website shows it within about a minute.', 'success', 'site-images.php');
        }
    } elseif ($action === 'upload') {
        if (!upload_field_is_single('image_file')) {
            $errors[] = 'Please choose one image file at a time.';
        } elseif (!isset($_FILES['image_file']) || $_FILES['image_file']['error'] !== UPLOAD_ERR_OK) {
            $errors[] = upload_error_message($_FILES['image_file']['error'] ?? UPLOAD_ERR_NO_FILE, 'image');
        } elseif (!is_dir(SITE_IMG_DIR) && !@mkdir(SITE_IMG_DIR, 0755, true) && !is_dir(SITE_IMG_DIR)) {
            $errors[] = 'Could not create the uploads/site folder on the server. Create public_html/uploads/site/ over FTP and make it writable (755).';
        } else {
            $problem = uploads_protection_problem();
            if ($problem === '') $problem = uploaded_image_problem($_FILES['image_file'], $ext);
            if ($problem !== '') {
                $errors[] = $problem;
            } else {
                $stem = $slot . '-' . date('Ymd-His');
                $filename = $stem . '.' . $ext;
                for ($n = 2; file_exists(SITE_IMG_DIR . $filename) && $n < 1000; $n++) $filename = $stem . '-' . $n . '.' . $ext;
                $dest = SITE_IMG_DIR . $filename;
                if (!move_uploaded_file($_FILES['image_file']['tmp_name'], $dest)) {
                    $errors[] = 'Upload failed. Check write permissions on the /uploads/site/ folder.';
                } else {
                    $reason = '';
                    $wasResized = image_downscale_in_place($dest, $ext, $reason);
                    if (slot_write($slot, SITE_IMG_PATH . $filename, $errors)) {
                        audit_log('site-image', $slot, $SLOTS[$slot]['label'] . ' → uploaded ' . $filename);
                        flash_redirect($SLOTS[$slot]['label'] . ': new picture uploaded and in use. The website shows it within about a minute.'
                            . image_resize_note($wasResized, $reason, 'that page'), 'success', 'site-images.php');
                    }
                }
            }
        }
    } else {
        $errors[] = 'Unknown action.';
    }
}

$content = load_content();
$info    = load_site_info();
$choices = site_image_choices($SITE_SHIPPED_DIR);
$csrf    = csrf_token();
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><link rel="icon" type="image/svg+xml" href="logo.svg" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Site Images &amp; Logo</title>
  <?= admin_head() ?>
  <style>
    main { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .where { font-size: 13px; color: #4b5563; margin: 0 0 14px; }
    .current { display: flex; gap: 14px; align-items: center; padding: 12px; background: #f0f4f8; border-radius: 8px; margin-bottom: 14px; font-size: 13px; }
    .current img { width: 120px; height: 80px; object-fit: contain; background: #fff; border-radius: 6px; flex-shrink: 0; }
    .current code { word-break: break-all; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
    .row select, .row input[type=file] { flex: 1 1 240px; min-width: 0; }
    input[type=file] { padding: 8px; border: 2px dashed #d1d9e0; border-radius: 8px; font-size: 13px; }
    select { padding: 8px; border: 1px solid #d1d9e0; border-radius: 8px; font-size: 13px; background: #fff; }
    .btn { display: inline-flex; align-items: center; padding: 9px 16px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #005da3; color: #fff; }
    .btn-secondary { background: #f0f4f8; color: #141414; border: 1px solid #d1d9e0; }
    .btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .hint { font-size: 11px; color: #6b7280; margin-top: 6px; }
  </style>
</head>
<body>
<?php $navActive = ''; include 'nav.php'; ?>
<main>
  <h1>Site Images &amp; Logo</h1>
  <p class="sub">The photos that belong to the pages themselves, and your logo. Upload a new picture from your computer, or pick one that is already on the server. Product photos are separate — use the <strong>Photo</strong> button on the Products page.</p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>
  <?php if ($success !== ''): ?>
    <div class="alert-success">✅ <?= h($success) ?></div>
  <?php endif; ?>

  <?php foreach ($SLOTS as $slot => $cfg):
    [$cur, $isDefault] = slot_current($slot, $content, $info);
    $isLogo = $slot === 'logo';
    $shown  = $isLogo ? ($cur !== '' ? $cur : '/logo.svg') : ($cur !== '' ? '/' . ltrim($cur, '/') : '');
  ?>
  <section class="card" id="slot-<?= h($slot) ?>" data-slot="<?= h($slot) ?>">
    <div class="card-title"><?= h($cfg['label']) ?></div>
    <p class="where"><?= h($cfg['where']) ?></p>
    <div class="current">
      <?php if ($shown !== ''): ?>
        <img src="<?= h($shown) ?>" alt="Current <?= h(strtolower($cfg['label'])) ?>">
        <span><?= $isLogo && $cur === '' ? 'The original logo' : ($isDefault ? 'The photo the website shipped with' : 'Now showing') ?><br><code><?= h($isLogo ? $shown : ($cur !== '' ? $cur : '')) ?></code></span>
      <?php elseif ($isDefault): ?>
        <span>The photo the website shipped with.</span>
      <?php else: ?>
        <span>No photo — this spot is empty on the website.</span>
      <?php endif; ?>
    </div>

    <form method="POST" enctype="multipart/form-data">
      <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
      <input type="hidden" name="slot" value="<?= h($slot) ?>">
      <input type="hidden" name="action" value="upload">
      <label for="file-<?= h($slot) ?>">Upload a new picture — JPG, PNG, WEBP or GIF (max <?= h(min_upload_label(8)) ?>)</label>
      <div class="row">
        <input type="file" id="file-<?= h($slot) ?>" name="image_file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" required>
        <button type="submit" class="btn btn-primary">Upload &amp; Use →</button>
      </div>
      <?php if ($isLogo): ?><div class="hint">A PNG with a transparent background works best. An SVG logo cannot be uploaded here (SVG files can carry program code) — ask your developer.</div>
      <?php else: ?><div class="hint">Anything wider than <?= (int)IMG_MAX_WIDTH ?> pixels is scaled down automatically so the page stays fast.</div><?php endif; ?>
    </form>

    <?php if ($choices): ?>
    <form method="POST">
      <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
      <input type="hidden" name="slot" value="<?= h($slot) ?>">
      <input type="hidden" name="action" value="choose">
      <div class="row">
        <select id="choice-<?= h($slot) ?>" name="choice" required aria-label="Or pick a picture already on the server">
          <option value="">Or pick a picture already on the server…</option>
          <?php $grp = null; foreach ($choices as $path => $c):
            if ($c['group'] !== $grp) { if ($grp !== null) echo '</optgroup>'; $grp = $c['group']; echo '<optgroup label="' . h($grp) . '">'; } ?>
            <option value="<?= h($path) ?>"><?= h($c['name']) ?><?= $path === ltrim($cur, '/') ? ' (in use)' : '' ?></option>
          <?php endforeach; if ($grp !== null) echo '</optgroup>'; ?>
        </select>
        <button type="submit" class="btn btn-secondary">Use This One</button>
      </div>
    </form>
    <?php endif; ?>

    <?php if ($isLogo ? $cur !== '' : !($cur === '' && !$isDefault)): ?>
    <form method="POST" data-confirm="<?= $isLogo ? 'Go back to the original logo?' : 'Remove this photo from the page? The spot will be empty on the website. You can put a picture back here at any time.' ?>">
      <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
      <input type="hidden" name="slot" value="<?= h($slot) ?>">
      <input type="hidden" name="action" value="remove">
      <div class="row"><button type="submit" class="btn btn-danger"><?= $isLogo ? 'Use the Original Logo' : 'Remove Photo' ?></button></div>
    </form>
    <?php endif; ?>
  </section>
  <?php endforeach; ?>

  <p class="hint">Nothing on this page deletes a file from the server — an old picture stays available in the list above, and <strong>Backups</strong> can put a previous choice back.</p>
</main>
<script src="confirm.js"></script>
</body>
</html>
