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
 * fitProductTitle, nameHasSku, trimToWord, localizeProse, isoRewriter,
 * factsRewriter, seoDefaultDesc, productImageAbs, PAGE_LABELS,
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
const IPC_OG_CARD_ALT = 'Insulation Products Corporation — heat shrink tubing, sleeving and adhesives';

/** SEO_DEFAULT in src/App.jsx — the ten routes and their default head copy. */
function ipc_seo_default()
{
    return [
        ['page' => 'home', 'title' => 'Insulation Products Corporation — Heat Shrink Tubing, Sleeving & Adhesives', 'desc' => 'IPC is a spec-grade stocking distributor of heat-shrinkable & extruded tubing, electrical sleeving, and industrial adhesives. $50 minimum order. ISO 9001 registered.'],
        ['page' => 'products', 'title' => 'Product Catalog — Insulation Products Corporation', 'desc' => "Browse IPC's full catalog of heat shrink tubing, sleeving, and adhesives. Filter by product family, view specs and datasheets, and request a quote."],
        ['page' => 'dashboard', 'title' => 'Product Index — Insulation Products Corporation', 'desc' => 'Search and sort all IPC products by part number, material, and temperature rating. Quick access to specs and datasheets for every SKU.'],
        ['page' => 'datasheets', 'title' => 'Datasheets — Insulation Products Corporation', 'desc' => 'Download the published datasheet for every IPC product. Heat shrink tubing, sleeving, adhesives and accessories — grouped by family, no form required.'],
        ['page' => 'industries', 'title' => 'Industries Served — Insulation Products Corporation', 'desc' => 'IPC supplies spec-grade insulation materials to automotive, aerospace, medical, military, marine, and industrial markets. Learn how we serve your industry.'],
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
        'contact' => ['phone' => '630.771.0700', 'phoneDial' => '+16307710700', 'fax' => '630.771.0701', 'email' => 'sales@insulationproducts.com'],
        'address' => ['street' => '250 Gibraltar Dr', 'city' => 'Bolingbrook', 'state' => 'IL', 'zip' => '60440'],
        'hours' => ['text' => 'Mon–Fri, 8am–5pm CT'],
        'certifications' => ['iso' => 'ISO 9001'],
        'stats' => ['feetInStock' => '25 million', 'minimumOrder' => '$50'],
        'theme' => ['darkColor' => '#0d2d52'],
    ];
}

/**
 * PAGE_LABELS — the visible heading of the two routes that have no Page
 * Content header group. Without it the fallback title-cased the route key and
 * the no-JS h1 read "Dashboard" / "Products" (A12-L10-W3-G1-1, A12-L6-W5-G1-1).
 */
function ipc_page_labels()
{
    return ['products' => 'Product Catalog', 'dashboard' => 'Product Index'];
}

// ── String helpers: JavaScript semantics without mbstring ───────────────────
//
// PageMeta measures with String.length and cuts with .slice(), i.e. in
// characters. strlen() counts bytes, and "—", "°" and "·" are in the catalog,
// so every cap below would fire early. preg_split('//u') is PCRE, which every
// PHP build has.

/**
 * JavaScript's whitespace class (\s) and String.prototype.trim(), spelled out.
 * Not PCRE's \s: under /u that is Unicode White_Space, which also takes U+0085
 * (and U+180E on older PCRE) — characters JavaScript keeps (A12-L5-W2-G5-2).
 */
const IPC_WS = '\x{0009}-\x{000D}\x{0020}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';

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

/**
 * nameHasSku() — the SKU as a whole token of the name, ASCII case-insensitive.
 * A raw substring test found "CT" inside "Electrical" (A12-L10-01-1), and
 * JavaScript's toUpperCase() folds "ı" and "ß" to ASCII where strtoupper()
 * does not (A12-L15-01-W5-1), so only ASCII letters are folded, on both sides.
 */
function ipc_name_has_sku($name, $sku)
{
    if ($sku === '') {
        return false;
    }
    return (bool)preg_match('/(?<![A-Z0-9])' . preg_quote(strtoupper($sku), '/') . '(?![A-Z0-9])/', strtoupper((string)$name));
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
    // A12-L15-10-2 — the SKU survives when it sits inside the name too, not
    // only when it was appended as " — SKU".
    $tail = '';
    $head = $label;
    if ($sku !== '' && substr($label, -strlen(' — ' . $sku)) === ' — ' . $sku) {
        $tail = ' — ' . $sku;
        $head = ipc_slice($label, 0, ipc_len($label) - ipc_len($tail));
    } elseif ($sku !== '') {
        $plain = ipc_trim_to_word($label, IPC_META_TITLE_MAX);
        if (ipc_name_has_sku($plain, $sku)) {
            return $plain;
        }
        $tail = ' — ' . $sku;
    }
    $budget = IPC_META_TITLE_MAX - ipc_len($tail);
    if ($budget < 12) {
        return $sku !== '' ? $sku : ipc_slice($label, 0, IPC_META_TITLE_MAX);
    }
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
            if (ipc_trim($val) === '') {
                if (!isset($clearable[$section . '.' . $key])) {
                    continue;
                }
                // A12-L5-02-W5-2 — a clearable field holding only spaces is cleared.
                $val = '';
            }
            $out[$section][$key] = $val;
        }
    }
    // NEW-N1-15 — a moved display phone with the shipped dial number derives
    // the dial number from it (North American formats), as mergeSiteInfo does.
    $D = ipc_site_defaults();
    $c = $out['contact'];
    if ($c['phone'] !== $D['contact']['phone'] && $c['phoneDial'] === $D['contact']['phoneDial']) {
        $digits = preg_replace('/\D/', '', $c['phone']);
        $dial = strlen($digits) === 10 ? '+1' . $digits : ((strlen($digits) === 11 && $digits[0] === '1') ? '+' . $digits : '');
        if ($dial !== '') $out['contact']['phoneDial'] = $dial;
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
    // A12-L5-05-3 — a revision written "-2015", "–2015" or " 2015" is part of
    // the token too, or it survived the rewrite as "ISO 9001:2015-2015".
    $token = '/\bISO\s*9001(\s*[:\-\x{2013}]\s*\d{4}\b|\s+\d{4}\b)?/iu';
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
        // A12-L8-W4-G2-1 — the title-case form ("25 Million Feet in Stock."),
        // as factsRewriter() in App.jsx.
        $title = function ($x) { return preg_replace_callback('/\b[a-z]/', function ($c) { return strtoupper($c[0]); }, $x); };
        if ($title($D['stats']['feetInStock']) !== $D['stats']['feetInStock']) {
            $rules[] = [$lit($title($D['stats']['feetInStock'])), $title($feet)];
        }
        $short = preg_match('/^(\d+(?:\.\d+)?)\s*(?:million|M)\+?$/i', $feet, $m) ? $m[1] . 'M' : $feet;
        if (preg_match('/^(\d+(?:\.\d+)?)/', $D['stats']['feetInStock'], $dm)) {
            $rules[] = ['/(?<![\d.])' . str_replace('.', '\.', $dm[1]) . 'M(?=\+|\b)/u', $short];
        }
    }

    if (!$rules) {
        return null;
    }
    // AUDIT-12 A12-L15-W2-G3-1 — a rule's OUTPUT is never re-read by a later
    // rule (factsRewriter() in App.jsx does the same): each replacement is
    // parked behind a private-use placeholder until every rule has run, or the
    // bare-city rule rewrote a new street named after the old city.
    $pua = '/[\x{E000}-\x{F8FF}]/u';
    return function ($text) use ($rules, $pua) {
        if (is_string($text) && preg_match($pua, $text)) {
            foreach ($rules as $r) {
                $to = $r[1];
                $text = preg_replace_callback($r[0], function () use ($to) { return $to; }, $text);
            }
            return $text;
        }
        $parked = [];
        foreach ($rules as $r) {
            $to = $r[1];
            $text = preg_replace_callback($r[0], function () use ($to, &$parked) {
                $parked[] = $to;
                $cp = 0xE000 + count($parked) - 1;
                return chr(0xE0 | ($cp >> 12)) . chr(0x80 | (($cp >> 6) & 0x3F)) . chr(0x80 | ($cp & 0x3F));
            }, $text);
        }
        if (!$parked || !is_string($text)) {
            return $text;
        }
        return preg_replace_callback($pua, function ($m) use ($parked) {
            $b = $m[0];
            $cp = ((ord($b[0]) & 0x0F) << 12) | ((ord($b[1]) & 0x3F) << 6) | (ord($b[2]) & 0x3F);
            return $parked[$cp - 0xE000];
        }, $text);
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

/** normalizeSku() — ASCII only on both sides (A12-L15-17-2). */
function ipc_normalize_sku($v)
{
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', ipc_str($v)));
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
    // A12-L15-17-3 — `@` does not stop the error handler below from throwing,
    // so an unreadable (mode 000) catalog threw out of the whole page and the
    // product URL was served the homepage's head. Unreadable means null.
    try {
        $raw = is_file($file) ? @file_get_contents($file) : false;
    } catch (Throwable $e) {
        $raw = false;
    }
    $data = $raw === false ? null : json_decode(ipc_strip_bom($raw), true);
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
        foreach (['id', 'sku', 'name', 'partType', 'specificationsSummary', 'photoUrl', 'pdfUrl', 'pdfLabel'] as $k) {
            $row[$k] = isset($p[$k]) ? ipc_str($p[$k]) : '';
        }
        // productExtraPdfs(): object rows only.
        $row['additionalPdfs'] = [];
        if (isset($p['additionalPdfs']) && is_array($p['additionalPdfs'])) {
            foreach ($p['additionalPdfs'] as $x) {
                if (is_array($x) && !(array_keys($x) === range(0, count($x) - 1) && $x)) {
                    $row['additionalPdfs'][] = [
                        'url' => isset($x['url']) && is_string($x['url']) ? $x['url'] : '',
                        'label' => isset($x['label']) ? ipc_str($x['label']) : '',
                    ];
                }
            }
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

/**
 * A12-L5-W2-G2-1 — a UTF-8 byte-order mark (an FTP editor's) made every PHP
 * reader's json_decode() fail while the browser's res.json() skips it.
 */
function ipc_strip_bom($raw)
{
    return (is_string($raw) && strncmp($raw, "\xEF\xBB\xBF", 3) === 0) ? substr($raw, 3) : $raw;
}

/** A JSON list (Array.isArray), not an object decoded to a keyed array. */
function ipc_is_list($v)
{
    return is_array($v) && ($v === [] || array_keys($v) === range(0, count($v) - 1));
}

/**
 * URLSearchParams.get(): the FIRST value of a repeated key. $_GET keeps the
 * last, so ?productId=A&productId=B showed A in the browser and B to every
 * unfurler (A12-L15-01-1). Null when absent.
 */
function ipc_query_param($uri, $name)
{
    $q = (string)parse_url($uri, PHP_URL_QUERY);
    foreach (explode('&', $q) as $pair) {
        if ($pair === '') continue;
        $kv = explode('=', $pair, 2);
        if (urldecode($kv[0]) === $name) {
            return isset($kv[1]) ? urldecode($kv[1]) : '';
        }
    }
    return null;
}

function ipc_load_json($file)
{
    $raw = is_file($file) ? @file_get_contents($file) : false;
    if ($raw === false || $raw === '') {
        throw new RuntimeException('unreadable: ' . basename($file));
    }
    $data = json_decode(ipc_strip_bom($raw), true);
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

/**
 * productImageAbs(): a product photo as an absolute URL, or ''. The scheme
 * test is case-insensitive (A12-L10-03-1) and a protocol-relative "//host/x"
 * is resolved the way the browser resolves it on this https site, not glued
 * onto the origin (A12-L10-W3-R1-6-1).
 */
function ipc_product_image_abs($src)
{
    if ($src === '' || strpos($src, 'placehold.co') !== false) return '';
    if (preg_match('#^https?://#i', $src)) return $src;
    if (substr($src, 0, 2) === '//') return 'https:' . $src;
    return IPC_ORIGIN . ($src[0] === '/' ? '' : '/') . $src;
}

/**
 * The default SEO description of a route (SEO_DEFAULT) as a fallback, put
 * through the same ISO and business-facts rewrite as the stored rows, and
 * without its ISO sentence when the ISO box is empty (A12-L5-W2-G3-1).
 * seoDefaultDesc() in src/App.jsx.
 */
function ipc_seo_default_desc($text, $isoRw, $factsRw)
{
    if (!is_string($text) || $text === '') {
        return $text;
    }
    if (!$isoRw) {
        $text = preg_replace('/\s*\bISO 9001 registered\.(?=\s|$)/u', '', $text);
    }
    return ipc_rewrite_copy($text, $isoRw, $factsRw);
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
    // A JSON object is not an array to Array.isArray (A12-L5-04-1).
    $list = isset($content['seo']) && ipc_is_list($content['seo']) ? $content['seo'] : $seoDefault;
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

    $productId = (string)ipc_query_param($uri, 'productId');
    $productAxis = $key === 'products';
    // The catalog is also listed in the no-JS body of the Product Index and
    // Datasheets pages (A12-L6-03-2, A12-L6-04-2); only /products matches on it.
    $products = ($productAxis || $key === 'dashboard' || $key === 'datasheets') ? ipc_load_products($dataDir . 'products-all.json') : null;
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
    $pageLabels = ipc_page_labels();
    $label = $heading !== '' ? $heading : (isset($pageLabels[$key]) ? $pageLabels[$key] : preg_replace_callback('/(^|-)([a-z])/', function ($m) {
        return ($m[1] !== '' ? ' ' : '') . strtoupper($m[2]);
    }, $key));
    $company = $site['company']['name'];
    $computed = $key === 'home' ? $company : $label . ' — ' . $company;

    $title = $field($entry, 'title');
    if ($title === '' && $key === 'home') $title = $field($home, 'title');
    if ($title === '') $title = $computed;
    $desc = $field($entry, 'desc');
    if ($desc === '') $desc = isset($dflt['desc']) ? ipc_seo_default_desc($dflt['desc'], $isoRw, $factsRw) : '';
    if ($desc === '') $desc = $field($home, 'desc');
    $desc = ipc_localize_prose($desc, $site);

    if ($matched) {
        $sku = ipc_trim($matched['sku']);
        // A12-L5-02-W5-1 — a nameless row (FTP hand edit) is named by its SKU.
        $name = ipc_trim($matched['name']) !== '' ? ipc_trim($matched['name']) : $sku;
        $hasSku = ipc_name_has_sku($name, $sku);
        $plabel = ($sku !== '' && !$hasSku) ? $name . ' — ' . $sku : $name;
        $title = ipc_fit_product_title($plabel, $sku, $company, $site['company']['shortName']);
        $summary = ipc_trim($matched['specificationsSummary']);
        $kind = ipc_trim($matched['partType']);
        $joined = implode(' ', [
            // A12-L8-W5-G1-2 — "(SKU)" only when the name does not already say it.
            ($sku !== '' && !$hasSku) ? "$name ($sku)" : $name,
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

    $photo = $matched ? ipc_product_image_abs($matched['photoUrl']) : '';
    $photoAlt = '';
    if ($photo !== '') {
        $photoAlt = ipc_trim($matched['name']) !== '' ? ipc_trim($matched['name']) : ipc_trim($matched['sku']);
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
        'ogImage' => $photo !== '' ? [$photo, IPC_OG_PHOTO[0], IPC_OG_PHOTO[1], $photoAlt] : [IPC_ORIGIN . IPC_OG_CARD[0], IPC_OG_CARD[1], IPC_OG_CARD[2], IPC_OG_CARD_ALT],
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
    // A12-L10-01-2 — the alt describes the image actually declared.
    $html = ipc_replace_one(ipc_meta_re('property', 'og:image:alt'), '<meta property="og:image:alt" content="' . ipc_h($st['ogImage'][3]) . '" />', $html);
    // A12-L10-01-3 — the browser-bar colour follows Business Details' Dark colour.
    $dark = $st['site']['theme']['darkColor'];
    if (preg_match('/^#[0-9a-f]{6}$/i', $dark)) {
        $html = ipc_replace_one(ipc_meta_re('name', 'theme-color'), '<meta name="theme-color" content="' . ipc_h($dark) . '" />', $html);
    }
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
        $o .= '<p><a href="/products">' . ipc_h(isset($navCopy['products']) && is_string($navCopy['products']) && ipc_trim($navCopy['products']) !== '' ? $navCopy['products'] : 'Products') . '</a></p>';
        $o .= '<h1>' . ipc_h(ipc_trim($p['name']) !== '' ? $p['name'] : $p['sku']) . '</h1><dl>';
        if ($p['sku'] !== '') $o .= '<dt>Part number</dt><dd>' . ipc_h($p['sku']) . '</dd>';
        if ($p['partType'] !== '') $o .= '<dt>Type</dt><dd>' . ipc_h($p['partType']) . '</dd>';
        if ($p['specificationsSummary'] !== '') $o .= '<dt>Specifications</dt><dd>' . ipc_h($p['specificationsSummary']) . '</dd>';
        $o .= '</dl>';
        foreach ($p['description'] as $para) {
            $o .= '<p>' . ipc_h($para) . '</p>';
        }
        // A12-L10-W3-G3-2 — every data sheet the product page lists, with its
        // label (pdfLabel, additionalPdfs), as the rendered page shows them.
        if ($p['pdfUrl'] !== '') {
            $sheets = array_merge([['url' => $p['pdfUrl'], 'label' => $p['pdfLabel']]], $p['additionalPdfs']);
            foreach ($sheets as $sheet) {
                if (!ipc_safe_link($sheet['url'])) continue;
                $o .= '<p><a href="' . ipc_h($sheet['url']) . '">' . ipc_h($sheet['label'] !== '' ? $sheet['label'] : 'Datasheet') . ' (PDF)</a></p>';
            }
        }
        // A12-L15-18-1 — ?part=, the parameter the contact form pre-fills from,
        // with the same SKU-first value as the rendered page's quote button.
        $o .= '<p><a href="/contact?part=' . ipc_h(rawurlencode($p['sku'] !== '' ? $p['sku'] : $p['id'])) . '">Request a quote</a></p>';
    } else {
        $o .= '<h1>' . ipc_h($st['unknown'] ? 'Page not found' : ($st['key'] === 'home' ? $st['title'] : $st['heading'])) . '</h1>';
        if ($st['desc'] !== '') $o .= '<p>' . ipc_h($st['desc']) . '</p>';
        // The Product Index lists the same catalog links as /products
        // (A12-L6-03-2); Datasheets lists every published data sheet (A12-L6-04-2).
        if (($st['key'] === 'products' || $st['key'] === 'dashboard') && is_array($st['products']) && !$st['unknown']) {
            $o .= '<ul>';
            foreach ($st['products'] as $row) {
                $id = $row['id'] !== '' ? $row['id'] : $row['sku'];
                $o .= '<li><a href="/products?productId=' . ipc_h(rawurlencode($id)) . '">'
                    . ipc_h($row['name'] !== '' ? $row['name'] : $row['sku']) . ($row['sku'] !== '' ? ' (' . ipc_h($row['sku']) . ')' : '') . '</a></li>';
            }
            $o .= '</ul>';
        }
        if ($st['key'] === 'datasheets' && is_array($st['products']) && !$st['unknown']) {
            $o .= '<ul>';
            foreach ($st['products'] as $row) {
                if ($row['pdfUrl'] === '' || !ipc_safe_link($row['pdfUrl'])) continue;
                $o .= '<li><a href="' . ipc_h($row['pdfUrl']) . '">' . ($row['sku'] !== '' ? ipc_h($row['sku']) . ' — ' : '')
                    . ipc_h($row['name'] !== '' ? $row['name'] : $row['sku']) . ' (PDF)</a></li>';
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

/** The C38 floor, from the live Business Details: who IPC is and how to reach them. */
function ipc_render_noscript(array $site)
{
    $c = $site['contact'];
    $a = 'style="color:#0a2240"';
    $o = '<noscript>' . "\n";
    $o .= '      <div style="max-width:38rem;margin:0 auto;padding:1.5rem;font-family:system-ui,-apple-system,\'Segoe UI\',sans-serif;color:#141414;line-height:1.55">';
    $o .= '<p style="margin:0 0 .75rem;padding:.75rem 1rem;background:#f8fafc;border:1px solid #e5e9ee;border-radius:6px"><strong>'
        . ipc_h($site['company']['name']) . '</strong> &mdash; parts of this site need JavaScript. Please call or email us and we will help you directly.</p>';
    $o .= '<p style="margin:0 0 .4rem"><strong>Phone</strong> <a href="tel:' . ipc_h($c['phoneDial']) . '" ' . $a . '>' . ipc_h($c['phone']) . '</a></p>';
    $o .= '<p style="margin:0"><strong>Email</strong> <a href="mailto:' . ipc_h($c['email']) . '" ' . $a . '>' . ipc_h($c['email']) . '</a></p>';
    return $o . "</div>\n    </noscript>";
}

// ── Serve ────────────────────────────────────────────────────────────────────

$shell = @file_get_contents(__DIR__ . '/index.html');
if ($shell === false || $shell === '') {
    // Not an empty 200: a missing shell is a broken deploy and must look like one.
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    // A12-L6-W5-G2-1 — still a way to reach IPC: the live Business Details if
    // data/ is up, else the shipped ones.
    $site = ipc_site_defaults();
    try {
        $site = ipc_merge_site(ipc_load_json(__DIR__ . '/data/site-info.json'));
    } catch (Throwable $e) {
    }
    echo "The site is being updated. Please try again in a minute.\n\n"
        . $site['company']['name'] . "\n"
        . 'Phone: ' . $site['contact']['phone'] . "\n"
        . 'Email: ' . $site['contact']['email'] . "\n";
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
    // The shell's <noscript> block (C38) is a FIXED copy of the contact
    // details, written for the day nothing else renders, and it would show a
    // no-JavaScript visitor the old phone number beside the live one the first
    // time Business Details changes. Rewritten from the live values instead;
    // the fixed copy still serves the fallback path above, where it is the
    // only thing a visitor sees.
    $out = ipc_replace_one('#<noscript>.*?</noscript>#s', ipc_render_noscript($st['site']), $html);
} catch (Throwable $e) {
    $out = $shell;
}
restore_error_handler();
echo $out;
