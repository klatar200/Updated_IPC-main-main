import React, { useEffect } from "react";
import FaqItem from "../components/FaqItem";
import { setSearchParam } from "../lib/routing";

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

export default FaqPage;
