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
  await ensureAccount({
    email: process.env.DEFAULT_SUPER_ADMIN_EMAIL || "superadmin@example.com",
    username: process.env.DEFAULT_SUPER_ADMIN_USERNAME || "superadmin",
    password: process.env.DEFAULT_SUPER_ADMIN_PASSWORD || "SuperAdmin12345!",
    name: process.env.DEFAULT_SUPER_ADMIN_NAME || "Super Admin",
    role: "SUPER_ADMIN"
  });

  await ensureAccount({
    email: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
    username: process.env.DEFAULT_ADMIN_USERNAME || "admin",
    password: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!",
    name: process.env.DEFAULT_ADMIN_NAME || "System Admin",
    role: "ADMIN"
  });
}

async function ensureAccount({ email, username, password, name, role }) {
  const normalizedEmail = normalizeIdentifier(email);
  const normalizedUsername = normalizeIdentifier(username);
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await findExistingAccount(normalizedEmail, normalizedUsername);
  if (existing) {
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        email: normalizedEmail || existing.email,
        username: normalizedUsername || existing.username,
        passwordHash,
        name,
        role,
        status: "ACTIVE",
        ownerAdminId: existing.ownerAdminId || existing.id
      }
    });

    console.log(`Seeded admin user: ${normalizedUsername || normalizedEmail}`);
    return;
  }

  const admin = await prisma.adminUser.create({
    data: {
      email: normalizedEmail || null,
      username: normalizedUsername || null,
      passwordHash,
      name,
      role,
      status: "ACTIVE"
    }
  });

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { ownerAdminId: admin.id }
  });

  console.log(`Seeded admin user: ${normalizedUsername || normalizedEmail}`);
}

async function findExistingAccount(email, username) {
  if (email) {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) return existing;
  }

  if (username) {
    const existing = await prisma.adminUser.findUnique({ where: { username } });
    if (existing) return existing;
  }

  return null;
}

function normalizeIdentifier(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().toLowerCase();
  return text || null;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
