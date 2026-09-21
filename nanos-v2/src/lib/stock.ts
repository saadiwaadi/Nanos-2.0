import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/order-state";

export type StockLine = {
  productId: string;
  color: string;
  size: string;
  qty: number;
};

export const isAvailable = (
  p: { ignoreStock: boolean },
  v: { stock?: number; quantity?: number; ignoreStock: boolean }
) => {
  const stockCount = v.stock ?? v.quantity ?? 0;
  return Boolean(p.ignoreStock || v.ignoreStock || stockCount > 0);
};

function lineKey(it: { productId: string; color: string; size: string }): string {
  return `${it.productId}:${it.color}:${it.size}`;
}

export async function reserveStock(
  tx: Prisma.TransactionClient,
  items: StockLine[]
): Promise<Record<string, boolean>> {
  // Sort items to avoid deadlocks
  const sorted = [...items].sort((a, b) =>
    (a.productId + a.color + a.size).localeCompare(b.productId + b.color + b.size)
  );

  const shortages: any[] = [];
  const tracked: Record<string, boolean> = {};

  for (const it of sorted) {
    const p = await tx.product.findUnique({
      where: { id: it.productId },
      select: { ignoreStock: true },
    });
    const v = await tx.stockLevel.findFirst({
      where: { productId: it.productId, color: it.color, size: it.size },
    });

    if (!p || !v) {
      shortages.push({ ...it, available: 0, reason: "MISSING" });
      continue;
    }

    if (p.ignoreStock || v.ignoreStock) {
      tracked[lineKey(it)] = false;
      continue;
    }

    const r = await tx.stockLevel.updateMany({
      where: { id: v.id, quantity: { gte: it.qty } },
      data: { quantity: { decrement: it.qty } },
    });

    if (r.count === 0) {
      shortages.push({ ...it, available: v.quantity });
    } else {
      tracked[lineKey(it)] = true;
    }
  }

  if (shortages.length > 0) {
    throw new AppError("OUT_OF_STOCK", "Some items are no longer available.", 409, { shortages });
  }

  return tracked;
}

export async function releaseStock(
  tx: Prisma.TransactionClient,
  items: any[]
): Promise<void> {
  for (const it of items) {
    if (it.stockTracked) {
      const qty = it.qty ?? it.quantity ?? 1;
      await tx.stockLevel.updateMany({
        where: { productId: it.productId, color: it.color, size: it.size },
        data: { quantity: { increment: qty } },
      });
    }
  }
}
