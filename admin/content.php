<?php
require_once 'config.php';
require_auth();

/**
 * Page Content editor — edits data/content.json, the homepage section arrays
 * (Products & Services cards, the trust-bar stats, and the Industries grid)
 * that the React site reads at runtime. Mirrors settings.php conventions.
 */

// Friendly labels for the code-defined icon sets. Keys MUST match the icon
// maps in src/App.jsx (FEATURES_ICONS, STATS_ICONS, MktIcons). Adding a brand
// new icon still requires a code change; the customer picks from these.
$FEATURE_ICONS = [
    'heatshrink' => 'Heat shrink tubing',
    'sleeving'   => 'Sleeving',
    'adhesives'  => 'Adhesives',
    'cut'        => 'Scissors / cut',
    'marking'    => 'Marking / label',
    'quality'    => 'Quality / shield',
];
$STAT_ICONS = [
    'years'  => 'Calendar (years)',
    'stock'  => 'Boxes (stock)',
    'dollar' => 'Dollar sign',
    'ship'   => 'Shipping / truck',
];
$MARKET_ICONS = [
    'auto'        => 'Automotive',
    'aero'        => 'Aerospace',
    'medical'     => 'Medical',
    'industrial'  => 'Industrial',
    'marine'      => 'Marine',
    'electronics' => 'Electronics',
];
$SERVICE_ICONS = [
    'cut'     => 'Scissors / cut',
    'spool'   => 'Spool / coil',
    'mark'    => 'Pen / marking',
    'kit'     => 'Box / kit',
    'barcode' => 'Bar code',
    'slit'    => 'Slit / perforation',
];
$CERT_ICONS = [
    'check' => 'Check mark',
    'leaf'  => 'Leaf (RoHS / eco)',
    'flag'  => 'Flag (Made in USA)',
    'list'  => 'List / standards',
    'build' => 'Building / factory',
    'lock'  => 'Lock (private / secure)',
];
$INDUSTRY_ICONS = [
    'automotive' => 'Automotive',
    'aerospace'  => 'Aerospace',
    'medical'    => 'Medical',
    'industrial' => 'Industrial',
    'marine'     => 'Marine',
];
// Valid navigation targets. Nav/footer links can be relabeled and reordered, but
// their destination is constrained to this list so routing can never break.
$PAGE_OPTIONS = [
    'home'       => 'Home',
    'products'   => 'Products / Catalog',
    'dashboard'  => 'Product Index',
    'industries' => 'Industries',
    'services'   => 'Services',
    'about'      => 'About',
    'faq'        => 'Resources / FAQ',
    'contact'    => 'Contact',
    'privacy'    => 'Privacy Policy',
];

// Section definitions: field list + which icon set + copy.
$SECTIONS = [
    'features' => [
        'title'    => 'Products &amp; Services Cards',
        'sub'      => 'The card grid under “A Complete Insulation Supply Source” on the homepage. Any number of cards works.',
        'addLabel' => 'Card',
        'icons'    => $FEATURE_ICONS,
        'fields'   => [
            ['key' => 'iconKey',     'type' => 'icon',     'label' => 'Icon'],
            ['key' => 'title',       'type' => 'text',     'label' => 'Title'],
            ['key' => 'description', 'type' => 'textarea', 'label' => 'Description', 'full' => true],
        ],
    ],
    'stats' => [
        'title'    => 'Trust Bar Stats',
        'sub'      => 'The four-up stat strip below the hero. Works best with exactly 4 items so the row stays balanced.',
        'addLabel' => 'Stat',
        'icons'    => $STAT_ICONS,
        'fields'   => [
            ['key' => 'iconKey', 'type' => 'icon', 'label' => 'Icon'],
            ['key' => 'value',   'type' => 'text', 'label' => 'Value (e.g. 25M+)'],
            ['key' => 'label',   'type' => 'text', 'label' => 'Label'],
            ['key' => 'sub',     'type' => 'text', 'label' => 'Sub-line'],
        ],
    ],
    'markets' => [
        'title'    => 'Industries Grid',
        'sub'      => 'The “Trusted Across Demanding Markets” cards on the homepage. Each links to the Industries page.',
        'addLabel' => 'Industry',
        'icons'    => $MARKET_ICONS,
        'fields'   => [
            ['key' => 'iconKey', 'type' => 'icon',     'label' => 'Icon'],
            ['key' => 'label',   'type' => 'text',     'label' => 'Name'],
            ['key' => 'desc',    'type' => 'textarea', 'label' => 'Description', 'full' => true],
        ],
    ],
    'industryDetail' => [
        'title'    => 'Industries Page — Detail Sections',
        'sub'      => 'The big per-industry blocks on the Industries page: applications, linked IPC products, and certification chips. In the “IPC products” box use one product per line as <code>SKU | Display name</code> — the SKU must match a real product so the link works.',
        'addLabel' => 'Industry section',
        'icons'    => $INDUSTRY_ICONS,
        'fields'   => [
            ['key' => 'iconKey',  'type' => 'icon',     'label' => 'Icon'],
            ['key' => 'name',     'type' => 'text',     'label' => 'Industry name'],
            ['key' => 'subhead',  'type' => 'text',     'label' => 'Sub-heading', 'full' => true],
            ['key' => 'useCases', 'type' => 'list',     'label' => 'Common applications (one per line)', 'full' => true],
            ['key' => 'products', 'type' => 'list',     'label' => 'IPC products (one per line: SKU | Display name)', 'full' => true],
            ['key' => 'certs',    'type' => 'list',     'label' => 'Certification chips (one per line)', 'full' => true],
        ],
    ],
    'services' => [
        'title'    => 'Value-Added Services',
        'sub'      => 'The fabrication service cards on the Services page. The “bullet points” box takes one item per line; the brochure link is optional.',
        'addLabel' => 'Service',
        'icons'    => $SERVICE_ICONS,
        'fields'   => [
            ['key' => 'iconKey',        'type' => 'icon',     'label' => 'Icon'],
            ['key' => 'title',          'type' => 'text',     'label' => 'Title'],
            ['key' => 'leadTime',       'type' => 'text',     'label' => 'Lead time (e.g. ≤ 1 week)'],
            ['key' => 'desc',           'type' => 'textarea', 'label' => 'Description', 'full' => true],
            ['key' => 'details',        'type' => 'list',     'label' => 'Bullet points (one per line)', 'full' => true],
            ['key' => 'brochure_url',   'type' => 'text',     'label' => 'Brochure PDF URL (optional)'],
            ['key' => 'brochure_label', 'type' => 'text',     'label' => 'Brochure link text (optional)'],
        ],
    ],
    'milestones' => [
        'title'    => 'About — Company Timeline',
        'sub'      => 'The milestone timeline on the About page.',
        'addLabel' => 'Milestone',
        'icons'    => [],
        'fields'   => [
            ['key' => 'year',  'type' => 'text',     'label' => 'Year / era (e.g. 1974, 1980s)'],
            ['key' => 'label', 'type' => 'text',     'label' => 'Label'],
            ['key' => 'desc',  'type' => 'textarea', 'label' => 'Description', 'full' => true],
        ],
    ],
    'faq' => [
        'title'    => 'FAQ / Resources',
        'sub'      => 'Questions on the Resources / FAQ page. Items are grouped by the Category text — reuse the exact same category name to keep questions together.',
        'addLabel' => 'Question',
        'icons'    => [],
        'fields'   => [
            ['key' => 'category', 'type' => 'text',     'label' => 'Category'],
            ['key' => 'question', 'type' => 'text',     'label' => 'Question', 'full' => true],
            ['key' => 'answer',   'type' => 'textarea', 'label' => 'Answer', 'full' => true],
        ],
    ],
    'capabilities' => [
        'title'    => 'About — Team &amp; Capabilities',
        'sub'      => 'The “Our Team & Capabilities” cards on the About page. The icon is an emoji.',
        'addLabel' => 'Capability',
        'icons'    => [],
        'fields'   => [
            ['key' => 'avatar', 'type' => 'text', 'label' => 'Icon / emoji'],
            ['key' => 'name',   'type' => 'text', 'label' => 'Name'],
            ['key' => 'role',   'type' => 'text', 'label' => 'Role / description', 'full' => true],
        ],
    ],
    'certs' => [
        'title'    => 'About — Certifications &amp; Standards',
        'sub'      => 'The certification cards on the About page.',
        'addLabel' => 'Certification',
        'icons'    => $CERT_ICONS,
        'fields'   => [
            ['key' => 'iconKey', 'type' => 'icon', 'label' => 'Icon'],
            ['key' => 'title',   'type' => 'text', 'label' => 'Title'],
            ['key' => 'sub',     'type' => 'text', 'label' => 'Sub-line', 'full' => true],
        ],
    ],
    'companyNav' => [
        'title'    => 'Navigation — Company Menu',
        'sub'      => 'The “Company” dropdown in the site header. Destination is limited to real pages.',
        'addLabel' => 'Menu item',
        'icons'    => [],
        'fields'   => [
            ['key' => 'label', 'type' => 'text', 'label' => 'Label'],
            ['key' => 'sub',   'type' => 'text', 'label' => 'Sub-text'],
            ['key' => 'page',  'type' => 'page', 'label' => 'Links to', 'options' => $PAGE_OPTIONS],
        ],
    ],
    'footerLinks' => [
        'title'    => 'Navigation — Footer Quick Links',
        'sub'      => 'The “Quick Links” column in the site footer. Destination is limited to real pages.',
        'addLabel' => 'Footer link',
        'icons'    => [],
        'fields'   => [
            ['key' => 'label', 'type' => 'text', 'label' => 'Label'],
            ['key' => 'page',  'type' => 'page', 'label' => 'Links to', 'options' => $PAGE_OPTIONS],
        ],
    ],
    'heroProofPoints' => [
        'title'    => 'Homepage — Hero Proof Points',
        'sub'      => 'The four small stat cards on the right side of the hero.',
        'addLabel' => 'Proof point',
        'icons'    => [],
        'fields'   => [
            ['key' => 'stat',  'type' => 'text', 'label' => 'Value (e.g. $50)'],
            ['key' => 'label', 'type' => 'text', 'label' => 'Label'],
            ['key' => 'sub',   'type' => 'text', 'label' => 'Sub-line'],
        ],
    ],
    'heroTrust' => [
        'title'    => 'Homepage — Hero Trust Ticker',
        'sub'      => 'The scrolling strip of short credentials beneath the hero.',
        'addLabel' => 'Ticker item',
        'icons'    => [],
        'fields'   => [
            ['key' => 'text', 'type' => 'text', 'label' => 'Text', 'full' => true],
        ],
    ],
    'privacySections' => [
        'title'    => 'Privacy Policy — Sections',
        'sub'      => 'Each titled block of your privacy policy. Contact details inside the text auto-update from Business Details.',
        'addLabel' => 'Section',
        'icons'    => [],
        'fields'   => [
            ['key' => 'title',   'type' => 'text',     'label' => 'Section heading'],
            ['key' => 'content', 'type' => 'textarea', 'label' => 'Section text', 'full' => true],
        ],
    ],
    'seo' => [
        'title'    => 'Search Engine Text (SEO)',
        'sub'      => 'The browser-tab title and description for each page — also used for social-media share previews. The "home" row is the site-wide default.',
        'addLabel' => 'Page',
        'icons'    => [],
        'fields'   => [
            ['key' => 'page',  'type' => 'page',     'label' => 'Page', 'options' => $PAGE_OPTIONS],
            ['key' => 'title', 'type' => 'text',     'label' => 'Browser-tab title', 'full' => true],
            ['key' => 'desc',  'type' => 'textarea', 'label' => 'Meta description', 'full' => true],
        ],
    ],
    'contactTips' => [
        'title'    => 'Contact Page — Sidebar Tips',
        'sub'      => 'The “for fastest response, include:” checklist in the contact sidebar.',
        'addLabel' => 'Tip',
        'icons'    => [],
        'fields'   => [
            ['key' => 'text', 'type' => 'text', 'label' => 'Tip', 'full' => true],
        ],
    ],
];

// Fixed page copy (hero text, section headings, page banners) — edited as fixed
// fields grouped into cards, saved under the "copy" key as a nested object.
$COPY_GROUPS = [
    'hero' => ['title' => 'Homepage — Hero', 'fields' => [
        ['key' => 'badge',             'type' => 'text',     'label' => 'Badge (small text above headline)'],
        ['key' => 'headlineLine1',     'type' => 'text',     'label' => 'Headline — line 1'],
        ['key' => 'headlineAccent',    'type' => 'text',     'label' => 'Headline — line 2 (accent color)'],
        ['key' => 'headlineLine3',     'type' => 'text',     'label' => 'Headline — line 3'],
        ['key' => 'subhead',           'type' => 'textarea', 'label' => 'Sub-headline paragraph'],
        ['key' => 'ctaPrimaryLabel',   'type' => 'text',     'label' => 'Primary button text'],
        ['key' => 'ctaPrimaryPage',    'type' => 'page',     'label' => 'Primary button links to', 'options' => $PAGE_OPTIONS],
        ['key' => 'ctaSecondaryLabel', 'type' => 'text',     'label' => 'Secondary button text'],
        ['key' => 'ctaSecondaryPage',  'type' => 'page',     'label' => 'Secondary button links to', 'options' => $PAGE_OPTIONS],
    ]],
    'homeFeatures' => ['title' => 'Homepage — “Products & Services” heading', 'fields' => [
        ['key' => 'eyebrow',   'type' => 'text', 'label' => 'Eyebrow (small heading)'],
        ['key' => 'title',     'type' => 'text', 'label' => 'Title'],
        ['key' => 'ctaText',   'type' => 'text', 'label' => 'Ribbon text'],
        ['key' => 'ctaButton', 'type' => 'text', 'label' => 'Ribbon button'],
    ]],
    'homeMarkets' => ['title' => 'Homepage — “Industries” heading', 'fields' => [
        ['key' => 'eyebrow',  'type' => 'text',     'label' => 'Eyebrow'],
        ['key' => 'title',    'type' => 'text',     'label' => 'Title'],
        ['key' => 'subtitle', 'type' => 'textarea', 'label' => 'Subtitle'],
    ]],
    'servicesHeader' => ['title' => 'Services page — banner', 'fields' => [
        ['key' => 'eyebrow', 'type' => 'text',     'label' => 'Eyebrow'],
        ['key' => 'title',   'type' => 'text',     'label' => 'Title'],
        ['key' => 'intro',   'type' => 'textarea', 'label' => 'Intro paragraph'],
    ]],
    'industriesHeader' => ['title' => 'Industries page — banner', 'fields' => [
        ['key' => 'eyebrow', 'type' => 'text',     'label' => 'Eyebrow'],
        ['key' => 'title',   'type' => 'text',     'label' => 'Title'],
        ['key' => 'intro',   'type' => 'textarea', 'label' => 'Intro paragraph'],
    ]],
    'aboutHeader' => ['title' => 'About page — banner & headings', 'fields' => [
        ['key' => 'eyebrow',    'type' => 'text',     'label' => 'Eyebrow'],
        ['key' => 'title',      'type' => 'text',     'label' => 'Title'],
        ['key' => 'intro',      'type' => 'textarea', 'label' => 'Intro paragraph'],
        ['key' => 'storyTitle', 'type' => 'text',     'label' => '“Our Story” heading'],
        ['key' => 'certsTitle', 'type' => 'text',     'label' => 'Certifications heading'],
        ['key' => 'teamTitle',  'type' => 'text',     'label' => 'Team heading'],
        ['key' => 'ctaTitle',   'type' => 'text',     'label' => 'Bottom CTA heading'],
    ]],
    'faqHeader' => ['title' => 'FAQ page — banner', 'fields' => [
        ['key' => 'eyebrow', 'type' => 'text',     'label' => 'Eyebrow'],
        ['key' => 'title',   'type' => 'text',     'label' => 'Title'],
        ['key' => 'intro',   'type' => 'textarea', 'label' => 'Intro paragraph'],
    ]],
    'contactHeader' => ['title' => 'Contact page — banner', 'fields' => [
        ['key' => 'eyebrow',     'type' => 'text',     'label' => 'Eyebrow'],
        ['key' => 'title',       'type' => 'text',     'label' => 'Title'],
        ['key' => 'intro',       'type' => 'textarea', 'label' => 'Intro paragraph'],
        ['key' => 'directTitle', 'type' => 'text',     'label' => '“Direct Contact” heading'],
    ]],
    'privacyHeader' => ['title' => 'Privacy page — banner', 'fields' => [
        ['key' => 'eyebrow',       'type' => 'text',     'label' => 'Eyebrow'],
        ['key' => 'title',         'type' => 'text',     'label' => 'Title'],
        ['key' => 'effectiveDate', 'type' => 'text',     'label' => 'Effective date'],
        ['key' => 'intro',         'type' => 'textarea', 'label' => 'Lead paragraph'],
    ]],
    'nav' => ['title' => 'Navigation — Header Labels', 'fields' => [
        ['key' => 'home',             'type' => 'text', 'label' => '“Home” label'],
        ['key' => 'products',         'type' => 'text', 'label' => '“Products” menu label'],
        ['key' => 'company',          'type' => 'text', 'label' => '“Company” menu label'],
        ['key' => 'quoteButton',      'type' => 'text', 'label' => 'Quote button text'],
        ['key' => 'allProducts',      'type' => 'text', 'label' => 'Products menu — column heading'],
        ['key' => 'browseAll',        'type' => 'text', 'label' => 'Products menu — “Browse All” link'],
        ['key' => 'productIndex',     'type' => 'text', 'label' => 'Products menu — “Index” link'],
        ['key' => 'browseByCategory', 'type' => 'text', 'label' => 'Products menu — category heading'],
    ]],
    'footer' => ['title' => 'Footer — Labels', 'fields' => [
        ['key' => 'contactTitle',    'type' => 'text', 'label' => '“Contact” heading'],
        ['key' => 'quickLinksTitle', 'type' => 'text', 'label' => '“Quick Links” heading'],
        ['key' => 'domain',          'type' => 'text', 'label' => 'Domain shown in footer'],
    ]],
    'contactForm' => ['title' => 'Contact Page — Form', 'fields' => [
        ['key' => 'rfqTab',              'type' => 'text',     'label' => 'Quote tab — label'],
        ['key' => 'rfqTabSub',           'type' => 'text',     'label' => 'Quote tab — sub-text'],
        ['key' => 'msgTab',              'type' => 'text',     'label' => 'Message tab — label'],
        ['key' => 'msgTabSub',           'type' => 'text',     'label' => 'Message tab — sub-text'],
        ['key' => 'rfqHeading',          'type' => 'text',     'label' => 'Quote form — heading'],
        ['key' => 'rfqIntro',            'type' => 'textarea', 'label' => 'Quote form — intro'],
        ['key' => 'productDetailsTitle', 'type' => 'text',     'label' => 'Quote form — “Product Details” heading'],
        ['key' => 'partLabel',           'type' => 'text',     'label' => 'Field: Part number — label'],
        ['key' => 'partPlaceholder',     'type' => 'text',     'label' => 'Field: Part number — placeholder'],
        ['key' => 'materialLabel',       'type' => 'text',     'label' => 'Field: Material — label'],
        ['key' => 'materialPlaceholder', 'type' => 'text',     'label' => 'Field: Material — placeholder'],
        ['key' => 'quantityLabel',       'type' => 'text',     'label' => 'Field: Quantity — label'],
        ['key' => 'quantityPlaceholder', 'type' => 'text',     'label' => 'Field: Quantity — placeholder'],
        ['key' => 'dateLabel',           'type' => 'text',     'label' => 'Field: Required date — label'],
        ['key' => 'datePlaceholder',     'type' => 'text',     'label' => 'Field: Required date — placeholder'],
        ['key' => 'specialLabel',        'type' => 'text',     'label' => 'Field: Special requirements — label'],
        ['key' => 'specialPlaceholder',  'type' => 'textarea', 'label' => 'Field: Special requirements — placeholder'],
        ['key' => 'notesLabel',          'type' => 'text',     'label' => 'Field: Additional notes — label'],
        ['key' => 'notesPlaceholder',    'type' => 'textarea', 'label' => 'Field: Additional notes — placeholder'],
        ['key' => 'submitRfq',           'type' => 'text',     'label' => 'Quote form — submit button'],
        ['key' => 'msgHeading',          'type' => 'text',     'label' => 'Message form — heading'],
        ['key' => 'msgIntro',            'type' => 'textarea', 'label' => 'Message form — intro'],
        ['key' => 'subjectLabel',        'type' => 'text',     'label' => 'Field: Subject — label'],
        ['key' => 'subjectPlaceholder',  'type' => 'text',     'label' => 'Field: Subject — placeholder'],
        ['key' => 'messageLabel',        'type' => 'text',     'label' => 'Field: Message — label'],
        ['key' => 'messagePlaceholder',  'type' => 'textarea', 'label' => 'Field: Message — placeholder'],
        ['key' => 'submitMsg',           'type' => 'text',     'label' => 'Message form — submit button'],
        ['key' => 'sendingLabel',        'type' => 'text',     'label' => 'Submitting button text'],
        ['key' => 'rfqSuccessTitle',     'type' => 'text',     'label' => 'Success — quote banner title'],
        ['key' => 'msgSuccessTitle',     'type' => 'text',     'label' => 'Success — message banner title'],
        ['key' => 'successThanks',       'type' => 'text',     'label' => 'Success — “Thank you” heading'],
        ['key' => 'rfqSuccessBody',      'type' => 'textarea', 'label' => 'Success — quote body'],
        ['key' => 'msgSuccessBody',      'type' => 'textarea', 'label' => 'Success — message body'],
        ['key' => 'urgentPrefix',        'type' => 'text',     'label' => 'Success — “urgent inquiries” prefix'],
        ['key' => 'networkError',        'type' => 'textarea', 'label' => 'Error — network failure alert'],
        ['key' => 'submitError',         'type' => 'text',     'label' => 'Error — submission failed alert'],
        ['key' => 'nameLabel',           'type' => 'text',     'label' => 'Field: Name — label'],
        ['key' => 'namePlaceholder',     'type' => 'text',     'label' => 'Field: Name — placeholder'],
        ['key' => 'emailLabel',          'type' => 'text',     'label' => 'Field: Email — label'],
        ['key' => 'emailPlaceholder',    'type' => 'text',     'label' => 'Field: Email — placeholder'],
        ['key' => 'phoneLabel',          'type' => 'text',     'label' => 'Field: Phone — label'],
        ['key' => 'phonePlaceholder',    'type' => 'text',     'label' => 'Field: Phone — placeholder'],
        ['key' => 'companyLabel',        'type' => 'text',     'label' => 'Field: Company — label'],
        ['key' => 'companyPlaceholder',  'type' => 'text',     'label' => 'Field: Company — placeholder'],
        ['key' => 'tipsTitle',           'type' => 'text',     'label' => 'Sidebar tips — heading'],
    ]],
];

$errors = [];
$saved  = isset($_GET['saved']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $out = [];
    foreach ($SECTIONS as $sec => $cfg) {
        $rows  = $_POST[$sec] ?? [];
        $clean = [];
        if (is_array($rows)) {
            foreach ($rows as $row) {
                if (!is_array($row)) continue;
                $r = [];
                $hasText = false;
                foreach ($cfg['fields'] as $f) {
                    $raw = $row[$f['key']] ?? '';
                    if ($f['type'] === 'list') {
                        // Newline-separated textarea → array of trimmed, non-empty lines.
                        $arr = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string)$raw))));
                        $r[$f['key']] = $arr;
                        if (!empty($arr)) $hasText = true;
                        continue;
                    }
                    $v = trim((string)$raw);
                    if ($f['type'] === 'icon') {
                        if (!isset($cfg['icons'][$v])) $v = array_key_first($cfg['icons']);
                    } elseif ($f['type'] === 'page') {
                        $opts = $f['options'] ?? [];
                        if (!isset($opts[$v])) $v = (string)array_key_first($opts);
                    } elseif ($v !== '') {
                        $hasText = true;
                    }
                    $r[$f['key']] = $v;
                }
                // Fixed, non-editable field: keep the Industries cards linking correctly.
                if ($sec === 'markets') $r['page'] = 'industries';
                // Industries detail: "SKU | Display name" lines → {sku, label}
                // objects (the shape the React IndustriesPage renders).
                if ($sec === 'industryDetail') {
                    $prods = [];
                    foreach (($r['products'] ?? []) as $line) {
                        $parts = array_map('trim', explode('|', $line, 2));
                        if ($parts[0] === '') continue;
                        $prods[] = ['sku' => $parts[0], 'label' => $parts[1] ?? ''];
                    }
                    $r['products'] = $prods;
                }
                // Services: fold the two brochure fields into an optional object.
                if ($sec === 'services') {
                    $bu = trim((string)($r['brochure_url'] ?? ''));
                    $bl = trim((string)($r['brochure_label'] ?? ''));
                    unset($r['brochure_url'], $r['brochure_label']);
                    if ($bu !== '') $r['brochure'] = ['url' => $bu, 'label' => ($bl !== '' ? $bl : 'Download brochure')];
                }
                if ($hasText) $clean[] = $r; // drop fully-blank rows
            }
        }
        $out[$sec] = $clean;
    }

    // Fixed page copy — saved as a nested object under "copy".
    $copyOut = [];
    foreach ($COPY_GROUPS as $g => $gcfg) {
        $copyOut[$g] = [];
        foreach ($gcfg['fields'] as $f) {
            $v = trim((string)($_POST['copy'][$g][$f['key']] ?? ''));
            if ($f['type'] === 'page' && !isset($PAGE_OPTIONS[$v])) {
                $v = (string)array_key_first($PAGE_OPTIONS);
            }
            $copyOut[$g][$f['key']] = $v;
        }
    }
    $out['copy'] = $copyOut;

    if (empty($errors)) {
        if (save_content($out)) {
            audit_log('content', 'homepage', 'Homepage content updated');
            header('Location: content.php?saved=1');
            exit;
        }
        $errors[] = 'Failed to save content.json. Check file permissions on the data/ folder.';
    }
}

// Load current content for display (falls back to empty sections if the file
// is missing — the customer can rebuild from the Add buttons).
$content = load_content();

/** Render a single field control. Name is also set server-side (JS keeps it
 * numbered after edits) so the form still submits correctly before JS runs. */
function render_field(string $section, int $i, array $f, array $row): string {
    $key  = $f['key'];
    $raw  = $row[$key] ?? '';
    $val  = is_array($raw) ? $raw : (string)$raw;
    $name = $section . '[' . $i . '][' . $key . ']';
    $full = !empty($f['full']) ? ' full' : '';
    $out  = '<div class="form-group' . $full . '"><label>' . $f['label'] . '</label>';
    if ($f['type'] === 'icon') {
        $out .= '<select class="ci" data-field="' . h($key) . '" name="' . h($name) . '">';
        foreach ($f['icons'] as $ik => $il) {
            $out .= '<option value="' . h($ik) . '"' . ($val === $ik ? ' selected' : '') . '>' . h($il) . '</option>';
        }
        $out .= '</select>';
    } elseif ($f['type'] === 'page') {
        $out .= '<select class="ci" data-field="' . h($key) . '" name="' . h($name) . '">';
        foreach (($f['options'] ?? []) as $pk => $pl) {
            $out .= '<option value="' . h($pk) . '"' . ($val === $pk ? ' selected' : '') . '>' . h($pl) . '</option>';
        }
        $out .= '</select>';
    } elseif ($f['type'] === 'list') {
        $txt = is_array($val) ? implode("\n", $val) : (string)$val;
        $out .= '<textarea class="ci" rows="4" data-field="' . h($key) . '" name="' . h($name) . '" placeholder="One item per line">' . h($txt) . '</textarea>';
    } elseif ($f['type'] === 'textarea') {
        $out .= '<textarea class="ci" rows="2" data-field="' . h($key) . '" name="' . h($name) . '">' . h((string)$val) . '</textarea>';
    } else {
        $out .= '<input type="text" class="ci" data-field="' . h($key) . '" name="' . h($name) . '" value="' . h((string)$val) . '">';
    }
    return $out . '</div>';
}

/** Services store the brochure as a nested {url,label}; the editor exposes it as
 * two flat fields, so flatten it before rendering a services row. */
function prep_row(string $section, array $row): array {
    if ($section === 'services' && isset($row['brochure']) && is_array($row['brochure'])) {
        $row['brochure_url']   = $row['brochure']['url'] ?? '';
        $row['brochure_label'] = $row['brochure']['label'] ?? '';
    }
    // Industries detail stores products as {sku,label} objects; the editor
    // shows them as "SKU | Display name" lines.
    if ($section === 'industryDetail' && isset($row['products']) && is_array($row['products'])) {
        $lines = [];
        foreach ($row['products'] as $p) {
            if (is_array($p)) {
                $sku   = trim((string)($p['sku'] ?? ''));
                $label = trim((string)($p['label'] ?? ''));
                if ($sku !== '') $lines[] = $label !== '' ? $sku . ' | ' . $label : $sku;
            } elseif (is_string($p) && trim($p) !== '') {
                $lines[] = trim($p);
            }
        }
        $row['products'] = $lines;
    }
    return $row;
}

/** Render one editable row (used for existing rows and the clone template). */
function render_row(string $section, int $i, array $cfg, array $row): string {
    // Inject icon options into each icon field so render_field can see them.
    $fields = array_map(function ($f) use ($cfg) {
        if ($f['type'] === 'icon') $f['icons'] = $cfg['icons'];
        return $f;
    }, $cfg['fields']);
    $row = prep_row($section, $row);
    $out  = '<div class="content-row">';
    $out .= '<div class="row-head"><span class="row-num">#' . ($i + 1) . '</span>'
          . '<span class="row-tools">'
          . '<button type="button" class="rbtn" data-action="up" title="Move up">↑</button>'
          . '<button type="button" class="rbtn" data-action="down" title="Move down">↓</button>'
          . '<button type="button" class="rbtn danger" data-action="remove" title="Remove">✕</button>'
          . '</span></div>';
    $out .= '<div class="grid-2">';
    foreach ($fields as $f) $out .= render_field($section, $i, $f, $row);
    $out .= '</div></div>';
    return $out;
}

/** Render one fixed copy field (hero text, section headings, page banners).
 * These are fixed (not repeatable), so names are static — no JS involved. */
function render_copy_field(string $group, array $f, $val, array $pageOptions): string {
    $name = 'copy[' . $group . '][' . $f['key'] . ']';
    $v = (string)$val;
    $out = '<div class="form-group full"><label>' . h($f['label']) . '</label>';
    if ($f['type'] === 'page') {
        $out .= '<select class="ci" name="' . h($name) . '">';
        foreach ($pageOptions as $pk => $pl) {
            $out .= '<option value="' . h($pk) . '"' . ($v === $pk ? ' selected' : '') . '>' . h($pl) . '</option>';
        }
        $out .= '</select>';
    } elseif ($f['type'] === 'textarea') {
        $out .= '<textarea class="ci" rows="3" name="' . h($name) . '">' . h($v) . '</textarea>';
    } else {
        $out .= '<input type="text" class="ci" name="' . h($name) . '" value="' . h($v) . '">';
    }
    return $out . '</div>';
}

$navActive = 'content';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Page Content</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    main { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 24px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .card > .sub { margin-top: -8px; margin-bottom: 18px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin: 0 0 6px; padding-bottom: 8px; border-bottom: 1px solid #e5e9ee; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-group { margin-bottom: 0; }
    .form-group.full { grid-column: 1 / -1; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 5px; }
    input[type=text], textarea, select.ci { width: 100%; padding: 10px 12px; border: 1px solid #d1d9e0; border-radius: 7px; font-size: 13px; color: #141414; outline: none; font-family: inherit; background: #fff; }
    input[type=text]:focus, textarea:focus, select.ci:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.1); }
    textarea { resize: vertical; line-height: 1.5; }
    .content-row { border: 1px solid #e5e9ee; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; background: #fafcff; }
    .row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .row-num { font-size: 12px; font-weight: 800; color: #005da3; }
    .row-tools { display: flex; gap: 6px; }
    .rbtn { width: 28px; height: 28px; border: 1px solid #d1d9e0; background: #fff; border-radius: 6px; font-size: 13px; cursor: pointer; color: #374151; line-height: 1; }
    .rbtn:hover:not(:disabled) { background: #eef4fb; border-color: #005da3; }
    .rbtn:disabled { opacity: 0.35; cursor: default; }
    .rbtn.danger:hover:not(:disabled) { background: #fef2f2; border-color: #dc2626; color: #dc2626; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .error-list li { font-size: 13px; margin-bottom: 4px; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    .btn { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
    .btn-primary { background: #005da3; color: #fff; }
    .btn-primary:hover { background: #004e8c; }
    .btn-secondary { background: #fff; color: #141414; border: 1px solid #d1d9e0; }
    .save-bar { position: sticky; bottom: 0; background: #f0f4f8; padding: 16px 0; display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid #e5e9ee; }
    @media(max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main>
  <h1>Page Content</h1>
  <p class="sub">Edit the homepage sections below. Add, remove, or reorder items — changes go live within about a minute.</p>

  <?php if ($saved): ?><div class="alert-success">✅ Content saved. The website will reflect the changes within ~60 seconds.</div><?php endif; ?>
  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>

  <form method="POST">
    <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">

    <?php foreach ($COPY_GROUPS as $g => $gcfg): ?>
      <div class="card">
        <div class="card-title"><?= $gcfg['title'] ?></div>
        <div class="grid-2">
          <?php foreach ($gcfg['fields'] as $f) echo render_copy_field($g, $f, ($content['copy'][$g][$f['key']] ?? ''), $PAGE_OPTIONS); ?>
        </div>
      </div>
    <?php endforeach; ?>

    <?php foreach ($SECTIONS as $sec => $cfg):
        $rows = $content[$sec] ?? [];
        if (!is_array($rows)) $rows = [];
    ?>
      <div class="card" data-section="<?= h($sec) ?>">
        <div class="card-title"><?= $cfg['title'] ?></div>
        <p class="sub"><?= $cfg['sub'] ?></p>
        <div class="rows">
          <?php foreach ($rows as $i => $row) echo render_row($sec, (int)$i, $cfg, is_array($row) ? $row : []); ?>
        </div>
        <button type="button" class="btn btn-secondary" data-action="add" data-section="<?= h($sec) ?>">+ Add <?= h($cfg['addLabel']) ?></button>
        <template id="tpl-<?= h($sec) ?>"><?= render_row($sec, 0, $cfg, []) ?></template>
      </div>
    <?php endforeach; ?>

    <div class="save-bar">
      <a href="index.php" class="btn btn-secondary">Cancel</a>
      <button type="submit" class="btn btn-primary">Save Content</button>
    </div>
  </form>
</main>
<script src="content-editor.js"></script>
</body>
</html>
