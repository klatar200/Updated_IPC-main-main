import { useState, useEffect, useMemo, useRef, useCallback, Component } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";

// ── OverAI global shims ──────────────────────────────────────
// These replace OverAI's useSearchParam and setSearchParam globals.
// "page" routing now uses real URL paths (/products, /contact, etc.);
// sub-page params (productId, family, etc.) stay as search params.

function pathnameToPage(pathname) {
  const seg = pathname.replace(/^\//, "").split("/")[0];
  return seg || null; // null → home
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
  const setter = (val) => {
    setSearchParamsFn(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val === null || val === undefined || val === "") next.delete(key);
        else next.set(key, String(val));
        return next;
      },
      { replace: false },
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
    if (this.state.caught) {
      return (
        <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", background: "#f5f7fa" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#141414", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 400, marginBottom: 24 }}>
            An unexpected error occurred. Please refresh the page, or contact us directly.
          </p>
          <div style={{ fontSize: 14, color: "#005da3" }}>
            <a href="tel:+16307710700" style={{ color: "#005da3", display: "block", marginBottom: 6 }}>📞 630.771.0700</a>
            <a href="mailto:sales@insulationproducts.com" style={{ color: "#005da3" }}>📧 sales@insulationproducts.com</a>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 24, padding: "10px 24px", background: "#005da3", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
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
function Navbar({ products = [] }) {
  const [page] = useSearchParam("page");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(null);

  const currentPage = page || "home";

  const nav = (p, params = {}) => {
    // Batch all param updates (page + any extras like ?family=) into ONE
    // setSearchParams call. Doing them as separate calls would lose updates
    // because react-router v6 reads `prev` from the current URL each time.
    setSearchParams({ ...params, page: p });
    setMenuOpen(false);
    setOpenDropdown(null);
    setMobileOpen(null);
  };

  // Derive unique, sorted product categories from live catalog.
  // Uses FAMILY_ORDER (module-level) — single source of truth, cannot drift.
  const categories = useMemo(() => {
    // CR-2 fix: reuse SIDEBAR_EXCLUDED (module-level) — single source of truth
    const seen = new Set();
    for (const p of products) {
      if (!SIDEBAR_EXCLUDED.has(p.sku || "") && p.partType)
        seen.add(p.partType);
    }
    // Sort by FAMILY_ORDER first, then alphabetically for any unlisted
    const result = FAMILY_ORDER.filter((f) => seen.has(f));
    for (const f of seen) {
      if (!result.includes(f)) result.push(f);
    }
    return result;
  }, [products]);

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
        background: "#0d2d52",
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
        <button
          onClick={() => nav(null)}
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
          <img
            src="/logo.svg"
            alt="IPC logo"
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
                color: "#ffffff",
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
                color: "#ffffff",
              }}
            >
              CORPORATION
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#119ec8",
                marginTop: 1,
                letterSpacing: "0.02em",
              }}
            >
              Tubing &amp; Sleeving Solutions
            </div>
          </div>
        </button>

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
          <button
            onClick={() => nav(null)}
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
                currentPage === "home" ? "#ffffff" : "rgba(255,255,255,0.6)",
              borderBottom:
                currentPage === "home"
                  ? "2px solid #00bef2"
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
            Home
          </button>

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
                  onMouseEnter={() => setOpenDropdown("products")}
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
                    color: active || open ? "#ffffff" : "rgba(255,255,255,0.6)",
                    borderBottom: active
                      ? "2px solid #00bef2"
                      : open
                        ? "2px solid rgba(0,190,242,0.4)"
                        : "2px solid transparent",
                    transition: "color 0.15s",
                  }}
                >
                  Products
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
                        All Products
                      </div>
                      {[
                        {
                          label: "Browse All Products",
                          sub: "Full catalog with specifications",
                          p: "products",
                          params: {},
                        },
                        {
                          label: "Product Index",
                          sub: "Searchable table with filter & sort",
                          p: "dashboard",
                          params: {},
                        },
                      ].map((item) => {
                        const itemActive = currentPage === item.p;
                        return (
                          <button
                            key={item.p}
                            onClick={() => nav(item.p, item.params)}
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
                                ? "3px solid #00bef2"
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
                                color: itemActive ? "#00bef2" : "#ffffff",
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
                          </button>
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
                        Browse by Category
                      </div>
                      {categories.length === 0 ? (
                        <div
                          style={{
                            padding: "8px 20px",
                            fontSize: 12,
                            color: "rgba(255,255,255,0.3)",
                          }}
                        >
                          Loading…
                        </div>
                      ) : (
                        categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => {
                              // Navigate to dashboard with family param — DashboardPage reads it on mount
                              nav("dashboard", { family: cat });
                            }}
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
                                background: "#005da3",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "rgba(255,255,255,0.75)",
                              }}
                            >
                              {cat}
                            </span>
                          </button>
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
                  onMouseEnter={() => setOpenDropdown("company")}
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
                    color: active || open ? "#ffffff" : "rgba(255,255,255,0.6)",
                    borderBottom: active
                      ? "2px solid #00bef2"
                      : open
                        ? "2px solid rgba(0,190,242,0.4)"
                        : "2px solid transparent",
                    transition: "color 0.15s",
                  }}
                >
                  Company
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
                    {COMPANY_ITEMS.map((item) => {
                      const itemActive = currentPage === item.page;
                      return (
                        <button
                          key={item.page}
                          onClick={() => nav(item.page)}
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
                              ? "3px solid #00bef2"
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
                              color: itemActive ? "#00bef2" : "#ffffff",
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
                        </button>
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
          <button
            onClick={() => nav("contact")}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              background: "#005da3",
              border: "none",
              cursor: "pointer",
              padding: "10px 22px",
              borderRadius: 6,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#004e8c")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#005da3")}
          >
            Request a Quote
          </button>
        </div>

        {/* ── Hamburger (mobile only) ── */}
        <button
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
          role="dialog"
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
            <button
              onClick={() => nav(null)}
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
                    ? "3px solid #00bef2"
                    : "3px solid transparent",
                paddingLeft: currentPage === "home" ? 13 : 0,
              }}
            >
              Home
            </button>

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
                    ? "3px solid #00bef2"
                    : "3px solid transparent",
                  paddingLeft: 16,
                }}
              >
                <span>Products</span>
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
                    { label: "Browse All Products", p: "products", params: {} },
                    { label: "Product Index", p: "dashboard", params: {} },
                  ].map((item) => (
                    <button
                      key={item.p}
                      onClick={() => nav(item.p, item.params)}
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
                            ? "2px solid #00bef2"
                            : "2px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: currentPage === item.p ? "#00bef2" : "#ffffff",
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
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
                        <button
                          key={cat}
                          onClick={() => nav("dashboard", { family: cat })}
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
                              background: "#005da3",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "rgba(255,255,255,0.70)",
                            }}
                          >
                            {cat}
                          </span>
                        </button>
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
                    ? "#ffffff"
                    : "rgba(255,255,255,0.65)",
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
                    ? "3px solid #00bef2"
                    : "3px solid transparent",
                  paddingLeft: 16,
                }}
              >
                <span>Company</span>
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
                  {COMPANY_ITEMS.map((item) => (
                    <button
                      key={item.page}
                      onClick={() => nav(item.page)}
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
                            ? "2px solid #00bef2"
                            : "2px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            currentPage === item.page ? "#00bef2" : "#ffffff",
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.40)",
                          marginTop: 1,
                        }}
                      >
                        {item.sub}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Contact */}
            <button
              onClick={() => nav("contact")}
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
                    ? "#ffffff"
                    : "rgba(255,255,255,0.65)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                borderLeft:
                  currentPage === "contact"
                    ? "3px solid #00bef2"
                    : "3px solid transparent",
                paddingLeft: 16,
              }}
            >
              Contact
            </button>

            {/* CTA */}
            <button
              onClick={() => nav("contact")}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "13px 0",
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Request a Quote
            </button>
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
function Hero() {
  const proofPoints = [
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
  const trustItems = [
    "ISO 9001:2008 Registered",
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

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(20,20,20,0.72) 0%, rgba(20,20,20,0.50) 100%), linear-gradient(135deg, #005da3 0%, #119ec8 55%, #00bef2 100%)",
      }}
    >
      <div
        className="absolute right-0 top-0 h-full w-1/2 opacity-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 80% 40%, #00bef2 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left — value proposition */}
        <div>
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase mb-6 px-3 py-1.5 rounded"
            style={{
              background: "rgba(0,190,242,0.15)",
              color: "#00bef2",
              border: "1px solid rgba(0,190,242,0.3)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00bef2",
                display: "inline-block",
              }}
            />
            Bolingbrook, IL — Made in USA Since 1974
          </div>
          <h1
            className="font-extrabold leading-tight mb-6"
            style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", color: "#ffffff" }}
          >
            25 Million Feet in Stock.
            <br />
            <span style={{ color: "#00bef2" }}>Same-Day Shipment.</span>
            <br />
            Custom Marking &amp; Fabrication.
          </h1>
          <p
            className="text-base leading-relaxed mb-8 max-w-lg"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Insulation Products Corporation is a spec-grade stocking distributor
            of heat-shrinkable &amp; extruded tubing, electrical sleeving, and
            industrial adhesives. $50 minimum order. UL, CSA, MIL-SPEC, and RoHS
            compliant product line. Quick, accurate, courteous service since
            1974 — the customer is always number one.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSearchParam("page", "products")}
              className="text-sm font-semibold px-6 py-3 rounded transition-all duration-150 hover:brightness-110 hover:shadow-lg"
              style={{
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Browse Products →
            </button>
            <button
              onClick={() => setSearchParam("page", "contact")}
              className="text-sm font-semibold px-6 py-3 rounded transition-colors duration-150 border border-white/40 hover:border-white/80"
              style={{
                background: "transparent",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Request a Quote
            </button>
          </div>
        </div>

        {/* Right — proof cards: 2×2 grid on desktop, stacked 2×2 with tighter padding on mobile */}
        <div className="grid grid-cols-2 gap-3">
          {proofPoints.map((p) => (
            <div
              key={p.label}
              className="rounded-xl"
              style={{
                padding: "clamp(12px, 2vw, 20px)",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderLeft: "3px solid #00bef2",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="font-extrabold leading-none mb-1"
                style={{
                  fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                  color: "#00bef2",
                }}
              >
                {p.stat}
              </div>
              <div
                className="font-semibold"
                style={{
                  fontSize: "clamp(11px, 1.5vw, 14px)",
                  color: "#ffffff",
                  marginBottom: 2,
                }}
              >
                {p.label}
              </div>
              <div
                style={{
                  fontSize: "clamp(10px, 1.2vw, 12px)",
                  color: "rgba(255,255,255,0.5)",
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

          {/* Marquee track — items duplicated to create seamless loop */}
          <div className="ipc-marquee-track" tabIndex={0} style={{ padding: "14px 0" }}>
            {[...trustItems, ...trustItems].map((item, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1.5 flex-shrink-0"
                style={{
                  color: "rgba(255,255,255,0.60)",
                  fontSize: 12,
                  fontWeight: 500,
                  paddingRight: 48,
                }}
              >
                <span style={{ color: "#00bef2", fontSize: 14, flexShrink: 0 }}>
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
function FeatureCard({ icon, title, description, onClick }) {
  return (
    <div
      className="flex gap-5 p-6 rounded-xl cursor-pointer transition-all duration-200"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e9ee",
        boxShadow: "0 1px 4px rgba(0,93,163,0.05)",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#005da3";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,93,163,0.12)";
        e.currentTarget.style.transform = "translateY(-2px)";
        const iconEl = e.currentTarget.querySelector(".fc-icon");
        if (iconEl) {
          iconEl.style.background = "rgba(0,93,163,0.12)";
          iconEl.style.borderColor = "#005da3";
        }
        const titleEl = e.currentTarget.querySelector(".fc-title");
        if (titleEl) titleEl.style.color = "#004e8c";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e9ee";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,93,163,0.05)";
        e.currentTarget.style.transform = "";
        const iconEl = e.currentTarget.querySelector(".fc-icon");
        if (iconEl) {
          iconEl.style.background = "rgba(0,93,163,0.07)";
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
          background: "rgba(0,93,163,0.07)",
          color: "#005da3",
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
    </div>
  );
}

/**
 * Reusable section header — consistent eyebrow + h2 + optional subtitle across all pages.
 * eyebrow: small all-caps label in #005da3
 * title: bold h2 in #141414
 * subtitle: optional muted paragraph
 * action: optional { label, onClick } for a right-aligned CTA button
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
              color: "#005da3",
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
        <button
          onClick={action.onClick}
          className="transition-colors duration-150 hover:bg-blue-700"
          style={{
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            background: "#005da3",
            border: "none",
            cursor: "pointer",
            padding: "10px 20px",
            borderRadius: 6,
          }}
        >
          {action.label}
        </button>
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
      "ISO 9001:2008 registered facility. Computerized equipment, documented processes, quality maintained from receiving through shipping.",
  },
];

/**
 * IPC Products & Services section — SVG icons at module level, two-column grid, CTA ribbon.
 */
function Features() {
  return (
    <section className="py-20 px-6" style={{ background: "#f5f7fa" }}>
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Products & Services"
          title="A Complete Insulation Supply Source"
          action={{
            label: "View Full Catalog →",
            onClick: () => setSearchParam("page", "products"),
          }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES_DATA.map((f) => (
            <FeatureCard
              key={f.title}
              icon={
                <div style={{ color: "#005da3" }}>
                  {FEATURES_ICONS[f.iconKey]}
                </div>
              }
              title={f.title}
              description={f.description}
              onClick={() => setSearchParam("page", "products")}
            />
          ))}
        </div>
        <div
          className="mt-12 rounded-xl px-8 py-6 flex flex-wrap gap-6 items-center justify-between"
          style={{ background: "#0d2d52" }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            Need a custom specification or hard-to-find product?
          </p>
          <button
            onClick={() => setSearchParam("page", "contact")}
            className="text-sm font-semibold px-5 py-2.5 rounded transition-all duration-150 hover:brightness-110 flex-shrink-0"
            style={{
              background: "#005da3",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Talk to Our Sales Team
          </button>
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
  return (
    <section className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4">
        {STATS_DATA.map((s, i) => (
          <div
            key={s.label}
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
                style={{ fontSize: 20, color: "#005da3" }}
              >
                {s.value}
              </div>
              <div
                className="text-xs font-semibold mt-0.5"
                style={{ color: "#141414" }}
              >
                {s.label}
              </div>
              <div className="text-xs mt-0.5 text-gray-400">{s.sub}</div>
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
function HomePage() {
  return (
    <div>
      <Hero />
      <StatsBar />
      <Features />

      {/* Markets section */}
      <section className="py-20 px-6" style={{ background: "#ffffff" }}>
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="Industries Served"
            title="Trusted Across Demanding Markets"
            subtitle="IPC stocks specification-grade insulation materials used across every sector that requires reliable, certified wire and component protection."
            action={{
              label: "View All Industries →",
              onClick: () => setSearchParam("page", "industries"),
            }}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {MKT_MARKETS.map((m) => (
              <button
                key={m.label}
                onClick={() => setSearchParam("page", m.page)}
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
                    background: "rgba(0,93,163,0.07)",
                    color: "#005da3",
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
                    color: "#005da3",
                    marginTop: 12,
                  }}
                >
                  Learn More →
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Quote CTA band */}
      <section
        style={{
          background: "linear-gradient(135deg, #005da3 0%, #119ec8 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-extrabold text-white mb-2">
              $50 minimum order. 25M+ feet in stock. Ships today.
            </h2>
            <p style={{ color: "rgba(255,255,255,0.75)" }} className="text-sm">
              Call <a href="tel:+16307710700" style={{ color: "#ffffff", fontWeight: 600 }}>630.771.0700</a>,
              fax <a href="tel:+16307710701" style={{ color: "#ffffff", fontWeight: 600 }}>630.771.0701</a>,
              or submit a quote request online — our team responds quickly and accurately.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 flex-shrink-0">
            <button
              onClick={() => setSearchParam("page", "contact")}
              className="text-sm font-semibold px-6 py-3 rounded transition-all duration-150 hover:brightness-110"
              style={{
                background: "#ffffff",
                color: "#005da3",
                border: "none",
                cursor: "pointer",
              }}
            >
              Request a Quote
            </button>
            <button
              onClick={() => setSearchParam("page", "products")}
              className="text-sm font-semibold px-6 py-3 rounded transition-all duration-150"
              style={{
                background: "transparent",
                color: "#ffffff",
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
            </button>
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
        e.currentTarget.style.borderColor = "#005da3";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,93,163,0.10)";
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
            "linear-gradient(135deg, rgba(0,93,163,0.10) 0%, rgba(0,190,242,0.15) 100%)",
          fontSize: 24,
          border: "1px solid rgba(0,93,163,0.15)",
        }}
      >
        {avatar}
      </div>
      <div className="text-sm font-bold mb-1" style={{ color: "#141414" }}>
        {name}
      </div>
      <div className="text-xs font-medium" style={{ color: "#119ec8" }}>
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
  {
    icon: <CertCheckIcon />,
    title: "ISO 9001:2008",
    sub: "Registered Quality Management System",
  },
  {
    icon: <CertLeafIcon />,
    title: "Full RoHS Compliant",
    sub: "Entire product line",
  },
  {
    icon: <CertFlagIcon />,
    title: "Made in USA",
    sub: "Bolingbrook, IL facility",
  },
  {
    icon: <CertListIcon />,
    title: "UL · CSA · MIL-SPEC · AMS",
    sub: "Product-level certifications",
  },
  {
    icon: <CertBuildIcon />,
    title: "PPAP & IMDS Support",
    sub: "Automotive documentation available",
  },
  {
    icon: <CertLockIcon />,
    title: "Privately Held",
    sub: "Independent since July 1, 1974",
  },
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
  // Static arrays now at module level (ABOUT_CAPABILITIES, ABOUT_CERTS, ABOUT_MILESTONES)
  const capabilities = ABOUT_CAPABILITIES;
  const certs = ABOUT_CERTS;
  const milestones = ABOUT_MILESTONES;

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Company
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            About Insulation Products Corporation
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            A spec-grade stocking distributor of electrical insulation materials
            since July 1, 1974 — quick, accurate, and courteous service, always.
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
              Our Story
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
              Insulation Products Corporation was incorporated on July 1, 1974,
              and has operated from Bolingbrook, Illinois ever since. As a
              privately held, independent distributor, IPC is a major stocking
              source for heat-shrinkable and extruded tubing, electrical
              sleeving, and industrial adhesives — serving engineers, purchasing
              teams, and OEMs across dozens of industries for over 50 years.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
              With more than 25 million feet in stock and a $50 minimum order,
              IPC is built to serve both prototype quantities and full
              production runs. Most in-stock orders ship the same day or next
              business day. Our ISO 9001:2008 registered quality system ensures
              every order is processed accurately — from receiving and
              inspection through picking, packing, and final shipment.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
              Beyond standard stocking, IPC's in-house fabrication shop provides
              cut-to-length, hot-stamp marking, bar code printing, spooling,
              kitting, slitting, and perforation — all with a typical lead time
              of one week or less. JIT delivery programs and PPAP / IMDS
              documentation support are available for automotive and OEM
              customers.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
              Our product line includes UL-recognized, CSA-listed, MIL-SPEC,
              AMS, FDA-compliant, and RoHS-certified materials. The customer is
              always number one — that commitment has defined IPC since day one
              and remains our core operating principle today.
            </p>
          </div>

          {/* 4.4 — Verified sidebar facts */}
          <div className="space-y-3">
            {[
              { label: "Founded", value: "July 1, 1974" },
              { label: "Headquarters", value: "Bolingbrook, IL 60440" },
              { label: "Structure", value: "Privately Held" },
              { label: "Inventory", value: "25M+ feet in stock" },
              { label: "Minimum Order", value: "$50" },
              { label: "Quality", value: "ISO 9001:2008 Registered" },
              { label: "Custom Lead Time", value: "≤ 1 week" },
              { label: "Phone", value: "630.771.0700" },
              { label: "Fax", value: "630.771.0701" },
              { label: "PPAP / IMDS", value: "Available on request" },
            ].map((item) => (
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
                  style={{ color: "#005da3" }}
                >
                  {item.label === "Phone" ? (
                    <a href="tel:+16307710700" style={{ color: "#005da3" }}>{item.value}</a>
                  ) : item.label === "Fax" ? (
                    <a href="tel:+16307710701" style={{ color: "#005da3" }}>{item.value}</a>
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
            style={{ color: "#005da3" }}
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
                  key={m.year}
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
                        background: isLast ? "#005da3" : "rgba(0,93,163,0.08)",
                        color: isLast ? "#ffffff" : "#005da3",
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
                        background: isLast ? "#005da3" : "#ffffff",
                        border: `2px solid ${isLast ? "#005da3" : "#d1d9e0"}`,
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
                            "linear-gradient(to bottom, #005da3, #e5e9ee)",
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
            style={{ color: "#005da3" }}
          >
            Certifications &amp; Standards
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {certs.map((c) => (
              <div
                key={c.title}
                className="bg-white rounded-xl p-5 flex gap-4 items-start transition-all duration-200"
                style={{ border: "1px solid #e5e9ee" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#005da3";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0,93,163,0.08)";
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
                    background: "rgba(0,93,163,0.07)",
                    border: "1px solid rgba(0,93,163,0.12)",
                  }}
                >
                  {c.icon}
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
            style={{ color: "#005da3" }}
          >
            Our Team &amp; Capabilities
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {capabilities.map((c) => (
              <TeamCard
                key={c.name}
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
          style={{ background: "#0d2d52" }}
        >
          <div>
            <div className="text-lg font-extrabold text-white mb-1">
              Ready to place an order or request a quote?
            </div>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              Call <a href="tel:+16307710700" style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>630.771.0700</a>,
              email <a href="mailto:sales@insulationproducts.com" style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>sales@insulationproducts.com</a>,
              or use our contact form — our team responds quickly and accurately.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={() => setSearchParam("page", "contact")}
              className="text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
              style={{
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Contact Sales →
            </button>
            <button
              onClick={() => setSearchParam("page", "services")}
              className="text-sm font-medium px-5 py-2.5 rounded transition-all"
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
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
            </button>
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
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Fix 11: [answer] dep simplified to [] — answer is a prop that never changes for a
  // given FaqItem instance (items are rendered from a static array at module level).
  // ResizeObserver handles dynamic height changes if the viewport resizes.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight);
    measure(); // immediate measure on mount
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — answer is static per item

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all duration-200 ${open ? "shadow-md" : ""}`}
      style={{
        border: `1px solid ${open ? "#005da3" : "#e5e9ee"}`,
        background: "#ffffff",
      }}
    >
      {/* Trigger button — aria-expanded for screen readers */}
      <button
        className="w-full flex items-center justify-between px-6 py-5 text-left"
        style={{ background: "none", border: "none", cursor: "pointer" }}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
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
            background: open ? "#005da3" : "rgba(0,93,163,0.07)",
            color: open ? "#ffffff" : "#005da3",
          }}
        >
          +
        </span>
      </button>

      {/* Content panel — smooth max-height animation via inline style + Tailwind transition */}
      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: open ? `${contentHeight + 40}px` : "0px" }}
      >
        <div ref={contentRef} className="px-6 pb-5 border-t border-gray-100">
          <p className="text-sm leading-relaxed pt-4 text-gray-600">{answer}</p>
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
function FaqPage() {
  // categories is a large static array — defined inline for readability; zero render cost since
  // this component rarely re-renders (mounted once, stays mounted for the session).
  const categories = [
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
          "acceptedAnswer": { "@type": "Answer", "text": item.answer },
        }))
      ),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("faq-ld")?.remove(); };
  }, []);

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Resources
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Frequently Asked Questions
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Answers to common product, ordering, and service questions. Can't
            find what you need?{" "}
            <button
              onClick={() => setSearchParam("page", "contact")}
              className="underline font-semibold"
              style={{
                color: "#00bef2",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Contact our team.
            </button>
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
        <div
          className="max-w-4xl mx-auto px-6 py-3 flex gap-3 overflow-x-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
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
                color: "#005da3",
                border: "1px solid #005da3",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#005da3";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.color = "#005da3";
              }}
            >
              {cat.name}
            </button>
          ))}
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
                style={{ background: "#005da3" }}
              />
              <h2 className="text-base font-bold" style={{ color: "#005da3" }}>
                {cat.name}
              </h2>
            </div>
            <div className="space-y-3">
              {cat.items.map((item) => (
                <FaqItem key={item.question} {...item} />
              ))}
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
                <div>📞 <a href="tel:+16307710700" style={{ color: "rgba(255,255,255,0.5)" }}>630.771.0700</a></div>
                <div>📠 <a href="tel:+16307710701" style={{ color: "rgba(255,255,255,0.5)" }}>630.771.0701</a> (Fax)</div>
                <div>📧 <a href="mailto:sales@insulationproducts.com" style={{ color: "rgba(255,255,255,0.5)" }}>sales@insulationproducts.com</a></div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setSearchParam("page", "contact")}
                className="w-full py-3 rounded text-sm font-semibold hover:brightness-110 transition-all"
                style={{
                  background: "#005da3",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Contact Sales →
              </button>
              <button
                onClick={() => setSearchParam("page", "products")}
                className="w-full py-3 rounded text-sm font-medium transition-all"
                style={{
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
              </button>
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
  const [activeTab, setActiveTab] = useState("rfq");
  const [submitted, setSubmitted] = useState(false);
  const [submittedTab, setSubmittedTab] = useState("rfq");
  const [submitting, setSubmitting] = useState(false); // Animation 8: button loading state

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
    try {
      const body = new FormData(e.target);
      body.append("form_type", "message");
      const res  = await fetch("/contact.php", { method: "POST", body });
      const json = await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }));
      if (json.ok) {
        setSubmittedTab("message");
        setSubmitted(true);
      } else {
        alert(json.error || "Submission failed. Please call 630.771.0700.");
      }
    } catch {
      alert("Network error. Please call 630.771.0700 or email sales@insulationproducts.com directly.");
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
    partNumber: "",
    material: "",
    quantity: "",
    requiredDate: "",
    specialReqs: "",
    additionalNotes: "",
  });
  const onRfqChange = makeOnChange(setRfqForm);
  const onRfqSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = new FormData(e.target);
      body.append("form_type", "rfq");
      const res  = await fetch("/contact.php", { method: "POST", body });
      const json = await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }));
      if (json.ok) {
        setSubmittedTab("rfq");
        setSubmitted(true);
      } else {
        alert(json.error || "Submission failed. Please call 630.771.0700.");
      }
    } catch {
      alert("Network error. Please call 630.771.0700 or email sales@insulationproducts.com directly.");
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
    e.target.style.borderColor = "#005da3";
    e.target.style.boxShadow = "0 0 0 3px rgba(0,93,163,0.1)";
  };
  const blurStyle = (e) => {
    e.target.style.borderColor = "#d1d9e0";
    e.target.style.boxShadow = "none";
  };

  // Fix 7: contactCards at module level (CONTACT_CARDS)
  const contactCards = CONTACT_CARDS;

  if (submitted) {
    return (
      <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
        <div className="ipc-page-header">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h1
              className="text-4xl font-extrabold"
              style={{ color: "#ffffff" }}
            >
              {submittedTab === "rfq"
                ? "Quote Request Received"
                : "Message Received"}
            </h1>
          </div>
        </div>
        <div className="ipc-fade-up max-w-lg mx-auto px-6 py-24 text-center">
          <div className="ipc-fade-up text-5xl mb-6">✅</div>
          <h2
            className="ipc-fade-up-1 text-2xl font-bold mb-3"
            style={{ color: "#141414" }}
          >
            Thank you!
          </h2>
          <p
            className="ipc-fade-up-2 text-sm mb-4"
            style={{ color: "#4b5563" }}
          >
            {submittedTab === "rfq"
              ? "Your quote request has been received. Our sales team will review the details and respond within one business day — often the same day for in-stock items."
              : "Your message has been received. Our sales team will respond within one business day."}
          </p>
          <p
            className="ipc-fade-up-2 text-xs mb-8"
            style={{ color: "#9ca3af" }}
          >
            For urgent inquiries:{" "}
            📞 <a href="tel:+16307710700" style={{ color: "#9ca3af" }}>630.771.0700</a>
            {" · "}
            📠 <a href="tel:+16307710701" style={{ color: "#9ca3af" }}>630.771.0701</a>
            {" · "}
            📧 <a href="mailto:sales@insulationproducts.com" style={{ color: "#9ca3af" }}>sales@insulationproducts.com</a>
          </p>
          <div className="ipc-fade-up-3 flex gap-3 justify-center">
            <button
              className="text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
              style={{
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => {
                setSubmitted(false);
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
            <button
              onClick={() => setSearchParam("page", "products")}
              className="text-sm font-medium px-5 py-2.5 rounded transition-all"
              style={{
                background: "transparent",
                color: "#005da3",
                border: "1px solid #005da3",
                cursor: "pointer",
              }}
            >
              Browse Products
            </button>
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
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Contact
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Get in Touch
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Ready to order, need a quote, or have a technical question? Our
            sales team responds quickly and accurately.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left sidebar — contact cards + tips */}
        <div className="space-y-4">
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "#005da3" }}
          >
            Direct Contact
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
                  background: "rgba(0,93,163,0.07)",
                  color: "#005da3",
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
                       onMouseEnter={e => e.currentTarget.style.color = "#005da3"}
                       onMouseLeave={e => e.currentTarget.style.color = "#141414"}>
                      {item.info}
                    </a>
                  ) : item.info}
                </div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>
                  {item.sub}
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-xl p-5" style={{ background: "#0d2d52" }}>
            <div className="text-xs font-bold text-white mb-3 uppercase tracking-wide">
              For fastest response, include:
            </div>
            <ul className="space-y-1.5">
              {[
                "IPC part number or description",
                "Material type and size needed",
                "Quantity required",
                "Required delivery date",
                "Any special specs or certifications",
              ].map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2 text-xs"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  <span
                    style={{ color: "#00bef2", marginTop: 1, flexShrink: 0 }}
                  >
                    →
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right — tabbed forms */}
        <div className="lg:col-span-2">
          {/* Tab switcher — clear active/inactive contrast */}
          <div
            className="flex flex-col sm:flex-row mb-6 rounded-xl overflow-hidden"
            style={{
              border: "1px solid #d1d9e0",
              boxShadow: "0 1px 4px rgba(0,93,163,0.06)",
            }}
          >
            {[
              {
                id: "rfq",
                label: "📋  Request a Quote",
                sub: "Structured RFQ — fastest for orders",
              },
              {
                id: "message",
                label: "✉️  Send a Message",
                sub: "General inquiries & questions",
              },
            ].map((tab, i) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={active}
                  className="border-b sm:border-b-0 sm:border-r border-gray-200 last:border-b-0 sm:last:border-r-0"
                  style={{
                    flex: 1,
                    padding: "18px 22px",
                    textAlign: "left",
                    cursor: "pointer",
                    background: active ? "#005da3" : "#f5f7fa",
                    borderTop: active
                      ? "3px solid #00bef2"
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
                      color: active ? "#ffffff" : "#141414",
                    }}
                  >
                    {tab.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 3,
                      color: active ? "rgba(255,255,255,0.70)" : "#6b7280",
                    }}
                  >
                    {tab.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tab 1 — RFQ form */}
          {activeTab === "rfq" && (
            <form
              onSubmit={onRfqSubmit}
              className="bg-white rounded-2xl p-5 sm:p-8 space-y-5"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 4px 24px rgba(0,93,163,0.07)",
              }}
            >
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
                  Request a Quote
                </div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>
                  Fill in as much as you know — our team will clarify anything
                  needed.
                </div>
              </div>

              {/* Contact details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: "Full Name *",
                    name: "name",
                    type: "text",
                    placeholder: "Your name",
                    required: true,
                    autoComplete: "name",
                  },
                  {
                    label: "Email *",
                    name: "email",
                    type: "email",
                    placeholder: "you@company.com",
                    required: true,
                    autoComplete: "email",
                  },
                  {
                    label: "Phone",
                    name: "phone",
                    type: "tel",
                    placeholder: "Optional",
                    required: false,
                    autoComplete: "tel",
                  },
                  {
                    label: "Company",
                    name: "company",
                    type: "text",
                    placeholder: "Your organization",
                    required: false,
                    autoComplete: "organization",
                  },
                ].map((f) => (
                  <div key={f.name}>
                    <label
                      className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                      style={{ color: "#6b7280" }}
                    >
                      {f.label}
                    </label>
                    <input
                      type={f.type}
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
                style={{ color: "#005da3" }}
              >
                Product Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    Part Number / SKU
                  </label>
                  <input
                    type="text"
                    name="partNumber"
                    value={rfqForm.partNumber}
                    onChange={onRfqChange}
                    placeholder="e.g. IP35KY, IP33PO, or description"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    Material / Type
                  </label>
                  <input
                    type="text"
                    name="material"
                    value={rfqForm.material}
                    onChange={onRfqChange}
                    placeholder="e.g. Polyolefin 2:1, PVDF, Fiberglass"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    Quantity Required *
                  </label>
                  <input
                    type="text"
                    name="quantity"
                    value={rfqForm.quantity}
                    onChange={onRfqChange}
                    required
                    placeholder="e.g. 500 ft, 1000 pcs, 10 spools"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    Required Delivery Date
                  </label>
                  <input
                    type="text"
                    name="requiredDate"
                    value={rfqForm.requiredDate}
                    onChange={onRfqChange}
                    placeholder="e.g. ASAP, end of month, 6/30/2025"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  Special Requirements
                </label>
                <input
                  type="text"
                  name="specialReqs"
                  value={rfqForm.specialReqs}
                  onChange={onRfqChange}
                  placeholder="e.g. C of C required, PPAP, custom marking, specific color, certifications needed"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  Additional Notes
                </label>
                <textarea
                  name="additionalNotes"
                  value={rfqForm.additionalNotes}
                  onChange={onRfqChange}
                  rows={3}
                  placeholder="Any other details that will help us respond accurately…"
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-lg font-semibold text-sm text-white transition-all hover:brightness-110"
                style={{
                  background: "#005da3",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.85 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <span className="ipc-btn-spinner" />
                    Sending…
                  </>
                ) : (
                  "Submit Quote Request →"
                )}
              </button>
            </form>
          )}

          {/* Tab 2 — General message form */}
          {activeTab === "message" && (
            <form
              onSubmit={onMsgSubmit}
              className="bg-white rounded-2xl p-5 sm:p-8 space-y-5"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 4px 24px rgba(0,93,163,0.07)",
              }}
            >
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
                  Send a Message
                </div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>
                  For general questions, technical guidance, or anything that
                  doesn't fit the RFQ form.
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: "Full Name *",
                    name: "name",
                    type: "text",
                    placeholder: "Your name",
                    required: true,
                    autoComplete: "name",
                  },
                  {
                    label: "Email *",
                    name: "email",
                    type: "email",
                    placeholder: "you@company.com",
                    required: true,
                    autoComplete: "email",
                  },
                  {
                    label: "Phone",
                    name: "phone",
                    type: "tel",
                    placeholder: "Optional",
                    required: false,
                    autoComplete: "tel",
                  },
                  {
                    label: "Company",
                    name: "company",
                    type: "text",
                    placeholder: "Your organization",
                    required: false,
                    autoComplete: "organization",
                  },
                ].map((f) => (
                  <div key={f.name}>
                    <label
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
                  Subject *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={msgForm.subject}
                  onChange={onMsgChange}
                  required
                  placeholder="What's this about?"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  Message *
                </label>
                <textarea
                  name="message"
                  value={msgForm.message}
                  onChange={onMsgChange}
                  required
                  rows={5}
                  placeholder="Include any relevant details — product type, application, quantities, certifications needed…"
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-lg font-semibold text-sm text-white transition-all hover:brightness-110"
                style={{
                  background: "#005da3",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.85 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <span className="ipc-btn-spinner" />
                    Sending…
                  </>
                ) : (
                  "Send Message →"
                )}
              </button>
            </form>
          )}
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
const PRODUCTS_JSON_URL = "/data/products-all.json";

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
      /* Brand gradient page header — replaces #141414 dark headers on content pages */
      .ipc-page-header { background: linear-gradient(135deg, #005da3 0%, #119ec8 100%) !important; }
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

      /* Skeleton shimmer — LinkedIn/Netflix loading pattern */
      @keyframes ipc-shimmer {
        0%   { background-position: -700px 0; }
        100% { background-position:  700px 0; }
      }
      .ipc-skeleton {
        background: linear-gradient(90deg, #e8edf2 25%, #d1dae3 50%, #e8edf2 75%);
        background-size: 700px 100%;
        animation: ipc-shimmer 1.4s ease-in-out infinite;
        border-radius: 6px;
      }

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
        background: #005da3;
        border-radius: 8px;
        border: 2px solid #f0f4f8; /* gap between thumb and track */
        transition: background 0.2s;
      }
      ::-webkit-scrollbar-thumb:hover { background: #00bef2; }
      ::-webkit-scrollbar-thumb:active { background: #119ec8; }

      /* Corner piece where horizontal and vertical scrollbars meet */
      ::-webkit-scrollbar-corner { background: #f0f4f8; }

      /* Firefox */
      * { scrollbar-width: thin; scrollbar-color: #005da3 #f0f4f8; }

      /* Narrower scrollbar for small scroll containers (sidebars, dropdowns) */
      .ipc-scroll-sm::-webkit-scrollbar { width: 4px; height: 4px; }
      .ipc-scroll-sm::-webkit-scrollbar-thumb { background: rgba(0,93,163,0.4); border: none; }
      .ipc-scroll-sm::-webkit-scrollbar-thumb:hover { background: #00bef2; }
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

function fetchProductsCached() {
  if (_productsCache) return Promise.resolve(_productsCache);
  if (_productsFetchPromise) return _productsFetchPromise;
  // Per-minute cache-buster so admin edits become visible within ~60s. The
  // matching data/.htaccess sets Cache-Control max-age=60 must-revalidate,
  // so this query stamp + the server header bound staleness at ~1 minute.
  // (The earlier daily granularity made admin edits invisible for up to 24h
  // because both browser and Apache caches keyed by URL stayed warm all day.)
  const cacheBuster = Math.floor(Date.now() / 60000);
  const url = `${PRODUCTS_JSON_URL}?v=${cacheBuster}`;
  _productsFetchPromise = fetch(url)
    .then((res) => {
      if (!res.ok)
        throw new Error(`HTTP ${res.status} fetching product catalog`);
      return res.json();
    })
    .then((data) => {
      const arr = Array.isArray(data) ? data : (data.products ?? []);
      _productsCache = arr;
      _productsFetchPromise = null;
      return arr;
    })
    .catch((err) => {
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
  const cacheIsValid = _productsCache !== null && _productsCache.length > 0;
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

  return { products, loading, error };
}

// buildTableData removed — DashboardPage derives rows inline with filtering.

/**
 * Product family order and display labels for sidebar grouping.
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
 * IPC Product selector sidebar — grouped by product family, collapsible sections.
 * Mobile: compact horizontal scrollable family pill strip + product select pill row.
 * Desktop: full left sidebar with collapsible family groups.
 */
// Module-level constant — prevents recreating the Set on every ProductSidebar render (#6 fix)
const SIDEBAR_EXCLUDED = new Set(["VALUE-ADDED", ""]);

function ProductSidebar({ products, selectedId, onSelect }) {
  const families = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      if (SIDEBAR_EXCLUDED.has(p.sku || "")) continue;
      const fam = p.partType || "Other";
      if (!map.has(fam)) map.set(fam, []);
      map.get(fam).push(p);
    }
    const ordered = new Map();
    for (const key of FAMILY_ORDER) {
      if (map.has(key)) ordered.set(key, map.get(key));
    }
    for (const [key, val] of map) {
      if (!ordered.has(key)) ordered.set(key, val);
    }
    return ordered;
  }, [products]);

  const [openFamilies, setOpenFamilies] = useState(
    () => new Set(FAMILY_ORDER.concat(["Other"])),
  );
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
                background: !mobileFamily ? "#005da3" : "#ffffff",
                color: !mobileFamily ? "#ffffff" : "#4b5563",
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
                    background: active ? "#005da3" : "#ffffff",
                    color: active ? "#ffffff" : "#4b5563",
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
              <button
                key={`${p.sku || p.id}-${i}`}
                onClick={() => onSelect(p.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  minHeight: 44,
                  borderRadius: 8,
                  background: active ? "#005da3" : "#ffffff",
                  border: active ? "none" : "1px solid #e5e9ee",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: active ? "rgba(255,255,255,0.7)" : "#9ca3af",
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
                    color: active ? "#ffffff" : "#141414",
                    lineHeight: 1.3,
                  }}
                >
                  {p.name && p.name.length > 32
                    ? p.name.slice(0, 32) + "…"
                    : p.name || p.sku}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP VIEW: full left sidebar ── */}
      <div
        className="ipc-scroll-sm hidden lg:block sticky top-20 rounded-xl overflow-hidden"
        style={{
          border: "1px solid #e5e9ee",
          boxShadow: "0 1px 4px rgba(0,93,163,0.06)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 sticky top-0 z-10"
          style={{ background: "#0d2d52", borderBottom: "2px solid #00bef2" }}
        >
          <div
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "#119ec8" }}
          >
            Product Catalog
          </div>
          <div className="text-sm font-semibold text-white mt-0.5">
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
                  onClick={() => toggleFamily(family)}
                  className="w-full flex items-center justify-between px-5 py-2.5 text-left"
                  style={{
                    background: hasActive ? "rgba(0,93,163,0.04)" : "#f8fafc",
                    border: "none",
                    borderBottom: "1px solid #e5e9ee",
                    borderTop: "1px solid #e5e9ee",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: hasActive ? "#005da3" : "#9ca3af" }}
                  >
                    {family}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(0,93,163,0.1)",
                        color: "#005da3",
                      }}
                    >
                      {items.length}
                    </span>
                    <span
                      style={{
                        color: "#9ca3af",
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
                      <button
                        key={p.id}
                        onClick={() => onSelect(p.id)}
                        className="w-full text-left px-5 py-3 transition-all duration-150 block"
                        style={{
                          background: active
                            ? "rgba(0,93,163,0.05)"
                            : "#ffffff",
                          borderLeft: active
                            ? "3px solid #005da3"
                            : "3px solid transparent",
                          border: "none",
                          borderBottom: "1px solid #f0f3f7",
                          cursor: "pointer",
                          width: "100%",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          if (!active)
                            e.currentTarget.style.background =
                              "rgba(0,93,163,0.02)";
                        }}
                        onMouseLeave={(e) => {
                          if (!active)
                            e.currentTarget.style.background = "#ffffff";
                        }}
                      >
                        <div
                          className="text-xs font-bold mb-0.5 uppercase tracking-wide"
                          style={{ color: active ? "#005da3" : "#c4cbd4" }}
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
                      </button>
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

/** IPC Left spec table — dark header, clean row list */
function SpecTable1({ table }) {
  // #1 fix: guard against null/undefined rows — PHP admin may produce empty specTable1
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const title = table?.title ?? "Specifications:";
  return (
    <div
      className="rounded-xl overflow-hidden h-full"
      style={{ border: "1px solid #e5e9ee" }}
    >
      <div
        className="px-4 py-3 text-center text-sm font-bold text-white uppercase tracking-wide"
        style={{ background: "#0d2d52", borderBottom: "2px solid #00bef2" }}
      >
        {title}
      </div>
      <div className="bg-white divide-y" style={{ borderColor: "#e5e9ee" }}>
        {rows.map((row, i) => (
          <div key={i} className="px-4 py-3 text-sm">
            {row.label && (
              <span className="font-semibold" style={{ color: "#005da3" }}>
                {row.label}{" "}
              </span>
            )}
            <span
              className="whitespace-pre-line"
              style={{ color: "#4b5563", fontSize: 12.5 }}
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
                className="px-3 py-3 text-center text-white whitespace-pre-line text-xs font-semibold leading-snug align-middle"
                style={{
                  background:
                    i === 0 ? "#005da3" : i % 2 === 0 ? "#119ec8" : "#005da3",
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
                      className="px-3 py-2 text-center text-white text-xs font-semibold"
                      style={{
                        background: "#119ec8",
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

/**
 * Extracts compliance standard chips from a product's specTable1 rows.
 * Scans for known standards: UL, CSA, MIL, AMS, FDA, RoHS, ISO, ASTM, USP, NEMA.
 */
function extractComplianceBadges(product) {
  // I1 fix: scan both specTable1 rows AND specificationsSummary
  // so partData-merged products (which have summary but sparse specTable1) get chips too
  const tableText = (product.specTable1?.rows ?? [])
    .map((r) => r.value || "")
    .join(" ");
  const summaryText = product.specificationsSummary ?? "";
  const src = `${tableText} ${summaryText}`;
  const patterns = [
    {
      label: "UL Listed",
      regex: /U\/L|UL\s*(Subject|File|Recognized|Listed|224|VW-1)/i,
    },
    { label: "CSA", regex: /CSA/i },
    { label: "RoHS", regex: /RoHS/i },
    { label: "ISO 9001", regex: /ISO\s*9001/i },
    { label: "MIL-SPEC", regex: /MIL-I|MIL-R|M23053|Mil-I|MIL-DTL/i },
    { label: "AMS", regex: /AMS[\s-]\d/i },
    { label: "FDA", regex: /FDA|21\s*CFR/i },
    { label: "USP Class VI", regex: /USP\s*(Class|XXII)/i },
    { label: "ASTM", regex: /ASTM\s*D/i },
    { label: "NEMA", regex: /NEMA/i },
    { label: "UL VW-1", regex: /VW-1/i },
  ];
  // Deduplicate — if VW-1 already captured by "UL Listed", skip standalone
  const found = [];
  const seen = new Set();
  for (const { label, regex } of patterns) {
    if (regex.test(src) && !seen.has(label)) {
      // Skip "UL VW-1" if any other UL variant already added
      if (label === "UL VW-1" && [...seen].some((s) => s.startsWith("UL")))
        continue;
      found.push(label);
      seen.add(label);
    }
  }
  return found;
}

// Fix 12: module-level Set for ProductDetail related products exclusion
const NON_RELATABLE_TYPES = new Set(["Accessory", "Adhesive", "Tape", ""]);

/**
 * IPC Product detail view — authority layout matching catalog format.
 * Dark header bar, two-column body, compliance badge row, dual spec tables,
 * related products footer, PDF + quote CTAs.
 */
function ProductDetail({ product, allProducts }) {
  // product.pdfUrl is set by the PHP admin (upload-pdf.php → "/pdfs/<sku>.pdf").
  // When it's missing we render a "Request Data Sheet" button that routes to
  // the contact form instead — there is no external printable-page fallback.
  const hasPdfFile = Boolean(product.pdfUrl);
  const complianceBadges = extractComplianceBadges(product);

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
      "description": product.description || product.name,
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
        boxShadow: "0 4px 24px rgba(0,93,163,0.07)",
      }}
    >
      {/* Header — deep navy with product name, SKU, and action buttons */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a2a52 0%, #005da3 100%)",
        }}
      >
        <div className="px-8 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div
              className="text-xs font-bold tracking-widest uppercase mb-1"
              style={{ color: "#119ec8" }}
            >
              Product Detail
            </div>
            <h2 className="text-xl font-extrabold text-white uppercase leading-tight">
              {product.name}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span
              className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide"
              style={{ background: "#005da3", color: "#ffffff" }}
            >
              {product.sku}
            </span>
            {hasPdfFile ? (
              <>
                {/* Primary PDF — uses pdfLabel if set (e.g. "Molded Cap" for IP52EC), else "Download PDF" */}
                <a
                  href={product.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
                  style={{
                    background: "#00bef2",
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
                </a>
                {/* Additional PDF variants (e.g. IP52EC plugged-cap) — same styling */}
                {Array.isArray(product.additionalPdfs) &&
                  product.additionalPdfs.map((extra) => (
                    <a
                      key={extra.url}
                      href={extra.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
                      style={{
                        background: "#00bef2",
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
                    </a>
                  ))}
              </>
            ) : (
              <button
                onClick={() => setSearchParam("page", "contact")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
                style={{
                  background: "#00bef2",
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
              </button>
            )}
            <button
              onClick={() => setSearchParam("page", "contact")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
              style={{
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Request Quote
            </button>
          </div>
        </div>

        {/* 2.3 — Compliance badge chips row */}
        {complianceBadges.length > 0 && (
          <div className="px-8 pb-4">
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
              }}
            >
              Certifications &amp; Standards
            </div>
            <div className="flex flex-wrap gap-2">
              {complianceBadges.map((badge) => (
                <span
                  key={badge}
                  className="text-xs font-semibold px-2.5 py-1 rounded"
                  style={{
                    background: "rgba(0,190,242,0.15)",
                    color: "#00bef2",
                    border: "1px solid rgba(0,190,242,0.3)",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Body — photo + badges/description */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-0"
        style={{ borderBottom: "1px solid #e5e9ee" }}
      >
        {/* Left — photo */}
        <div className="p-5 sm:p-8 border-b border-gray-200 md:border-b-0 md:border-r md:border-gray-200">
          {/* Product image — show real photo if available, branded placeholder if placehold.co */}
          {product.photoUrl && !product.photoUrl.includes("placehold.co") ? (
            <img
              src={product.photoUrl}
              alt={product.name}
              loading="lazy"
              className="w-full rounded-lg object-cover"
              style={{ border: "1px solid #e5e9ee", maxHeight: 260 }}
            />
          ) : (
            <div
              className="w-full rounded-lg flex flex-col items-center justify-center gap-4"
              style={{
                height: 220,
                background: "#0a2240",
                border: "1px solid #1a3a5c",
              }}
            >
              <img src="/logo.svg" alt="IPC logo" width={72} height={72} />
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#00bef2",
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
              style={{ color: "#005da3" }}
            >
              {product.caption}
            </p>
          )}
        </div>

        {/* Right — feature badges + description */}
        <div className="p-5 sm:p-8">
          {product.badges && product.badges.length > 0 && (
            <div className="mb-5">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#9ca3af",
                  marginBottom: 8,
                }}
              >
                Product Features
              </div>
              <div className="flex flex-wrap gap-2">
                {product.badges.map((b) => (
                  <span
                    key={b}
                    className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide"
                    style={{
                      background: "rgba(0,93,163,0.08)",
                      color: "#005da3",
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

      {/* Spec tables — two column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        <div className="p-5 sm:p-8 border-b border-gray-200 md:border-b-0 md:border-r md:border-gray-200">
          <SpecTable1 table={product.specTable1} />
        </div>
        <div className="p-5 sm:p-8">
          <SpecTable2 table={product.specTable2} />
        </div>
      </div>

      {/* 2.4 — Related Products */}
      {related.length > 0 && (
        <div
          className="p-8"
          style={{ borderTop: "1px solid #e5e9ee", background: "#f8fafc" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "#005da3" }}
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
                  e.currentTarget.style.borderColor = "#005da3";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e9ee";
                }}
              >
                <div
                  className="text-xs font-bold uppercase mb-1 transition-colors duration-200 group-hover:text-blue-700"
                  style={{ color: "#005da3" }}
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
                  style={{ color: "#00bef2" }}
                >
                  View{" "}
                  <span
                    style={{
                      display: "inline-block",
                      transition: "transform 0.2s ease",
                      transform: "translateX(0)",
                    }}
                    ref={(el) => {
                      if (el) {
                        el.closest("button")?.addEventListener(
                          "mouseenter",
                          () => (el.style.transform = "translateX(4px)"),
                        );
                        el.closest("button")?.addEventListener(
                          "mouseleave",
                          () => (el.style.transform = "translateX(0)"),
                        );
                      }
                    }}
                  >
                    →
                  </span>
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
function ProductPage({ products }) {
  const [selectedId, setSelectedId] = useSearchParam("productId");
  // C4 fix: exact match first, then compound-SKU fuzzy match for navigation links
  // that use partial IDs (e.g. "IP71NS" from IndustriesPage → "IP71NS - IP72PS - IP73PP")
  const product = selectedId
    ? products.find((p) => p.id === selectedId || p.sku === selectedId) ||
      products.find(
        (p) =>
          (p.sku || "").includes(selectedId) ||
          selectedId.includes(p.sku || ""),
      ) ||
      products[0]
    : products[0];
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [pulseSkuBadge, setPulseSkuBadge] = useState(false);
  const prevShowRef = useRef(false);
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

  if (!product) {
    return (
      <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
        <div className="ipc-page-header">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h1
              className="text-4xl font-extrabold"
              style={{ color: "#ffffff" }}
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
    <div style={{ background: "#f5f7fa", minHeight: "100vh", paddingBottom: showStickyBar ? 72 : 0, transition: 'padding-bottom 0.3s ease' }}>
      {/* Page header */}
      <div
        ref={headerRef}
        className="ipc-page-header"
        style={{ borderBottom: "none" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "#119ec8" }}
          >
            Products
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Product Catalog
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Select a product to view full specifications, data sheet, and
            request a quote.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col lg:flex-row gap-8 items-start">
        <ProductSidebar
          products={products}
          selectedId={product.id}
          onSelect={(id) => {
            setSelectedId(id);
            setShowStickyBar(false);
            if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
              detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
        <div ref={detailRef} className="flex-1 min-w-0">
          <ProductDetail product={product} allProducts={products} />
        </div>
      </div>

      {/* Sticky RFQ bar — spring slide-in with slight overshoot */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: "#0d2d52",
          borderTop: "2px solid #00bef2",
          transform: showStickyBar ? "translateY(0)" : "translateY(110%)",
          /* Spring cubic-bezier: overshoots slightly then settles — more personality than ease */
          transition: showStickyBar
            ? "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)"
            : "transform 0.25s ease-in",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
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
                color: pulseSkuBadge ? "#141414" : "#119ec8",
                background: pulseSkuBadge ? "#00bef2" : "transparent",
                padding: pulseSkuBadge ? "1px 6px" : "1px 0",
                borderRadius: 4,
                transition: "all 0.3s ease",
                display: "inline-block",
              }}
            >
              {product.sku}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 400,
              }}
            >
              {product.name}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
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
                    color: "#ffffff",
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
                </a>
                {/* Additional PDF variants — same styling */}
                {Array.isArray(product.additionalPdfs) &&
                  product.additionalPdfs.map((extra) => (
                    <a
                      key={extra.url}
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
                        color: "#ffffff",
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
                    </a>
                  ))}
              </>
            ) : null}
            <button
              onClick={() => setSearchParam("page", "contact")}
              className="ipc-tap"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 20px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#004e8c")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#005da3")
              }
            >
              Request a Quote →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fix 8: DashboardPage column definitions at module level — not recreated on every keystroke
const DASHBOARD_COLS = [
  { key: "name", label: "Product Name", width: null },
  { key: "partId", label: "Part ID", width: 100 },
  { key: "partType", label: "Part Type", width: 160 },
  { key: "description", label: "Description", width: null },
  { key: "operatingTemp", label: "Temp", width: 110 },
  { key: "specifications", label: "Specifications", width: 240 },
];

/**
 * IPC Product Dashboard — dark header, authority table with search, sort, and "View Product" CTA.
 * Accepts the live products array as a prop; derives table rows dynamically.
 */
function DashboardPage({ products }) {
  const [search, setSearch] = useState("");
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
      setFamilyParam(null); // clean up URL param after reading
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

  const handleViewProduct = (productId) => {
    setSearchParams({ productId, page: "products" });
  };

  // Fix 8: cols references DASHBOARD_COLS (module-level) — not recreated on every keystroke
  const cols = DASHBOARD_COLS;

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Product Index
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Product Index
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Browse all {tableRows.length} products with key specifications.
            Click <strong className="text-white">View Product</strong> for full
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
                      ? "2px solid #005da3"
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
                  color: "#005da3",
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
                  e.target.style.borderColor = "#005da3";
                  e.target.style.boxShadow = "0 0 0 3px rgba(0,93,163,0.1)";
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
                  border: active ? "2px solid #005da3" : "1px solid #d1d9e0",
                  background: active ? "#005da3" : "#ffffff",
                  color: active ? "#ffffff" : "#4b5563",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "#005da3";
                    e.currentTarget.style.color = "#005da3";
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
                    background: active
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(0,93,163,0.08)",
                    color: active ? "#ffffff" : "#005da3",
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
                  background: "rgba(0,93,163,0.1)",
                  color: "#005da3",
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
                e.target.style.borderColor = "#005da3";
                e.target.style.boxShadow = "0 0 0 3px rgba(0,93,163,0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d1d9e0";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
        </div>

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
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#005da3', letterSpacing: '0.04em' }}>
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
                        color: '#119ec8',
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
                <button
                  onClick={() => handleViewProduct(row.productId)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    background: '#005da3',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View Product →
                </button>
              </div>
            ))
          )}
        </div>

        {/* Table */}
        <div
          className="hidden sm:block rounded-xl overflow-hidden"
          style={{
            border: "1px solid #e5e9ee",
            boxShadow: "0 2px 12px rgba(0,93,163,0.07)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: "#0d2d52" }}>
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: "13px 18px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color:
                          sortCol === col.key
                            ? "#00bef2"
                            : "rgba(255,255,255,0.65)",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                        width: col.width || undefined,
                        borderBottom: "2px solid #005da3",
                      }}
                    >
                      {col.label}{" "}
                      <span style={{ fontSize: 9 }}>
                        {sortCol === col.key
                          ? sortDir === "asc"
                            ? "▲"
                            : "▼"
                          : "⇅"}
                      </span>
                    </th>
                  ))}
                  <th
                    style={{
                      padding: "13px 18px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "rgba(255,255,255,0.65)",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      borderBottom: "2px solid #005da3",
                      width: 130,
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
                      colSpan={6}
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
                            background: "rgba(0,93,163,0.07)",
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
                              color: "#005da3",
                              background: "rgba(0,93,163,0.07)",
                              border: "1px solid rgba(0,93,163,0.2)",
                              cursor: "pointer",
                              padding: "7px 16px",
                              borderRadius: 6,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "rgba(0,93,163,0.12)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                "rgba(0,93,163,0.07)";
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
                      style={{
                        background: ri % 2 === 0 ? "#ffffff" : "#fafbfc",
                        borderBottom: "1px solid #e5e9ee",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,93,163,0.04)";
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
                        <span style={{ fontWeight: 700, color: "#005da3" }}>
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
                            color: "#119ec8",
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
                        <button
                          onClick={() => handleViewProduct(row.productId)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "7px 16px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#005da3",
                            color: "#ffffff",
                            border: "none",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#004e8c";
                            const a =
                              e.currentTarget.querySelector(".ipc-btn-arrow");
                            if (a) a.style.transform = "translateX(4px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#005da3";
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
                        </button>
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
            color: "#9ca3af",
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

function IndustriesPage() {
  const industries = [
    {
      iconKey: "automotive",
      name: "Automotive",
      subhead: "PPAP & IMDS documentation available",
      color: "#005da3",
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
      color: "#005da3",
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
      color: "#005da3",
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
      color: "#005da3",
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
      color: "#005da3",
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

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Industries Served
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Applications by Industry
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            IPC supplies spec-grade insulation materials across demanding
            industries. Select your sector to see the products and
            certifications that serve your application.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-14 space-y-10">
        {industries.map((ind) => (
          <div
            key={ind.name}
            className="bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            style={{
              border: "1px solid #e5e9ee",
              boxShadow: "0 2px 12px rgba(0,93,163,0.06)",
            }}
          >
            {/* Industry header */}
            <div
              className="px-5 py-4 md:px-8 md:py-5 flex items-center gap-4"
              style={{
                background: "linear-gradient(135deg, #003d7a, #005da3)",
                borderBottom: "none",
              }}
            >
              <div
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: "rgba(0,93,163,0.5)",
                  color: "#00bef2",
                  border: "1px solid rgba(0,190,242,0.3)",
                }}
              >
                {IndIcons[ind.iconKey]}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">
                  {ind.name}
                </h2>
                <p
                  className="text-xs font-semibold mt-0.5"
                  style={{ color: "#00bef2" }}
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
                  style={{ color: "#005da3" }}
                >
                  Common Applications
                </div>
                <ul className="space-y-2.5">
                  {ind.useCases.map((uc) => (
                    <li
                      key={uc}
                      className="flex items-start gap-2.5 text-sm"
                      style={{ color: "#4b5563" }}
                    >
                      <span
                        style={{
                          color: "#00bef2",
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
                  style={{ color: "#005da3" }}
                >
                  IPC Products
                </div>
                <ul className="space-y-2">
                  {ind.products.map((prod) => (
                    <li key={prod.sku}>
                      <button
                        onClick={() =>
                          setSearchParams({
                            productId: prod.sku,
                            page: "products",
                          })
                        }
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
                            color: "#119ec8",
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
                              color: "#005da3",
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
                              color: "#00bef2",
                              marginTop: 1,
                              fontWeight: 600,
                            }}
                          >
                            View product →
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Certifications + CTA */}
              <div className="p-7 flex flex-col justify-between">
                <div>
                  <div
                    className="text-xs font-bold uppercase tracking-widest mb-4"
                    style={{ color: "#005da3" }}
                  >
                    Certifications
                  </div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {ind.certs.map((cert) => (
                      <span
                        key={cert}
                        className="text-xs font-semibold px-2.5 py-1 rounded"
                        style={{
                          background: "rgba(0,93,163,0.08)",
                          color: "#005da3",
                        }}
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setSearchParam("page", "contact")}
                    className="w-full py-2.5 rounded text-sm font-semibold transition-all hover:brightness-110"
                    style={{
                      background: "#005da3",
                      color: "#ffffff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Request a Quote →
                  </button>
                  <button
                    onClick={() => setSearchParam("page", "products")}
                    className="w-full py-2.5 rounded text-sm font-medium transition-all"
                    style={{
                      background: "transparent",
                      color: "#005da3",
                      border: "1px solid #005da3",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(0,93,163,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Browse All Products
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* PPAP / IMDS note */}
        <div
          className="rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ background: "#0d2d52" }}
        >
          <div>
            <div className="text-sm font-bold text-white mb-1">
              PPAP &amp; IMDS Documentation Available
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
              IPC can support automotive supplier requirements for PPAP packages
              and IMDS material data submissions. Contact our sales team for
              details.
            </p>
          </div>
          <button
            onClick={() => setSearchParam("page", "contact")}
            className="flex-shrink-0 text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
            style={{
              background: "#005da3",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Contact Sales
          </button>
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
    primary: { background: "rgba(0,93,163,0.09)", color: "#005da3" },
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

function ServicesPage() {
  const services = [
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

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Fabrication
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Value-Added Services
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Beyond stocking and distributing, IPC offers a full range of
            fabrication and customization services — all with a typical lead
            time of one week or less.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-14">
        {/* Lead time callout banner */}
        <div
          className="rounded-xl p-5 mb-10 flex flex-wrap items-center justify-between gap-4"
          style={{
            background: "linear-gradient(135deg, #005da3, #119ec8)",
            boxShadow: "0 4px 16px rgba(0,93,163,0.20)",
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
              <div className="text-base font-extrabold text-white">
                Standard Lead Time: ≤ 1 Week
              </div>
              <div
                className="text-xs font-medium mt-0.5"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                All fabrication services listed below. Rush service available —
                contact sales for details.
              </div>
            </div>
          </div>
          <button
            onClick={() => setSearchParam("page", "contact")}
            className="flex-shrink-0 text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
            style={{
              background: "#ffffff",
              color: "#005da3",
              border: "none",
              cursor: "pointer",
            }}
          >
            Request a Quote →
          </button>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {services.map((svc) => (
            <div
              key={svc.title}
              className="bg-white rounded-2xl overflow-hidden flex flex-col"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 1px 4px rgba(0,93,163,0.05)",
              }}
            >
              {/* Service header */}
              <div
                className="px-6 py-5"
                style={{ borderBottom: "2px solid #005da3" }}
              >
                <div
                  className="flex items-center justify-center rounded-lg mb-3"
                  style={{
                    width: 42,
                    height: 42,
                    background: "rgba(0,93,163,0.08)",
                    color: "#005da3",
                    border: "1px solid rgba(0,93,163,0.15)",
                  }}
                >
                  {SvcIcons[svc.iconKey]}
                </div>
                <h3 className="text-lg font-bold" style={{ color: "#141414" }}>
                  {svc.title}
                </h3>
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
                  {svc.details.map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-2 text-xs"
                      style={{ color: "#4b5563" }}
                    >
                      <span
                        style={{
                          color: "#00bef2",
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
                    color: "#005da3",
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
                </a>
              ) : (
                <div
                  className="px-6 py-4"
                  style={{
                    background: "#f8fafc",
                    borderTop: "1px solid #e5e9ee",
                  }}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>

        {/* Capabilities footer strip */}
        <div className="rounded-2xl p-8" style={{ background: "#0d2d52" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-xl font-extrabold text-white mb-3">
                Need something not listed?
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.60)" }}
              >
                Our engineering team can create custom solutions. Whether it's a
                unique marking specification, a non-standard cut tolerance, or a
                JIT kitting program — contact our sales team and we'll design a
                solution for your requirements.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setSearchParam("page", "contact")}
                className="w-full py-3 rounded text-sm font-semibold hover:brightness-110 transition-all"
                style={{
                  background: "#005da3",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Contact Sales →
              </button>
              <button
                onClick={() => setSearchParam("page", "products")}
                className="w-full py-3 rounded text-sm font-medium transition-colors duration-150 hover:text-white hover:border-white/50"
                style={{
                  background: "transparent",
                  color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                }}
              >
                Browse All Products
              </button>
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
function PrivacyPage() {
  const sections = [
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

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Legal
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Privacy Policy
          </h1>
          <p
            className="mt-3 text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Effective Date: January 1, 2025 · Last Updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        <div
          className="bg-white rounded-2xl p-8 space-y-8"
          style={{
            border: "1px solid #e5e9ee",
            boxShadow: "0 2px 12px rgba(0,93,163,0.06)",
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
            Insulation Products Corporation ("IPC", "we", "us", or "our")
            operates the website at insulationproducts.com. This Privacy Policy
            explains how we collect, use, and protect information when you visit
            our site or contact us through it.
          </p>
          {sections.map((sec, i) => (
            <div key={sec.title}>
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
                    background: "#005da3",
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
                {sec.content}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-center" style={{ color: "#9ca3af" }}>
          © 1974–{new Date().getFullYear()} Insulation Products Corporation ·
          250 Gibraltar Dr, Bolingbrook, IL 60440
        </p>
      </div>
    </div>
  );
}

/**
 * IPC Footer — SVG logo mark + SVG contact icons + verified contact data.
 */
function Footer() {
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
    <footer style={{ background: "#0a2240", borderTop: "3px solid #00bef2" }}>
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand column — SVG logo mark */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/logo.svg"
                alt="IPC logo"
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
                  INSULATION PRODUCTS CORPORATION
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "#119ec8", letterSpacing: "0.08em" }}
                >
                  ESTABLISHED 1974 · ISO 9001 · RoHS COMPLIANT
                </div>
              </div>
            </div>
            <p
              className="text-xs leading-relaxed max-w-xs"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              A spec-grade stocking distributor of heat-shrinkable &amp;
              extruded tubing, electrical sleeving, and industrial adhesives.
              $50 minimum order. Quick, accurate, courteous service — the
              customer is always number one.
            </p>
          </div>

          {/* Contact column — SVG icons */}
          <div>
            <div
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "#119ec8" }}
            >
              Contact
            </div>
            <div
              className="space-y-2.5 text-xs"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <div className="flex items-center gap-2">
                <PhoneIcon />
                <a href="tel:+16307710700" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>630.771.0700</a>
              </div>
              <div className="flex items-center gap-2">
                <FaxIcon />
                <a href="tel:+16307710701" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>630.771.0701 (Fax)</a>
              </div>
              <div className="flex items-center gap-2">
                <MailIcon />
                <a href="mailto:sales@insulationproducts.com" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>sales@insulationproducts.com</a>
              </div>
              <div className="flex items-start gap-2">
                <PinIcon />{" "}
                <span>
                  250 Gibraltar Dr
                  <br />
                  Bolingbrook, IL 60440
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon /> Mon–Fri, 8am–5pm CT
              </div>
            </div>
          </div>

          {/* Quick links — 2 columns of 4 inside, occupies 1 grid column on desktop */}
          <div>
            <div
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "#119ec8" }}
            >
              Quick Links
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px 24px",
              }}
            >
              {[
                { label: "Product Catalog", page: "products" },
                { label: "About IPC", page: "about" },
                { label: "Product Index", page: "dashboard" },
                { label: "Resources / FAQ", page: "faq" },
                { label: "Industries", page: "industries" },
                { label: "Contact", page: "contact" },
                { label: "Services", page: "services" },
                { label: "Privacy Policy", page: "privacy" },
              ].map((link) => (
                <div key={link.label}>
                  <button
                    onClick={() => setSearchParam("page", link.page)}
                    className="text-xs transition-colors duration-150 ipc-tap"
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "8px 0",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#00bef2")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "rgba(255,255,255,0.45)")
                    }
                  >
                    {link.label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex flex-col md:flex-row items-center justify-between gap-2 pt-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 1974–{new Date().getFullYear()} Insulation Products Corporation.
            All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            insulationproducts.com · Bolingbrook, IL 60440
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
function App() {
  // Register the module-level setSearchParams/setSearchParam batch ref so that
  // event-handler calls outside of components route through react-router-dom
  // and actually trigger a re-render. Without this, URL updates would be
  // invisible to React.
  useSetSearchParamRef();
  const [page] = useSearchParam("page");
  const { products, loading, error } = useProducts();

  // ALL hooks must be called before any conditional return (React rules of hooks).
  // Scroll to top + update document title and meta description on every page navigation.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    const titles = {
      products:   "Product Catalog — Insulation Products Corporation",
      dashboard:  "Product Index — Insulation Products Corporation",
      industries: "Industries Served — Insulation Products Corporation",
      services:   "Value-Added Services — Insulation Products Corporation",
      about:      "About — Insulation Products Corporation",
      faq:        "FAQ & Resources — Insulation Products Corporation",
      contact:    "Contact / Request a Quote — Insulation Products Corporation",
      privacy:    "Privacy Policy — Insulation Products Corporation",
    };

    const descriptions = {
      products:   "Browse IPC's full catalog of heat shrink tubing, sleeving, and adhesives. Filter by product family, view specs and data sheets, and request a quote.",
      dashboard:  "Search and sort all IPC products by part number, material, and temperature rating. Quick access to specs and data sheets for every SKU.",
      industries: "IPC supplies specification-grade insulation materials to automotive, aerospace, medical, military, marine, and industrial markets. Learn how we serve your industry.",
      services:   "Custom cut-to-length, hot-stamp marking, bar code printing, spooling, kitting, and JIT delivery programs. Typical lead time one week or less.",
      about:      "Insulation Products Corporation — a spec-grade stocking distributor in Bolingbrook, IL since July 1, 1974. ISO 9001 registered. $50 minimum order, same-day shipment.",
      faq:        "Answers to common questions about IPC products, certifications, ordering minimums, custom fabrication, and documentation support.",
      contact:    "Request a quote, submit a PO, or ask a question. Call 630.771.0700, fax 630.771.0701, email sales@insulationproducts.com, or use our online form.",
      privacy:    "Privacy policy for Insulation Products Corporation — how we collect and use information submitted through our website contact forms.",
    };

    const defaultTitle = "Insulation Products Corporation — Heat Shrink Tubing, Sleeving & Adhesives";
    const defaultDesc  = "IPC is a spec-grade stocking distributor of heat-shrinkable & extruded tubing, electrical sleeving, and industrial adhesives. $50 minimum order. Ships same day. ISO 9001 registered.";

    document.title = titles[page] || defaultTitle;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", descriptions[page] || defaultDesc);
  }, [page]);

  // Animation 7 — Shimmer skeleton replaces the spinner.
  // Previews the actual page layout so users see an almost-real page resolving.
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "#f5f7fa" }}
      >
        {/* Skeleton Navbar */}
        <div
          style={{
            background: "#0d2d52",
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: "0 32px",
            gap: 16,
          }}
        >
          <div
            className="ipc-skeleton"
            style={{ width: 40, height: 40, borderRadius: 8, opacity: 0.4 }}
          />
          <div
            className="ipc-skeleton"
            style={{ width: 160, height: 16, borderRadius: 4, opacity: 0.3 }}
          />
          <div style={{ flex: 1 }} />
          <div
            className="ipc-skeleton"
            style={{ width: 80, height: 14, borderRadius: 4, opacity: 0.25 }}
          />
          <div
            className="ipc-skeleton"
            style={{ width: 80, height: 14, borderRadius: 4, opacity: 0.25 }}
          />
          <div
            className="ipc-skeleton"
            style={{ width: 120, height: 36, borderRadius: 6, opacity: 0.35 }}
          />
        </div>

        {/* Skeleton Hero */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2"
          style={{
            background: "linear-gradient(135deg, #005da3, #119ec8)",
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

  // Error state
  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "#f5f7fa" }}
      >
        <div
          style={{
            background: "#141414",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            height: 64,
          }}
        />
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
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
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
      case "faq":
        return <FaqPage />;
      case "contact":
        return <ContactPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#f5f7fa" }}
    >
      <GlobalStyles />
      <Navbar products={products} />
      <main className="flex-1"><ErrorBoundary>{renderPage()}</ErrorBoundary></main>
      <Footer />
    </div>
  );
}

export default App;
