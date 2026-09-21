"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { allowedNext, OrderStatus } from "@/lib/order-state";

// ─── TYPES ──────────────────────────────────────────────

interface ProductColor {
  id: string;
  productId: string;
  name: string;
  hex: string;
  imagesJson: string;
  sortOrder: number;
}

interface ProductVariant {
  id: string;
  productId: string;
  color: string;
  size: string;
  stock: number;
}

interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  slug?: string;
  category: string;
  tag?: string | null;
  price: number;
  oldPrice?: number | null;
  isSale: boolean;
  description: string;
  hero: string;
  gallery: string[];
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  productColors?: ProductColor[];
  variants?: ProductVariant[];
  variantCount?: number;
  totalStock?: number;
  stockLevel?: { quantity: number };
}

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  product?: { id: string; name: string; hero: string };
}

interface BookingLog {
  id: string;
  attemptedAt: string;
  requestPayload: any;
  responsePayload: any;
  success: boolean;
  errorMessage?: string;
}

interface AdminOrder {
  id: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  shippingInfo: any;
  payment: string;
  guestEmail?: string | null;
  guestName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  createdAt: string;
  version?: number;
  isTest?: boolean;
  postexTrackingNumber?: string | null;
  postexStatus?: string | null;
  courierBookingStatus?: string | null;
  adminApproved?: boolean;
  user?: { id: string; email: string; name?: string | null } | null;
  orderItems: OrderItem[];
  bookingLogs?: BookingLog[];
  events?: any[];
}

interface QueueData {
  awaitingApproval: AdminOrder[];
  queuedForBatch: AdminOrder[];
  failedBookings: AdminOrder[];
  bookedOrders: AdminOrder[];
}

interface CitiesData {
  defaultCities: string[];
  dbCities: { id: string; cityName: string; enabled: boolean }[];
}

interface CategorySettingRow {
  category: string;
  lowStockThreshold: number;
}

interface SizeRow {
  size: string;
}

// ─── HELPERS ───────────────────────────────────────────

function fmtPrice(n: number): string {
  return "PKR " + (n || 0).toLocaleString("en-PK");
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function parseShippingInfo(val: any): any {
  if (!val) return {};
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  return {};
}

function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  const raw = localStorage.getItem("nanos_auth_v1");
  if (!raw) return "";
  try {
    return JSON.parse(raw).token || "";
  } catch {
    return "";
  }
}

// ─── MAIN COMPONENT ────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "orders"
    | "delivered"
    | "products"
    | "edit-product"
    | "courier"
    | "size-charts"
    | "settings"
  >("dashboard");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Data states
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Orders Tab Filters
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderCustomerFilter, setOrderCustomerFilter] = useState("all");
  const [orderDateFilter, setOrderDateFilter] = useState("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Delivered Orders Tab Filters
  const [deliveredQuery, setDeliveredQuery] = useState("");
  const [deliveredCustomerFilter, setDeliveredCustomerFilter] = useState("all");
  const [deliveredPresetDate, setDeliveredPresetDate] = useState("all");
  const [deliveredStartDate, setDeliveredStartDate] = useState("");
  const [deliveredEndDate, setDeliveredEndDate] = useState("");

  // Products Tab Filters & Sorting
  const [productQuery, setProductQuery] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productSortKey, setProductSortKey] = useState<"name" | "price" | "stock" | null>(null);
  const [productSortDir, setProductSortDir] = useState<"asc" | "desc">("asc");

  // Add Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    category: "crocs",
    price: "",
    oldPrice: "",
    tag: "",
    description: "",
    hero: "",
    galleryRaw: "",
    colorsRaw: "",
    sizesRaw: "",
    isSale: false,
  });

  // Product Edit Panel State (Tab 5)
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [editFormName, setEditFormName] = useState("");
  const [editFormDesc, setEditFormDesc] = useState("");
  const [editFormPrice, setEditFormPrice] = useState("");
  const [editFormOldPrice, setEditFormOldPrice] = useState("");
  const [editFormTag, setEditFormTag] = useState("");
  const [editFormHero, setEditFormHero] = useState("");
  const [editFormGallery, setEditFormGallery] = useState<string[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);

  // Edit Panel — Colors Sub-section
  const [dbColors, setDbColors] = useState<ProductColor[]>([]);
  const [showColorAddForm, setShowColorAddForm] = useState(false);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [colorNameInput, setColorNameInput] = useState("");
  const [colorHexInput, setColorHexInput] = useState("#111111");
  const [colorImagesInput, setColorImagesInput] = useState("");
  const [colorSortInput, setColorSortInput] = useState("0");
  const [savingColor, setSavingColor] = useState(false);

  // Edit Panel — Per-Color Gallery & Stock Manager State
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [colorImagesMap, setColorImagesMap] = useState<Record<string, string[]>>({});
  const [colorStockMap, setColorStockMap] = useState<Record<string, Record<string, number>>>({});
  const [dirtyColorTabs, setDirtyColorTabs] = useState<Set<string>>(new Set());
  const [urlInputMap, setUrlInputMap] = useState<Record<string, string>>({});
  const [urlErrorMap, setUrlErrorMap] = useState<Record<string, string | null>>({});
  const [bulkQtyMap, setBulkQtyMap] = useState<Record<string, string>>({});
  const [copyColorMap, setCopyColorMap] = useState<Record<string, string>>({});

  // Edit Panel — Sizes Sub-section
  const [productSizes, setProductSizes] = useState<string[]>([]);
  const [newSizeInput, setNewSizeInput] = useState("");
  const [addingSize, setAddingSize] = useState(false);
  const [renamingSize, setRenamingSize] = useState<string | null>(null);
  const [renameSizeInput, setRenameSizeInput] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Edit Panel — Variants Matrix Sub-section
  const [dbVariants, setDbVariants] = useState<ProductVariant[]>([]);
  const [cellStockDrafts, setCellStockDrafts] = useState<Record<string, string>>({});
  const [cellSaving, setCellSaving] = useState<Record<string, boolean>>({});

  // Courier Queue Tab State
  const [courierQueue, setCourierQueue] = useState<QueueData>({
    awaitingApproval: [],
    queuedForBatch: [],
    failedBookings: [],
    bookedOrders: [],
  });
  const [courierCities, setCourierCities] = useState<CitiesData>({ defaultCities: [], dbCities: [] });
  const [newCityInput, setNewCityInput] = useState("");
  const [courierLoading, setCourierLoading] = useState(false);
  const [courierActionId, setCourierActionId] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [postexHealth, setPostexHealth] = useState<{
    ok: boolean;
    tokenLength: number;
    addresses?: string[];
    code?: string;
    message?: string;
  } | null>(null);

  // Size Charts Tab State
  const [sizeChartCategories, setSizeChartCategories] = useState<string[]>(["crocs", "trousers"]);
  const [activeSizeCategory, setActiveSizeCategory] = useState<string>("crocs");
  const [sizeChartRows, setSizeChartRows] = useState<string[]>([]);
  const [savingSizeChart, setSavingSizeChart] = useState(false);

  // Settings Tab State
  const [settingsRows, setSettingsRows] = useState<CategorySettingRow[]>([]);
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});
  const [savingSettingCategory, setSavingSettingCategory] = useState<string | null>(null);

  // Toast Helper
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Fetch wrapper with auth
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = getAuthToken();
      if (!token) {
        router.push("/login");
        throw new Error("Unauthorized");
      }
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      };
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        throw new Error("Unauthorized");
      }
      return res;
    },
    [router]
  );

  // Load Main Data (Products, Orders, Settings)
  const loadMainData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resProd, resOrd, resSet] = await Promise.all([
        authFetch("/api/admin/products"),
        authFetch("/api/admin/orders"),
        authFetch("/api/admin/settings").catch(() => null),
      ]);

      if (resProd.ok) {
        const pData = await resProd.json();
        setProducts(pData.products || pData || []);
      }

      if (resOrd.ok) {
        const oData = await resOrd.json();
        const rawOrders: any[] = oData.orders || oData.data || oData || [];
        const mappedOrders: AdminOrder[] = rawOrders.map((o) => {
          const sInfo = parseShippingInfo(o.shippingInfo);
          const cName = o.customerName || sInfo.name || o.user?.name || o.guestName || "Guest";
          const cEmail = o.customerEmail || sInfo.email || o.user?.email || o.guestEmail || "No email";
          const items: OrderItem[] = (o.orderItems || o.items || []).map((i: any) => ({
            id: i.id,
            productId: i.productId,
            quantity: i.quantity ?? i.qty ?? 1,
            price: i.unitPrice ?? i.price ?? 0,
            size: i.size,
            color: i.color,
            product: i.product || { id: i.productId, name: i.name || "Product", hero: i.hero || "" },
          }));
          return {
            ...o,
            customerName: cName,
            customerEmail: cEmail,
            shippingInfo: sInfo,
            orderItems: items,
          };
        });
        setOrders(mappedOrders);
      }

      if (resSet && resSet.ok) {
        const sData: CategorySettingRow[] = await resSet.json();
        if (Array.isArray(sData)) {
          setSettingsRows(sData);
          const map: Record<string, number> = {};
          const drafts: Record<string, string> = {};
          for (const s of sData) {
            map[s.category] = s.lowStockThreshold;
            drafts[s.category] = String(s.lowStockThreshold);
          }
          setThresholds(map);
          setSettingDrafts(drafts);
        }
      }
    } catch (err: any) {
      if (err.message !== "Unauthorized") {
        setError(err.message || "Failed to load data");
      }
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // Load Courier Queue Tab Data
  const loadCourierData = useCallback(async () => {
    setCourierLoading(true);
    try {
      const [resQ, resC] = await Promise.all([
        authFetch("/api/admin/courier-queue"),
        authFetch("/api/admin/courier-queue/cities"),
      ]);
      if (resQ.ok) {
        const qData = await resQ.json();
        setCourierQueue(qData);
      }
      if (resC.ok) {
        const cData = await resC.json();
        setCourierCities(cData);
      }
    } catch {
      showToast("Failed to load courier queue", "error");
    } finally {
      setCourierLoading(false);
    }
  }, [authFetch, showToast]);

  // Load Size Chart Data
  const loadSizeChart = useCallback(
    async (category: string) => {
      try {
        const res = await authFetch(`/api/admin/products/size-charts/${encodeURIComponent(category)}`);
        if (res.ok) {
          const chart = await res.json();
          if (!chart) {
            setSizeChartRows([]);
            return;
          }
          const rawRows = chart.rowsJson ?? chart.rows ?? "[]";
          try {
            const parsed = JSON.parse(rawRows);
            if (Array.isArray(parsed)) {
              setSizeChartRows(parsed.map((r: any) => (typeof r === "string" ? r : r.size || "")));
            } else {
              setSizeChartRows([]);
            }
          } catch {
            setSizeChartRows([]);
          }
        }
      } catch {
        setSizeChartRows([]);
      }
    },
    [authFetch]
  );

  // Load Colors for Edit Panel
  const loadEditColors = useCallback(
    async (productId: string) => {
      try {
        const res = await authFetch(`/api/admin/products/${productId}/colors`);
        if (res.ok) {
          const data = await res.json();
          const colors = Array.isArray(data) ? data : [];
          setDbColors(colors);

          const imgMap: Record<string, string[]> = {};
          colors.forEach((c: any) => {
            try {
              const parsed = JSON.parse(c.imagesJson || "[]");
              imgMap[c.id] = Array.isArray(parsed) ? parsed : [];
            } catch {
              imgMap[c.id] = [];
            }
          });
          setColorImagesMap(imgMap);

          if (colors.length > 0) {
            setSelectedColorId((prev) => (prev && colors.some((c: any) => c.id === prev) ? prev : colors[0].id));
          } else {
            setSelectedColorId(null);
          }
        }
      } catch {
        setDbColors([]);
      }
    },
    [authFetch]
  );

  // Load Sizes for Edit Panel
  const loadEditSizes = useCallback(
    async (productId: string) => {
      try {
        const res = await authFetch(`/api/admin/products/${productId}/sizes`);
        if (res.ok) {
          const data = await res.json();
          setProductSizes(Array.isArray(data.sizes) ? data.sizes : []);
        }
      } catch {
        setProductSizes([]);
      }
    },
    [authFetch]
  );

  // Load Variants for Edit Panel
  const loadEditVariants = useCallback(
    async (productId: string) => {
      try {
        const res = await authFetch(`/api/admin/products/${productId}/variants`);
        if (res.ok) {
          const grouped = await res.json();
          if (grouped && typeof grouped === "object") {
            const flat = Object.values(grouped).flat() as ProductVariant[];
            setDbVariants(flat);
            const drafts: Record<string, string> = {};
            const stockMap: Record<string, Record<string, number>> = {};
            for (const v of flat) {
              drafts[`${v.color}|${v.size}`] = String(v.stock);
              if (!stockMap[v.color]) stockMap[v.color] = {};
              stockMap[v.color][v.size] = v.stock;
            }
            setCellStockDrafts(drafts);
            setColorStockMap(stockMap);
          }
        }
      } catch {
        setDbVariants([]);
      }
    },
    [authFetch]
  );

  // Per-Color Manager Handlers
  async function handleSaveColorTab(colorId: string) {
    if (!editingProduct) return;
    const colorObj = dbColors.find((c) => c.id === colorId);
    if (!colorObj) return;

    const images = colorImagesMap[colorId] || [];
    const stockForColor = colorStockMap[colorObj.name] || {};

    setSavingColor(true);
    try {
      const resColor = await authFetch(`/api/admin/products/${editingProduct.id}/colors/${colorId}`, {
        method: "PATCH",
        body: JSON.stringify({ images }),
      });
      if (!resColor.ok) {
        const errData = await resColor.json();
        throw new Error(errData.error || "Failed to save color images");
      }

      const variantsPayload = productSizes.map((sz) => ({
        color: colorObj.name,
        size: sz,
        stock: stockForColor[sz] ?? 0,
      }));
      const resStock = await authFetch(`/api/admin/products/${editingProduct.id}/variants`, {
        method: "POST",
        body: JSON.stringify(variantsPayload),
      });
      if (!resStock.ok) {
        const errData = await resStock.json();
        throw new Error(errData.error || "Failed to save stock levels");
      }

      setDirtyColorTabs((prev) => {
        const next = new Set(prev);
        next.delete(colorId);
        return next;
      });

      showToast(`Saved changes for ${colorObj.name}!`);
      loadEditColors(editingProduct.id);
      loadEditVariants(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to save color tab", "error");
    } finally {
      setSavingColor(false);
    }
  }

  function handleAddImageUrl(colorId: string) {
    const inputUrl = (urlInputMap[colorId] || "").trim();
    if (!inputUrl) return;

    try {
      const parsed = new URL(inputUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setUrlErrorMap((prev) => ({ ...prev, [colorId]: "URL must start with http:// or https://" }));
        return;
      }
    } catch {
      setUrlErrorMap((prev) => ({ ...prev, [colorId]: "Invalid image URL format" }));
      return;
    }

    const currentImages = colorImagesMap[colorId] || [];
    if (currentImages.includes(inputUrl)) {
      setUrlErrorMap((prev) => ({ ...prev, [colorId]: "This image URL is already added for this color" }));
      return;
    }

    setColorImagesMap((prev) => ({ ...prev, [colorId]: [...currentImages, inputUrl] }));
    setUrlInputMap((prev) => ({ ...prev, [colorId]: "" }));
    setUrlErrorMap((prev) => ({ ...prev, [colorId]: null }));
    setDirtyColorTabs((prev) => new Set(prev).add(colorId));
  }

  function handleMoveColorImage(colorId: string, idx: number, delta: number) {
    const currentImages = [...(colorImagesMap[colorId] || [])];
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= currentImages.length) return;

    const temp = currentImages[idx];
    currentImages[idx] = currentImages[targetIdx];
    currentImages[targetIdx] = temp;

    setColorImagesMap((prev) => ({ ...prev, [colorId]: currentImages }));
    setDirtyColorTabs((prev) => new Set(prev).add(colorId));
  }

  function handleRemoveColorImage(colorId: string, idx: number) {
    const currentImages = (colorImagesMap[colorId] || []).filter((_, i) => i !== idx);
    setColorImagesMap((prev) => ({ ...prev, [colorId]: currentImages }));
    setDirtyColorTabs((prev) => new Set(prev).add(colorId));
  }

  function handleUpdateSizeStock(colorName: string, size: string, newQty: number) {
    const qty = Math.max(0, newQty);
    setColorStockMap((prev) => ({
      ...prev,
      [colorName]: {
        ...(prev[colorName] || {}),
        [size]: qty,
      },
    }));
    const colorObj = dbColors.find((c) => c.name.toLowerCase() === colorName.toLowerCase());
    if (colorObj) {
      setDirtyColorTabs((prev) => new Set(prev).add(colorObj.id));
    }
  }

  function handleBulkSetStock(colorId: string, colorName: string) {
    const val = parseInt(bulkQtyMap[colorId] || "0", 10);
    if (isNaN(val) || val < 0) return;

    const newStock: Record<string, number> = {};
    productSizes.forEach((sz) => {
      newStock[sz] = val;
    });

    setColorStockMap((prev) => ({ ...prev, [colorName]: newStock }));
    setDirtyColorTabs((prev) => new Set(prev).add(colorId));
    showToast(`Set all sizes for ${colorName} to ${val}`);
  }

  function handleCopyStockFromColor(colorId: string, targetColorName: string, sourceColorName: string) {
    if (!sourceColorName) return;
    const sourceStock = colorStockMap[sourceColorName] || {};

    setColorStockMap((prev) => ({
      ...prev,
      [targetColorName]: { ...sourceStock },
    }));
    setDirtyColorTabs((prev) => new Set(prev).add(colorId));
    showToast(`Copied stock from ${sourceColorName} to ${targetColorName}`);
  }

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyColorTabs.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyColorTabs]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("nanosAdminTheme_v1") as "light" | "dark" | null;
      const initialTheme = savedTheme || "dark";
      setTheme(initialTheme);
      document.documentElement.setAttribute("data-theme", initialTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    loadMainData();
  }, [loadMainData]);

  // Tab Navigation Handler
  const switchTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    if (tab === "courier") {
      loadCourierData();
    } else if (tab === "size-charts") {
      loadSizeChart(activeSizeCategory);
    }
  };

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("nanosAdminTheme_v1", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  function handleLogout() {
    localStorage.removeItem("nanos_auth_v1");
    router.push("/login");
  }

  // ─── ACTION HANDLERS ───────────────────────────────────

  // Add Product Submit
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.price) {
      showToast("Name and price are required.", "error");
      return;
    }
    setAddingProduct(true);
    try {
      const gallery = addForm.galleryRaw.split(",").map((s) => s.trim()).filter(Boolean);
      const colors = addForm.colorsRaw.split(",").map((s) => s.trim()).filter((s) => s !== "").map((name) => ({ name, hex: "#111111" }));
      const sizes = addForm.sizesRaw.split(",").map((s) => s.trim()).filter(Boolean);

      const payload = {
        name: addForm.name.trim(),
        category: addForm.category,
        price: Number(addForm.price),
        oldPrice: addForm.oldPrice ? Number(addForm.oldPrice) : null,
        tag: addForm.tag.trim() || null,
        description: addForm.description.trim(),
        hero: addForm.hero.trim(),
        gallery,
        colors,
        sizes,
        isSale: addForm.isSale,
      };

      const res = await authFetch("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create product");
      showToast("Product created successfully!");
      setShowAddModal(false);
      setAddForm({
        name: "",
        category: "crocs",
        price: "",
        oldPrice: "",
        tag: "",
        description: "",
        hero: "",
        galleryRaw: "",
        colorsRaw: "",
        sizesRaw: "",
        isSale: false,
      });
      loadMainData();
    } catch (err: any) {
      showToast(err.message || "Failed to create product", "error");
    } finally {
      setAddingProduct(false);
    }
  }

  // Open Edit Product Panel (Tab 5)
  function openEditProductPanel(p: AdminProduct) {
    setEditingProduct(p);
    setEditFormName(p.name || "");
    setEditFormDesc(p.description || "");
    setEditFormPrice(String(p.price || ""));
    setEditFormOldPrice(p.oldPrice ? String(p.oldPrice) : "");
    setEditFormTag(p.tag || "");
    setEditFormHero(p.hero || "");
    setEditFormGallery(Array.isArray(p.gallery) ? p.gallery : []);
    setShowColorAddForm(false);
    setActiveTab("edit-product");

    loadEditColors(p.id);
    loadEditSizes(p.id);
    loadEditVariants(p.id);
  }

  // Save Product Main Fields
  async function handleSaveProductMain() {
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      const payload = {
        name: editFormName,
        description: editFormDesc,
        price: Number(editFormPrice),
        oldPrice: editFormOldPrice ? Number(editFormOldPrice) : null,
        tag: editFormTag || null,
        hero: editFormHero,
        gallery: editFormGallery.filter((g) => g.trim() !== ""),
      };

      const res = await authFetch(`/api/admin/products/${editingProduct.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save product");
      showToast("Product saved successfully!");
      loadMainData();
    } catch (err: any) {
      showToast(err.message || "Failed to save product", "error");
    } finally {
      setSavingProduct(false);
    }
  }

  // Delete Product
  async function handleDeleteProduct(p: AdminProduct) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      const res = await authFetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete product");
      showToast("Product deleted!");
      loadMainData();
    } catch (err: any) {
      showToast(err.message || "Delete failed", "error");
    }
  }

  // Save DB Color
  async function handleSaveColor(colorId?: string) {
    if (!editingProduct) return;
    const trimmedName = colorNameInput.trim();
    if (!trimmedName) {
      showToast("Color name cannot be empty", "error");
      return;
    }
    setSavingColor(true);
    try {
      const isEdit = !!colorId;
      const images = colorImagesInput.split("\n").map((s) => s.trim()).filter(Boolean);
      const payload = {
        name: trimmedName,
        hex: colorHexInput.trim(),
        images,
        sortOrder: Number(colorSortInput) || 0,
      };

      const url = isEdit
        ? `/api/admin/products/${editingProduct.id}/colors/${colorId}`
        : `/api/admin/products/${editingProduct.id}/colors`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await authFetch(url, { method, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save color");
      showToast(isEdit ? "Color updated!" : "Color added!");
      setShowColorAddForm(false);
      setEditingColorId(null);
      setColorNameInput("");
      setColorHexInput("#111111");
      setColorImagesInput("");
      setColorSortInput("0");
      loadEditColors(editingProduct.id);
      loadEditVariants(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to save color", "error");
    } finally {
      setSavingColor(false);
    }
  }

  // Delete DB Color
  async function handleDeleteColor(colorId: string) {
    if (!editingProduct || !window.confirm("Delete this color and all its variant stock? This cannot be undone.")) return;
    try {
      const res = await authFetch(`/api/admin/products/${editingProduct.id}/colors/${colorId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete color");
      showToast("Color deleted!");
      loadEditColors(editingProduct.id);
      loadEditVariants(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to delete color", "error");
    }
  }

  // Sizes Management Handlers
  async function handleAddSize(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct || !newSizeInput.trim()) return;
    setAddingSize(true);
    try {
      const res = await authFetch(`/api/admin/products/${editingProduct.id}/sizes`, {
        method: "POST",
        body: JSON.stringify({ size: newSizeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add size");
      showToast(`Size "${newSizeInput.trim()}" added!`);
      setNewSizeInput("");
      loadEditSizes(editingProduct.id);
      loadEditVariants(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to add size", "error");
    } finally {
      setAddingSize(false);
    }
  }

  async function handleRenameSizeSubmit(oldSize: string) {
    if (!editingProduct || !renameSizeInput.trim() || renameSizeInput.trim() === oldSize) {
      setRenamingSize(null);
      return;
    }
    try {
      const res = await authFetch(`/api/admin/products/${editingProduct.id}/sizes`, {
        method: "PATCH",
        body: JSON.stringify({ oldSize, newSize: renameSizeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename size");
      showToast(`Size renamed to "${renameSizeInput.trim()}"!`);
      setRenamingSize(null);
      loadEditSizes(editingProduct.id);
      loadEditVariants(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to rename size", "error");
    }
  }

  async function handleDeleteSize(size: string) {
    if (!editingProduct || !window.confirm(`Delete size "${size}"? All variant stock for this size will be removed.`)) return;
    try {
      const res = await authFetch(`/api/admin/products/${editingProduct.id}/sizes`, {
        method: "DELETE",
        body: JSON.stringify({ size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete size");
      showToast(`Size "${size}" deleted!`);
      loadEditSizes(editingProduct.id);
      loadEditVariants(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to delete size", "error");
    }
  }

  async function handleReorderSize(index: number, direction: -1 | 1) {
    if (!editingProduct) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= productSizes.length) return;
    const updated = [...productSizes];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setProductSizes(updated);

    try {
      const res = await authFetch(`/api/admin/products/${editingProduct.id}/sizes`, {
        method: "PATCH",
        body: JSON.stringify({ sizes: updated }),
      });
      if (!res.ok) throw new Error("Failed to save size order");
    } catch (err: any) {
      showToast(err.message || "Failed to reorder sizes", "error");
      loadEditSizes(editingProduct.id);
    }
  }

  async function handleApplyCategoryTemplate() {
    if (!editingProduct) return;
    setApplyingTemplate(true);
    try {
      const res = await authFetch(`/api/admin/products/${editingProduct.id}/sizes/apply-template`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply size template");
      showToast(data.message || "Size template applied!");
      loadEditSizes(editingProduct.id);
      loadEditVariants(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to apply size template", "error");
    } finally {
      setApplyingTemplate(false);
    }
  }

  // Save / Patch Variant Stock Cell (auto-save on blur)
  async function handleVariantCellBlur(color: string, size: string) {
    if (!editingProduct) return;
    const key = `${color}|${size}`;
    const rawVal = cellStockDrafts[key] ?? "0";
    const stockNum = Number(rawVal);
    if (isNaN(stockNum) || stockNum < 0) return;

    setCellSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await authFetch(
        `/api/admin/products/${editingProduct.id}/variants/${encodeURIComponent(color)}/${encodeURIComponent(size)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ stock: stockNum }),
        }
      );
      if (res.ok) {
        showToast(`Stock for ${color}/${size} set to ${stockNum}`);
      }
    } catch {
      showToast("Failed to update variant stock", "error");
    } finally {
      setCellSaving((prev) => ({ ...prev, [key]: false }));
      loadEditVariants(editingProduct.id);
    }
  }

  // Order Status Update (POST /api/admin/orders/[id]/status)
  async function handleUpdateOrderStatus(order: AdminOrder, toStatus: string) {
    let reason: string | undefined = undefined;
    if (["cancelled", "on_hold", "returned"].includes(toStatus)) {
      const reasonInput = window.prompt(`Please enter a reason for changing status to "${toStatus}":`);
      if (!reasonInput || !reasonInput.trim()) {
        showToast("Reason is required for this status change.", "error");
        return;
      }
      reason = reasonInput.trim();
    }

    setUpdatingStatusId(order.id);
    try {
      const res = await authFetch(`/api/admin/orders/${order.id}/status`, {
        method: "POST",
        body: JSON.stringify({
          to: toStatus,
          expectedVersion: order.version ?? 0,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update order status");
      }
      showToast(`Order status updated to ${toStatus}`);
      loadMainData();
    } catch (err: any) {
      showToast(err.message || "Failed to update order status", "error");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // Courier Queue Actions
  async function handleRunBatchNow() {
    setCourierActionId("batch");
    try {
      const res = await authFetch("/api/admin/courier-queue/run-batch", { method: "POST" });
      if (res.ok) {
        const results = await res.json();
        showToast(`Batch completed! Processed ${results.length} orders.`);
        loadCourierData();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to run batch booking", "error");
    } finally {
      setCourierActionId(null);
    }
  }

  async function handleTestPostexConnection() {
    setHealthLoading(true);
    try {
      const res = await authFetch("/api/admin/postex/health");
      const data = await res.json();
      setPostexHealth(data);
      if (data.ok) {
        showToast(`PostEx Connection PASS (Addresses: ${data.addresses?.join(", ") || "(none)"})`);
      } else {
        showToast(`PostEx Health FAIL [${data.code}]: ${data.message}`, "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to check PostEx connection", "error");
    } finally {
      setHealthLoading(false);
    }
  }

  async function handleApproveOrder(orderId: string) {
    setCourierActionId(`approve-${orderId}`);
    try {
      const res = await authFetch(`/api/admin/courier-queue/${orderId}/approve`, { method: "PATCH" });
      if (res.ok) {
        showToast(`Order ${orderId} approved for batch!`);
        loadCourierData();
      }
    } catch {
      showToast("Failed to approve order", "error");
    } finally {
      setCourierActionId(null);
    }
  }

  async function handleRetryOrder(orderId: string) {
    setCourierActionId(`retry-${orderId}`);
    try {
      const res = await authFetch(`/api/admin/courier-queue/${orderId}/retry`, { method: "POST" });
      if (res.ok) {
        showToast(`Retry attempt finished for ${orderId}`);
        loadCourierData();
      }
    } catch {
      showToast("Retry failed", "error");
    } finally {
      setCourierActionId(null);
    }
  }

  async function handleAddAutoCity(e: React.FormEvent) {
    e.preventDefault();
    if (!newCityInput.trim()) return;
    try {
      const res = await authFetch("/api/admin/courier-queue/cities", {
        method: "PUT",
        body: JSON.stringify({ cityName: newCityInput.trim(), enabled: true }),
      });
      if (res.ok) {
        showToast(`Added ${newCityInput.trim()} to auto-book cities`);
        setNewCityInput("");
        loadCourierData();
      }
    } catch {
      showToast("Failed to add city", "error");
    }
  }

  async function handleToggleAutoCity(cityName: string, currentEnabled: boolean) {
    try {
      const res = await authFetch("/api/admin/courier-queue/cities", {
        method: "PUT",
        body: JSON.stringify({ cityName, enabled: !currentEnabled }),
      });
      if (res.ok) {
        loadCourierData();
      }
    } catch {
      showToast("Failed to toggle city", "error");
    }
  }

  // Save Size Chart Category
  async function handleSaveSizeChart() {
    setSavingSizeChart(true);
    try {
      const cleaned = sizeChartRows.map((s) => s.trim()).filter((s) => s !== "");
      const res = await authFetch(`/api/admin/products/size-charts/${encodeURIComponent(activeSizeCategory)}`, {
        method: "POST",
        body: JSON.stringify({ rowsJson: JSON.stringify(cleaned.map((size) => ({ size }))) }),
      });
      if (res.ok) {
        showToast(`Saved ${cleaned.length} sizes for ${activeSizeCategory}`);
        loadSizeChart(activeSizeCategory);
      }
    } catch {
      showToast("Failed to save size chart", "error");
    } finally {
      setSavingSizeChart(false);
    }
  }

  // Save Low Stock Setting Category Threshold
  async function handleSaveSettingThreshold(category: string) {
    const rawVal = settingDrafts[category] ?? "20";
    const threshold = Number(rawVal);
    if (isNaN(threshold) || threshold < 0) return;
    setSavingSettingCategory(category);
    try {
      const res = await authFetch(`/api/admin/settings/${encodeURIComponent(category)}`, {
        method: "PATCH",
        body: JSON.stringify({ lowStockThreshold: threshold }),
      });
      if (res.ok) {
        showToast(`Updated low stock threshold for ${category} to ${threshold}`);
        loadMainData();
      }
    } catch {
      showToast("Failed to update setting", "error");
    } finally {
      setSavingSettingCategory(null);
    }
  }

  // ─── DERIVED FILTERED DATA ─────────────────────────────

  // Filtered Orders for Orders Tab
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      // 1. Status Filter
      if (orderStatusFilter !== "all" && o.status.toLowerCase() !== orderStatusFilter.toLowerCase()) {
        return false;
      }

      // 2. Customer Type Filter
      const isGuest = !o.user?.id;
      if (orderCustomerFilter === "guest" && !isGuest) return false;
      if (orderCustomerFilter === "account" && isGuest) return false;

      // 3. Date Filter
      const createdTime = new Date(o.createdAt).getTime();
      if (orderDateFilter === "today" && createdTime < todayStart) return false;
      if (orderDateFilter === "7days" && createdTime < sevenDaysAgo) return false;
      if (orderDateFilter === "30days" && createdTime < thirtyDaysAgo) return false;

      // 4. Search Filter
      if (orderQuery.trim()) {
        const q = orderQuery.trim().toLowerCase();
        const mName = o.customerName?.toLowerCase().includes(q) ?? false;
        const mEmail = o.customerEmail?.toLowerCase().includes(q) ?? false;
        const mId = o.id.toLowerCase().includes(q);
        if (!mName && !mEmail && !mId) return false;
      }

      return true;
    });
  }, [orders, orderStatusFilter, orderCustomerFilter, orderDateFilter, orderQuery]);

  // Filtered Delivered Orders for Delivered Tab
  const filteredDeliveredOrders = useMemo(() => {
    const deliveredList = orders.filter((o) => o.status.toLowerCase() === "delivered");

    return deliveredList.filter((o) => {
      // Customer Type
      const isGuest = !o.user?.id;
      if (deliveredCustomerFilter === "guest" && !isGuest) return false;
      if (deliveredCustomerFilter === "account" && isGuest) return false;

      // Date Filters
      const createdDateStr = o.createdAt.split("T")[0];
      if (deliveredStartDate && createdDateStr < deliveredStartDate) return false;
      if (deliveredEndDate && createdDateStr > deliveredEndDate) return false;

      // Search Query
      if (deliveredQuery.trim()) {
        const q = deliveredQuery.trim().toLowerCase();
        const mName = o.customerName?.toLowerCase().includes(q) ?? false;
        const mEmail = o.customerEmail?.toLowerCase().includes(q) ?? false;
        const mId = o.id.toLowerCase().includes(q);
        if (!mName && !mEmail && !mId) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, deliveredCustomerFilter, deliveredStartDate, deliveredEndDate, deliveredQuery]);

  // Filtered & Sorted Products for Products Tab
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const filtered = products.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
      const matchCat = productCategoryFilter === "all" || p.category.toLowerCase() === productCategoryFilter.toLowerCase();
      return matchQ && matchCat;
    });

    if (!productSortKey) return filtered;
    const dir = productSortDir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const stockA = a.totalStock ?? a.stockLevel?.quantity ?? 0;
      const stockB = b.totalStock ?? b.stockLevel?.quantity ?? 0;
      const va = productSortKey === "name" ? a.name.toLowerCase() : productSortKey === "price" ? a.price : stockA;
      const vb = productSortKey === "name" ? b.name.toLowerCase() : productSortKey === "price" ? b.price : stockB;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [products, productQuery, productCategoryFilter, productSortKey, productSortDir]);

  const toggleProductSort = (key: "name" | "price" | "stock") => {
    if (productSortKey === key) {
      setProductSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setProductSortKey(key);
      setProductSortDir("asc");
    }
  };

  const sortIndicator = (key: "name" | "price" | "stock") =>
    productSortKey === key ? (productSortDir === "asc" ? " ▲" : " ▼") : "";

  if (!mounted) return null;

  return (
    <div className="admin-layout-shell">
      {/* Toast Notice */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 9999,
            padding: "10px 18px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            background: toast.type === "success" ? "#2e7d32" : "#c62828",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div>
          <div className="sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/" className="brand-font">
              nanos.pk
            </Link>
            <button
              type="button"
              className="admin-sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          <div className="sidebar-section-label">Overview</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => switchTab("dashboard")}
          >
            <span>Dashboard</span>
          </button>

          <div className="sidebar-section-label">Orders</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => switchTab("orders")}
          >
            <span>Orders</span>
            {orders.filter((o) => o.status.toLowerCase() === "processing").length > 0 && (
              <span className="nav-badge">
                {orders.filter((o) => o.status.toLowerCase() === "processing").length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "delivered" ? "active" : ""}`}
            onClick={() => switchTab("delivered")}
          >
            <span>Delivered Orders</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "courier" ? "active" : ""}`}
            onClick={() => switchTab("courier")}
          >
            <span>Courier Queue</span>
          </button>

          <div className="sidebar-section-label">Catalog</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "products" || activeTab === "edit-product" ? "active" : ""}`}
            onClick={() => switchTab("products")}
          >
            <span>Products</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "size-charts" ? "active" : ""}`}
            onClick={() => switchTab("size-charts")}
          >
            <span>Size Charts</span>
          </button>

          <div className="sidebar-section-label">System</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => switchTab("settings")}
          >
            <span>Settings</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">A</div>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>Admin</div>
              <div style={{ color: "var(--admin-text-soft)", fontSize: 11 }}>Store Manager</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            style={{ color: "var(--admin-danger)", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >
            Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* MAIN CONTENT COLUMN */}
      <div className="main-col">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="hamburger" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <div>
              <h1 className="page-title">
                {activeTab === "dashboard"
                  ? "Dashboard"
                  : activeTab === "orders"
                  ? "Orders"
                  : activeTab === "delivered"
                  ? "Delivered Orders Archive"
                  : activeTab === "products"
                  ? "Products Catalog"
                  : activeTab === "edit-product"
                  ? "Edit Product"
                  : activeTab === "courier"
                  ? "PostEx Courier Queue"
                  : activeTab === "size-charts"
                  ? "Size Charts Manager"
                  : "Store Settings"}
              </h1>
              <p className="page-sub">
                {activeTab === "dashboard"
                  ? "Store metrics & recent activity"
                  : activeTab === "orders"
                  ? "Filter and manage customer orders"
                  : activeTab === "delivered"
                  ? "Chronological archive of delivered orders"
                  : activeTab === "products"
                  ? "Catalog and inventory stock levels"
                  : activeTab === "edit-product"
                  ? "Modify main details, colors, and variant stock matrix"
                  : activeTab === "courier"
                  ? "Batched daily booking, city routing & error tracking"
                  : activeTab === "size-charts"
                  ? "Manage size selector options per category"
                  : "Low stock alert thresholds & configuration"}
              </p>
            </div>
          </div>

          <div className="topbar-right">
            <button type="button" className="admin-icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === "light" ? "◐" : "☀️"}
            </button>
          </div>
        </header>

        {/* CONTENT CONTAINER */}
        <main className="content">
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--admin-text-soft)" }}>
              Loading store metrics...
            </div>
          ) : error ? (
            <div style={{ padding: 16, background: "var(--admin-danger-bg)", color: "var(--admin-danger)", borderRadius: 6 }}>
              {error}
            </div>
          ) : activeTab === "dashboard" ? (
            /* TAB 1: DASHBOARD */
            <div>
              {/* Stat Cards */}
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Orders</div>
                  <div className="stat-value">{orders.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pending / Processing</div>
                  <div className="stat-value">
                    {orders.filter((o) => o.status.toLowerCase() === "processing").length}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Today's Revenue</div>
                  <div className="stat-value">
                    {fmtPrice(
                      orders
                        .filter(
                          (o) =>
                            new Date(o.createdAt).toDateString() === new Date().toDateString() &&
                            o.status.toLowerCase() !== "cancelled"
                        )
                        .reduce((sum, o) => sum + o.total, 0)
                    )}
                  </div>
                </div>
                <div className="stat-card accent">
                  <div className="stat-label">Delivered Revenue</div>
                  <div className="stat-value">
                    {fmtPrice(
                      orders
                        .filter((o) => o.status.toLowerCase() === "delivered")
                        .reduce((sum, o) => sum + o.total, 0)
                    )}
                  </div>
                </div>
              </div>

              {/* Chart & Alerts */}
              <div className="two-col">
                {/* 7-Day Bar Chart */}
                <div className="panel">
                  <div className="panel-head">
                    <h3>Orders — last 7 days</h3>
                  </div>
                  <div className="panel-body">
                    {(() => {
                      const last7 = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return d;
                      });
                      const chartData = last7.map((d) => {
                        const dStr = d.toDateString();
                        const count = orders.filter((o) => new Date(o.createdAt).toDateString() === dStr).length;
                        const label = d.toLocaleDateString("en-US", { weekday: "short" });
                        return { label, count };
                      });
                      const maxCount = Math.max(...chartData.map((c) => c.count), 1);

                      return (
                        <svg viewBox="0 0 420 120" width="100%" height="120">
                          {chartData.map((d, index) => {
                            const barWidth = 36;
                            const gap = 16;
                            const x = 30 + index * (barWidth + gap);
                            const rawHeight = (d.count / maxCount) * 65;
                            const barHeight = d.count > 0 ? Math.max(rawHeight, 4) : 0;
                            const y = 85 - barHeight;

                            return (
                              <g key={index}>
                                {d.count > 0 && (
                                  <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--admin-text)">
                                    {d.count}
                                  </text>
                                )}
                                {barHeight > 0 && (
                                  <rect x={x} y={y} width={barWidth} height={barHeight} rx="3" fill="var(--admin-accent)" />
                                )}
                                <line x1={x} y1="85" x2={x + barWidth} y2="85" stroke="var(--admin-border)" strokeWidth="1" />
                                <text x={x + barWidth / 2} y="105" textAnchor="middle" fontSize="12" fill="var(--admin-text-soft)">
                                  {d.label}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* Inventory Alerts */}
                <div className="panel">
                  <div className="panel-head">
                    <h3>Inventory Alerts</h3>
                  </div>
                  <div className="panel-body">
                    {products.filter((p) => (p.totalStock ?? p.stockLevel?.quantity ?? 0) === 0).length === 0 ? (
                      <div style={{ color: "var(--admin-text-soft)", fontSize: 13.5 }}>No sold-out stock issues.</div>
                    ) : (
                      products
                        .filter((p) => (p.totalStock ?? p.stockLevel?.quantity ?? 0) === 0)
                        .map((p) => (
                          <div key={p.id} className="low-stock-item">
                            <div>
                              <strong>{p.name}</strong> ({p.category})
                            </div>
                            <span className="badge" style={{ background: "var(--admin-danger-bg)", color: "var(--admin-danger)" }}>
                              Sold out
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Orders Panel */}
              <div className="panel">
                <div className="panel-head">
                  <h3>Recent Orders</h3>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => switchTab("orders")}>
                    View all orders →
                  </button>
                </div>
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 5).map((o) => (
                        <tr key={o.id}>
                          <td><strong>#{o.id.slice(-8)}</strong></td>
                          <td>{formatDate(o.createdAt)}</td>
                          <td>{o.customerName}</td>
                          <td>{fmtPrice(o.total)}</td>
                          <td>
                            <span className="badge" style={{ background: "var(--admin-surface-2)", textTransform: "capitalize" }}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === "orders" ? (
            /* TAB 2: ORDERS */
            <div className="panel">
              {/* Filter Toolbar */}
              <div className="panel-head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Search name, email, ID…"
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    style={{ minWidth: 200, flex: 1 }}
                  />
                  <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="placed">Placed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="returned">Returned</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select value={orderCustomerFilter} onChange={(e) => setOrderCustomerFilter(e.target.value)}>
                    <option value="all">All Customers</option>
                    <option value="account">Account Only</option>
                    <option value="guest">Guest Only</option>
                  </select>
                  <select value={orderDateFilter} onChange={(e) => setOrderDateFilter(e.target.value)}>
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                  </select>
                  {(orderStatusFilter !== "all" || orderCustomerFilter !== "all" || orderDateFilter !== "all" || orderQuery !== "") && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setOrderStatusFilter("all");
                        setOrderCustomerFilter("all");
                        setOrderDateFilter("all");
                        setOrderQuery("");
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: 32 }}>
                          No orders match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => {
                        const st = o.status.toLowerCase();
                        let badgeBg = "var(--admin-warn-bg)";
                        let badgeColor = "var(--admin-warn)";

                        if (st === "shipped") {
                          badgeBg = "var(--admin-info-bg)";
                          badgeColor = "var(--admin-info)";
                        } else if (st === "delivered") {
                          badgeBg = "var(--admin-success-bg)";
                          badgeColor = "var(--admin-success)";
                        } else if (st === "cancelled") {
                          badgeBg = "var(--admin-danger-bg)";
                          badgeColor = "var(--admin-danger)";
                        }

                        const isExpanded = expandedOrderId === o.id;

                        return (
                          <React.Fragment key={o.id}>
                            <tr>
                              <td><strong>#{o.id.slice(-8)}</strong></td>
                              <td>{formatDate(o.createdAt)}</td>
                              <td>
                                <div><strong>{o.customerName}</strong></div>
                                <div style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>{o.customerEmail}</div>
                              </td>
                              <td>{o.orderItems.reduce((s, i) => s + i.quantity, 0)}</td>
                              <td>{fmtPrice(o.total)}</td>
                              <td style={{ textTransform: "uppercase" }}>{o.payment}</td>
                              <td>
                                <span className="badge" style={{ background: badgeBg, color: badgeColor, textTransform: "capitalize" }}>
                                  {st}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                                >
                                  {isExpanded ? "Hide" : "View"}
                                </button>
                              </td>
                            </tr>

                            {/* EXPANDED INLINE DETAILS */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={8} style={{ background: "var(--admin-surface-2)", padding: 20 }}>
                                  <div className="order-details-grid">
                                    <div>
                                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Customer Info</div>
                                      <div>Name: {o.customerName}</div>
                                      <div>Email: {o.customerEmail}</div>
                                      <div>Type: {o.user?.id ? "Registered Account" : "Guest Checkout"}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Shipping &amp; Payment</div>
                                      <div>Address: {o.shippingInfo?.address || "N/A"}</div>
                                      <div>City: {o.shippingInfo?.city || "N/A"}</div>
                                      <div>Payment: {o.payment?.toUpperCase()}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, marginBottom: 6 }}>PostEx Courier Status</div>
                                      <div>Booking Status: <strong>{o.courierBookingStatus || "N/A"}</strong></div>
                                      <div>
                                        Tracking #:{" "}
                                        {o.postexTrackingNumber ? (
                                          <a
                                            href={`https://postex.pk/tracking?trackingNumber=${o.postexTrackingNumber}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: "var(--admin-accent)", textDecoration: "underline", fontWeight: 700 }}
                                          >
                                            {o.postexTrackingNumber}
                                          </a>
                                        ) : (
                                          "Not booked"
                                        )}
                                      </div>
                                      <div>PostEx Status: {o.postexStatus || "N/A"}</div>
                                      <div style={{ marginTop: 8 }}>
                                        <label style={{ fontWeight: 700, marginRight: 8 }}>Update Status:</label>
                                        {allowedNext(o.status as OrderStatus).length === 0 ? (
                                          <span className="badge" style={{ textTransform: "capitalize", background: "#333", color: "#aaa" }}>
                                            {o.status} (Final)
                                          </span>
                                        ) : (
                                          <select
                                            value={o.status}
                                            disabled={updatingStatusId === o.id}
                                            onChange={(e) => handleUpdateOrderStatus(o, e.target.value)}
                                          >
                                            <option value={o.status} disabled>
                                              {o.status.toUpperCase()} (Current)
                                            </option>
                                            {allowedNext(o.status as OrderStatus).map((nextSt) => (
                                              <option key={nextSt} value={nextSt}>
                                                {nextSt.toUpperCase()}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Items List */}
                                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Order Items</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {o.orderItems.map((item) => (
                                      <div
                                        key={item.id}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          background: "#1f1f1f",
                                          color: "#f5f5f5",
                                          padding: "10px 14px",
                                          borderRadius: 6,
                                          border: "1px solid var(--admin-border)",
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                          {item.product?.hero && (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                              src={item.product.hero}
                                              alt=""
                                              width={32}
                                              height={32}
                                              style={{ objectFit: "cover", borderRadius: 4 }}
                                            />
                                          )}
                                          <div style={{ color: "#f5f5f5" }}>
                                            <strong style={{ color: "#ffffff" }}>{item.product?.name || item.productId}</strong>{" "}
                                            <span style={{ color: "rgba(245, 245, 245, 0.8)", fontSize: "12.5px" }}>
                                              ({item.color}/{item.size})
                                            </span>
                                          </div>
                                        </div>
                                        <div style={{ color: "#f5f5f5", fontSize: "13.5px" }}>
                                          {item.quantity} × {fmtPrice(item.price)} ={" "}
                                          <strong style={{ color: "#ffffff" }}>{fmtPrice(item.quantity * item.price)}</strong>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Totals */}
                                  <div style={{ textAlign: "right", marginTop: 12, fontWeight: 700 }}>
                                    Total: {fmtPrice(o.total)}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "delivered" ? (
            /* TAB 3: DELIVERED ORDERS ARCHIVE */
            <div>
              {/* Metrics Banner */}
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-label">Delivered Orders</div>
                  <div className="stat-value" style={{ color: "var(--admin-success)" }}>
                    {filteredDeliveredOrders.length}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Delivered Revenue</div>
                  <div className="stat-value">
                    {fmtPrice(filteredDeliveredOrders.reduce((sum, o) => sum + o.total, 0))}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Items Delivered</div>
                  <div className="stat-value">
                    {filteredDeliveredOrders.reduce((sum, o) => sum + o.orderItems.reduce((s, i) => s + i.quantity, 0), 0)}
                  </div>
                </div>
              </div>

              {/* Calendar Filter Toolbar */}
              <div className="panel" style={{ marginBottom: 20 }}>
                <div className="panel-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>SEARCH</label>
                    <input type="text" placeholder="Search name, email, ID…" value={deliveredQuery} onChange={(e) => setDeliveredQuery(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>DATE PRESETS</label>
                    <select
                      value={deliveredPresetDate}
                      onChange={(e) => {
                        const preset = e.target.value;
                        setDeliveredPresetDate(preset);
                        const now = new Date();
                        const fmtDate = (d: Date) => d.toISOString().split("T")[0];
                        if (preset === "today") {
                          setDeliveredStartDate(fmtDate(now));
                          setDeliveredEndDate(fmtDate(now));
                        } else if (preset === "yesterday") {
                          const y = new Date(now);
                          y.setDate(y.getDate() - 1);
                          setDeliveredStartDate(fmtDate(y));
                          setDeliveredEndDate(fmtDate(y));
                        } else if (preset === "7days") {
                          const d7 = new Date(now);
                          d7.setDate(d7.getDate() - 7);
                          setDeliveredStartDate(fmtDate(d7));
                          setDeliveredEndDate(fmtDate(now));
                        } else if (preset === "30days") {
                          const d30 = new Date(now);
                          d30.setDate(d30.getDate() - 30);
                          setDeliveredStartDate(fmtDate(d30));
                          setDeliveredEndDate(fmtDate(now));
                        } else if (preset === "thisMonth") {
                          const start = new Date(now.getFullYear(), now.getMonth(), 1);
                          setDeliveredStartDate(fmtDate(start));
                          setDeliveredEndDate(fmtDate(now));
                        } else if (preset === "all") {
                          setDeliveredStartDate("");
                          setDeliveredEndDate("");
                        }
                      }}
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="thisMonth">This Month</option>
                      <option value="custom">Custom Date Range</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>FROM DATE 📅</label>
                    <input type="date" value={deliveredStartDate} onChange={(e) => { setDeliveredStartDate(e.target.value); setDeliveredPresetDate("custom"); }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>TO DATE 📅</label>
                    <input type="date" value={deliveredEndDate} onChange={(e) => { setDeliveredEndDate(e.target.value); setDeliveredPresetDate("custom"); }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CUSTOMER TYPE</label>
                    <select value={deliveredCustomerFilter} onChange={(e) => setDeliveredCustomerFilter(e.target.value)}>
                      <option value="all">All Customers</option>
                      <option value="account">Account Only</option>
                      <option value="guest">Guest Only</option>
                    </select>
                  </div>
                  {(deliveredPresetDate !== "all" || deliveredStartDate || deliveredEndDate || deliveredCustomerFilter !== "all" || deliveredQuery) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setDeliveredPresetDate("all");
                        setDeliveredStartDate("");
                        setDeliveredEndDate("");
                        setDeliveredCustomerFilter("all");
                        setDeliveredQuery("");
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Delivered Table */}
              <div className="panel">
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Delivered Date</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeliveredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: 32 }}>
                            No delivered orders found for the selected date range.
                          </td>
                        </tr>
                      ) : (
                        filteredDeliveredOrders.map((o) => (
                          <tr key={o.id}>
                            <td><strong>#{o.id.slice(-8)}</strong></td>
                            <td>{formatDate(o.createdAt)}</td>
                            <td>
                              <div><strong>{o.customerName}</strong></div>
                              <div style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>{o.customerEmail}</div>
                            </td>
                            <td>{o.orderItems.reduce((s, i) => s + i.quantity, 0)}</td>
                            <td>{fmtPrice(o.total)}</td>
                            <td style={{ textTransform: "uppercase" }}>{o.payment}</td>
                            <td>
                              <span className="badge" style={{ background: "var(--admin-success-bg)", color: "var(--admin-success)" }}>
                                ✓ Delivered
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === "products" ? (
            /* TAB 4: PRODUCTS CATALOG */
            <div className="panel">
              <div className="panel-head">
                <div className="toolbar" style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search product name or SKU…"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                  />
                  <select value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)}>
                    <option value="all">All Categories</option>
                    <option value="crocs">Crocs</option>
                    <option value="trousers">Trousers</option>
                  </select>
                </div>
                <button type="button" className="btn btn-dark btn-sm" onClick={() => setShowAddModal(true)}>
                  + Add product
                </button>
              </div>

              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: "pointer" }} onClick={() => toggleProductSort("name")}>
                        Name{sortIndicator("name")}
                      </th>
                      <th>Category</th>
                      <th style={{ cursor: "pointer" }} onClick={() => toggleProductSort("price")}>
                        Price{sortIndicator("price")}
                      </th>
                      <th>Sale</th>
                      <th>Variant Count</th>
                      <th style={{ cursor: "pointer" }} onClick={() => toggleProductSort("stock")}>
                        Total Stock{sortIndicator("stock")}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const totalStock = p.totalStock ?? p.stockLevel?.quantity ?? 0;
                      const threshold = thresholds[p.category] ?? 20;
                      const isLowStock = totalStock > 0 && totalStock < threshold;

                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              {p.hero ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={p.hero} alt="" className="admin-product-thumb" />
                              ) : (
                                <div className="admin-product-thumb" />
                              )}
                              <div>
                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                <div style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>{p.sku || p.id}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textTransform: "capitalize" }}>{p.category}</td>
                          <td>{fmtPrice(p.price)}</td>
                          <td>
                            {p.isSale || p.oldPrice ? (
                              <span className="badge" style={{ background: "var(--admin-accent)", color: "var(--admin-accent-text)" }}>
                                Sale
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>{p.variantCount ?? p.variants?.length ?? 0}</td>
                          <td>
                            {totalStock === 0 ? (
                              <span className="badge" style={{ background: "var(--admin-danger-bg)", color: "var(--admin-danger)" }}>
                                0 (Sold out)
                              </span>
                            ) : isLowStock ? (
                              <span className="badge" style={{ background: "var(--admin-warn-bg)", color: "var(--admin-warn)" }}>
                                {totalStock} (Low stock)
                              </span>
                            ) : (
                              <span>{totalStock}</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditProductPanel(p)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ color: "var(--admin-danger)" }}
                                onClick={() => handleDeleteProduct(p)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "edit-product" && editingProduct ? (
            /* TAB 5: PRODUCT EDIT PANEL */
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveTab("products")}>
                  ← Back to Products
                </button>
                <button type="button" className="btn btn-dark" onClick={handleSaveProductMain} disabled={savingProduct}>
                  {savingProduct ? "Saving…" : "Save Product Main Details"}
                </button>
              </div>

              {/* Main Fields Form */}
              <div className="panel" style={{ padding: 24 }}>
                <h3 style={{ marginBottom: 16 }}>Main Product Details</h3>
                <div className="admin-form-grid-2" style={{ gap: 20 }}>
                  <div className="field">
                    <label>Name</label>
                    <input type="text" value={editFormName} onChange={(e) => setEditFormName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Category (Read-only)</label>
                    <input type="text" value={editingProduct.category} disabled />
                  </div>
                  <div className="field">
                    <label>Price (PKR)</label>
                    <input type="number" value={editFormPrice} onChange={(e) => setEditFormPrice(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Sale Price / Original Price (PKR)</label>
                    <input type="number" value={editFormOldPrice} onChange={(e) => setEditFormOldPrice(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Tag (e.g. NEW, SALE)</label>
                    <input type="text" value={editFormTag} onChange={(e) => setEditFormTag(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Main Image Hero URL</label>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input type="text" style={{ flex: 1 }} value={editFormHero} onChange={(e) => setEditFormHero(e.target.value)} />
                      {editFormHero && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={editFormHero} alt="Preview" width={40} height={40} style={{ objectFit: "cover", borderRadius: 4 }} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="field" style={{ marginTop: 16 }}>
                  <label>Description</label>
                  <textarea rows={3} value={editFormDesc} onChange={(e) => setEditFormDesc(e.target.value)} />
                </div>
              </div>

              {/* Color Galleries & Stock Manager Section */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: 0, color: "var(--admin-text)" }}>Color Galleries &amp; Stock Manager</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--admin-text-soft)" }}>
                      Manage images and size stock levels per color. Select a tab to edit that color.
                    </p>
                  </div>
                  {dirtyColorTabs.size > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--admin-accent)", fontWeight: 600 }}>
                        • Unsaved changes on {dirtyColorTabs.size} tab{dirtyColorTabs.size > 1 ? "s" : ""}
                      </span>
                      <button
                        type="button"
                        className="btn btn-dark btn-sm"
                        onClick={() => {
                          dirtyColorTabs.forEach((cId) => handleSaveColorTab(cId));
                        }}
                      >
                        Save All Dirty Tabs
                      </button>
                    </div>
                  )}
                </div>

                {/* Color Add / Edit Form Modal/Drawer if open */}
                {showColorAddForm && (
                  <div
                    style={{
                      background: "var(--admin-surface-2)",
                      padding: 18,
                      border: "1px solid var(--admin-border)",
                      borderRadius: 6,
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ margin: 0, color: "var(--admin-text)" }}>
                        {editingColorId ? "Edit Color Info" : "Add New Color"}
                      </h4>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "var(--admin-text-soft)", cursor: "pointer", fontSize: 16 }}
                        onClick={() => setShowColorAddForm(false)}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Color Name (e.g. Black)"
                        value={colorNameInput}
                        onChange={(e) => setColorNameInput(e.target.value)}
                        style={{ minWidth: 160 }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="color"
                          value={colorHexInput.startsWith("#") && colorHexInput.length === 7 ? colorHexInput : "#111111"}
                          onChange={(e) => setColorHexInput(e.target.value.toUpperCase())}
                          style={{ width: 42, height: 38, padding: 2, cursor: "pointer", border: "1px solid var(--admin-border)", borderRadius: 4, background: "transparent" }}
                          title="Color Swatch"
                        />
                        <input
                          type="text"
                          placeholder="#111111"
                          value={colorHexInput}
                          onChange={(e) => setColorHexInput(e.target.value)}
                          style={{ width: 100, fontFamily: "monospace", textTransform: "uppercase" }}
                          title="Hex code (e.g. #111111)"
                        />
                      </div>
                      <input
                        type="number"
                        placeholder="Sort Order"
                        value={colorSortInput}
                        onChange={(e) => setColorSortInput(e.target.value)}
                        style={{ width: 85 }}
                        title="Sort order"
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowColorAddForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-dark btn-sm"
                        disabled={savingColor}
                        onClick={() => handleSaveColor(editingColorId || undefined)}
                      >
                        {savingColor ? "Saving…" : editingColorId ? "Update Color Info" : "Save Color"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Color Tabs Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: "1px solid var(--admin-border)",
                    paddingBottom: 12,
                    marginBottom: 20,
                    overflowX: "auto",
                  }}
                >
                  {dbColors.map((c) => {
                    const isSelected = selectedColorId === c.id;
                    const isDirty = dirtyColorTabs.has(c.id);
                    const stockForColor = colorStockMap[c.name] || {};
                    const totalStock = Object.values(stockForColor).reduce((sum, q) => sum + (Number(q) || 0), 0);
                    const isOutOfStock = totalStock === 0;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedColorId(c.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 14px",
                          borderRadius: 6,
                          border: isSelected ? "2px solid var(--admin-accent)" : "1px solid var(--admin-border)",
                          background: isSelected ? "var(--admin-surface-2)" : "var(--admin-surface)",
                          color: "var(--admin-text)",
                          cursor: "pointer",
                          fontWeight: isSelected ? 600 : 400,
                          fontSize: 13,
                          position: "relative",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: c.hex,
                            border: "1px solid var(--admin-border)",
                            display: "inline-block",
                          }}
                        />
                        <span>{c.name}</span>

                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 10,
                            background: isOutOfStock ? "var(--admin-danger-bg)" : totalStock <= 3 ? "var(--admin-warn-bg)" : "var(--admin-surface)",
                            color: isOutOfStock ? "var(--admin-danger)" : totalStock <= 3 ? "var(--admin-warn)" : "var(--admin-text-soft)",
                            fontWeight: 600,
                            border: "1px solid var(--admin-border)",
                          }}
                        >
                          {totalStock} in stock
                        </span>

                        {isOutOfStock && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--admin-danger)" }} title="0 Total Stock" />
                        )}

                        {isDirty && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "var(--admin-accent)",
                            }}
                            title="Unsaved changes"
                          />
                        )}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ padding: "8px 14px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                    onClick={() => {
                      setEditingColorId(null);
                      setColorNameInput("");
                      setColorHexInput("#111111");
                      setColorImagesInput("");
                      setColorSortInput(String(dbColors.length));
                      setShowColorAddForm(true);
                    }}
                  >
                    + Add Color
                  </button>
                </div>

                {/* Active Color Panels */}
                {(() => {
                  const activeColorObj = dbColors.find((c) => c.id === selectedColorId) || dbColors[0] || null;
                  if (!activeColorObj) {
                    return (
                      <div style={{ fontSize: 13, color: "var(--admin-text-soft)", padding: 20 }}>
                        No colors added yet. Click &quot;+ Add Color&quot; above to create one.
                      </div>
                    );
                  }

                  const activeImages = colorImagesMap[activeColorObj.id] || [];
                  const activeStockMap = colorStockMap[activeColorObj.name] || {};
                  const activeTotalStock = Object.values(activeStockMap).reduce((sum, q) => sum + (Number(q) || 0), 0);

                  return (
                    <div>
                      {/* Tab Top Action Bar */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "var(--admin-surface-2)",
                          padding: "12px 16px",
                          borderRadius: 6,
                          marginBottom: 20,
                          border: "1px solid var(--admin-border)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: activeColorObj.hex,
                              border: "1px solid var(--admin-border)",
                            }}
                          />
                          <h4 style={{ margin: 0, color: "var(--admin-text)" }}>{activeColorObj.name}</h4>
                          <span style={{ fontSize: 12, color: "var(--admin-text-soft)", fontFamily: "monospace" }}>
                            ({activeColorObj.hex})
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {dirtyColorTabs.has(activeColorObj.id) && (
                            <button
                              type="button"
                              className="btn btn-dark btn-sm"
                              disabled={savingColor}
                              onClick={() => handleSaveColorTab(activeColorObj.id)}
                            >
                              {savingColor ? "Saving…" : `Save ${activeColorObj.name} Changes`}
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setEditingColorId(activeColorObj.id);
                              setColorNameInput(activeColorObj.name);
                              setColorHexInput(activeColorObj.hex);
                              setColorSortInput(String(activeColorObj.sortOrder ?? 0));
                              setShowColorAddForm(true);
                            }}
                          >
                            Edit Color Info
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ color: "var(--admin-danger)" }}
                            onClick={() => handleDeleteColor(activeColorObj.id)}
                          >
                            Delete Color
                          </button>
                        </div>
                      </div>

                      {/* 2 Panels */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                        {/* PANEL 1: Images */}
                        <div style={{ background: "var(--admin-surface-2)", padding: 18, borderRadius: 8, border: "1px solid var(--admin-border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <h4 style={{ margin: 0, color: "var(--admin-text)", fontSize: 14 }}>
                              Panel 1: Images ({activeImages.length})
                            </h4>
                            <span style={{ fontSize: 11, color: "var(--admin-text-soft)" }}>First image is Cover</span>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                            {activeImages.length === 0 ? (
                              <div style={{ fontSize: 12, color: "var(--admin-text-soft)", padding: "12px 0" }}>
                                No images for this color yet. Paste an image URL below.
                              </div>
                            ) : (
                              activeImages.map((url, idx) => (
                                <div
                                  key={`${url}-${idx}`}
                                  style={{
                                    width: 96,
                                    height: 96,
                                    borderRadius: 6,
                                    border: idx === 0 ? "2px solid var(--admin-accent)" : "1px solid var(--admin-border)",
                                    position: "relative",
                                    overflow: "hidden",
                                    background: "#000",
                                    flexShrink: 0,
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                                  {idx === 0 && (
                                    <span
                                      style={{
                                        position: "absolute",
                                        top: 4,
                                        left: 4,
                                        background: "var(--admin-accent)",
                                        color: "#111",
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: "1px 5px",
                                        borderRadius: 3,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      Cover
                                    </span>
                                  )}

                                  <div
                                    style={{
                                      position: "absolute",
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      background: "rgba(0,0,0,0.75)",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: "2px 4px",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMoveColorImage(activeColorObj.id, idx, -1)}
                                      style={{ background: "none", border: "none", color: "#fff", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: 11 }}
                                      title="Move left"
                                    >
                                      ←
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveColorImage(activeColorObj.id, idx)}
                                      style={{ background: "none", border: "none", color: "var(--admin-danger)", cursor: "pointer", fontSize: 12, fontWeight: "bold" }}
                                      title="Remove image"
                                    >
                                      ✕
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === activeImages.length - 1}
                                      onClick={() => handleMoveColorImage(activeColorObj.id, idx, 1)}
                                      style={{ background: "none", border: "none", color: "#fff", cursor: idx === activeImages.length - 1 ? "default" : "pointer", opacity: idx === activeImages.length - 1 ? 0.3 : 1, fontSize: 11 }}
                                      title="Move right"
                                    >
                                      →
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 12, color: "var(--admin-text-soft)", fontWeight: 500 }}>
                              Paste image URL
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                type="text"
                                placeholder="https://images.unsplash.com/..."
                                value={urlInputMap[activeColorObj.id] || ""}
                                onChange={(e) => setUrlInputMap({ ...urlInputMap, [activeColorObj.id]: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddImageUrl(activeColorObj.id);
                                  }
                                }}
                                style={{ flex: 1, fontSize: 12 }}
                              />
                              <button
                                type="button"
                                className="btn btn-dark btn-sm"
                                onClick={() => handleAddImageUrl(activeColorObj.id)}
                              >
                                Add Image
                              </button>
                            </div>
                            {urlErrorMap[activeColorObj.id] && (
                              <span style={{ fontSize: 11, color: "var(--admin-danger)" }}>
                                {urlErrorMap[activeColorObj.id]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* PANEL 2: Stock */}
                        <div style={{ background: "var(--admin-surface-2)", padding: 18, borderRadius: 8, border: "1px solid var(--admin-border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <h4 style={{ margin: 0, color: "var(--admin-text)", fontSize: 14 }}>
                              Panel 2: Stock ({activeColorObj.name})
                            </h4>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: activeTotalStock === 0 ? "var(--admin-danger)" : activeTotalStock <= 3 ? "var(--admin-warn)" : "var(--admin-accent)",
                              }}
                            >
                              Total: {activeTotalStock} in stock
                            </span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
                            {productSizes.map((sz) => {
                              const currentQty = activeStockMap[sz] ?? 0;
                              const isLow = currentQty > 0 && currentQty <= 3;
                              const isZero = currentQty === 0;

                              return (
                                <div
                                  key={sz}
                                  style={{
                                    background: "var(--admin-surface)",
                                    padding: "8px 10px",
                                    borderRadius: 6,
                                    border: `1px solid ${isZero ? "var(--admin-danger)" : isLow ? "var(--admin-warn)" : "var(--admin-border)"}`,
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text)" }}>{sz}</span>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: isZero ? "var(--admin-danger)" : isLow ? "var(--admin-warn)" : "var(--admin-text-soft)",
                                      }}
                                    >
                                      {isZero ? "Sold out" : isLow ? `Low (${currentQty})` : `${currentQty}`}
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <button
                                      type="button"
                                      style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 4,
                                        border: "1px solid var(--admin-border)",
                                        background: "var(--admin-surface-2)",
                                        color: "var(--admin-text)",
                                        cursor: "pointer",
                                        fontWeight: "bold",
                                      }}
                                      onClick={() => handleUpdateSizeStock(activeColorObj.name, sz, currentQty - 1)}
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      value={currentQty}
                                      onChange={(e) => handleUpdateSizeStock(activeColorObj.name, sz, parseInt(e.target.value || "0", 10))}
                                      style={{
                                        width: "100%",
                                        textAlign: "center",
                                        padding: "2px 4px",
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    />
                                    <button
                                      type="button"
                                      style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 4,
                                        border: "1px solid var(--admin-border)",
                                        background: "var(--admin-surface-2)",
                                        color: "var(--admin-text)",
                                        cursor: "pointer",
                                        fontWeight: "bold",
                                      }}
                                      onClick={() => handleUpdateSizeStock(activeColorObj.name, sz, currentQty + 1)}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, borderTop: "1px solid var(--admin-border)" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: "var(--admin-text-soft)", whiteSpace: "nowrap" }}>Set all sizes to:</span>
                              <input
                                type="number"
                                min={0}
                                placeholder="Qty"
                                value={bulkQtyMap[activeColorObj.id] || ""}
                                onChange={(e) => setBulkQtyMap({ ...bulkQtyMap, [activeColorObj.id]: e.target.value })}
                                style={{ width: 70, fontSize: 12 }}
                              />
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => handleBulkSetStock(activeColorObj.id, activeColorObj.name)}
                              >
                                Apply
                              </button>
                            </div>

                            {dbColors.length > 1 && (
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ fontSize: 12, color: "var(--admin-text-soft)", whiteSpace: "nowrap" }}>Copy stock from:</span>
                                <select
                                  value={copyColorMap[activeColorObj.id] || ""}
                                  onChange={(e) => setCopyColorMap({ ...copyColorMap, [activeColorObj.id]: e.target.value })}
                                  style={{ flex: 1, fontSize: 12 }}
                                >
                                  <option value="">Select color...</option>
                                  {dbColors
                                    .filter((c) => c.id !== activeColorObj.id)
                                    .map((c) => (
                                      <option key={c.id} value={c.name}>
                                        {c.name}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() =>
                                    handleCopyStockFromColor(
                                      activeColorObj.id,
                                      activeColorObj.name,
                                      copyColorMap[activeColorObj.id] || ""
                                    )
                                  }
                                >
                                  Copy
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Sizes Section */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Product Sizes ({productSizes.length})</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--admin-text-soft)" }}>
                      Manage sizes specific to this product. New sizes automatically add rows to the stock matrix below.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={applyingTemplate}
                    onClick={handleApplyCategoryTemplate}
                    title={`Apply default sizes for ${editingProduct.category}`}
                  >
                    {applyingTemplate ? "Applying…" : "Apply Category Template"}
                  </button>
                </div>

                {/* Add Size Form */}
                <form onSubmit={handleAddSize} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <input
                    type="text"
                    placeholder="Add new size (e.g. UK 12 or 40)"
                    value={newSizeInput}
                    onChange={(e) => setNewSizeInput(e.target.value)}
                    style={{ maxWidth: 280 }}
                  />
                  <button type="submit" className="btn btn-dark btn-sm" disabled={addingSize || !newSizeInput.trim()}>
                    {addingSize ? "Adding…" : "+ Add Size"}
                  </button>
                </form>

                {/* Size List / Chips */}
                {productSizes.length === 0 ? (
                  <div style={{ color: "var(--admin-text-soft)", fontSize: 13, padding: "12px 0" }}>
                    No sizes added yet. Click &quot;Apply Category Template&quot; or type a size above.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {productSizes.map((size, idx) => (
                      <div
                        key={size}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          background: "var(--admin-surface-2)",
                          border: "1px solid var(--admin-border)",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 13,
                        }}
                      >
                        {renamingSize === size ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="text"
                              value={renameSizeInput}
                              onChange={(e) => setRenameSizeInput(e.target.value)}
                              style={{ width: 80, padding: "2px 6px", fontSize: 13 }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleRenameSizeSubmit(size);
                                } else if (e.key === "Escape") {
                                  setRenamingSize(null);
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-dark btn-sm"
                              style={{ padding: "2px 6px", fontSize: 11 }}
                              onClick={() => handleRenameSizeSubmit(size)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ padding: "2px 6px", fontSize: 11 }}
                              onClick={() => setRenamingSize(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>{size}</span>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                              <button
                                type="button"
                                title="Move left"
                                disabled={idx === 0}
                                onClick={() => handleReorderSize(idx, -1)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: idx === 0 ? "default" : "pointer",
                                  opacity: idx === 0 ? 0.3 : 0.8,
                                  color: "var(--admin-text)",
                                  padding: 0,
                                  fontSize: 12,
                                }}
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                title="Move right"
                                disabled={idx === productSizes.length - 1}
                                onClick={() => handleReorderSize(idx, 1)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: idx === productSizes.length - 1 ? "default" : "pointer",
                                  opacity: idx === productSizes.length - 1 ? 0.3 : 0.8,
                                  color: "var(--admin-text)",
                                  padding: 0,
                                  fontSize: 12,
                                }}
                              >
                                →
                              </button>
                              <button
                                type="button"
                                title="Rename size"
                                onClick={() => {
                                  setRenamingSize(size);
                                  setRenameSizeInput(size);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--admin-text-soft)",
                                  padding: "0 2px",
                                  fontSize: 12,
                                }}
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                title="Delete size"
                                onClick={() => handleDeleteSize(size)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--admin-danger)",
                                  padding: "0 2px",
                                  fontSize: 14,
                                  lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "courier" ? (
            /* TAB 6: POSTEX COURIER QUEUE */
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>PostEx Courier Batch Queue</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-soft)" }}>
                    Daily 4:00 PM batch booking &amp; 4-hour status tracking sync
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="admin-btn-outline"
                    style={{
                      padding: "8px 14px",
                      fontSize: "13px",
                      fontWeight: 600,
                      borderRadius: "4px",
                      border: "1px solid var(--admin-border)",
                      background: "var(--admin-surface)",
                      color: "var(--admin-text)",
                      cursor: "pointer",
                    }}
                    disabled={healthLoading}
                    onClick={handleTestPostexConnection}
                  >
                    {healthLoading ? "Testing Connection…" : "⚡ Test PostEx Connection"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-dark"
                    disabled={courierActionId === "batch"}
                    onClick={handleRunBatchNow}
                  >
                    {courierActionId === "batch" ? "Processing Batch…" : "▶ Run Batch Booking Now"}
                  </button>
                </div>
              </div>

              {/* Health Check Result Card */}
              {postexHealth && (
                <div
                  style={{
                    padding: "16px 20px",
                    borderRadius: "8px",
                    border: postexHealth.ok ? "1px solid #bbf7d0" : "1px solid #fecaca",
                    backgroundColor: postexHealth.ok ? "#f0fdf4" : "#fef2f2",
                    color: postexHealth.ok ? "#166534" : "#991b1b",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: "14px" }}>
                      {postexHealth.ok ? "✓ PostEx Connection Active (PASS)" : `✗ PostEx Connection Failed [${postexHealth.code}]`}
                    </div>
                    <div style={{ fontSize: "12px", fontFamily: "monospace", opacity: 0.9 }}>
                      Token Length: {postexHealth.tokenLength} chars
                    </div>
                  </div>
                  {postexHealth.ok ? (
                    <div style={{ fontSize: "13px", marginTop: 6 }}>
                      Merchant Address Codes: <strong>{postexHealth.addresses?.join(", ") || "None returned"}</strong>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: "13px", lineHeight: "1.4" }}>
                      <div><strong>Error:</strong> {postexHealth.message}</div>
                      <div style={{ marginTop: 6, fontSize: "12px", opacity: 0.95 }}>
                        {postexHealth.tokenLength === 0 || postexHealth.code === "CONFIG" ? (
                          <span>💡 <strong>Cause &amp; Fix:</strong> POSTEX_API_TOKEN is not set on this server. Add <code>POSTEX_API_TOKEN</code> (and <code>POSTEX_BASE_URL</code>, <code>POSTEX_PICKUP_ADDRESS_CODE</code>) in your hosting dashboard, then redeploy.</span>
                        ) : postexHealth.code === "AUTH" ? (
                          <span>💡 <strong>Cause &amp; Fix:</strong> Token rejected (401/403). Re-paste the token in hosting settings or regenerate it in the PostEx portal.</span>
                        ) : (
                          <span>💡 <strong>Cause &amp; Fix:</strong> Check server network/timeout. Retryable: {String(postexHealth.code === "TIMEOUT" || postexHealth.code === "SERVER" || postexHealth.code === "NETWORK")}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {courierLoading ? (
                <div>Loading courier queue…</div>
              ) : (
                <>
                  {/* Section 1: Awaiting Manual Approval */}
                  <div className="panel" style={{ padding: 20 }}>
                    <h3>1. Awaiting Manual Approval ({courierQueue.awaitingApproval.length})</h3>
                    {courierQueue.awaitingApproval.length === 0 ? (
                      <div style={{ color: "var(--admin-text-soft)", fontSize: 13.5, marginTop: 8 }}>
                        No orders currently awaiting manual review.
                      </div>
                    ) : (
                      <div className="table-scroll" style={{ marginTop: 12 }}>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Order ID</th>
                              <th>Customer / City</th>
                              <th>Total</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courierQueue.awaitingApproval.map((o) => (
                              <tr key={o.id}>
                                <td><strong>#{o.id.slice(-8)}</strong></td>
                                <td>
                                  <div>{o.customerName}</div>
                                  <div style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>{o.shippingInfo?.city || "Unknown"}</div>
                                </td>
                                <td>{fmtPrice(o.total)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-dark btn-sm"
                                    disabled={courierActionId === `approve-${o.id}`}
                                    onClick={() => handleApproveOrder(o.id)}
                                  >
                                    Approve for Booking
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Failed Bookings */}
                  <div className="panel" style={{ padding: 20, borderLeft: "4px solid var(--admin-danger)" }}>
                    <h3 style={{ color: "var(--admin-danger)" }}>2. Failed Bookings ({courierQueue.failedBookings.length})</h3>
                    {courierQueue.failedBookings.length === 0 ? (
                      <div style={{ color: "var(--admin-text-soft)", fontSize: 13.5, marginTop: 8 }}>
                        No failed bookings recorded.
                      </div>
                    ) : (
                      <div className="table-scroll" style={{ marginTop: 12 }}>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Order ID</th>
                              <th>Customer / City</th>
                              <th>Error Details</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courierQueue.failedBookings.map((o) => {
                              const errLog = o.bookingLogs?.[0]?.errorMessage || "PostEx API Error";
                              return (
                                <tr key={o.id}>
                                  <td><strong>#{o.id.slice(-8)}</strong></td>
                                  <td>
                                    <div>{o.customerName}</div>
                                    <div style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>{o.shippingInfo?.city}</div>
                                  </td>
                                  <td>
                                    <span style={{ color: "var(--admin-danger)", fontSize: 12, fontFamily: "monospace" }}>
                                      {errLog}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      style={{ color: "var(--admin-danger)" }}
                                      disabled={courierActionId === `retry-${o.id}`}
                                      onClick={() => handleRetryOrder(o.id)}
                                    >
                                      Retry Booking
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Queued for Next Batch */}
                  <div className="panel" style={{ padding: 20 }}>
                    <h3>3. Queued for Next Batch ({courierQueue.queuedForBatch.length})</h3>
                    {courierQueue.queuedForBatch.length === 0 ? (
                      <div style={{ color: "var(--admin-text-soft)", fontSize: 13.5, marginTop: 8 }}>
                        No orders queued for next daily batch.
                      </div>
                    ) : (
                      <div className="table-scroll" style={{ marginTop: 12 }}>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Order ID</th>
                              <th>Customer / City</th>
                              <th>Status Type</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courierQueue.queuedForBatch.map((o) => (
                              <tr key={o.id}>
                                <td><strong>#{o.id.slice(-8)}</strong></td>
                                <td>
                                  <div>{o.customerName}</div>
                                  <div style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>{o.shippingInfo?.city}</div>
                                </td>
                                <td>
                                  <span className="badge" style={{ background: "var(--admin-surface-2)" }}>
                                    {o.courierBookingStatus === "pending_auto" ? "Auto City" : "Approved Manual"}
                                  </span>
                                </td>
                                <td>{fmtPrice(o.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section 4: Auto-Book Cities */}
                  <div className="panel" style={{ padding: 20 }}>
                    <h3>4. Auto-Book Cities Configuration</h3>
                    <p style={{ fontSize: 13, color: "var(--admin-text-soft)", marginBottom: 16 }}>
                      Orders placed from auto-book cities skip manual review and are queued for daily batch booking automatically.
                    </p>

                    <form onSubmit={handleAddAutoCity} style={{ display: "flex", gap: 10, marginBottom: 20, maxWidth: 480 }}>
                      <input
                        type="text"
                        placeholder="City name (e.g. Rawalpindi)"
                        value={newCityInput}
                        onChange={(e) => setNewCityInput(e.target.value)}
                        required
                      />
                      <button type="submit" className="btn btn-dark btn-sm">
                        Add City
                      </button>
                    </form>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {courierCities.defaultCities.map((c) => (
                        <span key={c} className="badge" style={{ background: "var(--admin-success-bg)", color: "var(--admin-success)", padding: "6px 12px", fontSize: 13 }}>
                          {c} (Default Auto)
                        </span>
                      ))}
                      {courierCities.dbCities.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="badge"
                          onClick={() => handleToggleAutoCity(c.cityName, c.enabled)}
                          style={{
                            cursor: "pointer",
                            padding: "6px 12px",
                            fontSize: 13,
                            background: c.enabled ? "var(--admin-success-bg)" : "var(--admin-surface-2)",
                            color: c.enabled ? "var(--admin-success)" : "var(--admin-text-soft)",
                            border: "1px solid var(--admin-border)",
                          }}
                        >
                          {c.cityName} {c.enabled ? "✓" : "(Disabled)"}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : activeTab === "size-charts" ? (
            /* TAB 7: SIZE CHARTS MANAGER */
            <div className="panel" style={{ padding: 24, maxWidth: 640 }}>
              <h3>Size Charts Manager</h3>
              <p style={{ fontSize: 13, color: "var(--admin-text-soft)", marginBottom: 16 }}>
                Manage default size choices for each product category on PDP.
              </p>

              {/* Category Selector Tabs */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {sizeChartCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`btn btn-sm ${activeSizeCategory === cat ? "btn-dark" : "btn-outline"}`}
                    onClick={() => {
                      setActiveSizeCategory(cat);
                      loadSizeChart(cat);
                    }}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Size Rows Table */}
              <div className="table-scroll" style={{ marginBottom: 16 }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>#</th>
                      <th>Size Label</th>
                      <th style={{ width: 80 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizeChartRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", padding: 24 }}>
                          No sizes added yet for {activeSizeCategory}.
                        </td>
                      </tr>
                    ) : (
                      sizeChartRows.map((sz, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <input
                              type="text"
                              value={sz}
                              onChange={(e) => {
                                const next = [...sizeChartRows];
                                next[idx] = e.target.value;
                                setSizeChartRows(next);
                              }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setSizeChartRows(sizeChartRows.filter((_, i) => i !== idx))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setSizeChartRows([...sizeChartRows, ""])}
                >
                  + Add Size Row
                </button>
                <button
                  type="button"
                  className="btn btn-dark btn-sm"
                  disabled={savingSizeChart}
                  onClick={handleSaveSizeChart}
                >
                  {savingSizeChart ? "Saving…" : `Save ${activeSizeCategory.toUpperCase()} Chart`}
                </button>
              </div>
            </div>
          ) : (
            /* TAB 8: SETTINGS */
            <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
              <div className="panel" style={{ padding: 24 }}>
                <h3>Category Low-Stock Thresholds</h3>
                <p style={{ fontSize: 13, color: "var(--admin-text-soft)", marginBottom: 16 }}>
                  Products with total stock below threshold will display a yellow low-stock warning badge.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {["crocs", "trousers"].map((cat) => (
                    <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--admin-surface-2)", padding: 12, borderRadius: 6 }}>
                      <label style={{ fontWeight: 700, textTransform: "capitalize" }}>{cat} Threshold:</label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="number"
                          style={{ width: 100 }}
                          value={settingDrafts[cat] ?? "20"}
                          onChange={(e) => setSettingDrafts({ ...settingDrafts, [cat]: e.target.value })}
                          min={0}
                        />
                        <button
                          type="button"
                          className="btn btn-dark btn-sm"
                          disabled={savingSettingCategory === cat}
                          onClick={() => handleSaveSettingThreshold(cat)}
                        >
                          {savingSettingCategory === cat ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Product Modal Overlay */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Add Product</h3>
              <button type="button" className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddProduct}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="field">
                  <label>Name *</label>
                  <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
                </div>
                <div className="admin-form-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                  <div className="field">
                    <label>Category *</label>
                    <select value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}>
                      <option value="crocs">Crocs</option>
                      <option value="trousers">Trousers</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Tag</label>
                    <input type="text" placeholder="e.g. NEW" value={addForm.tag} onChange={(e) => setAddForm({ ...addForm, tag: e.target.value })} />
                  </div>
                </div>
                <div className="admin-form-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                  <div className="field">
                    <label>Price (PKR) *</label>
                    <input type="number" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Old Price (PKR)</label>
                    <input type="number" value={addForm.oldPrice} onChange={(e) => setAddForm({ ...addForm, oldPrice: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>Main Image Hero URL</label>
                  <input type="text" value={addForm.hero} onChange={(e) => setAddForm({ ...addForm, hero: e.target.value })} />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea rows={3} value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
                </div>
                <div className="field">
                  <label>Gallery URLs (comma-separated)</label>
                  <input type="text" placeholder="https://…, https://…" value={addForm.galleryRaw} onChange={(e) => setAddForm({ ...addForm, galleryRaw: e.target.value })} />
                </div>
                <div className="field">
                  <label>Colors (comma-separated names)</label>
                  <input type="text" placeholder="Black, White, Navy" value={addForm.colorsRaw} onChange={(e) => setAddForm({ ...addForm, colorsRaw: e.target.value })} />
                </div>
                <div className="field">
                  <label>Sizes (comma-separated)</label>
                  <input type="text" placeholder="UK 6, UK 7, UK 8" value={addForm.sizesRaw} onChange={(e) => setAddForm({ ...addForm, sizesRaw: e.target.value })} />
                </div>
                <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" id="addIsSale" checked={addForm.isSale} onChange={(e) => setAddForm({ ...addForm, isSale: e.target.checked })} />
                  <label htmlFor="addIsSale" style={{ margin: 0 }}>Mark as Sale Item</label>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-dark btn-sm" disabled={addingProduct}>
                  {addingProduct ? "Creating…" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
