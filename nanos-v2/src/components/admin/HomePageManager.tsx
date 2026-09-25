"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ImageField, IMAGE_SPECS } from "@/components/admin/ImageField";
import {
  HomePageConfig,
  DEFAULT_HOMEPAGE_CONFIG,
  ProductSectionConfig,
  SectionButton,
  CategoryTileConfig,
  PromoTileConfig,
} from "@/lib/homepage";

interface AdminProductItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  hero: string;
  tag?: string | null;
  totalStock?: number;
}

interface HomePageManagerProps {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  allProducts: AdminProductItem[];
  onRefreshProducts: () => Promise<void>;
  showToast: (msg: string, type: "success" | "error") => void;
}

export function HomePageManager({
  authFetch,
  allProducts,
  onRefreshProducts,
  showToast,
}: HomePageManagerProps) {
  const [config, setConfig] = useState<HomePageConfig>(DEFAULT_HOMEPAGE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<
    "hero" | "productSections" | "categories" | "marquee" | "promo" | "editorial"
  >("hero");

  // Selected product section index
  const [selectedProdSecIdx, setSelectedProdSecIdx] = useState<number>(0);

  // Modal states for Product Adding / Creating
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isCreateProductModalOpen, setIsCreateProductModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("crocs");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdHero, setNewProdHero] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const res = await authFetch("/api/admin/homepage");
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig(data.config);
          }
        } else {
          showToast("Failed to load homepage config, using defaults", "error");
        }
      } catch (err) {
        showToast("Error loading homepage config", "error");
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await authFetch("/api/admin/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        showToast("Homepage updated successfully!", "success");
      } else {
        showToast("Failed to save changes", "error");
      }
    } catch (err) {
      showToast("Network error while saving", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Reset homepage layout and banners to default settings?")) {
      setConfig(DEFAULT_HOMEPAGE_CONFIG);
      showToast("Reset to defaults. Click 'Save Changes' to apply.", "success");
    }
  };

  // Helper for Product Map
  const productMap = React.useMemo(() => {
    const map = new Map<string, AdminProductItem>();
    allProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [allProducts]);

  // --- BUTTON MANAGEMENT HELPERS ---
  const addButtonToSection = (sectionKey: "hero" | "categories" | "editorial" | "productSection", sectionIdx = 0) => {
    const newBtn: SectionButton = {
      id: "btn_" + Date.now().toString(36),
      label: "Button Label",
      url: "/products",
      style: "outline",
      isHidden: false,
    };

    if (sectionKey === "hero") {
      setConfig((prev) => ({
        ...prev,
        hero: { ...prev.hero, buttons: [...prev.hero.buttons, newBtn] },
      }));
    } else if (sectionKey === "categories") {
      setConfig((prev) => ({
        ...prev,
        categorySection: { ...prev.categorySection, buttons: [...(prev.categorySection.buttons || []), newBtn] },
      }));
    } else if (sectionKey === "editorial") {
      setConfig((prev) => ({
        ...prev,
        editorialSection: { ...prev.editorialSection, buttons: [...prev.editorialSection.buttons, newBtn] },
      }));
    } else if (sectionKey === "productSection") {
      setConfig((prev) => {
        const updated = [...prev.productSections];
        if (updated[sectionIdx]) {
          updated[sectionIdx] = {
            ...updated[sectionIdx],
            buttons: [...(updated[sectionIdx].buttons || []), newBtn],
          };
        }
        return { ...prev, productSections: updated };
      });
    }
  };

  const updateButton = (
    sectionKey: "hero" | "categories" | "editorial" | "productSection",
    btnId: string,
    updates: Partial<SectionButton>,
    sectionIdx = 0
  ) => {
    if (sectionKey === "hero") {
      setConfig((prev) => ({
        ...prev,
        hero: {
          ...prev.hero,
          buttons: prev.hero.buttons.map((b) => (b.id === btnId ? { ...b, ...updates } : b)),
        },
      }));
    } else if (sectionKey === "categories") {
      setConfig((prev) => ({
        ...prev,
        categorySection: {
          ...prev.categorySection,
          buttons: (prev.categorySection.buttons || []).map((b) => (b.id === btnId ? { ...b, ...updates } : b)),
        },
      }));
    } else if (sectionKey === "editorial") {
      setConfig((prev) => ({
        ...prev,
        editorialSection: {
          ...prev.editorialSection,
          buttons: prev.editorialSection.buttons.map((b) => (b.id === btnId ? { ...b, ...updates } : b)),
        },
      }));
    } else if (sectionKey === "productSection") {
      setConfig((prev) => {
        const updated = [...prev.productSections];
        if (updated[sectionIdx]) {
          updated[sectionIdx] = {
            ...updated[sectionIdx],
            buttons: (updated[sectionIdx].buttons || []).map((b) =>
              b.id === btnId ? { ...b, ...updates } : b
            ),
          };
        }
        return { ...prev, productSections: updated };
      });
    }
  };

  const removeButton = (
    sectionKey: "hero" | "categories" | "editorial" | "productSection",
    btnId: string,
    sectionIdx = 0
  ) => {
    if (sectionKey === "hero") {
      setConfig((prev) => ({
        ...prev,
        hero: { ...prev.hero, buttons: prev.hero.buttons.filter((b) => b.id !== btnId) },
      }));
    } else if (sectionKey === "categories") {
      setConfig((prev) => ({
        ...prev,
        categorySection: {
          ...prev.categorySection,
          buttons: (prev.categorySection.buttons || []).filter((b) => b.id !== btnId),
        },
      }));
    } else if (sectionKey === "editorial") {
      setConfig((prev) => ({
        ...prev,
        editorialSection: {
          ...prev.editorialSection,
          buttons: prev.editorialSection.buttons.filter((b) => b.id !== btnId),
        },
      }));
    } else if (sectionKey === "productSection") {
      setConfig((prev) => {
        const updated = [...prev.productSections];
        if (updated[sectionIdx]) {
          updated[sectionIdx] = {
            ...updated[sectionIdx],
            buttons: (updated[sectionIdx].buttons || []).filter((b) => b.id !== btnId),
          };
        }
        return { ...prev, productSections: updated };
      });
    }
  };

  // --- DYNAMIC PRODUCT SECTIONS HELPERS ---
  const addNewProductSection = () => {
    const newSec: ProductSectionConfig = {
      id: "section_" + Date.now().toString(36),
      title: "New Product Section",
      subtitle: "Curated collection",
      layout: "scroll",
      buttons: [
        { id: "btn_" + Date.now().toString(36), label: "View All", url: "/products", style: "link", isHidden: false },
      ],
      products: [],
      isHidden: false,
    };
    setConfig((prev) => ({
      ...prev,
      productSections: [...prev.productSections, newSec],
    }));
    setSelectedProdSecIdx(config.productSections.length);
    showToast("New product section added", "success");
  };

  const removeProductSection = (secIdx: number) => {
    if (confirm("Are you sure you want to remove this entire section from the homepage? (No products will be deleted from catalog)")) {
      setConfig((prev) => ({
        ...prev,
        productSections: prev.productSections.filter((_, idx) => idx !== secIdx),
      }));
      setSelectedProdSecIdx((prev) => Math.max(0, prev - 1));
      showToast("Section removed", "success");
    }
  };

  const moveProductSection = (fromIdx: number, direction: "up" | "down") => {
    const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= config.productSections.length) return;
    setConfig((prev) => {
      const copy = [...prev.productSections];
      const temp = copy[fromIdx];
      copy[fromIdx] = copy[toIdx];
      copy[toIdx] = temp;
      return { ...prev, productSections: copy };
    });
    setSelectedProdSecIdx(toIdx);
  };

  // --- PRODUCT MANAGEMENT WITHIN A SECTION ---
  const addProductToActiveSection = (productId: string) => {
    const sec = config.productSections[selectedProdSecIdx];
    if (!sec) return;
    if (sec.products.some((p) => p.productId === productId)) {
      showToast("Product is already added to this section", "error");
      return;
    }
    setConfig((prev) => {
      const updated = [...prev.productSections];
      updated[selectedProdSecIdx] = {
        ...updated[selectedProdSecIdx],
        products: [...updated[selectedProdSecIdx].products, { productId, isHidden: false }],
      };
      return { ...prev, productSections: updated };
    });
    showToast("Product added to section", "success");
  };

  const toggleProductHiddenInSection = (pIdx: number) => {
    setConfig((prev) => {
      const updated = [...prev.productSections];
      const sec = updated[selectedProdSecIdx];
      if (!sec) return prev;
      const prods = [...sec.products];
      prods[pIdx] = { ...prods[pIdx], isHidden: !prods[pIdx].isHidden };
      updated[selectedProdSecIdx] = { ...sec, products: prods };
      return { ...prev, productSections: updated };
    });
  };

  const removeProductFromSection = (pIdx: number) => {
    setConfig((prev) => {
      const updated = [...prev.productSections];
      const sec = updated[selectedProdSecIdx];
      if (!sec) return prev;
      const prods = sec.products.filter((_, idx) => idx !== pIdx);
      updated[selectedProdSecIdx] = { ...sec, products: prods };
      return { ...prev, productSections: updated };
    });
    showToast("Product unlinked from this section (kept in global catalog)", "success");
  };

  const deleteProductPermanently = async (productId: string, productName: string) => {
    if (
      !confirm(
        `⚠️ WARNING: Delete "${productName}" PERMANENTLY from the entire database?\n\nThis will remove it from all sections, search, catalog, and inventory. This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast(`Product "${productName}" deleted from database`, "success");
        // Remove from all sections in state
        setConfig((prev) => ({
          ...prev,
          productSections: prev.productSections.map((sec) => ({
            ...sec,
            products: sec.products.filter((p) => p.productId !== productId),
          })),
        }));
        await onRefreshProducts();
      } else {
        showToast("Failed to delete product from database", "error");
      }
    } catch (err) {
      showToast("Error deleting product", "error");
    }
  };

  const moveProductInSection = (fromIdx: number, direction: "up" | "down") => {
    const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
    const sec = config.productSections[selectedProdSecIdx];
    if (!sec || toIdx < 0 || toIdx >= sec.products.length) return;
    setConfig((prev) => {
      const updated = [...prev.productSections];
      const prods = [...updated[selectedProdSecIdx].products];
      const temp = prods[fromIdx];
      prods[fromIdx] = prods[toIdx];
      prods[toIdx] = temp;
      updated[selectedProdSecIdx] = { ...updated[selectedProdSecIdx], products: prods };
      return { ...prev, productSections: updated };
    });
  };

  // --- QUICK CREATE PRODUCT DIRECTLY INTO GLOBAL DB & SECTION ---
  const handleQuickCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice.trim()) {
      showToast("Product name and price are required", "error");
      return;
    }

    try {
      setCreatingProduct(true);
      const res = await authFetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProdName.trim(),
          category: newProdCategory,
          price: Number(newProdPrice),
          hero: newProdHero.trim() || "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789376228/ChatGPT_Image_Sep_14_2026_01_04_47_AM.png",
          description: newProdDesc.trim() || `${newProdName.trim()} built for everyday comfort.`,
          gallery: newProdHero.trim() ? [newProdHero.trim()] : [],
          sizes: newProdCategory === "crocs" ? ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"] : ["28", "30", "32", "34", "36", "38"],
          colors: [{ name: "Standard", hex: "#111111" }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdProd = data.product;
        showToast(`Created product "${createdProd.name}" globally!`, "success");
        await onRefreshProducts();

        // Add to active section
        if (createdProd && createdProd.id) {
          addProductToActiveSection(createdProd.id);
        }

        // Reset form
        setNewProdName("");
        setNewProdPrice("");
        setNewProdHero("");
        setNewProdDesc("");
        setIsCreateProductModalOpen(false);
      } else {
        const errData = await res.json();
        showToast(errData.error || "Failed to create product", "error");
      }
    } catch (err) {
      showToast("Error creating product", "error");
    } finally {
      setCreatingProduct(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--admin-text-soft)" }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Loading Home Page Configuration...</div>
        <p style={{ fontSize: 13, opacity: 0.7 }}>Fetching images, layout blocks, and section data.</p>
      </div>
    );
  }

  const currentProductSection = config.productSections[selectedProdSecIdx] || config.productSections[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER CONTROLS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--admin-surface)",
          padding: "16px 20px",
          borderRadius: 8,
          border: "1px solid var(--admin-border)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Homepage Visual &amp; Section Manager</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--admin-text-soft)" }}>
            Customize all images, banners, dynamic product sections, and CTA buttons on the storefront.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/"
            target="_blank"
            className="btn btn-secondary"
            style={{
              padding: "8px 14px",
              fontSize: 13,
              borderRadius: 6,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>View Live Site</span> ↗
          </Link>
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary"
            style={{ padding: "8px 14px", fontSize: 13, borderRadius: 6 }}
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 6,
              background: "var(--accent, #C8FF00)",
              color: "#111",
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* SECTION SELECTOR TABS */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid var(--admin-border)",
          paddingBottom: 4,
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSectionTab("hero")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: "6px 6px 0 0",
            border: "none",
            cursor: "pointer",
            background: activeSectionTab === "hero" ? "var(--admin-surface)" : "transparent",
            color: activeSectionTab === "hero" ? "var(--accent, #C8FF00)" : "var(--admin-text-soft)",
            borderBottom: activeSectionTab === "hero" ? "2px solid var(--accent, #C8FF00)" : "2px solid transparent",
          }}
        >
          1. Hero Banner
        </button>

        <button
          type="button"
          onClick={() => setActiveSectionTab("productSections")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: "6px 6px 0 0",
            border: "none",
            cursor: "pointer",
            background: activeSectionTab === "productSections" ? "var(--admin-surface)" : "transparent",
            color: activeSectionTab === "productSections" ? "var(--accent, #C8FF00)" : "var(--admin-text-soft)",
            borderBottom: activeSectionTab === "productSections" ? "2px solid var(--accent, #C8FF00)" : "2px solid transparent",
          }}
        >
          2. Product Sections ({config.productSections.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSectionTab("categories")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: "6px 6px 0 0",
            border: "none",
            cursor: "pointer",
            background: activeSectionTab === "categories" ? "var(--admin-surface)" : "transparent",
            color: activeSectionTab === "categories" ? "var(--accent, #C8FF00)" : "var(--admin-text-soft)",
            borderBottom: activeSectionTab === "categories" ? "2px solid var(--accent, #C8FF00)" : "2px solid transparent",
          }}
        >
          3. Shop by Category (Block A)
        </button>

        <button
          type="button"
          onClick={() => setActiveSectionTab("marquee")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: "6px 6px 0 0",
            border: "none",
            cursor: "pointer",
            background: activeSectionTab === "marquee" ? "var(--admin-surface)" : "transparent",
            color: activeSectionTab === "marquee" ? "var(--accent, #C8FF00)" : "var(--admin-text-soft)",
            borderBottom: activeSectionTab === "marquee" ? "2px solid var(--accent, #C8FF00)" : "2px solid transparent",
          }}
        >
          4. Scrolling Marquee Banner
        </button>

        <button
          type="button"
          onClick={() => setActiveSectionTab("promo")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: "6px 6px 0 0",
            border: "none",
            cursor: "pointer",
            background: activeSectionTab === "promo" ? "var(--admin-surface)" : "transparent",
            color: activeSectionTab === "promo" ? "var(--accent, #C8FF00)" : "var(--admin-text-soft)",
            borderBottom: activeSectionTab === "promo" ? "2px solid var(--accent, #C8FF00)" : "2px solid transparent",
          }}
        >
          5. Promo Showcase (Block B - 4 Tiles)
        </button>

        <button
          type="button"
          onClick={() => setActiveSectionTab("editorial")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: "6px 6px 0 0",
            border: "none",
            cursor: "pointer",
            background: activeSectionTab === "editorial" ? "var(--admin-surface)" : "transparent",
            color: activeSectionTab === "editorial" ? "var(--accent, #C8FF00)" : "var(--admin-text-soft)",
            borderBottom: activeSectionTab === "editorial" ? "2px solid var(--accent, #C8FF00)" : "2px solid transparent",
          }}
        >
          6. Editorial Footer Banner
        </button>
      </div>

      {/* --- TAB 1: HERO SECTION MANAGER --- */}
      {activeSectionTab === "hero" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "var(--admin-surface)",
              padding: 24,
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Hero Typography &amp; Headlines</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--admin-text-soft)" }}>
                  Top banner text, eyebrow badges, and main headline.
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!config.hero.isHidden}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, hero: { ...prev.hero, isHidden: !e.target.checked } }))
                  }
                />
                <span>Section Visible on Homepage</span>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Eyebrow Accent Word (e.g. Comfort)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={config.hero.eyebrowPart1}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, eyebrowPart1: e.target.value },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Eyebrow Divider (e.g. x)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={config.hero.eyebrowDivider}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, eyebrowDivider: e.target.value },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Eyebrow Light Word (e.g. Style)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={config.hero.eyebrowPart2}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, eyebrowPart2: e.target.value },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Hero Main Title
              </label>
              <input
                type="text"
                className="form-input"
                value={config.hero.title}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    hero: { ...prev.hero, title: e.target.value },
                  }))
                }
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit", fontWeight: 700 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Hero Subtext / Description
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={config.hero.subtext}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    hero: { ...prev.hero, subtext: e.target.value },
                  }))
                }
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
              />
            </div>

            {/* HERO CTA BUTTONS */}
            <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Hero Call-to-Action Buttons</h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--admin-text-soft)" }}>
                    Add or remove action buttons displayed in the hero section.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addButtonToSection("hero")}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6 }}
                >
                  + Add Hero Button
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {config.hero.buttons.map((btn, bIdx) => (
                  <div
                    key={btn.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      background: "var(--admin-bg)",
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid var(--admin-border)",
                      opacity: btn.isHidden ? 0.6 : 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 140, flex: "1 1 140px" }}>
                      <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block" }}>Label</label>
                      <input
                        type="text"
                        value={btn.label}
                        onChange={(e) => updateButton("hero", btn.id, { label: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                      />
                    </div>

                    <div style={{ minWidth: 160, flex: "2 1 160px" }}>
                      <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block" }}>Link URL</label>
                      <input
                        type="text"
                        value={btn.url}
                        onChange={(e) => updateButton("hero", btn.id, { url: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                      />
                    </div>

                    <div style={{ width: 120 }}>
                      <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block" }}>Style</label>
                      <select
                        value={btn.style || "outline"}
                        onChange={(e) => updateButton("hero", btn.id, { style: e.target.value as any })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                      >
                        <option value="outline">Outline</option>
                        <option value="filled">Filled White</option>
                        <option value="lime">Filled Lime</option>
                        <option value="primary">Primary</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 6, alignItems: "center", paddingTop: 16 }}>
                      <button
                        type="button"
                        onClick={() => updateButton("hero", btn.id, { isHidden: !btn.isHidden })}
                        title={btn.isHidden ? "Unhide button" : "Hide button"}
                        style={{
                          background: btn.isHidden ? "#444" : "var(--admin-surface)",
                          border: "1px solid var(--admin-border)",
                          borderRadius: 4,
                          padding: "6px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                          color: "inherit",
                        }}
                      >
                        {btn.isHidden ? "Hidden 👁️‍🗨️" : "Visible 👁️"}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeButton("hero", btn.id)}
                        title="Remove button completely"
                        style={{
                          background: "none",
                          border: "1px solid #721c24",
                          color: "#ff6b6b",
                          borderRadius: 4,
                          padding: "6px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: PRODUCT SECTIONS MANAGER --- */}
      {activeSectionTab === "productSections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* SECTION CONTROLS & PICKER */}
          <div
            style={{
              background: "var(--admin-surface)",
              padding: 20,
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Product Sections on Homepage</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--admin-text-soft)" }}>
                  Create and manage carousel rows or grids. Add existing or brand-new products to each section.
                </p>
              </div>
              <button
                type="button"
                onClick={addNewProductSection}
                className="btn btn-primary"
                style={{
                  background: "var(--accent, #C8FF00)",
                  color: "#111",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                + Add New Product Section
              </button>
            </div>

            {/* SECTIONS TABS */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
              {config.productSections.map((sec, sIdx) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSelectedProdSecIdx(sIdx)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: selectedProdSecIdx === sIdx ? "1px solid var(--accent, #C8FF00)" : "1px solid var(--admin-border)",
                    background: selectedProdSecIdx === sIdx ? "var(--admin-bg)" : "transparent",
                    color: selectedProdSecIdx === sIdx ? "var(--accent, #C8FF00)" : "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>{sec.title || `Section ${sIdx + 1}`}</span>
                  {sec.isHidden && <span style={{ fontSize: 10, opacity: 0.6 }}>(Hidden)</span>}
                  <span style={{ fontSize: 11, background: "var(--admin-surface)", padding: "2px 6px", borderRadius: 10 }}>
                    {sec.products.length} products
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ACTIVE SECTION DETAILS */}
          {currentProductSection && (
            <div
              style={{
                background: "var(--admin-surface)",
                padding: 24,
                borderRadius: 8,
                border: "1px solid var(--admin-border)",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* SECTION HEADER SETTINGS */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                        Section Title
                      </label>
                      <input
                        type="text"
                        value={currentProductSection.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig((prev) => {
                            const updated = [...prev.productSections];
                            updated[selectedProdSecIdx] = { ...updated[selectedProdSecIdx], title: val };
                            return { ...prev, productSections: updated };
                          });
                        }}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit", fontWeight: 700 }}
                      />
                    </div>

                    <div style={{ width: 140 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                        Layout
                      </label>
                      <select
                        value={currentProductSection.layout || "scroll"}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setConfig((prev) => {
                            const updated = [...prev.productSections];
                            updated[selectedProdSecIdx] = { ...updated[selectedProdSecIdx], layout: val };
                            return { ...prev, productSections: updated };
                          });
                        }}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                      >
                        <option value="scroll">Horizontal Scroll</option>
                        <option value="grid">Grid</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Section Subtitle / Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={currentProductSection.subtitle || ""}
                      placeholder="e.g. Handpicked favorites for you"
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfig((prev) => {
                          const updated = [...prev.productSections];
                          updated[selectedProdSecIdx] = { ...updated[selectedProdSecIdx], subtitle: val };
                          return { ...prev, productSections: updated };
                        });
                      }}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => moveProductSection(selectedProdSecIdx, "up")}
                      disabled={selectedProdSecIdx === 0}
                      style={{ padding: "6px 10px", borderRadius: 4, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit", cursor: selectedProdSecIdx === 0 ? "not-allowed" : "pointer" }}
                      title="Move Section Up"
                    >
                      ▲ Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveProductSection(selectedProdSecIdx, "down")}
                      disabled={selectedProdSecIdx === config.productSections.length - 1}
                      style={{ padding: "6px 10px", borderRadius: 4, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit", cursor: selectedProdSecIdx === config.productSections.length - 1 ? "not-allowed" : "pointer" }}
                      title="Move Section Down"
                    >
                      ▼ Down
                    </button>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!currentProductSection.isHidden}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConfig((prev) => {
                          const updated = [...prev.productSections];
                          updated[selectedProdSecIdx] = { ...updated[selectedProdSecIdx], isHidden: !checked };
                          return { ...prev, productSections: updated };
                        });
                      }}
                    />
                    <span>Section Visible</span>
                  </label>

                  {config.productSections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProductSection(selectedProdSecIdx)}
                      style={{ color: "#ff6b6b", background: "none", border: "none", fontSize: 12, cursor: "pointer", padding: "4px 0" }}
                    >
                      Delete Section Completely
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION BUTTONS */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Section Action Buttons (e.g. View All)</h4>
                  <button
                    type="button"
                    onClick={() => addButtonToSection("productSection", selectedProdSecIdx)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit", cursor: "pointer" }}
                  >
                    + Add Section Button
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(currentProductSection.buttons || []).map((btn) => (
                    <div
                      key={btn.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        background: "var(--admin-bg)",
                        padding: 8,
                        borderRadius: 6,
                        border: "1px solid var(--admin-border)",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Button Label"
                        value={btn.label}
                        onChange={(e) => updateButton("productSection", btn.id, { label: e.target.value }, selectedProdSecIdx)}
                        style={{ flex: 1, minWidth: 120, padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                      />
                      <input
                        type="text"
                        placeholder="Link URL (/products...)"
                        value={btn.url}
                        onChange={(e) => updateButton("productSection", btn.id, { url: e.target.value }, selectedProdSecIdx)}
                        style={{ flex: 2, minWidth: 140, padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                      />
                      <button
                        type="button"
                        onClick={() => updateButton("productSection", btn.id, { isHidden: !btn.isHidden }, selectedProdSecIdx)}
                        style={{ fontSize: 11, padding: "4px 8px", borderRadius: 4, background: btn.isHidden ? "#444" : "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit" }}
                      >
                        {btn.isHidden ? "Hidden 👁️‍🗨️" : "Visible 👁️"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeButton("productSection", btn.id, selectedProdSecIdx)}
                        style={{ fontSize: 11, padding: "4px 8px", borderRadius: 4, background: "none", border: "1px solid #721c24", color: "#ff6b6b", cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRODUCTS IN THIS SECTION */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Products in &ldquo;{currentProductSection.title}&rdquo;</h4>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--admin-text-soft)" }}>
                      {currentProductSection.products.length === 0
                        ? "Currently showing first 10 products from catalog automatically. Add specific products below to curate this section."
                        : `Showing ${currentProductSection.products.length} curated products.`}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setIsAddProductModalOpen(true)}
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6 }}
                    >
                      + Add Existing Product
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreateProductModalOpen(true)}
                      className="btn btn-primary"
                      style={{
                        background: "var(--accent, #C8FF00)",
                        color: "#111",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "6px 12px",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      + Quick Create Product
                    </button>
                  </div>
                </div>

                {/* PRODUCT LIST */}
                {currentProductSection.products.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", background: "var(--admin-bg)", borderRadius: 6, color: "var(--admin-text-soft)", fontSize: 13 }}>
                    No specific products pinned. Click <strong>&quot;+ Add Existing Product&quot;</strong> or <strong>&quot;+ Quick Create Product&quot;</strong> to choose products for this section.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {currentProductSection.products.map((item, pIdx) => {
                      const prod = productMap.get(item.productId);
                      return (
                        <div
                          key={item.productId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            background: "var(--admin-bg)",
                            padding: "10px 14px",
                            borderRadius: 6,
                            border: "1px solid var(--admin-border)",
                            opacity: item.isHidden ? 0.6 : 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 4,
                                background: "#222",
                                overflow: "hidden",
                                flexShrink: 0,
                              }}
                            >
                              {prod?.hero ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={prod.hero}
                                  alt=""
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 10, color: "#888" }}>
                                  No img
                                </div>
                              )}
                            </div>

                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {prod ? prod.name : `Product ID: ${item.productId}`}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--admin-text-soft)" }}>
                                {prod ? `PKR ${prod.price.toLocaleString()} · ${prod.category} · SKU: ${prod.sku}` : "Not found in database"}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Reordering */}
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => moveProductInSection(pIdx, "up")}
                                disabled={pIdx === 0}
                                style={{ padding: "4px 8px", fontSize: 10, borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", cursor: pIdx === 0 ? "not-allowed" : "pointer" }}
                                title="Move up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => moveProductInSection(pIdx, "down")}
                                disabled={pIdx === currentProductSection.products.length - 1}
                                style={{ padding: "4px 8px", fontSize: 10, borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", cursor: pIdx === currentProductSection.products.length - 1 ? "not-allowed" : "pointer" }}
                                title="Move down"
                              >
                                ▼
                              </button>
                            </div>

                            {/* Hide / Show in section */}
                            <button
                              type="button"
                              onClick={() => toggleProductHiddenInSection(pIdx)}
                              style={{
                                padding: "5px 10px",
                                fontSize: 11,
                                borderRadius: 4,
                                background: item.isHidden ? "#444" : "var(--admin-surface)",
                                border: "1px solid var(--admin-border)",
                                color: "inherit",
                                cursor: "pointer",
                              }}
                              title="Toggle visibility in this section"
                            >
                              {item.isHidden ? "Hidden from Home 👁️‍🗨️" : "Visible 👁️"}
                            </button>

                            {/* Remove from section (unlinks from section, stays in DB) */}
                            <button
                              type="button"
                              onClick={() => removeProductFromSection(pIdx)}
                              style={{
                                padding: "5px 10px",
                                fontSize: 11,
                                borderRadius: 4,
                                background: "var(--admin-surface)",
                                border: "1px solid var(--admin-border)",
                                color: "var(--admin-text-soft)",
                                cursor: "pointer",
                              }}
                              title="Unlink product from this section without deleting from database"
                            >
                              Remove from Section
                            </button>

                            {/* Delete permanently from DB */}
                            {prod && (
                              <button
                                type="button"
                                onClick={() => deleteProductPermanently(prod.id, prod.name)}
                                style={{
                                  padding: "5px 10px",
                                  fontSize: 11,
                                  borderRadius: 4,
                                  background: "none",
                                  border: "1px solid #721c24",
                                  color: "#ff6b6b",
                                  cursor: "pointer",
                                }}
                                title="Delete product completely from the database"
                              >
                                Delete from DB
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: CATEGORIES (BLOCK A) --- */}
      {activeSectionTab === "categories" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "var(--admin-surface)",
              padding: 24,
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Shop by Category Showcase (Block A)</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--admin-text-soft)" }}>
                  Manage category card images, labels, badges (e.g. &quot;Coming Soon&quot;), and links.
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!config.categorySection.isHidden}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      categorySection: { ...prev.categorySection, isHidden: !e.target.checked },
                    }))
                  }
                />
                <span>Section Visible</span>
              </label>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Section Title
              </label>
              <input
                type="text"
                value={config.categorySection.title}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    categorySection: { ...prev.categorySection, title: e.target.value },
                  }))
                }
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
              />
            </div>

            {/* CATEGORY TILES LIST */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
              {config.categorySection.tiles.map((tile, tIdx) => (
                <div
                  key={tile.id}
                  style={{
                    background: "var(--admin-bg)",
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid var(--admin-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    opacity: tile.isHidden ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Category Tile #{tIdx + 1}: {tile.title}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!tile.isHidden}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfig((prev) => {
                            const tiles = [...prev.categorySection.tiles];
                            tiles[tIdx] = { ...tiles[tIdx], isHidden: !checked };
                            return { ...prev, categorySection: { ...prev.categorySection, tiles } };
                          });
                        }}
                      />
                      <span>Visible</span>
                    </label>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                      Tile Image URL
                    </label>
                    <ImageField
                      value={tile.image}
                      spec={IMAGE_SPECS.categoryTile}
                      onChange={(newUrl) => {
                        setConfig((prev) => {
                          const tiles = [...prev.categorySection.tiles];
                          tiles[tIdx] = { ...tiles[tIdx], image: newUrl };
                          return { ...prev, categorySection: { ...prev.categorySection, tiles } };
                        });
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                        Title
                      </label>
                      <input
                        type="text"
                        value={tile.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig((prev) => {
                            const tiles = [...prev.categorySection.tiles];
                            tiles[tIdx] = { ...tiles[tIdx], title: val };
                            return { ...prev, categorySection: { ...prev.categorySection, tiles } };
                          });
                        }}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                        Badge (e.g. Coming Soon)
                      </label>
                      <input
                        type="text"
                        value={tile.badge || ""}
                        placeholder="Leave empty for none"
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig((prev) => {
                            const tiles = [...prev.categorySection.tiles];
                            tiles[tIdx] = { ...tiles[tIdx], badge: val };
                            return { ...prev, categorySection: { ...prev.categorySection, tiles } };
                          });
                        }}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                      Link Destination
                    </label>
                    <input
                      type="text"
                      value={tile.link}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfig((prev) => {
                          const tiles = [...prev.categorySection.tiles];
                          tiles[tIdx] = { ...tiles[tIdx], link: val };
                          return { ...prev, categorySection: { ...prev.categorySection, tiles } };
                        });
                      }}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: SCROLLING MARQUEE BANNER --- */}
      {activeSectionTab === "marquee" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "var(--admin-surface)",
              padding: 24,
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Scrolling Features Marquee Banner</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--admin-text-soft)" }}>
                  Continuous animated ticker placed directly below the Shop by Category section.
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!config.scrollingBanner?.isHidden}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      scrollingBanner: {
                        ...(prev.scrollingBanner || DEFAULT_HOMEPAGE_CONFIG.scrollingBanner),
                        isHidden: !e.target.checked,
                      },
                    }))
                  }
                />
                <span>Section Visible on Homepage</span>
              </label>
            </div>

            {/* LIVE PREVIEW */}
            <div style={{ marginBottom: 24, padding: "16px 0", background: "var(--admin-bg)", borderRadius: 6, border: "1px solid var(--admin-border)", overflow: "hidden" }}>
              <div style={{ padding: "0 16px 8px 16px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-soft)", textTransform: "uppercase" }}>
                Live Preview
              </div>
              <div
                className={`scrolling-marquee-container marquee-bg-${config.scrollingBanner?.bgStyle || "off-white"}`}
                style={{ margin: 0, padding: "12px 0" }}
              >
                <div
                  className="scrolling-marquee-track"
                  style={{ animationDuration: `${config.scrollingBanner?.speedSeconds || 48}s` }}
                >
                  <div className="scrolling-marquee-content">
                    {(config.scrollingBanner?.items || DEFAULT_HOMEPAGE_CONFIG.scrollingBanner.items).map((item, idx) => (
                      <React.Fragment key={idx}>
                        <span className="marquee-item-text">{item}</span>
                        <span className="marquee-item-separator">{config.scrollingBanner?.separator || "✦"}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="scrolling-marquee-content" aria-hidden="true">
                    {(config.scrollingBanner?.items || DEFAULT_HOMEPAGE_CONFIG.scrollingBanner.items).map((item, idx) => (
                      <React.Fragment key={idx}>
                        <span className="marquee-item-text">{item}</span>
                        <span className="marquee-item-separator">{config.scrollingBanner?.separator || "✦"}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* MARQUEE SETTINGS FORM */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Separator Symbol
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={config.scrollingBanner?.separator || "✦"}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      scrollingBanner: {
                        ...(prev.scrollingBanner || DEFAULT_HOMEPAGE_CONFIG.scrollingBanner),
                        separator: e.target.value,
                      },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Scroll Speed (Seconds: {config.scrollingBanner?.speedSeconds || 48}s)
                </label>
                <input
                  type="number"
                  min={10}
                  max={90}
                  className="form-input"
                  value={config.scrollingBanner?.speedSeconds || 48}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      scrollingBanner: {
                        ...(prev.scrollingBanner || DEFAULT_HOMEPAGE_CONFIG.scrollingBanner),
                        speedSeconds: Number(e.target.value) || 48,
                      },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Background Theme
                </label>
                <select
                  className="form-input"
                  value={config.scrollingBanner?.bgStyle || "off-white"}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      scrollingBanner: {
                        ...(prev.scrollingBanner || DEFAULT_HOMEPAGE_CONFIG.scrollingBanner),
                        bgStyle: e.target.value as "off-white" | "dark" | "lime",
                      },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                >
                  <option value="off-white">Off-White / Cream (Brand Default)</option>
                  <option value="dark">Dark / Charcoal</option>
                  <option value="lime">Lime Accent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Banner Words &amp; Highlight Features (Comma Separated)
              </label>
              <textarea
                rows={3}
                className="form-input"
                value={(config.scrollingBanner?.items || DEFAULT_HOMEPAGE_CONFIG.scrollingBanner.items).join(", ")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const splitted = raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
                  setConfig((prev) => ({
                    ...prev,
                    scrollingBanner: {
                      ...(prev.scrollingBanner || DEFAULT_HOMEPAGE_CONFIG.scrollingBanner),
                      items: splitted.length > 0 ? splitted : [raw.toUpperCase()],
                    },
                  }));
                }}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit", fontFamily: "monospace" }}
              />
              <span style={{ fontSize: 11.5, color: "var(--admin-text-soft)", marginTop: 4, display: "block" }}>
                Type phrases separated by commas. Each phrase will automatically be spaced with the separator symbol.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 5: PROMO SHOWCASE (BLOCK B - 4 TILES) --- */}
      {activeSectionTab === "promo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "var(--admin-surface)",
              padding: 24,
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Promo / Brand Showcase (Block B - 2x2 Grid)</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--admin-text-soft)" }}>
                  Change images, quotes, and typography on the 4 promotional tiles.
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!config.promoSection.isHidden}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      promoSection: { ...prev.promoSection, isHidden: !e.target.checked },
                    }))
                  }
                />
                <span>Section Visible</span>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
              {config.promoSection.tiles.map((tile, pIdx) => (
                <div
                  key={tile.id}
                  style={{
                    background: "var(--admin-bg)",
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid var(--admin-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    opacity: tile.isHidden ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      Tile #{pIdx + 1} ({tile.type.toUpperCase()})
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!tile.isHidden}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfig((prev) => {
                            const tiles = [...prev.promoSection.tiles];
                            tiles[pIdx] = { ...tiles[pIdx], isHidden: !checked };
                            return { ...prev, promoSection: { ...prev.promoSection, tiles } };
                          });
                        }}
                      />
                      <span>Visible</span>
                    </label>
                  </div>

                  {/* If tile has an image */}
                  {tile.type === "image" && (
                    <div>
                      <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                        Background Image
                      </label>
                      <ImageField
                        value={tile.image || ""}
                        spec={IMAGE_SPECS.promoTile}
                        onChange={(newUrl) => {
                          setConfig((prev) => {
                            const tiles = [...prev.promoSection.tiles];
                            tiles[pIdx] = { ...tiles[pIdx], image: newUrl };
                            return { ...prev, promoSection: { ...prev.promoSection, tiles } };
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* Tile 1: Brand card */}
                  {tile.type === "dark" && (
                    <>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                          Brand Name
                        </label>
                        <input
                          type="text"
                          value={tile.brand || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig((prev) => {
                              const tiles = [...prev.promoSection.tiles];
                              tiles[pIdx] = { ...tiles[pIdx], brand: val };
                              return { ...prev, promoSection: { ...prev.promoSection, tiles } };
                            });
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                          Subtext
                        </label>
                        <input
                          type="text"
                          value={tile.sub || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig((prev) => {
                              const tiles = [...prev.promoSection.tiles];
                              tiles[pIdx] = { ...tiles[pIdx], sub: val };
                              return { ...prev, promoSection: { ...prev.promoSection, tiles } };
                            });
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                        />
                      </div>
                    </>
                  )}

                  {/* Tile 2, 3, 4: Line 1 & Line 2 */}
                  {(tile.type === "image" || tile.type === "lime") && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                          Heading Line 1
                        </label>
                        <input
                          type="text"
                          value={tile.line1 || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig((prev) => {
                              const tiles = [...prev.promoSection.tiles];
                              tiles[pIdx] = { ...tiles[pIdx], line1: val };
                              return { ...prev, promoSection: { ...prev.promoSection, tiles } };
                            });
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--admin-text-soft)", display: "block", marginBottom: 4 }}>
                          Heading Line 2
                        </label>
                        <input
                          type="text"
                          value={tile.line2 || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig((prev) => {
                              const tiles = [...prev.promoSection.tiles];
                              tiles[pIdx] = { ...tiles[pIdx], line2: val };
                              return { ...prev, promoSection: { ...prev.promoSection, tiles } };
                            });
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 5: EDITORIAL FOOTER BANNER --- */}
      {activeSectionTab === "editorial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "var(--admin-surface)",
              padding: 24,
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Editorial Banner (Bottom of Homepage)</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--admin-text-soft)" }}>
                  Large editorial callout before the footer.
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!config.editorialSection.isHidden}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      editorialSection: { ...prev.editorialSection, isHidden: !e.target.checked },
                    }))
                  }
                />
                <span>Section Visible</span>
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Headline
              </label>
              <input
                type="text"
                value={config.editorialSection.title}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    editorialSection: { ...prev.editorialSection, title: e.target.value },
                  }))
                }
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit", fontWeight: 700 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Body Text
              </label>
              <textarea
                rows={3}
                value={config.editorialSection.text}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    editorialSection: { ...prev.editorialSection, text: e.target.value },
                  }))
                }
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
              />
            </div>

            {/* BUTTONS */}
            <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Banner Action Buttons</h4>
                <button
                  type="button"
                  onClick={() => addButtonToSection("editorial")}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit", cursor: "pointer" }}
                >
                  + Add Banner Button
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {config.editorialSection.buttons.map((btn) => (
                  <div
                    key={btn.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      background: "var(--admin-bg)",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--admin-border)",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Button Label"
                      value={btn.label}
                      onChange={(e) => updateButton("editorial", btn.id, { label: e.target.value })}
                      style={{ flex: 1, minWidth: 140, padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                    />
                    <input
                      type="text"
                      placeholder="Link URL"
                      value={btn.url}
                      onChange={(e) => updateButton("editorial", btn.id, { url: e.target.value })}
                      style={{ flex: 2, minWidth: 160, padding: "6px 8px", borderRadius: 4, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit", fontSize: 12 }}
                    />
                    <button
                      type="button"
                      onClick={() => updateButton("editorial", btn.id, { isHidden: !btn.isHidden })}
                      style={{ fontSize: 11, padding: "4px 8px", borderRadius: 4, background: btn.isHidden ? "#444" : "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "inherit" }}
                    >
                      {btn.isHidden ? "Hidden 👁️‍🗨️" : "Visible 👁️"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeButton("editorial", btn.id)}
                      style={{ fontSize: 11, padding: "4px 8px", borderRadius: 4, background: "none", border: "1px solid #721c24", color: "#ff6b6b", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD EXISTING PRODUCT TO SECTION --- */}
      {isAddProductModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setIsAddProductModalOpen(false)}
        >
          <div
            style={{
              background: "var(--admin-surface)",
              width: "100%",
              maxWidth: 600,
              maxHeight: "85vh",
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--admin-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Select Product from Catalog</h3>
              <button
                type="button"
                onClick={() => setIsAddProductModalOpen(false)}
                style={{ background: "none", border: "none", color: "inherit", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 16, borderBottom: "1px solid var(--admin-border)" }}>
              <input
                type="text"
                placeholder="Search products by name, SKU, or category..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "var(--admin-bg)",
                  border: "1px solid var(--admin-border)",
                  color: "inherit",
                  fontSize: 13,
                }}
                autoFocus
              />
            </div>

            <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {allProducts
                .filter(
                  (p) =>
                    p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                    p.sku.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                    p.category.toLowerCase().includes(productSearchQuery.toLowerCase())
                )
                .map((p) => {
                  const alreadyAdded = currentProductSection?.products.some((item) => item.productId === p.id);
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 10,
                        borderRadius: 6,
                        background: "var(--admin-bg)",
                        border: "1px solid var(--admin-border)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 4, background: "#222", overflow: "hidden", flexShrink: 0 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.hero} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "var(--admin-text-soft)" }}>
                            PKR {p.price.toLocaleString()} · {p.category} · {p.sku}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => {
                          addProductToActiveSection(p.id);
                          setIsAddProductModalOpen(false);
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: alreadyAdded ? "default" : "pointer",
                          background: alreadyAdded ? "#333" : "var(--accent, #C8FF00)",
                          color: alreadyAdded ? "#888" : "#111",
                          border: "none",
                        }}
                      >
                        {alreadyAdded ? "Already Added" : "Add to Section"}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: QUICK CREATE PRODUCT GLOBALLY --- */}
      {isCreateProductModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setIsCreateProductModalOpen(false)}
        >
          <form
            onSubmit={handleQuickCreateProduct}
            style={{
              background: "var(--admin-surface)",
              width: "100%",
              maxWidth: 540,
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--admin-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Quick Create Global Product</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "var(--admin-text-soft)" }}>
                  Creates product in shared database and attaches it to &quot;{currentProductSection?.title}&quot;.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateProductModalOpen(false)}
                style={{ background: "none", border: "none", color: "inherit", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Classic Clog in White"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Category *
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                  >
                    <option value="crocs">Crocs</option>
                    <option value="trousers">Trousers</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Price (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="7499"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Main Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/... or cloudinary"
                  value={newProdHero}
                  onChange={(e) => setNewProdHero(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Product description and details..."
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "inherit" }}
                />
              </div>
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--admin-border)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--admin-bg)" }}>
              <button
                type="button"
                onClick={() => setIsCreateProductModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingProduct}
                className="btn btn-primary"
                style={{
                  background: "var(--accent, #C8FF00)",
                  color: "#111",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "6px 16px",
                  borderRadius: 6,
                  cursor: creatingProduct ? "not-allowed" : "pointer",
                }}
              >
                {creatingProduct ? "Creating..." : "Create & Add to Section"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
