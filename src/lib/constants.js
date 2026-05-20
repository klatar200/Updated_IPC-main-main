/**
 * Module-level static data and configuration.
 * Centralized to prevent recreation on every render.
 */

/**
 * Storage URL for the consolidated IPC product catalog.
 *
 * Reads from /data/products-all.json on the same origin. That file is
 * managed live by the PHP admin at /admin/ — edits there appear here as
 * soon as the 5-minute Apache cache (see /data/.htaccess) clears, or
 * immediately on a hard refresh.
 */
export const PRODUCTS_JSON_URL = "/data/products-all.json";

// Static company dropdown items — module level so they don't recreate on every Navbar render.
export const COMPANY_ITEMS = [
  {
    label: "Industries Served",
    sub: "Automotive, Aerospace, Medical…",
    page: "industries",
  },
  {
    label: "Value-Added Services",
    sub: "Cut · Mark · Spool · Kit",
    page: "services",
  },
  { label: "About IPC", sub: "History, certs & capabilities", page: "about" },
  { label: "Resources / FAQ", sub: "Common questions & answers", page: "faq" },
];

// Product family order for sidebar grouping and Navbar category list.
export const FAMILY_ORDER = [
  "Polyolefin Heat Shrink",
  "PVDF Heat Shrink",
  "Dual-Wall Heat Shrink",
  "Medical Grade Heat Shrink",
  "Elastomeric Heat Shrink",
  "Fiberglass Sleeving",
  "Expandable Sleeving",
  "End Cap",
  "Tape",
  "Adhesive",
  "Accessory",
];

// SKUs / part types to skip in sidebar / dashboard (placeholder rows).
export const SIDEBAR_EXCLUDED = new Set(["VALUE-ADDED", ""]);

// Module-level Set for ProductDetail related products exclusion.
export const NON_RELATABLE_TYPES = new Set(["Accessory", "Adhesive", "Tape", ""]);

// Dashboard column definitions — module-level so not recreated on every keystroke.
export const DASHBOARD_COLS = [
  { key: "name", label: "Product Name", width: null },
  { key: "partId", label: "Part ID", width: 100 },
  { key: "partType", label: "Part Type", width: 160 },
  { key: "description", label: "Description", width: null },
  { key: "operatingTemp", label: "Temp", width: 110 },
  { key: "specifications", label: "Specifications", width: 240 },
];

// Homepage market cards.
export const MKT_MARKETS = [
  {
    iconKey: "auto",
    label: "Automotive",
    desc: "PPAP & IMDS documentation available. Harness protection, connector sealing, diesel-resistant jacketing.",
    page: "industries",
  },
  {
    iconKey: "aero",
    label: "Aerospace & Defense",
    desc: "MIL-SPEC, AMS, QPL products in stock. PVDF, FEP, and PTFE tubing for avionics and high-temp compartments.",
    page: "industries",
  },
  {
    iconKey: "medical",
    label: "Medical Devices",
    desc: "USP Class VI · ISO 10993-5 · FDA 21 CFR. Cleanroom-bagged, alcohol-wiped, double-packaged on request.",
    page: "industries",
  },
  {
    iconKey: "industrial",
    label: "Industrial & OEM",
    desc: "Motor leads, transformer winding, heating elements. Fiberglass sleeving rated up to 1200°F in stock.",
    page: "industries",
  },
  {
    iconKey: "marine",
    label: "Marine & Outdoor",
    desc: "UV-rated PVC, dual-wall adhesive-lined tubing, and nonmetallic liquid-tight conduit fittings.",
    page: "industries",
  },
  {
    iconKey: "electronics",
    label: "Electronics & Lab",
    desc: "PTFE spaghetti tubing, thin-wall polyolefin, and Mylar high-dielectric for PCB and instrumentation work.",
    page: "industries",
  },
];

// Homepage Features section data.
export const FEATURES_DATA = [
  {
    iconKey: "heatshrink",
    title: "Heat Shrink Tubing",
    description:
      "Polyolefin (2:1 & 3:1), dual-wall adhesive-lined, PVDF/Kynar, neoprene, fluoroelastomer, and medical-grade. All RoHS compliant.",
  },
  {
    iconKey: "sleeving",
    title: "Electrical Sleeving",
    description:
      "Fiberglass sleeving — heat-treated, vinyl-coated (Class C), acrylic-coated (Class F), silicone-coated (Class H). Expandable polyester also stocked.",
  },
  {
    iconKey: "adhesives",
    title: "Adhesives & Accessories",
    description:
      "Industrial & cyanoacrylate adhesives, cable ties, insulating tape, heat guns, and heat-shrinkable end caps.",
  },
  {
    iconKey: "cut",
    title: "Custom Cut-to-Length",
    description:
      "Small or large volume precision cutting and spooling. Tight tolerances, clean environment. Typical turnaround: one week or less.",
  },
  {
    iconKey: "marking",
    title: "Marking & Kitting",
    description:
      "Custom labeling, bar code printing, wire & cable markers, slit lengthwise, perforations, bagging per spec, JIT services.",
  },
  {
    iconKey: "quality",
    title: "ISO 9001 Quality",
    description:
      "ISO 9001:2008 registered facility. Computerized equipment, documented processes, quality maintained from receiving through shipping.",
  },
];

// StatsBar data.
export const STATS_DATA = [
  {
    value: "50+",
    label: "Years in Business",
    sub: "Founded July 1, 1974",
    iconKey: "years",
  },
  {
    value: "25M+",
    label: "Feet in Stock",
    sub: "Ready to ship today",
    iconKey: "stock",
  },
  {
    value: "$50",
    label: "Minimum Order",
    sub: "No large MOQ required",
    iconKey: "dollar",
  },
  {
    value: "≤1 Day",
    label: "Shipment Available",
    sub: "On most stock items",
    iconKey: "ship",
  },
];

// AboutPage data.
export const ABOUT_CAPABILITIES = [
  { name: "Inside Sales Team", role: "Fast, accurate quote & order response", avatar: "🤝" },
  { name: "Technical Support", role: "Product selection, specs & cross-reference", avatar: "⚙️" },
  { name: "ISO Quality Team", role: "ISO 9001 in-process & final inspection", avatar: "🏅" },
  { name: "Fabrication Shop", role: "Cut · Mark · Spool · Kit in ≤ 1 week", avatar: "✂️" },
];

export const ABOUT_MILESTONES = [
  { year: "1974", label: "Founded", desc: "Insulation Products Corporation incorporated July 1, 1974 in Bolingbrook, Illinois." },
  { year: "1980s", label: "Expansion", desc: "Grew product line from basic vinyl tubing to full heat-shrinkable and extruded tubing catalog." },
  { year: "1990s", label: "ISO Certified", desc: "Achieved ISO 9001 registration, formalizing quality systems from receiving to shipping." },
  { year: "2000s", label: "Value-Added", desc: "Launched in-house fabrication services: cut-to-length, hot-stamp marking, kitting, and spooling." },
  { year: "2010s", label: "Remodel", desc: "State-of-the-art computerized facility and equipment update; expanded MIL-SPEC and medical-grade stocking." },
  { year: "2024", label: "50 Years", desc: "Celebrating 50 years as a trusted, independent stocking distributor. 25M+ feet in stock, $50 minimum order." },
];

// Note: ABOUT_CERTS contains JSX (CertIcon elements) so it must live alongside
// the icon components, not in this pure-data file. See pages/AboutPage.jsx.
