import React from "react";
import Hero from "../components/Hero";
import StatsBar from "../components/StatsBar";
import Features from "../components/Features";
import SectionHeader from "../components/SectionHeader";
import { MktIcons } from "../components/icons/MarketIcons";
import { MKT_MARKETS } from "../lib/constants";
import { setSearchParam } from "../lib/routing";

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

export default HomePage;
