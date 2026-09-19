import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("Seeding CategorySetting and SizeChart rows...");

  // 1. Seed CategorySetting (singular)
  try {
    const cs1 = await prisma.categorySetting.upsert({
      where: { category: "crocs" },
      update: { lowStockThreshold: 5 },
      create: { category: "crocs", lowStockThreshold: 5 },
    });
    console.log("✓ CategorySetting crocs:", cs1);

    const cs2 = await prisma.categorySetting.upsert({
      where: { category: "trousers" },
      update: { lowStockThreshold: 5 },
      create: { category: "trousers", lowStockThreshold: 5 },
    });
    console.log("✓ CategorySetting trousers:", cs2);
  } catch (err: any) {
    console.log("CategorySetting singular note:", err.message);
  }

  // 2. Seed SizeChart rows
  const crocsSizes = [
    { size: "UK 6" },
    { size: "UK 7" },
    { size: "UK 8" },
    { size: "UK 9" },
    { size: "UK 10" },
    { size: "UK 11" },
  ];
  const crocsChart = await prisma.sizeChart.upsert({
    where: { category: "crocs" },
    update: { rows: JSON.stringify(crocsSizes) },
    create: { category: "crocs", rows: JSON.stringify(crocsSizes) },
  });
  console.log("✓ SizeChart crocs:", crocsChart);

  const trousersSizes = [
    { size: "28" },
    { size: "30" },
    { size: "32" },
    { size: "34" },
    { size: "36" },
    { size: "38" },
  ];
  const trousersChart = await prisma.sizeChart.upsert({
    where: { category: "trousers" },
    update: { rows: JSON.stringify(trousersSizes) },
    create: { category: "trousers", rows: JSON.stringify(trousersSizes) },
  });
  console.log("✓ SizeChart trousers:", trousersChart);

  console.log("Successfully seeded CategorySetting and SizeChart data!");
}

main()
  .catch((e) => {
    console.error("Error seeding category data:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
