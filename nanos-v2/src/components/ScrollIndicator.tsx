"use client";

export function ScrollIndicator() {
  const scrollToProducts = () => {
    const el = document.getElementById("featured-products");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <button
      type="button"
      onClick={scrollToProducts}
      className="scroll-indicator"
      aria-label="Scroll to featured products"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
    </button>
  );
}
