import React from "react";
import { IndIcons } from "../components/icons/IndustryIcons";
import { setSearchParam, setSearchParams } from "../lib/routing";

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

export default IndustriesPage;
