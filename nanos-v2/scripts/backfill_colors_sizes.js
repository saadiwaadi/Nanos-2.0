const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseJson(str, fallback = []) {
  try {
    const val = JSON.parse(str);
    return Array.isArray(val) ? val : fallback;
  } catch {
    return fallback;
  }
}

async function backfill() {
  console.log('Starting colors & sizes backfill...');
  const products = await prisma.product.findMany({
    include: { productColors: true, stockLevels: true }
  });

  for (const product of products) {
    console.log(`\nProcessing ${product.id} (${product.name})...`);

    // 1. Gather all colors
    const existingDbColors = product.productColors;
    const jsonColors = parseJson(product.colors);
    const variantColorNames = Array.from(new Set(product.stockLevels.map(s => s.color)));

    // Map of colorName -> hex
    const colorMap = new Map();
    for (const c of jsonColors) {
      if (c && c.name) {
        colorMap.set(c.name, c.hex || '#111111');
      }
    }
    for (const c of existingDbColors) {
      if (c && c.name) {
        colorMap.set(c.name, c.hex || colorMap.get(c.name) || '#111111');
      }
    }
    for (const cName of variantColorNames) {
      if (cName && !colorMap.has(cName)) {
        colorMap.set(cName, '#111111');
      }
    }

    if (colorMap.size === 0) {
      colorMap.set('Standard', '#111111');
    }

    // Upsert into ProductColor
    let sort = 0;
    const syncedColors = [];
    for (const [name, hex] of colorMap.entries()) {
      const existing = existingDbColors.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        const created = await prisma.productColor.create({
          data: {
            productId: product.id,
            name,
            hex: hex.startsWith('#') ? hex : `#${hex}`,
            sortOrder: sort++,
            imagesJson: '[]'
          }
        });
        syncedColors.push({ id: created.id, name: created.name, hex: created.hex });
        console.log(`  Created ProductColor: ${name} (${hex})`);
      } else {
        syncedColors.push({ id: existing.id, name: existing.name, hex: existing.hex });
      }
    }

    // 2. Gather all sizes
    const jsonSizes = parseJson(product.sizes);
    const variantSizes = Array.from(new Set(product.stockLevels.map(s => s.size)));
    const sizeSet = new Set([...jsonSizes, ...variantSizes]);
    if (sizeSet.size === 0) {
      sizeSet.add('Standard');
    }
    const syncedSizes = Array.from(sizeSet);

    // 3. Ensure StockLevel variants exist for every (color, size)
    for (const color of syncedColors) {
      for (const size of syncedSizes) {
        const existingStock = product.stockLevels.find(
          s => s.color.toLowerCase() === color.name.toLowerCase() && s.size.toLowerCase() === size.toLowerCase()
        );
        if (!existingStock) {
          await prisma.stockLevel.create({
            data: {
              productId: product.id,
              color: color.name,
              size,
              quantity: 0
            }
          });
          console.log(`  Created StockLevel variant: ${color.name} / ${size} (stock: 0)`);
        }
      }
    }

    // 4. Update Product JSON fields
    await prisma.product.update({
      where: { id: product.id },
      data: {
        colors: JSON.stringify(syncedColors.map(c => ({ name: c.name, hex: c.hex }))),
        sizes: JSON.stringify(syncedSizes)
      }
    });

    console.log(`  Synced product ${product.id}: ${syncedColors.length} colors, ${syncedSizes.length} sizes.`);
  }

  console.log('\nBackfill completed successfully!');
}

backfill()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Backfill error:', err);
    prisma.$disconnect();
    process.exit(1);
  });
