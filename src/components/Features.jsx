import React from "react";
import SectionHeader from "./SectionHeader";
import FeatureCard from "./FeatureCard";
import { FEATURES_ICONS } from "./icons/FeatureIcons";
import { FEATURES_DATA } from "../lib/constants";
import { setSearchParam } from "../lib/routing";

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

export default Features;
