<?php
/**
 * The front controller for every page route (A-5.10, WHATS_LEFT §1ar).
 *
 * public/.htaccess sends every request that is not a real file here, and
 * `DirectoryIndex index.php index.html` sends `/` here too. This file serves
 * the BUILT index.html — the same shell the site has always served — with two
 * things filled in from the live data/*.json:
 *
 *   1. the head: <title>, description, canonical, robots and og:* for THIS
 *      route and THIS product, instead of the homepage's for every URL;
 *   2. a plain-HTML body inside #root for clients that do not run JavaScript.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * The site renders in the browser. Google runs that JavaScript; Bing mostly
 * does not, the AI answer engines do not, and no link unfurler does (LinkedIn,
 * Slack, Teams, Outlook, iMessage). All of them saw the homepage's title and
 * share card on all 42 product URLs — on a site whose product links get pasted
 * into procurement threads.
 *
 * ── The browser stays the source of truth ───────────────────────────────────
 *
 * PageMeta in src/App.jsx computes the head the visitor's browser ends up
 * with, and it overwrites whatever this file wrote. Everything below that
 * produces a head value is a PORT of that code — findProductByParam,
 * fitProductTitle, trimToWord, localizeProse, isoRewriter, factsRewriter,
 * mergeSiteInfo's blank-drop — and the two must agree. `_harness/prerender.js`
 * diffs this file's head against the browser's for every route and every
 * product, under the shipped data and under mutated data. It is the drift
 * guard: change one side, run it. Same arrangement as sitemap.php's route
 * list and `plan5c-sitemap.js`.
 *
 * ── Failure behaviour: fail closed to the old site ──────────────────────────
 *
 * Any PHP error, any missing or unparseable site-info.json / content.json, or
 * a shell whose tags no longer match the patterns below → the UNMODIFIED
 * index.html, exactly what Apache served before this file existed. The React
 * app then fixes the head in the browser as it always has. An unreadable
 * catalog is not a failure: product URLs get the "pending" head the browser
 * also shows while the catalog is out (PUB-2) — no verdict, no canonical.
 *
 * No session, no config.php, no mbstring (A-9.P2-1): this is anonymous and
 * runs on every page view.
 *
 * MUST match SITE_ORIGIN in src/App.jsx and $ORIGIN in sitemap.php.
 */

const IPC_ORIGIN = 'https://www.insulationproducts.com';
const IPC_META_TITLE_MAX = 60;
const IPC_META_DESC_MAX = 160;
const IPC_OG_CARD = ['/images/og-card.jpg', 1200, 630];
const IPC_OG_PHOTO = [400, 300];

/** SEO_DEFAULT in src/App.jsx — the ten routes and their default head copy. */
function ipc_seo_default()
{
    return [
        ['page' => 'home', 'title' => 'Insulation Products Corporation — Heat Shrink Tubing, Sleeving & Adhesives', 'desc' => 'IPC is a spec-grade stocking distributor of heat-shrinkable & extruded tubing, electrical sleeving, and industrial adhesives. $50 minimum order. ISO 9001 registered.'],
        ['page' => 'products', 'title' => 'Product Catalog — Insulation Products Corporation', 'desc' => "Browse IPC's full catalog of heat shrink tubing, sleeving, and adhesives. Filter by product family, view specs and datasheets, and request a quote."],
        ['page' => 'dashboard', 'title' => 'Product Index — Insulation Products Corporation', 'desc' => 'Search and sort all IPC products by part number, material, and temperature rating. Quick access to specs and datasheets for every SKU.'],
        ['page' => 'datasheets', 'title' => 'Datasheets — Insulation Products Corporation', 'desc' => 'Download the published datasheet for every IPC product. Heat shrink tubing, sleeving, adhesives and accessories — grouped by family, no form required.'],
        ['page' => 'industries', 'title' => 'Industries Served — Insulation Products Corporation', 'desc' => 'IPC supplies specification-grade insulation materials to automotive, aerospace, medical, military, marine, and industrial markets. Learn how we serve your industry.'],
        ['page' => 'services', 'title' => 'Value-Added Services — Insulation Products Corporation', 'desc' => 'Custom cut-to-length, hot-stamp marking, bar code printing, spooling, kitting, and JIT delivery programs. Typical lead time one week or less.'],
        ['page' => 'about', 'title' => 'About — Insulation Products Corporation', 'desc' => 'Insulation Products Corporation — a spec-grade stocking distributor in Bolingbrook, IL since July 1, 1974. ISO 9001 registered. $50 minimum order.'],
        ['page' => 'faq', 'title' => 'FAQ & Resources — Insulation Products Corporation', 'desc' => 'Answers to common questions about IPC products, certifications, ordering minimums, custom fabrication, and documentation support.'],
        ['page' => 'contact', 'title' => 'Contact / Request a Quote — Insulation Products Corporation', 'desc' => 'Request a quote, submit a PO, or ask a question. Call 630.771.0700, fax 630.771.0701, email sales@insulationproducts.com, or use our online form.'],
        ['page' => 'privacy', 'title' => 'Privacy Policy — Insulation Products Corporation', 'desc' => 'Privacy policy for Insulation Products Corporation — how we collect and use information submitted through our website contact forms.'],
    ];
}

/** COPY_DEFAULTS' page-header titles — the title fallback for a route with no SEO title. */
function ipc_header_title_defaults()
{
    return [
        'servicesHeader' => 'Value-Added Services',
        'industriesHeader' => 'Applications by Industry',
        'aboutHeader' => 'About Insulation Products Corporation',
        'datasheetsHeader' => 'Datasheets',
        'faqHeader' => 'Frequently Asked Questions',
        'contactHeader' => 'Get in Touch',
        'privacyHeader' => 'Privacy Policy',
    ];
}

/** The SITE_DEFAULTS values the head depends on. */
function ipc_site_defaults()
{
    return [
        'company' => ['name' => 'Insulation Products Corporation', 'shortName' => 'IPC', 'foundedYear' => '1974'],
        'contact' => ['phone' => '630.771.0700', 'fax' => '630.771.0701', 'email' => 'sales@insulationproducts.com'],
        'address' => ['street' => '250 Gibraltar Dr', 'city' => 'Bolingbrook', 'state' => 'IL', 'zip' => '60440'],
        'hours' => ['text' => 'Mon–Fri, 8am–5pm CT'],
        'certifications' => ['iso' => 'ISO 9001'],
        'stats' => ['feetInStock' => '25 million', 'minimumOrder' => '$50'],
    ];
}

// ── String helpers: JavaScript semantics without mbstring ───────────────────
//
// PageMeta measures with String.length and cuts with .slice(), i.e. in
// characters. strlen() counts bytes, and "—", "°" and "·" are in the catalog,
// so every cap below would fire early. preg_split('//u') is PCRE, which every
// PHP build has.

/** JavaScript's whitespace class (\s), which PCRE's \s alone does not match. */
const IPC_WS = '\s\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';

function ipc_chars($s)
{
    $a = preg_split('//u', (string)$s, -1, PREG_SPLIT_NO_EMPTY);
    if ($a === false) {
        throw new RuntimeException('invalid UTF-8');
    }
    return $a;
}

function ipc_len($s)
{
    return count(ipc_chars($s));
}

function ipc_slice($s, $start, $end)
{
    return implode('', array_slice(ipc_chars($s), $start, max(0, $end - $start)));
}

function ipc_trim($s)
{
    return preg_replace('/^[' . IPC_WS . ']+|[' . IPC_WS . ']+$/u', '', (string)$s);
}

/** A string field as normalizeProductRow / mergeSiteInfo read it: text or a number, else nothing. */
function ipc_str($v)
{
    if (is_string($v)) {
        return $v;
    }
    if (is_int($v) || is_float($v)) {
        return (string)$v;
    }
    return '';
}

function ipc_h($s)
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// ── Ports of src/App.jsx ─────────────────────────────────────────────────────

/** trimToWord() */
function ipc_trim_to_word($text, $max)
{
    $s = (string)$text;
    if (ipc_len($s) <= $max) {
        return $s;
    }
    $cut = ipc_slice($s, 0, $max - 1);
    $chars = ipc_chars($cut);
    $sp = -1;
    for ($i = count($chars) - 1; $i >= 0; $i--) {
        if ($chars[$i] === ' ') { $sp = $i; break; }
    }
    if ($sp > $max * 0.6) {
        $cut = ipc_slice($cut, 0, $sp);
    }
    while (substr_count($cut, '(') > substr_count($cut, ')')) {
        $chars = ipc_chars($cut);
        $at = -1;
        for ($i = count($chars) - 1; $i >= 0; $i--) {
            if ($chars[$i] === '(') { $at = $i; break; }
        }
        $cut = ipc_slice($cut, 0, $at);
    }
    return preg_replace('/[' . IPC_WS . ',;:.—–\/·-]+$/u', '', $cut) . '…';
}

/** fitProductTitle() */
function ipc_fit_product_title($label, $sku, $company, $shortName)
{
    $full = $label . ' — ' . $company;
    if (ipc_len($full) <= IPC_META_TITLE_MAX) {
        return $full;
    }
    $short = ($shortName !== '' && $shortName !== $company) ? $label . ' — ' . $shortName : '';
    if ($short !== '' && ipc_len($short) <= IPC_META_TITLE_MAX) {
        return $short;
    }
    if (ipc_len($label) <= IPC_META_TITLE_MAX) {
        return $label;
    }
    $tail = ($sku !== '' && substr($label, -strlen($sku)) === $sku) ? ' — ' . $sku : '';
    $budget = IPC_META_TITLE_MAX - ipc_len($tail);
    if ($budget < 12) {
        return $sku !== '' ? $sku : ipc_slice($label, 0, IPC_META_TITLE_MAX);
    }
    $head = $tail !== '' ? ipc_slice($label, 0, ipc_len($label) - ipc_len($tail)) : $label;
    return ipc_trim_to_word($head, $budget) . $tail;
}

/** mergeSiteInfo()'s blank-drop for the fields read here. */
function ipc_merge_site(array $data)
{
    $out = ipc_site_defaults();
    $clearable = ['contact.fax' => 1, 'company.shortName' => 1, 'certifications.iso' => 1];
    foreach ($out as $section => $fields) {
        $v = isset($data[$section]) && is_array($data[$section]) ? $data[$section] : [];
        foreach ($fields as $key => $dflt) {
            if (!array_key_exists($key, $v)) {
                continue;
            }
            $val = $v[$key];
            if (is_int($val) || is_float($val)) {
                $val = (string)$val;
            }
            if (!is_string($val)) {
                continue;
            }
            if (ipc_trim($val) === '' && !isset($clearable[$section . '.' . $key])) {
                continue;
            }
            $out[$section][$key] = $val;
        }
    }
    return $out;
}

/** localizeProse() */
function ipc_localize_prose($text, array $site)
{
    if (!is_string($text) || $text === '') {
        return $text;
    }
    $D = ipc_site_defaults();
    $a = $site['address'];
    $pairs = [
        [$D['contact']['phone'], $site['contact']['phone'], false],
        [$D['contact']['fax'], $site['contact']['fax'], true],
        [$D['contact']['email'], $site['contact']['email'], false],
        [
            $D['address']['street'] . ', ' . $D['address']['city'] . ', ' . $D['address']['state'] . ' ' . $D['address']['zip'],
            $a['street'] . ', ' . $a['city'] . ', ' . $a['state'] . ' ' . $a['zip'],
            false,
        ],
    ];
    foreach ($pairs as $p) {
        list($from, $to, $clearable) = $p;
        if ($from === '' || $from === $to) {
            continue;
        }
        if ($to !== '' || $clearable) {
            $text = str_replace($from, $to, $text);
        }
    }
    return $text;
}

/** isoRewriter() — a callable, or null when there is nothing to rewrite. */
function ipc_iso_rewriter($iso)
{
    $src = ipc_trim(ipc_str($iso));
    if ($src === '') {
        return null;
    }
    $token = '/\bISO\s*9001(\s*:\s*\d{4})?/iu';
    if (!preg_match('/^\s*ISO\s*9001(?:\s*:\s*(\d{4}))?\s*$/iu', $src, $m)) {
        $to = $src;
    } elseif (isset($m[1]) && $m[1] !== '') {
        $to = 'ISO 9001:' . $m[1];
    } else {
        $to = 'ISO 9001';
    }
    // A function, never a replacement string: "$1" in typed text is not a
    // backreference (invariant 1's lesson).
    return function ($text) use ($token, $to) {
        return preg_replace_callback($token, function () use ($to) { return $to; }, $text);
    };
}

/** factsRewriter() — a callable, or null when no fact has moved off its shipped value. */
function ipc_facts_rewriter(array $site)
{
    $D = ipc_site_defaults();
    $rules = [];
    $lit = function ($s) { return '/' . preg_quote($s, '/') . '/u'; };
    $val = function ($v) { return ipc_trim(ipc_str($v)); };

    $hours = $val($site['hours']['text']);
    if ($hours !== '' && $hours !== $D['hours']['text']) {
        $rules[] = [$lit($D['hours']['text']), $hours];
    }

    $city = $val($site['address']['city']);
    $state = $val($site['address']['state']);
    $zip = $val($site['address']['zip']);
    $street = $val($site['address']['street']);
    $dA = $D['address'];
    if (($city !== '' && $city !== $dA['city']) || ($state !== '' && $state !== $dA['state'])) {
        $c = $city !== '' ? $city : $dA['city'];
        $s = $state !== '' ? $state : $dA['state'];
        $z = $zip !== '' ? $zip : $dA['zip'];
        $rules[] = [$lit("{$dA['street']}, {$dA['city']}, {$dA['state']} {$dA['zip']}"), ($street !== '' ? $street : $dA['street']) . ", $c, $s $z"];
        $rules[] = [$lit("{$dA['city']}, {$dA['state']} {$dA['zip']}"), "$c, $s $z"];
        $rules[] = [$lit("{$dA['city']}, Illinois"), "$c, " . ($s === $dA['state'] ? 'Illinois' : $s)];
        $rules[] = [$lit("{$dA['city']}, {$dA['state']}"), "$c, $s"];
        $rules[] = ['/' . preg_quote("{$dA['city']} {$dA['state']}", '/') . '\b/u', "$c $s"];
        $rules[] = [$lit($dA['city']), $c];
    }

    $year = $val($site['company']['foundedYear']);
    if ($year !== '' && $year !== $D['company']['foundedYear']) {
        $rules[] = ['/(?<!\d)' . preg_quote($D['company']['foundedYear'], '/') . '(?!\d)/u', $year];
    }

    $moq = $val($site['stats']['minimumOrder']);
    if ($moq !== '' && $moq !== $D['stats']['minimumOrder']) {
        $rules[] = ['/' . preg_quote($D['stats']['minimumOrder'], '/') . '(?![\d,]|\.\d)/u', $moq];
    }

    $feet = $val($site['stats']['feetInStock']);
    if ($feet !== '' && $feet !== $D['stats']['feetInStock']) {
        $rules[] = [$lit($D['stats']['feetInStock']), $feet];
        $short = preg_match('/^(\d+(?:\.\d+)?)\s*(?:million|M)\+?$/i', $feet, $m) ? $m[1] . 'M' : $feet;
        if (preg_match('/^(\d+(?:\.\d+)?)/', $D['stats']['feetInStock'], $dm)) {
            $rules[] = ['/(?<![\d.])' . str_replace('.', '\.', $dm[1]) . 'M(?=\+|\b)/u', $short];
        }
    }

    if (!$rules) {
        return null;
    }
    return function ($text) use ($rules) {
        foreach ($rules as $r) {
            $to = $r[1];
            $text = preg_replace_callback($r[0], function () use ($to) { return $to; }, $text);
        }
        return $text;
    };
}

/** ContentProvider's chokepoint, applied to one string: withIsoLabel then withBusinessFacts. */
function ipc_rewrite_copy($text, $iso, $facts)
{
    if (!is_string($text)) {
        return $text;
    }
    if ($iso) {
        $text = $iso($text);
    }
    if ($facts) {
        $text = $facts($text);
    }
    return $text;
}

/** normalizeSku() */
function ipc_normalize_sku($v)
{
    return preg_replace('/[^A-Z0-9]/', '', strtoupper(ipc_str($v)));
}

/** skuSegmentMatch() */
function ipc_sku_segment_match($sku, $needle)
{
    $n = ipc_normalize_sku($needle);
    if ($n === '') {
        return false;
    }
    foreach (preg_split('/[-\/,]/', ipc_str($sku)) as $seg) {
        if (ipc_normalize_sku($seg) === $n) {
            return true;
        }
    }
    return false;
}

/** findProductByParam() */
function ipc_find_product(array $products, $raw)
{
    if ($raw === '') {
        return null;
    }
    foreach ($products as $p) {
        if ($p['id'] === $raw || $p['sku'] === $raw) return $p;
    }
    $n = ipc_normalize_sku($raw);
    foreach ($products as $p) {
        if (ipc_normalize_sku($p['sku']) === $n || ipc_normalize_sku($p['id']) === $n) return $p;
    }
    foreach ($products as $p) {
        if (ipc_sku_segment_match($p['sku'], $raw) || ipc_sku_segment_match($p['id'], $raw)) return $p;
    }
    return null;
}

/**
 * The catalog as useProducts() sees it (normalizeProductRow + the sku||id
 * filter), or null when it cannot be read — the browser's "not loaded".
 */
function ipc_load_products($file)
{
    $raw = is_file($file) ? @file_get_contents($file) : false;
    $data = $raw === false ? null : json_decode($raw, true);
    if (is_array($data) && isset($data['products'])) {
        $data = is_array($data['products']) ? $data['products'] : null;
    }
    if (!is_array($data)) {
        return null;
    }
    $out = [];
    foreach ($data as $p) {
        if (!is_array($p) || (array_keys($p) === range(0, count($p) - 1) && $p)) {
            continue;
        }
        $row = [];
        foreach (['id', 'sku', 'name', 'partType', 'specificationsSummary', 'photoUrl', 'pdfUrl'] as $k) {
            $row[$k] = isset($p[$k]) ? ipc_str($p[$k]) : '';
        }
        $row['description'] = [];
        if (isset($p['description'])) {
            $d = is_string($p['description']) ? [$p['description']] : (is_array($p['description']) ? $p['description'] : []);
            foreach ($d as $para) {
                if (is_string($para) && ipc_trim($para) !== '') $row['description'][] = $para;
            }
        }
        if ($row['sku'] === '' && $row['id'] === '') {
            continue;
        }
        $out[] = $row;
    }
    // useProducts() treats an empty catalog as "not loaded" (PUB-2), so do we.
    return $out ? $out : null;
}

function ipc_load_json($file)
{
    $raw = is_file($file) ? @file_get_contents($file) : false;
    if ($raw === false || $raw === '') {
        throw new RuntimeException('unreadable: ' . basename($file));
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('unparseable: ' . basename($file));
    }
    return $data;
}

/** isSafeLinkUrl(), for the links in the plain-HTML body. */
function ipc_safe_link($v)
{
    if (!is_string($v)) return false;
    $v = str_replace('\\', '/', ipc_trim(preg_replace('/[\t\n\r]/', '', $v)));
    if ($v === '' || substr($v, 0, 2) === '//') return false;
    if ($v[0] === '/') return true;
    return (bool)preg_match('#^https?://[^/\s]#i', $v);
}

/** pageToPath() + canonicalFor(). rawurlencode() = encodeURIComponent() for every id in this catalog (see sitemap.php). */
function ipc_canonical($key, $productId)
{
    return IPC_ORIGIN . ($key === 'home' ? '/' : '/' . $key)
        . ($productId !== null && $productId !== '' ? '?productId=' . rawurlencode($productId) : '');
}

/**
 * PageMeta, server side. Returns the head values and what the body needs.
 */
function ipc_route_state($uri, $dataDir)
{
    $site = ipc_merge_site(ipc_load_json($dataDir . 'site-info.json'));
    $content = ipc_load_json($dataDir . 'content.json');

    $path = (string)parse_url($uri, PHP_URL_PATH);
    $parts = array_values(array_filter(explode('/', $path), 'strlen'));
    $seg = explode('/', ltrim($path, '/'))[0];
    $page = ($seg === '' || $seg === 'index.html') ? null : $seg;
    $key = $page === null ? 'home' : $page;

    $seoDefault = ipc_seo_default();
    $known = [];
    foreach ($seoDefault as $s) $known[$s['page']] = true;
    $unknownRoute = ($page !== null && !isset($known[$key])) || count($parts) > 1;

    $isoRw = ipc_iso_rewriter($site['certifications']['iso']);
    $factsRw = ipc_facts_rewriter($site);

    // mergeContent: an `seo` array is used as stored, even empty (invariant 3).
    $list = isset($content['seo']) && is_array($content['seo']) ? array_values($content['seo']) : $seoDefault;
    $find = function ($k) use ($list) {
        foreach ($list as $s) {
            if (is_array($s) && isset($s['page']) && $s['page'] === $k) return $s;
        }
        return [];
    };
    $field = function (array $row, $f) use ($isoRw, $factsRw) {
        $v = isset($row[$f]) ? $row[$f] : '';
        return is_string($v) ? ipc_rewrite_copy($v, $isoRw, $factsRw) : '';
    };
    $home = $find('home');
    $entry = $find($key);
    $dflt = [];
    if ($list) {
        foreach ($seoDefault as $s) if ($s['page'] === $key) $dflt = $s;
    }

    $productId = isset($_GET['productId']) && is_string($_GET['productId']) ? $_GET['productId'] : '';
    $productAxis = $key === 'products';
    $products = $productAxis ? ipc_load_products($dataDir . 'products-all.json') : null;
    $catalogLoaded = $products !== null;
    $matched = ($productAxis && $productId !== '' && $catalogLoaded) ? ipc_find_product($products, $productId) : null;
    $pendingProduct = $productAxis && $productId !== '' && !$catalogLoaded;
    $unknownProduct = $productAxis && $productId !== '' && $catalogLoaded && !$matched;

    // Title fallback: the page's own heading, then its name.
    $headers = ipc_header_title_defaults();
    $heading = '';
    if (isset($headers[$key . 'Header'])) {
        $stored = isset($content['copy'][$key . 'Header']['title']) ? $content['copy'][$key . 'Header']['title'] : null;
        $heading = (is_string($stored) && $stored !== '') ? $stored : $headers[$key . 'Header'];
        $heading = ipc_rewrite_copy($heading, $isoRw, $factsRw);
    }
    $label = $heading !== '' ? $heading : preg_replace_callback('/(^|-)([a-z])/', function ($m) {
        return ($m[1] !== '' ? ' ' : '') . strtoupper($m[2]);
    }, $key);
    $company = $site['company']['name'];
    $computed = $key === 'home' ? $company : $label . ' — ' . $company;

    $title = $field($entry, 'title');
    if ($title === '' && $key === 'home') $title = $field($home, 'title');
    if ($title === '') $title = $computed;
    $desc = $field($entry, 'desc');
    if ($desc === '') $desc = isset($dflt['desc']) ? $dflt['desc'] : '';
    if ($desc === '') $desc = $field($home, 'desc');
    $desc = ipc_localize_prose($desc, $site);

    if ($matched) {
        $sku = ipc_trim($matched['sku']);
        $name = ipc_trim($matched['name']);
        $plabel = ($sku !== '' && strpos(strtoupper($name), strtoupper($sku)) === false) ? $name . ' — ' . $sku : $name;
        $title = ipc_fit_product_title($plabel, $sku, $company, $site['company']['shortName']);
        $summary = ipc_trim($matched['specificationsSummary']);
        $kind = ipc_trim($matched['partType']);
        $joined = implode(' ', [
            $sku !== '' ? "$name ($sku)" : $name,
            $kind !== '' ? "— $kind." : '—',
            $summary !== '' ? $summary : 'Specifications, datasheet and quote request.',
        ]);
        $desc = ipc_trim_to_word(ipc_localize_prose(preg_replace('/[' . IPC_WS . ']+/u', ' ', $joined), $site), IPC_META_DESC_MAX);
    }

    if ($unknownProduct) {
        $title = 'Part not found — ' . $company;
        $desc = '';
    }
    if ($unknownRoute) {
        $title = 'Page not found — ' . $company;
        $desc = '';
    }

    $photo = '';
    if ($matched && $matched['photoUrl'] !== '' && strpos($matched['photoUrl'], 'placehold.co') === false) {
        $src = $matched['photoUrl'];
        $photo = preg_match('#^https?://#', $src) ? $src : IPC_ORIGIN . ($src[0] === '/' ? '' : '/') . $src;
    }

    return [
        'key' => $key,
        'site' => $site,
        'content' => $content,
        'heading' => $heading !== '' ? $heading : $label,
        'title' => $title,
        'desc' => $desc,
        // null = no canonical and no og:url; '' never happens
        'canonical' => ($unknownRoute || $unknownProduct || $pendingProduct) ? null : ipc_canonical($key, $matched ? $matched['id'] : null),
        'noindex' => $unknownRoute || $unknownProduct,
        'ogImage' => $photo !== '' ? [$photo, IPC_OG_PHOTO[0], IPC_OG_PHOTO[1]] : [IPC_ORIGIN . IPC_OG_CARD[0], IPC_OG_CARD[1], IPC_OG_CARD[2]],
        'unknown' => $unknownRoute || $unknownProduct,
        'products' => $products,
        'matched' => $unknownRoute ? null : $matched,
    ];
}

/** Replace exactly one match of $re in $html, or throw — a changed shell must fall back, never half-apply. */
function ipc_replace_one($re, $with, $html)
{
    $n = 0;
    $out = preg_replace_callback($re, function () use ($with) { return $with; }, $html, 1, $n);
    if ($out === null || $n !== 1) {
        throw new RuntimeException('shell pattern not found: ' . $re);
    }
    return $out;
}

function ipc_meta_re($attr, $name)
{
    return '#<meta\s+' . $attr . '="' . preg_quote($name, '#') . '"\s+content="[^"]*"\s*/?>#';
}

function ipc_render_head($html, array $st)
{
    $html = ipc_replace_one('#<title>.*?</title>#s', '<title>' . ipc_h($st['title']) . '</title>', $html);
    $html = ipc_replace_one(ipc_meta_re('name', 'description'), '<meta name="description" content="' . ipc_h($st['desc']) . '" />', $html);
    $html = ipc_replace_one(ipc_meta_re('property', 'og:title'), '<meta property="og:title" content="' . ipc_h($st['title']) . '" />', $html);
    $html = ipc_replace_one(ipc_meta_re('property', 'og:description'), '<meta property="og:description" content="' . ipc_h($st['desc']) . '" />', $html);
    $html = ipc_replace_one(ipc_meta_re('property', 'og:image'), '<meta property="og:image" content="' . ipc_h($st['ogImage'][0]) . '" />', $html);
    $html = ipc_replace_one(ipc_meta_re('property', 'og:image:width'), '<meta property="og:image:width" content="' . $st['ogImage'][1] . '" />', $html);
    $html = ipc_replace_one(ipc_meta_re('property', 'og:image:height'), '<meta property="og:image:height" content="' . $st['ogImage'][2] . '" />', $html);
    $html = ipc_replace_one(ipc_meta_re('property', 'og:url'),
        $st['canonical'] === null ? '' : '<meta property="og:url" content="' . ipc_h($st['canonical']) . '" />', $html);
    $extra = '';
    if ($st['canonical'] !== null) {
        $extra .= '<link rel="canonical" href="' . ipc_h($st['canonical']) . '" />' . "\n";
    }
    if ($st['noindex']) {
        $extra .= '<meta name="robots" content="noindex" />' . "\n";
    }
    return ipc_replace_one('#</head>#', $extra . '</head>', $html);
}

/**
 * The plain-HTML body. Read by crawlers and unfurlers that do not run
 * JavaScript, and by a visitor with JavaScript off. React's createRoot()
 * clears #root on its first render, and index.html's inline `ipc-js` class
 * hides this before first paint, so a visitor with JavaScript never sees it.
 * It says nothing the rendered page does not say.
 */
function ipc_render_body(array $st)
{
    $site = $st['site'];
    $copy = isset($st['content']['copy']) && is_array($st['content']['copy']) ? $st['content']['copy'] : [];
    $navCopy = isset($copy['nav']) && is_array($copy['nav']) ? $copy['nav'] : [];
    $nav = [
        ['/', 'home', 'Home'], ['/products', 'products', 'Products'], ['/dashboard', 'productIndex', 'Product Index'],
        ['/datasheets', 'datasheets', 'Datasheets'], ['/industries', null, 'Industries'], ['/services', null, 'Services'],
        ['/about', null, 'About'], ['/faq', null, 'FAQ'], ['/contact', null, 'Contact'], ['/privacy', null, 'Privacy Policy'],
    ];
    $o = '<div id="ipc-prerender">';
    $o .= '<header><p><a href="/">' . ipc_h($site['company']['name']) . '</a></p><nav aria-label="Site"><ul>';
    foreach ($nav as $n) {
        $label = ($n[1] !== null && isset($navCopy[$n[1]]) && is_string($navCopy[$n[1]]) && ipc_trim($navCopy[$n[1]]) !== '') ? $navCopy[$n[1]] : $n[2];
        $o .= '<li><a href="' . $n[0] . '">' . ipc_h($label) . '</a></li>';
    }
    $o .= '</ul></nav></header><main>';

    $p = $st['matched'];
    if ($p) {
        $o .= '<p><a href="/products">' . ipc_h(isset($navCopy['products']) && is_string($navCopy['products']) && $navCopy['products'] !== '' ? $navCopy['products'] : 'Products') . '</a></p>';
        $o .= '<h1>' . ipc_h($p['name'] !== '' ? $p['name'] : $p['sku']) . '</h1><dl>';
        if ($p['sku'] !== '') $o .= '<dt>Part number</dt><dd>' . ipc_h($p['sku']) . '</dd>';
        if ($p['partType'] !== '') $o .= '<dt>Type</dt><dd>' . ipc_h($p['partType']) . '</dd>';
        if ($p['specificationsSummary'] !== '') $o .= '<dt>Specifications</dt><dd>' . ipc_h($p['specificationsSummary']) . '</dd>';
        $o .= '</dl>';
        foreach ($p['description'] as $para) {
            $o .= '<p>' . ipc_h($para) . '</p>';
        }
        if ($p['pdfUrl'] !== '' && ipc_safe_link($p['pdfUrl'])) {
            $o .= '<p><a href="' . ipc_h($p['pdfUrl']) . '">Datasheet (PDF)</a></p>';
        }
        $o .= '<p><a href="/contact?productId=' . ipc_h(rawurlencode($p['id'] !== '' ? $p['id'] : $p['sku'])) . '">Request a quote</a></p>';
    } else {
        $o .= '<h1>' . ipc_h($st['unknown'] ? 'Page not found' : ($st['key'] === 'home' ? $st['title'] : $st['heading'])) . '</h1>';
        if ($st['desc'] !== '') $o .= '<p>' . ipc_h($st['desc']) . '</p>';
        if ($st['key'] === 'products' && is_array($st['products']) && !$st['unknown']) {
            $o .= '<ul>';
            foreach ($st['products'] as $row) {
                $id = $row['id'] !== '' ? $row['id'] : $row['sku'];
                $o .= '<li><a href="/products?productId=' . ipc_h(rawurlencode($id)) . '">'
                    . ipc_h($row['name'] !== '' ? $row['name'] : $row['sku']) . ($row['sku'] !== '' ? ' (' . ipc_h($row['sku']) . ')' : '') . '</a></li>';
            }
            $o .= '</ul>';
        }
    }

    $c = $site['contact'];
    $a = $site['address'];
    $o .= '</main><footer><p>' . ipc_h($site['company']['name']) . '</p>';
    $o .= '<p>' . ipc_h($a['street'] . ', ' . $a['city'] . ', ' . $a['state'] . ' ' . $a['zip']) . '</p>';
    $o .= '<p>Phone: ' . ipc_h($c['phone']) . '</p>';
    if ($c['fax'] !== '') $o .= '<p>Fax: ' . ipc_h($c['fax']) . '</p>';
    $o .= '<p>Email: <a href="mailto:' . ipc_h($c['email']) . '">' . ipc_h($c['email']) . '</a></p>';
    $o .= '<p>' . ipc_h($site['hours']['text']) . '</p></footer></div>';
    return $o;
}

// ── Serve ────────────────────────────────────────────────────────────────────

$shell = @file_get_contents(__DIR__ . '/index.html');
if ($shell === false || $shell === '') {
    // Not an empty 200: a missing shell is a broken deploy and must look like one.
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    echo "The site is being updated. Please try again in a minute.\n";
    exit;
}

header('Content-Type: text/html; charset=UTF-8');
// The shell names the current hashed bundle, so it is never cached — the same
// header public/.htaccess gives index.html.
header('Cache-Control: no-cache, no-store, must-revalidate');

$out = $shell;
set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
try {
    $st = ipc_route_state(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', __DIR__ . '/data/');
    $html = ipc_render_head($shell, $st);
    $html = ipc_replace_one('#<div id="root"></div>#', '<div id="root">' . ipc_render_body($st) . '</div>', $html);
    // The shell's <noscript> block is a FIXED copy of the contact details,
    // written for the day nothing else renders. The body above carries the
    // live ones, so keeping both would show a no-JavaScript visitor two phone
    // numbers the first time Business Details changes. It stays in the shell
    // for the fallback path, where it is the only thing a visitor sees.
    $out = ipc_replace_one('#<noscript>.*?</noscript>\s*#s', '', $html);
} catch (Throwable $e) {
    $out = $shell;
}
restore_error_handler();
echo $out;
