import React, { useState, useEffect, useRef } from "react";

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

export default FaqItem;
