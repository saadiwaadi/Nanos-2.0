import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration: Backfilling per-color image galleries from product shared gallery...");

  const products = await prisma.product.findMany({
    include: {
      productColors: true,
    },
  });

  let totalUpdatedColors = 0;
  let skippedColors = 0;

  for (const product of products) {
    let productGallery: string[] = [];
    try {
      if (product.gallery) {
        const parsed = JSON.parse(product.gallery);
        if (Array.isArray(parsed)) productGallery = parsed;
      }
    } catch {
      productGallery = [];
    }

    if (productGallery.length === 0) continue;

    for (const color of product.productColors) {
      let colorImages: string[] = [];
      try {
        if (color.imagesJson) {
          const parsed = JSON.parse(color.imagesJson);
          if (Array.isArray(parsed)) colorImages = parsed;
        }
      } catch {
        colorImages = [];
      }

      // Only copy old shared gallery URLs into existing color if color currently has 0 images
      if (colorImages.length === 0) {
        await prisma.productColor.update({
          where: { id: color.id },
          data: {
            imagesJson: JSON.stringify(productGallery),
          },
        });
        totalUpdatedColors++;
        console.log(`Updated color "${color.name}" (${color.id}) for product "${product.name}" with ${productGallery.length} gallery images.`);
      } else {
        skippedColors++;
      }
    }
  }

  console.log(`✅ Migration completed! Updated: ${totalUpdatedColors} colors, Skipped (already had images): ${skippedColors} colors.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
