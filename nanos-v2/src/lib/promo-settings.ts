import { prisma } from "@/lib/prisma";

export interface PromoSettings {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  enabled: boolean;
  description?: string;
}

export const DEFAULT_PROMO_SETTINGS: PromoSettings = {
  code: "NANOS10",
  discountType: "percent",
  discountValue: 10,
  minOrderAmount: 0,
  enabled: true,
  description: "10% off",
};

let memoryPromoSettings: PromoSettings | null = null;

export async function getPromoSettings(): Promise<PromoSettings> {
  try {
    const row = await prisma.homeSetting.findUnique({
      where: { key: "promo_settings" },
    });

    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return {
        code: (parsed.code || DEFAULT_PROMO_SETTINGS.code).trim().toUpperCase(),
        discountType: parsed.discountType === "fixed" ? "fixed" : "percent",
        discountValue: typeof parsed.discountValue === "number" ? parsed.discountValue : 10,
        minOrderAmount: typeof parsed.minOrderAmount === "number" ? parsed.minOrderAmount : 0,
        enabled: parsed.enabled !== false,
        description: parsed.description || "",
      };
    }
  } catch (err) {
    if (memoryPromoSettings) return memoryPromoSettings;
  }

  return memoryPromoSettings || DEFAULT_PROMO_SETTINGS;
}

export async function savePromoSettings(settings: PromoSettings): Promise<PromoSettings> {
  const normalized: PromoSettings = {
    code: (settings.code || "").trim().toUpperCase(),
    discountType: settings.discountType === "fixed" ? "fixed" : "percent",
    discountValue: Math.max(0, Number(settings.discountValue) || 0),
    minOrderAmount: Math.max(0, Number(settings.minOrderAmount) || 0),
    enabled: settings.enabled !== false,
    description: settings.description || "",
  };

  memoryPromoSettings = normalized;
  try {
    const jsonStr = JSON.stringify(normalized);
    await prisma.homeSetting.upsert({
      where: { key: "promo_settings" },
      create: {
        key: "promo_settings",
        value: jsonStr,
      },
      update: {
        value: jsonStr,
      },
    });
  } catch (err) {
    console.warn("Failed to persist promo settings to database, kept in memory:", err);
  }
  return normalized;
}

export function calculatePromoDiscount(
  settings: PromoSettings,
  subtotal: number
): number {
  if (!settings.enabled || subtotal <= 0) return 0;
  if (settings.minOrderAmount > 0 && subtotal < settings.minOrderAmount) return 0;

  if (settings.discountType === "fixed") {
    return Math.min(subtotal, Math.round(settings.discountValue));
  }

  // Percentage discount
  const rate = Math.min(100, Math.max(0, settings.discountValue)) / 100;
  return Math.round(subtotal * rate);
}

export function validatePromoCode(
  inputCode: string,
  subtotal: number,
  settings: PromoSettings
): {
  valid: boolean;
  discount: number;
  message: string;
} {
  if (!settings.enabled) {
    return {
      valid: false,
      discount: 0,
      message: "No active promotion at this time.",
    };
  }

  const normalized = inputCode.trim().toUpperCase();
  if (normalized !== settings.code) {
    return {
      valid: false,
      discount: 0,
      message: `Code "${inputCode.trim()}" is not valid.`,
    };
  }

  if (settings.minOrderAmount > 0 && subtotal < settings.minOrderAmount) {
    return {
      valid: false,
      discount: 0,
      message: `Minimum order amount of PKR ${settings.minOrderAmount.toLocaleString()} required for this promo.`,
    };
  }

  const discount = calculatePromoDiscount(settings, subtotal);
  const discountLabel =
    settings.discountType === "fixed"
      ? `PKR ${settings.discountValue.toLocaleString()} off`
      : `${settings.discountValue}% off`;

  return {
    valid: true,
    discount,
    message: `${settings.code} applied — ${discountLabel} ✓`,
  };
}
