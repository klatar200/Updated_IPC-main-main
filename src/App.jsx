import { useState, useEffect, useMemo, useRef, useId, useCallback, Component, createContext, useContext } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";

// ── OverAI global shims ──────────────────────────────────────
// These replace OverAI's useSearchParam and setSearchParam globals.
// "page" routing now uses real URL paths (/products, /contact, etc.);
// sub-page params (productId, family, etc.) stay as search params.

function pathnameToPage(pathname) {
  const seg = pathname.replace(/^\//, "").split("/")[0];
  return seg || null; // null → home
}

/**
 * A5 — does this path carry segments beyond the route name?
 *
 * `pathnameToPage` reads the FIRST segment only, so /products/CC/extra was
 * indistinguishable from /products: it rendered the catalog at 200 and
 * declared /products as its canonical. Every depth under every known route was
 * a soft duplicate, which is a much larger surface than the mistyped
 * single-segment URLs the audit sampled.
 *
 * No route uses a second segment. Option B was chosen in PLAN-8 §0, so product
 * detail stays at /products?productId= and there is no /products/:id to
 * protect. If Option A is ever revisited, THIS is the function that has to
 * learn about it — not a second copy of the rule somewhere else.
 */
function hasExtraSegments(pathname) {
  return String(pathname || "").split("/").filter(Boolean).length > 1;
}

function pageToPath(pageVal) {
  if (!pageVal || pageVal === "home") return "/";
  return `/${pageVal}`;
}

/**
 * Shim for OverAI's useSearchParam.
 * "page" key reads from URL pathname; all other keys read from the search string.
 */
function useSearchParam(key) {
  const location = useLocation();
  const [searchParams, setSearchParamsFn] = useSearchParams();

  if (key === "page") {
    const page = pathnameToPage(location.pathname);
    const setter = (val) => {
      const path = pageToPath(val);
      if (_navigateRef) _navigateRef(path);
      else window.history.pushState({}, "", path);
    };
    return [page, setter];
  }

  const value = searchParams.get(key) || null;
  // opts.replace=true swaps the current history entry instead of pushing a new
  // one. Required for "read the param, then strip it from the URL" cleanups:
  // pushing there traps the Back button, because going back re-enters the
  // effect and pushes again. (DEPLOY_READINESS_v2 T2.3)
  const setter = (val, opts) => {
    setSearchParamsFn(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val === null || val === undefined || val === "") next.delete(key);
        else next.set(key, String(val));
        return next;
      },
      { replace: !!(opts && opts.replace) },
    );
  };
  return [value, setter];
}

// Module-level refs wired up by useSetSearchParamRef() inside <App />.
let _setSearchParamsRef = null;
let _navigateRef = null;

function useSetSearchParamRef() {
  const [, setSearchParamsFn] = useSearchParams();
  const navigate = useNavigate();
  useEffect(() => {
    _navigateRef = navigate;
    _setSearchParamsRef = (updates) => {
      const { page: pageVal, ...rest } = updates;
      if (pageVal !== undefined) {
        // Navigate to the new page path, carrying any extra params in the search string.
        const path = pageToPath(pageVal);
        const nonEmpty = Object.fromEntries(
          Object.entries(rest).filter(([, v]) => v !== null && v !== undefined && v !== "")
        );
        const qs = new URLSearchParams(nonEmpty).toString();
        navigate(path + (qs ? `?${qs}` : ""), { replace: false });
      } else {
        setSearchParamsFn(
          (prev) => {
            const next = new URLSearchParams(prev);
            for (const [k, v] of Object.entries(rest)) {
              if (v === null || v === undefined || v === "") next.delete(k);
              else next.set(k, String(v));
            }
            return next;
          },
          { replace: false },
        );
      }
    };
    return () => {
      _setSearchParamsRef = null;
      _navigateRef = null;
    };
  }, [setSearchParamsFn, navigate]);
}

function setSearchParam(key, val) {
  if (key === "page") {
    const path = pageToPath(val);
    if (_navigateRef) _navigateRef(path);
    else window.history.pushState({}, "", path);
    return;
  }
  if (_setSearchParamsRef) {
    _setSearchParamsRef({ [key]: val });
  } else {
    const url = new URL(window.location.href);
    if (val === null || val === undefined || val === "")
      url.searchParams.delete(key);
    else url.searchParams.set(key, String(val));
    window.history.pushState({}, "", url.toString());
  }
}

// Batch updater — apply multiple param changes in a single navigation.
function setSearchParams(updates) {
  if (_setSearchParamsRef) {
    _setSearchParamsRef(updates);
  } else {
    const { page: pageVal, ...rest } = updates;
    const url = new URL(window.location.href);
    if (pageVal !== undefined) {
      const newUrl = new URL(pageToPath(pageVal), window.location.origin);
      for (const [k, v] of Object.entries(rest)) {
        if (v !== null && v !== undefined && v !== "") newUrl.searchParams.set(k, String(v));
      }
      window.history.pushState({}, "", newUrl.toString());
    } else {
      for (const [k, v] of Object.entries(rest)) {
        if (v === null || v === undefined || v === "") url.searchParams.delete(k);
        else url.searchParams.set(k, String(v));
      }
      window.history.pushState({}, "", url.toString());
    }
  }
}

// ── End of OverAI global shims ───────────────────────────────

// ── PageLink — the one crawlable navigation primitive ────────
// Every control that CHANGES THE PAGE renders through this. Before it, all
// navigation was <button onClick={() => nav(...)}> — 63 <button> against 15
// <a href> in this file — so a crawler found no internal link to follow and
// every page but the homepage was an orphan URL reachable only from the
// sitemap. Ctrl/Cmd-click, middle-click and "Copy Link Address" also did
// nothing, which on a catalog where buyers compare parts side by side is a
// real cost. (PLAN-1 4.21)
//
// Controls that do NOT change the page stay <button>: dropdown/accordion/menu
// toggles, form submits, the search box and its clear control, sort headers.
// An anchor needs a meaningful href; giving a toggle a fake one breaks its
// semantics for screen readers.

/**
 * The exact URL the router would produce for nav(pageVal, params).
 * Reuses pageToPath so an href can never drift from the real route and become
 * a crawlable 404 — which is worse than the button it replaced. The empty-value
 * filter mirrors _setSearchParamsRef's, so ?part= is omitted rather than blank.
 */
function pageHref(pageVal, params) {
  const path = pageToPath(pageVal);
  const nonEmpty = Object.entries(params || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  const qs = new URLSearchParams(Object.fromEntries(nonEmpty)).toString();
  return path + (qs ? `?${qs}` : "");
}

/**
 * C30 — scroll to an in-page anchor once the target actually exists.
 *
 * The browser's own fragment handling is useless in this app: the shell is one
 * HTML file and the section a fragment names does not exist until React has
 * rendered the route, so by the time `#industry-medical` is applied there is
 * nothing to scroll to. Retried across a few frames rather than a fixed
 * timeout, which either fires too early on a slow render or wastes time on a
 * fast one.
 *
 * Honours prefers-reduced-motion for the same reason B14 exists — a smooth
 * scroll is motion, and this one can be several thousand pixels.
 */
function scrollToAnchor(id, tries = 24) {
  if (typeof document === "undefined" || !id) return;
  const el = document.getElementById(id);
  if (el) {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    return;
  }
  if (tries > 0) window.requestAnimationFrame(() => scrollToAnchor(id, tries - 1));
}

function PageLink({ page = null, params, hash, onNavigate, onClick, children, ...rest }) {
  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;
    // Anything that is not a plain primary click belongs to the BROWSER.
    // Ctrl/Cmd-click, Shift-click, Alt-click and any non-primary button must
    // fall through and open a new tab / window / download exactly as on any
    // other link — so return WITHOUT preventDefault(). Swallowing these is the
    // failure mode that reintroduces 4.21 in a form that looks fixed.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;
    e.preventDefault();
    // ONE batched setSearchParams call, exactly as Navbar's nav() did. Two
    // separate calls lose updates, because react-router v6 reads `prev` from
    // the current URL each time. (DEPLOY_READINESS_v2 — see useSearchParam)
    setSearchParams({ ...(params || {}), page });
    // C30 — the fragment is written into the URL AFTER the route change, with
    // replaceState rather than by assigning location.hash. Assigning it would
    // push a second history entry for one click, so Back would need pressing
    // twice; and it asks the browser to scroll immediately, which does nothing
    // because the target has not rendered yet. scrollToAnchor waits for it.
    if (hash) {
      window.setTimeout(() => {
        const url = window.location.pathname + window.location.search + "#" + hash;
        window.history.replaceState(window.history.state, "", url);
        scrollToAnchor(hash);
      }, 0);
    }
    if (onNavigate) onNavigate();
  };
  return (
    <a href={pageHref(page, params) + (hash ? `#${hash}` : "")} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

/**
 * The small uppercase label above each page title.
 *
 * ONE component for all eight of them, because they were eight copies of the
 * same declaration and seven of them were wrong in the same way. The colour is
 * `--brand-header-ink` at FULL opacity, and both halves of that matter:
 *
 *   - `--brand-header-ink` (4.23) is recomputed per palette against the WORSE
 *     stop of `.ipc-page-header`'s gradient, so it is the only value here that
 *     stays readable when Rick picks a pale brand colour.
 *   - full opacity, because translucency gives that guarantee straight back.
 *     These were `rgba(var(--brand-header-ink-rgb), 0.7)`, which composites to
 *     rgb(179,208,228) over the navy header and measures **3.33-3.80:1** — an
 *     AA failure at 12px on every page. The eighth, on /products, had been set
 *     to `--brand-accent-text` by `brand-color-as-foreground`; that variable is
 *     solved for text on WHITE, and here it measured **1.04:1**. The accent is
 *     also one of this gradient's own stops, so painting the eyebrow in it is
 *     invisible-by-construction at the far end of the band.
 *
 * The eyebrow now matches the <h1> beside it. The hierarchy is carried by size
 * and weight, which is what was doing the work anyway.
 * `_harness/plan5c-eyebrow.js` scores every element in the header block on two
 * palettes and holds this at AA.
 */
/**
 * B14 — does the visitor ask for reduced motion?
 *
 * CSS alone cannot finish this job. `@media (prefers-reduced-motion: reduce)`
 * can stop the marquee animating, but the track is DUPLICATED 2x so that
 * translateX(-50%) loops seamlessly — so `animation: none` on its own leaves
 * every certification printed twice, side by side, with no explanation. And a
 * tab stop that exists only to pause an animation is pointless once there is
 * no animation, which CSS cannot remove either.
 *
 * Subscribed rather than read once: a visitor can turn the preference on in
 * the OS while the page is open, and this is exactly the audience for whom
 * "reload to apply" is the wrong answer.
 */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduced(e.matches);
    // addEventListener on a MediaQueryList is not in older Safari; addListener
    // is deprecated but is the only thing that works there.
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return reduced;
}

function PageEyebrow({ children }) {
  return (
    <div
      // A stable hook for the suites. plan5c-eyebrow and plan8-lead both need
      // to find the eyebrow, and matching on the Tailwind classes finds a
      // dozen unrelated small-caps labels instead. Same idea as
      // data-ipc-approval-mark.
      data-ipc-eyebrow
      className="text-xs font-bold tracking-widest uppercase mb-2"
      style={{ color: "var(--brand-header-ink)" }}
    >
      {children}
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────
// Catches render-time exceptions so a broken product record or bad JSON
// in specTable never blanks the entire site. Shows contact info instead.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { caught: false };
  }
  static getDerivedStateFromError() {
    return { caught: true };
  }
  render() {
    const site = this.context || SITE_DEFAULTS;
    if (this.state.caught) {
      return (
        <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", background: "#f5f7fa" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#141414", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 400, marginBottom: 24 }}>
            An unexpected error occurred. Please refresh the page, or contact us directly.
          </p>
          <div style={{ fontSize: 14, color: "var(--brand-primary-text)" }}>
            <a href={`tel:${site.contact.phoneDial}`} style={{ color: "var(--brand-primary-text)", display: "block", marginBottom: 6 }}>📞 {site.contact.phone}</a>
            <a href={`mailto:${site.contact.email}`} style={{ color: "var(--brand-primary-text)" }}>📧 {site.contact.email}</a>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 24, padding: "10px 24px", background: "var(--brand-primary)", color: "var(--brand-primary-ink)", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Fix 2: static company dropdown items at module level — no recreation on every Navbar render
const COMPANY_ITEMS = [
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

// Footer "Quick Links" — module scope so the content system can supply/override
// them. Each entry's page must be a real route; the admin picks from a fixed list.
const FOOTER_LINKS = [
  { label: "Product Catalog", page: "products" },
  { label: "About IPC", page: "about" },
  { label: "Product Index", page: "dashboard" },
  { label: "Datasheets", page: "datasheets" },
  { label: "Resources / FAQ", page: "faq" },
  { label: "Industries", page: "industries" },
  { label: "Contact", page: "contact" },
  { label: "Services", page: "services" },
  { label: "Privacy Policy", page: "privacy" },
];

/**
 * IPC Navbar — mega-dropdown architecture.
 *
 * Desktop (≥ 1024px):
 *   Home | Products ▾ | Company ▾ | [Request a Quote]
 *   Products mega-dropdown — left: Browse All / Product Index  |  right: live category list
 *   Company dropdown — Industries · Services · About · Resources
 *
 * Mobile (< 1024px):
 *   Logo + hamburger → drawer with accordion sections.
 *
 * Accepts { products } prop — categories derived live from the catalog.
 */
function Navbar({ products = [], catalogFailed = false }) {
  const site = useSiteInfo();
  const content = useContent();
  const { companyNav, copy } = content;
  const order = useMemo(() => familyOrder(content), [content]);
  const nc = copy.nav;
  const [page] = useSearchParam("page");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(null);

  const currentPage = page || "home";

  // Every navigational control here is a <PageLink>; the URL update lives in
  // PageLink (one batched setSearchParams call). This is the side effect the
  // old nav() also performed, handed to PageLink as onNavigate. (PLAN-1 4.21)
  const closeMenus = () => {
    setMenuOpen(false);
    setOpenDropdown(null);
    setMobileOpen(null);
  };

  /**
   * B13 — the mobile drawer becomes a real dialog.
   *
   * Measured at 390 before this, with the drawer open: `body { overflow:
   * visible }`, `window.scrollTo(0, 1400)` succeeded and took the page from
   * 600 to 1400 underneath it, focus never entered the drawer (5 of 14 Tab
   * presses landed inside, the rest walked the page behind), and Escape did
   * nothing. The drawer occupies the top ~340px, so everything below it stayed
   * live and reachable.
   *
   * The lock is `position: fixed` with a negative `top`, not `overflow:
   * hidden`. Overflow alone does not hold on iOS Safari, and it discards the
   * scroll offset — the page jumps to the top when the drawer closes, which
   * PLAN-8 calls out specifically. Fixed + negative top preserves the offset
   * and the cleanup scrolls back to it. Note the consequence for anything
   * measuring this: while open, `window.scrollY` reads 0 because the document
   * has collapsed.
   *
   * The trap is a keydown listener rather than an inert/focus-guard sandwich
   * because the drawer is a sibling of the page content, not an overlay root,
   * and `inert` would have to be applied to everything else on the page.
   */
  const drawerRef = useRef(null);
  const burgerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const y = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const focusables = () => {
      const root = drawerRef.current;
      if (!root) return [];
      return [...root.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
      )].filter((el) => el.getClientRects().length);
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        // Focus goes back to the control that opened it, or the visitor is
        // dropped at the top of the document with no idea where they are.
        if (burgerRef.current) burgerRef.current.focus({ preventScroll: true });
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const root = drawerRef.current;
      if (root && !root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKey);

    // After paint, or the drawer's children are not mounted yet.
    // preventScroll on every focus() in here: the drawer is already on screen,
    // so nothing needs scrolling into view, and a focus that scrolls the
    // documentElement while <body> is position:fixed is a hard thing to reason
    // about later. Hygiene rather than a fix — it was added while chasing a
    // restore discrepancy that turned out to be the test harness's own click
    // scrolling the page before the drawer ever opened.
    const t = window.setTimeout(() => {
      const items = focusables();
      if (items.length) items[0].focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, y);
    };
  }, [menuOpen]);

  // Derive unique, sorted product categories from live catalog.
  // Ordered by the OWNER's family list (PLAN-6 item 1), read through
  // familyOrder() so an empty list falls back instead of losing the order.
  const categories = useMemo(() => {
    // CR-2 fix: reuse SIDEBAR_EXCLUDED (module-level) — single source of truth
    const seen = new Set();
    for (const p of products) {
      if (!SIDEBAR_EXCLUDED.has(p.sku || "") && p.partType)
        seen.add(p.partType);
    }
    // Sort by the configured order first, then append anything unlisted — a
    // product whose family the owner removed must still be reachable.
    const result = order.filter((f) => seen.has(f));
    for (const f of seen) {
      if (!result.includes(f)) result.push(f);
    }
    return result;
  }, [products, order]);

  // Fix 2: companyItems is static — reference module-level COMPANY_ITEMS constant

  const groupActive = (pages) => pages.includes(currentPage);

  // Fix 1: inline bar styles directly — avoids object creation in JSX on every render
  const barBase = {
    display: "block",
    width: 22,
    height: 2,
    background: "#ffffff",
    borderRadius: 1,
    transition: "transform 0.2s, opacity 0.2s",
  };

  return (
    <header
      style={{
        background: "var(--brand-dark)",
        borderBottom: "1px solid rgba(0,190,242,0.15)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
      onMouseLeave={() => setOpenDropdown(null)}
    >
      {/* ── Main bar ── */}
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo — SVG mark matching the real IPC circular logo */}
        <PageLink
          page={null}
          onNavigate={closeMenus}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
          aria-label="Insulation Products Corporation — Home"
        >
          {/* C43 — alt="", not a better description.
              The audit is right that alt="IPC logo" was wrong, but the fix is
              not to name the destination here: the <a> above already carries
              aria-label="Insulation Products Corporation — Home", and an
              aria-label on the link overrides the image's alt for the
              accessible name. Naming it again would give a screen-reader user
              the same phrase twice. An image inside an already-named link is
              decorative by definition.
              Same reasoning at the other two: the footer mark sits beside the
              company name in text, and the product placeholder sits above the
              SKU. The logo ARTWORK problem — an opaque near-white rectangle
              across the full artboard, so it reads as a clipped square on the
              navy bar — is not a code fix and is owner action 9. */}
          <img
            src={site.theme?.logoUrl || "/logo.svg"}
            alt=""
            width={46}
            height={46}
            style={{ flexShrink: 0, display: "block" }}
          />
          {/* Full name — visible on sm+ */}
          <div className="hidden sm:block" style={{ textAlign: "left" }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                lineHeight: 1.2,
                color: "var(--brand-dark-ink)",
                letterSpacing: "0.01em",
              }}
            >
              INSULATION PRODUCTS
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                lineHeight: 1.2,
                color: "var(--brand-dark-ink)",
              }}
            >
              CORPORATION
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--brand-accent-on-dark)",
                marginTop: 1,
                letterSpacing: "0.02em",
              }}
            >
              {/* No `||` fallback: slogan is clearable in Business Details, and a
                   hardcoded default here would silently un-do the deletion. An
                   absent site-info.json still gets the default from
                   mergeSiteInfo. (AUDIT_v3_FINDINGS NB4) */}
              {site.company.slogan}
            </div>
          </div>
        </PageLink>

        {/* ── Desktop nav ── */}
        <nav
          className="hidden lg:flex"
          style={{
            alignItems: "stretch",
            height: 64,
            gap: 0,
            position: "relative",
          }}
        >
          {/* Home */}
          <PageLink
            page={null}
            onNavigate={closeMenus}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 20px",
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              color:
                currentPage === "home" ? "var(--brand-dark-ink)" : "rgba(var(--brand-dark-ink-rgb), 0.6)",
              borderBottom:
                currentPage === "home"
                  ? "2px solid var(--brand-accent)"
                  : "2px solid transparent",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (currentPage !== "home")
                e.currentTarget.style.color = "#ffffff";
              setOpenDropdown(null);
            }}
            onMouseLeave={(e) => {
              if (currentPage !== "home")
                e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            }}
          >
            {nc.home}
          </PageLink>

          {/* ── Products dropdown trigger ── */}
          {(() => {
            const prodPages = ["products", "dashboard"];
            const active = groupActive(prodPages);
            const open = openDropdown === "products";
            return (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={open}
                  onMouseEnter={() => setOpenDropdown("products")}
                  onClick={() => setOpenDropdown(open ? null : "products")}
                  onKeyDown={(e) => {
                    // Mouse-only bindings locked keyboard users out of the
                    // ENTIRE category list and the Browse All / Product Index
                    // links: Enter, Space and ArrowDown all did nothing.
                    // (DEPLOY_READINESS_v2 T2.4)
                    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                      e.preventDefault();
                      setOpenDropdown(open ? null : "products");
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setOpenDropdown("products");
                    } else if (e.key === "Escape") {
                      setOpenDropdown(null);
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 20px",
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    color: active || open ? "var(--brand-dark-ink)" : "rgba(var(--brand-dark-ink-rgb), 0.6)",
                    borderBottom: active
                      ? "2px solid var(--brand-accent)"
                      : open
                        ? "2px solid rgba(0,190,242,0.4)"
                        : "2px solid transparent",
                    transition: "color 0.15s",
                  }}
                >
                  {nc.products}
                  <span
                    style={{
                      fontSize: 9,
                      opacity: 0.7,
                      transition: "transform 0.2s",
                      transform: open ? "rotate(180deg)" : "none",
                      display: "inline-block",
                    }}
                  >
                    ▼
                  </span>
                </button>

                {/* ── Products MEGA-DROPDOWN ── */}
                {open && (
                  <div
                    className="ipc-dropdown-panel"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 1px)",
                      left: 0,
                      marginLeft: "-230px",
                      background: "#0e2847",
                      borderRadius: 12,
                      border: "1px solid rgba(0,190,242,0.2)",
                      boxShadow: "0 20px 48px rgba(0,20,60,0.55)",
                      zIndex: 100,
                      width: 560,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                    }}
                    onMouseEnter={() => setOpenDropdown("products")}
                  >
                    {/* Triangle pointer — matches #0e2847 panel background */}
                    <div
                      style={{
                        position: "absolute",
                        top: -6,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 12,
                        height: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          background: "#0e2847",
                          border: "1px solid rgba(0,190,242,0.2)",
                          transform: "rotate(45deg)",
                          margin: "3px auto 0",
                        }}
                      />
                    </div>

                    {/* Left column — Browse All + Index */}
                    <div
                      style={{
                        padding: "16px 0",
                        borderRight: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.3)",
                          padding: "0 20px 8px",
                        }}
                      >
                        {nc.allProducts}
                      </div>
                      {[
                        {
                          label: nc.browseAll,
                          sub: "Full catalog with specifications",
                          p: "products",
                          params: {},
                        },
                        {
                          label: nc.productIndex,
                          sub: "Searchable table with filter & sort",
                          p: "dashboard",
                          params: {},
                        },
                        // Deliberately here and not only in the footer's Quick
                        // Links: those come from content.json, and mergeContent
                        // gives a stored non-empty array priority over the
                        // default (invariant 3). A deployed content.json
                        // already holds the owner's own 8 rows, so adding a
                        // 9th to FOOTER_LINKS reaches a fresh install and
                        // nothing else. This entry is structural, so the page
                        // is reachable on day one whatever the owner has saved.
                        {
                          label: nc.datasheets,
                          sub: "Every product's PDF, grouped by family",
                          p: "datasheets",
                          params: {},
                        },
                      ].map((item) => {
                        const itemActive = currentPage === item.p;
                        return (
                          <PageLink
                            key={item.p}
                            page={item.p}
                            params={item.params}
                            onNavigate={closeMenus}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 20px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              borderLeft: itemActive
                                ? "3px solid var(--brand-accent)"
                                : "3px solid transparent",
                              paddingLeft: itemActive ? 17 : 20,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "rgba(255,255,255,0.05)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: itemActive ? "var(--brand-accent)" : "#ffffff",
                                lineHeight: 1.3,
                              }}
                            >
                              {item.label}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.4)",
                                marginTop: 2,
                              }}
                            >
                              {item.sub}
                            </span>
                          </PageLink>
                        );
                      })}
                    </div>

                    {/* Right column — live product categories */}
                    <div style={{ padding: "16px 0" }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.3)",
                          padding: "0 20px 8px",
                        }}
                      >
                        {nc.browseByCategory}
                      </div>
                      {/* "Loading…" was shown forever when the catalog fetch
                          FAILED, because this only tested for an empty list.
                          After the 12s abort there is nothing more to wait for,
                          so say so and give a way through.
                          (AUDIT_v3_FINDINGS NB18) */}
                      {categories.length === 0 ? (
                        <div
                          style={{
                            padding: "8px 20px",
                            fontSize: 12,
                            color: "rgba(255,255,255,0.3)",
                          }}
                        >
                          {catalogFailed ? (
                            <>
                              Categories unavailable —{" "}
                              <button
                                type="button"
                                onClick={() => window.location.reload()}
                                style={{
                                  color: "rgba(255,255,255,0.6)",
                                  textDecoration: "underline",
                                  background: "none",
                                  border: 0,
                                  padding: 0,
                                  font: "inherit",
                                  cursor: "pointer",
                                }}
                              >
                                reload
                              </button>
                            </>
                          ) : (
                            "Loading…"
                          )}
                        </div>
                      ) : (
                        categories.map((cat) => (
                          // Navigate to dashboard with family param — DashboardPage reads it on mount
                          <PageLink
                            key={cat}
                            page="dashboard"
                            params={{ family: cat }}
                            onNavigate={closeMenus}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 20px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "rgba(255,255,255,0.05)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: "var(--brand-primary)",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "rgba(var(--brand-primary-ink-rgb), 0.75)",
                              }}
                            >
                              {cat}
                            </span>
                          </PageLink>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Company dropdown trigger ── */}
          {(() => {
            const compPages = ["industries", "services", "about", "faq"];
            const active = groupActive(compPages);
            const open = openDropdown === "company";
            return (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={open}
                  onMouseEnter={() => setOpenDropdown("company")}
                  onClick={() => setOpenDropdown(open ? null : "company")}
                  onKeyDown={(e) => {
                    // Mouse-only bindings locked keyboard users out of the
                    // ENTIRE category list and the Browse All / Product Index
                    // links: Enter, Space and ArrowDown all did nothing.
                    // (DEPLOY_READINESS_v2 T2.4)
                    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                      e.preventDefault();
                      setOpenDropdown(open ? null : "company");
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setOpenDropdown("company");
                    } else if (e.key === "Escape") {
                      setOpenDropdown(null);
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 20px",
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    color: active || open ? "var(--brand-dark-ink)" : "rgba(var(--brand-dark-ink-rgb), 0.6)",
                    borderBottom: active
                      ? "2px solid var(--brand-accent)"
                      : open
                        ? "2px solid rgba(0,190,242,0.4)"
                        : "2px solid transparent",
                    transition: "color 0.15s",
                  }}
                >
                  {nc.company}
                  <span
                    style={{
                      fontSize: 9,
                      opacity: 0.7,
                      transition: "transform 0.2s",
                      transform: open ? "rotate(180deg)" : "none",
                      display: "inline-block",
                    }}
                  >
                    ▼
                  </span>
                </button>

                {open && (
                  <div
                    className="ipc-dropdown-panel"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 1px)",
                      left: 0,
                      marginLeft: "-90px",
                      width: 280,
                      background: "#0e2847",
                      borderRadius: 12,
                      border: "1px solid rgba(0,190,242,0.2)",
                      boxShadow: "0 20px 48px rgba(0,20,60,0.55)",
                      padding: "8px 0",
                      zIndex: 100,
                    }}
                    onMouseEnter={() => setOpenDropdown("company")}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: -6,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 12,
                        height: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          background: "#0e2847",
                          border: "1px solid rgba(0,190,242,0.2)",
                          transform: "rotate(45deg)",
                          margin: "3px auto 0",
                        }}
                      />
                    </div>
                    {companyNav.map((item, i) => {
                      const itemActive = currentPage === item.page;
                      return (
                        <PageLink
                          key={`${i}-${item.page}`}
                          page={item.page}
                          onNavigate={closeMenus}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            width: "100%",
                            textAlign: "left",
                            padding: "11px 20px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            borderLeft: itemActive
                              ? "3px solid var(--brand-accent)"
                              : "3px solid transparent",
                            paddingLeft: itemActive ? 17 : 20,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "rgba(255,255,255,0.06)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "none";
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: itemActive ? "var(--brand-accent)" : "#ffffff",
                              lineHeight: 1.3,
                            }}
                          >
                            {item.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.45)",
                              marginTop: 2,
                              lineHeight: 1.3,
                            }}
                          >
                            {item.sub}
                          </span>
                        </PageLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </nav>

        {/* ── Desktop CTA ── */}
        <div
          className="hidden lg:flex"
          style={{ alignItems: "center", gap: 10 }}
        >
          <PageLink
            page="contact"
            onNavigate={closeMenus}
            style={{
              // <button> defaults to inline-block; <a> to inline. Restated here
              // and at every other converted call site whose original relied on
              // the button default. (PLAN-1 4.21 styling risk)
              display: "inline-block",
              fontSize: 13,
              fontWeight: 600,
              // The navbar's quote CTA. Its background is --brand-primary, so
              // the label follows that ink — not the navbar's --brand-dark one,
              // and not a hardcoded white. (brand-ink-translucent)
              color: "var(--brand-primary-ink)",
              background: "var(--brand-primary)",
              border: "none",
              cursor: "pointer",
              padding: "10px 22px",
              borderRadius: 6,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--brand-primary-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand-primary)")}
          >
            {nc.quoteButton}
          </PageLink>
        </div>

        {/* ── Hamburger (mobile only) ── */}
        <button
          ref={burgerRef}
          className="lg:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 10,
            width: 44,
            height: 44,
          }}
        >
          {/* Inner wrapper owns the flex layout so the outer button stays display-free for lg:hidden */}
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
              width: "100%",
              height: "100%",
            }}
          >
            <span
              style={{
                ...barBase,
                transform: menuOpen ? "translateY(8px) rotate(45deg)" : "none",
              }}
            />
            <span style={{ ...barBase, opacity: menuOpen ? 0 : 1 }} />
            <span
              style={{
                ...barBase,
                transform: menuOpen
                  ? "translateY(-8px) rotate(-45deg)"
                  : "none",
              }}
            />
          </span>
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <>
          {/* Backdrop — tap outside to close */}
          <div
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 64,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.35)",
              zIndex: 49,
            }}
          />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          style={{
            background: "#0a2444",
            borderTop: "1px solid rgba(0,190,242,0.12)",
            maxHeight: "calc(100vh - 64px)",
            overflowY: "auto",
            position: "relative",
            zIndex: 50,
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              padding: "8px 24px 16px",
            }}
          >
            {/* Home */}
            <PageLink
              page={null}
              onNavigate={closeMenus}
              style={{
                display: "flex",
                width: "100%",
                textAlign: "left",
                padding: "13px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                color:
                  currentPage === "home" ? "#ffffff" : "rgba(255,255,255,0.65)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                borderLeft:
                  currentPage === "home"
                    ? "3px solid var(--brand-accent)"
                    : "3px solid transparent",
                paddingLeft: currentPage === "home" ? 13 : 0,
              }}
            >
              {nc.home}
            </PageLink>

            {/* Products accordion */}
            <div>
              <button
                onClick={() =>
                  setMobileOpen(mobileOpen === "products" ? null : "products")
                }
                style={{
                  display: "flex",
                  width: "100%",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "13px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  color: groupActive(["products", "dashboard"])
                    ? "#ffffff"
                    : "rgba(255,255,255,0.65)",
                  borderBottom:
                    mobileOpen === "products"
                      ? "none"
                      : "1px solid rgba(255,255,255,0.06)",
                  borderLeft: groupActive(["products", "dashboard"])
                    ? "3px solid var(--brand-accent)"
                    : "3px solid transparent",
                  paddingLeft: 16,
                }}
              >
                <span>{nc.products}</span>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.6,
                    transform:
                      mobileOpen === "products" ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    display: "inline-block",
                    marginRight: 4,
                  }}
                >
                  ▼
                </span>
              </button>
              {mobileOpen === "products" && (
                <div
                  style={{
                    paddingBottom: 6,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Static links */}
                  {[
                    { label: nc.browseAll, p: "products", params: {} },
                    { label: nc.productIndex, p: "dashboard", params: {} },
                    { label: nc.datasheets, p: "datasheets", params: {} },
                  ].map((item) => (
                    <PageLink
                      key={item.p}
                      page={item.p}
                      params={item.params}
                      onNavigate={closeMenus}
                      className="ipc-tap"
                      style={{
                        display: "flex",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 0 10px 20px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        borderLeft:
                          currentPage === item.p
                            ? "2px solid var(--brand-accent)"
                            : "2px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: currentPage === item.p ? "var(--brand-accent)" : "#ffffff",
                        }}
                      >
                        {item.label}
                      </span>
                    </PageLink>
                  ))}
                  {/* Category separator */}
                  {categories.length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.3)",
                          padding: "10px 20px 4px",
                        }}
                      >
                        By Category
                      </div>
                      {categories.map((cat) => (
                        <PageLink
                          key={cat}
                          page="dashboard"
                          params={{ family: cat }}
                          onNavigate={closeMenus}
                          className="ipc-tap"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 0 8px 20px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            borderLeft: "2px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: "var(--brand-primary)",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "rgba(var(--brand-primary-ink-rgb), 0.70)",
                            }}
                          >
                            {cat}
                          </span>
                        </PageLink>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Company accordion */}
            <div>
              <button
                onClick={() =>
                  setMobileOpen(mobileOpen === "company" ? null : "company")
                }
                style={{
                  display: "flex",
                  width: "100%",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "13px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  color: groupActive(["industries", "services", "about", "faq"])
                    ? "var(--brand-dark-ink)"
                    : "rgba(var(--brand-dark-ink-rgb), 0.65)",
                  borderBottom:
                    mobileOpen === "company"
                      ? "none"
                      : "1px solid rgba(255,255,255,0.06)",
                  borderLeft: groupActive([
                    "industries",
                    "services",
                    "about",
                    "faq",
                  ])
                    ? "3px solid var(--brand-accent)"
                    : "3px solid transparent",
                  paddingLeft: 16,
                }}
              >
                <span>{nc.company}</span>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.6,
                    transform:
                      mobileOpen === "company" ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    display: "inline-block",
                    marginRight: 4,
                  }}
                >
                  ▼
                </span>
              </button>
              {mobileOpen === "company" && (
                <div
                  style={{
                    paddingBottom: 6,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {companyNav.map((item, i) => (
                    <PageLink
                      key={`${i}-${item.page}`}
                      page={item.page}
                      onNavigate={closeMenus}
                      className="ipc-tap"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 0 10px 20px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        borderLeft:
                          currentPage === item.page
                            ? "2px solid var(--brand-accent)"
                            : "2px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            currentPage === item.page ? "var(--brand-accent)" : "var(--brand-dark-ink)",
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "rgba(var(--brand-dark-ink-rgb), 0.40)",
                          marginTop: 1,
                        }}
                      >
                        {item.sub}
                      </span>
                    </PageLink>
                  ))}
                </div>
              )}
            </div>

            {/* Contact */}
            <PageLink
              page="contact"
              onNavigate={closeMenus}
              style={{
                display: "flex",
                width: "100%",
                textAlign: "left",
                padding: "13px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                color:
                  currentPage === "contact"
                    ? "var(--brand-dark-ink)"
                    : "rgba(var(--brand-dark-ink-rgb), 0.65)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                borderLeft:
                  currentPage === "contact"
                    ? "3px solid var(--brand-accent)"
                    : "3px solid transparent",
                paddingLeft: 16,
              }}
            >
              Contact
            </PageLink>

            {/* CTA */}
            <PageLink
              page="contact"
              onNavigate={closeMenus}
              style={{
                // display/textAlign restate the <button> defaults this full-width
                // control relied on; an <a> is inline and left-aligned.
                display: "block",
                textAlign: "center",
                marginTop: 12,
                width: "100%",
                padding: "13px 0",
                background: "var(--brand-primary)",
                color: "var(--brand-primary-ink)",
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {nc.quoteButton}
            </PageLink>
          </div>
        </div>
        </>
      )}
    </header>
  );
}

/**
 * IPC Hero — Story & Proof treatment.
 * Headline: stocking identity + lead time + customization.
 * Proof cards: verified dossier data ($50 MOQ, 25M+ ft, same-day, ISO).
 * Trust rail: infinite horizontal marquee carousel of certification badges.
 */
const HERO_PROOF = [
    { stat: "$50", label: "Minimum Order", sub: "No large MOQ required" },
    { stat: "25M+", label: "Feet in Stock", sub: "Ready to ship today" },
    { stat: "Same Day", label: "Shipment Available", sub: "On in-stock items" },
    {
      stat: "ISO 9001",
      label: "Registered Quality",
      sub: "Every order, every time",
    },
];

// Trust rail items — duplicated to create seamless infinite loop
const HERO_TRUST = [
    // A2 — the revision is deliberately absent. The 2008 revision was withdrawn
    // in September 2018 and the site claimed it in three places; site-info.json
    // says only "ISO 9001", so the version was typed into the copy by hand.
    // Writing ":2015" because it is the current standard would invent a
    // certification claim for a supplier to aerospace, medical and automotive.
    // The live strings are owner-editable in Page Content and are on the owner
    // action list pending confirmation from the registrar.
    "ISO 9001 Registered",
    "Full RoHS Compliant Product Line",
    "UL · CSA · MIL-SPEC · AMS Rated Products",
    "PPAP & IMDS Documentation Available",
    "Custom Cut · Hot-Stamp Mark · Spool & Kit",
    "JIT Delivery Programs Available",
    "Made in USA Since 1974",
    "$50 Minimum Order",
    "25M+ Feet in Stock",
    "Same-Day Shipment Available",
];

function Hero() {
  const { copy, heroProofPoints, heroTrust } = useContent();
  const c = copy.hero;
  const proofPoints = heroProofPoints;
  const trustItems = heroTrust.map((t) => t.text);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(20,20,20,0.72) 0%, rgba(20,20,20,0.50) 100%), linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent-2) 55%, var(--brand-accent) 100%)",
      }}
    >
      <div
        className="absolute right-0 top-0 h-full w-1/2 opacity-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 80% 40%, var(--brand-accent) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left — value proposition */}
        <div>
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase mb-6 px-3 py-1.5 rounded"
            style={{
              background: "rgba(0,190,242,0.15)",
              color: "var(--brand-accent)",
              border: "1px solid rgba(0,190,242,0.3)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--brand-accent)",
                display: "inline-block",
              }}
            />
            {c.badge}
          </div>
          <h1
            className="font-extrabold leading-tight mb-6"
            style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", color: "#ffffff" }}
          >
            {c.headlineLine1}
            <br />
            <span style={{ color: "var(--brand-accent)" }}>{c.headlineAccent}</span>
            <br />
            {c.headlineLine3}
          </h1>
          <p
            className="text-base leading-relaxed mb-8 max-w-lg"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            {c.subhead}
          </p>
          <div className="flex flex-wrap gap-3">
            <PageLink
              page={c.ctaPrimaryPage}
              className="text-sm font-semibold px-6 py-3 rounded transition-all duration-150 hover:brightness-110 hover:shadow-lg"
              style={{
                display: "inline-block",
                background: "var(--brand-primary)",
                color: "var(--brand-primary-ink)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {c.ctaPrimaryLabel}
            </PageLink>
            <PageLink
              page={c.ctaSecondaryPage}
              className="text-sm font-semibold px-6 py-3 rounded transition-colors duration-150 border border-white/40 hover:border-white/80"
              style={{
                display: "inline-block",
                background: "transparent",
                color: "var(--brand-primary-ink)",
                cursor: "pointer",
              }}
            >
              {c.ctaSecondaryLabel}
            </PageLink>
          </div>
        </div>

        {/* Right — proof cards: 2×2 grid on desktop, stacked 2×2 with tighter padding on mobile */}
        <div className="grid grid-cols-2 gap-3">
          {proofPoints.map((p, i) => (
            <div
              key={`${i}-${p.label}`}
              className="rounded-xl"
              style={{
                padding: "clamp(12px, 2vw, 20px)",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderLeft: "3px solid var(--brand-accent)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="font-extrabold leading-none mb-1"
                style={{
                  fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                  color: "var(--brand-accent)",
                }}
              >
                {p.stat}
              </div>
              <div
                className="font-semibold"
                style={{
                  fontSize: "clamp(11px, 1.5vw, 14px)",
                  color: "var(--brand-dark-ink)",
                  marginBottom: 2,
                }}
              >
                {p.label}
              </div>
              <div
                style={{
                  fontSize: "clamp(10px, 1.2vw, 12px)",
                  color: "rgba(var(--brand-dark-ink-rgb), 0.5)",
                }}
              >
                {p.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom trust rail — infinite horizontal marquee */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Fade edges left and right */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 'clamp(20px, 6vw, 80px)',
              zIndex: 2,
              background:
                "linear-gradient(to right, rgba(0,0,0,0.3), transparent)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 'clamp(20px, 6vw, 80px)',
              zIndex: 2,
              background:
                "linear-gradient(to left, rgba(0,0,0,0.3), transparent)",
              pointerEvents: "none",
            }}
          />

          {/* Marquee track — items duplicated to create seamless loop.
              B14: under `prefers-reduced-motion: reduce` the duplicate is NOT
              rendered and the tab stop goes away.
              The duplicate exists only so translateX(-50%) can wrap without a
              visible seam. Stop the animation and it stops being a mechanism
              and becomes a bug: every certification printed twice, in a row,
              for no reason a reader could infer. `animation: none` alone —
              the obvious CSS-only fix — produces exactly that.
              The tabIndex exists only so a keyboard user can pause the scroll
              via :focus-within. With nothing scrolling it is a tab stop that
              does nothing and announces nothing, so it is dropped in that mode
              rather than left as furniture. */}
          {/* C50 — a named group, not an unlabelled tab stop.
              This was a bare <div tabIndex={0}> 5,012px wide with no role and
              no name, so a screen reader announced the entire certification
              strip as one anonymous blob and a keyboard user hit a stop that
              said nothing about why it existed. The tabIndex is deliberate —
              :focus-within pauses the scroll — so the capability stays and
              gains a name that explains it. Under reduce there is no animation
              to pause, so B14 drops the tab stop entirely and the role goes
              with it; a group with nothing to operate is furniture. */}
          <div
            className={reducedMotion ? "ipc-marquee-track ipc-marquee-static" : "ipc-marquee-track"}
            {...(reducedMotion
              ? {}
              : {
                  tabIndex: 0,
                  role: "group",
                  "aria-label": "Certifications and standards — focus to pause the scrolling",
                })}
            style={{ padding: "14px 0" }}
          >
            {(reducedMotion ? trustItems : [...trustItems, ...trustItems]).map((item, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1.5 flex-shrink-0"
                style={{
                  color: "rgba(var(--brand-dark-ink-rgb), 0.60)",
                  fontSize: 12,
                  fontWeight: 500,
                  paddingRight: 48,
                }}
              >
                <span style={{ color: "var(--brand-accent)", fontSize: 14, flexShrink: 0 }}>
                  ✓
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * IPC product/service capability card — JS-driven hover for border/shadow transitions.
 * Inline styles take CSS specificity priority over Tailwind, so border and boxShadow
 * are driven by onMouseEnter/Leave handlers. Inner text uses .fc-title class for
 * JS-driven color transition. The icon background uses .fc-icon class similarly.
 */
// The whole card is one navigational control, so the card itself is the anchor
// — a nested <a> would be invalid and only the inner text would be crawlable.
// `flex` in the className supplies the display an <a> lacks. (PLAN-1 4.21)
function FeatureCard({ icon, title, description, page }) {
  return (
    <PageLink
      page={page}
      className="flex gap-5 p-6 rounded-xl cursor-pointer transition-all duration-200"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e9ee",
        boxShadow: "0 1px 4px rgba(var(--brand-primary-rgb),0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--brand-primary)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(var(--brand-primary-rgb),0.12)";
        e.currentTarget.style.transform = "translateY(-2px)";
        const iconEl = e.currentTarget.querySelector(".fc-icon");
        if (iconEl) {
          iconEl.style.background = "rgba(var(--brand-primary-rgb),0.12)";
          iconEl.style.borderColor = "var(--brand-primary)";
        }
        const titleEl = e.currentTarget.querySelector(".fc-title");
        if (titleEl) titleEl.style.color = "var(--brand-primary-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e9ee";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(var(--brand-primary-rgb),0.05)";
        e.currentTarget.style.transform = "";
        const iconEl = e.currentTarget.querySelector(".fc-icon");
        if (iconEl) {
          iconEl.style.background = "rgba(var(--brand-primary-rgb),0.07)";
          iconEl.style.borderColor = "transparent";
        }
        const titleEl = e.currentTarget.querySelector(".fc-title");
        if (titleEl) titleEl.style.color = "#141414";
      }}
    >
      {/* Icon — JS-driven hover (inline styles win over Tailwind; no group-hover needed) */}
      <div
        className="fc-icon flex-shrink-0 flex items-center justify-center rounded-lg"
        style={{
          width: 48,
          height: 48,
          background: "rgba(var(--brand-primary-rgb),0.07)",
          color: "var(--brand-primary-text)",
          border: "1px solid transparent",
          transition: "background 0.2s, border-color 0.2s",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3
          className="fc-title"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#141414",
            marginBottom: 6,
            lineHeight: 1.3,
            transition: "color 0.2s",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "#6b7280",
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>
    </PageLink>
  );
}

/**
 * Reusable section header — consistent eyebrow + h2 + optional subtitle across all pages.
 * eyebrow: small all-caps label in var(--brand-primary)
 * title: bold h2 in #141414
 * subtitle: optional muted paragraph
 * action: optional { label, page, params } for a right-aligned CTA. It is a
 *   navigational control, so it renders as a PageLink, not a button. (4.21)
 */
function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
      <div>
        {eyebrow && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--brand-primary-text)",
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            fontSize: "clamp(1.6rem, 3vw, 2rem)",
            fontWeight: 800,
            color: "#141414",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              marginTop: 10,
              fontSize: 14,
              color: "#6b7280",
              maxWidth: 520,
              lineHeight: 1.6,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <PageLink
          page={action.page}
          params={action.params}
          className="transition-colors duration-150 hover:bg-blue-700"
          style={{
            display: "inline-block",
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--brand-primary-ink)",
            background: "var(--brand-primary)",
            border: "none",
            cursor: "pointer",
            padding: "10px 20px",
            borderRadius: 6,
          }}
        >
          {action.label}
        </PageLink>
      )}
    </div>
  );
}

// M-4 fix: FEATURES_ICONS map at module level — stable references, no object recreation on every render
const FEATURES_ICONS = {
  heatshrink: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  sleeving: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="8" y2="18" />
      <line x1="12" y1="6" x2="12" y2="18" />
      <line x1="16" y1="6" x2="16" y2="18" />
      <rect x="5" y="4" width="14" height="16" rx="2" />
    </svg>
  ),
  adhesives: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
    </svg>
  ),
  cut: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  marking: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  quality: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

const FEATURES_DATA = [
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
      // A2 — revision deliberately absent; see the homepage trust-bar default.
      "ISO 9001 registered facility. Computerized equipment, documented processes, quality maintained from receiving through shipping.",
  },
];

/**
 * IPC Products & Services section — SVG icons at module level, two-column grid, CTA ribbon.
 */
function Features() {
  const { features, copy } = useContent();
  const c = copy.homeFeatures;
  return (
    <section className="py-20 px-6" style={{ background: "#f5f7fa" }}>
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow={c.eyebrow}
          title={c.title}
          action={{ label: "View Full Catalog →", page: "products" }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <FeatureCard
              key={`${i}-${f.title}`}
              icon={
                <div style={{ color: "var(--brand-primary-text)" }}>
                  {FEATURES_ICONS[f.iconKey]}
                </div>
              }
              title={f.title}
              description={f.description}
              page="products"
            />
          ))}
        </div>
        <div
          className="mt-12 rounded-xl px-8 py-6 flex flex-wrap gap-6 items-center justify-between"
          style={{ background: "var(--brand-dark)" }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "rgba(var(--brand-dark-ink-rgb), 0.9)" }}
          >
            {c.ctaText}
          </p>
          <PageLink
            page="contact"
            className="text-sm font-semibold px-5 py-2.5 rounded transition-all duration-150 hover:brightness-110 flex-shrink-0"
            style={{
              display: "inline-block",
              background: "var(--brand-primary)",
              color: "var(--brand-primary-ink)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {c.ctaButton}
          </PageLink>
        </div>
      </div>
    </section>
  );
}

// Fix 13: StatsBar SVG icons at module level — stable, not recreated every render
const STATS_ICONS = {
  years: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  stock: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  dollar: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  ship: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2" />
      <circle cx="9" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  ),
};

const STATS_DATA = [
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

/**
 * IPC Trust & Proof rail — verified company stats with SVG icons.
 * Borders: right border via inline style per cell; bottom border via ipc-stat-bottom-border CSS class.
 * Fix 13: dead divide-x divide-gray-200 Tailwind classes removed (don't work on CSS grid, borders handled separately).
 */
function StatsBar() {
  const { stats } = useContent();
  return (
    <section className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={`${i}-${s.label}`}
            className={`py-5 px-4 md:py-7 md:px-6 flex items-center gap-4
              ${i < 2 ? "ipc-stat-bottom-border" : ""}
              ${i % 2 === 0 ? "border-r border-gray-200" : ""}
              ${i === 1 ? "md:border-r md:border-gray-200" : ""}
              ${i === 3 ? "border-r-0" : ""}
            `}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-lg bg-blue-50"
              style={{ width: 44, height: 44 }}
            >
              {STATS_ICONS[s.iconKey]}
            </div>
            <div>
              <div
                className="font-extrabold leading-tight"
                style={{ fontSize: 20, color: "var(--brand-primary-text)" }}
              >
                {s.value}
              </div>
              <div
                className="text-xs font-semibold mt-0.5"
                style={{ color: "#141414" }}
              >
                {s.label}
              </div>
              {/* B9 — an inline token, not the utility class.
                  This was the ONLY gray-400 on the site expressed as a Tailwind
                  class rather than a hex, so replacing the 16 literal
                  occurrences left these four homepage stat sub-lines behind at
                  2.54:1 — "Founded July 1, 1974" and its three neighbours.
                  The measurement caught it; a grep for the hex would not
                  have. */}
              <div className="text-xs mt-0.5" style={{ color: "#4b5563" }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// M-5 fix: Market card SVG icons at module level — stable references, no recreation on every render
const MktIcons = {
  auto: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  aero: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  medical: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  industrial: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  marine: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17l9-9 9 9" />
      <path d="M3 17h18" />
      <path d="M12 3v5" />
    </svg>
  ),
  electronics: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
};

const MKT_MARKETS = [
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

/**
 * IPC Homepage — Hero → Trust Rail → Products & Services → Markets → Quote CTA.
 * Phase 5: Real IPC application copy per market. SVG icons and data at module level (M-5 fix).
 */
/**
 * The datasheet index.
 *
 * Every product carries a published PDF and, before this page, the only way to
 * reach one was to already be on that product's detail page. Nothing indexed
 * them and the sitemap did not know they existed, so 8 MB of the most
 * search-worthy content on the site was invisible — people search
 * "IP33PO datasheet" before they search for a supplier.
 *
 * Deliberately ungated: no form, no email address. Gating datasheets optimises
 * for lead volume at the cost of lead quality, which is the wrong trade for a
 * spec-grade distributor.
 *
 * The `data-ipc-family` attribute is what `_harness/plan7-datasheets.js`
 * asserts the grouping against — it must stay on the group heading.
 */
/**
 * The approval vocabulary, and how a product's approvals are read.
 *
 * Certifications used to live only in free text. Measured 2026-08-07: 112
 * distinct badge strings across 42 products, ~20 carrying an approval in 20
 * different spellings ("U/L CSA", "U/L CSA MIL-Spec.", "U/L CSA and MIL-SPEC",
 * "U/L, MIL-Spec.", "UL & CSA Approved"). Nothing could count, filter or list
 * them — and the badge field UNDERSTATED the catalogue: reading the whole
 * record takes MIL-SPEC from 5 to 12 products, UL VW-1 from 1 to 11, and
 * products with at least one approval from 23 to 30.
 *
 * This list is duplicated in admin/config.php (IPC_APPROVALS). PHP and JS
 * cannot share a constant without a build step — the same situation as
 * FAMILY_ORDER — so `_harness/lint.php` fails on name drift and
 * `_harness/plan7-approvals.js` compares what each side DERIVES for all 42
 * products. Behaviour is what has to agree; regex spelling does not.
 *
 * Word boundaries are load-bearing: two real badge strings are "Ultra Clear"
 * and "Encapsulating", both of which contain "ul", and a naive /ul/i reports
 * both as UL approvals. That is also why deriving is a MIGRATION BRIDGE and
 * not the design — structured facts cannot be recovered from prose reliably,
 * and a page that tries is wrong in ways nobody notices.
 */
const APPROVALS = [
  // The second alternative is the REVERSED phrasing, spelled out in full:
  // CT's spec table reads "Recognized under the Components program of
  // Underwriters' Laboratories File No. E129972". `UL … Recognized` never
  // matched it, so before PLAN-8 A1 the only thing saying anything about UL on
  // that page was the header chip row — which called it "UL Listed", the wrong
  // category. Removing that row would have left a genuinely UL-Recognized
  // product claiming nothing at all, so the fact is recovered here instead.
  // Measured over all 42: CT is the only product this moves.
  // Mirrored in admin/config.php IPC_APPROVAL_PATTERNS — plan7-approvals.js
  // compares what PHP and JS DERIVE for every product, so the two must agree.
  ["UL Recognized", /\bU\/?L\b[^.;]{0,18}\bRecognized\b|\bRecognized\b[^.;]{0,60}\bUnderwriters'?\s+Laborator(?:y|ies)\b/i],
  ["UL Listed",     /\bU\/?L\b[^.;]{0,18}\bListed\b/i],
  ["UL Approved",   /\bU\/?L\b[^.;]{0,18}\bApproved\b/i],
  ["cUL",           /\bCUL\b/i],
  ["CSA",           /\bCSA\b/i],
  ["MIL-SPEC",      /\bMIL[\s-]?SPEC\b|\bAMS\b/i],
  ["RoHS",          /\bRoHS\b/i],
  ["FDA",           /\b(?:US)?FDA\b/i],
  ["USP Class VI",  /\bUSP\b[^.;]{0,12}\bClass\s*VI\b/i],
  ["ISO 10993-5",   /\bISO\s?10993/i],
  ["UL VW-1",       /\bVW-?1\b/i],
  ["UL-94",         /\bUL-?94\b/i],
];
const APPROVAL_NAMES = APPROVALS.map(([n]) => n);

/**
 * A product's approvals: the stored field if the product HAS one, otherwise
 * derived from its text.
 *
 * The test is `Array.isArray`, never truthiness. A product whose owner
 * unticked every box stores `approvals: []` and that means "no approvals" —
 * re-deriving there would resurrect exactly what he removed. Invariant 3's
 * lesson applied to a new field; the first draft of this feature read
 * `Array.isArray(p.approvals) && p.approvals.length` and had the bug.
 */
function productApprovals(p) {
  if (p && Array.isArray(p.approvals)) {
    // Whitelist on read too — a hand-edited catalogue must not put an unknown
    // string into a filter chip.
    return APPROVAL_NAMES.filter((n) => p.approvals.includes(n));
  }
  const hay = [
    (p.badges || []).join(" | "),
    p.specificationsSummary || "",
    Array.isArray(p.description) ? p.description.join(" ") : String(p.description || ""),
    JSON.stringify(p.specTable1 || {}),
  ].join(" | ");
  return APPROVALS.filter(([, rx]) => rx.test(hay)).map(([n]) => n);
}

/**
 * Is this badge string a STANDARD, i.e. already said by the approvals block?
 *
 * PLAN-8 C32. "Product Features" printed the raw `badges` array verbatim, and
 * the approvals block printed the derived vocabulary, so a product carrying
 * "UL Listed" or "Mil-Spec" as a badge said it twice in two different
 * spellings — measured on CC90, CCS and IP13SP. Features now carries only what
 * is NOT a standard, and the approvals block is the one place a certification
 * is stated.
 *
 * It reuses the APPROVALS regexes rather than matching on the approval NAMES:
 * the owner writes "U/L RECOGNIZED", "Mil-Spec." and "U/L VW-1", none of which
 * equals its normalised name. The word boundaries in those regexes are what
 * make this safe to run over free prose — "Ultra Clear" and "Encapsulating"
 * are both real badge strings containing "ul" (see the APPROVALS comment).
 */
function isStandardBadge(badge) {
  return APPROVALS.some(([, rx]) => rx.test(String(badge || "")));
}

/** The small monospace approval marks used on cards and the detail page. */
function ApprovalMarks({ product, tone = "#4b5563" }) {
  const list = productApprovals(product);
  if (!list.length) return null;
  return (
    <span
      data-ipc-approval-mark
      style={{
        display: "block",
        font: "10px ui-monospace, SFMono-Regular, Menlo, monospace",
        color: tone,
        marginTop: 5,
        letterSpacing: "0.02em",
      }}
    >
      {list.join(" · ")}
    </span>
  );
}

/**
 * Approval filter for the Product Index.
 *
 * The only search on the site before this was a text box matching part ID,
 * type and description — you had to already know what you were looking for.
 * This is the first control that answers a REQUIREMENT. Chips intersect,
 * because a buyer who needs UL *and* MIL-SPEC needs both.
 */
function ApprovalFilter({ products, selected, onToggle, onClear }) {
  const { counts, covered } = useMemo(() => {
    const t = {};
    let c = 0;
    for (const p of products) {
      const list = productApprovals(p);
      if (list.length) c++;
      for (const n of list) t[n] = (t[n] || 0) + 1;
    }
    return {
      counts: APPROVAL_NAMES.map((n) => ({ label: n, count: t[n] || 0 })).filter((x) => x.count > 0),
      covered: c,
    };
  }, [products]);

  if (!counts.length) return null;

  return (
    <div
      className="rounded-lg mb-4"
      style={{ border: "1px solid #e5e9ee", background: "#ffffff", padding: "14px 16px" }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <span
          style={{
            font: "10px ui-monospace, SFMono-Regular, Menlo, monospace",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--brand-accent-text)",
          }}
        >
          Filter by approval
        </span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {covered} of {products.length} products carry at least one
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {counts.map((c) => {
          const active = selected.includes(c.label);
          return (
            <button
              key={c.label}
              type="button"
              data-ipc-approval={c.label}
              onClick={() => onToggle(c.label)}
              aria-pressed={active}
              className="rounded transition-colors duration-150"
              style={{
                font: "600 11px ui-monospace, SFMono-Regular, Menlo, monospace",
                letterSpacing: "0.04em",
                padding: "5px 10px",
                cursor: "pointer",
                border: active ? "1px solid var(--brand-primary)" : "1px solid #d1d9e0",
                background: active ? "var(--brand-primary)" : "#ffffff",
                color: active ? "var(--brand-primary-ink)" : "#374151",
              }}
            >
              {c.label}
              <span style={{ opacity: 0.65, marginLeft: 6 }}>{c.count}</span>
            </button>
          );
        })}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            style={{
              font: "600 11px system-ui, sans-serif",
              color: "var(--brand-primary-text)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px 8px",
            }}
          >
            ✕ Clear approvals
          </button>
        )}
      </div>
    </div>
  );
}

function DatasheetsPage({ products }) {
  const [q, setQ] = useState("");
  const { copy } = useContent();
  const c = copy.datasheetsHeader;

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const g = {};
    for (const p of products) {
      if (!p.pdfUrl) continue;
      if (needle) {
        const hay = `${p.sku || ""} ${p.name || ""} ${p.partType || ""} ${(p.badges || []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      (g[p.partType || "Other"] ||= []).push(p);
    }
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => String(a.sku || "").localeCompare(String(b.sku || "")));
    }
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [products, q]);

  const total = useMemo(() => products.filter((p) => p.pdfUrl).length, [products]);

  // Published for _harness/plan7-approvals.js, which diffs this against what
  // admin/config.php derives for the same 42 products. Two implementations of
  // one rule agree only until one of them is fixed, so the agreement is
  // asserted rather than assumed (the lesson contrastparity.js records).
  useEffect(() => {
    const map = {};
    for (const p of products) map[p.sku || p.id] = productApprovals(p);
    window.__ipcApprovals = map;
    // Exposed so the word-boundary check can run the deriver against a bare
    // string. Testing it indirectly ("does any product with an Encapsulating
    // badge derive a UL approval") was wrong — IP42MW carries "Encapsulating"
    // AND a genuine "U/L Approved", so the indirect test flagged a correct
    // derivation as a false positive.
    window.__ipcDeriveApprovals = (obj) => productApprovals(obj);
    return () => { delete window.__ipcApprovals; delete window.__ipcDeriveApprovals; };
  }, [products]);
  const shown = groups.reduce((n, [, rows]) => n + rows.length, 0);

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* C33 — the crumb label is the fixed route name, not c.title. The
              owner can retitle this page in Page Content, and a breadcrumb
              that renamed itself with it would stop matching the navigation
              and the footer link that lead here. */}
          <Breadcrumb
            trail={[
              { label: "Home", page: "home" },
              { label: "Product Catalog", page: "products" },
              { label: "Datasheets", page: "datasheets" },
            ]}
          />
          <PageEyebrow>{c.eyebrow}</PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            {c.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base" style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}>
            {c.intro}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8" style={{ maxWidth: 420 }}>
          <label htmlFor="ds-filter" className="sr-only">Filter datasheets</label>
          <input
            id="ds-filter"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by part number, name or family…"
            className="w-full rounded-lg outline-none transition-all duration-200"
            style={{
              border: "1px solid #d1d9e0", background: "#ffffff", color: "#141414",
              padding: "10px 16px", fontSize: 16,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--brand-primary)";
              e.target.style.boxShadow = "0 0 0 3px rgba(var(--brand-primary-rgb),0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#d1d9e0";
              e.target.style.boxShadow = "none";
            }}
          />
          <div
            aria-live="polite"
            style={{ font: "11px ui-monospace, SFMono-Regular, Menlo, monospace", color: "#6b7280", marginTop: 8 }}
          >
            {shown} of {total} shown
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center text-sm" style={{ border: "1px solid #e5e9ee", color: "#6b7280" }}>
            No datasheets match “{q}”.
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(([family, rows]) => (
              <section key={family}>
                <h2 className="flex items-baseline gap-3 mb-3" data-ipc-family={family}>
                  <span style={{ font: "700 15px system-ui, sans-serif", color: "#141414" }}>{family}</span>
                  <span style={{ font: "11px ui-monospace, Menlo, monospace", color: "#4b5563" }}>{rows.length}</span>
                  <span aria-hidden="true" style={{ flex: 1, borderBottom: "1px solid #e5e9ee" }} />
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rows.map((p) => (
                    <a
                      key={p.sku || p.id}
                      href={p.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg flex items-start gap-3 transition-all duration-150 hover:shadow-md"
                      style={{
                        border: "1px solid #e5e9ee", background: "#ffffff",
                        padding: "13px 15px", textDecoration: "none",
                      }}
                    >
                      <svg
                        width="17" height="17" viewBox="0 0 24 24" fill="none"
                        stroke="var(--brand-primary-text)" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={{ minWidth: 0 }}>
                        <span style={{
                          display: "block", font: "700 12px ui-monospace, Menlo, monospace",
                          color: "var(--brand-primary-text)", letterSpacing: "0.02em",
                        }}>
                          {p.sku}
                        </span>
                        <span style={{
                          display: "block", fontSize: 12.5, color: "#4b5563",
                          lineHeight: 1.45, marginTop: 2,
                        }}>
                          {p.name}
                        </span>
                        <ApprovalMarks product={p} />
                        <span className="sr-only"> — PDF datasheet, opens in a new tab</span>
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HomePage() {
  const site = useSiteInfo();
  const { markets, copy, industryDetail } = useContent();
  const mk = copy.homeMarkets;

  /**
   * C30 — the fragment for a market card, or undefined if there is no section
   * to point at.
   *
   * Matched on the visible name because that is the only field the two lists
   * agree on; their iconKeys do not (auto vs automotive, aero vs aerospace,
   * and "electronics" has no section at all). Returning undefined for a
   * non-match is deliberate: the link falls back to the page it always went
   * to, rather than to a fragment that resolves to nothing.
   */
  const marketAnchor = (m) => {
    if (!m || m.page !== "industries") return undefined;
    const want = String(m.label || "").trim().toLowerCase();
    const idx = (industryDetail || []).findIndex(
      (ind) => String(ind.name || "").trim().toLowerCase() === want
    );
    return idx === -1 ? undefined : industryAnchor(industryDetail[idx], idx);
  };
  return (
    <div>
      <Hero />
      <StatsBar />
      <Features />

      {/* Markets section */}
      <section className="py-20 px-6" style={{ background: "#ffffff" }}>
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow={mk.eyebrow}
            title={mk.title}
            subtitle={mk.subtitle}
            action={{ label: "View All Industries →", page: "industries" }}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {markets.map((m, i) => (
              <PageLink
                key={`${i}-${m.label}`}
                page={m.page}
                // C30 — deep-link into the section rather than the page.
                // All six of these pointed at bare /industries, which has no
                // anchors at all, so clicking "Medical Devices" dropped the
                // visitor at the top of a 3,479px page with Medical Devices
                // third of six and no indication they had arrived anywhere.
                //
                // Resolved against the industry list rather than built from
                // this card's own iconKey. The two collections do not share a
                // vocabulary: the cards say auto / aero / electronics and the
                // sections say automotive / aerospace / (nothing). Minting
                // `industry-${m.iconKey}` here produced three dangling
                // fragments out of six and looked fine, because the one that
                // happened to be tested — medical — is spelled the same in
                // both.
                // A card with no matching section gets no fragment and links
                // to the page, which is what "electronics" needs and is a
                // graceful failure if the owner renames one list and not the
                // other.
                hash={marketAnchor(m)}
                className="group rounded-xl p-6 text-left transition-all duration-200 flex flex-col hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-500 hover:bg-blue-50/30"
                style={{
                  border: "1px solid #e5e9ee",
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <div
                  className="group-hover:bg-blue-100 transition-colors duration-200"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "rgba(var(--brand-primary-rgb),0.07)",
                    color: "var(--brand-primary-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                    flexShrink: 0,
                  }}
                >
                  {MktIcons[m.iconKey]}
                </div>
                <div
                  className="group-hover:text-blue-700 transition-colors duration-200"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#141414",
                    marginBottom: 6,
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#6b7280",
                    flex: 1,
                  }}
                >
                  {m.desc}
                </div>
                <div
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--brand-primary-text)",
                    marginTop: 12,
                  }}
                >
                  Learn More →
                </div>
              </PageLink>
            ))}
          </div>
        </div>
      </section>

      {/* Quote CTA band */}
      <section
        style={{
          background: "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent-2) 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-extrabold ipc-ink-header mb-2">
              {site.stats.minimumOrder} minimum order. {site.stats.feetInStock} feet in stock. Ships today.
            </h2>
            <p style={{ color: "rgba(var(--brand-header-ink-rgb), 0.75)" }} className="text-sm">
              Call <a href={`tel:${site.contact.phoneDial}`} style={{ color: "var(--brand-header-ink)", fontWeight: 600 }}>{site.contact.phone}</a>,
              {/* Fax is clearable in Business Details (NB4) — drop the whole clause,
                  not just the number, or this reads "Call …, fax , or submit". */}
              {site.contact.fax ? (
                <> fax <span style={{ color: "var(--brand-header-ink)", fontWeight: 600 }}>{site.contact.fax}</span>,</>
              ) : null}
              {" "}or submit a quote request online — our team responds quickly and accurately.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 flex-shrink-0">
            <PageLink
              page="contact"
              className="text-sm font-semibold px-6 py-3 rounded transition-all duration-150 hover:brightness-110"
              style={{
                display: "inline-block",
                background: "#ffffff",
                color: "var(--brand-primary-text)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Request a Quote
            </PageLink>
            <PageLink
              page="products"
              className="text-sm font-semibold px-6 py-3 rounded transition-all duration-150"
              style={{
                display: "inline-block",
                background: "transparent",
                color: "var(--brand-header-ink)",
                border: "1px solid rgba(255,255,255,0.5)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "#ffffff")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)")
              }
            >
              Browse Products →
            </PageLink>
          </div>
        </div>
      </section>
    </div>
  );
}

/** IPC capability card — used on About page. Avatar is an emoji in a styled circle. */
function TeamCard({ name, role, avatar }) {
  return (
    <div
      className="rounded-xl p-6 text-center transition-all duration-200"
      style={{
        border: "1px solid #e5e9ee",
        background: "#ffffff",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--brand-primary)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(var(--brand-primary-rgb),0.10)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e9ee";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* Styled icon circle */}
      <div
        className="mx-auto mb-4 flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background:
            "linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(0,190,242,0.15) 100%)",
          fontSize: 24,
          border: "1px solid rgba(var(--brand-primary-rgb),0.15)",
        }}
      >
        {avatar}
      </div>
      <div className="text-sm font-bold mb-1" style={{ color: "#141414" }}>
        {name}
      </div>
      <div className="text-xs font-medium" style={{ color: "var(--brand-accent-text)" }}>
        {role}
      </div>
    </div>
  );
}

// M-1 fix: cert icon components at module level — stable references, no remounting on AboutPage renders
const CertCheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#005da3"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const CertLeafIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#005da3"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 8C8 10 5.9 16.17 3.82 19.82C3.44 20.53 4.11 21.15 4.83 20.81C6.44 20.05 9.01 18.8 12 17c3 2 5.5 3 7 3.5V8c0-5-6-6-9-4z" />
  </svg>
);
const CertFlagIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#005da3"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);
const CertListIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#005da3"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const CertBuildIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#005da3"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
);
const CertLockIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#005da3"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// Keyed cert icons so the certification cards are editable by icon key from the
// admin (the components themselves stay code-defined).
const CERT_ICONS = {
  check: <CertCheckIcon />,
  leaf: <CertLeafIcon />,
  flag: <CertFlagIcon />,
  list: <CertListIcon />,
  build: <CertBuildIcon />,
  lock: <CertLockIcon />,
};

/**
 * IPC About page — Phase 4 overhaul with verified dossier data.
 * Sections: page header, verified narrative + sidebar facts, milestone timeline,
 *           certifications, capability cards, CTA strip.
 */
// Module-level static data for AboutPage (fixes 2/3: no recreation on every render)
const ABOUT_CAPABILITIES = [
  {
    name: "Inside Sales Team",
    role: "Fast, accurate quote & order response",
    avatar: "🤝",
  },
  {
    name: "Technical Support",
    role: "Product selection, specs & cross-reference",
    avatar: "⚙️",
  },
  {
    name: "ISO Quality Team",
    role: "ISO 9001 in-process & final inspection",
    avatar: "🏅",
  },
  {
    name: "Fabrication Shop",
    role: "Cut · Mark · Spool · Kit in ≤ 1 week",
    avatar: "✂️",
  },
];
const ABOUT_CERTS = [
  // A2 — revision deliberately absent; see the homepage trust-bar default.
  { iconKey: "check", title: "ISO 9001", sub: "Registered Quality Management System" },
  { iconKey: "leaf", title: "Full RoHS Compliant", sub: "Entire product line" },
  { iconKey: "flag", title: "Made in USA", sub: "Bolingbrook, IL facility" },
  { iconKey: "list", title: "UL · CSA · MIL-SPEC · AMS", sub: "Product-level certifications" },
  { iconKey: "build", title: "PPAP & IMDS Support", sub: "Automotive documentation available" },
  { iconKey: "lock", title: "Privately Held", sub: "Independent since July 1, 1974" },
];
const ABOUT_MILESTONES = [
  {
    year: "1974",
    label: "Founded",
    desc: "Insulation Products Corporation incorporated July 1, 1974 in Bolingbrook, Illinois.",
  },
  {
    year: "1980s",
    label: "Expansion",
    desc: "Grew product line from basic vinyl tubing to full heat-shrinkable and extruded tubing catalog.",
  },
  {
    year: "1990s",
    label: "ISO Certified",
    desc: "Achieved ISO 9001 registration, formalizing quality systems from receiving to shipping.",
  },
  {
    year: "2000s",
    label: "Value-Added",
    desc: "Launched in-house fabrication services: cut-to-length, hot-stamp marking, kitting, and spooling.",
  },
  {
    year: "2010s",
    label: "Remodel",
    desc: "State-of-the-art computerized facility and equipment update; expanded MIL-SPEC and medical-grade stocking.",
  },
  {
    year: "2024",
    label: "50 Years",
    desc: "Celebrating 50 years as a trusted, independent stocking distributor. 25M+ feet in stock, $50 minimum order.",
  },
];

function AboutPage() {
  const site = useSiteInfo();
  // Timeline, team capabilities, and certifications are all editable via content.json.
  const { milestones, capabilities, certs, copy } = useContent();
  const c = copy.aboutHeader;

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <PageEyebrow>
            {c.eyebrow}
          </PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            {c.title}
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            {c.intro}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        {/* 4.1 / 4.4 — Verified company narrative + sidebar facts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div
            className="lg:col-span-2 bg-white rounded-2xl p-8 space-y-5"
            style={{ border: "1px solid #e5e9ee" }}
          >
            <h2 className="text-2xl font-bold" style={{ color: "#141414" }}>
              {c.storyTitle}
            </h2>
            {(site.about?.paragraphs ?? []).map((para, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
                {para}
              </p>
            ))}
          </div>

          {/* 4.4 — Verified sidebar facts */}
          <div className="space-y-3">
            {[
              { label: "Founded", value: `Since ${site.company.foundedYear}` },
              { label: "Headquarters", value: `${site.address.city}, ${site.address.state} ${site.address.zip}` },
              { label: "Structure", value: "Privately Held" },
              { label: "Inventory", value: `${site.stats.feetInStock} feet in stock` },
              { label: "Minimum Order", value: site.stats.minimumOrder },
              { label: "Quality", value: `${site.certifications.iso} Registered` },
              { label: "Custom Lead Time", value: "≤ 1 week" },
              { label: "Phone", value: site.contact.phone },
              { label: "Fax", value: site.contact.fax },
              { label: "PPAP / IMDS", value: "Available on request" },
            ].filter((item) => item.value) /* a cleared Fax drops its row (NB4) */
              .map((item) => (
              <div
                key={item.label}
                className="bg-white rounded-xl px-5 py-3.5 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between"
                style={{ border: "1px solid #e5e9ee" }}
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: "#6b7280" }}
                >
                  {item.label}
                </span>
                <span
                  className="text-sm font-bold text-right"
                  style={{ color: "var(--brand-primary-text)" }}
                >
                  {/* These hrefs were hardcoded to +16307710700/01 while the
                       displayed value came from site-info.json — change the
                       phone in the admin and the page showed the new number
                       but dialled the old one. Fax is NOT a tel: link: a
                       mobile visitor who taps it dials a fax machine.
                       (DEPLOY_READINESS_v2 4.7, 4.8) */}
                  {item.label === "Phone" && site.contact.phoneDial ? (
                    <a href={`tel:${site.contact.phoneDial}`} style={{ color: "var(--brand-primary-text)" }}>{item.value}</a>
                  ) : item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4.3 — Milestone timeline */}
        <div>
          <div
            className="text-xs font-bold tracking-widest uppercase mb-8"
            style={{ color: "var(--brand-primary-text)" }}
          >
            Company Timeline
          </div>
          {/* CSS Grid timeline — 3 columns: [year badge] [dot+line] [content card].
              The line is a flex column in the middle grid cell — no pixel positioning needed. */}
          <div>
            {milestones.map((m, i) => {
              const isLast = i === milestones.length - 1;
              return (
                <div
                  key={`${i}-${m.year}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 24px 1fr",
                    columnGap: 16,
                  }}
                >
                  {/* Col 1: year badge */}
                  <div
                    style={{ textAlign: "right", paddingTop: 6, minWidth: 80 }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: isLast ? "var(--brand-primary)" : "rgba(var(--brand-primary-rgb),0.08)",
                        color: isLast ? "var(--brand-dark-ink)" : "var(--brand-primary-text)",
                      }}
                    >
                      {m.year}
                    </span>
                  </div>
                  {/* Col 2: dot + vertical line segment */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        marginTop: 7,
                        flexShrink: 0,
                        zIndex: 1,
                        background: isLast ? "var(--brand-primary)" : "#ffffff",
                        border: `2px solid ${isLast ? "var(--brand-primary)" : "#d1d9e0"}`,
                        outline: "2px solid #f5f7fa",
                      }}
                    />
                    {!isLast && (
                      <div
                        style={{
                          flex: 1,
                          width: 2,
                          minHeight: 16,
                          background:
                            "linear-gradient(to bottom, var(--brand-primary), #e5e9ee)",
                          marginTop: 2,
                        }}
                      />
                    )}
                  </div>
                  {/* Col 3: content card */}
                  <div
                    className="bg-white rounded-xl px-5 py-4 transition-colors duration-200 hover:border-blue-400"
                    style={{
                      border: "1px solid #e5e9ee",
                      marginBottom: isLast ? 0 : 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#141414",
                        marginBottom: 4,
                      }}
                    >
                      {m.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: "#4b5563",
                      }}
                    >
                      {m.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Certifications */}
        <div>
          <div
            className="text-xs font-bold tracking-widest uppercase mb-6"
            style={{ color: "var(--brand-primary-text)" }}
          >
            {c.certsTitle}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {certs.map((c, i) => (
              <div
                key={`${i}-${c.title}`}
                className="bg-white rounded-xl p-5 flex gap-4 items-start transition-all duration-200"
                style={{ border: "1px solid #e5e9ee" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--brand-primary)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(var(--brand-primary-rgb),0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e9ee";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: 38,
                    height: 38,
                    background: "rgba(var(--brand-primary-rgb),0.07)",
                    border: "1px solid rgba(var(--brand-primary-rgb),0.12)",
                  }}
                >
                  {CERT_ICONS[c.iconKey] || CERT_ICONS.check}
                </div>
                <div>
                  <div
                    className="text-sm font-bold"
                    style={{ color: "#141414" }}
                  >
                    {c.title}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                    {c.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4.2 — Capability cards */}
        <div>
          <div
            className="text-xs font-bold tracking-widest uppercase mb-6"
            style={{ color: "var(--brand-primary-text)" }}
          >
            {c.teamTitle}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {capabilities.map((c, i) => (
              <TeamCard
                key={`${i}-${c.name}`}
                name={c.name}
                role={c.role}
                avatar={c.avatar}
              />
            ))}
          </div>
        </div>

        {/* CTA strip */}
        <div
          className="rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6"
          style={{ background: "var(--brand-dark)" }}
        >
          <div>
            <div className="text-lg font-extrabold ipc-ink-dark mb-1">
              {c.ctaTitle}
            </div>
            <p className="text-sm" style={{ color: "rgba(var(--brand-dark-ink-rgb), 0.6)" }}>
              Call <a href={`tel:${site.contact.phoneDial}`} style={{ color: "rgba(var(--brand-dark-ink-rgb), 0.9)", fontWeight: 600 }}>{site.contact.phone}</a>,
              email <a href={`mailto:${site.contact.email}`} style={{ color: "rgba(var(--brand-dark-ink-rgb), 0.9)", fontWeight: 600 }}>{site.contact.email}</a>,
              or use our contact form — our team responds quickly and accurately.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <PageLink
              page="contact"
              className="text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
              style={{
                display: "inline-block",
                background: "var(--brand-primary)",
                color: "var(--brand-primary-ink)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Contact Sales →
            </PageLink>
            <PageLink
              page="services"
              className="text-sm font-medium px-5 py-2.5 rounded transition-all"
              style={{
                display: "inline-block",
                background: "transparent",
                color: "rgba(var(--brand-dark-ink-rgb), 0.7)",
                border: "1px solid rgba(255,255,255,0.3)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ffffff";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              }}
            >
              View Services
            </PageLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * IPC FAQ accordion item — Tailwind transition utilities for open/close animation.
 * Uses aria-expanded for accessibility. max-height measured via ref for smooth animation.
 */
// C41 — `open` is a PROP, not local state. It used to live here, which meant
// the page had no way to drive 14 items at once and no way to label a bulk
// control truthfully. Only the boolean moved up; the `hidden`/`expanded`
// timing machinery below is 4.20's and stays exactly where it was, so a bulk
// toggle goes through the same effect a click does and cannot bypass it.
function FaqItem({ question, answer, open, onToggle }) {
  const site = useSiteInfo();
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const uid = useId();
  const panelId = `faq-panel-${uid}`;
  const triggerId = `faq-trigger-${uid}`;

  // 4.20 — `max-height: 0` hides the answer from EYES ONLY. It stayed in the
  // accessibility tree and in find-in-page, so a screen-reader user heard every
  // answer to every question continuously with no way to tell which were
  // collapsed, and Ctrl-F matched invisible text. Measured before this change:
  // window.find() on a collapsed answer returned true.
  //
  // Two states, not one, because they have different timing. `hidden` is the
  // accessibility gate (display:none, so the panel genuinely leaves the tree);
  // `expanded` drives the height transition. The panel must be un-hidden BEFORE
  // starts to open, and must stay un-hidden UNTIL the collapse has finished
  // animating — collapsing them into one state loses the animation.
  const [hidden, setHidden] = useState(true);
  // Deliberately NOT named after what it does. Tailwind's extractor scans raw
  // source text, so a bare identifier that is also a utility class name emits
  // that whole rule into the shipped CSS — the first draft of this state added
  // one, and so did the first draft of the comment explaining it. Caught by
  // diffing the emitted selectors, not by reading the build summary.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!open) {
      setExpanded(false);
      // Belt and braces for the transitionend handler below: a zero-duration
      // transition, a background tab or `prefers-reduced-motion` can mean the
      // event never arrives, and the panel would then never leave the tree —
      // silently reinstating the exact bug this fixes.
      const t = setTimeout(() => setHidden(true), 400);
      return () => clearTimeout(t);
    }
    setHidden(false);
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      // Measure only now. `hidden` is display:none, where scrollHeight is 0, so
      // the old mount-time measurement would give the panel no target height.
      if (el) setContentHeight(el.scrollHeight);
      raf2 = requestAnimationFrame(() => setExpanded(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [open]);

  // Keep the measured height current while open (viewport resize, late font
  // swap) so a long answer never clips itself.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !open) return;
    const ro = new ResizeObserver(() => setContentHeight(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all duration-200 ${open ? "shadow-md" : ""}`}
      style={{
        border: `1px solid ${open ? "var(--brand-primary)" : "#e5e9ee"}`,
        background: "#ffffff",
      }}
    >
      {/* Trigger button — aria-expanded plus aria-controls, so the panel is
          reachable from the control rather than merely adjacent to it. */}
      <button
        id={triggerId}
        className="w-full flex items-center justify-between px-6 py-5 text-left"
        style={{ background: "none", border: "none", cursor: "pointer" }}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span
          className="text-sm font-semibold pr-4"
          style={{ color: "#141414" }}
        >
          {question}
        </span>
        {/* Plus/×: Tailwind rotate-45 transition on open */}
        <span
          className={`flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-250 ${open ? "rotate-45" : "rotate-0"}`}
          style={{
            width: 28,
            height: 28,
            background: open ? "var(--brand-primary)" : "rgba(var(--brand-primary-rgb),0.07)",
            color: open ? "var(--brand-dark-ink)" : "var(--brand-primary-text)",
          }}
        >
          +
        </span>
      </button>

      {/* Content panel — same max-height animation as before, but `hidden` now
          takes it out of the accessibility tree and out of find-in-page once
          the collapse has finished animating. (4.20) */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={hidden}
        onTransitionEnd={(e) => {
          if (!open && e.propertyName === "max-height") setHidden(true);
        }}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: expanded ? `${contentHeight + 40}px` : "0px" }}
      >
        <div ref={contentRef} className="px-6 pb-5 border-t border-gray-100">
          <p className="text-sm leading-relaxed pt-4 text-gray-600">{localizeProse(answer, site)}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * IPC Resources & FAQ page — Phase 4 overhaul with verified dossier data.
 * Four categories: Products · Custom & Fabrication · Ordering & Minimums · Support & Documentation
 */
// Fix 4: FaqPage categories at module level — alias assigned below inside function
// (The full array declaration stays inside FaqPage for readability; extracted alias prevents
//  recreation on every render by assigning once at module scope on first function call.
//  For true module-level extraction: move the full array here and reference in FaqPage.)
// FAQ content lifted to module scope (flat-grouped by the content system).
const FAQ_CATEGORIES = [
    {
      name: "Products",
      items: [
        {
          question: "What types of heat shrink tubing do you carry?",
          answer:
            "IPC stocks a comprehensive range: standard polyolefin (2:1 and 3:1 ratios), thin-wall polyolefin, semi-rigid polyolefin, UV-resistant PVC, irradiated PVC, layflat PVC, dual-wall adhesive-lined (2:1 and 3:1), PVDF/Kynar high-dielectric, fluoropolymer (IP55FL), FEP Teflon (IP38FE), PTFE/TFE heat shrink, neoprene and Viton elastomeric, Mylar high-dielectric, medical-grade (USP Class VI), diesel-resistant, and melt-wall encapsulating tubing. All products are RoHS compliant.",
        },
        {
          question: "What sleeving and conduit products are available?",
          answer:
            "We supply fiberglass sleeving in four coating options: heat-treated bare glass (IP64FS, up to 1200°F/649°C), vinyl-coated Class C (IPC65VC, 130°C), acrylic-coated Class F (IP66AC, 155°C), and silicone-coated Class H (IP67SC, up to 200°C). We also carry expandable polyester sleeving (IP61ES/IP62EF), self-wrapping Roundit 2000 sleeving (IP63ES), slit guard conduit (polyethylene, nylon, polypropylene), and nonmetallic liquid-tight conduit fittings (CCS, CC, CC90, CT).",
        },
        {
          question: "Are your products RoHS compliant?",
          answer:
            "Yes — our entire product line is RoHS compliant. Individual products also carry additional certifications including UL (Subject 224 VW-1), CSA OFT, MIL-SPEC (multiple classes), AMS, FDA Title 21 CFR, USP Class VI, and ASTM standards. Specific certifications are listed on each product's data sheet.",
        },
        {
          question: "Do you carry extruded and non-shrink tubing?",
          answer:
            "Yes. In addition to heat shrink, IPC stocks extruded vinyl tubing (IP10EX, IP12GA, IP1274, IP15PV FDA grade), PTFE spaghetti tubing (multiple wall thicknesses), polyurethane tubing, and low-temperature PVC. We also carry adhesives, heat guns, cable ties, heat-shrinkable end caps, and heat-shrink tape.",
        },
      ],
    },
    {
      name: "Custom & Value-Added Fabrication",
      items: [
        {
          question: "Can you cut tubing to custom lengths?",
          answer:
            "Yes. Our fabrication shop handles precision cut-to-length for any volume — from a handful of pieces to bulk production runs. Parts are bagged per customer specification. Tight tolerances and a clean environment are maintained throughout. Typical turnaround: one week or less.",
        },
        {
          question: "What marking and labeling services do you offer?",
          answer:
            "IPC offers hot-stamp marking (part numbers, logos, sequential IDs), bar code printing (Code 128, Code 39, QR Code, Data Matrix), wire and cable markers, lengthwise slitting for wrap-around applications, and both vertical and horizontal perforations for easy separation. Labels can be applied to individual pieces, coils, or spools.",
        },
        {
          question: "Do you offer spooling, coiling, and kitting?",
          answer:
            "Yes. Tubing and sleeving can be supplied on custom spools or in coils to customer specification — including footage, core size, and labeling requirements. Kitting and individual bagging (single items or kit assemblies) are also available, with JIT delivery programs for customers who want to reduce their stocking burden.",
        },
        {
          question:
            "What is your standard turnaround time for custom fabrication?",
          answer:
            "One week or less for standard cut-to-length, marking, spooling, and kitting work. Rush service is available — contact our sales team at 630.771.0700 or sales@insulationproducts.com for specific commitments on your project.",
        },
      ],
    },
    {
      name: "Ordering & Minimums",
      items: [
        {
          question: "What is the minimum order?",
          answer:
            "IPC's minimum order is $50. We accommodate both prototype/small-volume needs and full production orders — you don't need a large MOQ to buy from us.",
        },
        {
          question: "How much inventory do you carry?",
          answer:
            "IPC maintains over 25 million feet of tubing and sleeving in stock at our Bolingbrook, IL facility. Most in-stock items ship the same day or next business day.",
        },
        {
          question: "How do I request a quote?",
          answer:
            "Call us at 630.771.0700 (Mon–Fri, 8am–5pm CT), fax your PO or inquiry to 630.771.0701, email sales@insulationproducts.com, or use the Contact form on this website. Include part numbers (or a description), quantities, required lead time, and any special requirements for the fastest response.",
        },
        {
          question: "Can I fax my purchase order?",
          answer:
            "Yes. Our fax number is 630.771.0701. Fax is suitable for POs, RFQs, and documentation requests including PPAP packages and IMDS material submissions.",
        },
        {
          question: "Do you offer JIT (Just-In-Time) delivery programs?",
          answer:
            "Yes. IPC offers JIT stocking and pull-based delivery programs for customers who want to reduce their on-hand inventory. Contact our sales team to discuss program structure, minimum commitments, and lead times.",
        },
        {
          question: "Can IPC support PPAP or IMDS documentation requirements?",
          answer:
            "Yes. IPC can provide PPAP documentation packages and IMDS (International Material Data System) submissions for automotive supplier customers. Contact sales at 630.771.0700 or by email to discuss your specific documentation requirements.",
        },
      ],
    },
    {
      name: "Support & Documentation",
      items: [
        {
          question: "Where can I download product data sheets?",
          answer:
            "Individual product data sheets are available on each product's detail page — click the 'Data Sheet' button in the product header. A link to the full IPC product catalog PDF is available on the Products page header and in the site footer.",
        },
        {
          question: "Can IPC cross-reference a competitor part number?",
          answer:
            "Yes. Our technical support team can cross-reference most competitor part numbers to an equivalent IPC product. Call 630.771.0700 or email sales@insulationproducts.com with the competitor part number, material type, and key dimensions.",
        },
        {
          question: "Are certificates of conformance available?",
          answer:
            "Yes. Certificates of conformance (C of C) can be provided with your order upon request. Contact sales at the time of ordering to ensure C of C documentation is included with your shipment.",
        },
        {
          question: "Do you ship internationally?",
          answer:
            "Please contact our sales team at sales@insulationproducts.com or call 630.771.0700 to discuss international shipping options, export compliance, and any restrictions for your specific products and destination.",
        },
      ],
    },
];

function FaqPage() {
  const site = useSiteInfo();
  const { faq, copy } = useContent();
  const c = copy.faqHeader;
  // Memoised on `faq` so the JSON-LD effect below has a STABLE dependency.
  // groupFaq() returns a fresh array on every render; depending on that directly
  // would tear down and re-append the <script> on every render instead of only
  // when the content actually changes.
  const categories = useMemo(() => groupFaq(faq), [faq]);

  // C41 — which questions are open, held here rather than in each FaqItem.
  //
  // The audit's complaint was that scanning for an answer means 14 clicks. A
  // bulk control needs two things the old shape could not give it: a way to
  // set every item at once, and a truthful label. Deriving the label from a
  // remembered "I last clicked expand" flag would lie as soon as the visitor
  // closed one by hand, so the open set is the single source of truth and the
  // label is computed from its size.
  //
  // Keys must be unique across categories, not within one — two categories can
  // legitimately carry the same question text.
  const itemKeys = useMemo(
    () => categories.flatMap((cat, ci) => cat.items.map((it, i) => `${ci}-${i}-${it.question}`)),
    [categories]
  );
  const [openKeys, setOpenKeys] = useState(() => new Set());

  // If the owner edits the FAQ while the page is open, drop keys that no longer
  // exist — otherwise `openKeys.size` can exceed the question count and the
  // control offers to expand a set that is already fully expanded.
  useEffect(() => {
    setOpenKeys((prev) => {
      const valid = new Set(itemKeys);
      let changed = false;
      const next = new Set();
      for (const k of prev) { if (valid.has(k)) next.add(k); else changed = true; }
      return changed ? next : prev;
    });
  }, [itemKeys]);

  const allOpen = itemKeys.length > 0 && openKeys.size >= itemKeys.length;
  const toggleOne = useCallback((key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const toggleAll = useCallback(() => {
    setOpenKeys((prev) => (prev.size >= itemKeys.length ? new Set() : new Set(itemKeys)));
  }, [itemKeys]);

  // FAQPage structured data.
  //
  // This used to have `[]` deps. ContentProvider initialises to contentDefaults
  // and renders its children IMMEDIATELY, swapping in the fetched content a
  // moment later — so the effect ran once, against the defaults, and the empty
  // deps array guaranteed it never re-ran. The FAQ rich-result markup Google saw
  // was permanently the hardcoded default set, and every question Rick wrote in
  // the admin was absent from it. (AUDIT_v3 4.1)
  //
  // Note this is built from useContent() data, NOT from the DOM, so collapsing a
  // FAQ answer in the UI has no effect on what is emitted here.
  useEffect(() => {
    const el = document.createElement("script");
    el.id = "faq-ld";
    el.type = "application/ld+json";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": categories.flatMap((cat) =>
        cat.items.map((item) => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": { "@type": "Answer", "text": localizeProse(item.answer, site) },
        }))
      ),
    });
    // Remove any existing node before appending, so a re-run cannot leave two
    // #faq-ld scripts behind — duplicate structured data is a worse error than
    // stale structured data.
    document.getElementById("faq-ld")?.remove();
    document.head.appendChild(el);
    return () => { document.getElementById("faq-ld")?.remove(); };
  }, [categories, site]);

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <PageEyebrow>
            {c.eyebrow}
          </PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            {c.title}
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            {c.intro}{" "}
            <PageLink
              page="contact"
              // B24 — ipc-inline-link carries the padding, because the inline
              // `padding: 0` below is an inline style and would beat any
              // stylesheet rule trying to enlarge the hit area on a phone. It
              // was 130x21 at 390px, under the 24px AA floor.
              className="ipc-inline-link underline font-semibold"
              style={{
                // NOT --brand-accent, and not --brand-accent-text either. This
                // link sits INSIDE .ipc-page-header, on the same owner-controlled
                // gradient as the title: the accent measured 1.69:1 here and
                // --brand-accent-text is solved for white, which is not what is
                // behind it. --brand-header-ink is the variable scored against
                // this surface. The link stays obviously a link because it is
                // underlined and semibold, which is how it already read.
                color: "var(--brand-header-ink)",
                // Stated inline rather than left to the `underline` class, so
                // this inline link keeps its rule regardless of how Tailwind's
                // `a { text-decoration: inherit }` preflight reset cascades.
                textDecoration: "underline",
                background: "none",
                border: "none",
                cursor: "pointer",
                // padding lives in .ipc-inline-link — see the class note above.
              }}
            >
              Contact our team.
            </PageLink>
          </p>
        </div>
      </div>

      {/* Sticky category jump-nav */}
      <div
        style={{
          position: "sticky",
          top: 64,
          zIndex: 30,
          background: "rgba(240,245,252,0.97)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #d1ddef",
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
        {/* The chips keep their own scroller so the bulk control below stays
            pinned instead of scrolling out of reach on a narrow screen. */}
        <div
          className="flex gap-3 overflow-x-auto"
          style={{ WebkitOverflowScrolling: "touch", flex: 1, minWidth: 0 }}
        >
          {categories.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => {
                const el = document.getElementById(`faq-cat-${i}`);
                if (el)
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              style={{
                flexShrink: 0,
                padding: "5px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: "#ffffff",
                color: "var(--brand-primary-text)",
                border: "1px solid var(--brand-primary)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--brand-primary)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.color = "var(--brand-primary-text)";
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* C41 — the bulk control. Same palette as the chips, which is already
            a measured-safe combination; the weight and the glyph are what tell
            it apart from a category. It drives the SAME per-item state a click
            drives, so 4.20's accessibility-tree gate applies to it unchanged. */}
        <button
          type="button"
          onClick={toggleAll}
          style={{
            flexShrink: 0,
            padding: "5px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#ffffff",
            color: "var(--brand-primary-text)",
            border: "1px solid var(--brand-primary)",
            cursor: "pointer",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--brand-primary)";
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.color = "var(--brand-primary-text)";
          }}
        >
          <span aria-hidden="true" style={{ marginRight: 6, fontWeight: 700 }}>
            {allOpen ? "−" : "+"}
          </span>
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        {categories.map((cat, catIdx) => (
          <div
            key={cat.name}
            id={`faq-cat-${catIdx}`}
            style={{ scrollMarginTop: 120 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-1 h-6 rounded-full"
                style={{ background: "var(--brand-primary)" }}
              />
              <h2 className="text-base font-bold" style={{ color: "var(--brand-primary-text)" }}>
                {cat.name}
              </h2>
            </div>
            <div className="space-y-3">
              {cat.items.map((item, i) => {
                const key = `${catIdx}-${i}-${item.question}`;
                return (
                  <FaqItem
                    key={key}
                    {...item}
                    open={openKeys.has(key)}
                    onToggle={() => toggleOne(key)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Contact CTA */}
        <div className="rounded-2xl p-8" style={{ background: "#141414" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">
                Still have questions?
              </h3>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                Our sales team is available Mon–Fri, 8am–5pm CT and responds to
                email inquiries quickly.
              </p>
              <div
                className="mt-3 space-y-1.5 text-xs"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                <div>📞 <a href={`tel:${site.contact.phoneDial}`} style={{ color: "rgba(255,255,255,0.5)" }}>{site.contact.phone}</a></div>
                {site.contact.fax ? (
                  <div style={{ color: "rgba(255,255,255,0.5)" }}>📠 {site.contact.fax} (Fax)</div>
                ) : null}
                <div>📧 <a href={`mailto:${site.contact.email}`} style={{ color: "rgba(255,255,255,0.5)" }}>{site.contact.email}</a></div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <PageLink
                page="contact"
                className="w-full py-3 rounded text-sm font-semibold hover:brightness-110 transition-all"
                style={{
                  // A full-width control: restate the <button> block + centred
                  // text an <a> does not have. (PLAN-1 4.21 styling risk)
                  display: "block",
                  textAlign: "center",
                  background: "var(--brand-primary)",
                  color: "var(--brand-primary-ink)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Contact Sales →
              </PageLink>
              <PageLink
                page="products"
                className="w-full py-3 rounded text-sm font-medium transition-all"
                style={{
                  display: "block",
                  textAlign: "center",
                  background: "transparent",
                  color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                }}
              >
                Browse Products
              </PageLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fix 7: ContactPage contact info at module level — SVG elements created once
const CONTACT_CARDS = [
  {
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.54 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    title: "Phone",
    info: "630.771.0700",
    href: "tel:+16307710700",
    sub: "Mon–Fri, 8am–5pm CT",
  },
  {
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 17 17 17 17 22" />
        <polyline points="2 7 7 7 7 2" />
        <path d="M2 17l5 5L22 7" />
        <line x1="7" y1="7" x2="7" y2="17" />
        <line x1="17" y1="7" x2="17" y2="17" />
      </svg>
    ),
    title: "Fax",
    info: "630.771.0701",
    href: "tel:+16307710701",
    sub: "For POs & documentation",
  },
  {
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    title: "Email",
    info: "sales@insulationproducts.com",
    href: "mailto:sales@insulationproducts.com",
    sub: "Typical reply: same day",
  },
  {
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: "Address",
    info: "250 Gibraltar Dr",
    sub: "Bolingbrook, IL 60440",
  },
];

/**
 * IPC Contact page — Phase 5 overhaul.
 * Two-tab conversion architecture:
 *   Tab 1: "Request a Quote" — structured RFQ form (Part #, Material, Qty, Req Date, Specs)
 *   Tab 2: "Send a Message" — general inquiry form
 */
function ContactPage() {
  const site = useSiteInfo();
  // ?part=SKU set by the product page's "Request Quote" button. (4.6)
  const [prefillPart] = useSearchParam("part");
  // C31 — which industry the visitor came from, if they arrived from one of
  // the Industries cards. Same shape as ?part=, and it lands in the notes
  // rather than in a field of its own: adding a field would mean a new
  // owner-editable label, a new COPY_DEFAULTS key and a change to
  // content.php's posted-variable count, for one line of context that reads
  // perfectly well as a sentence sales can see.
  const [prefillIndustry] = useSearchParam("industry");
  const _content = useContent();
  const _copy = _content.copy;
  const c = _copy.contactHeader;
  const cf = _copy.contactForm;
  const contactTips = _content.contactTips;
  const [activeTab, setActiveTab] = useState("rfq");
  /**
   * B17 — the confirmation has its own URL.
   *
   * The URL used to stay /contact, so a refresh threw the confirmation away
   * and re-rendered an empty form, and there was no distinct address to hang
   * an analytics conversion goal on — on a site whose whole purpose is lead
   * capture.
   *
   * PUSHED, not replaced — a deliberate departure from PLAN-8's parenthetical,
   * because the plan's own acceptance for this item is "Back returns to the
   * form without re-submitting" and `replace` makes that impossible: it
   * overwrites the /contact entry, so Back skips past the form to whatever
   * preceded it. Measured — with replace, Back from the confirmation in a
   * fresh context lands on about:blank.
   *
   * T2.3's Back-trap does not apply here. That incident is a "read the param,
   * then strip it" cleanup running in an EFFECT, which re-pushes every time
   * Back re-enters it. This param is written once, in the submit handler, by a
   * deliberate user action; nothing re-adds it on render, so there is no loop
   * to trap. "Submit Another" clears it with replace, which is that pattern and
   * does use it.
   *
   * `submitted` is DERIVED from the URL rather than held alongside it. Two
   * sources for one fact is the A1 defect in this same plan, and here it has
   * teeth: with separate state, Back would change the URL while the component
   * kept rendering the confirmation.
   *
   * Reloading ?sent=1 re-renders "thank you" for what is now a bookmarkable
   * URL. That is the standard answer and it sends no request — nothing is
   * posted on render. The tab is not carried in the URL, so a reload shows the
   * RFQ wording; that is a deliberate simplification rather than a second
   * param, and the two success bodies differ only in phrasing.
   */
  const [sentParam, setSentParam] = useSearchParam("sent");
  const submitted = sentParam === "1";
  const [submittedTab, setSubmittedTab] = useState("rfq");

  // B16 — the success panel takes focus and is announced.
  //
  // The ERROR path got a proper role="alert" region in PLAN-3 4.5. The success
  // path never did: measured, the page carried zero aria-live, role="status"
  // and role="alert" regions, and document.activeElement was <body>. A screen
  // reader user submitted a quote request and got silence.
  const successRef = useRef(null);
  useEffect(() => {
    if (submitted && successRef.current) successRef.current.focus();
  }, [submitted]);
  const [submitting, setSubmitting] = useState(false); // Animation 8: button loading state

  // Submission failures used to be four browser alert dialogs. A native dialog
  // on mobile reads as "this site is broken", leaves no trace of what went
  // wrong once dismissed, points at no field, announces nothing inside the form
  // to a screen reader — and some mobile browsers suppress window.alert during
  // certain interactions entirely, so the failure could be COMPLETELY SILENT.
  // Every one of those costs a sales enquiry. (4.5)
  //
  // kind is "validation" (the server rejected the content) or "network" (we
  // never reached it) — they need different responses from the visitor, so they
  // must not collapse into one message.
  const [formError, setFormError] = useState(null); // { kind, message } | null
  const errorRef = useRef(null);
  useEffect(() => {
    if (!formError || !errorRef.current) return;
    // Focus, not just scroll: a screen-reader user who tabbed to Submit is left
    // at the bottom of the form otherwise, with the announcement already gone.
    errorRef.current.focus();
    errorRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [formError]);

  /**
   * The inline replacement for the alert dialog. Rendered inside the form, above the
   * submit control, so the message sits where the visitor is looking.
   *
   * The message is passed as a JSX text child, never dangerouslySetInnerHTML:
   * contact.php deliberately does NOT HTML-escape, because its destinations are
   * a text/plain email and a JSONL line (invariant 10). Escaping belongs at the
   * render boundary, and this is the render boundary — a quote request reading
   * `<1/4 inch and >2 inch ID` has to display literally.
   */
  const errorRegion = formError ? (
    <div
      ref={errorRef}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={-1}
      data-error-kind={formError.kind}
      className="rounded-lg px-4 py-3 text-sm flex items-start gap-2.5"
      style={{
        // Fixed colors, not brand-derived: an error must stay legible no matter
        // what the owner sets in Branding. Measured 7.7:1. (asserted by
        // _harness/plan3-contact.js)
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        color: "#991b1b",
        // tabIndex is -1, so this is never keyboard-reachable — a focus outline
        // would only ever appear on a programmatic focus of a block of text,
        // where it reads as a glitch. The panel is already the loudest thing on
        // screen.
        //
        // Careful writing prose in this file: Tailwind's extractor scans raw
        // text, comments included, so a bare utility-class word in a sentence
        // emits that whole rule into the shipped CSS. An earlier draft of this
        // very comment added one.
        outline: "none",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{formError.message}</span>
    </div>
  ) : null;

  // H-4 fix: stable handler factory — useCallback prevents new function refs every render
  const makeOnChange = useCallback(
    (setter) => (e) =>
      setter((prev) => ({ ...prev, [e.target.name]: e.target.value })),
    [],
  );

  // General message form state
  const [msgForm, setMsgForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    subject: "",
    message: "",
  });
  const onMsgChange = makeOnChange(setMsgForm);
  const onMsgSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const body = new FormData(e.target);
      body.append("form_type", "message");
      const res  = await fetch("/contact.php", { method: "POST", body });
      const json = await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }));
      if (json.ok) {
        setSubmittedTab("message");
        // B17 — pushed, so Back returns to the form. `submitted` is derived
        // from this param; see the note where sentParam is declared.
        setSentParam("1");
      } else {
        // The server's message is specific — which field, or which guard was
        // hit, with the phone number in it. Keep it verbatim; cf.submitError is
        // only the fallback for a response that carried none.
        setFormError({ kind: "validation", message: json.error || localizeProse(cf.submitError, site) });
      }
    } catch {
      setFormError({ kind: "network", message: localizeProse(cf.networkError, site) });
    } finally {
      setSubmitting(false);
    }
  };

  // RFQ form state
  const [rfqForm, setRfqForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    partNumber: prefillPart || "",
    material: "",
    quantity: "",
    requiredDate: "",
    specialReqs: "",
    additionalNotes: prefillIndustry ? `Industry: ${prefillIndustry}` : "",
  });
  const onRfqChange = makeOnChange(setRfqForm);
  const onRfqSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const body = new FormData(e.target);
      body.append("form_type", "rfq");
      const res  = await fetch("/contact.php", { method: "POST", body });
      const json = await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }));
      if (json.ok) {
        setSubmittedTab("rfq");
        // B17 — pushed, so Back returns to the form. `submitted` is derived
        // from this param; see the note where sentParam is declared.
        setSentParam("1");
      } else {
        setFormError({ kind: "validation", message: json.error || localizeProse(cf.submitError, site) });
      }
    } catch {
      setFormError({ kind: "network", message: localizeProse(cf.networkError, site) });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 16,
    border: "1px solid #d1d9e0",
    color: "#141414",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  };
  const focusStyle = (e) => {
    e.target.style.borderColor = "var(--brand-primary)";
    e.target.style.boxShadow = "0 0 0 3px rgba(var(--brand-primary-rgb),0.1)";
  };
  const blurStyle = (e) => {
    e.target.style.borderColor = "#d1d9e0";
    e.target.style.boxShadow = "none";
  };

  // Icons stay module-level (created once); text is overlaid from live site info.
  const contactCards = CONTACT_CARDS.map((card) => {
    if (card.title === "Phone") return { ...card, info: site.contact.phone, href: `tel:${site.contact.phoneDial}`, sub: site.hours.text };
    // No href: a fax number is not dialable from a phone. (4.8)
    if (card.title === "Fax") return { ...card, info: site.contact.fax, href: null };
    if (card.title === "Email") return { ...card, info: site.contact.email, href: `mailto:${site.contact.email}` };
    if (card.title === "Address") return { ...card, info: site.address.street, sub: `${site.address.city}, ${site.address.state} ${site.address.zip}` };
    return card;
    // A cleared Fax removes the card entirely rather than showing an empty
    // one with a fax icon and no number. (AUDIT_v3_FINDINGS NB4)
  }).filter((card) => card.info);

  if (submitted) {
    return (
      // B18 — no minHeight:100vh here.
      //
      // The 330px of dead air between the buttons and the footer was not the
      // panel's padding, which is what it looked like: it was this wrapper
      // being forced to a full viewport while holding about 500px of content.
      // Reducing the padding first made the gap BIGGER (360 -> 376), which is
      // what pointed at the container. The app shell is already
      // `min-h-screen flex flex-col` with the footer last, so the viewport is
      // covered without this and the footer simply rises to meet the content.
      <div style={{ background: "#f5f7fa" }}>
        <div className="ipc-page-header">
          <div className="max-w-7xl mx-auto px-6 py-12">
            {/* B18 — this was the only page header on the site with no eyebrow
                above its h1. */}
            <PageEyebrow>Request Sent</PageEyebrow>
            <h1
              className="text-4xl font-extrabold"
              style={{ color: "var(--brand-header-ink)" }}
            >
              {submittedTab === "rfq"
                ? cf.rfqSuccessTitle
                : cf.msgSuccessTitle}
            </h1>
          </div>
        </div>
        {/* B16 — announced, and takes focus.
            role="status" (implicitly aria-live="polite") rather than "alert":
            a completed submission is not an interruption, and the error path
            already owns the assertive register. tabIndex={-1} makes the panel
            focusable programmatically without adding a tab stop; the effect
            above moves focus here on the swap, so a screen reader lands on the
            confirmation instead of being left at <body> with the form gone.
            B18 — py-12, not py-24. The old padding left 360px of empty page
            between the buttons and the footer. */}
        <div
          ref={successRef}
          role="status"
          aria-live="polite"
          tabIndex={-1}
          className="ipc-fade-up max-w-lg mx-auto px-6 py-12 text-center"
          style={{ outline: "none" }}
        >
          <div className="ipc-fade-up mb-6 flex justify-center" aria-hidden="true">
            {/* B18 — an inline SVG, not an emoji. Emoji coverage is a font
                dependency: the 📧 in this very panel rendered as a tofu box on
                the audit machine, so the one line telling a visitor how to
                reach sales urgently had a missing glyph in it. */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="56" height="56" viewBox="0 0 24 24"
              fill="none" stroke="var(--brand-primary)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="8.5,12.5 11,15 16,9.5" />
            </svg>
          </div>
          <h2
            className="ipc-fade-up-1 text-2xl font-bold mb-3"
            style={{ color: "#141414" }}
          >
            {cf.successThanks}
          </h2>
          <p
            className="ipc-fade-up-2 text-sm mb-4"
            style={{ color: "#4b5563" }}
          >
            {submittedTab === "rfq"
              ? cf.rfqSuccessBody
              : cf.msgSuccessBody}
          </p>
          <p
            className="ipc-fade-up-2 text-xs mb-8"
            style={{ color: "#4b5563" }}
          >
            {/* B18 — the emoji are gone. 📧 rendered as a tofu box, so this
                line read "📞 630.771.0700 · 📠 630.771.0701 · ▯ sales@…" at the
                exact moment a visitor might want to make contact urgently. The
                labels are words now: they need no font coverage, and they read
                correctly to a screen reader, which announced nothing useful
                for the pictographs.
                Phone and email were already real links and stay that way; fax
                stays plain text, which is deliberate (PLAN-1 4.8). */}
            {cf.urgentPrefix}{" "}
            <span>Phone </span>
            <a href={`tel:${site.contact.phoneDial}`} style={{ color: "#4b5563" }}>{site.contact.phone}</a>
            {site.contact.fax ? (
              <>{" · "}<span>Fax </span><span style={{ color: "#4b5563" }}>{site.contact.fax}</span></>
            ) : null}
            {" · "}
            <span>Email </span>
            <a href={`mailto:${site.contact.email}`} style={{ color: "#4b5563" }}>{site.contact.email}</a>
          </p>
          <div className="ipc-fade-up-3 flex gap-3 justify-center">
            <button
              className="text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
              style={{
                background: "var(--brand-primary)",
                color: "var(--brand-primary-ink)",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => {
                // Clearing the param IS leaving the confirmation, because
                // `submitted` is derived from it. replace:true here on purpose
                // — this is the "strip the param" pattern T2.3 is about, and
                // pushing would make Back re-enter the confirmation.
                setSentParam(null, { replace: true });
                setRfqForm({
                  name: "",
                  email: "",
                  phone: "",
                  company: "",
                  partNumber: "",
                  material: "",
                  quantity: "",
                  requiredDate: "",
                  specialReqs: "",
                  additionalNotes: "",
                });
                setMsgForm({
                  name: "",
                  email: "",
                  phone: "",
                  company: "",
                  subject: "",
                  message: "",
                });
              }}
            >
              Submit Another
            </button>
            <PageLink
              page="products"
              className="text-sm font-medium px-5 py-2.5 rounded transition-all"
              style={{
                display: "inline-block",
                background: "transparent",
                color: "var(--brand-primary-text)",
                border: "1px solid var(--brand-primary)",
                cursor: "pointer",
              }}
            >
              Browse Products
            </PageLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <PageEyebrow>
            {c.eyebrow}
          </PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            {c.title}
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            {c.intro}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* B26 — the form is FIRST in the DOM, and `lg:order-2` puts it back on
            the right at desktop width.
            It used to come second, after the contact rail and the "for fastest
            response" panel, which at 390px left the first form field 1,213px
            down a 3,331px page — four cards and a tip panel to scroll past
            before reaching the thing the page exists for.
            The DOM moved rather than the CSS. A `order`-only reorder leaves
            keyboard focus following source order while the eye follows the
            layout, and on a stacked mobile column that is a genuine trap:
            you tab "down" and the focus indicator jumps to the bottom of the
            page. (Not the other word for that indicator — it is a Tailwind
            utility name and writing it emits the rule. Sixth occurrence.)
            PLAN-8 calls this out and plan8-lead asserts it.
            The consequence at desktop, stated rather than hidden: focus now
            reaches the form before the contact rail. Both columns are visible
            at once there, the form is the page's purpose, and nothing is
            skipped — a fair trade for fixing the stacked case. */}
        {/* Right — tabbed forms */}
        <div className="lg:col-span-2 lg:order-2">
          {/* B26 — a mobile-only call strip.
              Putting the form first solved one conversion path and broke the
              other: the phone card used to be the first thing on the page at
              390 and moving the rail below the form pushed it under about
              2,000px of fields. PLAN-8 says to keep the number near the top,
              and this is the smallest way to honour that.
              Not a duplicate of the rail — one line, two links, no cards, and
              `lg:hidden` so desktop never sees it. Duplicating the rail itself
              is what PLAN-8 rules out. */}
          <div
            className="lg:hidden mb-5 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
            style={{ background: "#ffffff", border: "1px solid #e5e9ee" }}
          >
            <span
              style={{
                font: "10px ui-monospace, SFMono-Regular, Menlo, monospace",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--brand-accent-text)",
              }}
            >
              {c.directTitle}
            </span>
            {site.contact.phoneDial && (
              <a
                href={`tel:${site.contact.phoneDial}`}
                className="text-sm font-semibold"
                style={{ color: "var(--brand-primary-text)", textDecoration: "none" }}
              >
                {site.contact.phone}
              </a>
            )}
            {site.contact.email && (
              <a
                href={`mailto:${site.contact.email}`}
                className="text-sm"
                style={{ color: "#4b5563", textDecoration: "none" }}
              >
                {site.contact.email}
              </a>
            )}
          </div>
          {/* Tab switcher — clear active/inactive contrast */}
          <div
            className="flex flex-col sm:flex-row mb-6 rounded-xl overflow-hidden"
            style={{
              border: "1px solid #d1d9e0",
              boxShadow: "0 1px 4px rgba(var(--brand-primary-rgb),0.06)",
            }}
          >
            {[
              {
                id: "rfq",
                label: cf.rfqTab,
                sub: cf.rfqTabSub,
              },
              {
                id: "message",
                label: cf.msgTab,
                sub: cf.msgTabSub,
              },
            ].map((tab, i) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setFormError(null);   // the other form's failure is not this form's
                  }}
                  aria-pressed={active}
                  className="border-b sm:border-b-0 sm:border-r border-gray-200 last:border-b-0 sm:last:border-r-0"
                  style={{
                    flex: 1,
                    padding: "18px 22px",
                    textAlign: "left",
                    cursor: "pointer",
                    background: active ? "var(--brand-primary)" : "#f5f7fa",
                    borderTop: active
                      ? "3px solid var(--brand-accent)"
                      : "3px solid transparent",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "#eef1f5";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "#f5f7fa";
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: active ? "var(--brand-primary-ink)" : "#141414",
                    }}
                  >
                    {tab.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 3,
                      // B9/B10 family — 0.85, was 0.70. The tab subtitle
                      // composited to 4.15:1 on the active tab's brand-primary
                      // fill. Raising the ALPHA of the ink is palette-safe in a
                      // way that picking a colour is not: --brand-primary-ink
                      // is already computed to contrast with --brand-primary,
                      // so more of it is monotonically more contrast whichever
                      // polarity the owner's palette has.
                      color: active ? "rgba(var(--brand-primary-ink-rgb), 0.85)" : "#6b7280",
                    }}
                  >
                    {tab.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tab 1 — RFQ form.
              C40 — method and action, so the no-JS path degrades to a real
              submission instead of leaking the lead into the URL.
              With neither attribute a form defaults to GET against the current
              address: if the bundle fails, submitting put the sender's name,
              email and message into the query string and reloaded the page.
              The enquiry was lost and the PII went into history, and into any
              proxy or server log along the way.
              contact.php reads $_POST directly and these field names already
              match it, so the lead is captured by the same code path the fetch
              uses. It answers with JSON rather than a styled page — the
              enquiry arriving matters more than what the fallback looks like,
              and changing the response contract means touching a file that
              deliberately does not HTML-escape (invariant 10).
              This comment lives HERE, not after the `&&`: that position is a
              JS expression, where {\/* *\/} is not a comment and breaks the
              build. */}
          {activeTab === "rfq" && (
            <form
              method="post"
              action="/contact.php"
              onSubmit={onRfqSubmit}
              className="bg-white rounded-2xl p-5 sm:p-8 space-y-5"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 4px 24px rgba(var(--brand-primary-rgb),0.07)",
              }}
            >
              {/* C39 — the `*` legend. First in the form, so the convention is
                  explained BEFORE the first label that uses it rather than
                  after the visitor has had to infer it. */}
              <p className="text-xs" style={{ color: "#4b5563", margin: 0 }}>
                {cf.requiredLegend}
              </p>
              {/* Honeypot — hidden from humans, bots fill it in */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="rfq-website">Website</label>
                <input type="text" id="rfq-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div>
                <div
                  className="text-base font-bold mb-1"
                  style={{ color: "#141414" }}
                >
                  {cf.rfqHeading}
                </div>
                <div className="text-xs" style={{ color: "#4b5563" }}>
                  {cf.rfqIntro}
                </div>
              </div>

              {/* Contact details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: cf.nameLabel,
                    name: "name",
                    type: "text",
                    placeholder: cf.namePlaceholder,
                    required: true,
                    autoComplete: "name",
                  },
                  {
                    label: cf.emailLabel,
                    name: "email",
                    type: "email",
                    placeholder: cf.emailPlaceholder,
                    required: true,
                    autoComplete: "email",
                  },
                  {
                    label: cf.phoneLabel,
                    name: "phone",
                    type: "tel",
                    placeholder: cf.phonePlaceholder,
                    required: false,
                    autoComplete: "tel",
                  },
                  {
                    label: cf.companyLabel,
                    name: "company",
                    type: "text",
                    placeholder: cf.companyPlaceholder,
                    required: false,
                    autoComplete: "organization",
                  },
                ].map((f) => (
                  <div key={f.name}>
                    {/* htmlFor/id pairing — all 10 controls on the only revenue
                        page were unlabelled; the ONLY correctly-labelled input
                        was the honeypot. (DEPLOY_READINESS_v2 4.4) */}
                    <label
                      htmlFor={`rfq-${f.name}`}
                      className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                      style={{ color: "#6b7280" }}
                    >
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      id={`rfq-${f.name}`}
                      name={f.name}
                      value={rfqForm[f.name]}
                      onChange={onRfqChange}
                      required={f.required}
                      placeholder={f.placeholder}
                      autoComplete={f.autoComplete}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "#e5e9ee" }} />

              {/* Product details */}
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--brand-primary-text)" }}
              >
                {cf.productDetailsTitle}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="rfq-partNumber"
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    {cf.partLabel}
                  </label>
                  <input
                    id="rfq-partNumber"
                    type="text"
                    name="partNumber"
                    value={rfqForm.partNumber}
                    onChange={onRfqChange}
                    placeholder={cf.partPlaceholder}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    htmlFor="rfq-material"
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    {cf.materialLabel}
                  </label>
                  <input
                    id="rfq-material"
                    type="text"
                    name="material"
                    value={rfqForm.material}
                    onChange={onRfqChange}
                    placeholder={cf.materialPlaceholder}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    htmlFor="rfq-quantity"
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    {cf.quantityLabel}
                  </label>
                  <input
                    id="rfq-quantity"
                    type="text"
                    name="quantity"
                    value={rfqForm.quantity}
                    onChange={onRfqChange}
                    required
                    placeholder={cf.quantityPlaceholder}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    htmlFor="rfq-requiredDate"
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    {cf.dateLabel}
                  </label>
                  <input
                    id="rfq-requiredDate"
                    type="text"
                    name="requiredDate"
                    value={rfqForm.requiredDate}
                    onChange={onRfqChange}
                    placeholder={cf.datePlaceholder}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="rfq-specialReqs"
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  {cf.specialLabel}
                </label>
                <input
                  id="rfq-specialReqs"
                  type="text"
                  name="specialReqs"
                  value={rfqForm.specialReqs}
                  onChange={onRfqChange}
                  placeholder={cf.specialPlaceholder}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <div>
                <label
                  htmlFor="rfq-additionalNotes"
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  {cf.notesLabel}
                </label>
                <textarea
                  id="rfq-additionalNotes"
                  name="additionalNotes"
                  value={rfqForm.additionalNotes}
                  onChange={onRfqChange}
                  rows={3}
                  placeholder={cf.notesPlaceholder}
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              {/* Above the submit control, inside the form — where the visitor
                  already is when it fails. Replaces the alert dialog. (4.5) */}
              {errorRegion}
              {/* C39 — the privacy note, immediately above submit: the moment
                  the visitor decides whether to hand over their details. The
                  link is appended in code rather than being part of the
                  owner's string, so retyping the note cannot break the link
                  or point it somewhere else. */}
              <p className="text-xs" style={{ color: "#4b5563", margin: 0 }}>
                {cf.privacyNote}{" "}
                <PageLink
                  page="privacy"
                  style={{
                    color: "var(--brand-primary-text)",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  Privacy Policy
                </PageLink>
                .
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-lg font-semibold text-sm ipc-ink-primary transition-all hover:brightness-110"
                style={{
                  background: "var(--brand-primary)",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.85 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <span className="ipc-btn-spinner" />
                    {cf.sendingLabel}
                  </>
                ) : (
                  cf.submitRfq
                )}
              </button>
            </form>
          )}

          {/* Tab 2 — General message form */}
          {activeTab === "message" && (
            <form
              method="post"
              action="/contact.php"
              onSubmit={onMsgSubmit}
              className="bg-white rounded-2xl p-5 sm:p-8 space-y-5"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 4px 24px rgba(var(--brand-primary-rgb),0.07)",
              }}
            >
              {/* C39 — the `*` legend. First in the form, so the convention is
                  explained BEFORE the first label that uses it rather than
                  after the visitor has had to infer it. */}
              <p className="text-xs" style={{ color: "#4b5563", margin: 0 }}>
                {cf.requiredLegend}
              </p>
              {/* Honeypot — hidden from humans, bots fill it in */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="msg-website">Website</label>
                <input type="text" id="msg-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div>
                <div
                  className="text-base font-bold mb-1"
                  style={{ color: "#141414" }}
                >
                  {cf.msgHeading}
                </div>
                <div className="text-xs" style={{ color: "#4b5563" }}>
                  {cf.msgIntro}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: cf.nameLabel,
                    name: "name",
                    type: "text",
                    placeholder: cf.namePlaceholder,
                    required: true,
                    autoComplete: "name",
                  },
                  {
                    label: cf.emailLabel,
                    name: "email",
                    type: "email",
                    placeholder: cf.emailPlaceholder,
                    required: true,
                    autoComplete: "email",
                  },
                  {
                    label: cf.phoneLabel,
                    name: "phone",
                    type: "tel",
                    placeholder: cf.phonePlaceholder,
                    required: false,
                    autoComplete: "tel",
                  },
                  {
                    label: cf.companyLabel,
                    name: "company",
                    type: "text",
                    placeholder: cf.companyPlaceholder,
                    required: false,
                    autoComplete: "organization",
                  },
                ].map((f) => (
                  <div key={f.name}>
                    <label
                      htmlFor="rfq-subject"
                      className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                      style={{ color: "#6b7280" }}
                    >
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      name={f.name}
                      value={msgForm[f.name]}
                      onChange={onMsgChange}
                      required={f.required}
                      placeholder={f.placeholder}
                      autoComplete={f.autoComplete}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  {cf.subjectLabel}
                </label>
                <input
                  id="rfq-subject"
                  type="text"
                  name="subject"
                  value={msgForm.subject}
                  onChange={onMsgChange}
                  required
                  placeholder={cf.subjectPlaceholder}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <div>
                <label
                  htmlFor="rfq-message"
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  {cf.messageLabel}
                </label>
                <textarea
                  id="rfq-message"
                  name="message"
                  value={msgForm.message}
                  onChange={onMsgChange}
                  required
                  rows={5}
                  placeholder={cf.messagePlaceholder}
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              {errorRegion}
              {/* C39 — the same privacy note as the quote tab. Both forms
                  collect the same personal details, so both say so. */}
              <p className="text-xs" style={{ color: "#4b5563", margin: 0 }}>
                {cf.privacyNote}{" "}
                <PageLink
                  page="privacy"
                  style={{
                    color: "var(--brand-primary-text)",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  Privacy Policy
                </PageLink>
                .
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-lg font-semibold text-sm ipc-ink-primary transition-all hover:brightness-110"
                style={{
                  background: "var(--brand-primary)",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.85 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <span className="ipc-btn-spinner" />
                    {cf.sendingLabel}
                  </>
                ) : (
                  cf.submitMsg
                )}
              </button>
            </form>
          )}
        </div>

        {/* Left sidebar — contact cards + tips.
            `lg:order-1` keeps it on the left at desktop width despite now being
            second in the DOM — see the B26 note on the form block above. */}
        <div className="space-y-4 lg:order-1">
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "var(--brand-primary-text)" }}
          >
            {c.directTitle}
          </h2>
          {contactCards.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl p-4 flex gap-3 items-start"
              style={{ border: "1px solid #e5e9ee" }}
            >
              <span
                className="flex items-center justify-center rounded-lg text-sm flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgba(var(--brand-primary-rgb),0.07)",
                  color: "var(--brand-primary-text)",
                }}
              >
                {item.icon}
              </span>
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-wide mb-0.5"
                  style={{ color: "#6b7280" }}
                >
                  {item.title}
                </div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: "#141414" }}
                >
                  {item.href ? (
                    <a href={item.href} style={{ color: "#141414", textDecoration: "none" }}
                       onMouseEnter={e => e.currentTarget.style.color = "var(--brand-primary-text)"}
                       onMouseLeave={e => e.currentTarget.style.color = "#141414"}>
                      {item.info}
                    </a>
                  ) : item.info}
                </div>
                <div className="text-xs" style={{ color: "#4b5563" }}>
                  {item.sub}
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-xl p-5" style={{ background: "var(--brand-dark)" }}>
            <div className="text-xs font-bold ipc-ink-dark mb-3 uppercase tracking-wide">
              {cf.tipsTitle}
            </div>
            <ul className="space-y-1.5">
              {contactTips.map(({ text: tip }, i) => (
                <li
                  key={`${i}-${tip}`}
                  className="flex items-start gap-2 text-xs"
                  style={{ color: "rgba(var(--brand-dark-ink-rgb), 0.60)" }}
                >
                  <span
                    style={{ color: "var(--brand-accent1-on-dark)", marginTop: 1, flexShrink: 0 }}
                  >
                    →
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Storage URL for the consolidated IPC product catalog.
 *
 * Reads from /data/products-all.json on the same origin. That file is
 * managed live by the PHP admin at /admin/ — edits there appear here as
 * soon as the 5-minute Apache cache (see /data/.htaccess) clears, or
 * immediately on a hard refresh.
 *
 * NOTE: /data/ is NOT part of the Vite build output (no longer in /public),
 * so rebuilding the React app cannot clobber the live catalog on the server.
 * On first deploy, FTP /data/products-all.json into public_html/data/ once.
 */
// All three runtime JSON files are read from /data/ in BOTH modes. Dev used to
// point at a public/products-all.json snapshot; that was a fourth copy of the
// catalog, it drifted from data/ silently, and when it was finally deleted this
// branch pointed at nothing. vite.config.js now serves the real data/ folder in
// dev, so there is no special case left to rot. (AUDIT_v3 4.24)
const PRODUCTS_JSON_URL = "/data/products-all.json";

/**
 * The canonical origin, asserted in one place.
 *
 * Deliberately a constant and NOT window.location.origin: dev, the php -S
 * mirror and production would each declare themselves canonical, and a staging
 * copy that self-canonicalises is worse than one pointing at the wrong host.
 *
 * `www` matches every other declaration in the repo — the $ORIGIN in
 * public/sitemap.php (which generates every <loc>), public/robots.txt's
 * Sitemap: line, and index.html's shipped og:url. If the apex is ever chosen
 * instead, this constant and those three files must change together.
 */
const SITE_ORIGIN = "https://www.insulationproducts.com";

/**
 * The canonical absolute URL for a route — ONE definition.
 *
 * C33 needs this because its acceptance is that the BreadcrumbList's trailing
 * item equals the page's own <link rel="canonical">, and two independent
 * constructions of the same URL is exactly how those stop agreeing. PageMeta
 * built it inline before this existed.
 *
 * `encodeURIComponent`, not URLSearchParams, and the difference is real rather
 * than cosmetic: nine product ids contain a space, a "/" or an "&"
 * ("IP12GA - IP1274", "IP41NE / IP43VT", "IP44A2 & IP45A3"). URLSearchParams
 * writes a space as "+", which resolves to the same page but is a DIFFERENT
 * STRING, and a canonical is compared as a string by everything that consumes
 * it. pageHref() still uses URLSearchParams for rendered hrefs — that is the
 * router's own encoding and must not change; this is the declaration layer.
 *
 * productId is the only param included, for the reason PageMeta gives below:
 * every other param is a view of the same document, not a separate one.
 */
function canonicalFor(page, productId) {
  return (
    SITE_ORIGIN +
    pageToPath(page) +
    (productId ? `?productId=${encodeURIComponent(productId)}` : "")
  );
}

/**
 * C33 — the breadcrumb trail and its BreadcrumbList JSON-LD.
 *
 * `nav[aria-label*=breadcrumb]` returned nothing on all 10 routes before this.
 * On a 42-product catalog with a deep-linkable detail view that is the
 * standard orientation cue, and the structured-data half is what puts the
 * trail into a search result in place of a bare URL.
 *
 * `trail` is [{ label, page, params }], the last entry being the current page.
 * It is rendered with PageLink so every crumb is a real crawlable <a href>
 * (4.21) rather than a click handler on a div.
 *
 * The trailing crumb is not a link — it is where you already are — and it
 * carries aria-current="page". Its JSON-LD `item` is canonicalFor(), so it
 * agrees with the page's own canonical byte for byte; the intermediate crumbs
 * use pageHref(), because a filtered view like /dashboard?family=Tape is a
 * real destination that has no canonical of its own.
 *
 * Nothing renders for a trail of fewer than two entries: a lone "Home" is
 * noise, and emitting a one-item BreadcrumbList is worse than emitting none.
 */
function Breadcrumb({ trail }) {
  const items = Array.isArray(trail) ? trail.filter((c) => c && c.label) : [];
  const enough = items.length >= 2;

  // A stable primitive dep. The array is rebuilt on every render, so depending
  // on it directly would tear down and re-append the <script> each time — the
  // mistake AUDIT_v3 4.1 caught in the FAQ's structured data.
  const key = items.map((c) => `${c.label}|${c.page}|${JSON.stringify(c.params || {})}`).join(">");

  useEffect(() => {
    if (!enough) return undefined;
    const el = document.createElement("script");
    el.id = "breadcrumb-ld";
    el.type = "application/ld+json";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.label,
        item:
          i === items.length - 1
            ? canonicalFor(c.page, c.params && c.params.productId)
            : SITE_ORIGIN + pageHref(c.page, c.params),
      })),
    });
    // Remove before appending so a re-run cannot leave two nodes behind —
    // duplicate structured data is a worse error than stale structured data.
    document.getElementById("breadcrumb-ld")?.remove();
    document.head.appendChild(el);
    return () => { document.getElementById("breadcrumb-ld")?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enough]);

  if (!enough) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ fontSize: 12 }}>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}-${c.label}`} className="flex items-center gap-x-2">
              {i > 0 && (
                <span aria-hidden="true" style={{ color: "rgba(var(--brand-header-ink-rgb), 0.45)" }}>
                  ›
                </span>
              )}
              {last ? (
                <span
                  aria-current="page"
                  style={{ color: "var(--brand-header-ink)", fontWeight: 600 }}
                >
                  {c.label}
                </span>
              ) : (
                <PageLink
                  page={c.page}
                  params={c.params}
                  style={{
                    color: "rgba(var(--brand-header-ink-rgb), 0.8)",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  {c.label}
                </PageLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * A missing or misrouted JSON file is not reliably an HTTP error. Vite's dev
 * server answers an unknown path with index.html and a 200, and a misconfigured
 * host can do the same, so `res.ok` is true and the only symptom is a JSON
 * syntax error thrown deep inside a .then(). Assert the content type at the
 * boundary instead, so the caller's existing error path runs: the catalog shows
 * its "Catalog Unavailable" screen, and the two providers keep their defaults
 * so the phone number never disappears (invariant 8).
 */
function jsonOrThrow(res, what) {
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${what}`);
  const type = res.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw new Error(`Expected JSON for ${what}, got "${type || "no content-type"}"`);
  }
  return res.json();
}

/**
 * Global typography CSS — ensures consistent heading scales across all pages.
 * Injected once into the document head on first render.
 */
function GlobalStyles() {
  useEffect(() => {
    const id = "ipc-global-styles";
    if (document.getElementById(id)) return; // already injected
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      /* Tap-target utility — ensures interactive controls meet WCAG 2.5.5 44x44 */
      .ipc-tap { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; }
      /* Page dark-header h1 — responsive clamp scale (overrides Tailwind text-4xl) */
      .ipc-page-h1,
      h1.text-4xl { font-size: clamp(1.75rem, 3.5vw, 2.5rem) !important; font-weight: 800 !important; line-height: 1.15 !important; }
      /* Section h2 — one size down */
      .ipc-section-h2, h2.text-3xl { font-size: clamp(1.4rem, 2.8vw, 1.875rem) !important; font-weight: 800 !important; line-height: 1.2 !important; }
      /* Hero h1 stays larger — uses clamp() directly so leave alone */
      /* Marquee animation */
      @keyframes ipc-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      .ipc-marquee-track { display: flex; width: max-content; animation: ipc-marquee 32s linear infinite; }
      .ipc-marquee-track:hover,
      .ipc-marquee-track:focus-within { animation-play-state: paused; }

      /* B14 — honour prefers-reduced-motion.
         src/index.css had a reduced-motion block that disabled exactly one
         thing, .ipc-skeleton, and the marquee scrolled straight through it.
         Measured under an emulated reduce preference: one infinite animation
         still running.
         The track also has to stop being a track. Its width is max-content so
         a 5,012px strip can slide; with the animation off and only one copy of
         the items rendered (see Hero), it wraps and centres instead, which is
         a readable certification strip rather than a frozen ribbon with its
         right-hand half off-screen.
         The submit-button spinner is the THIRD infinite animation on the site
         and the audit named only one. Its override is not here but immediately
         after .ipc-btn-spinner is declared, further down this same stylesheet:
         a media query adds no specificity, so a rule placed before the
         declaration it is trying to beat simply loses the cascade. Putting it
         here looked right and did nothing. */
      @media (prefers-reduced-motion: reduce) {
        .ipc-marquee-track,
        .ipc-marquee-static { animation: none; }
        .ipc-marquee-static {
          width: 100%;
          flex-wrap: wrap;
          justify-content: center;
          row-gap: 4px;
        }
      }
      /* Brand gradient page header — replaces #141414 dark headers on content pages */
      .ipc-page-header { background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent-2) 100%) !important; }
      .ipc-page-header > div {
        padding-top: 32px !important;
        padding-bottom: 32px !important;
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      @media (min-width: 768px) {
        .ipc-page-header > div {
          padding-top: 48px !important;
          padding-bottom: 48px !important;
          padding-left: 24px !important;
          padding-right: 24px !important;
        }
      }
      /* StatsBar responsive dividers — only bottom border needed (right uses Tailwind divide-x) */
      .ipc-stat-bottom-border { border-bottom: 1px solid #e5e9ee; }
      @media (min-width: 768px) { .ipc-stat-bottom-border { border-bottom: none !important; } }
      /* Dropdown entrance — scale + fade from top */
      @keyframes ipc-dropdown-in {
        from { opacity: 0; transform: scale(0.97) translateY(-4px); }
        to   { opacity: 1; transform: scale(1)    translateY(0); }
      }
      .ipc-dropdown-panel {
        animation: ipc-dropdown-in 0.14s cubic-bezier(0.16, 1, 0.3, 1) both;
        transform-origin: top center;
      }

      /* Arrow microinteraction — global class applied via JS query */
      .ipc-btn-arrow { display: inline-block; transition: transform 0.2s ease; }

      /* Button submit spinner */
      @keyframes ipc-btn-spin {
        to { transform: rotate(360deg); }
      }
      .ipc-btn-spinner {
        display: inline-block; width: 13px; height: 13px;
        border: 2px solid rgba(255,255,255,0.35);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: ipc-btn-spin 0.7s linear infinite;
        vertical-align: middle; margin-right: 6px;
      }
      /* B14 — must sit AFTER the declaration above. A media query contributes
         no specificity, so this rule wins only on source order. The spinner
         stays drawn as a static circle and the button keeps its text label,
         so a visitor who asked for less motion still sees that something is
         in flight. */
      @media (prefers-reduced-motion: reduce) {
        .ipc-btn-spinner { animation: none; }
      }

      /* .ipc-skeleton and .ipc-page-header now live in src/index.css — they are
         needed BEFORE this component mounts. GlobalStyles renders inside the
         tree that only mounts after loading finishes, so defining the skeleton
         here meant it was styleless in the exact situation it exists for: on a
         throttled connection the visitor saw 53 invisible skeleton elements,
         i.e. a blank page. (DEPLOY_READINESS_v2 T2.10) */

      /* Contact success fade-in */
      @keyframes ipc-fade-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
      .ipc-fade-up   { animation: ipc-fade-up 0.4s ease both; }
      .ipc-fade-up-1 { animation: ipc-fade-up 0.4s ease 0.1s both; }
      .ipc-fade-up-2 { animation: ipc-fade-up 0.4s ease 0.2s both; }
      .ipc-fade-up-3 { animation: ipc-fade-up 0.4s ease 0.3s both; }

      /* ── IPC Custom Scrollbar — matches brand palette ─────────────────
         Webkit (Chrome, Safari, Edge): full custom styling.
         Firefox: uses scrollbar-color with accent colors.
      ──────────────────────────────────────────────────────────────────── */

      /* Scrollbar track (background channel) */
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track {
        background: #f0f4f8;
        border-radius: 8px;
      }

      /* Scrollbar thumb (draggable handle) */
      ::-webkit-scrollbar-thumb {
        background: var(--brand-primary);
        border-radius: 8px;
        border: 2px solid #f0f4f8; /* gap between thumb and track */
        transition: background 0.2s;
      }
      ::-webkit-scrollbar-thumb:hover { background: var(--brand-accent); }
      ::-webkit-scrollbar-thumb:active { background: var(--brand-accent-2); }

      /* Corner piece where horizontal and vertical scrollbars meet */
      ::-webkit-scrollbar-corner { background: #f0f4f8; }

      /* Firefox */
      * { scrollbar-width: thin; scrollbar-color: var(--brand-primary) #f0f4f8; }

      /* Narrower scrollbar for small scroll containers (sidebars, dropdowns) */
      .ipc-scroll-sm::-webkit-scrollbar { width: 4px; height: 4px; }
      .ipc-scroll-sm::-webkit-scrollbar-thumb { background: rgba(var(--brand-primary-rgb),0.4); border: none; }
      .ipc-scroll-sm::-webkit-scrollbar-thumb:hover { background: var(--brand-accent); }

      /* B27 — the catalog sidebar's scroll cue.
         The sidebar is max-height:80vh and its content is taller, but the only
         affordance was .ipc-scroll-sm's 4px thumb at 0.4 alpha, which is both
         too thin to read as a scrollbar and too faint to see. Every family
         accordion also opened on first paint, so the region was 2,932px of
         content in a 718px box and ten of the eleven category headings sat
         below an inner fold with nothing to suggest they existed.
         Collapsing by default (see ProductSidebar) does most of the work; this
         makes the remaining scroll visible rather than implied. Solid #64748b
         on the #f8fafc track measures 4.55:1 — the acceptance floor for a
         non-text affordance is 3:1. The scrollbar-color property covers
         Firefox, which ignores the ::-webkit- rules entirely.
         No backticks in this comment: GlobalStyles is a JS template literal
         and a backtick here ends the string. That is what broke the build the
         first time this was written. */
      .ipc-scroll-cue { scrollbar-width: thin; scrollbar-color: #64748b #f8fafc; }
      .ipc-scroll-cue::-webkit-scrollbar { width: 10px; height: 10px; }
      .ipc-scroll-cue::-webkit-scrollbar-track { background: #f8fafc; }
      .ipc-scroll-cue::-webkit-scrollbar-thumb {
        background: #64748b; border-radius: 5px; border: 2px solid #f8fafc;
      }
      .ipc-scroll-cue::-webkit-scrollbar-thumb:hover { background: #475569; }
    `;
    document.head.appendChild(el);
    return () => {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
    };
  }, []);
  return null;
}

/**
 * Module-level cache — products-all.json is fetched once per session.
 * Subsequent calls to useProducts() resolve immediately from this cache.
 */
let _productsCache = null;
let _productsFetchPromise = null;
// Aborts the catalog fetch rather than hanging on the skeleton forever.
const PRODUCTS_FETCH_TIMEOUT_MS = 12000;
// The cache never time-invalidated, so a visitor who left the tab open never
// saw an admin edit — contradicting the "~60 seconds" promise the admin shows
// after every save. (DEPLOY_READINESS_v2 4.25)
//
// Declaring this constant was not by itself the fix — see the visibilitychange
// effect at the bottom of useProducts(), which is what actually re-evaluates
// it. (AUDIT_v3_FINDINGS §3.1)
const PRODUCTS_CACHE_TTL_MS = 60000;
let _productsCacheAt = 0;

function fetchProductsCached() {
  if (_productsCache && Date.now() - _productsCacheAt < PRODUCTS_CACHE_TTL_MS) {
    return Promise.resolve(_productsCache);
  }
  if (_productsFetchPromise) return _productsFetchPromise;
  // Per-minute cache-buster so admin edits become visible within ~60s. The
  // matching data/.htaccess sets Cache-Control max-age=60 must-revalidate,
  // so this query stamp + the server header bound staleness at ~1 minute.
  // (The earlier daily granularity made admin edits invisible for up to 24h
  // because both browser and Apache caches keyed by URL stayed warm all day.)
  const cacheBuster = Math.floor(Date.now() / 60000);
  const url = `${PRODUCTS_JSON_URL}?v=${cacheBuster}`;
  // Hard timeout. An origin that accepts the connection and then hangs used to
  // leave the site on the loading skeleton forever, with no error and no retry.
  // (DEPLOY_READINESS_v2 T2.1)
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), PRODUCTS_FETCH_TIMEOUT_MS) : null;
  _productsFetchPromise = fetch(url, controller ? { signal: controller.signal } : undefined)
    .then((res) => jsonOrThrow(res, "product catalog"))
    .then((data) => {
      // Null guard: a truncated or partially-written file parses to `null`,
      // and `data.products` on null throws instead of degrading.
      const arr = Array.isArray(data)
        ? data
        : data && Array.isArray(data.products)
          ? data.products
          : [];
      if (timer) clearTimeout(timer);
      _productsCache = arr;
      _productsCacheAt = Date.now();
      _productsFetchPromise = null;
      return arr;
    })
    .catch((err) => {
      if (timer) clearTimeout(timer);
      _productsFetchPromise = null; // allow retry on next call
      throw err;
    });
  return _productsFetchPromise;
}

/**
 * Hook that fetches the live product catalog from OverAI storage.
 * Returns { products, loading, error }.
 * Cached after first fetch — subsequent calls are instant.
 */
function useProducts() {
  // Fix 13: if cache is empty array, treat as unloaded (allow retry)
  // A legitimately empty catalog shouldn't cache — there's always at least 1 product.
  const cacheIsValid =
    _productsCache !== null &&
    _productsCache.length > 0 &&
    Date.now() - _productsCacheAt < PRODUCTS_CACHE_TTL_MS;
  const [products, setProducts] = useState(() =>
    cacheIsValid ? _productsCache : [],
  );
  const [loading, setLoading] = useState(() => !cacheIsValid);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cacheIsValid) return; // already loaded with valid data — nothing to do
    let cancelled = false;
    fetchProductsCached()
      .then((arr) => {
        if (!cancelled) {
          setProducts(arr);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load products-all.json:", err);
          setError("Failed to load product catalog. Please try refreshing.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // PRODUCTS_CACHE_TTL_MS was INERT. It is only read inside fetchProductsCached()
  // and the guard above, useProducts() has one call site, it mounts once, and
  // this effect's deps are []. Nothing ever re-evaluated the TTL during a page
  // session, and across a full reload the module-level cache is reset anyway —
  // so the ~60 s bound that 4.25 claimed came entirely from the per-minute
  // cache-buster and data/.htaccess, neither of which is the TTL. Measured:
  // catalog edited on disk, 100 s of SPA navigation, still the old 41 products.
  //
  // Re-check when the tab is brought back to the front, which is exactly the
  // moment Rick switches from the admin to the live site to confirm his edit.
  // No polling, no work while the tab is hidden. (AUDIT_v3_FINDINGS §3.1 / NB3)
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let cancelled = false;
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - _productsCacheAt < PRODUCTS_CACHE_TTL_MS) return;
      fetchProductsCached()
        .then((arr) => {
          if (!cancelled && arr.length) {
            setProducts(arr);
            setError(null);
          }
        })
        .catch(() => { /* keep showing what we have; the next focus retries */ });
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, []);

  return { products, loading, error };
}

/* ─── Business details (site-info.json) ──────────────────────────────────────
 * Editable in the admin ("Business Details"). Fetched at runtime from the same
 * data/ folder the admin writes to, so edits appear on the site within ~60s.
 * SITE_DEFAULTS mirrors the current values so the site renders correctly even
 * if the file is briefly unavailable or a field is missing. */
const SITE_INFO_URL = "/data/site-info.json";

const SITE_DEFAULTS = {
  company: {
    name: "Insulation Products Corporation",
    shortName: "IPC",
    slogan: "Materials for the Electrical & Electronic Industry",
    foundedYear: "1974",
    description:
      "A major supplier of heat-shrinkable and extruded tubing, sleeving and adhesives for the electrical and electronic industry since 1974.",
  },
  contact: { phone: "630.771.0700", phoneDial: "+16307710700", fax: "630.771.0701", email: "sales@insulationproducts.com" },
  address: { street: "250 Gibraltar Dr", city: "Bolingbrook", state: "IL", zip: "60440", country: "US" },
  hours: { text: "Mon–Fri, 8am–5pm CT", opens: "08:00", closes: "17:00", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
  certifications: { iso: "ISO 9001", other: [] },
  stats: { feetInStock: "25 million", minimumOrder: "$50" },
  social: {
    twitter: "https://twitter.com/InsulProdCorp",
    facebook: "https://www.facebook.com/insulationproductscorporation",
    linkedin: "https://www.linkedin.com/company/insulation-products-corporation",
    youtube: "https://www.youtube.com/channel/UC0JRr_IxMwbRGOFZhbJGbNw",
    pinterest: "https://www.pinterest.com/insulprodcorp",
    // PLAN-6 item 4. Deliberately EMPTY, not a guessed URL: IPC has no account
    // on either, and a fabricated default would put a footer link to a
    // non-existent profile on a real business's site and feed it to search
    // engines through JSON-LD sameAs. Empty renders nothing; the owner fills
    // them in from Business Details if and when the accounts exist.
    instagram: "",
    tiktok: "",
  },
  about: {
    paragraphs: [
      "Insulation Products Corporation was incorporated on July 1, 1974, and has operated from Bolingbrook, Illinois ever since. As a privately held, independent distributor, IPC is a major stocking source for heat-shrinkable and extruded tubing, electrical sleeving, and industrial adhesives — serving engineers, purchasing teams, and OEMs across dozens of industries for over 50 years.",
      "With more than 25 million feet in stock and a $50 minimum order, IPC is built to serve both prototype quantities and full production runs. Most in-stock orders ship the same day or next business day. Our ISO 9001 registered quality system ensures every order is processed accurately — from receiving and inspection through picking, packing, and final shipment.",
      "Beyond standard stocking, IPC's in-house fabrication shop provides cut-to-length, hot-stamp marking, bar code printing, spooling, kitting, slitting, and perforation — all with a typical lead time of one week or less. JIT delivery programs and PPAP / IMDS documentation support are available for automotive and OEM customers.",
      "Our product line includes UL-recognized, CSA-listed, MIL-SPEC, AMS, FDA-compliant, and RoHS-certified materials. The customer is always number one — that commitment has defined IPC since day one and remains our core operating principle today.",
    ],
  },
  theme: {
    primaryColor: "#005da3",
    darkColor: "#0d2d52",
    accentColor: "#00bef2",
    accent2Color: "#119ec8",
    logoUrl: "/logo.svg",
  },
  catalogPdfUrl: "",
};

// Shallow-merge each top-level section over the defaults so any missing field
// falls back rather than rendering blank.
//
// INVARIANT: a blank string from site-info.json must NOT overwrite a default.
// admin/settings.php rebuilds site-info.json wholesale from $_POST, so any
// field the form omits arrives as "". Spreading those blanks over the defaults
// produced "© –2026" in the privacy footer, href="tel:" on all four
// click-to-call links, and an empty "faxNumber" in the JSON-LD. mergeContent()
// already dropped blanks; these two disagreed. (DEPLOY_READINESS_v2 T1.7)
//
// EXCEPTION LIST. The invariant above is right for anything the site renders as
// a link or interpolates into a sentence — an empty phone number is href="tel:"
// and an empty founding year is "© –2026", both worse than a stale value. It is
// wrong for the handful of fields where BLANK IS THE INTENDED VALUE and there is
// no way to express "we don't have one of these any more":
//   contact.fax          renders in 4 places + JSON-LD faxNumber. A distributor
//                        that drops its fax line could not remove the number.
//   social.*             JSON-LD sameAs only. A deleted account kept being
//                        advertised to search engines forever.
//   company.shortName    plain text, no link, no punctuation around it.
//   company.slogan       ditto.
// Clearing any of these in Business Details reported "Saved" and changed
// nothing. (AUDIT_v3_FINDINGS NB4 — and note NB4 explicitly says do NOT revert
// the blank-drop for everything else.)
const SITE_CLEARABLE = new Set([
  "contact.fax",
  "social.twitter",
  "social.facebook",
  "social.linkedin",
  "social.youtube",
  "social.pinterest",
  // Listed for the same reason as the five above even though their defaults are
  // already "" — the blank-drop only bites when the default is non-empty, so
  // this is inert today and becomes load-bearing the moment anyone gives either
  // of them a real default. Leaving them out would be a trap set for that day.
  "social.instagram",
  "social.tiktok",
  "company.shortName",
  "company.slogan",
]);

function mergeSiteInfo(data) {
  if (!data || typeof data !== "object") return SITE_DEFAULTS;
  const out = {};
  for (const k of Object.keys(SITE_DEFAULTS)) {
    const d = SITE_DEFAULTS[k];
    const v = data[k];
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const overrides = {};
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const key of Object.keys(v)) {
          const val = v[key];
          // Keep an explicitly-emptied ARRAY (that is a real deletion), but
          // drop null/undefined/"" scalars so they fall back to the default —
          // unless this field is one the owner is allowed to clear.
          if (val == null) continue;
          if (
            typeof val === "string" &&
            val.trim() === "" &&
            !SITE_CLEARABLE.has(`${k}.${key}`)
          ) {
            continue;
          }
          overrides[key] = val;
        }
      }
      out[k] = { ...d, ...overrides };
    } else if (Array.isArray(d)) {
      out[k] = Array.isArray(v) ? v : d;
    } else {
      out[k] = v != null && !(typeof v === "string" && v.trim() === "") ? v : d;
    }
  }
  return out;
}

// Swap the default contact values that appear inside prose (FAQ answers, policy
// text, etc.) for the current editable ones, so long-form copy stays in sync
// with the business details without templating every sentence.
function localizeProse(text, site) {
  if (!text || typeof text !== "string" || !site) return text;
  let out = text;
  const pairs = [
    [SITE_DEFAULTS.contact.phone, site.contact.phone],
    [SITE_DEFAULTS.contact.fax, site.contact.fax, true /* clearable */],
    [SITE_DEFAULTS.contact.email, site.contact.email],
    [
      `${SITE_DEFAULTS.address.street}, ${SITE_DEFAULTS.address.city}, ${SITE_DEFAULTS.address.state} ${SITE_DEFAULTS.address.zip}`,
      `${site.address.street}, ${site.address.city}, ${site.address.state} ${site.address.zip}`,
    ],
  ];
  for (const [from, to, clearable] of pairs) {
    // `to` may legitimately be "" for a clearable field. Without this, clearing
    // the fax number left the OLD one embedded in every FAQ answer and policy
    // paragraph that mentions it — the number he just deleted, still on the
    // site. (AUDIT_v3_FINDINGS NB4)
    if (!from || from === to) continue;
    if (to || clearable) out = out.split(from).join(to);
  }
  return out;
}

const SiteInfoContext = createContext(SITE_DEFAULTS);
// Let the class-based ErrorBoundary read live business details on its crash screen.
ErrorBoundary.contextType = SiteInfoContext;
function useSiteInfo() {
  return useContext(SiteInfoContext);
}

function SiteInfoProvider({ children }) {
  const [info, setInfo] = useState(SITE_DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    const cacheBuster = Math.floor(Date.now() / 60000);
    fetch(`${SITE_INFO_URL}?v=${cacheBuster}`)
      .then((res) => jsonOrThrow(res, "site info"))
      .then((data) => {
        if (!cancelled && data) setInfo(mergeSiteInfo(data));
      })
      .catch(() => {
        /* keep SITE_DEFAULTS — the site still renders correctly */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return <SiteInfoContext.Provider value={info}>{children}</SiteInfoContext.Provider>;
}

// ---------------------------------------------------------------------------
// Editable page content (homepage sections, etc.) — same runtime-fetch +
// fallback pattern as site-info. Defaults are the original hardcoded arrays, so
// if content.json is missing or malformed the site renders exactly as before.
// The admin (content.php) writes the whole object, so every section is present.
// ---------------------------------------------------------------------------
const CONTENT_URL = "/data/content.json";

// FAQ is stored/edited as a flat list of {category, question, answer}; the page
// groups it back into categories (preserving first-seen order) for rendering.
function flattenFaq(categories) {
  const out = [];
  (categories || []).forEach((cat) => {
    (cat.items || []).forEach((it) => {
      out.push({ category: cat.name, question: it.question, answer: it.answer });
    });
  });
  return out;
}
function groupFaq(flat) {
  const order = [];
  const byName = {};
  (flat || []).forEach((row) => {
    const name = row.category || "General";
    if (!byName[name]) {
      byName[name] = { name, items: [] };
      order.push(name);
    }
    byName[name].items.push({ question: row.question, answer: row.answer });
  });
  return order.map((n) => byName[n]);
}

// Built lazily (this is a hoisted function declaration) so it can reference
// section arrays defined further down the file — SERVICES_DATA, FAQ_CATEGORIES —
// without any module load-order constraints. Called only at runtime.
// Fixed page copy — hero, section headings/intros, page banners, CTA text. This
// is a nested object (not a list); the admin edits it as fixed fields, and it is
// deep-merged so any single blank field falls back to the default below.
const COPY_DEFAULTS = {
  hero: {
    badge: "Bolingbrook, IL — Made in USA Since 1974",
    headlineLine1: "25 Million Feet in Stock.",
    headlineAccent: "Same-Day Shipment.",
    headlineLine3: "Custom Marking & Fabrication.",
    subhead:
      "Insulation Products Corporation is a spec-grade stocking distributor of heat-shrinkable & extruded tubing, electrical sleeving, and industrial adhesives. $50 minimum order. UL, CSA, MIL-SPEC, and RoHS compliant product line. Quick, accurate, courteous service since 1974 — the customer is always number one.",
    ctaPrimaryLabel: "Browse Products →",
    ctaPrimaryPage: "products",
    ctaSecondaryLabel: "Request a Quote",
    ctaSecondaryPage: "contact",
  },
  homeFeatures: {
    eyebrow: "Products & Services",
    title: "A Complete Insulation Supply Source",
    ctaText: "Need a custom specification or hard-to-find product?",
    ctaButton: "Talk to Our Sales Team",
  },
  homeMarkets: {
    eyebrow: "Industries Served",
    title: "Trusted Across Demanding Markets",
    subtitle:
      "IPC stocks specification-grade insulation materials used across every sector that requires reliable, certified wire and component protection.",
  },
  servicesHeader: {
    eyebrow: "Fabrication",
    title: "Value-Added Services",
    intro:
      "Beyond stocking and distributing, IPC offers a full range of fabrication and customization services — all with a typical lead time of one week or less.",
  },
  industriesHeader: {
    eyebrow: "Industries Served",
    title: "Applications by Industry",
    intro:
      "IPC supplies spec-grade insulation materials across demanding industries. Select your sector to see the products and certifications that serve your application.",
  },
  aboutHeader: {
    eyebrow: "Company",
    title: "About Insulation Products Corporation",
    intro:
      "A spec-grade stocking distributor of electrical insulation materials since July 1, 1974 — quick, accurate, and courteous service, always.",
    storyTitle: "Our Story",
    certsTitle: "Certifications & Standards",
    teamTitle: "Our Team & Capabilities",
    ctaTitle: "Ready to place an order or request a quote?",
  },
  datasheetsHeader: {
    eyebrow: "Technical library",
    title: "Datasheets",
    intro:
      "Every product IPC stocks has a published datasheet. Download directly — no form, no email address.",
  },
  faqHeader: {
    eyebrow: "Resources",
    title: "Frequently Asked Questions",
    intro:
      "Answers to common product, ordering, and service questions. Can't find what you need?",
  },
  contactHeader: {
    eyebrow: "Contact",
    title: "Get in Touch",
    intro:
      "Ready to order, need a quote, or have a technical question? Our sales team responds quickly and accurately.",
    directTitle: "Direct Contact",
  },
  privacyHeader: {
    eyebrow: "Legal",
    title: "Privacy Policy",
    effectiveDate: "January 1, 2025",
    intro:
      'Insulation Products Corporation ("IPC", "we", "us", or "our") operates the website at insulationproducts.com. This Privacy Policy explains how we collect, use, and protect information when you visit our site or contact us through it.',
  },
  nav: {
    home: "Home",
    products: "Products",
    company: "Company",
    quoteButton: "Request a Quote",
    allProducts: "All Products",
    browseAll: "Browse All Products",
    productIndex: "Product Index",
    datasheets: "Datasheets",
    browseByCategory: "Browse by Category",
  },
  footer: {
    contactTitle: "Contact",
    quickLinksTitle: "Quick Links",
    domain: "insulationproducts.com",
  },
  contactForm: {
    rfqTab: "📋  Request a Quote",
    rfqTabSub: "Structured RFQ — fastest for orders",
    msgTab: "✉️  Send a Message",
    msgTabSub: "General inquiries & questions",
    rfqHeading: "Request a Quote",
    rfqIntro: "Fill in as much as you know — our team will clarify anything needed.",
    productDetailsTitle: "Product Details",
    partLabel: "Part Number / SKU",
    partPlaceholder: "e.g. IP35KY, IP33PO, or description",
    materialLabel: "Material / Type",
    materialPlaceholder: "e.g. Polyolefin 2:1, PVDF, Fiberglass",
    quantityLabel: "Quantity Required *",
    quantityPlaceholder: "e.g. 500 ft, 1000 pcs, 10 spools",
    dateLabel: "Required Delivery Date",
    // B22 — no literal date. This read "e.g. ASAP, end of month, 6/30/2025"
    // and by the time the audit ran that example was 13 months in the past,
    // which reads as a dead site. A hardcoded date in a placeholder can only
    // ever rot; the two non-date examples say everything the third did.
    // The live value is saved in content.json and is an owner action — this
    // default only fixes a fresh install.
    datePlaceholder: "e.g. ASAP, end of month, or a specific date",
    specialLabel: "Special Requirements",
    specialPlaceholder: "e.g. C of C required, PPAP, custom marking, specific color, certifications needed",
    notesLabel: "Additional Notes",
    notesPlaceholder: "Any other details that will help us respond accurately…",
    submitRfq: "Submit Quote Request →",
    msgHeading: "Send a Message",
    msgIntro: "For general questions, technical guidance, or anything that doesn't fit the RFQ form.",
    subjectLabel: "Subject *",
    subjectPlaceholder: "What's this about?",
    messageLabel: "Message *",
    messagePlaceholder: "Include any relevant details — product type, application, quantities, certifications needed…",
    submitMsg: "Send Message →",
    sendingLabel: "Sending…",
    rfqSuccessTitle: "Quote Request Received",
    msgSuccessTitle: "Message Received",
    successThanks: "Thank you!",
    rfqSuccessBody: "Your quote request has been received. Our sales team will review the details and respond within one business day — often the same day for in-stock items.",
    msgSuccessBody: "Your message has been received. Our sales team will respond within one business day.",
    urgentPrefix: "For urgent inquiries:",
    networkError: "Network error. Please call 630.771.0700 or email sales@insulationproducts.com directly.",
    submitError: "Submission failed. Please call 630.771.0700.",
    nameLabel: "Full Name *",
    namePlaceholder: "Your name",
    emailLabel: "Email *",
    emailPlaceholder: "you@company.com",
    phoneLabel: "Phone",
    // C39 — every other placeholder on this form is a worked example; this one
    // said "Optional", which only repeats what the unstarred label already
    // says and teaches nothing about the format. DATA: content.json has
    // "Optional" saved, so this default fixes a fresh install only and the
    // live string is an owner action — the same shape as the B22 date
    // placeholder above.
    //
    // NOTE: no apostrophes or stray backticks in comments inside this object.
    // _harness/copydrift.js brace-matches COPY_DEFAULTS and skips string
    // literals, but not comments, so a lone quote character opens a phantom
    // string that swallows the closing brace and the whole copy contract fails
    // to evaluate. admin/content.php carries the same warning for the same
    // reason. Write "the B22 placeholder" rather than the possessive.
    phonePlaceholder: "e.g. 630.771.0700 ext 12",
    // C39 — new. There was no legend explaining the star, and no privacy note
    // anywhere near the submit control, on a form that collects a name, an
    // email, a phone number and a company.
    requiredLegend: "Fields marked * are required.",
    privacyNote: "We use your details only to answer this enquiry. See our",
    companyLabel: "Company",
    companyPlaceholder: "Your organization",
    tipsTitle: "For fastest response, include:",
    // PLAN-6 item 3. These three are read by public/contact.php, not by any
    // React component — they are here because content.php offers them and
    // `_harness/copydrift.js` requires both sides of the copy contract to
    // match exactly. contact.php carries the same two defaults inline so a
    // missing or corrupt content.json still sends a sensible auto-reply.
    autoReplyRfqPromise: "Our sales team will review your request and respond within one business day — often the same day for in-stock items.",
    autoReplyMsgPromise: "Our team will respond within one business day.",
    autoReplyNotice: "",
  },
};

// Per-page SEO — browser-tab title + meta description (also used for social
// share tags). Edited as a list keyed by page; "home" is the site-wide default.
const SEO_DEFAULT = [
  {
    page: "home",
    title: "Insulation Products Corporation — Heat Shrink Tubing, Sleeving & Adhesives",
    desc: "IPC is a spec-grade stocking distributor of heat-shrinkable & extruded tubing, electrical sleeving, and industrial adhesives. $50 minimum order. Ships same day. ISO 9001 registered.",
  },
  { page: "products", title: "Product Catalog — Insulation Products Corporation", desc: "Browse IPC's full catalog of heat shrink tubing, sleeving, and adhesives. Filter by product family, view specs and data sheets, and request a quote." },
  { page: "dashboard", title: "Product Index — Insulation Products Corporation", desc: "Search and sort all IPC products by part number, material, and temperature rating. Quick access to specs and data sheets for every SKU." },
  { page: "datasheets", title: "Datasheets — Insulation Products Corporation", desc: "Download the published datasheet for every IPC product. Heat shrink tubing, sleeving, adhesives and accessories — grouped by family, no form required." },
  { page: "industries", title: "Industries Served — Insulation Products Corporation", desc: "IPC supplies specification-grade insulation materials to automotive, aerospace, medical, military, marine, and industrial markets. Learn how we serve your industry." },
  { page: "services", title: "Value-Added Services — Insulation Products Corporation", desc: "Custom cut-to-length, hot-stamp marking, bar code printing, spooling, kitting, and JIT delivery programs. Typical lead time one week or less." },
  { page: "about", title: "About — Insulation Products Corporation", desc: "Insulation Products Corporation — a spec-grade stocking distributor in Bolingbrook, IL since July 1, 1974. ISO 9001 registered. $50 minimum order, same-day shipment." },
  { page: "faq", title: "FAQ & Resources — Insulation Products Corporation", desc: "Answers to common questions about IPC products, certifications, ordering minimums, custom fabrication, and documentation support." },
  { page: "contact", title: "Contact / Request a Quote — Insulation Products Corporation", desc: "Request a quote, submit a PO, or ask a question. Call 630.771.0700, fax 630.771.0701, email sales@insulationproducts.com, or use our online form." },
  { page: "privacy", title: "Privacy Policy — Insulation Products Corporation", desc: "Privacy policy for Insulation Products Corporation — how we collect and use information submitted through our website contact forms." },
];

/**
 * The routes that exist. Anything else is a 404 (PLAN-8 A5).
 *
 * Derived from SEO_DEFAULT rather than written out a second time, and that
 * coupling is deliberate: B25's defect was a route with no SEO row silently
 * inheriting the homepage's description, so a route that cannot be added
 * without also giving it a row is a route that cannot reintroduce B25. It also
 * cannot drift the way the two hardcoded family lists did before PLAN-6.
 *
 * SEO_DEFAULT is a hardcoded constant, not owner content, so emptying the SEO
 * section in the admin cannot empty this and 404 the whole site.
 */
const KNOWN_ROUTES = new Set(SEO_DEFAULT.map((s) => s.page));

/**
 * The single answer to "is this URL a 404?", used by both renderPage and
 * PageMeta. One derivation, deliberately — A1 in this same plan was two
 * derivations of one fact disagreeing with each other, and a page that renders
 * the catalog while its meta tags say `noindex` would be the same bug wearing
 * a different hat.
 */
function useIsUnknownRoute() {
  const location = useLocation();
  const [page] = useSearchParam("page");
  const key = page || "home";
  return (!!page && !KNOWN_ROUTES.has(key)) || hasExtraSegments(location.pathname);
}

/** A4 — the share card, and the intrinsic size of the product photography. */
const OG_CARD = { src: "/images/og-card.jpg", w: 1200, h: 630 };
const OG_PHOTO = { w: 400, h: 300 };

// Contact-page sidebar "for fastest response" tips.
const CONTACT_TIPS = [
  "IPC part number or description",
  "Material type and size needed",
  "Quantity required",
  "Required delivery date",
  "Any special specs or certifications",
];

/**
 * The built-in product families, in catalogue order.
 *
 * PLAN-6 item 1 made this owner-editable: the live list is
 * `content.json`'s `productFamilies`, edited from Page Content, and this array
 * is now the DEFAULT rather than the only copy. It used to exist three times —
 * here, in `admin/add.php` and in `admin/edit.php` — three literals that agreed
 * only by luck. Both PHP copies are gone; they read this list through
 * `load_content()` now.
 *
 * Read it through `familyOrder(content)`, never directly, or an owner edit is
 * silently ignored at that call site.
 */
const FAMILY_ORDER = [
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

/**
 * The family order to render with: the owner's list if he has one, otherwise
 * the built-in defaults.
 *
 * AN EMPTY LIST FALLS BACK, and that is a deliberate departure from invariant 3.
 * Everywhere else an empty array is a real deletion — deleting every privacy row
 * must not republish stale legal text, which is the incident that invariant
 * exists for.
 *
 * The reason it is wrong HERE is not the obvious one, and the obvious one is
 * false: grouping happens on each product's own `partType`, so every family
 * heading still renders with an empty list. Nothing lands in "Other". What
 * breaks is `openFamilies` below, which initialises to
 * `new Set(order.concat(["Other"]))` — an empty order leaves every accordion
 * CLOSED. Measured: 41 reachable product links in the sidebar become 0, and the
 * curated order degrades to catalogue order. `plan6-families.js` asserts both,
 * and an earlier assertion built on the "all under Other" story passed with
 * this fallback removed.
 *
 * `mergeContent` is untouched; the departure lives here, at the one call site
 * that needs it, so it cannot leak into any other section.
 *
 * Rows with a blank name are dropped rather than rendered as an empty heading.
 */
function familyOrder(content) {
  const rows = content && Array.isArray(content.productFamilies) ? content.productFamilies : null;
  const names = (rows || [])
    .map((r) => (r && typeof r.name === "string" ? r.name.trim() : ""))
    .filter(Boolean);
  return names.length ? names : FAMILY_ORDER;
}

function contentDefaults() {
  return {
    features: FEATURES_DATA,
    stats: STATS_DATA,
    markets: MKT_MARKETS,
    industryDetail: INDUSTRY_DETAIL,
    services: SERVICES_DATA,
    milestones: ABOUT_MILESTONES,
    capabilities: ABOUT_CAPABILITIES,
    certs: ABOUT_CERTS,
    companyNav: COMPANY_ITEMS,
    footerLinks: FOOTER_LINKS,
    faq: flattenFaq(FAQ_CATEGORIES),
    heroProofPoints: HERO_PROOF,
    heroTrust: HERO_TRUST.map((t) => ({ text: t })),
    privacySections: PRIVACY_SECTIONS,
    // PLAN-6 item 1. Built from FAMILY_ORDER so there is still exactly one copy
  // of the eleven names in the tree; content.php offers them as an ordered,
  // repeatable list. Read via familyOrder(), which handles the empty case.
  productFamilies: FAMILY_ORDER.map((name) => ({ name })),
  contactTips: CONTACT_TIPS.map((t) => ({ text: t })),
    seo: SEO_DEFAULT,
    copy: COPY_DEFAULTS,
  };
}

// Array sections replace wholesale. The `copy` object is deep-merged
// field-by-field so clearing one heading falls back to its default.
//
// INVARIANT: an EMPTY array is a deletion, not a missing key. The old test was
// `Array.isArray(v) && v.length ? v : dv`, which re-seeded the hardcoded
// defaults whenever the owner deleted every row of a section — he removed all
// 8 footer links, the admin said "Content saved", and the public site still
// showed all 8. Same for FAQ entries, certifications, milestones, services,
// industries, nav items, and privacySections (stale legal text republishing
// itself). Only an ABSENT key falls back. (DEPLOY_READINESS_v2 T1.4)
//
// Copy keys the owner is allowed to blank outright. Everything else keeps the
// blank-drop: a headline, a button label or a field label that renders empty is
// a broken page he cannot repair, because the control he would type into is the
// one that vanished. Sub-headings are supplementary by definition — removing
// one is a real editorial choice. (AUDIT_v3_FINDINGS NB4)
const COPY_CLEARABLE = /^(subhead|.*Subhead)$/;

function mergeContent(data) {
  const defaults = contentDefaults();
  if (!data || typeof data !== "object") return defaults;
  const out = {};
  for (const k of Object.keys(defaults)) {
    const dv = defaults[k];
    const v = data[k];
    if (Array.isArray(dv)) {
      out[k] = Array.isArray(v) ? v : dv;
    } else if (dv && typeof dv === "object") {
      out[k] = {};
      for (const g of Object.keys(dv)) {
        const dg = dv[g];
        const vg = v && typeof v === "object" ? v[g] : undefined;
        if (dg && typeof dg === "object" && !Array.isArray(dg)) {
          // Drop blank ("") values before spreading so a cleared field in the
          // admin falls back to its default instead of rendering empty text —
          // an empty page heading or an empty button label is worse than a
          // stale one, and there is no way to re-enter a heading you cannot see.
          //
          // The exception is copy that is purely supplementary: a subheading or
          // a helper line the owner deliberately removes should stay removed,
          // the same asymmetry mergeSiteInfo now handles via SITE_CLEARABLE.
          // Lower stakes than the site-info case (nothing here becomes an
          // href), but the same "Saved" that changes nothing.
          // (AUDIT_v3_FINDINGS NB4)
          const overrides = {};
          if (vg && typeof vg === "object") {
            for (const key of Object.keys(vg)) {
              const val = vg[key];
              if (val == null) continue;
              if (val === "" && !COPY_CLEARABLE.test(key)) continue;
              overrides[key] = val;
            }
          }
          out[k][g] = { ...dg, ...overrides };
        } else {
          out[k][g] = vg != null && vg !== "" ? vg : dg;
        }
      }
    } else {
      out[k] = v != null ? v : dv;
    }
  }
  return out;
}

const ContentContext = createContext(null);
function useContent() {
  return useContext(ContentContext) || contentDefaults();
}

function ContentProvider({ children }) {
  const [content, setContent] = useState(contentDefaults);
  useEffect(() => {
    let cancelled = false;
    const cacheBuster = Math.floor(Date.now() / 60000);
    fetch(`${CONTENT_URL}?v=${cacheBuster}`)
      .then((res) => jsonOrThrow(res, "page content"))
      .then((data) => {
        if (!cancelled && data) setContent(mergeContent(data));
      })
      .catch(() => {
        /* keep CONTENT_DEFAULTS — the site still renders correctly */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

// Schema.org JSON-LD rendered from the live business details (replaces the old
// static block in index.html) so structured data stays in sync with the site.
function StructuredData() {
  const site = useSiteInfo();
  useEffect(() => {
    const data = {
      "@context": "https://schema.org",
      "@type": ["Organization", "LocalBusiness"],
      name: site.company.name,
      // `|| undefined` on the clearable fields: an empty string in JSON-LD is a
      // claim that the value is blank, which is worse than not asserting it —
      // the same reason T1.7 stopped emitting an empty faxNumber. These three
      // are the fields the owner is allowed to clear. (AUDIT_v3_FINDINGS NB4)
      alternateName: site.company.shortName || undefined,
      slogan: site.company.slogan || undefined,
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/favicon.svg`,
      description: site.company.description,
      foundingDate: site.company.foundedYear ? `${site.company.foundedYear}-01-01` : undefined,
      telephone: site.contact.phoneDial || site.contact.phone,
      faxNumber: site.contact.fax || undefined,
      email: site.contact.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: site.address.street,
        addressLocality: site.address.city,
        addressRegion: site.address.state,
        postalCode: site.address.zip,
        addressCountry: site.address.country,
      },
      openingHoursSpecification: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: site.hours.days,
        opens: site.hours.opens,
        closes: site.hours.closes,
      },
      sameAs: Object.values(site.social || {}).filter(Boolean).length
        ? Object.values(site.social || {}).filter(Boolean)
        : undefined,
    };
    const id = "ipc-structured-data";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }, [site]);
  return null;
}

// Document <title> + meta description per page, localized from the live business
// details. Lives inside SiteInfoProvider (App itself sits above it), so it can
// read useSiteInfo and keep the contact info in the meta description current.
/**
 * A5 — the not-found page. A dead end that still sells: it says plainly that
 * the address does not exist, then offers the two catalog routes and the phone
 * number, because someone who mistyped a URL is still a buyer.
 *
 * Phone and email come from site-info so they follow an admin edit; fax is
 * deliberately not a link (PLAN-1 4.8).
 */
function NotFoundPage() {
  const site = useSiteInfo();
  // phoneDial is the canonical dial string and is what every other tel: on the
  // site uses — re-deriving one by stripping the display number would be a
  // second, drifting source for the same fact.
  const tel = (site.contact && site.contact.phone) || "";
  const dial = (site.contact && site.contact.phoneDial) || "";
  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <PageEyebrow>Error 404</PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            Page not found
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            That address doesn&rsquo;t exist on this site. It may have been
            mistyped, or the page may have moved.
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-wrap gap-3">
          <PageLink
            page="products"
            className="px-4 py-2.5 rounded text-sm font-semibold"
            style={{ background: "var(--brand-primary)", color: "var(--brand-primary-ink)" }}
          >
            Browse the product catalog
          </PageLink>
          <PageLink
            page="dashboard"
            className="px-4 py-2.5 rounded text-sm font-semibold"
            style={{ background: "#ffffff", color: "var(--brand-primary-text)", border: "1px solid #d1d9e0" }}
          >
            Search the product index
          </PageLink>
          <PageLink
            page="contact"
            className="px-4 py-2.5 rounded text-sm font-semibold"
            style={{ background: "#ffffff", color: "var(--brand-primary-text)", border: "1px solid #d1d9e0" }}
          >
            Request a quote
          </PageLink>
        </div>
        {tel && (
          <p className="mt-6 text-sm" style={{ color: "#4b5563" }}>
            Or call{" "}
            {dial ? (
              <a href={`tel:${dial}`} style={{ color: "var(--brand-primary-text)", fontWeight: 600 }}>
                {tel}
              </a>
            ) : (
              <strong>{tel}</strong>
            )}{" "}
            and we will point you at the right part.
          </p>
        )}
      </div>
    </div>
  );
}

function PageMeta({ products }) {
  const site = useSiteInfo();
  const { seo, copy } = useContent();
  const [page] = useSearchParam("page");
  const [productId] = useSearchParam("productId");
  const unknownRoute = useIsUnknownRoute();
  useEffect(() => {
    const list = Array.isArray(seo) ? seo : [];
    const key = page || "home";
    const home = list.find((s) => s.page === "home") || {};
    const entry = list.find((s) => s.page === key) || {};

    // A3 — the product this URL is actually about, if any. Passed in rather
    // than read from useProducts(): that hook carries a module-level cache and
    // a mount-once assumption documented at its definition, and a second call
    // site would be a second mount.
    const product =
      productId && Array.isArray(products)
        ? products.find((p) => p.id === productId) || null
        : null;

    // Title fallback. Two things used to go wrong here:
    //
    //  1. `|| document.title` meant that emptying the SEO section did NOT clear
    //     the titles — document.title had already been set from the defaults on
    //     the first effect pass, so the defaults simply stuck. Deleting every row
    //     of a section is a deletion (invariant 3), and for `seo` that has to
    //     mean "stop overriding titles", not "silently keep the old ones" and
    //     certainly not "blank every page". (AUDIT_v3 §3.8)
    //  2. `|| home.title` gave every page WITHOUT its own seo row the homepage's
    //     title. `terms` and `quality` have no row, so three routes shipped the
    //     same <title> — a duplicate-title signal on the exact pages that need a
    //     distinct one.
    //
    // Both now fall back to the page's own visible heading plus the company
    // name, so every route stays titled, distinct, and owner-controlled.
    const heading = ((copy && copy[`${key}Header`]) || {}).title || "";
    const label =
      heading ||
      key.replace(/(^|-)([a-z])/g, (_, sep, ch) => (sep ? " " : "") + ch.toUpperCase());
    const computed =
      key === "home" ? site.company.name : `${label} — ${site.company.name}`;
    // B25 — a route with no `seo` row falls back to ITS OWN default, then to
    // the homepage. /datasheets has no row (content.json's seo array has 9 and
    // SEO_DEFAULT has 10), so its description was the homepage's. The mechanism
    // was the defect: any page added later without a row did the same silently.
    //
    // Guarded on `list.length` so this cannot re-seed a deletion. Emptying the
    // SEO section is a deletion, not "unset" (invariant 3) — when the owner has
    // removed every row we must stop overriding, not quietly restore the
    // hardcoded defaults. That is the same trap `seo: []` was fixed for in
    // PLAN-1, and it is why the TITLE deliberately does not get this treatment:
    // titles fall back to the page's own visible heading instead.
    const dflt = list.length ? SEO_DEFAULT.find((s) => s.page === key) || {} : {};

    let title = entry.title || (key === "home" ? home.title : "") || computed;
    let desc = localizeProse(entry.desc || dflt.desc || home.desc || "", site);

    // A3 — 42 product URLs described themselves identically: the same <title>,
    // the same description and the same og:title, all inherited from the
    // /products row. All 42 names are distinct, so the name alone makes the
    // title unique; the SKU is appended when it is not already in the name so a
    // buyer scanning search results sees the part number they searched for.
    if (product) {
      const sku = (product.sku || "").trim();
      const name = (product.name || "").trim();
      const label = sku && !name.toUpperCase().includes(sku.toUpperCase())
        ? `${name} — ${sku}` : name;
      title = `${label} — ${site.company.name}`;
      const summary = String(product.specificationsSummary || "").trim();
      const kind = String(product.partType || "").trim();
      desc = localizeProse(
        [
          sku ? `${name} (${sku})` : name,
          kind ? `— ${kind}.` : "—",
          summary || "Specifications, data sheet and quote request.",
        ].join(" ").replace(/\s+/g, " ").slice(0, 300),
        site
      );
    }

    // A5 — an unknown segment is not a page about anything. It gets the
    // not-found title and no description worth indexing.
    if (unknownRoute) {
      title = `Page not found — ${site.company.name}`;
      desc = "";
    }

    document.title = title;
    // Update <meta name="description"> plus the Open Graph share tags so search
    // engines and social previews reflect the editable copy.
    const setMeta = (attr, key, val) => {
      if (!val) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", val);
    };
    setMeta("name", "description", desc);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);

    // Canonical URL + og:url, per route.
    //
    // index.html ships ONE og:url hardcoded to the site root and no canonical at
    // all. index.html is the single shell for all nine routes, so every page
    // announced itself as the homepage: shared links previewed as the homepage,
    // and crawlers got a duplicate-content signal across the whole site.
    // (AUDIT_v3 4.3)
    //
    // Built from SITE_ORIGIN, not window.location.origin — dev, the php -S
    // mirror and production would each declare THEMSELVES canonical, which is
    // strictly worse than a wrong constant.
    //
    // productId is included so an individual product page is canonical to
    // itself. Every other param (?family=, search terms, UI state) is excluded:
    // those are views of the same page, not separate documents.
    //
    // C33 — this was an inline expression; it is now canonicalFor(), shared
    // with the BreadcrumbList so the trail's last item and this tag cannot
    // drift apart. Identical output, one definition.
    const canonical = canonicalFor(page, productId);
    let link = document.querySelector('link[rel="canonical"]');

    // A5 — an unknown segment gets `noindex` and NO canonical.
    //
    // The server still answers 200 and must keep doing so: Apache's catch-all
    // rewrite is what makes every deep link and every refresh work, and
    // narrowing it to carve out unknown segments would break all of them. For
    // an SPA, `noindex` is the signal search engines actually act on. Do not
    // "fix" this later by touching the rewrite.
    //
    // Emitting a canonical here as well would be the half-fix that looks done:
    // a self-referencing canonical on a soft 404 tells a crawler the page is
    // the real, preferred version of itself, which is the opposite of the
    // intent. So the tag is REMOVED rather than left pointing anywhere.
    if (unknownRoute) {
      setMeta("name", "robots", "noindex");
      if (link) link.remove();
    } else {
      const robots = document.querySelector('meta[name="robots"]');
      if (robots) robots.remove();
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
      setMeta("property", "og:url", canonical);
    }

    // A4 — og:image. index.html shipped a TODO comment and no usable tag while
    // twitter:card said summary_large_image, so every link pasted into
    // LinkedIn, Teams, Slack or an email client rendered as a bare text card —
    // on a site whose product URLs get pasted into procurement threads.
    //
    // Absolute, not relative: several crawlers ignore a relative og:image.
    // A product with a real photograph shares that photo; a product on the
    // branded placeholder falls back to the card, because a link preview of a
    // "PRODUCT IMAGE COMING SOON" panel is worse than the company card.
    const photo =
      product && product.photoUrl && !String(product.photoUrl).includes("placehold.co")
        ? String(product.photoUrl)
        : "";
    const ogImage = photo
      ? (/^https?:\/\//.test(photo) ? photo : SITE_ORIGIN + (photo.startsWith("/") ? "" : "/") + photo)
      : SITE_ORIGIN + OG_CARD.src;
    setMeta("property", "og:image", ogImage);
    // Declared so the first share renders without the crawler fetching the file
    // to measure it. The per-product photos are all 400x300 source art.
    setMeta("property", "og:image:width", photo ? String(OG_PHOTO.w) : String(OG_CARD.w));
    setMeta("property", "og:image:height", photo ? String(OG_PHOTO.h) : String(OG_CARD.h));
  }, [page, productId, products, site, seo, copy, unknownRoute]);
  return null;
}

// Applies the editable brand colors to CSS variables at runtime, re-skinning the
// whole site from data. Defaults live in index.css so the first paint is correct.
// ── Contrast math (WCAG 2.1 relative luminance) ─────────────────────────────
// 4.23: owner-set brand colors used to be injected with NO contrast guard while
// headings and primary buttons hardcoded #ffffff. "Business Details" invites
// Rick to pick a color and re-skin the whole site — pick a pale one and
// white-on-white shipped to every visitor, with nothing warning him and the
// damage on the public site rather than in the admin.
//
// MIRRORED IN admin/config.php (ipc_contrast_ratio / ipc_ink_for). The two must
// agree: the admin warns with a number, and the site picks the ink that number
// describes. If one changes, change the other — _harness/contrastparity.js
// asserts they still match.
const INK_DARK = "#141414";   // the site's body text color
const INK_LIGHT = "#ffffff";

function parseHexColor(v) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v || "").trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminance(rgb) {
  const ch = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
}

/** WCAG contrast ratio between two hex colors, 1..21. Returns 0 on bad input. */
function contrastRatio(a, b) {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) return 0;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The readable foreground for one or more background colors.
 *
 * Takes a LIST because the page headers and the homepage CTA band are a
 * gradient from --brand-primary to --brand-accent-2: the ink has to be legible
 * at both ends, so we score each candidate by its WORST contrast across the
 * stops and keep the better candidate.
 */
/** "#ffffff" -> "255, 255, 255", for use inside rgba(). */
function inkRgb(ink) {
  const c = parseHexColor(ink);
  return c ? `${c.r}, ${c.g}, ${c.b}` : "255, 255, 255";
}

function inkFor(backgrounds) {
  const bgs = (Array.isArray(backgrounds) ? backgrounds : [backgrounds]).filter(
    (b) => parseHexColor(b)
  );
  if (!bgs.length) return INK_LIGHT;
  const worst = (ink) => Math.min(...bgs.map((bg) => contrastRatio(ink, bg)));
  return worst(INK_LIGHT) >= worst(INK_DARK) ? INK_LIGHT : INK_DARK;
}

// ── Text-safe brand colors (brand-color-as-foreground) ──────────────────────
// Separate defect from the ink variables, and the larger one: the brand colors
// are ALSO used as text — feature chips, eyebrow labels, sidebar headings,
// inline links — at ~59 call sites. `inkFor()` cannot help there; that picks a
// foreground FOR a brand background. Here the brand color IS the foreground,
// and a pale one is unreadable on white no matter what ink logic runs.
//
// The fix darkens (or lightens) the brand color only as far as legibility
// requires, in HSL so hue and saturation survive. Critically it is a NO-OP when
// the color already passes: the shipped navy #005DA3 scores 6.79:1 on white, so
// the default site is byte-identical and nothing about the brand "reads"
// differently. The adjustment only engages for a palette that is already
// broken, which is the same philosophy as the ink variables.
function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex({ h, s, l }) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v);
  };
  const hex = (v) => v.toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/**
 * `color` adjusted just far enough to reach `target` contrast on `bg`.
 * Returns `color` untouched when it already passes.
 */
function textSafeOn(color, bg, target = 4.5) {
  const c = parseHexColor(color);
  const b = parseHexColor(bg);
  if (!c || !b) return color;
  if (contrastRatio(color, bg) >= target) return color;   // no-op: already fine

  // Move away from the background's luminance: darken on a light background,
  // lighten on a dark one.
  const darken = relativeLuminance(b) > 0.5;
  const { h, s, l } = rgbToHsl(c);
  for (let step = 1; step <= 100; step++) {
    const nl = darken ? l - step / 100 : l + step / 100;
    if (nl < 0 || nl > 1) break;
    const cand = hslToHex({ h, s, l: nl });
    if (contrastRatio(cand, bg) >= target) return cand;
  }
  // Nothing in the hue works (a fully saturated yellow on white cannot reach
  // 4.5:1 without going brown). Fall back to the plain ink rather than ship
  // something unreadable.
  return darken ? INK_DARK : INK_LIGHT;
}

function ThemeInjector() {
  const site = useSiteInfo();
  useEffect(() => {
    const t = site.theme || {};
    const root = document.documentElement;
    const map = {
      "--brand-primary": t.primaryColor,
      "--brand-dark": t.darkColor,
      "--brand-accent": t.accentColor,
      "--brand-accent-2": t.accent2Color,
    };
    for (const k in map) if (map[k]) root.style.setProperty(k, map[k]);
    // Derive the translucent-tint RGB and a darker hover shade from the primary
    // so tints (rgba) and hover states re-theme along with the solid colors.
    const m = /^#?([0-9a-f]{6})$/i.exec(t.primaryColor || "");
    if (m) {
      const num = parseInt(m[1], 16);
      const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
      const d = (x) => Math.round(x * 0.82);
      root.style.setProperty("--brand-primary-rgb", `${r}, ${g}, ${b}`);
      root.style.setProperty("--brand-primary-hover", `rgb(${d(r)}, ${d(g)}, ${d(b)})`);
    }
    // 4.23 — the readable foreground for each brand surface, recomputed
    // whenever the owner changes a color. These back the --brand-*-ink vars
    // that replaced the hardcoded #ffffff at every brand-colored call site.
    // Defaults in index.css cover the first paint and the navy palette.
    const primary = t.primaryColor || "#005da3";
    const dark = t.darkColor || "#0d2d52";
    const accent2 = t.accent2Color || "#119ec8";
    const primaryInk = inkFor(primary);
    const darkInk = inkFor(dark);
    // The gradient runs primary -> accent-2; the ink must survive both ends.
    const headerInk = inkFor([primary, accent2]);
    root.style.setProperty("--brand-primary-ink", primaryInk);
    root.style.setProperty("--brand-dark-ink", darkInk);
    root.style.setProperty("--brand-header-ink", headerInk);
    // The same three inks as bare "r, g, b" triples, so de-emphasised text can
    // say rgba(var(--brand-dark-ink-rgb), 0.6) and follow the ink instead of
    // hardcoding rgba(255,255,255,0.6). That opacity idiom is used at ~50 call
    // sites — nav links, banner sub-lines, sidebar captions — and every one of
    // them went invisible on a pale brand color.
    //
    // Deliberately NOT color-mix(): rgba(var(--x), a) works everywhere, and an
    // unsupported color-mix() makes the declaration invalid, which drops the
    // color to `inherit` — failing toward unreadable, which is the whole bug.
    root.style.setProperty("--brand-primary-ink-rgb", inkRgb(primaryInk));
    root.style.setProperty("--brand-dark-ink-rgb", inkRgb(darkInk));
    root.style.setProperty("--brand-header-ink-rgb", inkRgb(headerInk));

    // brand-color-as-foreground: the brand colors used as TEXT rather than as a
    // background. Page copy sits on white or a near-white tint, so that is the
    // background to clear; the accent is used as text on --brand-dark instead.
    // Both are no-ops for the shipped palette.
    // TEXT_TARGET, not a bare 4.5: page copy does not sit only on pure white.
    // It also sits on #f5f7fa, #f8fafc and on rgba(brand, 0.08) tints, all of
    // which are slightly DARKER than white and therefore give slightly LESS
    // contrast to dark text. Solving for exactly 4.5:1 on white measured 4.48:1
    // on #f5f7fa — a fail, by 0.02. The margin covers the tints.
    // The margin applies ONLY to the white-background variants. On a dark
    // background the surrounding tints are lighter, not darker, so they give
    // MORE contrast, not less — carrying the margin over there just moves a
    // color that was already fine. Measured: it shifted the shipped
    // --brand-accent-2 from #119EC8 to #12a9d6 for no reason.
    const TEXT_TARGET = 5.0;   // on white and near-white tints
    const DARK_TARGET = 4.5;   // on a dark surface, plain AA
    root.style.setProperty("--brand-primary-text", textSafeOn(primary, "#ffffff", TEXT_TARGET));
    root.style.setProperty("--brand-accent-text", textSafeOn(accent2, "#ffffff", TEXT_TARGET));
    root.style.setProperty("--brand-accent-on-dark", textSafeOn(accent2, dark, DARK_TARGET));
    // The footer's background is a hardcoded #0a2240, not --brand-dark, so it
    // needs its own variant: when the owner picks a pale --brand-dark the
    // on-dark variant darkens, which would be exactly wrong down there.
    root.style.setProperty("--brand-accent-on-footer", textSafeOn(accent2, "#0a2240", TEXT_TARGET));
    // --brand-accent (not accent-2) is used for the contact sidebar's arrow
    // glyphs, which sit on a --brand-dark card. Its own variant rather than the
    // plain ink, so the accent hue survives.
    const accent = t.accentColor || "#00bef2";
    root.style.setProperty("--brand-accent1-on-dark", textSafeOn(accent, dark, DARK_TARGET));
  }, [site]);
  return null;
}

// buildTableData removed — DashboardPage derives rows inline with filtering.

/**
 * Product family order and display labels for sidebar grouping.
 */

/**
 * IPC Product selector sidebar — grouped by product family, collapsible sections.
 * Mobile: compact horizontal scrollable family pill strip + product select pill row.
 * Desktop: full left sidebar with collapsible family groups.
 */
// Module-level constant — prevents recreating the Set on every ProductSidebar render (#6 fix)
/**
 * B12 / C48 — VALUE-ADDED is a product, and is now in every view.
 *
 * It used to be listed here, so the catalog sidebar and the dashboard header
 * counted 41 while the dashboard's own approval filter (four lines away on
 * mobile) and /datasheets counted 42, and the sitemap listed it. A product
 * excluded from one view and counted in another is the bug whichever way it is
 * resolved; the owner settled it (PLAN-8 §0 C48) as a product, so all four
 * surfaces now say 42 and every one of them derives from the same array.
 *
 * The empty string stays: that excludes a product with no SKU at all, which is
 * a different thing entirely — an incomplete record, not a category decision.
 */
const SIDEBAR_EXCLUDED = new Set([""]);

// onSelect became onNavigate in 4.21: picking a product here writes ?productId=
// to the URL, so it is a page change and belongs in a <PageLink>. The callback
// now carries only the side effects (sticky bar + scroll); PageLink owns the
// URL. The family filter pills and the family accordion are UI state, not
// navigation, so they stay <button>. (PLAN-1 4.21)
function ProductSidebar({ products, selectedId, onNavigate }) {
  const order = familyOrder(useContent());
  const families = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      if (SIDEBAR_EXCLUDED.has(p.sku || "")) continue;
      const fam = p.partType || "Other";
      if (!map.has(fam)) map.set(fam, []);
      map.get(fam).push(p);
    }
    const ordered = new Map();
    for (const key of order) {
      if (map.has(key)) ordered.set(key, map.get(key));
    }
    // Anything the configured order does not mention still gets a heading. A
    // family renamed out from under its products must never make them vanish —
    // partType is stored per product and is NOT rewritten by a content save.
    for (const [key, val] of map) {
      if (!ordered.has(key)) ordered.set(key, val);
    }
    return ordered;
  }, [products, order]);

  /**
   * B27 — collapsed on first paint, except the family holding the selected
   * product.
   *
   * This was `new Set(order.concat(["Other"]))` — every family open. Measured
   * at 1440: the sidebar is max-height 80vh, so clientHeight 718 against a
   * scrollHeight of 2,932, and nine of the ten category headers sat below an
   * inner fold with no cue that the region scrolled at all. A visitor saw one
   * category and had no way to know the catalog had ten more.
   *
   * Collapsing shows every heading at once, which is also a better first
   * impression of catalog breadth, and it is a smaller change than inventing a
   * scroll affordance.
   *
   * Read the familyOrder() comment before touching this. The empty-list
   * fallback there exists precisely BECAUSE an empty order leaves every
   * accordion closed — that was a real defect when the open set was derived
   * from `order`. It is not one now: this set is derived from the selected
   * product's own partType, which is stored per product and survives any
   * content edit, so an empty or renamed family list can no longer decide
   * whether anything is open.
   */
  const selectedFamily = useMemo(() => {
    const p = products.find((x) => x.id === selectedId);
    return p ? p.partType || "Other" : null;
  }, [products, selectedId]);

  const [openFamilies, setOpenFamilies] = useState(
    () => new Set(selectedFamily ? [selectedFamily] : []),
  );

  // Follow the selection: arriving at a product from search, a related-product
  // card or a deep link must open the family it lives in, or the sidebar shows
  // the visitor ten closed headings and no sign of where they are.
  useEffect(() => {
    if (!selectedFamily) return;
    setOpenFamilies((prev) => (prev.has(selectedFamily) ? prev : new Set(prev).add(selectedFamily)));
  }, [selectedFamily]);
  const [mobileFamily, setMobileFamily] = useState(null); // null = "All"

  const toggleFamily = (fam) => {
    setOpenFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(fam)) next.delete(fam);
      else next.add(fam);
      return next;
    });
  };

  // Products visible in mobile filtered view
  const mobileProducts = useMemo(() => {
    const all = [];
    for (const [fam, items] of families) {
      if (!mobileFamily || fam === mobileFamily) all.push(...items);
    }
    return all;
  }, [families, mobileFamily]);

  const familyList = useMemo(() => Array.from(families.keys()), [families]);

  return (
    <aside className="w-full lg:w-72 flex-shrink-0">
      {/* ── MOBILE VIEW: horizontal pill strip + product grid ── */}
      <div className="lg:hidden mb-4">
        {/* Family filter pills — horizontal scroll */}
        <div
          className="ipc-scroll-sm"
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              paddingBottom: 4,
              minWidth: "max-content",
            }}
          >
            <button
              onClick={() => setMobileFamily(null)}
              className="ipc-tap"
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: !mobileFamily ? "var(--brand-primary)" : "#ffffff",
                // 4.23: follow the ink when this pill is the brand-colored one.
                color: !mobileFamily ? "var(--brand-primary-ink)" : "#4b5563",
                border: !mobileFamily ? "none" : "1px solid #d1d9e0",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              All (
              {
                products.filter((p) => !SIDEBAR_EXCLUDED.has(p.sku || ""))
                  .length
              }
              )
            </button>
            {familyList.map((fam) => {
              const active = mobileFamily === fam;
              return (
                <button
                  key={fam}
                  onClick={() => setMobileFamily(active ? null : fam)}
                  className="ipc-tap"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: active ? "var(--brand-primary)" : "#ffffff",
                    color: active ? "var(--brand-primary-ink)" : "#4b5563",
                    border: active ? "none" : "1px solid #d1d9e0",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fam} ({families.get(fam)?.length || 0})
                </button>
              );
            })}
          </div>
        </div>

        {/* Product pills — 2-column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginTop: 10,
          }}
        >
          {mobileProducts.map((p, i) => {
            const active = p.id === selectedId;
            return (
              <PageLink
                key={`${p.sku || p.id}-${i}`}
                page="products"
                params={{ productId: p.id }}
                onNavigate={onNavigate}
                style={{
                  display: "block",
                  textAlign: "left",
                  padding: "10px 12px",
                  minHeight: 44,
                  borderRadius: 8,
                  background: active ? "var(--brand-primary)" : "#ffffff",
                  border: active ? "none" : "1px solid #e5e9ee",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    // 4.23: the active pill's background is --brand-primary, so
                    // the label has to follow the ink, not a fixed white. The
                    // -ink-rgb triple keeps a de-emphasis against whichever ink
                    // was chosen — and unlike color-mix() it is supported
                    // everywhere, so it cannot fail to `inherit`.
                    //
                    // B8 — 0.85, was 0.7. The de-emphasis was costing the
                    // active SKU its legibility: 4.15:1 composited over
                    // --brand-primary, at 10px bold, on the part number a buyer
                    // is scanning for. This is the same string B8 is about, in
                    // its selected state — the inactive one was #c4cbd4 at
                    // 1.64:1. Raising the ink's alpha is monotonically more
                    // contrast on any palette, because the ink is already
                    // computed to oppose --brand-primary.
                    color: active
                      ? "rgba(var(--brand-primary-ink-rgb), 0.85)"
                      : "#4b5563",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 2,
                  }}
                >
                  {p.sku}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: active ? "var(--brand-primary-ink)" : "#141414",
                    lineHeight: 1.3,
                  }}
                >
                  {p.name && p.name.length > 32
                    ? p.name.slice(0, 32) + "…"
                    : p.name || p.sku}
                </div>
              </PageLink>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP VIEW: full left sidebar ── */}
      <div
        className="ipc-scroll-cue hidden lg:block sticky top-20 rounded-xl overflow-hidden"
        style={{
          border: "1px solid #e5e9ee",
          boxShadow: "0 1px 4px rgba(var(--brand-primary-rgb),0.06)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 sticky top-0 z-10"
          style={{ background: "var(--brand-dark)", borderBottom: "2px solid var(--brand-accent)" }}
        >
          <div
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--brand-accent-on-dark)" }}
          >
            Product Catalog
          </div>
          <div className="text-sm font-semibold ipc-ink-dark mt-0.5">
            {products.filter((p) => !SIDEBAR_EXCLUDED.has(p.sku || "")).length}{" "}
            products
          </div>
        </div>

        <div className="bg-white">
          {Array.from(families.entries()).map(([family, items]) => {
            const isOpen = openFamilies.has(family);
            const hasActive = items.some((p) => p.id === selectedId);
            return (
              <div key={family}>
                <button
                  type="button"
                  onClick={() => toggleFamily(family)}
                  // B27 — this is an accordion toggle and never said so. With
                  // every family open on first paint the omission was easy to
                  // miss; now that the sidebar arrives collapsed, a screen
                  // reader user given ten unlabelled buttons has no way to know
                  // any of them expands anything, or which one is already open.
                  // It is also the only honest way to MEASURE the open state —
                  // the alternative is inferring it from child counts.
                  aria-expanded={isOpen}
                  aria-label={`${family}, ${items.length} product${items.length === 1 ? "" : "s"}`}
                  className="w-full flex items-center justify-between px-5 py-2.5 text-left"
                  style={{
                    background: hasActive ? "rgba(var(--brand-primary-rgb),0.04)" : "#f8fafc",
                    border: "none",
                    borderBottom: "1px solid #e5e9ee",
                    borderTop: "1px solid #e5e9ee",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <span
                    data-testid="family-heading"
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: hasActive ? "var(--brand-primary-text)" : "#4b5563" }}
                  >
                    {family}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(var(--brand-primary-rgb),0.1)",
                        color: "var(--brand-primary-text)",
                      }}
                    >
                      {items.length}
                    </span>
                    <span
                      style={{
                        color: "#4b5563",
                        fontSize: 10,
                        transform: isOpen ? "rotate(180deg)" : "none",
                        display: "inline-block",
                        transition: "transform 0.15s",
                      }}
                    >
                      ▼
                    </span>
                  </span>
                </button>

                {isOpen &&
                  items.map((p) => {
                    const active = p.id === selectedId;
                    return (
                      <PageLink
                        key={p.id}
                        page="products"
                        params={{ productId: p.id }}
                        onNavigate={onNavigate}
                        className="w-full text-left px-5 py-3 transition-all duration-150 block"
                        style={{
                          background: active
                            ? "rgba(var(--brand-primary-rgb),0.05)"
                            : "#ffffff",
                          // sidebar-active-border: there used to be a
                          // `border: "none"` on the NEXT line, and React writes
                          // style keys into element.style in order, so the
                          // shorthand reset all four sides and wiped the left
                          // indicator that had just been set. borderBottom
                          // survived only by sitting after it, which is why the
                          // row dividers looked right and nobody noticed.
                          //
                          // The symptom was asymmetric and that is what hid it:
                          // on a FRESH load no row had any left border, but
                          // after an in-page selection change the indicator
                          // appeared — on a re-render React only writes the
                          // keys that CHANGED, so `border` was not re-applied
                          // and stopped clobbering `borderLeft`. Click around
                          // the catalog and it works; arrive by link or refresh
                          // and it is gone.
                          //
                          // The shorthand is deleted rather than moved above:
                          // this has been an <a> since 4.21 and has no UA
                          // border to reset, and keeping both a shorthand and
                          // its longhand in one style object is what React
                          // warns about ("...can lead to styling bugs") — 4 of
                          // those per selection change, measured.
                          //
                          // The inactive 3px TRANSPARENT border is load-bearing:
                          // without it the text would shift 3px sideways as the
                          // selection moves.
                          borderLeft: active
                            ? "3px solid var(--brand-primary)"
                            : "3px solid transparent",
                          borderBottom: "1px solid #f0f3f7",
                          cursor: "pointer",
                          width: "100%",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          if (!active)
                            e.currentTarget.style.background =
                              "rgba(var(--brand-primary-rgb),0.02)";
                        }}
                        onMouseLeave={(e) => {
                          if (!active)
                            e.currentTarget.style.background = "#ffffff";
                        }}
                      >
                        <div
                          className="text-xs font-bold mb-0.5 uppercase tracking-wide"
                          style={{ color: active ? "var(--brand-primary-text)" : "#4b5563" }}
                        >
                          {p.sku}
                        </div>
                        <div
                          className="text-xs font-semibold leading-snug"
                          style={{ color: active ? "#141414" : "#4b5563" }}
                        >
                          {p.name && p.name.length > 38
                            ? p.name.slice(0, 38) + "…"
                            : p.name || p.sku}
                        </div>
                      </PageLink>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/**
 * 4.29 — does this spec table have anything to show? Kept next to the two
 * table components so the caller's layout condition and the components' own
 * early return can never disagree about what "empty" means.
 */
function specHasRows(table) {
  return Array.isArray(table?.rows) && table.rows.length > 0;
}

/** IPC Left spec table — dark header, clean row list */
function SpecTable1({ table }) {
  // #1 fix: guard against null/undefined rows — PHP admin may produce empty specTable1
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const title = table?.title ?? "Specifications:";
  // 4.29 — no rows means no table AT ALL. The heading bar used to render on
  // its own, announcing a section that is not there; a title Rick has typed
  // into an as-yet-unfilled table is not a reason to draw one. Callers also
  // test this condition (specHasRows) so the padded wrapper goes with it.
  if (!rows.length) return null;
  return (
    <div
      className="rounded-xl overflow-hidden h-full"
      style={{ border: "1px solid #e5e9ee" }}
    >
      <div
        className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wide"
        style={{ background: "var(--brand-dark)", color: "var(--brand-dark-ink)", borderBottom: "2px solid var(--brand-accent)" }}
      >
        {title}
      </div>
      <div className="bg-white divide-y" style={{ borderColor: "#e5e9ee" }}>
        {rows.map((row, i) => (
          <div key={i} className="px-4 py-3 text-sm">
            {row.label && (
              <span className="font-semibold" style={{ color: "var(--brand-primary-text)" }}>
                {row.label}{" "}
              </span>
            )}
            <span
              className="whitespace-pre-line"
              // overflowWrap: a spec value can be a single unbroken token
              // ("-55°C/+175°C(-67°F/+347°F)") longer than a 375px column.
              style={{ color: "#4b5563", fontSize: 12.5, overflowWrap: "anywhere" }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Right spec table — multi-column with optional colspan header grouping */
function SpecTable2({ table }) {
  // Guard the whole prop first: a product with no specTable2 (or null) must not
  // crash the page — destructuring null throws. Fall back to an empty table.
  const { columnSpans, rows: rawRows } = table ?? {};
  // Defensively guard both arrays against null/undefined from malformed catalog data
  const colSpans = Array.isArray(columnSpans) ? columnSpans : [];
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const hasSubHeaders = colSpans.some(
    (c) => c.colspan > 1 && Array.isArray(c.sub),
  );
  // 4.29 — IP75AD, VALUE-ADDED and VT-1100 all ship `specTable2: {rows: []}`.
  // With no rows this emitted <table><thead><tr></tr></thead></table>: a <tr>
  // with no cells, which is invalid (the content model for `tr` requires at
  // least one td/th), inside a bordered box measured at 391 x 508 px on
  // IP75AD at 1440 — an empty panel next to the real specs on a page a buyer
  // is using to evaluate a part. Header cells without data rows are not a
  // table, so this bails before any of the chrome is drawn.
  if (!rows.length) return null;

  return (
    <div
      className="rounded-xl overflow-hidden h-full"
      style={{ border: "1px solid #e0e4e8" }}
    >
      <div style={{ overflowX: "auto" }}>
      <table className="w-full text-sm border-collapse" style={{ minWidth: 240 }}>
        <thead>
          {/* Top header row */}
          <tr>
            {colSpans.map((col, i) => (
              <th
                key={i}
                colSpan={col.colspan > 1 ? col.colspan : 1}
                rowSpan={col.colspan > 1 ? 1 : hasSubHeaders ? 2 : 1}
                className="px-3 py-3 text-center whitespace-pre-line text-xs font-semibold leading-snug align-middle"
                style={{
                  // 4.23: these cells alternate between --brand-primary and
                  // --brand-accent-2, the same two stops as the page-banner
                  // gradient, so --brand-header-ink (scored on the worse of the
                  // pair) is the ink that works across the whole row.
                  color: "var(--brand-header-ink)",
                  background:
                    i === 0 ? "var(--brand-primary)" : i % 2 === 0 ? "var(--brand-accent-2)" : "var(--brand-primary)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
          {/* Sub-header row — only rendered when colspan groups with sub-labels exist */}
          {hasSubHeaders && (
            <tr>
              {colSpans
                .filter((c) => c.colspan > 1 && Array.isArray(c.sub))
                .flatMap((c, gi) =>
                  c.sub.map((s, si) => (
                    <th
                      key={`${gi}-${si}`}
                      className="px-3 py-2 text-center text-xs font-semibold"
                      style={{
                        color: "var(--brand-header-ink)",
                        background: "var(--brand-accent-2)",
                        border: "1px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      {s}
                    </th>
                  )),
                )}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ background: ri % 2 === 0 ? "#ffffff" : "#f8fafc" }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2.5 text-center"
                  style={{
                    color: "#141414",
                    border: "1px solid #e8edf2",
                    fontWeight: ci === 0 ? 600 : 400,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/*
 * `extractComplianceBadges()` used to live here, and PLAN-8 A1 deleted it.
 *
 * It was a SECOND derivation of the same facts `APPROVALS` derives, and the
 * two disagreed. Its first pattern mapped every UL mention — `U/L`, `UL File`,
 * `UL Subject`, `UL Recognized`, `224`, `VW-1` — onto the single label
 * "UL Listed", so the page-header chip row printed "UL Listed" while the
 * approvals block 200px below printed what the product actually claims.
 *
 * Measured over all 42 product pages on 2026-08-08: 20 disagreed. Six said
 * Listed against Recognized, three said Listed against Approved, nine said
 * Listed where the only real UL fact was VW-1 flammability, and two — CT and
 * IP49VP — said Listed where the approvals data claims no UL category at all.
 * CT's own spec table reads "Recognized under the Components program of
 * Underwriters' Laboratories"; the header called it Listed. IP49VP's source
 * says "U/L 224", which is a standard number for extruded tubing and not a
 * category in any sense.
 *
 * UL Listed, UL Recognized and UL Approved are distinct UL categories with
 * different scopes, and IPC sells into aerospace, medical and automotive. This
 * was a compliance claim on a document a purchasing engineer may rely on.
 * The comment above APPROVALS already said deriving structured facts from
 * prose "is wrong in ways nobody notices" — this was that, twice over.
 *
 * There is now one derivation. Do not add a second: if the header chip row is
 * ever restored, it must read `productApprovals()` like everything else.
 * `_harness/plan8-certs.js` fails if two UL categories ever print again.
 */

// Fix 12: module-level Set for ProductDetail related products exclusion
const NON_RELATABLE_TYPES = new Set(["Accessory", "Adhesive", "Tape", ""]);

/**
 * 4.26 — the "View →" glyph on a related-product card, which slides right
 * while the card is hovered.
 *
 * This was `ref={(el) => { el.closest("button").addEventListener("mouseenter",
 * …) }}` written straight into the JSX. An arrow function written in the
 * markup is a NEW function identity on every render, so React tears the ref
 * down (calls it with null) and sets it up again (calls it with the node) on
 * each pass — and nothing ever removed what the previous pass had attached.
 * ProductDetail re-renders whenever the sticky quote bar crosses its scroll
 * threshold, so just moving up and down a product page piled them up:
 * measured over CDP on ONE card, 1 -> 51 mouseenter and 1 -> 51 mouseleave
 * after 20 scroll cycles, every one of them still running.
 *
 * A useEffect with `[]` runs once per mount and its cleanup takes both
 * listeners back off. `passive` is deliberately not set: it only relaxes
 * scroll-blocking, and these are pointer events. The page's one genuine
 * scroll listener (in ProductPage) has carried `{passive:true}` all along,
 * and neither handler calls preventDefault().
 */
function RelatedArrow() {
  const glyphRef = useRef(null);
  useEffect(() => {
    const el = glyphRef.current;
    const card = el && el.closest("button");
    if (!card) return undefined;
    const enter = () => {
      el.style.transform = "translateX(4px)";
    };
    const leave = () => {
      el.style.transform = "translateX(0)";
    };
    card.addEventListener("mouseenter", enter);
    card.addEventListener("mouseleave", leave);
    return () => {
      card.removeEventListener("mouseenter", enter);
      card.removeEventListener("mouseleave", leave);
    };
  }, []);
  return (
    <span
      ref={glyphRef}
      style={{
        display: "inline-block",
        transition: "transform 0.2s ease",
        transform: "translateX(0)",
      }}
    >
      →
    </span>
  );
}

/**
 * IPC Product detail view — authority layout matching catalog format.
 * Dark header bar, two-column body, compliance badge row, dual spec tables,
 * related products footer, PDF + quote CTAs.
 */
function ProductDetail({ product, allProducts }) {
  const site = useSiteInfo();
  // Falls back to the branded placeholder when the photo 404s. The SPA rewrite
  // returns 200 + index.html for a missing image, so only the browser's own
  // load failure can detect it. (DEPLOY_READINESS_v2 T2.7)
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => { setPhotoFailed(false); }, [product && product.sku]);
  // product.pdfUrl is set by the PHP admin (upload-pdf.php → "/pdfs/<sku>.pdf").
  // When it's missing we render a "Request Data Sheet" button that routes to
  // the contact form instead — there is no external printable-page fallback.
  const hasPdfFile = Boolean(product.pdfUrl);
  // C32 — Features carries what the approvals block does not already say.
  // Filtered, not sliced: the standards are scattered through `badges` in the
  // owner's own order, not grouped at one end.
  const featureBadges = (product.badges || []).filter((b) => !isStandardBadge(b));

  // 2.4 — Related products: same partType, excluding current, up to 4
  // I3 fix + Fix 12: NON_RELATABLE_TYPES at module level — see const above ProductDetail
  const related = useMemo(() => {
    if (!allProducts || NON_RELATABLE_TYPES.has(product.partType || ""))
      return [];
    return allProducts
      .filter((p) => p.id !== product.id && p.partType === product.partType)
      .slice(0, 4);
  }, [product.id, product.partType, allProducts]);

  useEffect(() => {
    const el = document.createElement("script");
    el.id = "product-ld";
    el.type = "application/ld+json";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "sku": product.partNumber || product.id,
      // schema.org/description must be Text. All 42 products store description
      // as an ARRAY of paragraphs, so this emitted an array and Google dropped
      // the whole node. (DEPLOY_READINESS_v2 4.2)
      "description": Array.isArray(product.description)
        ? product.description.filter(Boolean).join(" ")
        : product.description || product.name,
      "brand": { "@type": "Brand", "name": "Insulation Products Corporation" },
      "manufacturer": { "@type": "Organization", "name": "Insulation Products Corporation", "url": "https://www.insulationproducts.com" },
    });
    document.head.appendChild(el);
    return () => { document.getElementById("product-ld")?.remove(); };
  }, [product.id, product.name, product.partNumber, product.description]);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        border: "1px solid #e5e9ee",
        boxShadow: "0 4px 24px rgba(var(--brand-primary-rgb),0.07)",
      }}
    >
      {/* Header — deep navy with product name, SKU, and action buttons */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a2a52 0%, var(--brand-primary) 100%)",
        }}
      >
        <div className="px-8 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div
              className="text-xs font-bold tracking-widest uppercase mb-1"
              style={{ color: "var(--brand-accent-2)" }}
            >
              Product Detail
            </div>
            {/* Stays white: this strip's gradient starts at a HARDCODED #0a2a52
                and only its far end is owner-controlled, so no single ink works
                across both. The heading is left-aligned, i.e. over the fixed
                dark end, where white is correct. Recorded as
                brand-gradient-mixed-ends. */}
            {/* C47 — not uppercased. These are the longest strings on the site
                ("NONMETALLIC LIQUID-TIGHT CONDUIT COUPLING"), and all-caps cost
                legibility on exactly the ones that wrap. The small uppercase
                eyebrow above is a deliberate part of the design system
                (PageEyebrow, PLAN-5c) and is left alone. */}
            {/* A3 — the <h1> of a product page is the product's name. It was an
                <h2> under a "Product Catalog" <h1>, so all 42 pages announced
                the same top-level heading. */}
            <h1 className="text-xl font-extrabold text-white leading-tight">
              {product.name}
            </h1>
            {/* C45 — the SKU used to be a filled pill in the action row to the
                right, at button height, immediately left of "Download PDF" and
                "Request Quote", so it read as a third button. A part number
                belongs with the name, and as a label rather than a control. */}
            {product.sku && (
              <div
                style={{
                  font: "600 12px ui-monospace, SFMono-Regular, Menlo, monospace",
                  letterSpacing: "0.06em",
                  color: "#e2e8f0",
                  marginTop: 6,
                }}
              >
                {product.sku}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {hasPdfFile ? (
              <>
                {/* Primary PDF — uses pdfLabel if set (e.g. "Molded Cap" for IP52EC), else "Download PDF" */}
                <a
                  href={product.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ipc-touch flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
                  style={{
                    background: "var(--brand-accent)",
                    color: "#141414",
                    textDecoration: "none",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 18 15 15" />
                  </svg>
                  {product.pdfLabel || "Download PDF"}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {/* Additional PDF variants (e.g. IP52EC plugged-cap) — same styling */}
                {Array.isArray(product.additionalPdfs) &&
                  product.additionalPdfs.map((extra, i) => (
                    <a
                      key={`${i}-${extra.url}`}
                      href={extra.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ipc-touch flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
                      style={{
                        background: "var(--brand-accent)",
                        color: "#141414",
                        textDecoration: "none",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <polyline points="9 15 12 18 15 15" />
                      </svg>
                      {extra.label || "Download PDF"}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ))}
              </>
            ) : (
              <PageLink
                page="contact"
                className="ipc-touch flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
                style={{
                  background: "var(--brand-accent)",
                  color: "#141414",
                  border: "none",
                  cursor: "pointer",
                }}
                title="Data sheet not yet uploaded — contact us to request one"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Request Data Sheet
              </PageLink>
            )}
            <PageLink
              // Carry the SKU across, so the RFQ arrives as "— IP35KY —"
              // instead of "General RFQ" and sales knows what was being
              // priced. (DEPLOY_READINESS_v2 4.6)
              page="contact"
              params={{ part: product.sku || product.id || "" }}
              className="ipc-touch flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
              style={{
                background: "var(--brand-primary)",
                color: "var(--brand-primary-ink)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Request Quote
            </PageLink>
          </div>
        </div>

        {/* PLAN-8 A1/C32 — the "Certifications & Standards" chip row stood here.
            It was the second of three overlapping certification blocks and the
            one printing the invented UL category; see the tombstone above
            NON_RELATABLE_TYPES. Two blocks say everything the three did:
            "Approvals & Certifications" for the standards, "Product Features"
            for everything else. */}
      </div>

      {/* Body — photo + badges/description */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-0"
        style={{ borderBottom: "1px solid #e5e9ee" }}
      >
        {/* Left — photo */}
        <div className="p-5 sm:p-8 border-b border-gray-200 md:border-b-0 md:border-r md:border-gray-200">
          {/* Product image — show real photo if available, branded placeholder if placehold.co */}
          {product.photoUrl && !product.photoUrl.includes("placehold.co") && !photoFailed ? (
            <img
              src={product.photoUrl}
              alt={product.name}
              // 4.32 — eager, deliberately. This was loading="lazy", and it is
              // the product page's largest contentful paint: measured at 1440
              // it sits at top=490 in a 900px viewport, i.e. ABOVE THE FOLD,
              // so lazy-loading it kept the one image the buyer came for out
              // of the preload scanner's reach. Do not put lazy back. It costs
              // an early fetch at 375, where the stacked layout does push it
              // below the fold — a fair trade now the photos are ~3x smaller
              // (the whole folder went 9.1 MB -> 2.7 MB).
              loading="eager"
              // The SPA rewrite makes a missing image return 200 + index.html,
              // so nothing in the stack can tell "missing" from "served" — the
              // browser just renders a broken image. Fall back to the branded
              // placeholder that already exists two lines below.
              // (DEPLOY_READINESS_v2 T2.7)
              onError={() => setPhotoFailed(true)}
              // Both this and the branded panel below carry the marker, so a
              // suite can ask "is the photo's box reserved" without guessing at
              // DOM shape — the first attempt matched an outer wrapper and
              // reported aspect-ratio:auto for a box that had one.
              data-ipc-photo-box
              className="w-full rounded-lg object-cover"
              // B23 — aspectRatio reserves the box BEFORE the bytes arrive.
              //
              // This is the LCP element on every product page and it shipped no
              // intrinsic size, so the browser gave it zero height until it
              // loaded and then pushed the page down. Measured on a throttled
              // load at 1440: CLS 0.0085 with a photograph, 0.0244 on the
              // branded fallback.
              //
              // 3/2 rather than per-file width/height attributes: the source
              // art is not one shape (CC is 800x634), object-cover already
              // crops, and the rendered box was ALREADY 3:2 at both widths —
              // 390x260 at 1440 and 358x238 at 390, because maxHeight:260 was
              // capping it. So this reproduces the existing visual almost
              // exactly while making the height predictable before load.
              // maxHeight is gone because aspectRatio now governs; leaving both
              // would let the cap fight the ratio at wide column widths.
              style={{ border: "1px solid #e5e9ee", aspectRatio: "3 / 2" }}
            />
          ) : (
            <div
              data-ipc-photo-box
              className="w-full rounded-lg flex flex-col items-center justify-center gap-4"
              style={{
                // B23 — the SAME box as the photograph above, not height:220.
                // PLAN-8 is explicit that the fallback has to reserve the same
                // space, or swapping to it shifts the page just as badly as
                // having no reservation at all — and it measured worse than the
                // photo case, 0.0244 against 0.0085.
                aspectRatio: "3 / 2",
                background: "#0a2240",
                border: "1px solid #1a3a5c",
              }}
            >
              {/* C43 — decorative. The panel beneath states the SKU and
                  "product image coming soon"; the mark adds nothing a screen
                  reader needs. */}
              <img src={site.theme?.logoUrl || "/logo.svg"} alt="" width={72} height={72} />
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--brand-accent)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {product.sku}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 4,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Product Image Coming Soon
                </div>
              </div>
            </div>
          )}
          {product.caption && (
            <p
              className="mt-3 text-xs font-semibold"
              style={{ color: "var(--brand-primary-text)" }}
            >
              {product.caption}
            </p>
          )}
        </div>

        {/* Right — approvals, feature badges, description */}
        <div className="p-5 sm:p-8">
          {/* Approvals sit ABOVE the free-text badges and are visually distinct:
              these are the structured, filterable facts, and the badges below
              are marketing copy. Rendering them together would suggest the
              badges are also filterable, which is the confusion this whole
              item exists to remove. */}
          {productApprovals(product).length > 0 && (
            <div className="mb-5">
              <div
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "#4b5563", marginBottom: 8,
                }}
              >
                Approvals &amp; Certifications
              </div>
              <div className="flex flex-wrap gap-2">
                {productApprovals(product).map((a) => (
                  <span
                    key={a}
                    data-ipc-approval-mark
                    className="px-2.5 py-1 rounded"
                    style={{
                      font: "600 11px ui-monospace, SFMono-Regular, Menlo, monospace",
                      letterSpacing: "0.03em",
                      background: "#ffffff",
                      color: "#374151",
                      border: "1px solid #d1d9e0",
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {featureBadges.length > 0 && (
            <div className="mb-5">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#4b5563",
                  marginBottom: 8,
                }}
              >
                Product Features
              </div>
              <div className="flex flex-wrap gap-2">
                {featureBadges.map((b, i) => (
                  <span
                    key={`${i}-${b}`}
                    className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide"
                    style={{
                      background: "rgba(var(--brand-primary-rgb),0.08)",
                      color: "var(--brand-primary-text)",
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            {(product.description || []).map((para, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed"
                style={{ color: "#4b5563" }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Spec tables — two column.
          minWidth: 0 on both cells. A grid item defaults to min-width:auto, so
          one long unbroken spec value stretched the TRACK past the viewport and
          the whole page scrolled sideways at 375px — measured on IP35KY
          (scrollWidth 377) and IP55FL (381). SpecTable2 already scrolls inside
          its own container; this is the other half of the same bug.
          (AUDIT_v3_FINDINGS NB18) */}
      {/* 4.29 — an absent table takes its wrapper with it. SpecTable1/2 return
          null on an empty `rows`, but the padded, half-width, right-bordered
          cell around them is drawn here, so hiding only the table left the
          empty panel behind. When just one table survives the grid collapses
          to a single column and the divider is dropped, so the remaining
          specs use the full width instead of sitting beside a blank half. */}
      {(specHasRows(product.specTable1) || specHasRows(product.specTable2)) && (
      <div className={`grid grid-cols-1 gap-0${specHasRows(product.specTable1) && specHasRows(product.specTable2) ? " md:grid-cols-2" : ""}`}>
        {specHasRows(product.specTable1) && (
        <div className={`p-5 sm:p-8${specHasRows(product.specTable2) ? " border-b border-gray-200 md:border-b-0 md:border-r md:border-gray-200" : ""}`} style={{ minWidth: 0 }}>
          <SpecTable1 table={product.specTable1} />
        </div>
        )}
        {specHasRows(product.specTable2) && (
        <div className="p-5 sm:p-8" style={{ minWidth: 0 }}>
          <SpecTable2 table={product.specTable2} />
        </div>
        )}
      </div>
      )}

      {/* 2.4 — Related Products */}
      {related.length > 0 && (
        <div
          className="p-8"
          style={{ borderTop: "1px solid #e5e9ee", background: "#f8fafc" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "var(--brand-primary-text)" }}
          >
            Related Products — {product.partType}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {related.map((rp) => (
              <button
                key={rp.id}
                onClick={() => setSearchParam("productId", rp.id)}
                className="group text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e9ee",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--brand-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e9ee";
                }}
              >
                <div
                  className="text-xs font-bold uppercase mb-1 transition-colors duration-200 group-hover:text-blue-700"
                  style={{ color: "var(--brand-primary-text)" }}
                >
                  {rp.sku}
                </div>
                <div
                  className="text-xs font-semibold leading-snug transition-colors duration-200 group-hover:text-blue-900"
                  style={{ color: "#141414" }}
                >
                  {rp.name && rp.name.length > 45
                    ? rp.name.slice(0, 45) + "…"
                    : rp.name || rp.sku}
                </div>
                <div
                  className="mt-2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-0.5"
                  style={{ color: "var(--brand-accent)" }}
                >
                  View <RelatedArrow />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * IPC Product page — dark page header + sidebar + detail view.
 * Sticky RFQ bar appears after scrolling past the product header.
 */
// Normalise a SKU for comparison: strip everything that isn't alphanumeric.
// "IP37SH - IP36TH - IP39LH" and "IP37SH-IP36TH-IP39LH" are the same part; the
// spaced form in content.json silently rendered a conduit coupling instead.
// (DEPLOY_READINESS_v2 T2.8)
function normalizeSku(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Is `needle` one of the hyphen-separated segments of a compound SKU?
// Anchored on purpose: the old test was `sku.includes(id) || id.includes(sku)`,
// which matched ?productId=CC90S against the two-character SKU "CC" and served
// a different part under an unchanged URL. For a distributor where the SKU IS
// the product, silently substituting a part is the worst available failure.
function skuSegmentMatch(sku, needle) {
  const n = normalizeSku(needle);
  if (!n) return false;
  return String(sku || "")
    .split(/[-\/,]/)
    .map(normalizeSku)
    .filter(Boolean)
    .includes(n);
}

/**
 * C29 — the catalog landing grid shown on a bare /products.
 *
 * Every card is a real <a href="/products?productId=…"> via PageLink, so the
 * grid is 42 crawlable internal links to pages that previously had none
 * pointing at them from the canonical /products (4.21).
 *
 * Photos are LAZY here, deliberately, and that is the opposite of the product
 * detail page's `eager` — see 4.32. There the photo is the LCP element; here
 * there are 42 of them and at most a handful are above the fold. Both carry
 * width/height so neither shifts the layout.
 *
 * The placehold.co guard is A7's, repeated rather than referenced: five
 * products carry such a URL, and rendering it would put back the external
 * request A7 removed — on a page that did not exist when A7 shipped.
 */
function CatalogLanding({ products }) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {products.map((p) => {
          const photo =
            p.photoUrl && !String(p.photoUrl).includes("placehold.co") ? p.photoUrl : "";
          return (
            <PageLink
              key={p.id}
              page="products"
              params={{ productId: p.id }}
              data-ipc-catalog-card=""
              className="bg-white rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 2px 10px rgba(var(--brand-primary-rgb),0.05)",
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt={p.name}
                  loading="lazy"
                  width="400"
                  height="267"
                  className="w-full object-cover"
                  style={{ aspectRatio: "3 / 2", borderBottom: "1px solid #e5e9ee" }}
                />
              ) : (
                <div
                  className="w-full flex items-center justify-center"
                  style={{
                    aspectRatio: "3 / 2",
                    borderBottom: "1px solid #e5e9ee",
                    background: "linear-gradient(135deg, #f5f7fa, #e8eef7)",
                    color: "var(--brand-primary-text)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  IMAGE COMING SOON
                </div>
              )}
              <div className="px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      padding: "2px 8px",
                      borderRadius: 5,
                      background: "rgba(var(--brand-primary-rgb),0.08)",
                      color: "var(--brand-primary-text)",
                    }}
                  >
                    {p.sku || p.id}
                  </span>
                  <span style={{ fontSize: 11, color: "#4b5563" }}>{p.partType}</span>
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: "#141414", lineHeight: 1.35 }}
                >
                  {p.name}
                </span>
              </div>
            </PageLink>
          );
        })}
      </div>
    </div>
  );
}

function ProductPage({ products }) {
  // Read-only now: the sidebar's <PageLink>s write ?productId= themselves, so
  // nothing in this component sets it. (PLAN-1 4.21)
  const [selectedId] = useSearchParam("productId");
  // Exact, then whole-SKU-ignoring-punctuation, then whole-segment match.
  // No blind fall-through to products[0] — see notFound below.
  const matched = selectedId
    ? products.find((p) => p.id === selectedId || p.sku === selectedId) ||
      products.find(
        (p) =>
          normalizeSku(p.sku) === normalizeSku(selectedId) ||
          normalizeSku(p.id) === normalizeSku(selectedId),
      ) ||
      products.find(
        (p) => skuSegmentMatch(p.sku, selectedId) || skuSegmentMatch(p.id, selectedId),
      ) ||
      null
    : null;
  const notFound = !!selectedId && !matched;
  // C29 — a bare /products is the CATALOG, not a product.
  //
  // This used to be `matched || products[0]`, with the no-selection branch
  // above resolving to products[0] as well: /products auto-selected CC and
  // rendered its detail under a "Product Catalog" banner and the sub-line
  // "Select a product to view full specifications" — with one already
  // selected. The canonical /products page therefore WAS the CC product page,
  // which is a duplicate-content overlap with ?productId=CC and leaves the
  // natural landing page for a "product catalog" search non-existent.
  //
  // A bad ?productId= still falls back to the first product, because that
  // path shows the not-found banner and needs something behind it. Only the
  // no-param case becomes the landing.
  const landing = !selectedId;
  const product = selectedId ? matched || products[0] || null : null;

  // C33 — the breadcrumb trail for this route.
  const families = familyOrder(useContent());
  const crumbTrail = useMemo(() => {
    const t = [
      { label: "Home", page: "home" },
      { label: "Product Catalog", page: "products" },
    ];
    if (!product) return t;
    const family = String(product.partType || "").trim();
    if (family && families.includes(family)) {
      t.push({ label: family, page: "dashboard", params: { family } });
    }
    t.push({ label: product.name, page: "products", params: { productId: product.id } });
    return t;
  }, [product, families]);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [pulseSkuBadge, setPulseSkuBadge] = useState(false);
  const prevShowRef = useRef(false);
  // The sticky RFQ bar is fixed-position and 72px tall. Pad the document, not
  // just <main> — <Footer> is a sibling, so the old paddingBottom on
  // ProductPage left the bar sitting on top of the copyright and address on
  // every product page. Toggled on <body> rather than via CSS :has() so it
  // does not depend on selector support. (DEPLOY_READINESS_v2 T2.9)
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("ipc-has-sticky-rfq", showStickyBar);
    return () => document.body.classList.remove("ipc-has-sticky-rfq");
  }, [showStickyBar]);
  const headerRef = useRef(null);
  const detailRef = useRef(null);

  // Fix 3: use headerRef for dynamic threshold — adapts if page header height changes
  useEffect(() => {
    const handleScroll = () => {
      const threshold = (headerRef.current?.offsetHeight ?? 220) + 40;
      const nowVisible = window.scrollY > threshold;
      setShowStickyBar(nowVisible);
      // Pulse the SKU badge the moment the bar first slides into view
      if (nowVisible && !prevShowRef.current) {
        setPulseSkuBadge(true);
        setTimeout(() => setPulseSkuBadge(false), 900);
      }
      prevShowRef.current = nowVisible;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // An EMPTY catalog, which is not the same thing as no selection. This was
  // `if (!product)`, and since C29 gave `product` a legitimate null on the
  // bare route, that condition would have shown "No products found in
  // catalog." on the landing page itself.
  if (!products.length) {
    return (
      <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
        <div className="ipc-page-header">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h1
              className="text-4xl font-extrabold"
              style={{ color: "var(--brand-header-ink)" }}
            >
              Product Catalog
            </h1>
          </div>
        </div>
        <div
          className="max-w-7xl mx-auto px-6 py-16 text-center"
          style={{ color: "#6b7280" }}
        >
          No products found in catalog.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ background: "#f5f7fa", minHeight: "100vh" }}
    >
      {/* Page header */}
      <div
        ref={headerRef}
        className="ipc-page-header"
        style={{ borderBottom: "none" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* C33 — Home › Product Catalog › family › product. The family comes
              from the product's OWN partType, checked against familyOrder() so
              an owner-renamed family is honoured and a partType that is not a
              family at all is dropped rather than linked to an empty filter.
              There is no second hardcoded list.
              First in the band, matching /dashboard and /datasheets. */}
          <Breadcrumb trail={crumbTrail} />
          <PageEyebrow>
            Products
          </PageEyebrow>
          {/* A3 — deliberately a div, not an <h1>.
              /products always has a product selected, so this band said
              "Product Catalog" as the <h1> of all 42 product pages while the
              product's own name sat below it as an <h2>. The page's subject is
              the product, so the <h1> is the product name in the detail header
              and this keeps the identical visual treatment without competing
              for it. PLAN-8's Option B calls this "demoted to the eyebrow or a
              visually-hidden heading"; a styled div is that demotion and costs
              no visual change at all.
              C29 has now given /products that landing state, so the heading
              below is a real <h1> when nothing is selected and stays a div
              when a product is. */}
          {landing ? (
            <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
              Product Catalog
            </h1>
          ) : (
            <div className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
              Product Catalog
            </div>
          )}
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            {landing
              ? `Browse all ${products.length} products — heat shrink tubing, sleeving, tapes, adhesives and accessories. Select one for full specifications, its data sheet, and a quote request.`
              : "Select another product from the list to view full specifications, data sheet, and request a quote."}
          </p>
        </div>
      </div>

      {/* Part-not-found banner. An unknown ?productId= used to silently render
          a DIFFERENT product with the URL unchanged — a customer following a
          stale link or a typo'd SKU got someone else's part and no signal that
          anything was wrong. (DEPLOY_READINESS_v2 T2.8) */}
      {notFound && (
        <div
          role="alert"
          className="max-w-7xl mx-auto px-6 pt-6"
        >
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              borderRadius: 10,
              padding: "14px 18px",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <strong>We couldn't find part “{selectedId}”.</strong> It may have been
            renamed or discontinued. Showing the catalog instead — pick a part from
            the list, or{" "}
            <PageLink
              page="contact"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
                color: "var(--brand-primary-text)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              ask us about it
            </PageLink>
            .
          </div>
        </div>
      )}

      {/* items-stretch below lg. Stacked, this is a COLUMN flex container, and
          `items-start` there means align-items:flex-start — each child is sized
          to its own max-content width instead of the viewport. On IP35KY and
          IP55FL the detail card's widest spec row won and the whole page
          scrolled sideways (scrollWidth 377 and 381 against a 375 viewport).
          `min-w-0` cannot help: it bounds shrinking, and nothing was shrinking.
          items-start is still what we want once the row layout kicks in at lg.
          (AUDIT_v3_FINDINGS NB18) */}
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col lg:flex-row gap-8 items-stretch lg:items-start">
        <ProductSidebar
          products={products}
          selectedId={product ? product.id : null}
          onNavigate={() => {
            // PageLink has already written ?productId= to the URL; this is only
            // the side effect the old onSelect performed alongside it.
            setShowStickyBar(false);
            if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
              detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
        <div ref={detailRef} className="flex-1 min-w-0">
          {landing ? (
            <CatalogLanding products={products} />
          ) : (
            <ProductDetail product={product} allProducts={products} />
          )}
        </div>
      </div>

      {/* Sticky RFQ bar — spring slide-in with slight overshoot.
          C29 — only when a product is selected. It quotes the SKU, the name
          and the datasheet of `product`, so on the bare catalog landing there
          is nothing for it to be about. */}
      {product && (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: "var(--brand-dark)",
          borderTop: "2px solid var(--brand-accent)",
          transform: showStickyBar ? "translateY(0)" : "translateY(110%)",
          /* Spring cubic-bezier: overshoots slightly then settles — more personality than ease */
          transition: showStickyBar
            ? "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)"
            : "transform 0.25s ease-in",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
        }}
      >
        {/* flex-wrap + min-w-0: at 375px on the one product with two datasheets
            the bar measured 483px wide against a 375px viewport, and because it
            is position:fixed the overflow creates no scrollbar — "Request a
            Quote" was simply off-screen and untappable, on the conversion
            control. (DEPLOY_READINESS_v2 T2.9) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Left: current product name */}
          <div className="min-w-0 hidden sm:block">
            {/* SKU badge — pulses cyan on first appearance to draw the eye */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 1,
                color: pulseSkuBadge ? "#141414" : "var(--brand-accent-2)",
                background: pulseSkuBadge ? "var(--brand-accent)" : "transparent",
                padding: pulseSkuBadge ? "1px 6px" : "1px 0",
                borderRadius: 4,
                transition: "all 0.3s ease",
                display: "inline-block",
              }}
            >
              {product.sku}
            </div>
            {/* C46 — two lines, clamped on a word boundary rather than one
                line cut mid-word. This was nowrap + ellipsis, which produced
                "Commercial Grade Polyolefin Tubi…", "UV Resistant PVC Heat
                Shrink Tub…" and "Thin Wall Heat Shrinkable Polyol…" across
                most of the catalog — in the one view where the name is all a
                buyer has to go on. line-clamp breaks between words. */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--brand-dark-ink)",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                maxWidth: 400,
              }}
            >
              {product.name}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 min-w-0 ml-auto">
            {product.pdfUrl ? (
              <>
                {/* Primary PDF — uses pdfLabel if set, else generic "Data Sheet" */}
                <a
                  href={product.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ipc-tap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 16px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "rgba(255,255,255,0.1)",
                    color: "var(--brand-dark-ink)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 18 15 15" />
                  </svg>
                  {product.pdfLabel || "Data Sheet"}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {/* Additional PDF variants — same styling */}
                {Array.isArray(product.additionalPdfs) &&
                  product.additionalPdfs.map((extra, i) => (
                    <a
                      key={`${i}-${extra.url}`}
                      href={extra.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ipc-tap"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "9px 16px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "rgba(255,255,255,0.1)",
                        color: "var(--brand-dark-ink)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <polyline points="9 15 12 18 15 15" />
                      </svg>
                      {extra.label || "Data Sheet"}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ))}
              </>
            ) : null}
            <PageLink
              page="contact"
              className="ipc-tap"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 20px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                background: "var(--brand-primary)",
                color: "var(--brand-primary-ink)",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--brand-primary-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--brand-primary)")
              }
            >
              Request a Quote →
            </PageLink>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// Fix 8: DashboardPage column definitions at module level — not recreated on every keystroke
/**
 * B19 — the widths are real now.
 *
 * These `width` values were already here and the browser ignored every one of
 * them, because the table laid out on content (`table-layout: auto`, where a
 * width is a suggestion the algorithm may overrule). Measured at 1440 before
 * the fix: Product Name 159, Part ID 223, Part Type 227, Description 130,
 * Temp 110, Specifications 163, Action 173. The two columns holding a short
 * SKU and a small chip took 450px between them while the longest content in
 * the table got 130 and wrapped to one to three words a line. Rows came out up
 * to 263px tall and 41 products made a 9,460px page.
 *
 * `table-layout: fixed` on the table is what makes these authoritative. It
 * also fixes A6 for free: a fixed table honours width:100% and cannot extend
 * past its wrapper, so the "View Product" buttons in the last column stop
 * being cut off. Measured before: 41 of 41 clipped at 1024.
 *
 * (The verb above is "extend" on purpose. The word you would reach for first
 * is a Tailwind utility name, and Tailwind's extractor scans raw source text
 * with comments included, so writing it emits that whole flex rule into the
 * shipped CSS. This repo has now done it three times, every time in a
 * comment — and twice in the comment written to explain the previous
 * occurrence, including the first draft of THIS one, which named the class
 * and put the rule straight back. Do not name it here. The selector diff in
 * _harness/cssdiff.js catches it; the build's byte count does not.)
 *
 * Description is deliberately the one column with no width — under
 * `table-layout: fixed` the unsized column takes whatever is left, which is
 * what the longest content should get.
 *
 * Temp is 150 rather than the 90 a temperature range looks like it needs.
 * IP64FS-IP65VC-IP66AC-IP67SC's value is "Up to 1200°F (Heat Treated); 130°C
 * (Vinyl Coated); …", which at 90px wrapped to 282px and made that one row
 * taller than the four shortest rows combined. Measured per cell: the
 * description was never the problem — Temp and Specifications were.
 */
const DASHBOARD_COLS = [
  { key: "name", label: "Product Name", width: 190 },
  { key: "partId", label: "Part ID", width: 105 },
  { key: "partType", label: "Part Type", width: 115 },
  { key: "description", label: "Description", width: null },
  { key: "operatingTemp", label: "Temp", width: 150 },
  { key: "specifications", label: "Specifications", width: 215 },
];

/**
 * B20 — the empty-state cell must span every column, including Action, which
 * is rendered outside the DASHBOARD_COLS loop. It was hardcoded to 6 against a
 * 7-column table, so the no-results panel stopped 130px short of the table's
 * right edge and left a grey band. Derived so adding a column cannot desync it
 * again.
 */
const DASHBOARD_COL_COUNT = DASHBOARD_COLS.length + 1;

/**
 * IPC Product Dashboard — dark header, authority table with search, sort, and "View Product" CTA.
 * Accepts the live products array as a prop; derives table rows dynamically.
 */
function DashboardPage({ products }) {
  const [search, setSearch] = useState("");
  const [approvals, setApprovals] = useState([]);
  const [sortCol, setSortCol] = useState("partId");
  const [sortDir, setSortDir] = useState("asc");

  // Read ?family= URL param so clicking a category in the navbar pre-selects the filter pill.
  // Clear the param from the URL after reading so it doesn't persist on manual filter changes.
  const [familyParam, setFamilyParam] = useSearchParam("family");
  const [activeFamily, setActiveFamily] = useState(() => familyParam || "All");
  // Re-run whenever familyParam changes so navbar category clicks work on subsequent navigations
  useEffect(() => {
    if (familyParam) {
      setActiveFamily(familyParam);
      // REPLACE, never push: this cleanup runs on every render where the param
      // is present, so pushing made every Back press re-enter it and push
      // again — the visitor could never leave the Product Index.
      setFamilyParam(null, { replace: true });
    }
  }, [familyParam]);

  // HOISTING FIX: tableRows must be defined BEFORE families useMemo.
  // C3 fix: memoized. P7 fix: reuses SIDEBAR_EXCLUDED (module-level) — single source of truth.
  // SIDEBAR_EXCLUDED is defined at module level above ProductSidebar.
  const tableRows = useMemo(
    () =>
      products
        .filter((p) => !SIDEBAR_EXCLUDED.has(p.sku || ""))
        .map((p) => {
          const descFull = Array.isArray(p.description)
            ? p.description.join(" ")
            : String(p.description || "");
          const descShort =
            descFull.length > 110 ? descFull.slice(0, 110) + "…" : descFull;
          return {
            name: p.name || "",
            partId: p.sku || p.id || "",
            partType: p.partType || "",
            descShort,
            descFull,
            operatingTemp: p.operatingTemp || "",
            specs: p.specificationsSummary || "",
            approvals: productApprovals(p),
            productId: p.id || p.sku || "",
          };
        }),
    [products],
  ); // only recompute when the catalog changes

  // Build unique family list — now correctly reads tableRows (already defined above)
  const families = useMemo(() => {
    const counts = {};
    for (const row of tableRows) {
      const f = row.partType || "Other";
      counts[f] = (counts[f] || 0) + 1;
    }
    return [
      { label: "All", count: tableRows.length },
      ...Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count })),
    ];
  }, [tableRows]); // tableRows is already memoized on products — no double-dependency

  const filtered = tableRows
    .filter((row) => {
      if (activeFamily !== "All" && row.partType !== activeFamily) return false;
      // AND, not OR: selecting UL and MIL-SPEC means a product must hold both.
      if (approvals.length && !approvals.every((a) => row.approvals.includes(a))) return false;
      const q = search.toLowerCase();
      return (
        row.partId.toLowerCase().includes(q) ||
        row.partType.toLowerCase().includes(q) ||
        row.descFull.toLowerCase().includes(q) ||
        row.operatingTemp.toLowerCase().includes(q) ||
        row.specs.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const key =
        sortCol === "description"
          ? "descFull"
          : sortCol === "specifications"
            ? "specs"
            : sortCol;
      // Strip parenthetical suffixes from name before comparing so compound products sort naturally
      const normalize = (v) =>
        key === "name" ? v.replace(/\s*\(.*$/, "").trim() : v;
      const av = normalize(a[key] || ""),
        bv = normalize(b[key] || "");
      return sortDir === "asc"
        ? av.localeCompare(bv, undefined, { sensitivity: "base" })
        : bv.localeCompare(av, undefined, { sensitivity: "base" });
    });

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  // handleViewProduct is gone: both "View Product" controls are <PageLink
  // page="products" params={{ productId }}> now, so the URL they produce is a
  // real href a crawler can follow. (PLAN-1 4.21)

  // Fix 8: cols references DASHBOARD_COLS (module-level) — not recreated on every keystroke
  const cols = DASHBOARD_COLS;

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* C33 — the Product Index is a view of the catalog, so its parent
              is the catalog rather than Home directly. */}
          <Breadcrumb
            trail={[
              { label: "Home", page: "home" },
              { label: "Product Catalog", page: "products" },
              { label: "Product Index", page: "dashboard" },
            ]}
          />
          <PageEyebrow>
            Product Index
          </PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            Product Index
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            Browse all {tableRows.length} products with key specifications.
            Click <strong className="ipc-ink-header">View Product</strong> for full
            data sheets and quote requests.
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1280,
          marginLeft: "auto",
          marginRight: "auto",
          padding: "2.5rem 24px",
        }}
      >
        {/* Category filter — dropdown on mobile, pill strip on desktop */}

        {/* Mobile: collapsible filters panel */}
        <details className="sm:hidden mb-5">
          <summary
            style={{
              cursor: 'pointer',
              padding: '12px 14px',
              background: '#ffffff',
              border: '1px solid #d1d9e0',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#141414',
              listStyle: 'none',
            }}
          >
            Filters{activeFamily !== 'All' ? ` · ${activeFamily}` : ''}
            {search ? ` · "${search}"` : ''}
          </summary>
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#6b7280",
                marginBottom: 6,
              }}
            >
              Filter by Category
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={activeFamily}
                onChange={(e) => {
                  setActiveFamily(e.target.value);
                  setSearch("");
                }}
                style={{
                  width: "100%",
                  appearance: "none",
                  WebkitAppearance: "none",
                  padding: "11px 40px 11px 14px",
                  borderRadius: 8,
                  border:
                    activeFamily !== "All"
                      ? "2px solid var(--brand-primary)"
                      : "1px solid #d1d9e0",
                  background: "#ffffff",
                  color: "#141414",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {families.map(({ label, count }) => (
                  <option key={label} value={label}>
                    {label === "All"
                      ? `All Products (${count})`
                      : `${label} (${count})`}
                  </option>
                ))}
              </select>
              {/* Custom chevron */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#005da3"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {activeFamily !== "All" && (
              <button
                onClick={() => setActiveFamily("All")}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--brand-primary-text)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕ Clear filter
              </button>
            )}
            {/* Mobile search input — inside the collapsible panel */}
            <div style={{ position: "relative", marginTop: 12 }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: "absolute",
                  left: 13,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  flexShrink: 0,
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by part ID, type, or description…"
                aria-label="Search products"
                className="w-full rounded-lg outline-none transition-all duration-200"
                style={{
                  border: "1px solid #d1d9e0",
                  background: "#ffffff",
                  color: "#141414",
                  padding: "10px 16px 10px 40px",
                  fontSize: 16,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--brand-primary)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(var(--brand-primary-rgb),0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#d1d9e0";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
        </details>

        {/* Desktop (sm+): wrapping pill strip */}
        <div
          className="hidden sm:flex mb-6"
          style={{
            flexWrap: "wrap",
            gap: 8,
            paddingBottom: 12,
            borderBottom: "1px solid #e5e9ee",
          }}
        >
          {families.map(({ label, count }) => {
            const active = activeFamily === label;
            return (
              <button
                key={label}
                onClick={() => {
                  setActiveFamily(label);
                  setSearch("");
                }}
                className="ipc-tap"
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: active ? "2px solid var(--brand-primary)" : "1px solid #d1d9e0",
                  background: active ? "var(--brand-primary)" : "#ffffff",
                  color: active ? "var(--brand-primary-ink)" : "#4b5563",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "var(--brand-primary)";
                    e.currentTarget.style.color = "var(--brand-primary-text)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "#d1d9e0";
                    e.currentTarget.style.color = "#4b5563";
                  }
                }}
              >
                {label}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 10,
                    // The active chip's white veil was 0.2, which lifted its
                    // background to rgb(51,125,181) and left the count at
                    // 4.43:1 against it — the ink is full-strength already, so
                    // the veil was the whole of the shortfall. 0.10 keeps the
                    // pill visible and gives the count its contrast back.
                    // Verified across all four palettes with plan2-contrast
                    // rather than reasoned about: a white veil helps a dark ink
                    // and hurts a light one, so this direction is only safe
                    // because it was measured on every palette.
                    background: active
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(var(--brand-primary-rgb),0.08)",
                    color: active ? "var(--brand-dark-ink)" : "var(--brand-primary-text)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-semibold"
              style={{ color: "#141414" }}
            >
              {filtered.length} of {tableRows.length} products
            </span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: "rgba(var(--brand-primary-rgb),0.1)",
                  color: "var(--brand-primary-text)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                filtered ✕
              </button>
            )}
          </div>
          <div className="hidden sm:block relative sm:w-80">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: "absolute",
                left: 13,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                flexShrink: 0,
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by part ID, type, or description…"
              aria-label="Search products"
              className="w-full rounded-lg outline-none transition-all duration-200"
              style={{
                border: "1px solid #d1d9e0",
                background: "#ffffff",
                color: "#141414",
                padding: "10px 16px 10px 40px",
                fontSize: 16,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--brand-primary)";
                e.target.style.boxShadow = "0 0 0 3px rgba(var(--brand-primary-rgb),0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d1d9e0";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
        </div>

        <ApprovalFilter
          products={products}
          selected={approvals}
          onToggle={(a) =>
            setApprovals((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]))
          }
          onClear={() => setApprovals([])}
        />

        {/* Mobile-only card list — replaces the table below 640px */}
        <div className="sm:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
              {tableRows.length === 0
                ? 'Loading catalog…'
                : `No results${search ? ` for "${search}"` : ''}${activeFamily !== 'All' ? ` in ${activeFamily}` : ''}.`}
            </div>
          ) : (
            filtered.map((row) => (
              <div
                key={row.productId}
                style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  border: '1px solid #e5e9ee',
                  padding: 16,
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary-text)', letterSpacing: '0.04em' }}>
                      {row.partId}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#141414', marginTop: 2, lineHeight: 1.3 }}>
                      {row.name}
                    </div>
                  </div>
                  {row.partType && (
                    <span
                      style={{
                        flexShrink: 0,
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: 'rgba(17,158,200,0.1)',
                        // The MOBILE card's type chip. Its desktop twin at the
                        // <td> below already says --brand-accent-text; this one
                        // was left on the bright accent and measures 2.79:1 over
                        // the tint, against 4.72:1 for the text-safe variant.
                        // Both are visible at their own viewport, so testing at
                        // one width only would have found one of the two.
                        color: 'var(--brand-accent-text)',
                      }}
                    >
                      {row.partType}
                    </span>
                  )}
                </div>
                {row.descShort && (
                  <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5, marginBottom: 10 }}>
                    {row.descShort}
                  </div>
                )}
                {row.operatingTemp && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
                    Operating temp: <span style={{ color: '#141414', fontWeight: 500 }}>{row.operatingTemp}</span>
                  </div>
                )}
                <PageLink
                  page="products"
                  params={{ productId: row.productId }}
                  style={{
                    display: 'block',
                    // <a> is left-aligned where <button> centres. Full-width
                    // control, so this is visible. (PLAN-1 4.21 styling risk)
                    textAlign: 'center',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    background: 'var(--brand-primary)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View Product →
                </PageLink>
              </div>
            ))
          )}
        </div>

        {/* Table */}
        <div
          className="hidden sm:block rounded-xl overflow-hidden"
          style={{
            border: "1px solid #e5e9ee",
            boxShadow: "0 2px 12px rgba(var(--brand-primary-rgb),0.07)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                // B19/A6 — see DASHBOARD_COLS. Without this the declared column
                // widths are only hints and the table sizes itself on content,
                // which both inverted the columns and pushed the table past its
                // wrapper so the primary action was clipped.
                tableLayout: "fixed",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: "var(--brand-dark)" }}>
                  {/* 4.19 — these were bare <th onClick>: no tabindex, no
                      scope, no aria-sort. A keyboard user could not sort at
                      all, and a screen-reader user was told neither that the
                      table was sortable nor which column was active.
                      The control is a real <button> INSIDE the th, not a
                      tabindex on the th — sorting changes state, not the page,
                      so this is the one place in Plan 1's aftermath where a
                      button is the right element. */}
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={
                        sortCol === col.key
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      style={{
                        padding: 0,
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color:
                          sortCol === col.key
                            ? "var(--brand-accent)"
                            : "rgba(var(--brand-dark-ink-rgb), 0.65)",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                        width: col.width || undefined,
                        borderBottom: "2px solid var(--brand-primary)",
                      }}
                    >
                      <button
                        type="button"
                        className="ipc-sort-btn"
                        data-sort-key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{ padding: "13px 18px" }}
                      >
                        {col.label}{" "}
                        {/* The glyph is decoration: aria-sort on the th already
                            states the direction, and announcing "black up
                            pointing triangle" after it helps nobody. */}
                        <span style={{ fontSize: 9 }} aria-hidden="true">
                          {sortCol === col.key
                            ? sortDir === "asc"
                              ? "▲"
                              : "▼"
                            : "⇅"}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th
                    scope="col"
                    style={{
                      padding: "13px 18px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "rgba(var(--brand-dark-ink-rgb), 0.65)",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      borderBottom: "2px solid var(--brand-primary)",
                      // A6 — 155, not 130. Under table-layout:fixed the column
                      // no longer grows to fit, and the "View Product" control
                      // is 120px inside 18px of padding each side: 130 left it
                      // overflowing its own cell by 8px, which is exactly the
                      // clipping this item is about, only now clipped by the
                      // cell instead of by the wrapper.
                      width: 155,
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={DASHBOARD_COL_COUNT}
                      style={{ padding: "56px 24px", background: "#ffffff" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 12,
                          maxWidth: 320,
                          margin: "0 auto",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            background: "rgba(var(--brand-primary-rgb),0.07)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="26"
                            height="26"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#005da3"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#141414",
                          }}
                        >
                          {tableRows.length === 0
                            ? "Loading catalog…"
                            : "No products found"}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            lineHeight: 1.5,
                          }}
                        >
                          {tableRows.length === 0
                            ? "Please wait while the product catalog loads."
                            : `No results${search ? ` for "${search}"` : ""}${activeFamily !== "All" ? ` in ${activeFamily}` : ""}. Try a different search term or clear the category filter.`}
                        </div>
                        {(search || activeFamily !== "All") && (
                          <button
                            onClick={() => {
                              setSearch("");
                              setActiveFamily("All");
                            }}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--brand-primary-text)",
                              background: "rgba(var(--brand-primary-rgb),0.07)",
                              border: "1px solid rgba(var(--brand-primary-rgb),0.2)",
                              cursor: "pointer",
                              padding: "7px 16px",
                              borderRadius: 6,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "rgba(var(--brand-primary-rgb),0.12)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                "rgba(var(--brand-primary-rgb),0.07)";
                            }}
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, ri) => (
                    <tr
                      key={row.productId}
                      data-ipc-product-row={row.partId}
                      style={{
                        background: ri % 2 === 0 ? "#ffffff" : "#fafbfc",
                        borderBottom: "1px solid #e5e9ee",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(var(--brand-primary-rgb),0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          ri % 2 === 0 ? "#ffffff" : "#fafbfc";
                      }}
                    >
                      {/* Product Name */}
                      <td
                        style={{
                          padding: "13px 18px",
                          maxWidth: 260,
                          lineHeight: 1.4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#141414",
                          }}
                        >
                          {row.name}
                        </span>
                      </td>
                      {/* Part ID */}
                      <td
                        style={{ padding: "13px 18px", whiteSpace: "nowrap" }}
                      >
                        <span style={{ fontWeight: 700, color: "var(--brand-primary-text)" }}>
                          {row.partId}
                        </span>
                      </td>
                      {/* Part Type */}
                      <td
                        style={{ padding: "13px 18px", whiteSpace: "nowrap" }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            background: "rgba(17,158,200,0.1)",
                            color: "var(--brand-accent-text)",
                          }}
                        >
                          {row.partType || "—"}
                        </span>
                      </td>
                      {/* Description — truncated to 110 chars, full text on hover */}
                      <td
                        style={{
                          padding: "13px 18px",
                          color: "#4b5563",
                          lineHeight: 1.5,
                          maxWidth: 280,
                        }}
                      >
                        <span title={row.descFull}>{row.descShort || "—"}</span>
                      </td>
                      {/* Operating Temp */}
                      <td
                        style={{
                          padding: "13px 18px",
                          color: "#141414",
                          fontWeight: 500,
                          maxWidth: 110,
                          lineHeight: 1.4,
                        }}
                      >
                        {row.operatingTemp || "—"}
                      </td>
                      {/* Specifications */}
                      <td
                        style={{
                          padding: "13px 18px",
                          color: "#6b7280",
                          fontSize: 12,
                          lineHeight: 1.5,
                          maxWidth: 240,
                        }}
                      >
                        {row.specs
                          ? row.specs.length > 90
                            ? row.specs.slice(0, 90) + "…"
                            : row.specs
                          : "—"}
                      </td>
                      {/* Action button */}
                      <td
                        style={{
                          padding: "13px 18px",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <PageLink
                          page="products"
                          params={{ productId: row.productId }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "7px 16px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "var(--brand-primary)",
                            color: "var(--brand-primary-ink)",
                            border: "none",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--brand-primary-hover)";
                            const a =
                              e.currentTarget.querySelector(".ipc-btn-arrow");
                            if (a) a.style.transform = "translateX(4px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "var(--brand-primary)";
                            const a =
                              e.currentTarget.querySelector(".ipc-btn-arrow");
                            if (a) a.style.transform = "translateX(0)";
                          }}
                        >
                          View Product{" "}
                          <span
                            className="ipc-btn-arrow"
                            style={{
                              display: "inline-block",
                              transition: "transform 0.2s ease",
                            }}
                          >
                            →
                          </span>
                        </PageLink>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            textAlign: "right",
            fontSize: 11,
            color: "#4b5563",
          }}
        >
          Showing {filtered.length} of {tableRows.length} products
          {search ? ` · filtered by "${search}"` : ""}
        </div>
      </div>
    </div>
  );
}

/**
 * 3.1 — INDUSTRIES / APPLICATIONS PAGE
 * Five industry verticals with IPC-specific use cases, named product families, and RFQ CTA.
 */
// M-2 fix: IndustriesPage SVG icons at module level
const IndIcons = {
  automotive: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  aerospace: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  medical: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  industrial: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  marine: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17l9-9 9 9" />
      <path d="M3 17h18" />
      <path d="M12 3v5" />
    </svg>
  ),
};

// Industries page detail — module scope so the content system can supply /
// override it (edited in the admin under "Page Content" → Industries Page).
// This array is the seed/fallback used when content.json is missing the section.
const INDUSTRY_DETAIL = [
    {
      iconKey: "automotive",
      name: "Automotive",
      subhead: "PPAP & IMDS documentation available",
      color: "var(--brand-primary-text)",
      useCases: [
        "Wire harness insulation and strain relief",
        "Under-hood connector sealing with adhesive-lined tubing",
        "Diesel-resistant jacketing for fuel system wiring",
        "Slit guard conduit for cable bundle protection",
      ],
      products: [
        { sku: "IP33PO", label: "General Polyolefin Heat Shrink 2:1" },
        {
          sku: "IP44A2 & IP45A3",
          label: "Adhesive-Lined Polyolefin 2:1 & 3:1",
        },
        { sku: "IP56DR", label: "Diesel-Resistant Heat Shrink" },
        { sku: "IP71NS - IP72PS - IP73PP", label: "Slit Guard Conduit Tubing" },
      ],
      certs: ["UL 224 VW-1", "MIL-SPEC", "RoHS", "Ford LP Approved Variants"],
    },
    {
      iconKey: "aerospace",
      name: "Aerospace & Defense",
      subhead: "MIL-SPEC, AMS, QPL products in stock",
      color: "var(--brand-primary-text)",
      useCases: [
        "MIL-SPEC heat shrink over avionics wiring and connectors",
        "PVDF and FEP tubing for high-temperature compartments",
        "PTFE spaghetti tubing for tight-tolerance wire ID",
        "Neoprene jacketing for fluid and abrasion resistance",
      ],
      products: [
        { sku: "IP35KY", label: "PVDF/Kynar Heat Shrink" },
        { sku: "IP38FE", label: "FEP Teflon Heat Shrink" },
        {
          sku: "IP37SH - IP36TH - IP39LH",
          label: "PTFE/TFE Heat Shrink Tubing",
        },
        { sku: "IP41NE / IP43VT", label: "Neoprene / Viton Heat Shrink" },
      ],
      certs: [
        "MIL-I-23053 (multiple classes)",
        "AMS-3632C / AMS-3653B",
        "M23053/8 QPL Available",
      ],
    },
    {
      iconKey: "medical",
      name: "Medical Devices",
      subhead: "USP Class VI · ISO 10993-5 · FDA 21 CFR",
      color: "var(--brand-primary-text)",
      useCases: [
        "Catheter and surgical instrument handle jacketing",
        "Endoscope component covering with biocompatible tubing",
        "Cleanroom-bagged, alcohol-wiped, double-packaged stock",
        "FDA-grade vinyl tubing for low-pressure fluid transfer",
      ],
      products: [
        { sku: "IP53MP", label: "Medical Grade Heat Shrink (USP Class VI)" },
        { sku: "IP15PV", label: "FDA Vinyl Tubing" },
      ],
      certs: [
        "USP Class VI",
        "ISO 10993-5",
        "FDA Title 21 CFR",
        "USFDA Compliant",
      ],
    },
    {
      iconKey: "industrial",
      name: "Industrial & OEM",
      subhead: "Motor leads, transformers, heating elements",
      color: "var(--brand-primary-text)",
      useCases: [
        "Fiberglass sleeving for motor lead and winding insulation",
        "High-temperature coating options: vinyl, acrylic, silicone",
        "Heat shrink end caps for pipe and conduit sealing",
        "Expandable polyester sleeving for irregular cable bundles",
      ],
      products: [
        {
          sku: "IP64FS-IP65VC-IP66AC-IP67SC",
          label:
            "Fiberglass Sleeving (Heat Treated, Vinyl, Acrylic, Silicone Coated)",
        },
        { sku: "IP52EC", label: "Heat Shrink End Caps" },
        { sku: "IP61ES & IP62EF", label: "Expandable Polyester Sleeving" },
        { sku: "IP63ES", label: "Roundit 2000 Self-Wrapping Sleeving" },
      ],
      certs: ["UL Recognized", "MIL-I-3190", "ASTM D-372", "NEMA VS-1"],
    },
    {
      iconKey: "marine",
      name: "Marine & Outdoor",
      subhead: "UV rated · Waterproof sealing · Corrosion resistant",
      color: "var(--brand-primary-text)",
      useCases: [
        "Dual-wall adhesive-lined tubing for watertight connector seals",
        "UV-resistant PVC heat shrink for exposed wiring",
        "Nonmetallic liquid-tight conduit and fittings",
        "PTFE and fluoropolymer tubing for chemical/saltwater resistance",
      ],
      products: [
        {
          sku: "IP44A2 & IP45A3",
          label: "Adhesive-Lined Polyolefin 2:1 & 3:1",
        },
        { sku: "IP30UV", label: "UV-Resistant PVC Heat Shrink" },
        { sku: "CT", label: "Nonmetallic Liquid-Tight Conduit Tubing" },
        { sku: "IP55FL", label: "Fluoropolymer Heat Shrink" },
      ],
      certs: ["UL & CUL Listed (Conduit system)", "UV Rated Material"],
    },
];

/**
 * C30 — the anchor id for one industry section.
 *
 * Built from `iconKey`, NOT from the title. The title is owner-editable prose:
 * rename "Medical Devices" to "Medical & Life Sciences" in Page Content and
 * every link pointing at it would break silently, which is the trap PLAN-5's
 * 4.27 records. `iconKey` is a short stable key chosen from a fixed set, so it
 * survives a rename.
 */
const industryAnchor = (ind, i) =>
  `industry-${String((ind && ind.iconKey) || i).replace(/[^a-z0-9-]/gi, "").toLowerCase()}`;

function IndustriesPage() {
  const c = useContent().copy.industriesHeader;
  const industries = useContent().industryDetail;

  // C30 — a cold load of /industries#medical. The browser tried to resolve
  // that fragment before this component existed and gave up; nothing else was
  // ever going to scroll. Runs once the sections are in the DOM.
  useEffect(() => {
    const id = (window.location.hash || "").replace(/^#/, "");
    if (id) scrollToAnchor(id);
  }, []);

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <PageEyebrow>
            {c.eyebrow}
          </PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            {c.title}
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            {c.intro}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-14 space-y-10">
        {industries.map((ind, i) => (
          <div
            key={`${i}-${ind.name}`}
            // C30 — the deep-link target. /industries had zero ids in its
            // content, so all six homepage market cards dropped the visitor at
            // the top of a 3,479px page with their industry somewhere below.
            id={industryAnchor(ind, i)}
            className="bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            style={{
              // scroll-margin, or the sticky navbar covers the heading the
              // fragment just scrolled to. This was a SECOND `style` prop when
              // C30 shipped; JSX keeps the last one, so esbuild warned
              // ("Duplicate \"style\" attribute") and the offset was silently
              // dropped. Merged into the one object that survives.
              scrollMarginTop: 84,
              border: "1px solid #e5e9ee",
              boxShadow: "0 2px 12px rgba(var(--brand-primary-rgb),0.06)",
            }}
          >
            {/* Industry header */}
            <div
              className="px-5 py-4 md:px-8 md:py-5 flex items-center gap-4"
              style={{
                background: "linear-gradient(135deg, #003d7a, var(--brand-primary))",
                borderBottom: "none",
              }}
            >
              <div
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: "rgba(var(--brand-primary-rgb),0.5)",
                  color: "var(--brand-accent)",
                  border: "1px solid rgba(0,190,242,0.3)",
                }}
              >
                {IndIcons[ind.iconKey] || IndIcons.industrial}
              </div>
              <div>
                {/* Stays white: this strip's gradient starts at a HARDCODED
                    #003d7a and only its far end is owner-controlled, so no
                    single ink works across both. The heading is left-aligned,
                    i.e. over the fixed dark end, where white is correct.
                    Recorded as brand-gradient-mixed-ends. */}
                <h2 className="text-xl font-extrabold text-white">
                  {ind.name}
                </h2>
                <p
                  className="text-xs font-semibold mt-0.5"
                  style={{ color: "var(--brand-accent)" }}
                >
                  {ind.subhead}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
              {/* Use cases */}
              <div className="p-7 border-b border-gray-200 lg:border-b-0 lg:border-r lg:border-gray-200">
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: "var(--brand-primary-text)" }}
                >
                  Common Applications
                </div>
                <ul className="space-y-2.5">
                  {(ind.useCases || []).map((uc, i) => (
                    <li
                      key={`${i}-${uc}`}
                      className="flex items-start gap-2.5 text-sm"
                      style={{ color: "#4b5563" }}
                    >
                      <span
                        style={{
                          // Bright accent as ink on WHITE is 2.18:1.
                          // --brand-accent-text is the darkened-for-text variant
                          // and measures 5.26:1 on the same surface. The bright
                          // accent is untouched everywhere it is a background or
                          // a border — this is a call-site fix, not a repalette.
                          // `brand-color-as-foreground` missed every one of
                          // these because it scanned for --brand-primary and
                          // --brand-accent-2 and these say --brand-accent.
                          color: "var(--brand-accent-text)",
                          marginTop: 2,
                          flexShrink: 0,
                        }}
                      >
                        →
                      </span>
                      {uc}
                    </li>
                  ))}
                </ul>
              </div>

              {/* IPC products — each is a clickable link to the product detail page */}
              <div className="p-7 border-b border-gray-200 lg:border-b-0 lg:border-r lg:border-gray-200">
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: "var(--brand-primary-text)" }}
                >
                  IPC Products
                </div>
                <ul className="space-y-2">
                  {(ind.products || []).map((prod, i) => (
                    <li key={`${i}-${prod.sku}`}>
                      <PageLink
                        page="products"
                        params={{ productId: prod.sku }}
                        className="flex items-start gap-2.5 w-full text-left group"
                        style={{
                          background: "none",
                          border: "none",
                          borderBottom: "1px solid rgba(0,0,0,0.04)",
                          cursor: "pointer",
                          padding: "10px 0",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--brand-accent-text)",
                            marginTop: 3,
                            flexShrink: 0,
                            fontSize: 8,
                          }}
                        >
                          ◆
                        </span>
                        <span
                          style={{ display: "flex", flexDirection: "column" }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--brand-primary-text)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {prod.sku}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "#4b5563",
                              lineHeight: 1.4,
                              marginTop: 1,
                            }}
                          >
                            {prod.label}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              // On white — see the note on the → bullets above.
                              color: "var(--brand-accent-text)",
                              marginTop: 1,
                              fontWeight: 600,
                            }}
                          >
                            View product →
                          </span>
                        </span>
                      </PageLink>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Certifications + CTA */}
              <div className="p-7 flex flex-col justify-between">
                <div>
                  <div
                    className="text-xs font-bold uppercase tracking-widest mb-4"
                    style={{ color: "var(--brand-primary-text)" }}
                  >
                    Certifications
                  </div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {(ind.certs || []).map((cert, i) => (
                      <span
                        key={`${i}-${cert}`}
                        className="text-xs font-semibold px-2.5 py-1 rounded"
                        style={{
                          background: "rgba(var(--brand-primary-rgb),0.08)",
                          color: "var(--brand-primary-text)",
                        }}
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {/* C31 — the quote link carries which industry it came from.
                      All six cards pointed at a bare /contact, so a buyer who
                      clicked from Medical Devices arrived at a blank form and
                      had to retype the context they had just expressed. The
                      product page already proves the pattern works with
                      ?part=IP33PO (PLAN-1 4.6); this is the same trick.
                      The catalog link beside it is NOT scoped, and that half of
                      C31 is not done: /dashboard filters by `family`, and this
                      data has no industry-to-family mapping — the industries
                      carry individual SKUs. Inventing one here would be a
                      second hardcoded list of exactly the kind PLAN-6 item 1
                      spent a plan removing. Noted in the handback. */}
                  <PageLink
                    page="contact"
                    params={{ industry: ind.name }}
                    className="w-full py-2.5 rounded text-sm font-semibold transition-all hover:brightness-110"
                    style={{
                      display: "block",
                      textAlign: "center",
                      background: "var(--brand-primary)",
                      color: "var(--brand-primary-ink)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Request a Quote →
                  </PageLink>
                  <PageLink
                    page="products"
                    className="w-full py-2.5 rounded text-sm font-medium transition-all"
                    style={{
                      display: "block",
                      textAlign: "center",
                      background: "transparent",
                      color: "var(--brand-primary-text)",
                      border: "1px solid var(--brand-primary)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(var(--brand-primary-rgb),0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Browse All Products
                  </PageLink>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* PPAP / IMDS note */}
        <div
          className="rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ background: "var(--brand-dark)" }}
        >
          <div>
            <div className="text-sm font-bold ipc-ink-dark mb-1">
              PPAP &amp; IMDS Documentation Available
            </div>
            {/* 0.55 was the original de-emphasis and it measured 3.95:1 against
                a pale --brand-dark — correct ink, but the opacity diluted it
                under AA. 0.75 keeps the sub-line visibly secondary and clears
                4.5:1 at both ends of the palette. (brand-ink-translucent) */}
            <p className="text-xs" style={{ color: "rgba(var(--brand-dark-ink-rgb), 0.75)" }}>
              IPC can support automotive supplier requirements for PPAP packages
              and IMDS material data submissions. Contact our sales team for
              details.
            </p>
          </div>
          <PageLink
            page="contact"
            className="flex-shrink-0 text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
            style={{
              display: "inline-block",
              background: "var(--brand-primary)",
              color: "var(--brand-primary-ink)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Contact Sales
          </PageLink>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable Badge component — semantic label chip used across the app.
 * variant: "primary" (blue, default) | "success" (green) | "neutral" (gray)
 * Currently used: ServicesPage lead-time chips (primary).
 * Available for: admin panel status indicators, compliance labels, form feedback.
 */
function Badge({ children, variant = "primary" }) {
  const styles = {
    primary: { background: "rgba(var(--brand-primary-rgb),0.09)", color: "var(--brand-primary-text)" },
    success: { background: "rgba(22,101,52,0.09)", color: "#166534" },
    neutral: { background: "rgba(107,114,128,0.10)", color: "#6b7280" },
  };
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded"
      style={styles[variant] ?? styles.primary}
    >
      {children}
    </span>
  );
}

/**
 * 3.2 — VALUE-ADDED SERVICES PAGE
 * Fabrication capabilities with lead times, specs, and RFQ CTA.
 */
// Fix 5: ServicesPage data now at module level alongside SvcIcons
// M-3 fix: ServicesPage SVG icons at module level
const SvcIcons = {
  cut: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  spool: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
    </svg>
  ),
  mark: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  kit: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  barcode: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5v14" />
      <path d="M8 5v14" />
      <path d="M12 5v14" />
      <path d="M17 5v14" />
      <path d="M21 5v14" />
    </svg>
  ),
  slit: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
};

// Value-Added Services (fabrication) cards, at module scope so the content
// system can supply/override them (rendered by ServicesPage via SvcIcons).
const SERVICES_DATA = [
    {
      iconKey: "cut",
      title: "Cut-to-Length",
      desc: "Precision cutting of heat shrink tubing, sleeving, and extruded tubing to any customer-specified length. Both small and large volumes accommodated.",
      details: [
        "Tight length tolerances maintained",
        "Clean room environment",
        "Individual or bulk packaging",
        "All tubing and sleeving types supported",
      ],
      leadTime: "≤ 1 week",
    },
    {
      iconKey: "spool",
      title: "Spooling & Coiling",
      desc: "Tubing and sleeving supplied on customer-specified spools or coils for automated assembly and machine-fed applications.",
      details: [
        "Custom spool sizes and footage",
        "Cardboard, plastic, or wood cores",
        "Individual labels per spool",
        "All extruded products available",
      ],
      leadTime: "≤ 1 week",
    },
    {
      iconKey: "mark",
      title: "Hot-Stamp Marking",
      desc: "Custom hot-stamp marking directly on heat shrink tubing and sleeving for cable ID, part number, logo, and sequential numbering.",
      details: [
        "Part numbers, logos, sequential IDs",
        "Permanent, abrasion-resistant marking",
        "Single or multi-line text",
        "Works on most tubing materials",
      ],
      leadTime: "≤ 1 week",
      brochure: {
        url: "/pdfs/marketing/Identification-Markers.pdf",
        label: "Identification Markers brochure",
      },
    },
    {
      iconKey: "kit",
      title: "Kitting & Bagging",
      desc: "Custom kitting and individual bagging of cut pieces or sets per customer specification. JIT delivery programs available to reduce your inventory burden.",
      details: [
        "Individual poly bag with label",
        "Kit assemblies (multiple items per bag)",
        "Branded or private-label packaging",
        "JIT pull-system programs",
      ],
      leadTime: "≤ 1 week (JIT by agreement)",
      brochure: {
        url: "/pdfs/marketing/Tubing-Kits.pdf",
        label: "Tubing Kits brochure",
      },
    },
    {
      iconKey: "barcode",
      title: "Bar Code Printing",
      desc: "Bar code labels and printed identification affixed to individual pieces, coils, or spools. 1D and 2D formats including UPC, Code 128, and QR.",
      details: [
        "1D: Code 128, Code 39, ITF",
        "2D: QR Code, Data Matrix",
        "Label on product or packaging",
        "Customer-supplied or IPC-generated data",
      ],
      leadTime: "≤ 1 week",
    },
    {
      iconKey: "slit",
      title: "Slit & Perforation",
      desc: "Tubing and tape slit lengthwise for wrap-around applications, or perforated vertically and/or horizontally for easy separation and dispensing.",
      details: [
        "Lengthwise slit for wrap-around use",
        "Horizontal perforations (e.g. tear-off lengths)",
        "Vertical perforations (e.g. marker separation)",
        "Available on most film and tape products",
      ],
      leadTime: "≤ 1 week",
    },
];

function ServicesPage() {
  const { services, copy } = useContent();
  const c = copy.servicesHeader;
  // Summarise the (previously dead) per-service leadTime values. Falls back to
  // the old hardcoded string only when nothing is set. (DEPLOY_READINESS_v2 4.11)
  /**
   * B21 \u2014 a headline, and separately a note about the exceptions.
   *
   * This used to de-duplicate the values and join whatever survived with
   * " \u00b7 ", which produced "Standard Lead Time: \u2264 1 week \u00b7 \u2264 1 week (JIT by
   * agreement)" \u2014 five services say the first and Kitting & Bagging says the
   * second, both survive dedup, and the banner reads like a rendering bug.
   *
   * The owner's strings are NOT normalised to fix this. He is entitled to
   * write a qualifier, and rewriting "\u2264 1 week (JIT by agreement)" into
   * "\u2264 1 week" would delete the very information he added.
   *
   * So: the majority value is the headline, and anything else is counted in a
   * note pointing at the per-service cards, which carry their own lead times
   * anyway. With no majority there is nothing honest to headline, so it says
   * so. Driven from three scratch content files in plan8-chrome.js \u2014 all six
   * identical, five plus one qualified, and six all different \u2014 because the
   * shipped data only exercises one of them.
   */
  const leadTimeSummary = useMemo(() => {
    const vals = (services || []).map((s) => (s.leadTime || "").trim()).filter(Boolean);
    if (vals.length === 0) return { headline: "\u2264 1 Week", note: "" };

    const counts = new Map();
    for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const [top, topCount] = ranked[0];

    if (ranked.length === 1) return { headline: top, note: "" };

    if (topCount > vals.length / 2) {
      const others = vals.length - topCount;
      return {
        headline: top,
        note: `${others} service${others === 1 ? "" : "s"} differ${others === 1 ? "s" : ""} \u2014 see below`,
      };
    }
    return { headline: "Varies by service", note: "Each service lists its own lead time below" };
  }, [services]);

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <PageEyebrow>
            {c.eyebrow}
          </PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            {c.title}
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            {c.intro}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-14">
        {/* Lead time callout banner */}
        <div
          className="rounded-xl p-5 mb-10 flex flex-wrap items-center justify-between gap-4"
          style={{
            background: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent-2))",
            boxShadow: "0 4px 16px rgba(var(--brand-primary-rgb),0.20)",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div className="text-base font-extrabold ipc-ink-header">
                {/* Was hardcoded "≤ 1 Week" while content.json's services[].leadTime
                    was editable and rendered nowhere. (DEPLOY_READINESS_v2 4.11)
                    B21: the headline is one value now, never a joined list. */}
                Standard Lead Time: {leadTimeSummary.headline}
              </div>
              <div
                className="text-xs font-medium mt-0.5"
                style={{ color: "rgba(var(--brand-dark-ink-rgb), 0.75)" }}
              >
                {/* B21 — the exception belongs here, beside the pointer to the
                    cards, not spliced into the headline with a middot. */}
                {leadTimeSummary.note ? `${leadTimeSummary.note}. ` : ""}
                All fabrication services listed below. Rush service available —
                contact sales for details.
              </div>
            </div>
          </div>
          <PageLink
            page="contact"
            className="flex-shrink-0 text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
            style={{
              display: "inline-block",
              background: "#ffffff",
              color: "var(--brand-primary-text)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Request a Quote →
          </PageLink>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {services.map((svc, i) => (
            <div
              key={`${i}-${svc.title}`}
              className="bg-white rounded-2xl overflow-hidden flex flex-col"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 1px 4px rgba(var(--brand-primary-rgb),0.05)",
              }}
            >
              {/* Service header */}
              <div
                className="px-6 py-5"
                style={{ borderBottom: "2px solid var(--brand-primary)" }}
              >
                <div
                  className="flex items-center justify-center rounded-lg mb-3"
                  style={{
                    width: 42,
                    height: 42,
                    background: "rgba(var(--brand-primary-rgb),0.08)",
                    color: "var(--brand-primary-text)",
                    border: "1px solid rgba(var(--brand-primary-rgb),0.15)",
                  }}
                >
                  {SvcIcons[svc.iconKey]}
                </div>
                {/* B28 — h2, not h3. /services was the only page on the site
                    with a skipped heading level: h1 straight to h3, no h2. The
                    class is unchanged on purpose — the visual size is CSS's
                    job and the level is the document's. */}
                <h2 className="text-lg font-bold" style={{ color: "#141414" }}>
                  {svc.title}
                </h2>
                <p
                  className="text-sm mt-1 leading-relaxed"
                  style={{ color: "#4b5563" }}
                >
                  {svc.desc}
                </p>
              </div>

              {/* Details */}
              <div className="px-6 py-5 flex-1">
                <ul className="space-y-2">
                  {(svc.details || []).map((d, i) => (
                    <li
                      key={`${i}-${d}`}
                      className="flex items-start gap-2 text-xs"
                      style={{ color: "#4b5563" }}
                    >
                      <span
                        style={{
                          // On white — see the note on the → bullets in the
                          // Industries detail panel.
                          color: "var(--brand-accent-text)",
                          marginTop: 1,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card footer strip — always rendered to preserve card silhouette.
                  Contains the brochure download link when one exists, otherwise
                  remains empty (just a visual cap on the card).               */}
              {svc.brochure ? (
                <a
                  href={svc.brochure.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 flex items-center gap-2 text-xs font-semibold transition-colors duration-150"
                  style={{
                    color: "var(--brand-primary-text)",
                    borderTop: "1px solid #e5e9ee",
                    background: "#f8fafc",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#eaf3fa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 18 15 15" />
                  </svg>
                  Download {svc.brochure.label} ↗
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
              {/* C44 — no empty band. This used to render a grey capped strip
                  with nothing in it whenever a service had no brochure, to
                  "preserve the card silhouette". Next to Hot-Stamp Marking,
                  which has a link in exactly that position, Cut-to-Length read
                  as a link that had failed to load. An empty section renders
                  nothing rather than chrome around nothing — the same shape as
                  PLAN-5's 4.29. */}
            </div>
          ))}
        </div>

        {/* Capabilities footer strip */}
        <div className="rounded-2xl p-8" style={{ background: "var(--brand-dark)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              {/* B28 — h2. Same skipped-level fix as the service cards above;
                  this closing panel is a sibling section, not a subsection of
                  one. */}
              <h2 className="text-xl font-extrabold ipc-ink-dark mb-3">
                Need something not listed?
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(var(--brand-dark-ink-rgb), 0.60)" }}
              >
                Our engineering team can create custom solutions. Whether it's a
                unique marking specification, a non-standard cut tolerance, or a
                JIT kitting program — contact our sales team and we'll design a
                solution for your requirements.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <PageLink
                page="contact"
                className="w-full py-3 rounded text-sm font-semibold hover:brightness-110 transition-all"
                style={{
                  display: "block",
                  textAlign: "center",
                  background: "var(--brand-primary)",
                  color: "var(--brand-primary-ink)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Contact Sales →
              </PageLink>
              <PageLink
                page="products"
                className="w-full py-3 rounded text-sm font-medium transition-colors duration-150 hover:text-white hover:border-white/50"
                style={{
                  display: "block",
                  textAlign: "center",
                  background: "transparent",
                  color: "rgba(var(--brand-dark-ink-rgb), 0.7)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                }}
              >
                Browse All Products
              </PageLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 3.3 — PRIVACY POLICY PAGE
 * GDPR/CCPA-appropriate B2B privacy policy for contact form data collection.
 */
const PRIVACY_SECTIONS = [
    {
      title: "Information We Collect",
      content:
        "When you use the contact or quote request form on this website, we collect the information you provide: your name, company name, email address, phone number (optional), and message content. We do not collect payment information through this website.",
    },
    {
      title: "How We Use Your Information",
      content:
        "The information you submit through our contact form is used solely to respond to your inquiry or quote request. We will contact you using the email address or phone number you provide. We do not sell, rent, or share your personal information with third parties for marketing purposes.",
    },
    {
      title: "Data Retention",
      content:
        "Inquiry data is retained for the duration necessary to fulfill your request and for a reasonable period thereafter for business record-keeping purposes, not to exceed three (3) years unless required by applicable law.",
    },
    {
      title: "Cookies & Tracking",
      content:
        "This website does not use third-party advertising cookies or behavioral tracking technologies. Basic session and functional cookies may be used to maintain your browsing session. We do not use Google Analytics or similar tracking tools that share your data with third parties.",
    },
    {
      title: "Your Rights (GDPR / CCPA)",
      content:
        "Depending on your location, you may have the right to access, correct, or delete personal information we hold about you, and to object to or restrict processing of that information. To exercise any of these rights, please contact us at sales@insulationproducts.com or call 630.771.0700.",
    },
    {
      title: "Data Security",
      content:
        "We take reasonable technical and organizational measures to protect the personal information you share with us against unauthorized access, loss, or misuse. Our website is served over HTTPS.",
    },
    {
      title: "Contact Us",
      content:
        "If you have questions about this Privacy Policy or how your data is handled, contact Insulation Products Corporation at: 250 Gibraltar Dr, Bolingbrook, IL 60440 · Phone: 630.771.0700 · Email: sales@insulationproducts.com",
    },
];

function PrivacyPage() {
  const site = useSiteInfo();
  const { privacySections, copy } = useContent();
  const sections = privacySections;
  const c = copy.privacyHeader;

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <PageEyebrow>
            {c.eyebrow}
          </PageEyebrow>
          <h1 className="text-4xl font-extrabold" style={{ color: "var(--brand-header-ink)" }}>
            {c.title}
          </h1>
          <p
            className="mt-3 text-base"
            style={{ color: "rgba(var(--brand-header-ink-rgb), 0.65)" }}
          >
            {/* Was new Date() — the policy claimed to have been updated today,
                 every day, regardless of whether a word had changed. A privacy
                 policy that lies about its own revision date is the one place
                 that matters. It now shows the editable effective date only.
                 (DEPLOY_READINESS_v2 4.10) */}
            Effective Date: {c.effectiveDate}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        <div
          className="bg-white rounded-2xl p-8 space-y-8"
          style={{
            border: "1px solid #e5e9ee",
            boxShadow: "0 2px 12px rgba(var(--brand-primary-rgb),0.06)",
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
            {localizeProse(c.intro, site)}
          </p>
          {sections.map((sec, i) => (
            <div key={`${i}-${sec.title}`}>
              {i > 0 && (
                <div
                  style={{
                    height: 1,
                    background: "#e5e9ee",
                    marginBottom: 32,
                    marginTop: -8,
                  }}
                />
              )}
              <div
                className="flex items-center gap-3 mb-3"
                role="heading"
                aria-level={2}
              >
                <div
                  style={{
                    width: 3,
                    height: 20,
                    borderRadius: 2,
                    background: "var(--brand-primary)",
                    flexShrink: 0,
                  }}
                />
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#141414",
                    margin: 0,
                  }}
                >
                  {i + 1}. {sec.title}
                </h2>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#4b5563" }}
              >
                {localizeProse(sec.content, site)}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-center" style={{ color: "#4b5563" }}>
          © {site.company.foundedYear}–{new Date().getFullYear()} {site.company.name} ·
          {site.address.street}, {site.address.city}, {site.address.state} {site.address.zip}
        </p>
      </div>
    </div>
  );
}

/**
 * IPC Footer — SVG logo mark + SVG contact icons + verified contact data.
 */
/**
 * 4.11b — the footer social icons v2 4.11 promised and nobody built.
 *
 * `site.social.*` fed the JSON-LD `sameAs` array and nothing else, so five
 * fields Rick can edit in Business Details had no visible effect on the site at
 * all.
 *
 * All five are in SITE_CLEARABLE (invariant 4 / NB4): he is explicitly allowed
 * to empty them, and Editing-Your-Site-Content.md promises a cleared field
 * "disappears from the site properly". So an empty value renders no link, and
 * ALL FIVE empty renders no container — the whole element is absent, not
 * present-and-empty. A leftover row would be a visible gap in the footer and
 * would make that promise false.
 *
 * Deliberately has no heading. A heading would be owner-facing copy, and every
 * other footer heading comes from a `copy` key that must exist on BOTH sides of
 * the content contract — adding one means a new field in admin/content.php,
 * which moves the form's posted-variable count away from the 421 the
 * max_input_vars sentinel is asserted against. Not worth it for one word.
 *
 * Icon glyphs are inline SVG paths. No icon font, no CDN: the admin CSP and
 * the $0-budget rule both rule those out.
 */
const SOCIAL_CHANNELS = [
  {
    key: "twitter",
    label: "X (formerly Twitter)",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    key: "facebook",
    label: "Facebook",
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    key: "youtube",
    label: "YouTube",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    path: "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z",
  },
  {
    key: "instagram",
    label: "Instagram",
    path: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z",
  },
  {
    key: "tiktok",
    label: "TikTok",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
];

function FooterSocial({ social }) {
  const live = SOCIAL_CHANNELS.filter((c) => {
    const url = social && social[c.key];
    return typeof url === "string" && url.trim() !== "";
  });
  // No container at all when every field is empty — not an empty container.
  if (!live.length) return null;
  return (
    <div
      data-testid="footer-social"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}
    >
      {live.map((c) => (
        <a
          key={c.key}
          href={social[c.key].trim()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${c.label} (opens in a new window)`}
          className="ipc-social-link"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <path d={c.path} />
          </svg>
        </a>
      ))}
    </div>
  );
}

function Footer() {
  const site = useSiteInfo();
  const { footerLinks, copy } = useContent();
  const fc = copy.footer;
  // Reusable tiny SVG icons for contact items
  const PhoneIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.54 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
  const FaxIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <polyline points="22 17 17 17 17 22" />
      <polyline points="2 7 7 7 7 2" />
      <path d="M2 17l5 5L22 7" />
      <line x1="7" y1="7" x2="7" y2="17" />
      <line x1="17" y1="7" x2="17" y2="17" />
    </svg>
  );
  const PdfIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 18 15 15" />
    </svg>
  );
  const MailIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
  const PinIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
  const ClockIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );

  return (
    <footer style={{ background: "#0a2240", borderTop: "3px solid var(--brand-accent)" }}>
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand column — SVG logo mark */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={site.theme?.logoUrl || "/logo.svg"}
                alt=""
                // 4.32 — below the fold on every route (measured: top=2075 on
                // the shortest page, 5218 at 375), so this one IS a lazy
                // candidate. The navbar copy above is not, and keeps its
                // default eager loading.
                loading="lazy"
                width={44}
                height={44}
                style={{ flexShrink: 0, display: "block" }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    color: "#ffffff",
                    letterSpacing: "0.01em",
                  }}
                >
                  {(site.company.name || "Insulation Products Corporation").toUpperCase()}
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "var(--brand-accent-on-footer)", letterSpacing: "0.08em" }}
                >
                  {[
                    site.company.foundedYear ? `ESTABLISHED ${site.company.foundedYear}` : null,
                    site.certifications?.iso || null,
                    ...(site.certifications?.other || []),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                    .toUpperCase()}
                </div>
              </div>
            </div>
            <p
              className="text-xs leading-relaxed max-w-xs"
              style={{ color: "#94a3b8" }}
            >
              A spec-grade stocking distributor of heat-shrinkable &amp;
              extruded tubing, electrical sleeving, and industrial adhesives.
              {/* B11 — the explicit space is load-bearing. JSX collapses a
                  newline between two pieces of TEXT to a space, but strips it
                  entirely between text and an {expression}, so this rendered
                  "adhesives.$50 minimum order." on every page of the site. */}
              {" "}
              {site.stats.minimumOrder} minimum order. Quick, accurate, courteous service — the
              customer is always number one.
            </p>
            <FooterSocial social={site.social} />
          </div>

          {/* Contact column — SVG icons */}
          <div>
            <div
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "var(--brand-accent-on-footer)" }}
            >
              {fc.contactTitle}
            </div>
            <div
              className="space-y-2.5 text-xs"
              style={{ color: "#cbd5e1" }}
            >
              <div className="flex items-center gap-2">
                <PhoneIcon />
                <a href={`tel:${site.contact.phoneDial}`} style={{ color: "#cbd5e1", textDecoration: "none" }}>{site.contact.phone}</a>
              </div>
              {site.contact.fax ? (
                <div className="flex items-center gap-2">
                  <FaxIcon />
                  <span style={{ color: "#cbd5e1" }}>{site.contact.fax} (Fax)</span>
                </div>
              ) : null}
              {/* catalogPdfUrl was written by settings.php and read by NOTHING —
                  App.jsx:4416 was its only other occurrence. Meanwhile the FAQ
                  answer promises "a link to the full IPC product catalog PDF …
                  in the site footer". Either the field or the sentence had to
                  go; the field is the one Rick can fill in.
                  (AUDIT_v3_FINDINGS NB18) */}
              {site.catalogPdfUrl ? (
                <div className="flex items-center gap-2">
                  <PdfIcon />
                  <a
                    href={site.catalogPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#cbd5e1", textDecoration: "none" }}
                  >
                    Full product catalog (PDF)
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <MailIcon />
                <a href={`mailto:${site.contact.email}`} style={{ color: "#cbd5e1", textDecoration: "none" }}>{site.contact.email}</a>
              </div>
              <div className="flex items-start gap-2">
                <PinIcon />{" "}
                <span>
                  {site.address.street}
                  <br />
                  {site.address.city}, {site.address.state} {site.address.zip}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon /> {site.hours.text}
              </div>
            </div>
          </div>

          {/* Quick links — 2 columns of 4 inside, occupies 1 grid column on desktop */}
          <div>
            <div
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "var(--brand-accent-on-footer)" }}
            >
              {fc.quickLinksTitle}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px 24px",
              }}
            >
              {/* 4.27 — every owner-editable list is keyed `${index}-${value}`,
                  never on the owner's typing alone. Two footer links both
                  named "Contact" gave React two identical keys; React calls
                  that unsupported and emits a console error for each one
                  (24 of them across the nine routes, measured on a dev
                  bundle). `content.json` carries no per-row identity, so the
                  index is what makes the key unique — see the reorder note
                  in WHATS_LEFT.md §2. */}
              {footerLinks.map((link, i) => (
                <div key={`${i}-${link.label}`}>
                  <PageLink
                    page={link.page}
                    className="text-xs transition-colors duration-150 ipc-tap"
                    style={{
                      color: "#94a3b8",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "8px 0",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--brand-accent)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "#94a3b8")
                    }
                  >
                    {link.label}
                  </PageLink>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex flex-col md:flex-row items-center justify-between gap-2 pt-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            © {site.company.foundedYear}–{new Date().getFullYear()} {site.company.name}.
            All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            {fc.domain} · {site.address.city}, {site.address.state} {site.address.zip}
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Main App — fetches live product catalog from storage, routes all pages.
 * Shows a loading skeleton and error state while products-all.json is fetching.
 */
/**
 * Catalog loading / failure states.
 *
 * These used to gate the WHOLE app: SiteInfoProvider, ContentProvider, Navbar,
 * Footer and every page sat behind the products fetch, so one JSON hiccup took
 * down Contact, About, Services, Industries, FAQ and Privacy — pages that read
 * no product data at all — along with every phone number and mailto on the
 * site. For a distributor whose conversion is a phone call that turned a data
 * blip into a total revenue outage. They are now scoped to the two pages that
 * actually need the catalog. (DEPLOY_READINESS_v2 T2.1)
 */
function CatalogSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the product catalog…</span>
        {/* Skeleton Hero */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2"
          style={{
            background: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent-2))",
            padding: "60px 24px",
            gap: 48,
            maxWidth: 1280,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              className="ipc-skeleton"
              style={{
                width: "40%",
                height: 12,
                borderRadius: 4,
                opacity: 0.4,
              }}
            />
            <div
              className="ipc-skeleton"
              style={{
                width: "90%",
                height: 36,
                borderRadius: 6,
                opacity: 0.4,
              }}
            />
            <div
              className="ipc-skeleton"
              style={{
                width: "80%",
                height: 36,
                borderRadius: 6,
                opacity: 0.35,
              }}
            />
            <div
              className="ipc-skeleton"
              style={{
                width: "60%",
                height: 36,
                borderRadius: 6,
                opacity: 0.3,
              }}
            />
            <div
              className="ipc-skeleton"
              style={{
                width: "85%",
                height: 14,
                borderRadius: 4,
                opacity: 0.3,
                marginTop: 8,
              }}
            />
            <div
              className="ipc-skeleton"
              style={{
                width: "75%",
                height: 14,
                borderRadius: 4,
                opacity: 0.25,
              }}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <div
                className="ipc-skeleton"
                style={{
                  width: 140,
                  height: 44,
                  borderRadius: 8,
                  opacity: 0.4,
                }}
              />
              <div
                className="ipc-skeleton"
                style={{
                  width: 130,
                  height: 44,
                  borderRadius: 8,
                  opacity: 0.3,
                }}
              />
            </div>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="ipc-skeleton"
                style={{ height: 90, borderRadius: 12, opacity: 0.3 }}
              />
            ))}
          </div>
        </div>

        {/* Skeleton Stats */}
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e5e9ee",
            padding: "0 24px",
            maxWidth: 1280,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                padding: "28px 24px",
                display: "flex",
                gap: 16,
                alignItems: "center",
                borderRight: "none",
              }}
            >
              <div
                className="ipc-skeleton"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div
                  className="ipc-skeleton"
                  style={{ width: 48, height: 20, borderRadius: 4 }}
                />
                <div
                  className="ipc-skeleton"
                  style={{ width: 90, height: 12, borderRadius: 3 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Feature Cards */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{
            maxWidth: 1280,
            margin: "32px auto",
            padding: "0 24px",
            gap: 20,
            width: "100%",
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: "1px solid #e5e9ee",
                borderRadius: 12,
                padding: 24,
                display: "flex",
                gap: 16,
              }}
            >
              <div
                className="ipc-skeleton"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  className="ipc-skeleton"
                  style={{ width: "70%", height: 14, borderRadius: 3 }}
                />
                <div
                  className="ipc-skeleton"
                  style={{ width: "95%", height: 11, borderRadius: 3 }}
                />
                <div
                  className="ipc-skeleton"
                  style={{ width: "80%", height: 11, borderRadius: 3 }}
                />
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}

function CatalogError({ error }) {
  const site = useSiteInfo();
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "50vh" }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#141414" }}>
              Catalog Unavailable
            </h2>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-semibold px-6 py-3 rounded hover:brightness-110 transition-all"
              style={{
                background: "var(--brand-primary)",
                color: "var(--brand-primary-ink)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        </div>
      <div style={{ textAlign: "center", fontSize: 14, paddingBottom: 40 }}>
        <p style={{ color: "#6b7280", marginBottom: 8 }}>
          The rest of the site still works — or reach us directly:
        </p>
        <a href={`tel:${site.contact.phoneDial}`} style={{ color: "var(--brand-primary-text)", fontWeight: 700, marginRight: 16 }}>
          📞 {site.contact.phone}
        </a>
        <a href={`mailto:${site.contact.email}`} style={{ color: "var(--brand-primary-text)", fontWeight: 700 }}>
          📧 {site.contact.email}
        </a>
      </div>
    </div>
  );
}

function App() {
  // Register the module-level setSearchParams/setSearchParam batch ref so that
  // event-handler calls outside of components route through react-router-dom
  // and actually trigger a re-render. Without this, URL updates would be
  // invisible to React.
  useSetSearchParamRef();
  const [page] = useSearchParam("page");
  const unknownRoute = useIsUnknownRoute();
  const { products, loading, error } = useProducts();

  // ALL hooks must be called before any conditional return (React rules of hooks).
  // Scroll to top on every page navigation. (Title + meta description are handled
  // by <PageMeta>, which lives inside SiteInfoProvider so it can localize them.)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);

  // Animation 7 — Shimmer skeleton replaces the spinner.
  // Previews the actual page layout so users see an almost-real page resolving.
  // Only these two pages read the catalog. Everything else renders even when
  // products-all.json is slow or unreachable. (DEPLOY_READINESS_v2 T2.1)
  const needsCatalog =
    page === "products" || page === "dashboard" || page === "datasheets";

  const renderPage = () => {
    // A5 — an unrecognised segment is a 404, not the homepage.
    //
    // Before this, App.jsx's `default:` rendered <HomePage /> for ANY path, and
    // PageMeta built a title and a self-referencing canonical out of the
    // segment: /quality, /prodcuts and /contact-us all returned 200 with their
    // own canonical. Every typo, stale bookmark and dead inbound link became a
    // self-canonicalising duplicate of the homepage, and a visitor who mistyped
    // got no signal at all that they were in the wrong place.
    //
    // Home stays the empty segment only. See PageMeta for the noindex, and for
    // why the server still (correctly) answers 200.
    if (unknownRoute) return <NotFoundPage />;
    switch (page) {
      case "dashboard":
        return <DashboardPage products={products} />;
      case "about":
        return <AboutPage />;
      case "products":
        return <ProductPage products={products} />;
      case "industries":
        return <IndustriesPage />;
      case "services":
        return <ServicesPage />;
      case "privacy":
        return <PrivacyPage />;
      case "datasheets":
        return <DatasheetsPage products={products} />;
      case "faq":
        return <FaqPage />;
      case "contact":
        return <ContactPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <SiteInfoProvider>
      <ContentProvider>
        <ThemeInjector />
        <StructuredData />
        <PageMeta products={products} />
        <div
          className="min-h-screen flex flex-col"
          style={{ background: "#f5f7fa" }}
        >
          <GlobalStyles />
          {/* B15 — skip link, WCAG 2.4.1 Bypass Blocks (Level A).
              Tab order on every page started at the logo and walked the entire
              header — the mega-menus included — before reaching any content,
              and document.querySelector('a[href^="#"]') returned null
              site-wide.
              First in the DOM so it is the first tab stop. Visually hidden
              until focused, via .ipc-skip in GlobalStyles rather than a
              utility class, so its focused state can be styled properly. */}
          <a className="ipc-skip" href="#ipc-main">Skip to main content</a>
          <Navbar products={products} catalogFailed={Boolean(error) && !loading} />
          {/* key={page} resets the boundary on navigation. Without it, one bad
              product bricked EVERY page until the visitor thought to reload:
              nothing ever set `caught` back to false, so clicking Home
              navigated correctly and still showed "Something went wrong".
              (DEPLOY_READINESS_v2 T2.2) */}
          {/* B15 — the skip link's target.
              id so the link has somewhere to go; tabIndex={-1} because without
              it the browser scrolls to the element but leaves focus on the
              link, so the very next Tab returns to the navigation the visitor
              just asked to skip. That is the failure mode that makes skip
              links look implemented and not work. */}
          <main className="flex-1" id="ipc-main" tabIndex={-1} style={{ outline: "none" }}>
            <ErrorBoundary key={page}>
              {needsCatalog && loading ? (
                <CatalogSkeleton />
              ) : needsCatalog && error ? (
                <CatalogError error={error} />
              ) : (
                renderPage()
              )}
            </ErrorBoundary>
          </main>
          <Footer />
        </div>
      </ContentProvider>
    </SiteInfoProvider>
  );
}

export default App;
// site-info wiring: Phase 1
