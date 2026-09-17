"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  postexTrackingNumber?: string | null;
  postexStatus?: string | null;
  courierBookingStatus?: string | null;
  adminApproved?: boolean;
  user?: { id: string; email: string; name?: string | null } | null;
  orderItems: OrderItem[];
  bookingLogs?: BookingLog[];
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
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

  // Edit Panel — Variants Matrix Sub-section
  const [dbVariants, setDbVariants] = useState<ProductVariant[]>([]);
  const [showVariantAddForm, setShowVariantAddForm] = useState(false);
  const [variantColorInput, setVariantColorInput] = useState("");
  const [variantSizeInput, setVariantSizeInput] = useState("");
  const [variantStockInput, setVariantStockInput] = useState("0");
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
          setDbColors(Array.isArray(data) ? data : []);
        }
      } catch {
        setDbColors([]);
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
            for (const v of flat) {
              drafts[`${v.color}|${v.size}`] = String(v.stock);
            }
            setCellStockDrafts(drafts);
          }
        }
      } catch {
        setDbVariants([]);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("nanosAdminTheme_v1") as "light" | "dark" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
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
    setShowVariantAddForm(false);
    setActiveTab("edit-product");

    loadEditColors(p.id);
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
    setSavingColor(true);
    try {
      const isEdit = !!colorId;
      const images = colorImagesInput.split("\n").map((s) => s.trim()).filter(Boolean);
      const payload = {
        name: colorNameInput.trim(),
        hex: colorHexInput,
        imagesJson: JSON.stringify(images),
        sortOrder: Number(colorSortInput) || 0,
      };

      const url = isEdit
        ? `/api/admin/products/${editingProduct.id}/colors/${colorId}`
        : `/api/admin/products/${editingProduct.id}/colors`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await authFetch(url, { method, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed to save color");
      showToast(isEdit ? "Color updated!" : "Color added!");
      setShowColorAddForm(false);
      setEditingColorId(null);
      setColorNameInput("");
      setColorHexInput("#111111");
      setColorImagesInput("");
      setColorSortInput("0");
      loadEditColors(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to save color", "error");
    } finally {
      setSavingColor(false);
    }
  }

  // Delete DB Color
  async function handleDeleteColor(colorId: string) {
    if (!editingProduct || !window.confirm("Delete this color?")) return;
    try {
      const res = await authFetch(`/api/admin/products/${editingProduct.id}/colors/${colorId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete color");
      showToast("Color deleted!");
      loadEditColors(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to delete color", "error");
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

  // Add Variant Form Submit
  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct || !variantColorInput.trim() || !variantSizeInput.trim()) return;
    try {
      const payload = {
        color: variantColorInput.trim(),
        size: variantSizeInput.trim(),
        stock: Number(variantStockInput) || 0,
      };

      const res = await authFetch(`/api/admin/products/${editingProduct.id}/variants`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add variant");
      showToast("Variant added!");
      setShowVariantAddForm(false);
      setVariantColorInput("");
      setVariantSizeInput("");
      setVariantStockInput("0");
      loadEditVariants(editingProduct.id);
    } catch (err: any) {
      showToast(err.message || "Failed to add variant", "error");
    }
  }

  // Order Status Update (PATCH)
  async function handleUpdateOrderStatus(orderId: string, status: string) {
    setUpdatingStatusId(orderId);
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      showToast(`Order status updated to ${status}`);
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
    } catch {
      showToast("Batch booking failed", "error");
    } finally {
      setCourierActionId(null);
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
          <div className="sidebar-header">
            <Link href="/" className="brand-font">
              nanos.pk
            </Link>
          </div>

          <div className="sidebar-section-label">Overview</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => switchTab("dashboard")}
          >
            <span>◆ Dashboard</span>
          </button>

          <div className="sidebar-section-label">Orders</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => switchTab("orders")}
          >
            <span>▤ Orders</span>
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
            <span>✓ Delivered Orders</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "courier" ? "active" : ""}`}
            onClick={() => switchTab("courier")}
          >
            <span>🚚 Courier Queue</span>
          </button>

          <div className="sidebar-section-label">Catalog</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "products" || activeTab === "edit-product" ? "active" : ""}`}
            onClick={() => switchTab("products")}
          >
            <span>▦ Products</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "size-charts" ? "active" : ""}`}
            onClick={() => switchTab("size-charts")}
          >
            <span>📏 Size Charts</span>
          </button>

          <div className="sidebar-section-label">System</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => switchTab("settings")}
          >
            <span>⚙ Settings</span>
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
            style={{ color: "var(--admin-danger)", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
          >
            ⏻
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
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
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
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, fontSize: 13, marginBottom: 16 }}>
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
                                        <select
                                          value={o.status}
                                          disabled={updatingStatusId === o.id}
                                          onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                                        >
                                          <option value="processing">Processing</option>
                                          <option value="shipped">Shipped</option>
                                          <option value="delivered">Delivered</option>
                                          <option value="cancelled">Cancelled</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Items List */}
                                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Order Items</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {o.orderItems.map((item) => (
                                      <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", padding: "8px 12px", borderRadius: 4 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                          {item.product?.hero && (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={item.product.hero} alt="" width={32} height={32} style={{ objectFit: "cover", borderRadius: 4 }} />
                                          )}
                                          <div>
                                            <strong>{item.product?.name || item.productId}</strong> ({item.color}/{item.size})
                                          </div>
                                        </div>
                                        <div>
                                          {item.quantity} × {fmtPrice(item.price)} = <strong>{fmtPrice(item.quantity * item.price)}</strong>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
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

                {/* Gallery Images List */}
                <div className="field" style={{ marginTop: 16 }}>
                  <label>Gallery Image URLs</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {editFormGallery.map((url, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="text"
                          style={{ flex: 1 }}
                          value={url}
                          onChange={(e) => {
                            const next = [...editFormGallery];
                            next[i] = e.target.value;
                            setEditFormGallery(next);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setEditFormGallery(editFormGallery.filter((_, idx) => idx !== i))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ alignSelf: "flex-start" }}
                      onClick={() => setEditFormGallery([...editFormGallery, ""])}
                    >
                      + Add Gallery Image URL
                    </button>
                  </div>
                </div>
              </div>

              {/* Colors Section */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3>Database Colors ({dbColors.length})</h3>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setEditingColorId(null);
                      setColorNameInput("");
                      setColorHexInput("#111111");
                      setColorImagesInput("");
                      setColorSortInput("0");
                      setShowColorAddForm(!showColorAddForm);
                    }}
                  >
                    {showColorAddForm ? "Cancel" : "+ Add Color"}
                  </button>
                </div>

                {/* Color Cards List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  {dbColors.map((c) => {
                    let imgCount = 0;
                    try {
                      const parsed = JSON.parse(c.imagesJson || "[]");
                      imgCount = Array.isArray(parsed) ? parsed.length : 0;
                    } catch {
                      imgCount = 0;
                    }

                    return (
                      <div key={c.id} style={{ border: "1px solid var(--admin-border)", padding: 14, borderRadius: 6, background: "var(--admin-surface-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className="colour-swatch" style={{ background: c.hex, width: 24, height: 24, borderRadius: "50%", display: "inline-block" }} />
                            <strong>{c.name}</strong> ({c.hex})
                            <span style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>
                              (Sort order: {c.sortOrder}, {imgCount} images)
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                setEditingColorId(c.id);
                                setColorNameInput(c.name);
                                setColorHexInput(c.hex);
                                try {
                                  const parsed = JSON.parse(c.imagesJson || "[]");
                                  setColorImagesInput(Array.isArray(parsed) ? parsed.join("\n") : "");
                                } catch {
                                  setColorImagesInput("");
                                }
                                setColorSortInput(String(c.sortOrder ?? 0));
                                setShowColorAddForm(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ color: "var(--admin-danger)" }}
                              onClick={() => handleDeleteColor(c.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Color Form */}
                {showColorAddForm && (
                  <div style={{ background: "#fff", padding: 16, border: "1px solid var(--admin-border)", borderRadius: 6, display: "flex", flexDirection: "column", gap: 12 }}>
                    <h4>{editingColorId ? "Edit Color" : "Add Color"}</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12 }}>
                      <input type="text" placeholder="Color Name (e.g. Black)" value={colorNameInput} onChange={(e) => setColorNameInput(e.target.value)} />
                      <input type="color" value={colorHexInput} onChange={(e) => setColorHexInput(e.target.value)} style={{ width: 44, height: 38, padding: 0 }} />
                      <input type="number" placeholder="Sort Order" value={colorSortInput} onChange={(e) => setColorSortInput(e.target.value)} style={{ width: 90 }} />
                    </div>
                    <textarea rows={3} placeholder="Image URLs (one per line)" value={colorImagesInput} onChange={(e) => setColorImagesInput(e.target.value)} />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowColorAddForm(false)}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-dark btn-sm" disabled={savingColor} onClick={() => handleSaveColor(editingColorId || undefined)}>
                        {savingColor ? "Saving…" : "Save Color"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Variants Stock Matrix Section */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3>Variants &amp; Stock Matrix</h3>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowVariantAddForm(!showVariantAddForm)}>
                    {showVariantAddForm ? "Cancel" : "+ Add Variant"}
                  </button>
                </div>

                {showVariantAddForm && (
                  <form onSubmit={handleAddVariant} style={{ display: "flex", gap: 10, marginBottom: 16, background: "var(--admin-surface-2)", padding: 12, borderRadius: 6 }}>
                    <input type="text" placeholder="Color" value={variantColorInput} onChange={(e) => setVariantColorInput(e.target.value)} required />
                    <input type="text" placeholder="Size" value={variantSizeInput} onChange={(e) => setVariantSizeInput(e.target.value)} style={{ width: 100 }} required />
                    <input type="number" placeholder="Stock" value={variantStockInput} onChange={(e) => setVariantStockInput(e.target.value)} style={{ width: 90 }} min={0} required />
                    <button type="submit" className="btn btn-dark btn-sm">
                      Save Variant
                    </button>
                  </form>
                )}

                {/* Matrix Grid: Rows = sizes, Cols = colors */}
                {(() => {
                  const colorsList = Array.from(new Set(dbVariants.map((v) => v.color))).sort();
                  const sizesList = Array.from(new Set(dbVariants.map((v) => v.size))).sort();

                  if (colorsList.length === 0 || sizesList.length === 0) {
                    return <div style={{ color: "var(--admin-text-soft)", fontSize: 13 }}>No variants added yet. Click "+ Add Variant" to create rows.</div>;
                  }

                  return (
                    <div className="table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Size / Color</th>
                            {colorsList.map((c) => (
                              <th key={c}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sizesList.map((s) => (
                            <tr key={s}>
                              <td><strong>{s}</strong></td>
                              {colorsList.map((c) => {
                                const key = `${c}|${s}`;
                                const variant = dbVariants.find((v) => v.color === c && v.size === s);
                                const isSavingCell = cellSaving[key];

                                return (
                                  <td key={key}>
                                    {variant ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <input
                                          type="number"
                                          style={{ width: 70 }}
                                          value={cellStockDrafts[key] ?? String(variant.stock)}
                                          onChange={(e) => setCellStockDrafts({ ...cellStockDrafts, [key]: e.target.value })}
                                          onBlur={() => handleVariantCellBlur(c, s)}
                                          min={0}
                                        />
                                        {isSavingCell && <span style={{ fontSize: 11, color: "var(--admin-text-soft)" }}>saving…</span>}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : activeTab === "courier" ? (
            /* TAB 6: POSTEX COURIER QUEUE */
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0 }}>PostEx Courier Batch Queue</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-soft)" }}>
                    Daily 4:00 PM batch booking &amp; 4-hour status tracking sync
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-dark"
                  disabled={courierActionId === "batch"}
                  onClick={handleRunBatchNow}
                >
                  {courierActionId === "batch" ? "Processing Batch…" : "▶ Run Batch Booking Now"}
                </button>
              </div>

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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
