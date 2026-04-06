import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import bcrypt from "bcryptjs";

async function ensureAdmin() {
  const count = await prisma.adminUser.count();
  if (count > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(env.defaultAdminPassword, 12);
  await prisma.adminUser.create({
    data: {
      email: env.defaultAdminEmail,
      passwordHash,
      name: env.defaultAdminName,
      role: "ADMIN"
    }
  });
}

async function main() {
  await prisma.$connect();
  await ensureAdmin();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
