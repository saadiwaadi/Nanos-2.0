import { prisma } from "@/lib/prisma";

export interface ProductBundleConfig {
  buy2Price?: number | null;
  buy3Price?: number | null;
  buy2DiscountText?: string | null;
  buy3DiscountText?: string | null;
  enabled?: boolean;
}

export interface BundlePricingSettings {
  defaultBuy2DiscountPercent: number;
  defaultBuy3DiscountPercent: number;
  products: Record<string, ProductBundleConfig>;
}

export const DEFAULT_BUNDLE_PRICING: BundlePricingSettings = {
  defaultBuy2DiscountPercent: 10,
  defaultBuy3DiscountPercent: 15,
  products: {},
};

let memoryBundleSettings: BundlePricingSettings | null = null;

export async function getBundlePricingSettings(): Promise<BundlePricingSettings> {
  try {
    const row = await prisma.homeSetting.findUnique({
      where: { key: "bundle_pricing" },
    });

    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return {
        defaultBuy2DiscountPercent: parsed.defaultBuy2DiscountPercent ?? 10,
        defaultBuy3DiscountPercent: parsed.defaultBuy3DiscountPercent ?? 15,
        products: parsed.products ?? {},
      };
    }
  } catch (err) {
    if (memoryBundleSettings) return memoryBundleSettings;
  }

  return memoryBundleSettings || DEFAULT_BUNDLE_PRICING;
}

export async function saveBundlePricingSettings(
  settings: BundlePricingSettings
): Promise<BundlePricingSettings> {
  memoryBundleSettings = settings;
  try {
    const jsonStr = JSON.stringify(settings);
    await prisma.homeSetting.upsert({
      where: { key: "bundle_pricing" },
      create: {
        key: "bundle_pricing",
        value: jsonStr,
      },
      update: {
        value: jsonStr,
      },
    });
  } catch (err) {
    console.warn("Failed to persist bundle pricing to database, kept in memory:", err);
  }
  return settings;
}

export async function getProductBundlePricing(
  productId: string,
  basePrice: number
): Promise<{
  buy1Price: number;
  buy2Price: number;
  buy2UnitPrice: number;
  buy2DiscountText: string;
  buy3Price: number;
  buy3UnitPrice: number;
  buy3DiscountText: string;
  enabled: boolean;
}> {
  const settings = await getBundlePricingSettings();
  const override = settings.products[productId] || {};

  const enabled = override.enabled !== false;
  const buy1Price = basePrice;

  // Buy 2
  const buy2Price =
    typeof override.buy2Price === "number" && override.buy2Price > 0
      ? override.buy2Price
      : Math.round(basePrice * 2 * (1 - settings.defaultBuy2DiscountPercent / 100));
  const buy2UnitPrice = Math.round(buy2Price / 2);
  const buy2DiscountText =
    override.buy2DiscountText || `${settings.defaultBuy2DiscountPercent}% OFF`;

  // Buy 3
  const buy3Price =
    typeof override.buy3Price === "number" && override.buy3Price > 0
      ? override.buy3Price
      : Math.round(basePrice * 3 * (1 - settings.defaultBuy3DiscountPercent / 100));
  const buy3UnitPrice = Math.round(buy3Price / 3);
  const buy3DiscountText =
    override.buy3DiscountText || `${settings.defaultBuy3DiscountPercent}% OFF`;

  return {
    buy1Price,
    buy2Price,
    buy2UnitPrice,
    buy2DiscountText,
    buy3Price,
    buy3UnitPrice,
    buy3DiscountText,
    enabled,
  };
}
