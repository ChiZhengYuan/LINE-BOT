import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

export const adminsRouter = express.Router();

adminsRouter.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json({ admins });
});

adminsRouter.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const payload = req.body || {};
  if (!payload.email || !payload.password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const admin = await prisma.adminUser.create({
    data: {
      email: payload.email,
      name: payload.name || null,
      role: payload.role || "VIEWER",
      passwordHash: await bcrypt.hash(payload.password, 12)
    }
  });

  res.status(201).json({
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    }
  });
});

adminsRouter.patch("/:adminId", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const payload = req.body || {};
  const data = {};

  if (payload.email !== undefined) data.email = payload.email;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.role !== undefined) data.role = payload.role;
  if (payload.password) data.passwordHash = await bcrypt.hash(payload.password, 12);

  const admin = await prisma.adminUser.update({
    where: { id: req.params.adminId },
    data
  });

  res.json({
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    }
  });
});

adminsRouter.delete("/:adminId", requireAuth, requireRole("ADMIN"), async (req, res) => {
  if (req.user.sub === req.params.adminId) {
    return res.status(400).json({ message: "You cannot delete yourself" });
  }

  await prisma.adminUser.delete({ where: { id: req.params.adminId } });
  res.json({ ok: true });
});
