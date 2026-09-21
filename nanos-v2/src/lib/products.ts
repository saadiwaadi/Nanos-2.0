import { prisma } from "@/lib/prisma";
import type { Product, ProductColor } from "@/lib/types";

const CLOG_BLACK_IMG =
  "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789376228/ChatGPT_Image_Sep_14_2026_01_04_47_AM.png";

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "clog-black",
    sku: "CLO-BLK",
    name: "Classic Clog",
    category: "crocs",
    tag: "NEW",
    price: 7499,
    oldPrice: null,
    description:
      "The Classic Clog. Broken-in comfort from the first step, ventilation ports for warm days, and a heel strap for when you need to move fast. Slip in, walk out.",
    rating: 4.7,
    reviews: 312,
    hero: CLOG_BLACK_IMG,
    isSale: false,
    colors: [
      { name: "Black", hex: "#111111" },
      { name: "Sand", hex: "#D9CBB0" },
      { name: "Olive", hex: "#4A4A34" },
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
    gallery: [
      CLOG_BLACK_IMG,
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&h=800&fit=crop",
    ],
  },
  {
    id: "clog-sand",
    sku: "CLO-SND",
    name: "Classic Clog",
    category: "crocs",
    tag: "NEW",
    price: 7499,
    oldPrice: null,
    description:
      "The Classic Clog in Sand. Broken-in comfort from the first step, ventilation ports for warm days, and a heel strap for when you need to move fast.",
    rating: 4.6,
    reviews: 198,
    hero: "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789371558/ChatGPT_Image_Sep_13_2026_05_44_14_AM.png",
    isSale: false,
    colors: [
      { name: "Sand", hex: "#D9CBB0" },
      { name: "Black", hex: "#111111" },
      { name: "Olive", hex: "#4A4A34" },
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
    gallery: [
      "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789371558/ChatGPT_Image_Sep_13_2026_05_44_14_AM.png",
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&h=800&fit=crop",
    ],
  },
  {
    id: "clog-olive",
    sku: "CLO-OLV",
    name: "Classic Clog",
    category: "crocs",
    tag: "NEW",
    price: 7499,
    oldPrice: null,
    description:
      "The Classic Clog in Olive. Broken-in comfort from the first step, ventilation ports for warm days, and a heel strap for when you need to move fast.",
    rating: 4.5,
    reviews: 87,
    hero: "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789413175/ChatGPT_Image_Sep_14_2026_12_12_47_PM.png",
    isSale: false,
    colors: [
      { name: "Olive", hex: "#4A4A34" },
      { name: "Black", hex: "#111111" },
      { name: "Sand", hex: "#D9CBB0" },
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
    gallery: [
      "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789413175/ChatGPT_Image_Sep_14_2026_12_12_47_PM.png",
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&h=800&fit=crop",
    ],
  },
  {
    id: "trouser-black",
    sku: "TRU-BLK",
    name: "Relaxed Fit Trousers",
    category: "trousers",
    tag: "NEW",
    price: 3999,
    oldPrice: null,
    description:
      "Relaxed Fit Trousers built for comfort meets versatility. A soft drape, tapered leg, and elasticated waistband that moves with your day.",
    rating: 4.8,
    reviews: 145,
    hero: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&h=600&fit=crop",
    isSale: false,
    colors: [
      { name: "Black", hex: "#111111" },
      { name: "Charcoal", hex: "#222222" },
      { name: "Stone", hex: "#D9D6CF" },
    ],
    sizes: ["28", "30", "32", "34", "36", "38"],
    gallery: [
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&h=800&fit=crop",
    ],
  },
  {
    id: "trouser-charcoal",
    sku: "TRU-CHR",
    name: "Relaxed Fit Trousers",
    category: "trousers",
    tag: null,
    price: 3999,
    oldPrice: 4799,
    description:
      "Relaxed Fit Trousers in Charcoal, on sale. A soft drape, tapered leg, and elasticated waistband that moves with your day.",
    rating: 4.6,
    reviews: 63,
    hero: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&h=600&fit=crop",
    isSale: true,
    colors: [
      { name: "Charcoal", hex: "#222222" },
      { name: "Black", hex: "#111111" },
      { name: "Stone", hex: "#D9D6CF" },
    ],
    sizes: ["28", "30", "32", "34", "36", "38"],
    gallery: [
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&h=800&fit=crop",
    ],
  },
  {
    id: "trouser-stone",
    sku: "TRU-STN",
    name: "Relaxed Fit Trousers",
    category: "trousers",
    tag: "BESTSELLER",
    price: 3999,
    oldPrice: null,
    description:
      "Relaxed Fit Trousers in Stone. Our best-selling colorway — a soft drape, tapered leg, and elasticated waistband that moves with your day.",
    rating: 4.9,
    reviews: 401,
    hero: "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&h=600&fit=crop",
    isSale: false,
    colors: [
      { name: "Stone", hex: "#D9D6CF" },
      { name: "Black", hex: "#111111" },
      { name: "Charcoal", hex: "#222222" },
    ],
    sizes: ["28", "30", "32", "34", "36", "38"],
    gallery: [
      "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=800&fit=crop",
    ],
  },
  {
    id: "clog-black-sale",
    sku: "CLO-LTE",
    name: "Classic Clog Lite",
    category: "crocs",
    tag: null,
    price: 5999,
    oldPrice: 7499,
    description:
      "Classic Clog Lite — a lighter-weight build of our signature clog, on sale for a limited time.",
    rating: 4.4,
    reviews: 52,
    hero: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600&h=600&fit=crop",
    isSale: true,
    colors: [
      { name: "Black", hex: "#111111" },
      { name: "Sand", hex: "#D9CBB0" },
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"],
    gallery: [
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&h=800&fit=crop",
      CLOG_BLACK_IMG,
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&h=800&fit=crop",
    ],
  },
  {
    id: "trouser-black-cargo",
    sku: "TRU-CRG",
    name: "Utility Cargo Trousers",
    category: "trousers",
    tag: "NEW",
    price: 4599,
    oldPrice: null,
    description:
      "Utility Cargo Trousers with reinforced pockets and a straight leg, built for days that need extra carry.",
    rating: 4.5,
    reviews: 39,
    hero: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&h=600&fit=crop&sat=-30",
    isSale: false,
    colors: [
      { name: "Black", hex: "#111111" },
      { name: "Olive", hex: "#4A4A34" },
    ],
    sizes: ["28", "30", "32", "34", "36"],
    gallery: [
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=800&fit=crop&sat=-30",
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&h=800&fit=crop",
    ],
  },
];

function parseJson<T>(val: string): T[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseProduct(row: any): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    tag: row.tag,
    price: row.price,
    oldPrice: row.oldPrice,
    description: row.description,
    rating: row.rating,
    reviews: row.reviews,
    hero: row.hero,
    isSale: row.isSale,
    colors: parseJson<ProductColor>(row.colors),
    sizes: parseJson<string>(row.sizes),
    gallery: parseJson<string>(row.gallery),
    productColors: row.productColors ? row.productColors.map((c: any) => ({
      id: c.id,
      name: c.name,
      hex: c.hex,
      imagesJson: c.imagesJson,
      sortOrder: c.sortOrder ?? 0,
    })) : undefined,
    stockLevels: row.stockLevels ? row.stockLevels.map((s: any) => ({
      id: s.id,
      color: s.color,
      size: s.size,
      quantity: s.quantity,
    })) : undefined,
  };
}

let dbWarned = false;

export async function getProducts(): Promise<Product[]> {
  try {
    const rows = await prisma.product.findMany({
      include: {
        productColors: { orderBy: { sortOrder: "asc" } },
        stockLevels: true,
      },
    });
    if (rows && rows.length > 0) {
      return rows.map(parseProduct);
    }
    return FALLBACK_PRODUCTS;
  } catch {
    if (!dbWarned) {
      console.warn("[nanos] DB unavailable — using fallback products");
      dbWarned = true;
    }
    return FALLBACK_PRODUCTS;
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const row = await prisma.product.findUnique({
      where: { id },
      include: {
        productColors: { orderBy: { sortOrder: "asc" } },
        stockLevels: true,
      },
    });
    if (row) {
      return parseProduct(row);
    }
    return FALLBACK_PRODUCTS.find((p) => p.id === id) ?? null;
  } catch {
    if (!dbWarned) {
      console.warn("[nanos] DB unavailable — using fallback products");
      dbWarned = true;
    }
    return FALLBACK_PRODUCTS.find((p) => p.id === id) ?? null;
  }
}
