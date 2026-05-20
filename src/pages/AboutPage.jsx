import React from "react";
import TeamCard from "../components/TeamCard";
import {
  CertCheckIcon,
  CertLeafIcon,
  CertFlagIcon,
  CertListIcon,
  CertBuildIcon,
  CertLockIcon,
} from "../components/icons/CertIcons";
import { ABOUT_CAPABILITIES, ABOUT_MILESTONES } from "../lib/constants";
import { setSearchParam } from "../lib/routing";

// ABOUT_CERTS holds JSX icon components so it lives next to AboutPage
// (cannot move into the pure-data constants.js).
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

export default AboutPage;
