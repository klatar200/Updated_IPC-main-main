import React from "react";
import Badge from "../components/Badge";
import { SvcIcons } from "../components/icons/ServiceIcons";
import { setSearchParam } from "../lib/routing";

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

              {/* Lead time */}
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{
                  background: "#f8fafc",
                  borderTop: "1px solid #e5e9ee",
                }}
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#6b7280" }}
                >
                  Typical Lead Time
                </span>
                <Badge>{svc.leadTime}</Badge>
              </div>
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

export default ServicesPage;
