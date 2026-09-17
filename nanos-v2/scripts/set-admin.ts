import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const rawPassword = process.argv[3] || "Admin123!";

  if (!email) {
    console.error("Usage: npx tsx scripts/set-admin.ts <email> [password]");
    process.exit(1);
  }

  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });

  let user;
  if (!existing) {
    user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: cleanEmail.split("@")[0],
        role: "admin",
        passwordHash,
      },
      select: { id: true, email: true, role: true, passwordHash: true },
    });
  } else {
    user = await prisma.user.update({
      where: { email: cleanEmail },
      data: {
        role: "admin",
        ...(existing.passwordHash ? {} : { passwordHash }),
      },
      select: { id: true, email: true, role: true, passwordHash: true },
    });
  }

  console.log("✅ Admin role set:", {
    id: user.id,
    email: user.email,
    role: user.role,
    passwordHashPresent: !!user.passwordHash,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
