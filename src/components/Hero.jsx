import React from "react";
import { setSearchParam } from "../lib/routing";

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

export default Hero;
