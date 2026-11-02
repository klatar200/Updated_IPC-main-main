<?php
/**
 * Shared admin menu bar — included on every authenticated admin page so the
 * navigation is identical everywhere. Self-contained: its own scoped <style>
 * block, so it renders the same whatever CSS the including page carries.
 *
 * Expects config.php to already be loaded and require_auth() to already
 * have run (require_once below is just a defensive no-op if not).
 *
 * PLAN-13 Phase 2 (2026-10-31). The bar used to be eleven equal links that
 * scrolled away with the page (§2 A1, A2): on Page Content that was 55
 * screens with no way back to the menu. Now:
 *   - it is sticky, on every page, one row (60px; 56px on a phone);
 *   - six entries grouped by job, four of them <details> drop-downs, so they
 *     open by click, tap or keyboard and still work with JavaScript off
 *     (nav.js only closes them on Escape / an outside click, and runs the
 *     phone Menu button);
 *   - Site Images & Logo and Catalog & Brochure PDFs are in the Website menu
 *     (A3: before, only links inside other pages reached them);
 *   - the entry holding the current page is a white pill, 13:1 against the
 *     bar (A5: the old 2px #005da3 underline was 2.0:1);
 *   - pages no longer inject their own links ($navExtra, A4) or say which
 *     entry is current ($navActive): the current entry comes from the script
 *     name below, so a new page cannot forget to set it.
 *
 * Earlier lessons this file still honours:
 *   - A10-021: min-height, never a fixed height. A fixed 60px bar let the
 *     nav paint above the document top and below the bar at 390, where Rick
 *     could neither navigate nor sign out. On a phone the entries now live in
 *     the Menu panel, so the bar itself stays one row.
 *   - `.ipc-admin-header` (0,1,0) outranks a bare `header` rule, so a page's
 *     own <style> cannot restyle the bar by accident.
 *   - A12-L7-01-W5-4: touch targets. Every link in the phone panel is 44px.
 */
require_once 'config.php';
require_auth(); // defense in depth if this partial is ever requested directly

$navPage = basename((string)($_SERVER['SCRIPT_NAME'] ?? ''));
$navGroup = [
    'home.php' => 'overview',
    'index.php' => 'products', 'add.php' => 'products', 'edit.php' => 'products',
    'upload-pdf.php' => 'products', 'upload-image.php' => 'products', 'delete.php' => 'products',
    'settings.php' => 'website', 'content.php' => 'website',
    'site-images.php' => 'website', 'marketing-pdfs.php' => 'website',
    'inquiries.php' => 'inquiries',
    'backups.php' => 'history', 'audit-log.php' => 'history',
    'help.php' => 'help',
    'password.php' => 'account',
][$navPage] ?? '';
// The top-level entry's class, and a menu link's aria-current.
$navTop = function (string $g) use ($navGroup): string { return $g === $navGroup ? ' current' : ''; };
$navCur = function (string $file) use ($navPage): string { return $file === $navPage ? ' aria-current="page"' : ''; };

/* A-5.6 — the only place the owner is TOLD a lead arrived. mail() reporting
   success is not delivery, so the log is the safety net; a safety net nobody
   is prompted to look at is not one. */
$navNewLeads = function_exists('inquiries_new_count') ? inquiries_new_count() : 0;
?>
<style>
  .ipc-admin-header { position: sticky; top: 0; z-index: 50; background: #0d2d52; padding: 0 24px; height: auto; min-height: var(--admin-bar-h, 60px);
    display: flex; align-items: center; gap: 24px; box-shadow: 0 2px 8px rgba(13,45,82,0.18); }
  .ipc-admin-header .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
  .ipc-admin-header .logo-title { color: #fff; font-size: var(--fs-2); font-weight: 700; }
  .ipc-admin-header .logo-sub   { color: rgba(255,255,255,0.72); font-size: var(--fs-1); }
  /* On the Overview: a white rule under the logo (13:1 on the bar) — the
     same kind of marker admin-ux U3 measures for the entries. */
  .ipc-admin-header .logo { padding: 6px 0 4px; border-bottom: 2px solid transparent; }
  .ipc-admin-header .logo.current { border-bottom-color: #fff; }
  .ipc-admin-header .logo:focus-visible { outline: 3px solid #7cc4ff; outline-offset: 2px; }
  .ipc-admin-header nav { flex: 1; display: flex; align-items: center; gap: 4px; min-width: 0; }
  .ipc-admin-header .nav-account { margin-left: auto; }

  /* Top-level entries: direct links and drop-down <summary>s look the same. */
  .ipc-admin-header .nav-top { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 14px; border-radius: 999px;
    color: rgba(255,255,255,0.92); font-size: var(--fs-2); font-weight: 600; text-decoration: none; white-space: nowrap; cursor: pointer; list-style: none; user-select: none; }
  .ipc-admin-header summary.nav-top::-webkit-details-marker { display: none; }
  .ipc-admin-header summary.nav-top::after { content: ""; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid currentColor; opacity: 0.8; transition: transform 0.15s; }
  .ipc-admin-header details[open] > summary.nav-top::after { transform: rotate(180deg); }
  .ipc-admin-header .nav-top:hover, .ipc-admin-header details[open] > .nav-top { background: rgba(255,255,255,0.14); color: #fff; }
  .ipc-admin-header .nav-top.current, .ipc-admin-header .nav-top.current:hover, .ipc-admin-header details[open] > .nav-top.current { background: #fff; color: #0d2d52; }
  .ipc-admin-header .nav-top:focus-visible, .ipc-admin-header .menu-toggle:focus-visible, .ipc-admin-header .bar-leads:focus-visible { outline: 3px solid #7cc4ff; outline-offset: 2px; }
  .ipc-admin-header .nav-badge { display: inline-block; min-width: 20px; padding: 1px 6px; border-radius: 10px; background: #d92d20; color: #fff;
    font-size: var(--fs-1); font-weight: 700; line-height: 18px; text-align: center; }

  /* Drop-down panels. */
  .ipc-admin-header .nav-group { position: relative; }
  .ipc-admin-header .nav-pop { position: absolute; top: calc(100% + 8px); left: 0; min-width: 240px; background: #fff; border: 1px solid var(--line, #e5e9ee);
    border-radius: 10px; box-shadow: 0 12px 32px rgba(13,45,82,0.22); padding: 6px; display: flex; flex-direction: column; }
  .ipc-admin-header .nav-account .nav-pop { left: auto; right: 0; }
  .ipc-admin-header .nav-pop form { margin: 0; }
  .ipc-admin-header .nav-pop a, .ipc-admin-header .nav-pop button { display: flex; align-items: center; width: 100%; min-height: 40px; padding: 8px 12px; border: 0; border-radius: 6px;
    background: none; color: var(--ink, #141414); font: inherit; font-size: var(--fs-3); text-align: left; text-decoration: none; cursor: pointer; }
  .ipc-admin-header .nav-pop a:hover, .ipc-admin-header .nav-pop button:hover, .ipc-admin-header .nav-pop a:focus-visible, .ipc-admin-header .nav-pop button:focus-visible { background: var(--page-bg, #f0f4f8); color: var(--brand, #005da3); outline: none; }
  .ipc-admin-header .nav-pop a[aria-current="page"] { background: #eaf3fb; color: var(--brand, #005da3); font-weight: 700; }
  .ipc-admin-header .nav-sep { height: 1px; background: var(--line, #e5e9ee); margin: 4px 6px; }

  /* Phone-only controls. */
  .ipc-admin-header .bar-leads, .ipc-admin-header .menu-toggle { display: none; }

  /* Phones and narrow tablets (< 900px — the six entries need ~850px in one
     row): the bar keeps the logo, a new-leads shortcut and a Menu button, and
     Menu opens the same groups as a full-width panel under the bar. Without
     JavaScript (no .has-js) the entries simply wrap below the logo instead,
     and the bar stops being sticky so it does not cover the page. */
  @media (max-width: 899px) {
    .ipc-admin-header { padding: 0 16px; gap: 12px; }
    .ipc-admin-header.has-js .bar-leads { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; min-height: 44px; padding: 0 10px;
      color: #fff; font-size: var(--fs-2); font-weight: 600; text-decoration: none; border-radius: 8px; }
    .ipc-admin-header.has-js .menu-toggle { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid rgba(255,255,255,0.4);
      border-radius: 8px; background: none; color: #fff; font: inherit; font-size: var(--fs-2); font-weight: 600; cursor: pointer; margin-left: auto; }
    .ipc-admin-header.has-js .bar-leads + .menu-toggle { margin-left: 0; }
    .ipc-admin-header.has-js nav { display: none; }
    .ipc-admin-header.has-js.menu-open nav { display: flex; position: absolute; top: 100%; left: 0; right: 0; max-height: calc(100vh - var(--admin-bar-h, 56px)); overflow-y: auto;
      padding: 8px 16px 16px; box-shadow: 0 12px 24px rgba(0,0,0,0.25); }
    .ipc-admin-header:not(.has-js) { position: static; flex-wrap: wrap; padding: 8px 16px; }
    .ipc-admin-header.menu-open nav, .ipc-admin-header:not(.has-js) nav { flex-direction: column; align-items: stretch; gap: 2px; background: #0d2d52; flex-basis: 100%; }
    .ipc-admin-header.menu-open .nav-account, .ipc-admin-header:not(.has-js) .nav-account { margin-left: 0; }
    .ipc-admin-header.menu-open .nav-group, .ipc-admin-header:not(.has-js) .nav-group { position: static; }
    .ipc-admin-header.menu-open .nav-top, .ipc-admin-header:not(.has-js) .nav-top { width: 100%; min-height: 44px; border-radius: 8px; justify-content: space-between; font-size: var(--fs-3); }
    .ipc-admin-header.menu-open .nav-pop, .ipc-admin-header:not(.has-js) .nav-pop { position: static; min-width: 0; padding: 0 0 6px 12px; border: 0; background: transparent; box-shadow: none; }
    .ipc-admin-header.menu-open .nav-pop a, .ipc-admin-header.menu-open .nav-pop button,
    .ipc-admin-header:not(.has-js) .nav-pop a, .ipc-admin-header:not(.has-js) .nav-pop button { min-height: 44px; color: rgba(255,255,255,0.92); }
    .ipc-admin-header.menu-open .nav-pop a:hover, .ipc-admin-header.menu-open .nav-pop button:hover,
    .ipc-admin-header.menu-open .nav-pop a:focus-visible, .ipc-admin-header.menu-open .nav-pop button:focus-visible { background: rgba(255,255,255,0.12); color: #fff; }
    .ipc-admin-header.menu-open .nav-pop a[aria-current="page"], .ipc-admin-header:not(.has-js) .nav-pop a[aria-current="page"] { background: #fff; color: #0d2d52; }
    .ipc-admin-header.menu-open .nav-sep, .ipc-admin-header:not(.has-js) .nav-sep { background: rgba(255,255,255,0.2); }
  }
  @media (max-width: 420px) { .ipc-admin-header .logo-sub { display: none; } }
</style>
<header class="ipc-admin-header">
  <?php /* PLAN-13 Phase 8 — the logo is the way to the Overview (home.php),
           the page sign-in lands on. Not a seventh entry: §3.1 holds the bar
           to six (admin-ux U7), and at 900px a seventh pushed it past the
           screen. On the Overview the logo is the current-page marker. */ ?>
  <a class="logo<?= $navTop('overview') ?>" href="home.php" title="Overview"<?= $navCur('home.php') ?>>
    <img src="logo.svg" alt="IPC" style="width:38px;height:38px;border-radius:6px;display:block;flex-shrink:0;">
    <div>
      <div class="logo-title">IPC Admin</div>
      <div class="logo-sub">Website dashboard</div>
    </div>
  </a>
  <nav id="admin-menu" aria-label="Dashboard menu">
    <details class="nav-group">
      <summary class="nav-top<?= $navTop('products') ?>">Products</summary>
      <div class="nav-pop">
        <a href="index.php"<?= $navCur('index.php') ?>>All Products</a>
        <a href="add.php"<?= $navCur('add.php') ?>>Add Product</a>
      </div>
    </details>
    <details class="nav-group">
      <summary class="nav-top<?= $navTop('website') ?>">Website</summary>
      <div class="nav-pop">
        <a href="settings.php"<?= $navCur('settings.php') ?>>Business Details</a>
        <a href="content.php"<?= $navCur('content.php') ?>>Page Content</a>
        <a href="site-images.php"<?= $navCur('site-images.php') ?>>Site Images &amp; Logo</a>
        <a href="marketing-pdfs.php"<?= $navCur('marketing-pdfs.php') ?>>Catalog &amp; Brochure PDFs</a>
      </div>
    </details>
    <a class="nav-top<?= $navTop('inquiries') ?>" href="inquiries.php"<?= $navCur('inquiries.php') ?>>Inquiries<?php
      if ($navNewLeads > 0): ?><span class="nav-badge" aria-label="<?= (int)$navNewLeads ?> new since you last looked"><?= (int)$navNewLeads ?></span><?php endif; ?></a>
    <details class="nav-group">
      <summary class="nav-top<?= $navTop('history') ?>">Backups &amp; History</summary>
      <div class="nav-pop">
        <a href="backups.php"<?= $navCur('backups.php') ?>>Backups</a>
        <a href="audit-log.php"<?= $navCur('audit-log.php') ?>>Audit Log</a>
      </div>
    </details>
    <a class="nav-top<?= $navTop('help') ?>" href="help.php"<?= $navCur('help.php') ?>>Help</a>
    <details class="nav-group nav-account">
      <summary class="nav-top<?= $navTop('account') ?>">Account</summary>
      <div class="nav-pop">
        <a href="password.php"<?= $navCur('password.php') ?>>Password</a>
        <a href="/" target="_blank" rel="noopener" title="Opens the public site in a new tab">View Live Site ↗</a>
        <div class="nav-sep" role="separator"></div>
        <form method="POST" action="auth.php" data-no-guard>
          <input type="hidden" name="logout" value="1">
          <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
          <button type="submit" class="logout">Sign Out</button>
        </form>
      </div>
    </details>
  </nav>
  <?php if ($navNewLeads > 0): ?>
  <a class="bar-leads" href="inquiries.php" aria-label="Inquiries: <?= (int)$navNewLeads ?> new since you last looked">Inquiries <span class="nav-badge"><?= (int)$navNewLeads ?></span></a>
  <?php endif; ?>
  <button type="button" class="menu-toggle" aria-controls="admin-menu" aria-expanded="false">Menu</button>
</header>
<?php /* Parser-blocking on purpose: it marks the bar .has-js before the first
         paint, so a phone never flashes the full menu. The admin CSP is
         script-src 'self', so this cannot be inline. */ ?>
<script src="nav.js"></script>
<?php
/* AUDIT-12 decision 30 (A12-L4-05-2) — a save went through but its backup
   could not be written (save_json_with_backup() in config.php records it).
   Said once, on the next admin page, whichever page made the save. */
if (!empty($_SESSION['ipc_unbacked_saves']) && is_array($_SESSION['ipc_unbacked_saves'])):
  $navUnbacked = array_keys($_SESSION['ipc_unbacked_saves']);
  unset($_SESSION['ipc_unbacked_saves']); ?>
<div role="alert" style="max-width:1100px;margin:16px auto 0;padding:12px 16px;background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;color:#78350f;font-size:var(--fs-3);line-height:1.5;">
  <strong>⚠ Your change to <?= h(implode(' and ', $navUnbacked)) ?> was saved, but this change can't be undone from Backups.</strong>
  The server could not keep a copy of the version before it — its disk is probably full. Free up space on your hosting account (or ask your host to), so that your next change is backed up again.
</div>
<?php endif; ?>
