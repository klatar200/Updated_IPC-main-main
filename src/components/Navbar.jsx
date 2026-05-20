import React, { useState, useMemo } from "react";
import { useSearchParam, setSearchParams } from "../lib/routing";
import { SIDEBAR_EXCLUDED, FAMILY_ORDER, COMPANY_ITEMS } from "../lib/constants";

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

export default Navbar;
