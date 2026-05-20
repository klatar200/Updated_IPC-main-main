import React from "react";

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

export default PrivacyPage;
