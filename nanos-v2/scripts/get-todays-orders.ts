/**
 * get-todays-orders.ts
 *
 * Pulls all orders placed "today" (local server date) from the Nanos Postgres DB via Prisma,
 * and prints/export a clean summary: order id, customer, items, total, status, timestamps,
 * and the Meta/TikTok tracking fields (fbc, fbp, ttclid, ttp, eventId) attached at checkout.
 *
 * USAGE (run from the nanos-v2 project root, where prisma/schema.prisma and node_modules live):
 *   npx tsx scripts/get-todays-orders.ts
 *
 * Optional: pass a date range explicitly instead of "today":
 *   npx tsx scripts/get-todays-orders.ts 2026-10-17 2026-10-18
 *
 * Output: prints a table to the console AND writes a JSON + CSV file to ./exports/
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Explicitly compute dates in Pakistan Standard Time (PKT = UTC+5)
function getPktTodayString(): string {
  // Returns YYYY-MM-DD in Asia/Karachi timezone
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parsePktRange(startStr: string, endStr: string): { rangeStart: Date; rangeEnd: Date } {
  // Normalize date string (strip time if passed)
  const s = startStr.includes("T") ? startStr.split("T")[0] : startStr;
  const e = endStr.includes("T") ? endStr.split("T")[0] : endStr;

  const rangeStart = new Date(`${s}T00:00:00.000+05:00`);
  const rangeEnd = new Date(`${e}T23:59:59.999+05:00`);
  return { rangeStart, rangeEnd };
}

async function main() {
  const args = process.argv.slice(2);

  let rangeStart: Date;
  let rangeEnd: Date;
  let dateTag: string;

  if (args.length >= 2) {
    const r = parsePktRange(args[0], args[1]);
    rangeStart = r.rangeStart;
    rangeEnd = r.rangeEnd;
    dateTag = `${args[0]}_to_${args[1]}`;
  } else if (args.length === 1) {
    const r = parsePktRange(args[0], args[0]);
    rangeStart = r.rangeStart;
    rangeEnd = r.rangeEnd;
    dateTag = args[0];
  } else {
    const todayPkt = getPktTodayString();
    const r = parsePktRange(todayPkt, todayPkt);
    rangeStart = r.rangeStart;
    rangeEnd = r.rangeEnd;
    dateTag = todayPkt;
  }

  console.log(`\nFetching orders (Pakistan Time PKT / UTC+5):`);
  console.log(`  From: ${rangeStart.toISOString()} (${rangeStart.toLocaleString("en-US", { timeZone: "Asia/Karachi" })} PKT)`);
  console.log(`  To:   ${rangeEnd.toISOString()} (${rangeEnd.toLocaleString("en-US", { timeZone: "Asia/Karachi" })} PKT)\n`);

  // NOTE: adjust the `include` below if your Order model's relation names differ
  // (e.g. OrderItem vs items, User vs customer). Check prisma/schema.prisma if this errors.
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: true,
    },
  });

  if (orders.length === 0) {
    console.log("No orders found for this date range.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${orders.length} order(s):\n`);
  console.log("=".repeat(100));

  let totalRevenue = 0;

  const simplified = orders.map((o: any) => {
    const itemCount = Array.isArray(o.items) ? o.items.length : 0;
    const total = o.total ?? o.totalAmount ?? 0;
    totalRevenue += Number(total) || 0;

    console.log(`Order ID:        ${o.id}`);
    console.log(`Created At:      ${o.createdAt}`);
    console.log(`Status:          ${o.status}`);
    console.log(`Customer Email:  ${o.customerEmail || o.guestEmail || o.email || "(authed user)"}`);
    console.log(`Customer Name:   ${o.customerName || o.guestName || o.name || "N/A"}`);
    console.log(`Total:           PKR ${total}`);
    console.log(`Items:           ${itemCount}`);
    if (Array.isArray(o.items)) {
      o.items.forEach((item: any, idx: number) => {
        const itemPrice = item.price ?? item.unitPrice ?? 0;
        console.log(
          `   ${idx + 1}. ${item.name || item.productId} — color: ${item.color || "N/A"}, size: ${item.size || "N/A"}, qty: ${item.quantity || 1}, price: PKR ${itemPrice}`
        );
      });
    }
    console.log(`fbc:             ${o.fbc || "(none)"}`);
    console.log(`fbp:             ${o.fbp || "(none)"}`);
    console.log(`ttclid:          ${o.ttclid || "(none)"}`);
    console.log(`ttp:             ${o.ttp || "(none)"}`);
    console.log("-".repeat(100));

    return {
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      customerEmail: o.customerEmail || o.guestEmail || o.email || null,
      customerName: o.customerName || o.guestName || o.name || null,
      total,
      itemCount,
      items: Array.isArray(o.items)
        ? o.items.map((i: any) => ({
            name: i.name || i.productId,
            color: i.color,
            size: i.size,
            quantity: i.quantity,
            price: i.price ?? i.unitPrice,
          }))
        : [],
      fbc: o.fbc || null,
      fbp: o.fbp || null,
      ttclid: o.ttclid || null,
      ttp: o.ttp || null,
    };
  });

  console.log(`\nTOTAL ORDERS:  ${orders.length}`);
  console.log(`TOTAL REVENUE: PKR ${totalRevenue.toLocaleString()}`);
  console.log("=".repeat(100));

  // Export to JSON + CSV
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const jsonPath = path.join(exportDir, `orders-${dateTag}.json`);
  const csvPath = path.join(exportDir, `orders-${dateTag}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify(simplified, null, 2));

  const csvHeader = "Order ID,Created At,Status,Customer Email,Customer Name,Total,Item Count,fbc,fbp,ttclid,ttp\n";
  const csvRows = simplified
    .map((o) =>
      [
        o.id,
        o.createdAt,
        o.status,
        o.customerEmail,
        o.customerName,
        o.total,
        o.itemCount,
        o.fbc,
        o.fbp,
        o.ttclid,
        o.ttp,
      ]
        .map((v) => `"${v ?? ""}"`.replace(/\n/g, " "))
        .join(",")
    )
    .join("\n");

  fs.writeFileSync(csvPath, csvHeader + csvRows);

  console.log(`\nExported:\n  ${jsonPath}\n  ${csvPath}\n`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Error fetching orders:", err);
  await prisma.$disconnect();
  process.exit(1);
});
