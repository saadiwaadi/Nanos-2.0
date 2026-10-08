"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { allowedNext, OrderStatus } from "@/lib/order-state";
import { HomePageManager } from "@/components/admin/HomePageManager";

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
  ignoreStock?: boolean;
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

interface OrderAuditLog {
  id: string;
  orderId?: string;
  action: string;
  adminUser: string;
  note?: string | null;
  createdAt: string;
}

interface AdminOrder {
  id: string;
  orderStatus?: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  notes?: string | null;
  shippingInfo: any;
  payment: string;
  guestEmail?: string | null;
  guestName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  createdAt: string;
  version?: number;
  isTest?: boolean;
  trackingNumber?: string | null;
  postexTrackingNumber?: string | null;
  postexStatus?: string | null;
  courierBookingStatus?: string | null;
  courierStatusRaw?: string | null;
  adminApproved?: boolean;
  user?: { id: string; email: string; name?: string | null } | null;
  orderItems: OrderItem[];
  bookingLogs?: BookingLog[];
  events?: any[];
  auditLogs?: OrderAuditLog[];
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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-PK", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
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

// ─── MINIMAL SVG ICONS ─────────────────────────────────

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function IconEdit({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconMessage({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconClock({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconSave({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function IconAlert({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconZap({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconExternalLink({ size = 11, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconRefresh({ size = 11, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconLock({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconPlus({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash({ size = 13, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
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

function getAuthUser(): { id?: string; email?: string; name?: string; role?: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("nanos_auth_v1");
  if (!raw) return null;
  try {
    return JSON.parse(raw).user || null;
  } catch {
    return null;
  }
}

// ─── MAIN COMPONENT ────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState("admin@nanos.pk");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "home"
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Live Sync & Saving State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSaved, setSyncSaved] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Data states
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Orders Tab Filters & Lifecycle
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusTab, setOrderStatusTab] = useState<
    "all" | "on_hold" | "ready_to_ship" | "booked" | "delivered" | "cancelled"
  >("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderCustomerFilter, setOrderCustomerFilter] = useState("all");
  const [orderDateFilter, setOrderDateFilter] = useState("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    danger?: boolean;
    requiresReason?: boolean;
    reasonPlaceholder?: string;
    onConfirm: (reason?: string) => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    actionLabel: "Confirm",
    onConfirm: async () => {},
  });
  const [modalReasonInput, setModalReasonInput] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

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

  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [editFormName, setEditFormName] = useState("");
  const [editFormDesc, setEditFormDesc] = useState("");
  const [editFormPrice, setEditFormPrice] = useState("");
  const [editFormOldPrice, setEditFormOldPrice] = useState("");
  const [editFormTag, setEditFormTag] = useState("");
  const [editFormHero, setEditFormHero] = useState("");
  const [editFormGallery, setEditFormGallery] = useState<string[]>([]);
  const [editFormIgnoreStock, setEditFormIgnoreStock] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Bundle Pricing Settings & Product Override State
  const [bundleSettings, setBundleSettings] = useState<{
    defaultBuy2DiscountPercent: number;
    defaultBuy3DiscountPercent: number;
    products: Record<string, {
      buy2Price?: number | null;
      buy3Price?: number | null;
      buy2DiscountText?: string | null;
      buy3DiscountText?: string | null;
      enabled?: boolean;
    }>;
  }>({
    defaultBuy2DiscountPercent: 10,
    defaultBuy3DiscountPercent: 15,
    products: {},
  });
  const [savingBundleSettings, setSavingBundleSettings] = useState(false);
  const [editBundleEnabled, setEditBundleEnabled] = useState(true);
  const [editBuy2Price, setEditBuy2Price] = useState("");
  const [editBuy2DiscountText, setEditBuy2DiscountText] = useState("");
  const [editBuy3Price, setEditBuy3Price] = useState("");
  const [editBuy3DiscountText, setEditBuy3DiscountText] = useState("");

  // Promo Settings State
  const [promoSettings, setPromoSettings] = useState<{
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    minOrderAmount: number;
    enabled: boolean;
    description: string;
  }>({
    code: "NANOS10",
    discountType: "percent",
    discountValue: 10,
    minOrderAmount: 0,
    enabled: true,
    description: "10% off",
  });
  const [savingPromoSettings, setSavingPromoSettings] = useState(false);

  // Delivery & Shipping Fee Settings State
  const [shippingSettings, setShippingSettings] = useState<{
    standardDeliveryFee: number;
    freeDeliveryThreshold: number;
    enabled: boolean;
  }>({
    standardDeliveryFee: 250,
    freeDeliveryThreshold: 5000,
    enabled: true,
  });
  const [savingShippingSettings, setSavingShippingSettings] = useState(false);

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

  // Remarks & PostEx Shipper Advice State
  const [remarksOrder, setRemarksOrder] = useState<AdminOrder | null>(null);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [remarksSubmitting, setRemarksSubmitting] = useState(false);
  const [remarksInput, setRemarksInput] = useState("");
  const [remarksStatusId, setRemarksStatusId] = useState<number>(0);
  const [remarksSyncPostex, setRemarksSyncPostex] = useState<boolean>(true);
  const [remarksHistory, setRemarksHistory] = useState<{
    localRemarks: any[];
    postexRemarks: any[];
    trackingNumber: string | null;
  }>({ localRemarks: [], postexRemarks: [], trackingNumber: null });
  const [remarksErrorDetail, setRemarksErrorDetail] = useState<{
    code: string;
    category?: string;
    severity?: string;
    title: string;
    message: string;
    resolution: string;
  } | null>(null);

  // Edit Order Modal State
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null);
  const [editOrderForm, setEditOrderForm] = useState<{
    customerName: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    notes: string;
    adminNote: string;
    shippingFee: number;
    payment: string;
    items: Array<{
      id: string;
      productId: string;
      name: string;
      color: string;
      size: string;
      quantity: number;
      price: number;
      hero?: string;
    }>;
  }>({
    customerName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    notes: "",
    adminNote: "",
    shippingFee: 0,
    payment: "cod",
    items: [],
  });
  const [savingEditOrder, setSavingEditOrder] = useState(false);
  const [editOrderError, setEditOrderError] = useState<string | null>(null);

  // Quick New Order Modal State
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [creatingNewOrder, setCreatingNewOrder] = useState(false);
  const [newOrderError, setNewOrderError] = useState<string | null>(null);
  const [newOrderForm, setNewOrderForm] = useState<{
    customerName: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    notes: string;
    adminNote: string;
    payment: string;
    orderStatus: string;
    shippingFee: number;
    discount: number;
    reserveInventory: boolean;
    isTest: boolean;
    items: Array<{
      productId: string;
      sku: string;
      name: string;
      color: string;
      size: string;
      quantity: number;
      price: number;
      hero?: string;
    }>;
  }>({
    customerName: "",
    phone: "",
    email: "",
    address: "",
    city: "KARACHI",
    notes: "",
    adminNote: "",
    payment: "cod",
    orderStatus: "READY_TO_SHIP",
    shippingFee: 0,
    discount: 0,
    reserveInventory: true,
    isTest: false,
    items: [],
  });

  // New Order line item selector draft state
  const [newOrderSelectedProdId, setNewOrderSelectedProdId] = useState<string>("");
  const [newOrderSelectedColor, setNewOrderSelectedColor] = useState<string>("");
  const [newOrderSelectedSize, setNewOrderSelectedSize] = useState<string>("");
  const [newOrderSelectedQty, setNewOrderSelectedQty] = useState<number>(1);
  const [newOrderCustomPrice, setNewOrderCustomPrice] = useState<string>("");

  const getProductColors = (p?: AdminProduct | null): string[] => {
    if (!p) return [];
    if (Array.isArray(p.productColors) && p.productColors.length > 0) {
      return p.productColors.map((c) => c.name).filter(Boolean);
    }
    if (Array.isArray(p.colors) && p.colors.length > 0) {
      return p.colors.map((c) => (typeof c === "string" ? c : c?.name)).filter(Boolean);
    }
    return ["Standard"];
  };

  const getProductSizes = (p?: AdminProduct | null): string[] => {
    if (!p) return [];
    if (Array.isArray(p.sizes) && p.sizes.length > 0) {
      return p.sizes.filter(Boolean);
    }
    return ["Standard"];
  };

  const openNewOrderModal = () => {
    setNewOrderError(null);
    const firstProd = products[0];
    const initialProdId = firstProd ? firstProd.id : "";
    setNewOrderSelectedProdId(initialProdId);
    if (firstProd) {
      const colors = getProductColors(firstProd);
      const sizes = getProductSizes(firstProd);
      setNewOrderSelectedColor(colors[0] || "Standard");
      setNewOrderSelectedSize(sizes[0] || "Standard");
      setNewOrderSelectedQty(1);
      setNewOrderCustomPrice(String(firstProd.price || ""));
    } else {
      setNewOrderSelectedColor("Standard");
      setNewOrderSelectedSize("Standard");
      setNewOrderSelectedQty(1);
      setNewOrderCustomPrice("");
    }
    setNewOrderForm({
      customerName: "",
      phone: "",
      email: "",
      address: "",
      city: "KARACHI",
      notes: "",
      adminNote: "",
      payment: "cod",
      orderStatus: "READY_TO_SHIP",
      shippingFee: 0,
      discount: 0,
      reserveInventory: true,
      isTest: false,
      items: [],
    });
    setShowNewOrderModal(true);
  };

  const handleSelectNewOrderProduct = (prodId: string) => {
    setNewOrderSelectedProdId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      const colors = getProductColors(prod);
      const sizes = getProductSizes(prod);
      setNewOrderSelectedColor(colors[0] || "Standard");
      setNewOrderSelectedSize(sizes[0] || "Standard");
      setNewOrderCustomPrice(String(prod.price || ""));
    }
  };

  const handleAddItemToNewOrder = () => {
    const prod = products.find((p) => p.id === newOrderSelectedProdId);
    if (!prod) {
      setNewOrderError("Please select a product.");
      return;
    }
    setNewOrderError(null);
    const price = newOrderCustomPrice !== "" && !isNaN(Number(newOrderCustomPrice))
      ? Math.max(0, Number(newOrderCustomPrice))
      : prod.price || 0;
    const qty = Math.max(1, newOrderSelectedQty || 1);
    const color = newOrderSelectedColor || "Standard";
    const size = newOrderSelectedSize || "Standard";

    // Check if matching item is already in list
    const existingIndex = newOrderForm.items.findIndex(
      (it) => it.productId === prod.id && it.color === color && it.size === size
    );

    if (existingIndex >= 0) {
      const updated = [...newOrderForm.items];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].price = price;
      setNewOrderForm({ ...newOrderForm, items: updated });
    } else {
      setNewOrderForm({
        ...newOrderForm,
        items: [
          ...newOrderForm.items,
          {
            productId: prod.id,
            sku: prod.sku,
            name: prod.name,
            color,
            size,
            quantity: qty,
            price,
            hero: prod.hero,
          },
        ],
      });
    }
  };

  const handleRemoveItemFromNewOrder = (index: number) => {
    setNewOrderForm({
      ...newOrderForm,
      items: newOrderForm.items.filter((_, idx) => idx !== index),
    });
  };

  const handleUpdateItemQtyInNewOrder = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItemFromNewOrder(index);
      return;
    }
    const updated = [...newOrderForm.items];
    updated[index] = { ...updated[index], quantity: newQty };
    setNewOrderForm({ ...newOrderForm, items: updated });
  };

  const handleCreateNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.customerName.trim()) {
      setNewOrderError("Customer name is required.");
      return;
    }
    if (!newOrderForm.phone.trim()) {
      setNewOrderError("Customer phone number is required.");
      return;
    }
    if (!newOrderForm.address.trim()) {
      setNewOrderError("Delivery address is required.");
      return;
    }
    if (!newOrderForm.city.trim()) {
      setNewOrderError("City is required.");
      return;
    }
    if (newOrderForm.items.length === 0) {
      setNewOrderError("Please add at least one product item to the order.");
      return;
    }

    setCreatingNewOrder(true);
    setNewOrderError(null);

    try {
      const payload = {
        customerName: newOrderForm.customerName.trim(),
        phone: newOrderForm.phone.trim(),
        email: newOrderForm.email.trim() || undefined,
        address: newOrderForm.address.trim(),
        city: newOrderForm.city.trim(),
        notes: newOrderForm.notes.trim() || undefined,
        adminNote: newOrderForm.adminNote.trim() || undefined,
        payment: newOrderForm.payment,
        orderStatus: newOrderForm.orderStatus,
        shippingFee: Number(newOrderForm.shippingFee) || 0,
        discount: Number(newOrderForm.discount) || 0,
        reserveInventory: newOrderForm.reserveInventory,
        isTest: newOrderForm.isTest,
        items: newOrderForm.items.map((it) => ({
          productId: it.productId,
          name: it.name,
          color: it.color,
          size: it.size,
          quantity: it.quantity,
          unitPrice: it.price,
        })),
      };

      const res = await authFetch("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create order");
      }

      showToast(`✨ Order #${data.order?.id?.slice(-8) || "created"} added successfully!`, "success");
      setShowNewOrderModal(false);
      await loadMainData(true);
    } catch (err: any) {
      setNewOrderError(err.message || "Failed to create order");
      showToast(err.message || "Failed to create order", "error");
    } finally {
      setCreatingNewOrder(false);
    }
  };

  // Inline Admin Note State
  const [editingAdminNoteOrderId, setEditingAdminNoteOrderId] = useState<string | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState<string>("");
  const [savingAdminNote, setSavingAdminNote] = useState<boolean>(false);

  // Toast Helper
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    if (type === "success") {
      setSyncSaved(true);
      setTimeout(() => setSyncSaved(false), 2500);
    }
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleSaveInlineAdminNote = async (orderId: string, currentOrder: AdminOrder) => {
    setSavingAdminNote(true);
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          adminNote: adminNoteInput.trim(),
          expectedVersion: currentOrder.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to save admin note");
      }
      showToast("Admin customer note saved!", "success");
      setEditingAdminNoteOrderId(null);
      setAdminNoteInput("");
      await loadMainData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to save admin note", "error");
    } finally {
      setSavingAdminNote(false);
    }
  };

  const openEditOrderModal = (o: AdminOrder) => {
    const sInfo = parseShippingInfo(o.shippingInfo);
    setEditingOrder(o);
    setEditOrderError(null);
    setEditOrderForm({
      customerName: o.customerName || sInfo.name || "",
      phone: sInfo.phone || "",
      email: o.customerEmail || sInfo.email || "",
      address: sInfo.address || "",
      city: sInfo.city || "",
      notes: o.notes || sInfo.notes || "",
      adminNote: sInfo.adminNote || "",
      shippingFee: o.shipping ?? 0,
      payment: o.payment || "cod",
      items: (o.orderItems || []).map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product?.name || item.productId,
        color: item.color || "",
        size: item.size || "",
        quantity: item.quantity || 1,
        price: item.price || 0,
        hero: item.product?.hero || "",
      })),
    });
  };

  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    if (!editOrderForm.customerName.trim()) {
      setEditOrderError("Customer name is required.");
      return;
    }
    if (!editOrderForm.phone.trim()) {
      setEditOrderError("Phone number is required.");
      return;
    }
    if (!editOrderForm.address.trim()) {
      setEditOrderError("Delivery address is required.");
      return;
    }
    if (!editOrderForm.city.trim()) {
      setEditOrderError("City is required.");
      return;
    }

    setSavingEditOrder(true);
    setEditOrderError(null);

    try {
      const payload: any = {
        expectedVersion: editingOrder.version,
        customerName: editOrderForm.customerName.trim(),
        phone: editOrderForm.phone.trim(),
        email: editOrderForm.email.trim(),
        address: editOrderForm.address.trim(),
        city: editOrderForm.city.trim(),
        notes: editOrderForm.notes,
        adminNote: editOrderForm.adminNote,
        shippingFee: Number(editOrderForm.shippingFee) || 0,
        payment: editOrderForm.payment,
        items: editOrderForm.items.map((it) => ({
          productId: it.productId,
          color: it.color,
          size: it.size,
          qty: it.quantity,
        })),
      };

      const res = await authFetch(`/api/admin/orders/${editingOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to update order");
      }

      showToast("Order updated successfully!", "success");
      setEditingOrder(null);
      await loadMainData(true);
    } catch (err: any) {
      setEditOrderError(err.message || "Failed to update order");
      showToast(err.message || "Failed to update order", "error");
    } finally {
      setSavingEditOrder(false);
    }
  };

  // Fetch wrapper with auth
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = getAuthToken();
      if (!token) {
        setIsAdminAuthed(false);
        throw new Error("Unauthorized");
      }
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      };
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401 || res.status === 403) {
        setIsAdminAuthed(false);
        setAdminLoginError("Access forbidden (403). Please sign in with an admin account.");
        throw new Error("Unauthorized");
      }
      return res;
    },
    []
  );

  // Load Main Data (Products, Orders, Settings)
  const loadMainData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }
    setError(null);
    setSyncError(null);
    try {
      const [resProd, resOrd, resSet, resBundle, resPromo, resShipping] = await Promise.all([
        authFetch("/api/admin/products"),
        authFetch("/api/admin/orders"),
        authFetch("/api/admin/settings").catch(() => null),
        authFetch("/api/admin/bundle-pricing").catch(() => null),
        authFetch("/api/admin/promo").catch(() => null),
        authFetch("/api/admin/shipping-settings").catch(() => null),
      ]);

      if (resShipping && resShipping.ok) {
        const sData = await resShipping.json();
        setShippingSettings(sData);
      }

      if (resPromo && resPromo.ok) {
        const pData = await resPromo.json();
        setPromoSettings(pData);
      }

      if (resBundle && resBundle.ok) {
        const bData = await resBundle.json();
        setBundleSettings(bData);
      }

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
            orderStatus: o.orderStatus || (o.status === "cancelled" ? "CANCELLED" : o.status === "on_hold" ? "ON_HOLD" : (o.trackingNumber || o.postexTrackingNumber || o.courierBookingStatus === "booked") ? "BOOKED" : "READY_TO_SHIP"),
            trackingNumber: o.trackingNumber || o.postexTrackingNumber || null,
            customerName: cName,
            customerEmail: cEmail,
            shippingInfo: sInfo,
            notes: o.notes || sInfo.notes || "",
            orderItems: items,
            auditLogs: o.auditLogs || [],
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

      if (silent) {
        setSyncSaved(true);
        setTimeout(() => setSyncSaved(false), 2500);
      }
    } catch (err: any) {
      if (err.message !== "Unauthorized") {
        if (!silent) {
          setError(err.message || "Failed to load data");
        } else {
          setSyncError(err.message || "Sync failed");
        }
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
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

  // Remarks / Shipper Advice Functions
  const fetchRemarksHistory = useCallback(async (orderId: string) => {
    setRemarksLoading(true);
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/remarks`);
      if (res.ok) {
        const data = await res.json();
        setRemarksHistory({
          localRemarks: data.localRemarks || [],
          postexRemarks: data.postexRemarks || [],
          trackingNumber: data.trackingNumber || null,
        });
      }
    } catch {
      // Ignore
    } finally {
      setRemarksLoading(false);
    }
  }, [authFetch]);

  const openRemarksModal = useCallback((order: AdminOrder) => {
    setRemarksOrder(order);
    setRemarksInput("");
    setRemarksStatusId(0);
    setRemarksErrorDetail(null);
    setRemarksSyncPostex(false);
    const tracking = order.postexTrackingNumber || order.trackingNumber || null;
    setRemarksHistory({
      localRemarks: (order.auditLogs || []).filter((l) => l.action === "SHIPPER_ADVICE" || l.action === "ADD_REMARK"),
      postexRemarks: [],
      trackingNumber: tracking,
    });
    fetchRemarksHistory(order.id);
  }, [fetchRemarksHistory]);

  const handleSaveRemark = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarksOrder || !remarksInput.trim()) return;

    setRemarksSubmitting(true);
    setRemarksErrorDetail(null);
    try {
      const res = await authFetch(`/api/admin/orders/${remarksOrder.id}/remarks`, {
        method: "POST",
        body: JSON.stringify({
          remarks: remarksInput.trim(),
          statusId: remarksStatusId,
          syncToPostex: remarksSyncPostex,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errorIndex) {
          setRemarksErrorDetail(data.errorIndex);
        }
        showToast(data.error || "Failed to save remark", "error");
      } else {
        if (data.errorIndex) {
          setRemarksErrorDetail(data.errorIndex);
        } else {
          setRemarksErrorDetail(null);
        }

        const noteText = remarksInput.trim();
        showToast(data.message || "Remark saved successfully", "success");
        setRemarksInput("");

        // Immediate state update for instant UI feedback
        if (data.auditLog) {
          setRemarksHistory((prev) => ({
            ...prev,
            localRemarks: [data.auditLog, ...prev.localRemarks],
          }));

          setOrders((prev) =>
            prev.map((o) =>
              o.id === remarksOrder.id
                ? {
                    ...o,
                    notes: data.orderNotes || noteText,
                    auditLogs: [data.auditLog, ...(o.auditLogs || [])],
                  }
                : o
            )
          );
        }

        await fetchRemarksHistory(remarksOrder.id);
        loadMainData(true);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to submit remark", "error");
    } finally {
      setRemarksSubmitting(false);
    }
  }, [remarksOrder, remarksInput, remarksStatusId, remarksSyncPostex, authFetch, showToast, fetchRemarksHistory, loadMainData]);

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

    const token = getAuthToken();
    const user = getAuthUser();
    if (token && user?.role === "admin") {
      setIsAdminAuthed(true);
      loadMainData();
    } else {
      setIsAdminAuthed(false);
      setLoading(false);
    }
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nanos-auth-changed"));
    }
    setIsAdminAuthed(false);
  }

  async function handleAdminLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAdminLoginLoading(true);
    setAdminLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmailInput, password: adminPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminLoginError(data.error?.message || data.message || "Invalid admin credentials");
        setAdminLoginLoading(false);
        return;
      }
      if (data.user?.role !== "admin") {
        setAdminLoginError("This account does not have administrator privileges (Role: " + (data.user?.role || "user") + ")");
        setAdminLoginLoading(false);
        return;
      }
      localStorage.setItem("nanos_auth_v1", JSON.stringify({ user: data.user, token: data.token }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nanos-auth-changed"));
      }
      setIsAdminAuthed(true);
      setAdminLoginLoading(false);
      loadMainData();
    } catch (err: any) {
      setAdminLoginError(err.message || "Failed to log in to admin");
      setAdminLoginLoading(false);
    }
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
      showToast("Product created successfully!", "success");
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
      loadMainData(true);
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
    setEditFormIgnoreStock(Boolean(p.ignoreStock));
    setShowColorAddForm(false);

    // Load bundle pricing for product
    const bOverride = bundleSettings.products[p.id];
    if (bOverride) {
      setEditBundleEnabled(bOverride.enabled !== false);
      setEditBuy2Price(bOverride.buy2Price ? String(bOverride.buy2Price) : "");
      setEditBuy2DiscountText(bOverride.buy2DiscountText || "");
      setEditBuy3Price(bOverride.buy3Price ? String(bOverride.buy3Price) : "");
      setEditBuy3DiscountText(bOverride.buy3DiscountText || "");
    } else {
      setEditBundleEnabled(true);
      setEditBuy2Price("");
      setEditBuy2DiscountText("");
      setEditBuy3Price("");
      setEditBuy3DiscountText("");
    }

    setActiveTab("edit-product");

    loadEditColors(p.id);
    loadEditSizes(p.id);
    loadEditVariants(p.id);
  }

  // Quick Toggle for Unlimited Stock
  async function handleToggleIgnoreStock(newValue: boolean) {
    if (!editingProduct) return;
    setEditFormIgnoreStock(newValue);
    try {
      const res = await authFetch(`/api/admin/products/${editingProduct.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ignoreStock: newValue }),
      });
      if (res.ok) {
        setEditingProduct({ ...editingProduct, ignoreStock: newValue });
        showToast(
          newValue
            ? "♾️ Unlimited stock enabled! Orders will never be blocked by inventory."
            : "Stock limit tracking enabled.",
          "success"
        );
        loadMainData(true);
      } else {
        throw new Error("Failed to update stock mode");
      }
    } catch {
      showToast("Failed to update stock mode", "error");
    }
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
        ignoreStock: editFormIgnoreStock,
      };

      const res = await authFetch(`/api/admin/products/${editingProduct.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save product");

      // Save bundle override
      await authFetch("/api/admin/bundle-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingProduct.id,
          override: {
            enabled: editBundleEnabled,
            buy2Price: editBuy2Price ? Number(editBuy2Price) : null,
            buy2DiscountText: editBuy2DiscountText.trim() || null,
            buy3Price: editBuy3Price ? Number(editBuy3Price) : null,
            buy3DiscountText: editBuy3DiscountText.trim() || null,
          },
        }),
      });

      showToast("Product and bundle pricing saved successfully!", "success");
      loadMainData(true);
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
      showToast("Product deleted!", "success");
      loadMainData(true);
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
      showToast(`Order status updated to ${toStatus}`, "success");
      loadMainData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to update order status", "error");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // Order Lifecycle Handlers (POST /api/admin/orders/[id]/lifecycle)
  async function handleOrderLifecycle(
    orderId: string,
    action: "SEND_POSTEX" | "HOLD" | "RELEASE" | "CANCEL" | "RESEND",
    reason?: string
  ) {
    setUpdatingStatusId(orderId);
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to execute lifecycle action");
      }
      showToast(data.message || "Order updated successfully!", "success");
      loadMainData(true);
    } catch (err: any) {
      showToast(err.message || "Action failed", "error");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  function promptResendOrder(order: AdminOrder) {
    setModalReasonInput("");
    setConfirmModal({
      isOpen: true,
      title: `Resend / Restore Order #${order.id.slice(-8)}`,
      message: `Restore cancelled order for ${order.customerName || "customer"} and return it to the Ready to Ship queue? Stock will be re-reserved and booking can be submitted again to PostEx.`,
      actionLabel: "Restore & Resend",
      danger: false,
      requiresReason: false,
      reasonPlaceholder: "Note (optional)",
      onConfirm: async (reason) => {
        await handleOrderLifecycle(order.id, "RESEND", reason);
      },
    });
  }

  function promptCancelOrder(order: AdminOrder) {
    const hasTracking = !!(order.trackingNumber || order.postexTrackingNumber || order.courierBookingStatus === "booked");
    setModalReasonInput("");
    setConfirmModal({
      isOpen: true,
      title: `Cancel Order #${order.id.slice(-8)}`,
      message: hasTracking
        ? `This order is booked with PostEx (Tracking: ${order.trackingNumber || order.postexTrackingNumber}). Cancelling will invoke PostEx's cancel-order API, release reserved stock, and set the status to Cancelled.`
        : "Are you sure you want to cancel this order? Reserved stock will be returned to inventory.",
      actionLabel: "Cancel Order",
      danger: true,
      requiresReason: false,
      reasonPlaceholder: "Cancellation reason (optional)",
      onConfirm: async (reason) => {
        await handleOrderLifecycle(order.id, "CANCEL", reason);
      },
    });
  }

  function promptHoldOrder(order: AdminOrder) {
    setModalReasonInput("");
    setConfirmModal({
      isOpen: true,
      title: `Put Order #${order.id.slice(-8)} on Hold`,
      message: "This order will be paused and excluded from any automatic or bulk dispatch flows until released.",
      actionLabel: "Put on Hold",
      danger: false,
      requiresReason: false,
      reasonPlaceholder: "Reason for hold (optional)",
      onConfirm: async (reason) => {
        await handleOrderLifecycle(order.id, "HOLD", reason);
      },
    });
  }

  async function handleBulkAction(
    action: "send_postex" | "hold" | "release" | "cancel",
    reason?: string
  ) {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0) return;

    setIsSyncing(true);
    try {
      const res = await authFetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Bulk action failed");
      }

      const successes = (data.results || []).filter((r: any) => r.ok).length;
      const failures = (data.results || []).filter((r: any) => !r.ok);

      if (failures.length > 0) {
        const errMsgs = failures.map((f: any) => `${f.id.slice(-6)}: ${f.error}`).join("; ");
        showToast(`${successes} succeeded, ${failures.length} failed (${errMsgs})`, "error");
      } else {
        const actionTitle =
          action === "send_postex"
            ? "sent to PostEx"
            : action === "hold"
            ? "placed on hold"
            : action === "release"
            ? "released from hold"
            : "cancelled";
        showToast(`Bulk action complete: ${successes} order(s) ${actionTitle}!`, "success");
      }

      setSelectedOrderIds(new Set());
      loadMainData(true);
    } catch (err: any) {
      showToast(err.message || "Bulk action failed", "error");
    } finally {
      setIsSyncing(false);
    }
  }

  function promptBulkAction(action: "send_postex" | "hold" | "cancel") {
    const count = selectedOrderIds.size;
    if (count === 0) return;

    setModalReasonInput("");

    if (action === "cancel") {
      setConfirmModal({
        isOpen: true,
        title: `Cancel ${count} Selected Orders`,
        message: `Are you sure you want to cancel ${count} orders? Any active PostEx bookings will be cancelled with PostEx and stock will be returned to inventory.`,
        actionLabel: `Cancel ${count} Orders`,
        danger: true,
        requiresReason: false,
        reasonPlaceholder: "Cancellation reason (optional)",
        onConfirm: async (reason) => {
          await handleBulkAction("cancel", reason);
        },
      });
      return;
    }

    if (count >= 2) {
      if (action === "send_postex") {
        setConfirmModal({
          isOpen: true,
          title: `Send ${count} Orders to PostEx`,
          message: `Are you sure you want to create courier bookings with PostEx for ${count} orders? (Orders on hold or already booked will be skipped).`,
          actionLabel: `Send to PostEx (${count})`,
          danger: false,
          onConfirm: async () => {
            await handleBulkAction("send_postex");
          },
        });
      } else if (action === "hold") {
        setConfirmModal({
          isOpen: true,
          title: `Put ${count} Orders on Hold`,
          message: `Are you sure you want to pause ${count} orders? They will be excluded from shipping batches until released.`,
          actionLabel: `Put on Hold (${count})`,
          danger: false,
          reasonPlaceholder: "Reason for hold (optional)",
          onConfirm: async (reason) => {
            await handleBulkAction("hold", reason);
          },
        });
      }
    } else {
      // 1 order selected: execute directly
      handleBulkAction(action);
    }
  }

  // Push All in Queue to PostEx
  const [isPushingAllQueue, setIsPushingAllQueue] = useState(false);

  function handlePushAllInQueue() {
    const unbookedOrders = orders.filter(
      (o) =>
        (o.orderStatus === "READY_TO_SHIP" || o.status === "placed" || o.status === "confirmed") &&
        !o.trackingNumber &&
        !o.postexTrackingNumber &&
        o.orderStatus !== "ON_HOLD" &&
        o.orderStatus !== "CANCELLED" &&
        o.courierBookingStatus !== "booked"
    );

    if (unbookedOrders.length === 0) {
      showToast("No unbooked orders in queue to push.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: `⚡ Push All ${unbookedOrders.length} Orders in Queue to PostEx`,
      message: `Are you sure you want to book all ${unbookedOrders.length} ready unbooked orders with PostEx now? Orders on hold or cancelled will remain untouched.`,
      actionLabel: `Push All (${unbookedOrders.length})`,
      danger: false,
      requiresReason: false,
      onConfirm: async () => {
        setIsPushingAllQueue(true);
        try {
          const res = await authFetch("/api/admin/courier-queue/run-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ includeAllUnbooked: true }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to push orders in queue to PostEx");
          }
          showToast(
            `Queue push completed! Booked: ${data.booked || 0}, Needs Review: ${data.needsReview || 0}, Failed: ${data.failed || 0}`
          );
          loadMainData();
          loadCourierData();
        } catch (err: any) {
          showToast(err.message || "Failed to execute batch queue push", "error");
        } finally {
          setIsPushingAllQueue(false);
        }
      },
    });
  }

  // Courier Queue Actions
  async function handleRunBatchNow() {
    setCourierActionId("batch");
    try {
      const res = await authFetch("/api/admin/courier-queue/run-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeAllUnbooked: true }),
      });
      if (res.ok) {
        const results = await res.json();
        showToast(`Batch completed! Booked ${results.booked ?? results.length ?? 0} orders.`);
        loadCourierData();
        loadMainData();
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
        showToast(`Updated low stock threshold for ${category} to ${threshold}`, "success");
        loadMainData(true);
      }
    } catch {
      showToast("Failed to update setting", "error");
    } finally {
      setSavingSettingCategory(null);
    }
  }

  // Save Global Bundle Settings
  async function handleSaveGlobalBundleSettings(buy2Disc: number, buy3Disc: number) {
    setSavingBundleSettings(true);
    try {
      const res = await authFetch("/api/admin/bundle-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultBuy2DiscountPercent: buy2Disc,
          defaultBuy3DiscountPercent: buy3Disc,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setBundleSettings(data.settings);
        showToast("Updated global bundle discount settings!", "success");
        loadMainData(true);
      }
    } catch {
      showToast("Failed to update bundle settings", "error");
    } finally {
      setSavingBundleSettings(false);
    }
  }

  // Save Per-Product Bundle Row
  async function handleSaveProductBundleRow(prodId: string, override: any) {
    try {
      const res = await authFetch("/api/admin/bundle-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: prodId,
          override,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setBundleSettings(data.settings);
        showToast("Saved bundle pricing for product!", "success");
        loadMainData(true);
      }
    } catch {
      showToast("Failed to save product bundle", "error");
    }
  }

  // Save Promo Settings
  async function handleSavePromoSettings() {
    setSavingPromoSettings(true);
    try {
      const res = await authFetch("/api/admin/promo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promoSettings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setPromoSettings(data.settings);
        showToast("Updated promo code and discount settings!", "success");
        loadMainData(true);
      } else {
        showToast("Failed to save promo settings", "error");
      }
    } catch {
      showToast("Failed to update promo settings", "error");
    } finally {
      setSavingPromoSettings(false);
    }
  }

  // Save Delivery Fee & Shipping Settings
  async function handleSaveShippingSettings() {
    setSavingShippingSettings(true);
    try {
      const res = await authFetch("/api/admin/shipping-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shippingSettings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setShippingSettings(data.settings);
        showToast("Updated delivery fee and shipping settings!", "success");
        loadMainData(true);
      } else {
        showToast("Failed to save delivery settings", "error");
      }
    } catch {
      showToast("Failed to update delivery settings", "error");
    } finally {
      setSavingShippingSettings(false);
    }
  }

  // ─── ORDER LIFECYCLE HELPERS ─────────────────────────
  function isOrderOnHold(o: AdminOrder): boolean {
    return o.orderStatus === "ON_HOLD" || o.status.toLowerCase() === "on_hold";
  }

  function isOrderCancelled(o: AdminOrder): boolean {
    return o.orderStatus === "CANCELLED" || o.status.toLowerCase() === "cancelled";
  }

  function isOrderBooked(o: AdminOrder): boolean {
    if (isOrderCancelled(o) || isOrderOnHold(o)) return false;
    return (
      o.orderStatus === "BOOKED" ||
      o.courierBookingStatus === "booked" ||
      !!(o.trackingNumber || o.postexTrackingNumber)
    );
  }

  function isOrderDelivered(o: AdminOrder): boolean {
    return (
      o.status.toLowerCase() === "delivered" ||
      (o.courierStatusRaw?.toLowerCase().includes("delivered") ?? false)
    );
  }

  function isOrderReadyToShip(o: AdminOrder): boolean {
    if (isOrderOnHold(o) || isOrderCancelled(o) || isOrderBooked(o) || isOrderDelivered(o)) {
      return false;
    }
    return true;
  }

  // ─── DERIVED FILTERED DATA ─────────────────────────────

  // Filtered Orders for Orders Tab
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      // 0. Primary Status Filter Tab
      if (orderStatusTab === "on_hold" && !isOrderOnHold(o)) return false;
      if (orderStatusTab === "ready_to_ship" && !isOrderReadyToShip(o)) return false;
      if (orderStatusTab === "booked" && !isOrderBooked(o)) return false;
      if (orderStatusTab === "delivered" && !isOrderDelivered(o)) return false;
      if (orderStatusTab === "cancelled" && !isOrderCancelled(o)) return false;

      // 1. Secondary Status Dropdown Filter
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
        const mTracking = (o.trackingNumber || o.postexTrackingNumber)?.toLowerCase().includes(q) ?? false;
        if (!mName && !mEmail && !mId && !mTracking) return false;
      }

      return true;
    });
  }, [orders, orderStatusTab, orderStatusFilter, orderCustomerFilter, orderDateFilter, orderQuery]);

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

  if (!isAdminAuthed) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#f5f5f5",
          padding: "24px",
          fontFamily: "var(--font-heading, system-ui, sans-serif)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            background: "#141414",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 16,
            padding: "36px 32px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          {/* Logo / Badge */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                background: "rgba(200, 255, 0, 0.1)",
                border: "1px solid rgba(200, 255, 0, 0.3)",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: "#C8FF00",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8FF00" }} />
              Admin Portal
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: "-0.03em" }}>
              nanos<span style={{ color: "#C8FF00" }}>.pk</span>
            </h1>
            <p style={{ margin: "8px 0 0", color: "#888888", fontSize: 13 }}>
              Enter administrator credentials to manage inventory, orders, and store settings.
            </p>
          </div>

          {adminLoginError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.4,
                marginBottom: 20,
              }}
            >
              {adminLoginError}
            </div>
          )}

          <form onSubmit={handleAdminLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#aaaaaa",
                  marginBottom: 6,
                }}
              >
                Admin Email
              </label>
              <input
                type="email"
                required
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="admin@nanos.pk"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "#1f1f1f",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 8,
                  color: "#ffffff",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#aaaaaa",
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                type="password"
                required
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "#1f1f1f",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 8,
                  color: "#ffffff",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={adminLoginLoading}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "13px",
                background: "#C8FF00",
                color: "#000000",
                border: "none",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: "0.02em",
                cursor: adminLoginLoading ? "not-allowed" : "pointer",
                opacity: adminLoginLoading ? 0.7 : 1,
                transition: "opacity 0.2s, transform 0.1s",
              }}
            >
              {adminLoginLoading ? "Signing In..." : "Sign In to Admin Dashboard"}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link
              href="/"
              style={{
                color: "#888888",
                fontSize: 13,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              ← Return to Main Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout-shell">
      {/* Toast Notice */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span style={{ fontSize: 16 }}>
              {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => setToast(null)}
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
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

          <div className="sidebar-section-label">Storefront</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "home" ? "active" : ""}`}
            onClick={() => switchTab("home")}
          >
            <span>Home Page</span>
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
            <button type="button" className="hamburger" onClick={() => setSidebarOpen(true)} title="Toggle menu">
              ☰
            </button>
            <div>
              <h1 className="page-title">
                {activeTab === "dashboard"
                  ? "Dashboard"
                  : activeTab === "home"
                  ? "Home Page Manager"
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
                  : activeTab === "home"
                  ? "Customize homepage images, banners, sections & products"
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

          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isSyncing ? (
              <span className="sync-status syncing">
                <span className="sync-dot pulse" />
                <span>Saving...</span>
              </span>
            ) : syncSaved ? (
              <span className="sync-status saved">
                <span className="sync-dot" />
                <span>Saved</span>
              </span>
            ) : syncError ? (
              <button
                type="button"
                className="sync-status error"
                onClick={() => loadMainData(false)}
                title="Click to retry syncing data"
              >
                <span className="sync-dot" />
                <span>Sync Error (Retry)</span>
              </button>
            ) : null}

            <Link
              href="/"
              target="_blank"
              className="btn btn-dark btn-sm"
              title="View live storefront"
              style={{ textDecoration: "none", fontSize: 12, padding: "5px 10px" }}
            >
              <span>Storefront</span>
              <span style={{ fontSize: 10, opacity: 0.75 }}>↗</span>
            </Link>

            <button type="button" className="admin-icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === "light" ? "◐" : "☀️"}
            </button>
          </div>
        </header>

        {/* MOBILE / TABLET QUICK NAVIGATION STRIP */}
        <nav className="admin-mobile-nav" aria-label="Quick Section Switcher">
          <button
            type="button"
            className={`admin-mobile-nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => switchTab("dashboard")}
          >
            <span>📊 Dashboard</span>
          </button>
          <button
            type="button"
            className={`admin-mobile-nav-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => switchTab("orders")}
          >
            <span>📦 Orders</span>
            {orders.filter((o) => o.status.toLowerCase() === "processing").length > 0 && (
              <span className="admin-mobile-nav-badge">
                {orders.filter((o) => o.status.toLowerCase() === "processing").length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`admin-mobile-nav-btn ${activeTab === "delivered" ? "active" : ""}`}
            onClick={() => switchTab("delivered")}
          >
            <span>✅ Delivered</span>
          </button>
          <button
            type="button"
            className={`admin-mobile-nav-btn ${activeTab === "courier" ? "active" : ""}`}
            onClick={() => switchTab("courier")}
          >
            <span>🚚 Courier</span>
          </button>
          <button
            type="button"
            className={`admin-mobile-nav-btn ${activeTab === "home" ? "active" : ""}`}
            onClick={() => switchTab("home")}
          >
            <span>🏠 Home</span>
          </button>
          <button
            type="button"
            className={`admin-mobile-nav-btn ${activeTab === "products" || activeTab === "edit-product" ? "active" : ""}`}
            onClick={() => switchTab("products")}
          >
            <span>🏷️ Products</span>
          </button>
          <button
            type="button"
            className={`admin-mobile-nav-btn ${activeTab === "size-charts" ? "active" : ""}`}
            onClick={() => switchTab("size-charts")}
          >
            <span>📐 Sizes</span>
          </button>
          <button
            type="button"
            className={`admin-mobile-nav-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => switchTab("settings")}
          >
            <span>⚙️ Settings</span>
          </button>
        </nav>

        {/* CONTENT CONTAINER */}
        <main className="content">
          {loading && products.length === 0 && orders.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--admin-text-soft)" }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>⚡</div>
              <div style={{ fontWeight: 600 }}>Loading store metrics...</div>
            </div>
          ) : error && products.length === 0 && orders.length === 0 ? (
            <div style={{ padding: 16, background: "var(--admin-danger-bg)", color: "var(--admin-danger)", borderRadius: 8, margin: "20px 0" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Failed to load data: {error}</div>
              <button type="button" className="btn btn-dark btn-sm" onClick={() => loadMainData(false)}>
                Retry
              </button>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={openNewOrderModal}
                      style={{
                        background: "var(--admin-accent)",
                        color: "#111",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <IconPlus size={13} />
                      <span>+ New Order</span>
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => switchTab("orders")}>
                      View all orders →
                    </button>
                  </div>
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
                            <span className={`badge badge-${o.orderStatus === "ON_HOLD" ? "warn" : o.orderStatus === "CANCELLED" ? "danger" : o.orderStatus === "BOOKED" ? "info" : "neutral"}`}>
                              {o.orderStatus || o.status}
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
            /* TAB 2: ORDERS WITH LIFECYCLE MANAGEMENT */
            <div className="panel">
              {/* STATUS FILTER TABS */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid var(--admin-border)",
                  background: "var(--admin-surface)",
                }}
              >
                {[
                  { id: "all", label: "All", count: orders.length },
                  { id: "on_hold", label: "On Hold", count: orders.filter(isOrderOnHold).length },
                  { id: "ready_to_ship", label: "Ready to Ship", count: orders.filter(isOrderReadyToShip).length },
                  { id: "booked", label: "Booked", count: orders.filter(isOrderBooked).length },
                  { id: "delivered", label: "Delivered", count: orders.filter(isOrderDelivered).length },
                  { id: "cancelled", label: "Cancelled", count: orders.filter(isOrderCancelled).length },
                ].map((t) => {
                  const isActive = orderStatusTab === t.id;
                  let activeBg = "var(--admin-accent)";
                  let activeColor = "#111";

                  if (t.id === "on_hold") {
                    activeBg = "#f59e0b";
                    activeColor = "#111";
                  } else if (t.id === "cancelled") {
                    activeBg = "#ef4444";
                    activeColor = "#fff";
                  } else if (t.id === "delivered") {
                    activeBg = "#10b981";
                    activeColor = "#fff";
                  } else if (t.id === "booked") {
                    activeBg = "#3b82f6";
                    activeColor = "#fff";
                  }

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setOrderStatusTab(t.id as any);
                        setSelectedOrderIds(new Set());
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: isActive ? `1.5px solid ${activeBg}` : "1px solid var(--admin-border)",
                        background: isActive ? activeBg : "var(--admin-surface-2)",
                        color: isActive ? activeColor : "var(--admin-text)",
                        fontWeight: isActive ? 800 : 600,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{t.label}</span>
                      <span
                        style={{
                          background: isActive ? "rgba(0,0,0,0.2)" : "var(--admin-surface)",
                          color: isActive ? activeColor : "var(--admin-text-soft)",
                          padding: "1px 6px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Secondary Filter Toolbar */}
              <div className="panel-head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12, padding: "14px 20px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Search customer, phone, ID, tracking #…"
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    style={{ minWidth: 240, flex: 1 }}
                  />
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
                  {(orderCustomerFilter !== "all" || orderDateFilter !== "all" || orderQuery !== "" || orderStatusTab !== "all") && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setOrderStatusTab("all");
                        setOrderStatusFilter("all");
                        setOrderCustomerFilter("all");
                        setOrderDateFilter("all");
                        setOrderQuery("");
                        setSelectedOrderIds(new Set());
                      }}
                    >
                      Reset Filters
                    </button>
                  )}

                  {/* CREATE NEW ORDER & PUSH ALL IN QUEUE BUTTONS */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{
                        background: "var(--admin-accent)",
                        color: "#111",
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 2px 10px rgba(200, 255, 0, 0.22)",
                      }}
                      onClick={openNewOrderModal}
                      title="Quick create a new customer order manually"
                    >
                      <IconPlus size={14} />
                      <span>+ New Order</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={isPushingAllQueue || loading}
                      style={{
                        borderColor: "var(--admin-border)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onClick={handlePushAllInQueue}
                      title="Push all unbooked ready orders in queue to PostEx"
                    >
                      {isPushingAllQueue ? (
                        <span>⏳ Pushing Queue...</span>
                      ) : (
                        <>
                          <span>⚡ Push All in Queue</span>
                          <span
                            style={{
                              background: "var(--admin-surface-2)",
                              color: "var(--admin-accent)",
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "1px 6px",
                              borderRadius: 10,
                              border: "1px solid var(--admin-border)",
                            }}
                          >
                            {
                              orders.filter(
                                (o) =>
                                  (o.orderStatus === "READY_TO_SHIP" || o.status === "placed" || o.status === "confirmed") &&
                                  !o.trackingNumber &&
                                  !o.postexTrackingNumber &&
                                  o.orderStatus !== "ON_HOLD" &&
                                  o.orderStatus !== "CANCELLED" &&
                                  o.courierBookingStatus !== "booked"
                              ).length
                            }
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* BULK ACTION BAR */}
              {selectedOrderIds.size > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    background: "rgba(200, 255, 0, 0.08)",
                    borderTop: "1px solid var(--admin-accent)",
                    borderBottom: "1px solid var(--admin-accent)",
                    padding: "10px 20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        background: "var(--admin-accent)",
                        color: "#111",
                        fontWeight: 800,
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 12,
                      }}
                    >
                      {selectedOrderIds.size}
                    </span>
                    <strong style={{ fontSize: 13.5 }}>
                      {selectedOrderIds.size} order{selectedOrderIds.size > 1 ? "s" : ""} selected
                    </strong>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ background: "var(--admin-accent)", color: "#111", fontWeight: 700 }}
                      onClick={() => promptBulkAction("send_postex")}
                    >
                      Send to PostEx
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => promptBulkAction("hold")}
                    >
                      Put on Hold
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ color: "var(--admin-danger)", borderColor: "var(--admin-danger)" }}
                      onClick={() => promptBulkAction("cancel")}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setSelectedOrderIds(new Set())}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: 38, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          aria-label="Select all orders"
                          checked={
                            filteredOrders.length > 0 &&
                            filteredOrders.every((o) => selectedOrderIds.has(o.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              const s = new Set<string>();
                              filteredOrders.forEach((o) => s.add(o.id));
                              setSelectedOrderIds(s);
                            } else {
                              setSelectedOrderIds(new Set());
                            }
                          }}
                        />
                      </th>
                      <th style={{ width: 110, whiteSpace: "nowrap" }}>Order ID</th>
                      <th style={{ width: 105, whiteSpace: "nowrap" }}>Date</th>
                      <th style={{ minWidth: 170 }}>Customer</th>
                      <th style={{ width: 60, textAlign: "center", whiteSpace: "nowrap" }}>Items</th>
                      <th style={{ width: 110, whiteSpace: "nowrap" }}>Total</th>
                      <th style={{ width: 135, whiteSpace: "nowrap" }}>Lifecycle State</th>
                      <th style={{ width: 180, whiteSpace: "nowrap" }}>PostEx / Tracking</th>
                      <th style={{ minWidth: 230, whiteSpace: "nowrap" }}>Quick Actions</th>
                      <th style={{ width: 75, textAlign: "center", whiteSpace: "nowrap" }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", padding: 36, color: "var(--admin-text-soft)" }}>
                          No orders match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => {
                        const isExpanded = expandedOrderId === o.id;
                        const isSelected = selectedOrderIds.has(o.id);
                        const isUpdating = updatingStatusId === o.id;

                        const onHold = isOrderOnHold(o);
                        const cancelled = isOrderCancelled(o);
                        const booked = isOrderBooked(o);
                        const delivered = isOrderDelivered(o);
                        const readyToShip = isOrderReadyToShip(o);

                        const trackingNum = o.trackingNumber || o.postexTrackingNumber;

                        let statusLabel = "READY TO SHIP";
                        let statusBg = "rgba(200, 255, 0, 0.15)";
                        let statusColor = "var(--admin-accent)";

                        if (onHold) {
                          statusLabel = "ON HOLD";
                          statusBg = "rgba(245, 158, 11, 0.18)";
                          statusColor = "#f59e0b";
                        } else if (cancelled) {
                          statusLabel = "CANCELLED";
                          statusBg = "rgba(239, 68, 68, 0.18)";
                          statusColor = "#ef4444";
                        } else if (delivered) {
                          statusLabel = "DELIVERED";
                          statusBg = "rgba(16, 185, 129, 0.18)";
                          statusColor = "#10b981";
                        } else if (booked) {
                          statusLabel = "BOOKED";
                          statusBg = "rgba(59, 130, 246, 0.18)";
                          statusColor = "#3b82f6";
                        }

                        return (
                          <React.Fragment key={o.id}>
                            <tr style={{ background: isSelected ? "rgba(200, 255, 0, 0.04)" : undefined }}>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  aria-label={`Select order ${o.id}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const next = new Set(selectedOrderIds);
                                    if (e.target.checked) {
                                      next.add(o.id);
                                    } else {
                                      next.delete(o.id);
                                    }
                                    setSelectedOrderIds(next);
                                  }}
                                />
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <strong>#{o.id.slice(-8)}</strong>
                              </td>
                              <td style={{ fontSize: 13, color: "var(--admin-text-soft)", whiteSpace: "nowrap" }}>
                                <div>{formatDate(o.createdAt)}</div>
                                <div style={{ fontSize: 11, color: "var(--admin-text-soft)", opacity: 0.8, marginTop: 2 }}>
                                  {formatTime(o.createdAt)}
                                </div>
                              </td>
                              <td style={{ maxWidth: 200 }}>
                                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {o.customerName}
                                </div>
                                <div
                                  style={{ fontSize: 12, color: "var(--admin-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  title={o.customerEmail || undefined}
                                >
                                  {o.customerEmail}
                                </div>
                              </td>
                              <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                                {o.orderItems.reduce((s, i) => s + i.quantity, 0)}
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <strong>{fmtPrice(o.total)}</strong>
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <span
                                  className="badge"
                                  style={{
                                    background: statusBg,
                                    color: statusColor,
                                    fontWeight: 700,
                                    fontSize: 11,
                                    letterSpacing: "0.03em",
                                  }}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                {trackingNum ? (
                                  <a
                                    href={`https://postex.pk/tracking?trackingNumber=${trackingNum}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="badge badge-info"
                                    style={{
                                      textDecoration: "none",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                      fontFamily: "monospace",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                    title="Track on PostEx"
                                  >
                                    <span>{trackingNum}</span>
                                    <span style={{ fontSize: 10, opacity: 0.85 }}>↗</span>
                                  </a>
                                ) : onHold ? (
                                  <span className="badge badge-warn" style={{ fontSize: 11 }}>Paused (On Hold)</span>
                                ) : (
                                  <span style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>Not booked</span>
                                )}
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                                  {readyToShip && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        disabled={isUpdating}
                                        style={{ fontSize: 11.5, padding: "5px 10px" }}
                                        onClick={() => handleOrderLifecycle(o.id, "SEND_POSTEX")}
                                      >
                                        Send to PostEx
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        disabled={isUpdating}
                                        style={{ fontSize: 11.5, padding: "5px 10px" }}
                                        onClick={() => promptHoldOrder(o)}
                                      >
                                        Put on Hold
                                      </button>
                                    </>
                                  )}

                                  {onHold && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        disabled={isUpdating}
                                        style={{ fontSize: 11.5, padding: "5px 10px", borderColor: "var(--admin-accent)", color: "var(--admin-accent)" }}
                                        onClick={() => handleOrderLifecycle(o.id, "RELEASE")}
                                      >
                                        Release Hold
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        disabled={isUpdating}
                                        style={{ fontSize: 11.5, padding: "5px 10px" }}
                                        onClick={() => promptCancelOrder(o)}
                                      >
                                        Cancel Order
                                      </button>
                                    </>
                                  )}

                                  {booked && (
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      disabled={isUpdating}
                                      style={{ fontSize: 11.5, padding: "5px 10px" }}
                                      onClick={() => promptCancelOrder(o)}
                                    >
                                      Cancel Order
                                    </button>
                                  )}

                                  {cancelled && (
                                    <>
                                      <span className="badge badge-danger" style={{ fontSize: 11 }}>Cancelled</span>
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        disabled={isUpdating}
                                        style={{ fontSize: 11.5, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(200, 255, 0, 0.15)", color: "var(--admin-accent)", borderColor: "var(--admin-accent)" }}
                                        onClick={() => promptResendOrder(o)}
                                        title="Restore cancelled order to Ready to Ship"
                                      >
                                        <IconRefresh size={11} />
                                        <span>Resend</span>
                                      </button>
                                    </>
                                  )}

                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    style={{ fontSize: 11.5, padding: "5px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}
                                    onClick={() => openEditOrderModal(o)}
                                    title={cancelled ? "Edit address, items, and resend order" : "Edit customer details, address, phone or notes"}
                                  >
                                    <IconEdit size={12} />
                                    <span>{cancelled ? "Edit & Resend" : "Edit"}</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    style={{ fontSize: 11.5, padding: "5px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}
                                    onClick={() => openRemarksModal(o)}
                                    title="Add remarks or PostEx shipper advice"
                                  >
                                    <IconMessage size={12} />
                                    <span>Remark</span>
                                  </button>
                                </div>
                              </td>
                              <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  style={{ fontSize: 11.5, padding: "5px 10px" }}
                                  onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                                >
                                  {isExpanded ? "Hide" : "View"}
                                </button>
                              </td>
                            </tr>

                            {/* EXPANDED INLINE DETAILS & AUDIT LOG */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={10} style={{ background: "var(--admin-surface-2)", padding: 20 }}>
                                  {/* Expanded Top Header */}
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginBottom: 16,
                                      paddingBottom: 12,
                                      borderBottom: "1px solid var(--admin-border)",
                                      flexWrap: "wrap",
                                      gap: 10,
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 13, color: "var(--admin-text-soft)" }}>Order Placed:</span>
                                      <span
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 700,
                                          background: "rgba(200, 255, 0, 0.1)",
                                          color: "var(--admin-accent)",
                                          padding: "3px 9px",
                                          borderRadius: 4,
                                          border: "1px solid rgba(200, 255, 0, 0.25)",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <IconClock size={12} />
                                        <span>{formatDateTime(o.createdAt)}</span>
                                      </span>
                                      {o.isTest && (
                                        <span className="badge badge-warn" style={{ fontSize: 11 }}>
                                          TEST ORDER
                                        </span>
                                      )}
                                    </div>

                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                      {cancelled && (
                                        <button
                                          type="button"
                                          className="btn btn-outline btn-sm"
                                          disabled={isUpdating}
                                          style={{ fontSize: 12, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, borderColor: "var(--admin-accent)", color: "var(--admin-accent)" }}
                                          onClick={() => promptResendOrder(o)}
                                        >
                                          <IconRefresh size={13} />
                                          <span>Resend Order</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        style={{ fontSize: 12, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
                                        onClick={() => openEditOrderModal(o)}
                                      >
                                        <IconEdit size={13} />
                                        <span>{cancelled ? "Edit & Resend Order" : "Edit Order & Address"}</span>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="order-details-grid">
                                    <div>
                                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Customer Info</div>
                                      <div>Name: <strong>{o.customerName}</strong></div>
                                      <div>Email: {o.customerEmail}</div>
                                      <div>Type: {o.user?.id ? "Registered Account" : "Guest Checkout"}</div>
                                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                                        <IconClock size={12} style={{ color: "var(--admin-accent)" }} />
                                        <span>Placed Time:</span>
                                        <strong style={{ color: "var(--admin-accent)" }}>{formatDateTime(o.createdAt)}</strong>
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Shipping &amp; Payment</div>
                                      <div>Address: <strong>{o.shippingInfo?.address || "N/A"}</strong></div>
                                      <div>City: <strong>{o.shippingInfo?.city || "N/A"}</strong></div>
                                      <div>Phone: <strong>{o.shippingInfo?.phone || "N/A"}</strong></div>
                                      <div>Payment: {o.payment?.toUpperCase()}</div>
                                      {o.notes && (
                                        <div style={{ marginTop: 4, color: "var(--admin-accent)", fontSize: 12.5 }}>
                                          <strong>Note:</strong> {o.notes}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Lifecycle &amp; Courier</div>
                                      <div>
                                        Lifecycle Status: <strong style={{ color: statusColor }}>{statusLabel}</strong>
                                      </div>
                                      <div>
                                        Booking Status: <strong>{o.courierBookingStatus || "N/A"}</strong>
                                      </div>
                                      <div>
                                        Tracking #:{" "}
                                        {trackingNum ? (
                                          <a
                                            href={`https://postex.pk/tracking?trackingNumber=${trackingNum}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: "var(--admin-accent)", textDecoration: "underline", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}
                                          >
                                            <span>{trackingNum}</span>
                                            <IconExternalLink size={10} />
                                          </a>
                                        ) : (
                                          "Not booked"
                                        )}
                                      </div>
                                      <div>Courier Status Raw: {o.courierStatusRaw || "N/A"}</div>
                                    </div>
                                  </div>

                                  {/* ADMIN CUSTOMER NOTE (INTERNAL / STAFF ONLY) */}
                                  {(() => {
                                    const sInfo = parseShippingInfo(o.shippingInfo);
                                    const currentAdminNote = sInfo.adminNote || "";
                                    const isEditingThis = editingAdminNoteOrderId === o.id;

                                    return (
                                      <div
                                        style={{
                                          marginTop: 14,
                                          background: "var(--admin-surface)",
                                          border: "1px solid var(--admin-border)",
                                          borderLeft: "3px solid var(--admin-accent)",
                                          borderRadius: 6,
                                          padding: "12px 16px",
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--admin-accent)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                            <IconLock size={13} />
                                            <span>Admin Customer Note (Private · Staff Only)</span>
                                          </div>
                                          {!isEditingThis && (
                                            <button
                                              type="button"
                                              className="btn btn-outline btn-sm"
                                              style={{ fontSize: 11, padding: "2px 8px", minHeight: 26, display: "inline-flex", alignItems: "center", gap: 4 }}
                                              onClick={() => {
                                                setEditingAdminNoteOrderId(o.id);
                                                setAdminNoteInput(currentAdminNote);
                                              }}
                                            >
                                              <IconEdit size={11} />
                                              <span>{currentAdminNote ? "Edit Note" : "+ Add Note"}</span>
                                            </button>
                                          )}
                                        </div>

                                        {isEditingThis ? (
                                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                                            <textarea
                                              rows={2}
                                              value={adminNoteInput}
                                              onChange={(e) => setAdminNoteInput(e.target.value)}
                                              placeholder="e.g. VIP client, call customer before shipping, verified alternate phone, special packaging..."
                                              style={{
                                                width: "100%",
                                                padding: "8px 10px",
                                                fontSize: 12.5,
                                                borderRadius: 4,
                                                background: "var(--admin-surface-2)",
                                                color: "var(--admin-text)",
                                                border: "1px solid var(--admin-border)",
                                              }}
                                            />
                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                              <button
                                                type="button"
                                                className="btn btn-outline btn-sm"
                                                disabled={savingAdminNote}
                                                onClick={() => {
                                                  setEditingAdminNoteOrderId(null);
                                                  setAdminNoteInput("");
                                                }}
                                                style={{ fontSize: 11.5, padding: "3px 10px" }}
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                disabled={savingAdminNote}
                                                onClick={() => handleSaveInlineAdminNote(o.id, o)}
                                                style={{ fontSize: 11.5, padding: "3px 12px", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700 }}
                                              >
                                                <IconSave size={12} />
                                                <span>{savingAdminNote ? "Saving…" : "Save Note"}</span>
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: 13, color: currentAdminNote ? "var(--admin-text)" : "var(--admin-text-soft)", fontStyle: currentAdminNote ? "normal" : "italic" }}>
                                            {currentAdminNote || "No internal admin note attached to this customer yet. Only visible in this admin detail view."}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Order Items */}
                                  <div style={{ fontWeight: 700, marginTop: 18, marginBottom: 8 }}>Order Items</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {o.orderItems.map((item) => (
                                      <div
                                        key={item.id}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          background: "var(--admin-surface)",
                                          color: "var(--admin-text)",
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
                                          <div>
                                            <strong>{item.product?.name || item.productId}</strong>{" "}
                                            <span style={{ color: "var(--admin-text-soft)", fontSize: "12.5px" }}>
                                              ({item.color}/{item.size})
                                            </span>
                                          </div>
                                        </div>
                                        <div style={{ fontSize: "13.5px" }}>
                                          {item.quantity} × {fmtPrice(item.price)} ={" "}
                                          <strong>{fmtPrice(item.quantity * item.price)}</strong>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* REMARKS & POSTEX SHIPPER ADVICE PANEL */}
                                  <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16, marginBottom: 16 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                                      <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                                        <IconMessage size={15} style={{ color: "var(--admin-accent)" }} />
                                        <span>Remarks &amp; Shipper Advice</span>
                                        {trackingNum && (
                                          <span style={{ fontSize: 11, background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                                            PostEx #{trackingNum}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        style={{ fontSize: 11.5, padding: "4px 10px", minHeight: 30, display: "inline-flex", alignItems: "center", gap: 5 }}
                                        onClick={() => openRemarksModal(o)}
                                      >
                                        <IconMessage size={12} />
                                        <span>Add Remark / Shipper Advice</span>
                                      </button>
                                    </div>
                                    {(!o.auditLogs || o.auditLogs.filter((l) => l.action === "SHIPPER_ADVICE" || l.action === "ADD_REMARK").length === 0) ? (
                                      <div style={{ fontSize: 12.5, color: "var(--admin-text-soft)", padding: "4px 0" }}>
                                        No remarks added yet for this order. Click &quot;+ Add Remark&quot; to add customer notes or submit shipper advice to PostEx.
                                      </div>
                                    ) : (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {o.auditLogs
                                          .filter((l) => l.action === "SHIPPER_ADVICE" || l.action === "ADD_REMARK")
                                          .map((l) => (
                                            <div
                                              key={l.id}
                                              style={{
                                                background: "var(--admin-surface)",
                                                border: "1px solid var(--admin-border)",
                                                borderRadius: 4,
                                                padding: "8px 12px",
                                                fontSize: 12.5,
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                gap: 10,
                                              }}
                                            >
                                              <div>
                                                <span style={{ fontWeight: 700, color: "var(--admin-accent)" }}>{l.adminUser}: </span>
                                                <span>{l.note}</span>
                                              </div>
                                              <span style={{ fontSize: 11, color: "var(--admin-text-soft)", whiteSpace: "nowrap" }}>
                                                {new Date(l.createdAt).toLocaleString("en-PK", {
                                                  day: "2-digit",
                                                  month: "short",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                })}
                                              </span>
                                            </div>
                                          ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* ORDER AUDIT LOG */}
                                  <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                      <span>Order Lifecycle &amp; Audit History</span>
                                      <span
                                        style={{
                                          fontSize: 11,
                                          background: "var(--admin-surface)",
                                          padding: "2px 8px",
                                          borderRadius: 10,
                                          color: "var(--admin-text-soft)",
                                        }}
                                      >
                                        {o.auditLogs?.length || 0} events
                                      </span>
                                    </div>

                                    {!o.auditLogs || o.auditLogs.length === 0 ? (
                                      <div style={{ fontSize: 13, color: "var(--admin-text-soft)", padding: "8px 0" }}>
                                        No audit entries recorded for this order yet.
                                      </div>
                                    ) : (
                                      <div style={{ overflowX: "auto" }}>
                                        <table className="admin-table" style={{ fontSize: 12.5, background: "var(--admin-surface)" }}>
                                          <thead>
                                            <tr>
                                              <th style={{ padding: "6px 10px" }}>Timestamp</th>
                                              <th style={{ padding: "6px 10px" }}>Action</th>
                                              <th style={{ padding: "6px 10px" }}>Admin / Actor</th>
                                              <th style={{ padding: "6px 10px" }}>Notes / Details</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {o.auditLogs.map((log) => {
                                              let logBg = "var(--admin-surface-2)";
                                              let logColor = "var(--admin-text)";
                                              if (log.action === "HOLD") {
                                                logBg = "rgba(245, 158, 11, 0.18)";
                                                logColor = "#f59e0b";
                                              } else if (log.action === "RELEASE") {
                                                logBg = "rgba(200, 255, 0, 0.15)";
                                                logColor = "var(--admin-accent)";
                                              } else if (log.action === "CANCEL") {
                                                logBg = "rgba(239, 68, 68, 0.18)";
                                                logColor = "#ef4444";
                                              } else if (log.action === "SEND_POSTEX") {
                                                logBg = "rgba(59, 130, 246, 0.18)";
                                                logColor = "#3b82f6";
                                              }

                                              return (
                                                <tr key={log.id}>
                                                  <td style={{ padding: "6px 10px", color: "var(--admin-text-soft)", whiteSpace: "nowrap" }}>
                                                    {new Date(log.createdAt).toLocaleString("en-PK", {
                                                      day: "2-digit",
                                                      month: "short",
                                                      year: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                    })}
                                                  </td>
                                                  <td style={{ padding: "6px 10px" }}>
                                                    <span
                                                      className="badge"
                                                      style={{
                                                        background: logBg,
                                                        color: logColor,
                                                        fontWeight: 700,
                                                        fontSize: 10.5,
                                                      }}
                                                    >
                                                      {log.action}
                                                    </span>
                                                  </td>
                                                  <td style={{ padding: "6px 10px", fontWeight: 600 }}>
                                                    {log.adminUser}
                                                  </td>
                                                  <td style={{ padding: "6px 10px", color: "var(--admin-text)" }}>
                                                    {log.note || "-"}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
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

                {/* Unlimited Stock Policy Card */}
                <div
                  style={{
                    marginTop: 18,
                    padding: "16px 18px",
                    background: editFormIgnoreStock ? "rgba(200, 255, 0, 0.08)" : "var(--admin-surface-2)",
                    border: editFormIgnoreStock ? "1.5px solid var(--admin-accent)" : "1px solid var(--admin-border)",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: editFormIgnoreStock ? "var(--admin-accent)" : "var(--admin-text)" }}>
                        ♾️ Unlimited Stock Mode
                      </span>
                      {editFormIgnoreStock && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            background: "var(--admin-accent)",
                            color: "#000",
                            padding: "2px 7px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--admin-text-soft)", lineHeight: 1.4 }}>
                      When enabled, this product will continuously sell online without any thought about stock. Inventory counts will not block orders on the storefront.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${editFormIgnoreStock ? "btn-dark" : "btn-outline"}`}
                    style={{
                      flexShrink: 0,
                      fontWeight: 700,
                      fontSize: 12,
                      padding: "8px 14px",
                      background: editFormIgnoreStock ? "var(--admin-accent)" : undefined,
                      color: editFormIgnoreStock ? "#000" : undefined,
                      borderColor: editFormIgnoreStock ? "var(--admin-accent)" : undefined,
                    }}
                    onClick={() => handleToggleIgnoreStock(!editFormIgnoreStock)}
                  >
                    {editFormIgnoreStock ? "Disable Unlimited" : "Enable Unlimited"}
                  </button>
                </div>
              </div>

              {/* Bundle Pricing Section */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Bundle Pricing (&ldquo;Choose Your Bundle&rdquo;)</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--admin-text-soft)" }}>
                      Configure custom bundle prices for Buy 2 and Buy 3 for this product. Leave blank to automatically use store default discounts ({bundleSettings.defaultBuy2DiscountPercent}% and {bundleSettings.defaultBuy3DiscountPercent}%).
                    </p>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editBundleEnabled}
                      onChange={(e) => setEditBundleEnabled(e.target.checked)}
                    />
                    <span>Enable Bundle Options on PDP</span>
                  </label>
                </div>

                {editBundleEnabled && (
                  <div className="admin-form-grid-2" style={{ gap: 20 }}>
                    <div className="field">
                      <label>Buy 2 Total Price (PKR)</label>
                      <input
                        type="number"
                        placeholder={`Auto: PKR ${Math.round((Number(editFormPrice) || editingProduct.price) * 2 * (1 - bundleSettings.defaultBuy2DiscountPercent / 100))}`}
                        value={editBuy2Price}
                        onChange={(e) => setEditBuy2Price(e.target.value)}
                      />
                      <span style={{ fontSize: 11, color: "var(--admin-text-soft)", marginTop: 4 }}>
                        Total price for 2 pairs combined.
                      </span>
                    </div>

                    <div className="field">
                      <label>Buy 2 Badge Text (e.g. 10% OFF)</label>
                      <input
                        type="text"
                        placeholder="10% OFF"
                        value={editBuy2DiscountText}
                        onChange={(e) => setEditBuy2DiscountText(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Buy 3 Total Price (PKR)</label>
                      <input
                        type="number"
                        placeholder={`Auto: PKR ${Math.round((Number(editFormPrice) || editingProduct.price) * 3 * (1 - bundleSettings.defaultBuy3DiscountPercent / 100))}`}
                        value={editBuy3Price}
                        onChange={(e) => setEditBuy3Price(e.target.value)}
                      />
                      <span style={{ fontSize: 11, color: "var(--admin-text-soft)", marginTop: 4 }}>
                        Total price for 3 pairs combined.
                      </span>
                    </div>

                    <div className="field">
                      <label>Buy 3 Badge Text (e.g. 15% OFF)</label>
                      <input
                        type="text"
                        placeholder="15% OFF"
                        value={editBuy3DiscountText}
                        onChange={(e) => setEditBuy3DiscountText(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Color Galleries & Stock Manager Section */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, color: "var(--admin-text)" }}>Color Galleries &amp; Stock Manager</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--admin-text-soft)" }}>
                      Manage images and size stock levels per color. Select a tab to edit that color.
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {/* Unlimited Mode Quick Switch */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 12px",
                        background: editFormIgnoreStock ? "rgba(200, 255, 0, 0.1)" : "var(--admin-surface-2)",
                        border: editFormIgnoreStock ? "1.5px solid var(--admin-accent)" : "1px solid var(--admin-border)",
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: editFormIgnoreStock ? "var(--admin-accent)" : "var(--admin-text)" }}>
                          {editFormIgnoreStock ? "♾️ Unlimited Selling: ACTIVE" : "📦 Stock Tracking: STRICT"}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--admin-text-soft)" }}>
                          {editFormIgnoreStock ? "Orders never blocked by zero stock" : "Orders blocked when size reaches 0"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${editFormIgnoreStock ? "btn-dark" : "btn-outline"}`}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 10px",
                          background: editFormIgnoreStock ? "var(--admin-accent)" : undefined,
                          color: editFormIgnoreStock ? "#000" : undefined,
                          borderColor: editFormIgnoreStock ? "var(--admin-accent)" : undefined,
                        }}
                        onClick={() => handleToggleIgnoreStock(!editFormIgnoreStock)}
                      >
                        {editFormIgnoreStock ? "Turn OFF" : "Enable Unlimited"}
                      </button>
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
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <h4 style={{ margin: 0, color: "var(--admin-text)", fontSize: 14 }}>
                                Panel 2: Stock ({activeColorObj.name})
                              </h4>
                              {editFormIgnoreStock && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: "var(--admin-accent)",
                                    background: "rgba(200, 255, 0, 0.12)",
                                    border: "1px solid var(--admin-accent)",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.03em",
                                  }}
                                  title="Unlimited Selling is active for this product"
                                >
                                  ♾️ Unlimited
                                </span>
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: editFormIgnoreStock ? "var(--admin-accent)" : activeTotalStock === 0 ? "var(--admin-danger)" : activeTotalStock <= 3 ? "var(--admin-warn)" : "var(--admin-accent)",
                              }}
                            >
                              {editFormIgnoreStock ? `Total: ${activeTotalStock} in stock (Unlimited Mode)` : `Total: ${activeTotalStock} in stock`}
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
                    className="btn btn-outline"
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
          ) : activeTab === "home" ? (
            <HomePageManager
              authFetch={authFetch}
              allProducts={products}
              onRefreshProducts={() => loadMainData(true)}
              showToast={showToast}
            />
          ) : (
            /* TAB 8: SETTINGS */
            <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 840 }}>
              {/* Delivery & Shipping Fee Settings Panel */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Delivery &amp; Shipping Fee Settings</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--admin-text-soft)" }}>
                      Configure flat-rate delivery charges, free delivery minimum order threshold, and storefront shipping rules.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-dark btn-sm"
                    disabled={savingShippingSettings}
                    onClick={handleSaveShippingSettings}
                  >
                    {savingShippingSettings ? "Saving…" : "Save Delivery Settings"}
                  </button>
                </div>

                <div className="admin-form-grid-2" style={{ gap: 20, marginBottom: 16 }}>
                  <div className="field">
                    <label>Standard Delivery Fee (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={shippingSettings.standardDeliveryFee}
                      onChange={(e) =>
                        setShippingSettings((prev) => ({
                          ...prev,
                          standardDeliveryFee: Number(e.target.value),
                        }))
                      }
                    />
                    <span style={{ fontSize: 11.5, color: "var(--admin-text-soft)", marginTop: 4 }}>
                      Flat delivery charge added to customer orders during checkout.
                    </span>
                  </div>

                  <div className="field">
                    <label>Free Delivery Minimum Subtotal (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={shippingSettings.freeDeliveryThreshold}
                      onChange={(e) =>
                        setShippingSettings((prev) => ({
                          ...prev,
                          freeDeliveryThreshold: Number(e.target.value),
                        }))
                      }
                    />
                    <span style={{ fontSize: 11.5, color: "var(--admin-text-soft)", marginTop: 4 }}>
                      Orders at or above this subtotal qualify for free shipping. Set to 0 to disable free delivery.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, padding: "12px 16px", background: "var(--admin-surface-2)", borderRadius: 6 }}>
                  <input
                    type="checkbox"
                    id="shipping-enabled-toggle"
                    checked={shippingSettings.enabled}
                    onChange={(e) =>
                      setShippingSettings((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }))
                    }
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <label htmlFor="shipping-enabled-toggle" style={{ margin: 0, cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
                    Enable delivery fee charges on storefront
                  </label>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: shippingSettings.enabled ? "var(--admin-success)" : "var(--admin-text-soft)" }}>
                    {shippingSettings.enabled
                      ? `Active: PKR ${shippingSettings.standardDeliveryFee} Delivery${shippingSettings.freeDeliveryThreshold > 0 ? ` · Free above PKR ${shippingSettings.freeDeliveryThreshold.toLocaleString()}` : ""}`
                      : "Free Delivery Across All Orders (Charges Disabled)"}
                  </span>
                </div>
              </div>

              {/* Promo Code & Discount Settings Panel */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Promo Code & Discount Settings</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--admin-text-soft)" }}>
                      Configure the active storefront promo coupon code, discount rate or fixed amount, and order rules.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-dark btn-sm"
                    disabled={savingPromoSettings}
                    onClick={handleSavePromoSettings}
                  >
                    {savingPromoSettings ? "Saving…" : "Save Promo Settings"}
                  </button>
                </div>

                <div className="admin-form-grid-2" style={{ gap: 20, marginBottom: 16 }}>
                  <div className="field">
                    <label>Active Promo Code</label>
                    <input
                      type="text"
                      value={promoSettings.code}
                      placeholder="Promo code"
                      onChange={(e) =>
                        setPromoSettings((prev) => ({
                          ...prev,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                    <span style={{ fontSize: 11.5, color: "var(--admin-text-soft)", marginTop: 4 }}>
                      Customers enter this code in cart or checkout.
                    </span>
                  </div>

                  <div className="field">
                    <label>Discount Type</label>
                    <select
                      value={promoSettings.discountType}
                      onChange={(e) =>
                        setPromoSettings((prev) => ({
                          ...prev,
                          discountType: e.target.value as "percent" | "fixed",
                        }))
                      }
                    >
                      <option value="percent">Percentage Discount (%)</option>
                      <option value="fixed">Fixed Amount (PKR)</option>
                    </select>
                    <span style={{ fontSize: 11.5, color: "var(--admin-text-soft)", marginTop: 4 }}>
                      Choose percentage (%) or flat PKR discount.
                    </span>
                  </div>
                </div>

                <div className="admin-form-grid-2" style={{ gap: 20, marginBottom: 16 }}>
                  <div className="field">
                    <label>
                      {promoSettings.discountType === "percent"
                        ? "Discount Percentage (%)"
                        : "Discount Amount (PKR)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={promoSettings.discountType === "percent" ? 100 : 100000}
                      value={promoSettings.discountValue}
                      onChange={(e) =>
                        setPromoSettings((prev) => ({
                          ...prev,
                          discountValue: Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Minimum Order Subtotal (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={promoSettings.minOrderAmount}
                      onChange={(e) =>
                        setPromoSettings((prev) => ({
                          ...prev,
                          minOrderAmount: Number(e.target.value),
                        }))
                      }
                    />
                    <span style={{ fontSize: 11.5, color: "var(--admin-text-soft)", marginTop: 4 }}>
                      Set to 0 for no minimum subtotal requirement.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, padding: "12px 16px", background: "var(--admin-surface-2)", borderRadius: 6 }}>
                  <input
                    type="checkbox"
                    id="promo-enabled-toggle"
                    checked={promoSettings.enabled}
                    onChange={(e) =>
                      setPromoSettings((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }))
                    }
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <label htmlFor="promo-enabled-toggle" style={{ margin: 0, cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
                    Enable promo code on storefront
                  </label>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: promoSettings.enabled ? "var(--admin-success)" : "var(--admin-text-soft)" }}>
                    {promoSettings.enabled
                      ? `Active: ${promoSettings.code} (${promoSettings.discountValue}${promoSettings.discountType === "percent" ? "%" : " PKR"} OFF)`
                      : "Promo Disabled"}
                  </span>
                </div>
              </div>

              {/* Category Low-Stock Thresholds */}
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

              {/* Bundle Pricing Settings Panel */}
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Store-Wide Bundle Pricing</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--admin-text-soft)" }}>
                      Default discount percentages applied to &ldquo;Choose Your Bundle&rdquo; when no manual product override is set.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-dark btn-sm"
                    disabled={savingBundleSettings}
                    onClick={() =>
                      handleSaveGlobalBundleSettings(
                        bundleSettings.defaultBuy2DiscountPercent,
                        bundleSettings.defaultBuy3DiscountPercent
                      )
                    }
                  >
                    {savingBundleSettings ? "Saving…" : "Save Global Discounts"}
                  </button>
                </div>

                <div className="admin-form-grid-2" style={{ gap: 20, marginBottom: 20 }}>
                  <div className="field">
                    <label>Buy 2 Default Discount (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={bundleSettings.defaultBuy2DiscountPercent}
                      onChange={(e) =>
                        setBundleSettings((prev) => ({
                          ...prev,
                          defaultBuy2DiscountPercent: Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Buy 3 Default Discount (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={bundleSettings.defaultBuy3DiscountPercent}
                      onChange={(e) =>
                        setBundleSettings((prev) => ({
                          ...prev,
                          defaultBuy3DiscountPercent: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                <h4 style={{ fontSize: 14, margin: "20px 0 8px 0" }}>Per-Product Manual Bundle Pricing Overrides</h4>
                <div style={{ overflowX: "auto" }}>
                  <table className="admin-table" style={{ width: "100%", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Base Price</th>
                        <th>Buy 2 Bundle Price</th>
                        <th>Buy 3 Bundle Price</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const override = bundleSettings.products[p.id] || {};
                        const defaultB2 = Math.round(p.price * 2 * (1 - bundleSettings.defaultBuy2DiscountPercent / 100));
                        const defaultB3 = Math.round(p.price * 3 * (1 - bundleSettings.defaultBuy3DiscountPercent / 100));
                        return (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td>PKR {p.price.toLocaleString()}</td>
                            <td>
                              <input
                                type="number"
                                placeholder={`Auto: ${defaultB2}`}
                                style={{ width: 120, padding: "4px 8px" }}
                                value={override.buy2Price ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : null;
                                  setBundleSettings((prev) => ({
                                    ...prev,
                                    products: {
                                      ...prev.products,
                                      [p.id]: {
                                        ...prev.products[p.id],
                                        buy2Price: val,
                                      },
                                    },
                                  }));
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                placeholder={`Auto: ${defaultB3}`}
                                style={{ width: 120, padding: "4px 8px" }}
                                value={override.buy3Price ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : null;
                                  setBundleSettings((prev) => ({
                                    ...prev,
                                    products: {
                                      ...prev.products,
                                      [p.id]: {
                                        ...prev.products[p.id],
                                        buy3Price: val,
                                      },
                                    },
                                  }));
                                }}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => handleSaveProductBundleRow(p.id, bundleSettings.products[p.id] || {})}
                              >
                                Save
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!modalSubmitting) {
              setConfirmModal((prev) => ({ ...prev, isOpen: false }));
              setModalReasonInput("");
            }
          }}
        >
          <div
            className="modal"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 style={{ color: confirmModal.danger ? "var(--admin-danger, #ef4444)" : "inherit" }}>
                {confirmModal.title}
              </h3>
              <button
                type="button"
                className="modal-close"
                disabled={modalSubmitting}
                onClick={() => {
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                  setModalReasonInput("");
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--admin-text)", lineHeight: 1.5 }}>
                {confirmModal.message}
              </p>

              {confirmModal.requiresReason && (
                <div className="field" style={{ marginTop: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Reason / Note (optional):</label>
                  <textarea
                    rows={3}
                    placeholder={confirmModal.reasonPlaceholder || "e.g. Customer requested cancellation via WhatsApp"}
                    value={modalReasonInput}
                    onChange={(e) => setModalReasonInput(e.target.value)}
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </div>
              )}
            </div>
            <div className="modal-foot" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={modalSubmitting}
                onClick={() => {
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                  setModalReasonInput("");
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                className={`btn btn-sm ${confirmModal.danger ? "btn-danger" : "btn-dark"}`}
                style={confirmModal.danger ? { backgroundColor: "#dc2626", color: "#fff", borderColor: "#dc2626" } : {}}
                disabled={modalSubmitting}
                onClick={async () => {
                  setModalSubmitting(true);
                  try {
                    await confirmModal.onConfirm(modalReasonInput.trim() || undefined);
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                    setModalReasonInput("");
                  } finally {
                    setModalSubmitting(false);
                  }
                }}
              >
                {modalSubmitting ? "Processing…" : confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remarks & PostEx Shipper Advice Modal */}
      {remarksOrder && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!remarksSubmitting) {
              setRemarksOrder(null);
            }
          }}
        >
          <div
            className="modal"
            style={{ maxWidth: 580, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-head" style={{ borderBottom: "1px solid var(--admin-border)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
                  <IconMessage size={18} />
                  <span>Remarks &amp; Shipper Advice</span>
                </h3>
                <div style={{ fontSize: 12.5, color: "var(--admin-text-soft)", marginTop: 3 }}>
                  Order <strong>#{remarksOrder.id.slice(-8)}</strong> · {remarksOrder.customerName} ({remarksOrder.shippingInfo?.city || "Unknown City"})
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                disabled={remarksSubmitting}
                onClick={() => setRemarksOrder(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Courier Tracking Status Bar */}
              <div
                style={{
                  background: "var(--admin-surface-2)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <span style={{ fontSize: 11.5, color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    PostEx Tracking Number
                  </span>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 1 }}>
                    {remarksHistory.trackingNumber ? (
                      <a
                        href={`https://postex.pk/tracking?trackingNumber=${remarksHistory.trackingNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#3b82f6", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        {remarksHistory.trackingNumber}
                        <IconExternalLink size={12} />
                      </a>
                    ) : (
                      <span style={{ color: "var(--admin-text-soft)", fontWeight: 500 }}>Not booked with PostEx yet</span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11.5, color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Order Total
                  </span>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {fmtPrice(remarksOrder.total)}
                  </div>
                </div>
              </div>

              {/* Error Index Card (if error / notice was returned) */}
              {remarksErrorDetail && (
                <div
                  style={{
                    background:
                      remarksErrorDetail.severity === "error"
                        ? "rgba(239, 68, 68, 0.12)"
                        : remarksErrorDetail.severity === "warning"
                        ? "rgba(245, 158, 11, 0.12)"
                        : "rgba(59, 130, 246, 0.12)",
                    border: `1px solid ${
                      remarksErrorDetail.severity === "error"
                        ? "rgba(239, 68, 68, 0.35)"
                        : remarksErrorDetail.severity === "warning"
                        ? "rgba(245, 158, 11, 0.35)"
                        : "rgba(59, 130, 246, 0.35)"
                    }`,
                    borderRadius: 6,
                    padding: "10px 14px",
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong style={{ fontSize: 13, color: "var(--admin-text)" }}>
                      {remarksErrorDetail.title}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--admin-surface)",
                        color: "var(--admin-text-soft)",
                        border: "1px solid var(--admin-border)",
                      }}
                    >
                      {remarksErrorDetail.code}
                    </span>
                  </div>
                  <div style={{ color: "var(--admin-text-soft)", marginBottom: 4 }}>
                    {remarksErrorDetail.message}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--admin-accent)" }}>
                    <strong>Resolution:</strong> {remarksErrorDetail.resolution}
                  </div>
                </div>
              )}

              {/* Remarks History List */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    Remarks &amp; Shipper Advice History
                  </span>
                  <button
                    type="button"
                    style={{ fontSize: 11.5, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => fetchRemarksHistory(remarksOrder.id)}
                  >
                    <IconRefresh size={12} />
                    Refresh
                  </button>
                </div>

                {remarksLoading ? (
                  <div style={{ padding: "14px", textAlign: "center", fontSize: 12.5, color: "var(--admin-text-soft)" }}>
                    Loading remarks from PostEx API…
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                    {/* Live PostEx Shipper Advice Items */}
                    {remarksHistory.postexRemarks && remarksHistory.postexRemarks.length > 0 && (
                      remarksHistory.postexRemarks.map((item, idx) => (
                        <div
                          key={`postex-rem-${idx}`}
                          style={{
                            background: "rgba(59, 130, 246, 0.08)",
                            border: "1px solid rgba(59, 130, 246, 0.25)",
                            borderRadius: 6,
                            padding: "8px 12px",
                            fontSize: 12.5,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <span style={{ fontWeight: 700, color: "#2563eb", fontSize: 11 }}>
                              POSTEX SHIPPER ADVICE {item.username ? `· ${item.username}` : ""}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--admin-text-soft)" }}>
                              {item.remarksDate || "Recent"}
                            </span>
                          </div>
                          <div style={{ color: "var(--admin-text)" }}>{item.remarks}</div>
                        </div>
                      ))
                    )}

                    {/* Local Remarks & Audit Items */}
                    {remarksHistory.localRemarks && remarksHistory.localRemarks.length > 0 ? (
                      remarksHistory.localRemarks.map((log) => (
                        <div
                          key={log.id}
                          style={{
                            background: "var(--admin-surface)",
                            border: "1px solid var(--admin-border)",
                            borderRadius: 6,
                            padding: "8px 12px",
                            fontSize: 12.5,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 700, color: "var(--admin-accent)" }}>
                                {log.adminUser || "Admin"}
                              </span>
                              {log.action === "SHIPPER_ADVICE" ? (
                                <span style={{ fontSize: 10, background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>
                                  POSTEX SYNCED
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, background: "rgba(200, 255, 0, 0.1)", color: "var(--admin-accent)", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>
                                  ORDER NOTE
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 11, color: "var(--admin-text-soft)" }}>
                              {new Date(log.createdAt).toLocaleString("en-PK", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div style={{ color: "var(--admin-text)" }}>{log.note || "-"}</div>
                        </div>
                      ))
                    ) : null}

                    {(!remarksHistory.postexRemarks || remarksHistory.postexRemarks.length === 0) &&
                      (!remarksHistory.localRemarks || remarksHistory.localRemarks.length === 0) && (
                        <div style={{ padding: "12px", textAlign: "center", fontSize: 12.5, color: "var(--admin-text-soft)", background: "var(--admin-surface)", borderRadius: 6 }}>
                          No remarks recorded yet. Use the form below to add remarks or submit advice to PostEx.
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Add Remark Form */}
              <form onSubmit={handleSaveRemark} style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  Add New Remark / Shipper Advice
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Status ID Selector */}
                  <div className="field">
                    <label style={{ fontSize: 12.5, fontWeight: 600 }}>Advice / Remark Type</label>
                    <select
                      value={remarksStatusId}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setRemarksStatusId(val);
                        if (val === 1 || val === 2) {
                          setRemarksSyncPostex(Boolean(remarksHistory.trackingNumber));
                        } else {
                          setRemarksSyncPostex(false);
                        }
                      }}
                      style={{ padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                    >
                      <option value={0}>📝 Internal Order Note (Store DB Only)</option>
                      <option value={2}>🚚 2 — Mark Retry Attempt (PostEx Courier Reattempt)</option>
                      <option value={1}>📦 1 — Mark Return Requested (PostEx Return to Origin)</option>
                    </select>
                  </div>

                  {/* Contextual Notice based on selected advice type */}
                  {remarksStatusId === 0 ? (
                    <div
                      style={{
                        background: "rgba(200, 255, 0, 0.08)",
                        border: "1px solid rgba(200, 255, 0, 0.25)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "var(--admin-accent)",
                      }}
                    >
                      ℹ️ <strong>Internal Store Note:</strong> This remark will be stored locally in the order history and customer notes. It will NOT be sent to PostEx courier.
                    </div>
                  ) : remarksHistory.trackingNumber ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <input
                        type="checkbox"
                        id="syncPostexCheck"
                        checked={remarksSyncPostex}
                        onChange={(e) => setRemarksSyncPostex(e.target.checked)}
                      />
                      <label htmlFor="syncPostexCheck" style={{ fontSize: 12.5, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <IconZap size={13} style={{ color: "var(--admin-accent)" }} />
                        <span>Dispatch to PostEx Courier Rider via Save Shipper Advice API (Status ID: {remarksStatusId})</span>
                      </label>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#fbbf24",
                      }}
                    >
                      ⚠️ <strong>Courier Dispatch Disabled:</strong> This order does not have an active PostEx tracking number. This remark will be saved to your local database only.
                    </div>
                  )}

                  {/* Remarks Input */}
                  <div className="field">
                    <label style={{ fontSize: 12.5, fontWeight: 600 }}>
                      Remarks / Instructions <span style={{ color: "var(--admin-danger)" }}>*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder={
                        remarksStatusId === 2
                          ? "e.g., Customer confirmed available tomorrow at 4 PM. Please re-dispatch package."
                          : remarksStatusId === 1
                          ? "e.g., Customer refused delivery / returned item. Please return to warehouse."
                          : "e.g., Customer requested delivery in afternoon after 2 PM."
                      }
                      value={remarksInput}
                      onChange={(e) => setRemarksInput(e.target.value)}
                      required
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={remarksSubmitting}
                      onClick={() => setRemarksOrder(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={remarksSubmitting || !remarksInput.trim()}
                      style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <IconMessage size={13} />
                      {remarksSubmitting ? "Submitting…" : "Save & Submit Remark"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Details Modal */}
      {editingOrder && (() => {
        const isCancelled =
          editingOrder.orderStatus === "CANCELLED" || editingOrder.status === "cancelled";
        const isBooked =
          !isCancelled &&
          (editingOrder.courierBookingStatus === "booked" ||
            ["shipped", "delivered"].includes(editingOrder.status));
        const trackingNum = editingOrder.trackingNumber || editingOrder.postexTrackingNumber;
        const liveSubtotal = editOrderForm.items.reduce((sum, it) => sum + (it.price * (it.quantity || 1)), 0);
        const liveDiscount = Math.min(editingOrder.discount || 0, liveSubtotal);
        const liveShipping = Number(editOrderForm.shippingFee) || 0;
        const liveTotal = liveSubtotal - liveDiscount + liveShipping;

        return (
          <div
            className="modal-overlay"
            onClick={() => {
              if (!savingEditOrder) {
                setEditingOrder(null);
              }
            }}
          >
            <div
              className="modal"
              style={{ maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="modal-head" style={{ borderBottom: "1px solid var(--admin-border)" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
                    {isCancelled ? <IconRefresh size={17} /> : <IconEdit size={17} />}
                    <span>{isCancelled ? "Edit & Resend Order" : "Edit Order"} #{editingOrder.id.slice(-8)}</span>
                    {isCancelled && (
                      <span className="badge badge-danger" style={{ fontSize: 11 }}>CANCELLED</span>
                    )}
                    {editingOrder.isTest && (
                      <span className="badge badge-warn" style={{ fontSize: 11 }}>TEST</span>
                    )}
                  </h3>
                  <div style={{ fontSize: 12.5, color: "var(--admin-text-soft)", marginTop: 4, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <IconClock size={12} /> Placed: <strong style={{ color: "var(--admin-accent)" }}>{formatDateTime(editingOrder.createdAt)}</strong>
                    </span>
                    <span>·</span>
                    <span>Status: <strong style={{ textTransform: "uppercase" }}>{editingOrder.orderStatus || editingOrder.status}</strong></span>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  disabled={savingEditOrder}
                  onClick={() => setEditingOrder(null)}
                  aria-label="Close edit order modal"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSaveEditOrder} style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
                <div className="modal-body" style={{ overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* City Datalist for autocomplete */}
                  <datalist id="admin-order-cities-list">
                    {Array.from(
                      new Set([
                        ...courierCities.defaultCities,
                        ...courierCities.dbCities.map((c) => c.cityName),
                        "KARACHI",
                        "LAHORE",
                        "ISLAMABAD",
                        "RAWALPINDI",
                        "FAISALABAD",
                        "MULTAN",
                        "PESHAWAR",
                        "QUETTA",
                        "SIALKOT",
                        "GUJRANWALA",
                        "HYDERABAD",
                        "ABBOTTABAD",
                        "ATTOCK",
                        "HAZRO",
                        "SARGODHA",
                        "BAHAWALPUR",
                        "SUKKUR",
                        "LARKANA",
                        "SHEIKHUPURA",
                        "JHANG",
                        "RAHIM YAR KHAN",
                        "GUJRAT",
                        "KASUR",
                        "MARDAN",
                      ])
                    )
                      .sort()
                      .map((cityName) => (
                        <option key={cityName} value={cityName} />
                      ))}
                  </datalist>

                  {/* Cancelled re-dispatch banner */}
                  {isCancelled && (
                    <div
                      style={{
                        background: "rgba(200, 255, 0, 0.1)",
                        border: "1px solid rgba(200, 255, 0, 0.35)",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 12.5,
                        color: "var(--admin-accent)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <IconRefresh size={16} />
                      <div>
                        <strong>Cancelled Order Re-dispatch Mode:</strong> You can edit any customer details, fix the delivery address, or modify items below. Saving will restore this order to <strong>READY TO SHIP</strong> status and queue it for PostEx dispatch.
                      </div>
                    </div>
                  )}

                  {/* Warning banner if booked */}
                  {isBooked && (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 12.5,
                        color: "#fbbf24",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <IconAlert size={16} />
                      <div>
                        This order is booked with PostEx {trackingNum ? `(#${trackingNum})` : ""}. To modify address or items, please cancel the PostEx booking first. Notes can still be edited.
                      </div>
                    </div>
                  )}

                  {/* Error banner */}
                  {editOrderError && (
                    <div
                      style={{
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 12.5,
                        color: "#f87171",
                      }}
                    >
                      {editOrderError}
                    </div>
                  )}

                  {/* Section 1: Customer Information */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: "var(--admin-accent)" }}>
                      1. Customer &amp; Contact Details
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>
                          Customer Full Name <span style={{ color: "var(--admin-danger)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={editOrderForm.customerName}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, customerName: e.target.value })}
                          disabled={savingEditOrder || isBooked}
                          required
                          placeholder="e.g. Majid Khan"
                          style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                        />
                      </div>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>
                          Phone Number <span style={{ color: "var(--admin-danger)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={editOrderForm.phone}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, phone: e.target.value })}
                          disabled={savingEditOrder || isBooked}
                          required
                          placeholder="e.g. 03065465159 or +923065465159"
                          style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Email Address</label>
                        <input
                          type="email"
                          value={editOrderForm.email}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, email: e.target.value })}
                          disabled={savingEditOrder || isBooked}
                          placeholder="e.g. customer@example.com"
                          style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                        />
                      </div>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>
                          City <span style={{ color: "var(--admin-danger)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          list="admin-order-cities-list"
                          value={editOrderForm.city}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, city: e.target.value.toUpperCase() })}
                          disabled={savingEditOrder || isBooked}
                          required
                          placeholder="e.g. HAZRO, KARACHI, LAHORE"
                          style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)", textTransform: "uppercase" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Shipping Address */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: "var(--admin-accent)" }}>
                      2. Shipping Address &amp; Delivery Instructions
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 12, fontWeight: 600 }}>
                        Complete Delivery Address <span style={{ color: "var(--admin-danger)" }}>*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={editOrderForm.address}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, address: e.target.value })}
                        disabled={savingEditOrder || isBooked}
                        required
                        placeholder="House / Flat / Shop #, Street, Area, Landmark"
                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                      />
                    </div>

                    <div className="field" style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Order Notes (Customer Instructions from Checkout)</label>
                      <textarea
                        rows={2}
                        value={editOrderForm.notes}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, notes: e.target.value })}
                        disabled={savingEditOrder}
                        placeholder="Customer instructions entered during checkout"
                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                      />
                    </div>

                    <div className="field" style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--admin-accent)" }}>
                        <IconLock size={12} />
                        <span>Admin Customer Note (Private · Staff Only · Appears Only in Detail)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={editOrderForm.adminNote}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, adminNote: e.target.value })}
                        disabled={savingEditOrder}
                        placeholder="Internal staff notes attached to this customer/order (never visible to customer, appears only in admin detail)"
                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)", border: "1px solid rgba(200, 255, 0, 0.3)" }}
                      />
                    </div>
                  </div>

                  {/* Section 3: Payment & Shipping Fee */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: "var(--admin-accent)" }}>
                      3. Payment &amp; Shipping Charges
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Payment Method</label>
                        <select
                          value={editOrderForm.payment}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, payment: e.target.value })}
                          disabled={savingEditOrder || isBooked}
                          style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                        >
                          <option value="cod">Cash on Delivery (COD)</option>
                          <option value="card">Credit / Debit Card</option>
                          <option value="easypaisa">EasyPaisa</option>
                          <option value="jazzcash">JazzCash</option>
                          <option value="bank">Bank Transfer</option>
                        </select>
                      </div>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Shipping Fee (PKR)</label>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={editOrderForm.shippingFee}
                          onChange={(e) => setEditOrderForm({ ...editOrderForm, shippingFee: Math.max(0, Number(e.target.value) || 0) })}
                          disabled={savingEditOrder || isBooked}
                          style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 4, background: "var(--admin-surface)" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Order Items & Quantities */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: "var(--admin-accent)" }}>
                      4. Order Items
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {editOrderForm.items.map((item, index) => (
                        <div
                          key={item.id || index}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "var(--admin-surface)",
                            border: "1px solid var(--admin-border)",
                            borderRadius: 6,
                            padding: "8px 12px",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                            {item.hero && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={item.hero}
                                alt=""
                                width={36}
                                height={36}
                                style={{ objectFit: "cover", borderRadius: 4 }}
                              />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.name}
                              </strong>
                              <span style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>
                                {item.color} / {item.size} · {fmtPrice(item.price)} each
                              </span>
                            </div>
                          </div>

                          {/* Quantity control */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {!isBooked && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
                                disabled={savingEditOrder || item.quantity <= 1}
                                onClick={() => {
                                   const updated = [...editOrderForm.items];
                                   updated[index] = { ...updated[index], quantity: Math.max(1, item.quantity - 1) };
                                   setEditOrderForm({ ...editOrderForm, items: updated });
                                }}
                              >
                                -
                              </button>
                            )}

                            <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center", fontSize: 13 }}>
                              {item.quantity}
                            </span>

                            {!isBooked && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
                                disabled={savingEditOrder}
                                onClick={() => {
                                   const updated = [...editOrderForm.items];
                                   updated[index] = { ...updated[index], quantity: item.quantity + 1 };
                                   setEditOrderForm({ ...editOrderForm, items: updated });
                                }}
                              >
                                +
                              </button>
                            )}

                            <div style={{ minWidth: 90, textAlign: "right", fontWeight: 700, fontSize: 13.5 }}>
                              {fmtPrice(item.quantity * item.price)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 5: Order Total Summary */}
                  <div
                    style={{
                      background: "var(--admin-surface)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 6,
                      padding: "12px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--admin-text-soft)" }}>Items Subtotal:</span>
                      <span>{fmtPrice(liveSubtotal)}</span>
                    </div>
                    {liveDiscount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#10b981" }}>
                        <span>Discount:</span>
                        <span>- {fmtPrice(liveDiscount)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--admin-text-soft)" }}>Shipping Fee:</span>
                      <span>{fmtPrice(liveShipping)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderTop: "1px solid var(--admin-border)",
                        paddingTop: 8,
                        marginTop: 4,
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--admin-accent)",
                      }}
                    >
                      <span>New Order Total:</span>
                      <span>{fmtPrice(liveTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div
                  className="modal-actions"
                  style={{
                    borderTop: "1px solid var(--admin-border)",
                    padding: "14px 20px",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    background: "var(--admin-surface-2)",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={savingEditOrder}
                    onClick={() => setEditingOrder(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={savingEditOrder}
                    style={{ fontWeight: 700, padding: "6px 18px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {isCancelled ? <IconRefresh size={14} /> : <IconSave size={14} />}
                    {savingEditOrder ? (isCancelled ? "Saving & Resending…" : "Saving Changes…") : (isCancelled ? "Save & Resend Order" : "Save Changes")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Quick Create New Order Modal */}
      {showNewOrderModal && (() => {
        const subtotal = newOrderForm.items.reduce(
          (sum, it) => sum + it.price * (it.quantity || 1),
          0
        );
        const discount = Math.min(subtotal, Math.max(0, Number(newOrderForm.discount) || 0));
        const shippingFee = Math.max(0, Number(newOrderForm.shippingFee) || 0);
        const netTotal = Math.max(0, subtotal - discount) + shippingFee;

        const selectedProd = products.find((p) => p.id === newOrderSelectedProdId) || products[0];
        const selectedProdColors = getProductColors(selectedProd);
        const selectedProdSizes = getProductSizes(selectedProd);

        return (
          <div
            className="modal-overlay"
            onClick={() => {
              if (!creatingNewOrder) {
                setShowNewOrderModal(false);
              }
            }}
          >
            <div
              className="modal"
              style={{
                maxWidth: 860,
                maxHeight: "94vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                className="modal-head"
                style={{
                  borderBottom: "1px solid var(--admin-border)",
                  padding: "16px 22px",
                  background: "var(--admin-surface)",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "var(--admin-text)",
                    }}
                  >
                    <span
                      style={{
                        background: "var(--admin-accent)",
                        color: "#111",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      + NEW
                    </span>
                    <span>Quick Create Order</span>
                  </h3>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--admin-text-soft)",
                      marginTop: 3,
                    }}
                  >
                    Manually generate customer order, reserve stock, and queue for PostEx dispatch.
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  disabled={creatingNewOrder}
                  onClick={() => setShowNewOrderModal(false)}
                  aria-label="Close create order modal"
                >
                  ✕
                </button>
              </div>

              {/* Form & Body */}
              <form
                onSubmit={handleCreateNewOrder}
                style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}
              >
                <div
                  className="modal-body"
                  style={{
                    overflowY: "auto",
                    padding: "20px 22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {/* City Datalist for autocomplete */}
                  <datalist id="admin-new-order-cities-list">
                    {Array.from(
                      new Set([
                        ...courierCities.defaultCities,
                        ...courierCities.dbCities.map((c) => c.cityName),
                        "KARACHI",
                        "LAHORE",
                        "ISLAMABAD",
                        "RAWALPINDI",
                        "FAISALABAD",
                        "MULTAN",
                        "PESHAWAR",
                        "QUETTA",
                        "SIALKOT",
                        "GUJRANWALA",
                        "HYDERABAD",
                        "ABBOTTABAD",
                        "ATTOCK",
                        "HAZRO",
                        "SARGODHA",
                        "BAHAWALPUR",
                        "SUKKUR",
                        "LARKANA",
                        "SHEIKHUPURA",
                        "JHANG",
                        "RAHIM YAR KHAN",
                        "GUJRAT",
                        "KASUR",
                        "MARDAN",
                      ])
                    )
                      .sort()
                      .map((cityName) => (
                        <option key={cityName} value={cityName} />
                      ))}
                  </datalist>

                  {/* Error Alert */}
                  {newOrderError && (
                    <div
                      style={{
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 12.5,
                        color: "var(--admin-danger)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <IconAlert size={16} />
                      <span>{newOrderError}</span>
                    </div>
                  )}

                  {/* SECTION 1: CUSTOMER & DELIVERY DETAILS */}
                  <div
                    style={{
                      background: "var(--admin-surface)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 8,
                      padding: "16px 18px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: 12,
                        color: "var(--admin-accent)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>1. Customer &amp; Delivery Information</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>
                          Customer Full Name <span style={{ color: "var(--admin-danger)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Muhammad Ali"
                          value={newOrderForm.customerName}
                          onChange={(e) =>
                            setNewOrderForm({ ...newOrderForm, customerName: e.target.value })
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            borderRadius: 6,
                            background: "var(--admin-surface-2)",
                            border: "1px solid var(--admin-border)",
                            color: "var(--admin-text)",
                          }}
                        />
                      </div>

                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>
                          Phone Number <span style={{ color: "var(--admin-danger)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 03001234567"
                          value={newOrderForm.phone}
                          onChange={(e) =>
                            setNewOrderForm({ ...newOrderForm, phone: e.target.value })
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            borderRadius: 6,
                            background: "var(--admin-surface-2)",
                            border: "1px solid var(--admin-border)",
                            color: "var(--admin-text)",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>
                          Email Address <span style={{ color: "var(--admin-text-soft)", fontSize: 11 }}>(Optional)</span>
                        </label>
                        <input
                          type="email"
                          placeholder="customer@example.com"
                          value={newOrderForm.email}
                          onChange={(e) =>
                            setNewOrderForm({ ...newOrderForm, email: e.target.value })
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            borderRadius: 6,
                            background: "var(--admin-surface-2)",
                            border: "1px solid var(--admin-border)",
                            color: "var(--admin-text)",
                          }}
                        />
                      </div>

                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>
                          City <span style={{ color: "var(--admin-danger)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          list="admin-new-order-cities-list"
                          required
                          placeholder="e.g. KARACHI / LAHORE"
                          value={newOrderForm.city}
                          onChange={(e) =>
                            setNewOrderForm({ ...newOrderForm, city: e.target.value })
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            borderRadius: 6,
                            background: "var(--admin-surface-2)",
                            border: "1px solid var(--admin-border)",
                            color: "var(--admin-text)",
                          }}
                        />
                      </div>
                    </div>

                    <div className="field" style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>
                        Delivery Complete Address <span style={{ color: "var(--admin-danger)" }}>*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="House / Apartment #, Street address, Sector / Area, Landmark"
                        value={newOrderForm.address}
                        onChange={(e) =>
                          setNewOrderForm({ ...newOrderForm, address: e.target.value })
                        }
                        disabled={creatingNewOrder}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          fontSize: 13,
                          borderRadius: 6,
                          background: "var(--admin-surface-2)",
                          border: "1px solid var(--admin-border)",
                          color: "var(--admin-text)",
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600 }}>
                          Customer / Courier Note <span style={{ color: "var(--admin-text-soft)", fontSize: 11 }}>(Optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Call before delivery, deliver in afternoon"
                          value={newOrderForm.notes}
                          onChange={(e) =>
                            setNewOrderForm({ ...newOrderForm, notes: e.target.value })
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            borderRadius: 6,
                            background: "var(--admin-surface-2)",
                            border: "1px solid var(--admin-border)",
                            color: "var(--admin-text)",
                          }}
                        />
                      </div>

                      <div className="field">
                        <label style={{ fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--admin-accent)" }}>
                          <IconLock size={12} />
                          <span>Private Admin Note <span style={{ color: "var(--admin-text-soft)", fontSize: 11 }}>(Staff Only)</span></span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. WhatsApp verified / Manual Phone Order"
                          value={newOrderForm.adminNote}
                          onChange={(e) =>
                            setNewOrderForm({ ...newOrderForm, adminNote: e.target.value })
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: 13,
                            borderRadius: 6,
                            background: "var(--admin-surface-2)",
                            border: "1px solid rgba(200, 255, 0, 0.3)",
                            color: "var(--admin-text)",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: PRODUCT ITEMS SELECTION */}
                  <div
                    style={{
                      background: "var(--admin-surface)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 8,
                      padding: "16px 18px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: 12,
                        color: "var(--admin-accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>2. Select Products &amp; Line Items</span>
                      <span style={{ fontSize: 11, color: "var(--admin-text-soft)", fontWeight: 600 }}>
                        {newOrderForm.items.length} item{newOrderForm.items.length === 1 ? "" : "s"} in order
                      </span>
                    </div>

                    {/* Add Item Form Bar */}
                    <div
                      style={{
                        background: "var(--admin-surface-2)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 8,
                        padding: "12px 14px",
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto",
                        gap: 8,
                        alignItems: "flex-end",
                      }}
                    >
                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-soft)" }}>
                          Product
                        </label>
                        <select
                          value={newOrderSelectedProdId}
                          onChange={(e) => handleSelectNewOrderProduct(e.target.value)}
                          disabled={creatingNewOrder || products.length === 0}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            fontSize: 12.5,
                            borderRadius: 4,
                            background: "var(--admin-surface)",
                            color: "var(--admin-text)",
                            border: "1px solid var(--admin-border)",
                          }}
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({fmtPrice(p.price)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-soft)" }}>
                          Color
                        </label>
                        <select
                          value={newOrderSelectedColor}
                          onChange={(e) => setNewOrderSelectedColor(e.target.value)}
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            fontSize: 12.5,
                            borderRadius: 4,
                            background: "var(--admin-surface)",
                            color: "var(--admin-text)",
                            border: "1px solid var(--admin-border)",
                          }}
                        >
                          {selectedProdColors.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-soft)" }}>
                          Size
                        </label>
                        <select
                          value={newOrderSelectedSize}
                          onChange={(e) => setNewOrderSelectedSize(e.target.value)}
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            fontSize: 12.5,
                            borderRadius: 4,
                            background: "var(--admin-surface)",
                            color: "var(--admin-text)",
                            border: "1px solid var(--admin-border)",
                          }}
                        >
                          {selectedProdSizes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-soft)" }}>
                          Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={newOrderSelectedQty}
                          onChange={(e) =>
                            setNewOrderSelectedQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            fontSize: 12.5,
                            borderRadius: 4,
                            background: "var(--admin-surface)",
                            color: "var(--admin-text)",
                            border: "1px solid var(--admin-border)",
                          }}
                        />
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-soft)" }}>
                          Price (PKR)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          placeholder="Price"
                          value={newOrderCustomPrice}
                          onChange={(e) => setNewOrderCustomPrice(e.target.value)}
                          disabled={creatingNewOrder}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            fontSize: 12.5,
                            borderRadius: 4,
                            background: "var(--admin-surface)",
                            color: "var(--admin-text)",
                            border: "1px solid var(--admin-border)",
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddItemToNewOrder}
                        disabled={creatingNewOrder || !newOrderSelectedProdId}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 4,
                          background: "var(--admin-accent)",
                          color: "#111",
                          fontWeight: 700,
                          fontSize: 12.5,
                          border: "none",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          height: 34,
                        }}
                      >
                        <IconPlus size={13} />
                        <span>Add Item</span>
                      </button>
                    </div>

                    {/* Added Items List */}
                    <div style={{ marginTop: 12 }}>
                      {newOrderForm.items.length === 0 ? (
                        <div
                          style={{
                            padding: "18px",
                            textAlign: "center",
                            fontSize: 13,
                            color: "var(--admin-text-soft)",
                            border: "1px dashed var(--admin-border)",
                            borderRadius: 6,
                          }}
                        >
                          No items added yet. Select a product above and click <strong>&ldquo;Add Item&rdquo;</strong>.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {newOrderForm.items.map((item, index) => (
                            <div
                              key={`${item.productId}-${item.color}-${item.size}-${index}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "var(--admin-surface-2)",
                                border: "1px solid var(--admin-border)",
                                borderRadius: 6,
                                padding: "8px 12px",
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                {item.hero ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={item.hero}
                                    alt=""
                                    width={36}
                                    height={36}
                                    style={{ objectFit: "cover", borderRadius: 4 }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      background: "var(--admin-surface)",
                                      borderRadius: 4,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 10,
                                      color: "var(--admin-text-soft)",
                                    }}
                                  >
                                    Nanos
                                  </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <strong
                                    style={{
                                      fontSize: 13,
                                      display: "block",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {item.name}
                                  </strong>
                                  <span style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>
                                    {item.color} · {item.size} · {fmtPrice(item.price)} each
                                  </span>
                                </div>
                              </div>

                              {/* Quantity and Line Total */}
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    style={{
                                      width: 26,
                                      height: 26,
                                      padding: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 13,
                                    }}
                                    disabled={creatingNewOrder || item.quantity <= 1}
                                    onClick={() =>
                                      handleUpdateItemQtyInNewOrder(index, item.quantity - 1)
                                    }
                                  >
                                    -
                                  </button>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      minWidth: 22,
                                      textAlign: "center",
                                      fontSize: 13,
                                    }}
                                  >
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    style={{
                                      width: 26,
                                      height: 26,
                                      padding: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 13,
                                    }}
                                    disabled={creatingNewOrder}
                                    onClick={() =>
                                      handleUpdateItemQtyInNewOrder(index, item.quantity + 1)
                                    }
                                  >
                                    +
                                  </button>
                                </div>

                                <div
                                  style={{
                                    minWidth: 90,
                                    textAlign: "right",
                                    fontWeight: 700,
                                    fontSize: 13.5,
                                  }}
                                >
                                  {fmtPrice(item.quantity * item.price)}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemFromNewOrder(index)}
                                  disabled={creatingNewOrder}
                                  title="Remove item"
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--admin-danger)",
                                    cursor: "pointer",
                                    padding: 4,
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 3: PAYMENT, STATUS & PRICING TOTALS */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.1fr 0.9fr",
                      gap: 16,
                    }}
                  >
                    {/* Settings & Options */}
                    <div
                      style={{
                        background: "var(--admin-surface)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 8,
                        padding: "16px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--admin-accent)",
                        }}
                      >
                        3. Payment &amp; Status Options
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div className="field">
                          <label style={{ fontSize: 12, fontWeight: 600 }}>Payment Method</label>
                          <select
                            value={newOrderForm.payment}
                            onChange={(e) =>
                              setNewOrderForm({ ...newOrderForm, payment: e.target.value })
                            }
                            disabled={creatingNewOrder}
                            style={{
                              width: "100%",
                              padding: "7px 10px",
                              fontSize: 12.5,
                              borderRadius: 4,
                              background: "var(--admin-surface-2)",
                              color: "var(--admin-text)",
                              border: "1px solid var(--admin-border)",
                            }}
                          >
                            <option value="cod">Cash on Delivery (COD)</option>
                            <option value="paid">Paid (Online / Bank)</option>
                            <option value="easypaisa">EasyPaisa</option>
                            <option value="jazzcash">JazzCash</option>
                          </select>
                        </div>

                        <div className="field">
                          <label style={{ fontSize: 12, fontWeight: 600 }}>Initial Status</label>
                          <select
                            value={newOrderForm.orderStatus}
                            onChange={(e) =>
                              setNewOrderForm({ ...newOrderForm, orderStatus: e.target.value })
                            }
                            disabled={creatingNewOrder}
                            style={{
                              width: "100%",
                              padding: "7px 10px",
                              fontSize: 12.5,
                              borderRadius: 4,
                              background: "var(--admin-surface-2)",
                              color: "var(--admin-text)",
                              border: "1px solid var(--admin-border)",
                            }}
                          >
                            <option value="READY_TO_SHIP">Ready to Ship (Queued)</option>
                            <option value="ON_HOLD">On Hold (Verification)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12.5,
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={newOrderForm.reserveInventory}
                            onChange={(e) =>
                              setNewOrderForm({
                                ...newOrderForm,
                                reserveInventory: e.target.checked,
                              })
                            }
                            disabled={creatingNewOrder}
                          />
                          <span>Reserve stock inventory automatically for these items</span>
                        </label>

                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12.5,
                            cursor: "pointer",
                            userSelect: "none",
                            color: "var(--admin-text-soft)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={newOrderForm.isTest}
                            onChange={(e) =>
                              setNewOrderForm({ ...newOrderForm, isTest: e.target.checked })
                            }
                            disabled={creatingNewOrder}
                          />
                          <span>Mark as Test Order</span>
                        </label>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div
                      style={{
                        background: "var(--admin-surface)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 8,
                        padding: "16px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--admin-accent)",
                        }}
                      >
                        4. Order Financials
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "var(--admin-text-soft)" }}>Items Subtotal:</span>
                        <strong>{fmtPrice(subtotal)}</strong>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <label style={{ fontSize: 12.5, color: "var(--admin-text-soft)", margin: 0 }}>
                          Discount (PKR):
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={newOrderForm.discount}
                          onChange={(e) =>
                            setNewOrderForm({
                              ...newOrderForm,
                              discount: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: 100,
                            padding: "5px 8px",
                            fontSize: 12.5,
                            textAlign: "right",
                            borderRadius: 4,
                            background: "var(--admin-surface-2)",
                            border: "1px solid var(--admin-border)",
                            color: "var(--admin-text)",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <label style={{ fontSize: 12.5, color: "var(--admin-text-soft)", margin: 0 }}>
                          Shipping Fee (PKR):
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={newOrderForm.shippingFee}
                          onChange={(e) =>
                            setNewOrderForm({
                              ...newOrderForm,
                              shippingFee: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          disabled={creatingNewOrder}
                          style={{
                            width: 100,
                            padding: "5px 8px",
                            fontSize: 12.5,
                            textAlign: "right",
                            borderRadius: 4,
                            background: "var(--admin-surface-2)",
                            border: "1px solid var(--admin-border)",
                            color: "var(--admin-text)",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          borderTop: "1px solid var(--admin-border)",
                          paddingTop: 10,
                          marginTop: 4,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Total Payable:</span>
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 900,
                            color: "var(--admin-accent)",
                          }}
                        >
                          {fmtPrice(netTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div
                  className="modal-actions"
                  style={{
                    borderTop: "1px solid var(--admin-border)",
                    padding: "14px 22px",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    background: "var(--admin-surface-2)",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={creatingNewOrder}
                    onClick={() => setShowNewOrderModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={creatingNewOrder || newOrderForm.items.length === 0}
                    style={{
                      background: "var(--admin-accent)",
                      color: "#111",
                      fontWeight: 800,
                      padding: "8px 22px",
                      fontSize: 13.5,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 2px 10px rgba(200, 255, 0, 0.25)",
                    }}
                  >
                    <IconPlus size={14} />
                    <span>
                      {creatingNewOrder
                        ? "Creating Order..."
                        : `Create Order (${fmtPrice(netTotal)})`}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
