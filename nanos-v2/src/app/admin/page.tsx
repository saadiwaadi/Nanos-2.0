"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AdminProduct, ProductColor, OrderStatus } from "@/lib/types";

interface AdminOrder {
  id: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  shippingInfo: string;
  payment: string;
  guestEmail?: string | null;
  guestName?: string | null;
  createdAt: string;
  user?: { id: string; email: string; name?: string | null } | null;
  orderItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: number;
    size?: string;
    color?: string;
    product: { id: string; name: string; hero: string };
  }>;
}

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

export default function AdminPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"dashboard" | "products" | "orders" | "settings">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showProductPanel, setShowProductPanel] = useState(false);

  const [orderFilters, setOrderFilters] = useState<{ q: string; status: string }>({ q: "", status: "ALL" });
  const [productFilters, setProductFilters] = useState<{ q: string; category: string }>({ q: "", category: "ALL" });

  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form states for product add/edit
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formCategory, setFormCategory] = useState("crocs");
  const [formPrice, setFormPrice] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formHero, setFormHero] = useState("");
  const [formGallery, setFormGallery] = useState<string[]>([]);
  const [formSizes, setFormSizes] = useState<string[]>([]);
  const [sizeInput, setSizeInput] = useState("");
  const [formColors, setFormColors] = useState<ProductColor[]>([]);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#111111");
  const [colorImage, setColorImage] = useState("");
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    let token = null;
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("nanos_auth_v1");
      if (raw) {
        try {
          token = JSON.parse(raw).token;
        } catch {
          // ignore
        }
      }
    }

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const [resProd, resOrd] = await Promise.all([
        fetch("/api/admin/products", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/orders", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (resProd.status === 401 || resProd.status === 403 || resOrd.status === 401 || resOrd.status === 403) {
        router.push("/login");
        return;
      }

      if (!resProd.ok || !resOrd.ok) {
        throw new Error("Failed to load admin resources");
      }

      const prodData = await resProd.json();
      const ordData = await resOrd.json();

      setProducts(prodData.products || []);
      setOrders(ordData.orders || []);
    } catch (err: any) {
      setError(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("nanosAdminTheme_v1") as "light" | "dark" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    }
    fetchData();
  }, [fetchData]);

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

  // Open product drawer
  function openAddProduct() {
    setEditingProduct(null);
    setFormName("");
    setFormSlug("");
    setFormCategory("crocs");
    setFormPrice("");
    setFormDesc("");
    setFormHero("");
    setFormGallery([]);
    setFormSizes([]);
    setFormColors([]);
    setFormErrors({});
    setShowProductPanel(true);
  }

  function openEditProduct(p: AdminProduct) {
    setEditingProduct(p);
    setFormName(p.name || "");
    setFormSlug(p.slug || p.id);
    setFormCategory(p.category || "crocs");
    setFormPrice(String(p.price || ""));
    setFormDesc(p.description || "");
    setFormHero(p.hero || "");
    setFormGallery(Array.isArray(p.gallery) ? p.gallery : []);
    setFormSizes(Array.isArray(p.sizes) ? p.sizes : []);
    setFormColors(Array.isArray(p.colors) ? p.colors : []);
    setFormErrors({});
    setShowProductPanel(true);
  }

  function closeProductPanel() {
    setShowProductPanel(false);
    setEditingProduct(null);
  }

  // Keyboard escape handler for product panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showProductPanel) {
        closeProductPanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showProductPanel]);

  function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    const errs: { [key: string]: string } = {};

    if (!formName.trim()) errs.name = "Name is required.";
    if (!formPrice.trim() || isNaN(Number(formPrice))) errs.price = "Valid price is required.";

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    let token = "";
    const raw = localStorage.getItem("nanos_auth_v1");
    if (raw) token = JSON.parse(raw).token;

    const payload = {
      name: formName,
      slug: formSlug || formName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      category: formCategory,
      price: Number(formPrice),
      description: formDesc,
      hero: formHero,
      gallery: formGallery,
      sizes: formSizes,
      colors: formColors,
    };

    const isEdit = !!editingProduct;
    const url = isEdit ? `/api/admin/products/${editingProduct.id}` : "/api/admin/products";
    const method = isEdit ? "PATCH" : "POST";

    fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save product.");
        return res.json();
      })
      .then(() => {
        showToast(isEdit ? "Product updated successfully!" : "Product created successfully!");
        closeProductPanel();
        fetchData();
      })
      .catch((err) => {
        showToast(err.message || "Error saving product", "error");
      });
  }

  function handleDeleteProduct(p: AdminProduct) {
    if (!window.confirm(`Delete ${p.name}? This cannot be undone.`)) return;

    let token = "";
    const raw = localStorage.getItem("nanos_auth_v1");
    if (raw) token = JSON.parse(raw).token;

    fetch(`/api/admin/products/${p.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete product.");
        showToast("Product deleted.");
        fetchData();
      })
      .catch((err) => {
        showToast(err.message || "Error deleting product", "error");
      });
  }

  function handleUpdateOrderStatus(orderId: string, status: string) {
    let token = "";
    const raw = localStorage.getItem("nanos_auth_v1");
    if (raw) token = JSON.parse(raw).token;

    fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update status.");
        return res.json();
      })
      .then(() => {
        showToast(`Order status set to ${status}`);
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: status as OrderStatus });
        }
        fetchData();
      })
      .catch((err) => {
        showToast(err.message || "Error updating order", "error");
      });
  }

  // Calculated Stats
  const pendingCount = orders.filter((o) => String(o.status).toUpperCase() === "PENDING").length;

  const todayStr = new Date().toISOString().split("T")[0];
  const shippedToday = orders.filter((o) => {
    const s = String(o.status).toUpperCase();
    return (s === "SHIPPED" || s === "DELIVERED") && o.createdAt.startsWith(todayStr);
  }).length;

  const revenueToday = orders
    .filter((o) => String(o.status).toUpperCase() !== "CANCELLED" && o.createdAt.startsWith(todayStr))
    .reduce((sum, o) => sum + (o.total || 0), 0);

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    const matchQ =
      !orderFilters.q ||
      o.id.toLowerCase().includes(orderFilters.q.toLowerCase()) ||
      (o.user?.email || o.guestEmail || "").toLowerCase().includes(orderFilters.q.toLowerCase());
    const matchStatus = orderFilters.status === "ALL" || String(o.status).toUpperCase() === orderFilters.status;
    return matchQ && matchStatus;
  });

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchQ = !productFilters.q || p.name.toLowerCase().includes(productFilters.q.toLowerCase());
    const matchCat = productFilters.category === "ALL" || p.category.toLowerCase() === productFilters.category.toLowerCase();
    return matchQ && matchCat;
  });

  return (
    <div className="admin-layout-shell">
      {/* SIDEBAR */}
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
            className={`nav-item ${activeView === "dashboard" ? "active" : ""}`}
            onClick={() => {
              setActiveView("dashboard");
              setSidebarOpen(false);
            }}
          >
            <span>◆ Dashboard</span>
          </button>

          <div className="sidebar-section-label">Store</div>
          <button
            type="button"
            className={`nav-item ${activeView === "orders" ? "active" : ""}`}
            onClick={() => {
              setActiveView("orders");
              setSidebarOpen(false);
            }}
          >
            <span>▤ Orders</span>
            {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeView === "products" ? "active" : ""}`}
            onClick={() => {
              setActiveView("products");
              setSidebarOpen(false);
            }}
          >
            <span>▦ Products</span>
          </button>

          <div className="sidebar-section-label">System</div>
          <button
            type="button"
            className={`nav-item ${activeView === "settings" ? "active" : ""}`}
            onClick={() => {
              setActiveView("settings");
              setSidebarOpen(false);
            }}
          >
            <span>⚙ Settings</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">A</div>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>Admin</div>
              <div style={{ color: "#888", fontSize: 11 }}>Store manager</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            style={{ color: "#D64545", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            ⏻
          </button>
        </div>
      </aside>

      {/* OVERLAY FOR MOBILE SIDEBAR */}
      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* MAIN COLUMN */}
      <div className="main-col">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="hamburger" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <div>
              <h1 className="page-title">
                {activeView === "dashboard"
                  ? "Dashboard"
                  : activeView === "orders"
                  ? "Orders"
                  : activeView === "products"
                  ? "Products"
                  : "Settings"}
              </h1>
              <p className="page-sub">
                {activeView === "dashboard"
                  ? "Store metrics & recent activity"
                  : activeView === "orders"
                  ? "Manage customer orders & fulfillment"
                  : activeView === "products"
                  ? "Catalog & stock levels"
                  : "Store configurations & rules"}
              </p>
            </div>
          </div>

          <div className="topbar-right">
            <button type="button" className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === "light" ? "◐" : "☀️"}
            </button>
          </div>
        </header>

        {/* CONTENT AREA */}
        <main className="content">
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--admin-text-soft)" }}>
              Loading store metrics...
            </div>
          ) : error ? (
            <div style={{ padding: 16, background: "var(--admin-danger-bg)", color: "var(--admin-danger)", borderRadius: 6 }}>
              {error}
            </div>
          ) : activeView === "dashboard" ? (
            /* DASHBOARD VIEW */
            <div>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Orders</div>
                  <div className="stat-value">{orders.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pending Approval</div>
                  <div className="stat-value">{pendingCount}</div>
                  {pendingCount > 0 && <div className="stat-delta" style={{ color: "var(--admin-warn)" }}>Needs action</div>}
                </div>
                <div className="stat-card">
                  <div className="stat-label">Shipped Today</div>
                  <div className="stat-value">{shippedToday}</div>
                </div>
                <div className="stat-card accent">
                  <div className="stat-label">Revenue Today</div>
                  <div className="stat-value">{fmtPrice(revenueToday)}</div>
                </div>
              </div>

              <div className="two-col">
                {/* SVG Bar Chart */}
                <div className="panel">
                  <div className="panel-head">
                    <h3>Orders — last 7 days</h3>
                  </div>
                  <div className="panel-body">
                    <svg viewBox="0 0 350 140" preserveAspectRatio="xMinYMid meet" width="100%">
                      <line x1="20" y1="110" x2="330" y2="110" stroke="var(--admin-border)" strokeWidth="1" />
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => {
                        const x = 35 + idx * 42;
                        const h = 20 + ((idx * 13 + 7) % 50);
                        const y = 110 - h;
                        return (
                          <g key={day}>
                            <rect x={x - 12} y={y} width="24" height={h} fill="var(--admin-accent)" rx="3" />
                            <text x={x} y={y - 5} className="chart-bar-label">
                              {Math.round(h / 10)}
                            </text>
                            <text x={x} y="125" className="chart-bar-label">
                              {day}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Inventory Alerts */}
                <div className="panel">
                  <div className="panel-head">
                    <h3>Inventory Alerts</h3>
                  </div>
                  <div className="panel-body">
                    {products.filter((p) => (p.stockLevel?.quantity ?? 10) <= 8).length === 0 ? (
                      <div style={{ color: "var(--admin-text-soft)", fontSize: 13.5 }}>
                        No stock issues right now.
                      </div>
                    ) : (
                      products
                        .filter((p) => (p.stockLevel?.quantity ?? 10) <= 8)
                        .map((p) => {
                          const qty = p.stockLevel?.quantity ?? 0;
                          return (
                            <div key={p.id} className="low-stock-item">
                              <div>
                                <strong>{p.name}</strong> ({p.category})
                              </div>
                              {qty === 0 ? (
                                <span className="badge" style={{ background: "var(--admin-danger-bg)", color: "var(--admin-danger)" }}>
                                  Sold out
                                </span>
                              ) : (
                                <span className="badge" style={{ background: "var(--admin-warn-bg)", color: "var(--admin-warn)" }}>
                                  {qty} left
                                </span>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Orders Panel */}
              <div className="panel">
                <div className="panel-head">
                  <h3>Recent Orders</h3>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveView("orders")}>
                    View all orders →
                  </button>
                </div>
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 5).map((o) => (
                        <tr key={o.id}>
                          <td>#{o.id.replace("ord_", "").slice(0, 8)}</td>
                          <td>{o.user?.email || o.guestEmail || "Guest"}</td>
                          <td>{fmtPrice(o.total)}</td>
                          <td>
                            <span className="badge" style={{ background: "var(--admin-surface-2)" }}>
                              <span className="badge-dot" /> {o.status}
                            </span>
                          </td>
                          <td>{formatDate(o.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeView === "orders" ? (
            /* ORDERS VIEW */
            <div className="panel">
              <div className="panel-head">
                <div className="toolbar" style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search order ID or customer email"
                    value={orderFilters.q}
                    onChange={(e) => setOrderFilters({ ...orderFilters, q: e.target.value })}
                  />
                  <select
                    value={orderFilters.status}
                    onChange={(e) => setOrderFilters({ ...orderFilters, status: e.target.value })}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                  <span style={{ fontSize: 13, color: "var(--admin-text-soft)" }}>
                    {filteredOrders.length} orders
                  </span>
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>No orders match this view</h3>
                  <p style={{ fontSize: 13, color: "var(--admin-text-soft)", marginTop: 4 }}>
                    Try clearing the search or choosing a different status.
                  </p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => {
                        const st = String(o.status).toUpperCase();
                        let badgeBg = "var(--admin-warn-bg)";
                        let badgeColor = "var(--admin-warn)";

                        if (st === "CONFIRMED") {
                          badgeBg = "var(--admin-info-bg)";
                          badgeColor = "var(--admin-info)";
                        } else if (st === "SHIPPED") {
                          badgeBg = "#EDE7FB";
                          badgeColor = "#6D3FD6";
                        } else if (st === "DELIVERED") {
                          badgeBg = "var(--admin-success-bg)";
                          badgeColor = "var(--admin-success)";
                        } else if (st === "CANCELLED") {
                          badgeBg = "var(--admin-danger-bg)";
                          badgeColor = "var(--admin-danger)";
                        }

                        return (
                          <tr key={o.id}>
                            <td>
                              <strong>#{o.id.replace("ord_", "").slice(0, 8)}</strong>
                            </td>
                            <td>
                              <div>{o.user?.email || o.guestEmail || "Guest"}</div>
                            </td>
                            <td>{o.orderItems.length} items</td>
                            <td>{fmtPrice(o.total)}</td>
                            <td>
                              <span className="badge" style={{ background: badgeBg, color: badgeColor }}>
                                <span className="badge-dot" /> {st}
                              </span>
                            </td>
                            <td>{formatDate(o.createdAt)}</td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                {st === "PENDING" && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-dark btn-sm"
                                      onClick={() => handleUpdateOrderStatus(o.id, "CONFIRMED")}
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      style={{ color: "var(--admin-danger)" }}
                                      onClick={() => handleUpdateOrderStatus(o.id, "CANCELLED")}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                {st === "CONFIRMED" && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-dark btn-sm"
                                      onClick={() => handleUpdateOrderStatus(o.id, "SHIPPED")}
                                    >
                                      Mark Shipped
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      style={{ color: "var(--admin-danger)" }}
                                      onClick={() => handleUpdateOrderStatus(o.id, "CANCELLED")}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                {st === "SHIPPED" && (
                                  <button
                                    type="button"
                                    className="btn btn-dark btn-sm"
                                    onClick={() => handleUpdateOrderStatus(o.id, "DELIVERED")}
                                  >
                                    Mark Delivered
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => setSelectedOrder(o)}
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeView === "products" ? (
            /* PRODUCTS VIEW */
            <div className="panel">
              <div className="panel-head">
                <div className="toolbar" style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search product name"
                    value={productFilters.q}
                    onChange={(e) => setProductFilters({ ...productFilters, q: e.target.value })}
                  />
                  <select
                    value={productFilters.category}
                    onChange={(e) => setProductFilters({ ...productFilters, category: e.target.value })}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="crocs">Crocs</option>
                    <option value="trousers">Trousers</option>
                  </select>
                </div>
                <button type="button" className="btn btn-dark btn-sm" onClick={openAddProduct}>
                  + Add product
                </button>
              </div>

              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const qty = p.stockLevel?.quantity ?? 10;
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
                                <div style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>{p.category}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textTransform: "capitalize" }}>{p.category}</td>
                          <td>{fmtPrice(p.price)}</td>
                          <td>
                            {qty === 0 ? (
                              <span className="badge" style={{ background: "var(--admin-danger-bg)", color: "var(--admin-danger)" }}>
                                Sold Out
                              </span>
                            ) : (
                              <span className="badge" style={{ background: "var(--admin-success-bg)", color: "var(--admin-success)" }}>
                                Active
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditProduct(p)}>
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
          ) : (
            /* SETTINGS VIEW */
            <div>
              <div className="two-col">
                <div className="settings-card">
                  <h3 style={{ fontFamily: "var(--font-head)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Store info</h3>
                  <div className="detail-row">
                    <span>Store name:</span> <strong>nanos.pk</strong>
                  </div>
                  <div className="detail-row">
                    <span>Support email:</span> <strong>support@nanos.pk</strong>
                  </div>
                  <div className="detail-row">
                    <span>Currency:</span> <strong>PKR</strong>
                  </div>
                </div>

                <div className="settings-card">
                  <h3 style={{ fontFamily: "var(--font-head)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Business rules</h3>
                  <div className="detail-row">
                    <span>Promo code:</span> <strong>NANOS10 (10% off)</strong>
                  </div>
                  <div className="detail-row">
                    <span>Free shipping above:</span> <strong>PKR 5,000</strong>
                  </div>
                  <div className="detail-row">
                    <span>Flat shipping rate:</span> <strong>PKR 250</strong>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--admin-text-soft)" }}>
                    To change these values, update your .env or seed file and redeploy.
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>Recent activity</h3>
                </div>
                <div className="panel-body">
                  {orders.length === 0 ? (
                    <div style={{ color: "var(--admin-text-soft)", fontSize: 13.5 }}>No activity yet.</div>
                  ) : (
                    orders.slice(0, 10).map((o) => (
                      <div key={o.id} className="detail-row" style={{ padding: "8px 0" }}>
                        <span>Order #{o.id.replace("ord_", "").slice(0, 8)} status updated to <strong>{o.status}</strong></span>
                        <span style={{ color: "var(--admin-text-soft)", fontSize: 12 }}>{formatDate(o.createdAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Order #{selectedOrder.id.replace("ord_", "").slice(0, 8)}</h3>
              <button type="button" className="modal-close" onClick={() => setSelectedOrder(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <span className="badge" style={{ background: "var(--admin-surface-2)" }}>
                  {selectedOrder.status}
                </span>
              </div>
              <div className="detail-row">
                <span>Customer name:</span> <strong>{selectedOrder.user?.name || selectedOrder.guestName || "Customer"}</strong>
              </div>
              <div className="detail-row">
                <span>Email:</span> <strong>{selectedOrder.user?.email || selectedOrder.guestEmail || "N/A"}</strong>
              </div>
              <div className="detail-row">
                <span>Payment method:</span> <strong>COD</strong>
              </div>
              <div className="detail-row">
                <span>Order date:</span> <strong>{formatDate(selectedOrder.createdAt)}</strong>
              </div>

              <div style={{ margin: "20px 0 12px", fontWeight: 700, fontSize: 14 }}>Items</div>
              {selectedOrder.orderItems.map((item) => (
                <div key={item.id} className="detail-row">
                  <span>
                    {item.product?.name || "Product"} × {item.quantity}
                  </span>
                  <strong>{fmtPrice(item.price * item.quantity)}</strong>
                </div>
              ))}

              <div style={{ margin: "20px 0 12px", borderTop: "1px solid var(--admin-border)", paddingTop: 12 }}>
                <div className="detail-row">
                  <span>Subtotal:</span> <strong>{fmtPrice(selectedOrder.subtotal || selectedOrder.total - selectedOrder.shipping)}</strong>
                </div>
                <div className="detail-row">
                  <span>Shipping:</span> <strong>{fmtPrice(selectedOrder.shipping)}</strong>
                </div>
                <div className="detail-row" style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                  <span>Total:</span> <strong>{fmtPrice(selectedOrder.total)}</strong>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT SIDE PANEL (ADD / EDIT) */}
      {showProductPanel && (
        <>
          <div className="admin-panel-overlay" onClick={closeProductPanel} />
          <div className="admin-panel">
            <div className="modal-head">
              <h3>{editingProduct ? "Edit product" : "Add product"}</h3>
              <button type="button" className="modal-close" onClick={closeProductPanel}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProduct} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
                <div className={`field ${formErrors.name ? "has-error" : ""}`}>
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (!editingProduct) {
                        setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                      }
                    }}
                  />
                  {formErrors.name && <div className="field-error">{formErrors.name}</div>}
                </div>

                <div className="field">
                  <label>Slug</label>
                  <input type="text" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} />
                </div>

                <div className="field">
                  <label>Category</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    <option value="crocs">Crocs</option>
                    <option value="trousers">Trousers</option>
                  </select>
                </div>

                <div className={`field ${formErrors.price ? "has-error" : ""}`}>
                  <label>Price (PKR) *</label>
                  <input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
                  {formErrors.price && <div className="field-error">{formErrors.price}</div>}
                </div>

                <div className="field">
                  <label>Description</label>
                  <textarea rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                </div>

                <div className="field">
                  <label>Hero URL</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <input type="text" style={{ flex: 1 }} value={formHero} onChange={(e) => setFormHero(e.target.value)} />
                    {formHero && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={formHero} alt="" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 4 }} />
                    )}
                  </div>
                </div>

                {/* Gallery */}
                <div className="field">
                  <label>Gallery URLs</label>
                  {formGallery.map((g, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input
                        type="text"
                        style={{ flex: 1 }}
                        value={g}
                        onChange={(e) => {
                          const next = [...formGallery];
                          next[idx] = e.target.value;
                          setFormGallery(next);
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setFormGallery(formGallery.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 4, alignSelf: "flex-start" }}
                    onClick={() => setFormGallery([...formGallery, ""])}
                  >
                    + Add image
                  </button>
                </div>

                {/* Sizes Tag Input */}
                <div className="field">
                  <label>Sizes</label>
                  <div>
                    {formSizes.map((s) => (
                      <span key={s} className="tag">
                        {s}
                        <button type="button" className="tag-remove" onClick={() => setFormSizes(formSizes.filter((x) => x !== s))}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <input
                      type="text"
                      placeholder="Type size and press Enter"
                      value={sizeInput}
                      onChange={(e) => setSizeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === ",") && sizeInput.trim()) {
                          e.preventDefault();
                          if (!formSizes.includes(sizeInput.trim())) {
                            setFormSizes([...formSizes, sizeInput.trim()]);
                          }
                          setSizeInput("");
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Colors Input */}
                <div className="field">
                  <label>Colours</label>
                  <div style={{ marginBottom: 8 }}>
                    {formColors.map((c, idx) => (
                      <div key={idx} className="tag" style={{ background: "var(--admin-surface)" }}>
                        <span className="colour-swatch" style={{ background: c.hex }} />
                        <span>{c.name}</span>
                        <button type="button" className="tag-remove" onClick={() => setFormColors(formColors.filter((_, i) => i !== idx))}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: "var(--admin-surface-2)", borderRadius: 6 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Colour name"
                        style={{ flex: 1 }}
                        value={colorName}
                        onChange={(e) => setColorName(e.target.value)}
                      />
                      <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} style={{ width: 40, padding: 0 }} />
                    </div>
                    <input
                      type="text"
                      placeholder="Image URL for this colour (optional)"
                      value={colorImage}
                      onChange={(e) => setColorImage(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-dark btn-sm"
                      style={{ alignSelf: "flex-start" }}
                      onClick={() => {
                        if (colorName.trim()) {
                          setFormColors([
                            ...formColors,
                            { name: colorName.trim(), hex: colorHex, image: colorImage.trim() || undefined },
                          ]);
                          setColorName("");
                          setColorImage("");
                        }
                      }}
                    >
                      + Add colour
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-outline btn-sm" onClick={closeProductPanel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-dark btn-sm">
                  {editingProduct ? "Save" : "Add product"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
