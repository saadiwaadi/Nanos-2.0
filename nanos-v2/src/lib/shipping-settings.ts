import { prisma } from "@/lib/prisma";

export interface ShippingSettings {
  standardDeliveryFee: number;
  freeDeliveryThreshold: number;
  enabled: boolean;
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  standardDeliveryFee: 250,
  freeDeliveryThreshold: 5000,
  enabled: true,
};

let memoryShippingSettings: ShippingSettings | null = null;

export async function getShippingSettings(): Promise<ShippingSettings> {
  try {
    const row = await prisma.homeSetting.findUnique({
      where: { key: "shipping_settings" },
    });

    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return {
        standardDeliveryFee:
          typeof parsed.standardDeliveryFee === "number"
            ? Math.max(0, parsed.standardDeliveryFee)
            : DEFAULT_SHIPPING_SETTINGS.standardDeliveryFee,
        freeDeliveryThreshold:
          typeof parsed.freeDeliveryThreshold === "number"
            ? Math.max(0, parsed.freeDeliveryThreshold)
            : DEFAULT_SHIPPING_SETTINGS.freeDeliveryThreshold,
        enabled: parsed.enabled !== false,
      };
    }
  } catch (err) {
    if (memoryShippingSettings) return memoryShippingSettings;
  }

  return memoryShippingSettings || DEFAULT_SHIPPING_SETTINGS;
}

export async function saveShippingSettings(settings: ShippingSettings): Promise<ShippingSettings> {
  const normalized: ShippingSettings = {
    standardDeliveryFee: Math.max(0, Math.round(Number(settings.standardDeliveryFee) || 0)),
    freeDeliveryThreshold: Math.max(0, Math.round(Number(settings.freeDeliveryThreshold) || 0)),
    enabled: settings.enabled !== false,
  };

  memoryShippingSettings = normalized;
  try {
    const jsonStr = JSON.stringify(normalized);
    await prisma.homeSetting.upsert({
      where: { key: "shipping_settings" },
      create: {
        key: "shipping_settings",
        value: jsonStr,
      },
      update: {
        value: jsonStr,
      },
    });
  } catch (err) {
    console.warn("Failed to persist shipping settings to database, kept in memory:", err);
  }
  return normalized;
}

export function calculateShippingFee(
  subtotalAfterDiscount: number,
  settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS
): number {
  if (!settings.enabled) return 0;
  if (settings.freeDeliveryThreshold > 0 && subtotalAfterDiscount >= settings.freeDeliveryThreshold) {
    return 0;
  }
  return settings.standardDeliveryFee;
}
