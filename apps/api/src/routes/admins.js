import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/tenant.js";
import { logOperation } from "../services/activity.js";

export const adminsRouter = express.Router();

adminsRouter.get("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      planType: true,
      expireAt: true,
      blockedAt: true,
      blockedReason: true,
      lastLoginAt: true,
      lastLoginIp: true,
      lastLoginUserAgent: true,
      ownerAdminId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          operationLogs: true,
          loginLogs: true,
          notifications: true,
          lineDeveloperConfigs: true
        }
      }
    }
  });

  res.json({ admins });
});

adminsRouter.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const payload = req.body || {};
  if (!payload.email || !payload.password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const role = payload.role || "ADMIN";
  const planType = payload.planType || "PERMANENT";
  const expireAt = payload.expireAt ? new Date(payload.expireAt) : null;

  const admin = await prisma.adminUser.create({
    data: {
      email: String(payload.email).trim().toLowerCase(),
      name: payload.name || null,
      role,
      status: payload.status || "ACTIVE",
      planType,
      expireAt,
      passwordHash: await bcrypt.hash(payload.password, 12)
    }
  });

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { ownerAdminId: admin.id }
  });

  await logOperation({
    adminUserId: req.user.sub,
    ownerAdminId: admin.id,
    eventType: "GROUP_SETTING_CHANGED",
    title: "建立管理員",
    detail: admin.email
  }).catch(() => {});

  res.status(201).json({
    admin: sanitizeAdmin(admin)
  });
});

adminsRouter.patch("/:adminId", requireAuth, requireSuperAdmin, async (req, res) => {
  const payload = req.body || {};
  const data = {};

  if (payload.email !== undefined) data.email = String(payload.email).trim().toLowerCase();
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.role !== undefined) data.role = payload.role;
  if (payload.status !== undefined) data.status = payload.status;
  if (payload.planType !== undefined) data.planType = payload.planType;
  if (payload.expireAt !== undefined) data.expireAt = payload.expireAt ? new Date(payload.expireAt) : null;
  if (payload.blockedReason !== undefined) data.blockedReason = payload.blockedReason;
  if (payload.password) data.passwordHash = await bcrypt.hash(payload.password, 12);

  if (payload.status === "BLOCKED") {
    data.blockedAt = new Date();
  }
  if (payload.status === "ACTIVE") {
    data.blockedAt = null;
    data.blockedReason = null;
  }

  const admin = await prisma.adminUser.update({
    where: { id: req.params.adminId },
    data
  });

  await logOperation({
    adminUserId: req.user.sub,
    ownerAdminId: admin.id,
    eventType: "GROUP_SETTING_CHANGED",
    title: "更新管理員",
    detail: admin.email
  }).catch(() => {});

  res.json({
    admin: sanitizeAdmin(admin)
  });
});

adminsRouter.post("/:adminId/renew", requireAuth, requireSuperAdmin, async (req, res) => {
  const payload = req.body || {};
  const expireAt = payload.expireAt ? new Date(payload.expireAt) : null;
  const admin = await prisma.adminUser.update({
    where: { id: req.params.adminId },
    data: {
      status: "ACTIVE",
      expireAt,
      planType: payload.planType || "EXPIRING",
      blockedAt: null,
      blockedReason: null
    }
  });

  res.json({ admin: sanitizeAdmin(admin) });
});

adminsRouter.delete("/:adminId", requireAuth, requireSuperAdmin, async (req, res) => {
  if (req.user.sub === req.params.adminId) {
    return res.status(400).json({ message: "You cannot delete yourself" });
  }

  await prisma.adminUser.delete({ where: { id: req.params.adminId } });
  res.json({ ok: true });
});

adminsRouter.get("/login-logs", requireAuth, requireSuperAdmin, async (req, res) => {
  const logs = await prisma.adminLoginLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 100),
    include: { adminUser: true }
  });
  res.json({ items: logs });
});

adminsRouter.get("/activity-logs", requireAuth, requireSuperAdmin, async (req, res) => {
  const logs = await prisma.adminActivityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 100),
    include: { adminUser: true }
  });
  res.json({ items: logs });
});

adminsRouter.get("/notifications", requireAuth, requireSuperAdmin, async (req, res) => {
  const items = await prisma.adminNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 100)
  });
  const unreadCount = await prisma.adminNotification.count({ where: { isRead: false } });
  res.json({ items, unreadCount });
});

adminsRouter.post("/notifications/:notificationId/read", requireAuth, requireSuperAdmin, async (req, res) => {
  const item = await prisma.adminNotification.update({
    where: { id: req.params.notificationId },
    data: { isRead: true, readAt: new Date() }
  });
  res.json({ item });
});

function sanitizeAdmin(admin) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    status: admin.status,
    planType: admin.planType,
    expireAt: admin.expireAt,
    blockedAt: admin.blockedAt,
    blockedReason: admin.blockedReason,
    lastLoginAt: admin.lastLoginAt,
    ownerAdminId: admin.ownerAdminId,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt
  };
}
