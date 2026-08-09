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
    'datasheets' => 'Datasheets',
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
    // PLAN-6 item 1. These eleven names used to be hardcoded in THREE places —
    // src/App.jsx's FAMILY_ORDER and a $partTypes literal in each of add.php
    // and edit.php — which agreed only by luck. This is now the only editable
    // copy; App.jsx keeps one as its fallback default and the two PHP literals
    // are gone.
    'productFamilies' => [
        'title'    => 'Product Families / Categories',
        'sub'      => 'The categories products are grouped under, in the order they appear in the catalogue sidebar and the Products menu. <strong>Renaming one does not rename the products in it</strong> — each product stores its own category, so a renamed family leaves its products under the old name until you re-save each of them. The count beside each row is how many products would be affected.',
        'addLabel' => 'Family',
        'icons'    => [],
        'fields'   => [
            ['key' => 'name', 'type' => 'text', 'label' => 'Family name', 'full' => true],
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
    'datasheetsHeader' => ['title' => 'Datasheets page — banner', 'fields' => [
        ['key' => 'eyebrow', 'type' => 'text',     'label' => 'Eyebrow'],
        ['key' => 'title',   'type' => 'text',     'label' => 'Title'],
        ['key' => 'intro',   'type' => 'textarea', 'label' => 'Intro paragraph'],
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
        ['key' => 'datasheets',       'type' => 'text', 'label' => 'Products menu — “Datasheets” link'],
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
        // C39. Both are new keys and both have a matching default in
        // COPY_DEFAULTS over in App.jsx — a key here with no default there is
        // a silent data-loss path with a green success banner on it, because
        // mergeContent iterates Object.keys(defaults). _harness/copydrift.js
        // enforces that and runs inside lint.php.
        //
        // NOTE: no apostrophes in comments inside this literal.
        // _harness/dump-copy-groups.php bracket-matches to the closing "];"
        // and skips string literals so a bracket in a label cannot unbalance
        // it — but it does not skip COMMENTS. A lone apostrophe therefore
        // opens a phantom string that swallows every following bracket, and
        // the whole copy-drift check dies with "unbalanced". Cost 10 minutes
        // the first time; write "the App.jsx side" rather than the possessive.
        ['key' => 'requiredLegend',      'type' => 'text',     'label' => 'Form — “* required” legend'],
        ['key' => 'privacyNote',         'type' => 'text',     'label' => 'Form — privacy note above submit (the Privacy Policy link is added automatically)'],
        ['key' => 'companyLabel',        'type' => 'text',     'label' => 'Field: Company — label'],
        ['key' => 'companyPlaceholder',  'type' => 'text',     'label' => 'Field: Company — placeholder'],
        ['key' => 'tipsTitle',           'type' => 'text',     'label' => 'Sidebar tips — heading'],
        // PLAN-6 item 3 — the auto-reply body. Prose only: the request summary
        // (part number, material, quantity, required-by) is built by
        // contact.php and is deliberately NOT editable, because a templating
        // syntax in a textarea is a way to produce broken emails.
        ['key' => 'autoReplyRfqPromise', 'type' => 'textarea', 'label' => 'Auto-reply — response promise (quote requests)'],
        ['key' => 'autoReplyMsgPromise', 'type' => 'textarea', 'label' => 'Auto-reply — response promise (messages)'],
        ['key' => 'autoReplyNotice',     'type' => 'textarea', 'label' => 'Auto-reply — temporary notice (optional, e.g. holiday closure). Leave empty for none.'],
    ]],
];

$errors = [];

// 4.12 — unmatched-product-code notices. These render alongside $errors but
// MUST NOT be appended to it: $errors gates save_content() at the bottom of the
// POST handler, and the owner's decision (WHATS_LEFT §3, 2026-08-06) is that an
// unmatched SKU warns and still saves, so Rick can add an industry card before
// the product exists. Keep the two arrays separate.
$warnings = [];

$saved  = isset($_GET['saved']);

// A successful save redirects to ?saved=1, which would swallow any warning that
// save produced — the one message this feature exists to show. Carry them over
// as a one-shot flash, unset on read.
if ($saved && !empty($_SESSION['content_warnings'])) {
    $warnings = (array)$_SESSION['content_warnings'];
    unset($_SESSION['content_warnings']);
}

// Optimistic-concurrency signature, same mechanism as edit.php:17-31 and
// settings.php. Two tabs open on this page used to clobber each other with no
// warning. (DEPLOY_READINESS_v2 T1.7)
$storedContent = load_content();
$storedSig     = sha1(json_encode($storedContent));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    // TRUNCATION GUARD (DEPLOY_READINESS_v2 T3.7).
    // This form posts 450+ input variables. PHP drops everything past
    // max_input_vars (default 1000) SILENTLY, and the old code rebuilt $out
    // from whatever arrived and still reported "Content saved" — a data-loss
    // bug waiting on one more FAQ entry. `form_complete` is rendered as the
    // LAST field in the form, so if PHP truncated the POST it is missing.
    // Do not move it, and do not add fields after it.
    $truncated = false;
    if (($_POST['form_complete'] ?? '') !== '1') {
        $truncated = true;
        $errors[] = 'This page did not submit completely — the server cut the request off partway through (PHP max_input_vars). NOTHING was saved. The entries that did arrive are still filled in below; anything the server never received has been restored from the saved version. Remove a few entries and save again, or ask your developer to raise max_input_vars in .user.ini.';
    }

    $submittedSig = $_POST['orig_sig'] ?? '';
    if ($submittedSig !== '' && $submittedSig !== $storedSig) {
        // Wording matters here: the form below now still holds what Rick typed
        // (see the repopulation block after this POST handler), so telling him to
        // "reload" would throw the very work this warning exists to protect.
        $errors[] = 'This page content was changed by another session (or another browser tab) since you opened this page. Your edits were NOT saved — but they are still filled in below, so nothing you typed is lost. Open the site in another tab to see what the other change was. Pressing Save again will keep what is on this page and overwrite that other change.';
    }

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
                        // as_str(), not (string)$raw — see NB12 above; an array
                        // here became a single list item reading "Array".
                        $arr = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', as_str($raw)))));
                        $r[$f['key']] = $arr;
                        if (!empty($arr)) $hasText = true;
                        continue;
                    }
                    // as_str(), not (string)$raw: an array here cast to the
                    // literal text "Array" and was SAVED under a green
                    // "✅ Content saved". (AUDIT_v3_FINDINGS NB12)
                    $v = as_str($raw);
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

    // ── 4.12: the Industries product codes are checked against the catalog ───
    // This field used to validate against NOTHING, while the help text above it
    // promises "the SKU must match a real product so the link works". A typo
    // shipped an industry card linking to a product page that does not exist,
    // and Rick got a green success banner.
    //
    // WARNS and still saves, by owner decision (WHATS_LEFT §3, 2026-08-06):
    // adding the card before the product is a legitimate order of work. That is
    // why this appends to $warnings and never to $errors.
    // product_reference_resolves() mirrors the site's three-tier lookup, NOT an
    // exact SKU match — see the comment on it in config.php. Exact matching
    // flagged 5 of the 18 shipped industry references as broken when all 18
    // resolve.
    $catalogProducts = load_products();
    // An unreadable or empty catalog must not flag every card on the page —
    // that would bury the real signal under 40 false warnings.
    if (!empty($catalogProducts)) {
        foreach (($out['industryDetail'] ?? []) as $row) {
            $industry = trim((string)($row['name'] ?? ''));
            if ($industry === '') $industry = 'an industry section';
            foreach (($row['products'] ?? []) as $prod) {
                $sku = trim((string)($prod['sku'] ?? ''));
                if ($sku === '' || product_reference_resolves($catalogProducts, $sku)) continue;
                $warnings[] = 'The product code “' . $sku . '” in “' . $industry . '” does not match any '
                    . 'product in your catalog, so that link will send visitors to a “product not found” page. '
                    . 'Check the spelling against the Products page, or add the product. '
                    . 'If you are adding this card before the product itself, you can ignore this.';
            }
        }
    }

    // Fixed page copy — saved as a nested object under "copy".
    $copyOut = [];
    foreach ($COPY_GROUPS as $g => $gcfg) {
        $copyOut[$g] = [];
        foreach ($gcfg['fields'] as $f) {
            $v = as_str($_POST['copy'][$g][$f['key']] ?? '');   // NB12, as above
            if ($f['type'] === 'page' && !isset($PAGE_OPTIONS[$v])) {
                $v = (string)array_key_first($PAGE_OPTIONS);
            }
            $copyOut[$g][$f['key']] = $v;
        }
    }
    $out['copy'] = $copyOut;

    if (empty($errors)) {
        if (save_content($out)) {
            audit_log('content', 'homepage', 'Homepage content updated'
                . (!empty($warnings) ? ' — ' . count($warnings) . ' unmatched product code(s)' : ''));
            // 4.12: survive the redirect. See the flash read near $saved.
            if (!empty($warnings)) $_SESSION['content_warnings'] = $warnings;
            header('Location: content.php?saved=1');
            exit;
        }
        $errors[] = 'Failed to save content.json. Check file permissions on the data/ folder.';
    }
}

// Load current content for display (falls back to empty sections if the file
// is missing — the customer can rebuild from the Add buttons).
$content = $storedContent;

// On an ERROR, repopulate from what was SUBMITTED, never from disk.
// This line used to run unconditionally, and all three error paths (stale
// orig_sig, the form_complete truncation guard, a save_content() failure) fell
// through it: Rick's 40 minutes of FAQ and About copy were replaced by the
// stored values, and the error page handed him a REFRESHED, VALID orig_sig — so
// the retry the message told him to make wrote the disk values back under a
// green "✅ Content saved". Silent, total, and reported as success.
// settings.php:134, edit.php:185 and add.php:79 all repopulate from $_POST;
// this page — the one holding the most irreplaceable typing — did not.
// (AUDIT_v3_FINDINGS B1)
//
// The truncation path is the exception: there $out is not a complete picture,
// because PHP dropped every variable past max_input_vars, so trailing sections
// arrive EMPTY rather than edited. Swapping straight to $out would blank the
// back half of the page and invite Rick to save that. Merge section-wise
// instead — keep whatever survived the POST, fall back to the stored copy for
// anything that never arrived. (A section he genuinely emptied in the same
// truncated POST reappears; nothing was saved either way, and showing rows that
// are still on disk is the safe direction to be wrong in.)
//
// Compare COUNTS, not emptiness. The cut does not fall tidily between sections:
// measured at max_input_vars=100 against this form's 423 variables, variable 101
// is features[0][iconKey], so `features` arrives with 1 of its 6 rows and every
// later section arrives with none. An `empty()` test restores the 15 sections
// that came back empty and silently leaves the straddling one 5 rows short, on a
// page whose whole job at that moment is to show Rick his work is still there.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($errors)) {
    $content = $out;
    if (!empty($truncated)) {
        foreach ($SECTIONS as $sec => $cfg) {
            if (count((array)($content[$sec] ?? [])) < count((array)($storedContent[$sec] ?? []))) {
                $content[$sec] = $storedContent[$sec];
            }
        }
        foreach ($COPY_GROUPS as $g => $gcfg) {
            foreach ($gcfg['fields'] as $f) {
                if (($content['copy'][$g][$f['key']] ?? '') === ''
                    && ($storedContent['copy'][$g][$f['key']] ?? '') !== '') {
                    $content['copy'][$g][$f['key']] = $storedContent['copy'][$g][$f['key']];
                }
            }
        }
    }
}

/**
 * A stable, unique DOM id for a control, derived from the same name the field
 * already posts under. Deriving it from the name (rather than a counter) is
 * what makes it survive reordering: content-editor.js renumbers names on every
 * structural change and recomputes the id with the identical rule. (4.31)
 */
function field_id(string $name): string {
    return 'f-' . trim((string)preg_replace('/[^A-Za-z0-9]+/', '-', $name), '-');
}

/**
 * Render a single field control. Name is also set server-side (JS keeps it
 * numbered after edits) so the form still submits correctly before JS runs.
 *
 * 4.31 — this page rendered 418 controls and 418 <label> elements, and not one
 * label carried `for` nor one control an `id`: visually labelled, and to a
 * screen reader 397 anonymous edit boxes (the other 21 were named by their
 * PLACEHOLDER, "One item per line", which is not a label). This is the page
 * holding the most irreplaceable typing on the site — the page B1 was about.
 *
 * The row context is appended INSIDE the label and visually hidden, rather than
 * set as an aria-label on the control. An aria-label would replace the visible
 * text, and WCAG 2.5.3 wants the accessible name to contain what is on screen;
 * this way "Icon" stays visible and the screen reader hears
 * "Icon — row 3 of Industries Grid", which is what makes 18 boxes all called
 * "Icon" distinguishable.
 *
 * Nothing here adds a POSTED variable: <label>, id and for do not post. That is
 * load-bearing — the max_input_vars truncation guard is built on that count.
 */
function render_field(string $section, int $i, array $f, array $row, string $sectionTitle = ''): string {
    $key  = $f['key'];
    $raw  = $row[$key] ?? '';
    $val  = is_array($raw) ? $raw : (string)$raw;
    $name = $section . '[' . $i . '][' . $key . ']';
    $id   = field_id($name);
    $full = !empty($f['full']) ? ' full' : '';
    $ctx  = '<span class="vh" data-rowctx> &#8212; row ' . ($i + 1)
          . ($sectionTitle !== '' ? ' of ' . h($sectionTitle) : '') . '</span>';
    $out  = '<div class="form-group' . $full . '"><label for="' . h($id) . '">' . $f['label'] . $ctx . '</label>';
    if ($f['type'] === 'icon') {
        $out .= '<select class="ci" id="' . h($id) . '" data-field="' . h($key) . '" name="' . h($name) . '">';
        foreach ($f['icons'] as $ik => $il) {
            $out .= '<option value="' . h($ik) . '"' . ($val === $ik ? ' selected' : '') . '>' . h($il) . '</option>';
        }
        $out .= '</select>';
    } elseif ($f['type'] === 'page') {
        $out .= '<select class="ci" id="' . h($id) . '" data-field="' . h($key) . '" name="' . h($name) . '">';
        foreach (($f['options'] ?? []) as $pk => $pl) {
            $out .= '<option value="' . h($pk) . '"' . ($val === $pk ? ' selected' : '') . '>' . h($pl) . '</option>';
        }
        $out .= '</select>';
    } elseif ($f['type'] === 'list') {
        $txt = is_array($val) ? implode("\n", $val) : (string)$val;
        $out .= '<textarea class="ci" id="' . h($id) . '" rows="4" data-field="' . h($key) . '" name="' . h($name) . '" placeholder="One item per line">' . h($txt) . '</textarea>';
    } elseif ($f['type'] === 'textarea') {
        $out .= '<textarea class="ci" id="' . h($id) . '" rows="2" data-field="' . h($key) . '" name="' . h($name) . '">' . h((string)$val) . '</textarea>';
    } else {
        $out .= '<input type="text" class="ci" id="' . h($id) . '" data-field="' . h($key) . '" name="' . h($name) . '" value="' . h((string)$val) . '">';
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
    $title = (string)($cfg['title'] ?? '');
    // PLAN-6 item 1 — how many products this family currently holds. Rendered
    // as an attribute as well as visible text so content-editor.js can warn
    // before a rename orphans them, and so the harness can assert the number
    // rather than the wording. Only meaningful for productFamilies; every other
    // section gets no attribute at all.
    $famAttr = '';
    $famBadge = '';
    if ($section === 'productFamilies') {
        $n = ipc_family_product_count((string)($row['name'] ?? ''));
        $famAttr = ' data-ipc-family-count="' . (int)$n . '"'
                 . ' data-ipc-family-name="' . h((string)($row['name'] ?? '')) . '"';
        $famBadge = '<span class="row-num" title="Products currently in this family">'
                  . (int)$n . ' product' . ($n === 1 ? '' : 's') . '</span>';
    }
    $out  = '<div class="content-row"' . $famAttr . '>';
    $out .= '<div class="row-head"><span class="row-num">#' . ($i + 1) . '</span>'
          . $famBadge
          . '<span class="row-tools">'
          . '<span class="row-move">'
          // Row identity in the name for the same reason as the field labels:
          // 18 buttons all called "Move up" tell a screen-reader user nothing
          // about which row they are on. content-editor.js rewrites these on
          // every reorder alongside the names and ids. (4.31)
          . '<button type="button" class="rbtn" data-action="up" title="Move up"'
          . ' aria-label="Move row ' . ($i + 1) . ' of ' . h($title) . ' up">↑</button>'
          . '<button type="button" class="rbtn" data-action="down" title="Move down"'
          . ' aria-label="Move row ' . ($i + 1) . ' of ' . h($title) . ' down">↓</button>'
          . '</span>'
          // 4.13 — this ✕ removes an entire card and used to sit 6px from ↓ with
          // no confirmation, while every other destructive admin action has one.
          // Rick reorders far more often than he deletes, on a touch-capable
          // laptop, and a mis-click during reordering did not announce itself.
          // The prompt names the row (see confirm.js's {it}); the spacing is in
          // .row-move / .rbtn.danger below.
          . '<button type="button" class="rbtn danger" data-action="remove" title="Remove"'
          . ' aria-label="Remove row ' . ($i + 1) . ' of ' . h($title) . '"'
          . ' data-confirm="Remove {it} from this page?&#10;&#10;The row disappears now and is deleted for good when you click “Save Content”. If you save by mistake, you can put it back from Backups."'
          . ' data-confirm-scope=".content-row"'
          . ' data-confirm-from="input.ci[type=text], textarea.ci">✕</button>'
          . '</span></div>';
    $out .= '<div class="grid-2">';
    foreach ($fields as $f) $out .= render_field($section, $i, $f, $row, $title);
    $out .= '</div></div>';
    return $out;
}

/**
 * How many catalogue products use this family name, counted from the LIVE
 * products file.
 *
 * Memoised because render_row() asks once per family row and load_products()
 * reads ~280 KB. Deliberately exact-match, not case-insensitive: the public
 * site groups on an exact string, so "tape" and "Tape" really are two families
 * there, and a count that pretended otherwise would under-report the orphans a
 * rename creates.
 */
function ipc_family_product_count(string $name): int {
    static $counts = null;
    if ($counts === null) {
        $counts = [];
        foreach (load_products() as $p) {
            $t = is_array($p) ? (string)($p['partType'] ?? '') : '';
            if ($t !== '') $counts[$t] = ($counts[$t] ?? 0) + 1;
        }
    }
    $name = trim($name);
    return $name === '' ? 0 : (int)($counts[$name] ?? 0);
}

/** Render one fixed copy field (hero text, section headings, page banners).
 * These are fixed (not repeatable), so names are static — no JS involved. */
function render_copy_field(string $group, array $f, $val, array $pageOptions, string $groupTitle = ''): string {
    $name = 'copy[' . $group . '][' . $f['key'] . ']';
    $id   = field_id($name);
    $v = (string)$val;
    // The group goes in the accessible name, not only in the <legend>. A legend
    // reaches the AX tree as the GROUP, which some screen-reader modes announce
    // on entry and a "list all form fields" view does not — and eight boxes all
    // called "Title" in that list is the same defect as eighteen called "Icon".
    // Measured: "TITLE" appeared 8 times before this. (4.31)
    $ctx = $groupTitle !== '' ? '<span class="vh"> &#8212; ' . $groupTitle . '</span>' : '';
    $out = '<div class="form-group full"><label for="' . h($id) . '">' . h($f['label']) . $ctx . '</label>';
    if ($f['type'] === 'page') {
        $out .= '<select class="ci" id="' . h($id) . '" name="' . h($name) . '">';
        foreach ($pageOptions as $pk => $pl) {
            $out .= '<option value="' . h($pk) . '"' . ($v === $pk ? ' selected' : '') . '>' . h($pl) . '</option>';
        }
        $out .= '</select>';
    } elseif ($f['type'] === 'textarea') {
        $out .= '<textarea class="ci" id="' . h($id) . '" rows="3" name="' . h($name) . '">' . h($v) . '</textarea>';
    } else {
        $out .= '<input type="text" class="ci" id="' . h($id) . '" name="' . h($name) . '" value="' . h($v) . '">';
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
    /* 4.31 — each section is now a <fieldset> so the grouping reaches the
       accessibility tree. A fieldset carries UA border/padding/min-width of its
       own; reset them so the card looks exactly as it did. min-width:0 matters:
       without it a fieldset refuses to shrink and the grid overflows. */
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 24px; margin-bottom: 20px; min-width: 0; }
    fieldset.card { display: block; }
    legend.card-title { display: block; width: 100%; float: left; }
    legend.card-title + * { clear: both; }
    /* Visually hidden, still announced. Carries the row identity appended to a
       repeated field label ("Icon — row 3 of Industries Grid"). */
    .vh { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
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
    .row-tools { display: flex; gap: 6px; align-items: center; }
    /* 4.13 — ↑/↓ are one visual group; ✕ is deliberately pushed away from them.
       The two used to be 6px apart, and the ✕ deletes the whole card while the
       arrows are the control Rick uses most. 28px of margin puts the measured
       edge-to-edge gap at 34px, comfortably over the 24px floor, at both 1440
       and 375. Do not collapse this back into a single evenly-spaced row. */
    .row-move { display: flex; gap: 6px; align-items: center; }
    .row-tools .rbtn.danger { margin-left: 28px; }
    .rbtn { width: 28px; height: 28px; border: 1px solid #d1d9e0; background: #fff; border-radius: 6px; font-size: 13px; cursor: pointer; color: #374151; line-height: 1; }
    /* On a touch device the 28px box is below the 44px minimum target, and
       these three controls sit side by side. Grow them where the pointer is
       coarse; the desktop density is unchanged. */
    @media (pointer: coarse) {
      .rbtn { width: 44px; height: 44px; font-size: 15px; }
      .row-tools .rbtn.danger { margin-left: 24px; }
    }
    .rbtn:hover:not(:disabled) { background: #eef4fb; border-color: #005da3; }
    .rbtn:disabled { opacity: 0.35; cursor: default; }
    .rbtn.danger:hover:not(:disabled) { background: #fef2f2; border-color: #dc2626; color: #dc2626; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .error-list li { font-size: 13px; margin-bottom: 4px; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    /* 4.12 — amber, distinct from the red .error-list (nothing was lost) and
       from the green banner it sits under. The left bar is what makes it read
       as a callout rather than more body copy. */
    .warn-list { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .warn-list strong { display: block; font-size: 13px; margin-bottom: 6px; }
    .warn-list ul { margin: 0; padding-left: 20px; }
    .warn-list li { font-size: 13px; margin-bottom: 4px; line-height: 1.5; }
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
  <?php /* 4.12: unmatched product codes. Deliberately BELOW the green "saved"
           banner — the save did happen, and the sequence "saved, but…" is the
           honest reading order. Amber, not red: nothing was lost. */ ?>
  <?php if (!empty($warnings)): ?>
    <div class="warn-list">
      <strong>⚠️ Check these product codes</strong>
      <ul><?php foreach ($warnings as $w): ?><li><?= h($w) ?></li><?php endforeach; ?></ul>
    </div>
  <?php endif; ?>

  <form method="POST">
    <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
    <input type="hidden" name="orig_sig" value="<?= h($storedSig) ?>">

    <?php foreach ($COPY_GROUPS as $g => $gcfg): ?>
      <fieldset class="card">
        <legend class="card-title"><?= $gcfg['title'] ?></legend>
        <div class="grid-2">
          <?php foreach ($gcfg['fields'] as $f) echo render_copy_field($g, $f, ($content['copy'][$g][$f['key']] ?? ''), $PAGE_OPTIONS, (string)($gcfg['title'] ?? '')); ?>
        </div>
      </fieldset>
    <?php endforeach; ?>

    <?php foreach ($SECTIONS as $sec => $cfg):
        $rows = $content[$sec] ?? [];
        if (!is_array($rows)) $rows = [];
        // PLAN-6 item 1 — seed the family editor with the list that is ACTUALLY
        // IN EFFECT when nothing is stored yet.
        //
        // Every other section can legitimately be empty. This one cannot: a
        // deployed content.json has no `productFamilies` key at all until the
        // first save, and `ipc_product_families()` falls back to the defaults,
        // so an unseeded form would show the owner ZERO rows while the site
        // renders eleven families — and invite him to retype the list he
        // already has. Measured on the real file before this was added: the
        // section rendered completely empty.
        if ($sec === 'productFamilies' && !$rows) {
            $rows = array_map(static fn($n) => ['name' => $n], ipc_product_families());
        }
    ?>
      <fieldset class="card" data-section="<?= h($sec) ?>" data-section-title="<?= h((string)($cfg['title'] ?? '')) ?>">
        <legend class="card-title"><?= $cfg['title'] ?></legend>
        <p class="sub"><?= $cfg['sub'] ?></p>
        <div class="rows">
          <?php foreach ($rows as $i => $row) echo render_row($sec, (int)$i, $cfg, is_array($row) ? $row : []); ?>
        </div>
        <button type="button" class="btn btn-secondary" data-action="add" data-section="<?= h($sec) ?>">+ Add <?= h($cfg['addLabel']) ?></button>
        <template id="tpl-<?= h($sec) ?>"><?= render_row($sec, 0, $cfg, []) ?></template>
      </fieldset>
    <?php endforeach; ?>

    <div class="save-bar">
      <a href="index.php" class="btn btn-secondary">Cancel</a>
      <button type="submit" class="btn btn-primary">Save Content</button>
    </div>
    <?php /* ─────────────────────────────────────────────────────────────────
             ANY NEW FIELD GOES ABOVE THIS LINE. NOTHING GOES BELOW IT.

             `form_complete` is the max_input_vars truncation sentinel and it is
             enforced POSITIONALLY: the guard at the top of this file (the
             $truncated block) only detects a cut-off POST because this is the
             LAST variable the browser sends. A field added after it arrives in
             the same truncated POST, PHP drops both, and the guard sees nothing
             — which is the DEPLOY_READINESS_v2 T3.7 incident restored: this form
             posts 450+ variables, PHP drops everything past max_input_vars
             SILENTLY, and the old code rebuilt $out from whatever arrived and
             still reported "Content saved". Data loss under a green banner.

             Do not replace the sentinel with a count-based scheme either. This
             one is proven by _harness/plan2-trunc.js against a real
             max_input_vars=100 server; a count is one more thing to keep in
             sync with the form.

             Asserted three ways: invariants.js INV6 (source order),
             _harness/plan2-formlast.js (the rendered DOM, which is what
             actually determines POST order), and plan2-trunc.js (the guard
             firing on a genuinely truncated request).
             ───────────────────────────────────────────────────────────────── */ ?>
    <input type="hidden" name="form_complete" value="1">
  </form>
</main>
<?php /* 4.13: confirm.js powers the ✕ delete prompt. It cancels by calling
         stopPropagation() from a CAPTURE-phase listener on document, and
         content-editor.js removes the row from a BUBBLE-phase listener — the
         capture phase always completes first, so "Cancel" reliably prevents the
         removal. That ordering comes from the event phases, not from the order
         of these two script tags. */ ?>
<script src="confirm.js"></script>
<script src="content-editor.js"></script>
<script src="unsaved.js" defer></script>
</body>
</html>
