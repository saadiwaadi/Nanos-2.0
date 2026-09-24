import { prisma } from "@/lib/prisma";

export interface SectionButton {
  id: string;
  label: string;
  url: string;
  style?: "filled" | "outline" | "lime" | "primary" | "link";
  isHidden?: boolean;
}

export interface SectionFeature {
  id: string;
  icon: "truck" | "shield" | "repeat" | "headset";
  line1: string;
  line2: string;
  isHidden?: boolean;
}

export interface HeroSectionConfig {
  id: string;
  eyebrowPart1: string;
  eyebrowDivider: string;
  eyebrowPart2: string;
  title: string;
  subtext: string;
  bgImage?: string;
  buttons: SectionButton[];
  features: SectionFeature[];
  isHidden?: boolean;
}

export interface SectionProductItem {
  productId: string;
  isHidden?: boolean;
}

export interface ProductSectionConfig {
  id: string;
  title: string;
  subtitle?: string;
  layout?: "scroll" | "grid";
  buttons: SectionButton[];
  products: SectionProductItem[];
  isHidden?: boolean;
}

export interface CategoryTileConfig {
  id: string;
  title: string;
  eyebrow: string;
  badge?: string;
  link: string;
  image: string;
  backgroundPosition?: string;
  isHidden?: boolean;
}

export interface CategorySectionConfig {
  id: string;
  title: string;
  buttons: SectionButton[];
  tiles: CategoryTileConfig[];
  isHidden?: boolean;
}

export interface PromoTileConfig {
  id: string;
  type: "dark" | "image" | "lime";
  brand?: string;
  sub?: string;
  image?: string;
  line1?: string;
  line2?: string;
  link?: string;
  isHidden?: boolean;
}

export interface PromoSectionConfig {
  id: string;
  tiles: PromoTileConfig[];
  isHidden?: boolean;
}

export interface EditorialSectionConfig {
  id: string;
  title: string;
  text: string;
  bgImage?: string;
  buttons: SectionButton[];
  isHidden?: boolean;
}

export interface ScrollingBannerConfig {
  id: string;
  items: string[];
  separator?: string;
  speedSeconds?: number;
  bgStyle?: "off-white" | "dark" | "lime";
  isHidden?: boolean;
}

export interface HomePageConfig {
  hero: HeroSectionConfig;
  productSections: ProductSectionConfig[];
  categorySection: CategorySectionConfig;
  scrollingBanner: ScrollingBannerConfig;
  promoSection: PromoSectionConfig;
  editorialSection: EditorialSectionConfig;
  updatedAt?: string;
}

export const DEFAULT_HOMEPAGE_CONFIG: HomePageConfig = {
  hero: {
    id: "hero",
    eyebrowPart1: "Comfort",
    eyebrowDivider: "x",
    eyebrowPart2: "Style",
    title: "EVERYDAY COMFORT.",
    subtext: "Crocs designed for your daily rotation. Comfort meets style.",
    bgImage: "",
    buttons: [
      { id: "btn_hero_1", label: "SHOP ALL CROCS", url: "/crocs", style: "outline", isHidden: false },
      { id: "btn_hero_2", label: "SHOP NEW BLACKS", url: "/products?tag=NEW", style: "filled", isHidden: false },
    ],
    features: [
      { id: "feat_1", icon: "truck", line1: "Fast", line2: "Delivery", isHidden: false },
      { id: "feat_2", icon: "shield", line1: "Secure", line2: "Shopping", isHidden: false },
      { id: "feat_3", icon: "repeat", line1: "Easy", line2: "Returns", isHidden: false },
      { id: "feat_4", icon: "headset", line1: "Customer", line2: "Support", isHidden: false },
    ],
    isHidden: false,
  },
  productSections: [
    {
      id: "featured-products",
      title: "Featured Products",
      subtitle: "Hand-picked favorites for everyday comfort",
      layout: "scroll",
      buttons: [
        { id: "btn_feat_all", label: "View All →", url: "/products", style: "link", isHidden: false },
      ],
      products: [], // Empty means dynamically take first 10 products if none specified
      isHidden: false,
    },
  ],
  categorySection: {
    id: "shop-categories",
    title: "Shop by Category",
    buttons: [],
    tiles: [
      {
        id: "cat_crocs",
        title: "Crocs",
        eyebrow: "Category",
        badge: "",
        link: "/crocs",
        image: "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789791756/ChatGPT_Image_Sep_18_2026_09_22_00_PM.png",
        backgroundPosition: "center",
        isHidden: false,
      },
      {
        id: "cat_trousers",
        title: "Trousers",
        eyebrow: "Category",
        badge: "Coming Soon",
        link: "/trousers",
        image: "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789791884/High_Waist_Wide_Leg_Pants_Women_s_Loose_Fit_Straight_Casual_Long_Trousers_with_Slimming_Effect.jpg",
        backgroundPosition: "center 25%",
        isHidden: false,
      },
    ],
    isHidden: false,
  },
  scrollingBanner: {
    id: "scrolling-banner",
    items: [
      "EVERYDAY",
      "CUSHIONED",
      "ANTI-SLIP",
      "LIGHTWEIGHT",
      "ADJUSTABLE",
      "BREATHABLE",
      "ALL-DAY COMFORT",
      "PREMIUM FINISH",
    ],
    separator: "✦",
    speedSeconds: 48,
    bgStyle: "off-white",
    isHidden: false,
  },
  promoSection: {
    id: "promo-showcase",
    tiles: [
      {
        id: "promo_1",
        type: "dark",
        brand: "nanos.pk",
        sub: "CROCS / TROUSERS",
        isHidden: false,
      },
      {
        id: "promo_2",
        type: "image",
        image: "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789791756/ChatGPT_Image_Sep_18_2026_09_22_00_PM.png",
        line1: "COMFORT",
        line2: "IN EVERY STEP.",
        isHidden: false,
      },
      {
        id: "promo_3",
        type: "image",
        image: "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789371558/ChatGPT_Image_Sep_13_2026_05_44_14_AM.png",
        line1: "BETTER",
        line2: "BASICS.",
        isHidden: false,
      },
      {
        id: "promo_4",
        type: "lime",
        line1: "KEEP IT SIMPLE.",
        line2: "WEAR IT YOUR WAY.",
        isHidden: false,
      },
    ],
    isHidden: false,
  },
  editorialSection: {
    id: "editorial",
    title: "Built for Pakistan. Priced for Everyone.",
    text: "Premium lightweight clogs & relaxed utility trousers engineered for everyday movement and built to last.",
    bgImage: "",
    buttons: [
      { id: "btn_edit_1", label: "Explore All Products →", url: "/products", style: "primary", isHidden: false },
    ],
    isHidden: false,
  },
};

// Memory fallback store
let memoryHomePageConfig: HomePageConfig | null = null;

export async function getHomePageConfig(): Promise<HomePageConfig> {
  try {
    const setting = await prisma.homeSetting.findUnique({
      where: { key: "homepage_config" },
    });

    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value);
      return {
        hero: { ...DEFAULT_HOMEPAGE_CONFIG.hero, ...(parsed.hero || {}) },
        productSections: Array.isArray(parsed.productSections) ? parsed.productSections : DEFAULT_HOMEPAGE_CONFIG.productSections,
        categorySection: { ...DEFAULT_HOMEPAGE_CONFIG.categorySection, ...(parsed.categorySection || {}) },
        scrollingBanner: {
          ...DEFAULT_HOMEPAGE_CONFIG.scrollingBanner,
          ...(parsed.scrollingBanner || {}),
          items: Array.isArray(parsed.scrollingBanner?.items) && parsed.scrollingBanner.items.length > 0
            ? parsed.scrollingBanner.items
            : DEFAULT_HOMEPAGE_CONFIG.scrollingBanner.items,
        },
        promoSection: { ...DEFAULT_HOMEPAGE_CONFIG.promoSection, ...(parsed.promoSection || {}) },
        editorialSection: { ...DEFAULT_HOMEPAGE_CONFIG.editorialSection, ...(parsed.editorialSection || {}) },
        updatedAt: setting.updatedAt.toISOString(),
      };
    }
  } catch (err) {
    // Database fallback
    if (memoryHomePageConfig) {
      return memoryHomePageConfig;
    }
  }

  return memoryHomePageConfig || DEFAULT_HOMEPAGE_CONFIG;
}

export async function saveHomePageConfig(config: HomePageConfig): Promise<HomePageConfig> {
  memoryHomePageConfig = config;
  try {
    const jsonStr = JSON.stringify(config);
    await prisma.homeSetting.upsert({
      where: { key: "homepage_config" },
      create: {
        key: "homepage_config",
        value: jsonStr,
      },
      update: {
        value: jsonStr,
      },
    });
  } catch (err) {
    console.warn("Failed to persist homepage config to database, kept in memory fallback:", err);
  }
  return config;
}
