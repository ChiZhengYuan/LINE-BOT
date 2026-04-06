import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const rootEnv = resolve(process.cwd(), "../../.env");
const localEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) {
  config({ path: rootEnv });
}
if (existsSync(localEnv)) {
  config({ path: localEnv, override: true });
}

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!";
  const name = process.env.DEFAULT_ADMIN_NAME || "System Admin";

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name,
      role: "ADMIN"
    }
  });

  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
