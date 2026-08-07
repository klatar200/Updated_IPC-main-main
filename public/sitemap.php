<?php
/**
 * The sitemap, generated from the LIVE catalog on every request.
 *
 * Served at /sitemap.xml — public/.htaccess rewrites that URL here, so the
 * address in robots.txt and in Search Console never has to change and nothing
 * outside this file knows it became dynamic.
 *
 * ── Why this is PHP and not a file ──────────────────────────────────────────
 *
 * The site has 9 routes and 42 product pages, each of which is canonical to
 * itself (`/products?productId=<id>`). The static sitemap listed the 9 and none
 * of the 42. Writing the 42 out by hand was rejected, and rightly: Rick adds and
 * deletes products from the admin, the file lives in the deploy tree, and the
 * two would diverge the first time he saved. A sitemap that advertises a
 * deleted product is worse than one that omits a live one — it teaches the
 * crawler the site returns junk URLs.
 *
 * Generating it at BUILD time has the same defect one step removed: the build
 * runs on a laptop from the repo's `data/`, the catalog lives on the server and
 * is owned by the admin, and `npm run build` is not part of adding a product.
 * It would be correct exactly until the first save.
 *
 * Reading `data/products-all.json` per request is the only version that cannot
 * be stale, and it costs one file read of ~280 KB on a URL that is fetched a
 * handful of times a day. `_harness/plan5c-sitemap.js` adds and deletes a
 * product in a live catalog and asserts the sitemap tracks it with no rebuild.
 *
 * ── Failure behaviour ───────────────────────────────────────────────────────
 *
 * If the catalog is missing, unreadable or unparseable this still emits the 9
 * static routes and a 200. The alternatives are both worse: a 500 tells the
 * crawler the whole sitemap is broken, and an empty <urlset> tells it the site
 * has no pages. Degrading to what we know for certain is the safe direction,
 * and it is asserted.
 *
 * No session, no config.php: this is an anonymous public endpoint and starting
 * a session here would attach a Set-Cookie to a crawler fetch for no reason.
 */

/**
 * The editorial half — the 9 public routes, their crawl hints, and nothing
 * derived. This list is the one thing here a human maintains; it must stay in
 * step with SEO_DEFAULT in src/App.jsx, which is what _harness/plan5c-sitemap.js
 * diffs it against.
 */
$ROUTES = [
    ['/',           'weekly',  '1.0'],
    ['/products',   'daily',   '0.9'],
    ['/dashboard',  'daily',   '0.8'],
    ['/industries', 'monthly', '0.7'],
    ['/services',   'monthly', '0.7'],
    ['/about',      'monthly', '0.6'],
    ['/faq',        'monthly', '0.6'],
    ['/contact',    'monthly', '0.8'],
    // /privacy was missing while the other eight were listed. It is a real
    // public route with its own SEO title and description, its own
    // self-canonical and a footer link, so it was already crawlable — it simply
    // was not declared. Low priority and yearly on purpose: it is a legal page,
    // not a page anyone searches for.
    ['/privacy',    'yearly',  '0.3'],
];

/**
 * MUST match SITE_ORIGIN in src/App.jsx, which is what the pages themselves
 * declare as canonical. Deliberately not derived from $_SERVER['HTTP_HOST']:
 * a request to the apex or to a staging copy would then emit a sitemap whose
 * URLs every page on it disowns, which is the one way a sitemap can actively
 * hurt. If the apex is ever chosen instead, this constant, App.jsx's
 * SITE_ORIGIN, robots.txt's Sitemap: line and index.html's og:url change
 * together.
 */
$ORIGIN = 'https://www.insulationproducts.com';

$CATALOG = __DIR__ . '/data/products-all.json';

/** Product ids, in catalog order, de-duplicated. [] on any problem at all. */
function sitemap_product_ids($file)
{
    if (!is_file($file) || !is_readable($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return [];
    }
    $ids = [];
    foreach ($data as $p) {
        if (!is_array($p) || !isset($p['id'])) {
            continue;
        }
        $id = $p['id'];
        // An id must be a non-empty scalar to be part of a URL. Anything else
        // is a corrupt row, and one corrupt row must not cost the other 41.
        if (!is_string($id) && !is_int($id)) {
            continue;
        }
        $id = trim((string)$id);
        if ($id === '') {
            continue;
        }
        $ids[$id] = true;   // keyed, so a duplicate id cannot emit a duplicate <loc>
    }
    return array_keys($ids);
}

$ids = sitemap_product_ids($CATALOG);

/**
 * One date for every product URL: when the catalog last changed. It is the only
 * honest answer available — there is no per-product timestamp in the data — and
 * it is better than omitting <lastmod> or inventing today's date, which is the
 * bug the privacy page's "Last Updated" had.
 */
$lastmod = $ids && is_file($CATALOG) ? gmdate('Y-m-d', filemtime($CATALOG)) : null;

/**
 * rawurlencode() matches JavaScript's encodeURIComponent() for every id in this
 * catalog — five of them contain spaces, slashes or ampersands
 * ("IP12GA - IP1274", "IP44A2 & IP45A3"), and the URL each page declares as its
 * own canonical is built with encodeURIComponent. The two must agree exactly or
 * the sitemap advertises URLs the pages disown. (The functions differ on
 * !*'() ; no id contains any of those, and plan5c-sitemap.js compares all 42
 * against the rendered canonical rather than trusting that.)
 */
function sitemap_loc($origin, $path, $productId = null)
{
    $url = $origin . $path;
    if ($productId !== null) {
        $url .= '?productId=' . rawurlencode($productId);
    }
    return htmlspecialchars($url, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

header('Content-Type: application/xml; charset=UTF-8');
// Crawlers re-fetch on their own schedule; an hour keeps a burst of requests
// off the disk without letting a new product wait meaningfully longer.
header('Cache-Control: public, max-age=3600');

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<?php foreach ($ROUTES as list($path, $freq, $priority)): ?>

  <url>
    <loc><?= sitemap_loc($ORIGIN, $path) ?></loc>
<?php if ($lastmod !== null && ($path === '/products' || $path === '/dashboard')): ?>
    <lastmod><?= $lastmod ?></lastmod>
<?php endif; ?>
    <changefreq><?= $freq ?></changefreq>
    <priority><?= $priority ?></priority>
  </url>
<?php endforeach; ?>
<?php if ($ids): ?>

  <!-- <?= count($ids) ?> product detail pages, read from data/products-all.json
       at request time. 4.3 made each of these canonical to itself. Do not
       replace this with a hand-written list: the catalog is owned by the admin
       and this file is not. -->
<?php foreach ($ids as $id): ?>
  <url>
    <loc><?= sitemap_loc($ORIGIN, '/products', $id) ?></loc>
    <lastmod><?= $lastmod ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
<?php endforeach; ?>
<?php else: ?>

  <!-- data/products-all.json was missing or unparseable when this was
       generated, so only the static routes are listed. A crawler seeing fewer
       URLs is recoverable; a 500 or an empty urlset is not. -->
<?php endif; ?>

</urlset>
