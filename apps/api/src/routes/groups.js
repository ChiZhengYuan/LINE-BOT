import express from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

export const groupsRouter = express.Router();

groupsRouter.get("/", requireAuth, async (req, res) => {
  const groups = await prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      ruleSetting: true,
      _count: {
        select: {
          violations: true,
          messages: true,
          pendingActions: true
        }
      }
    }
  });

  res.json({ groups });
});

groupsRouter.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = req.body || {};
  if (!payload.lineGroupId) {
    return res.status(400).json({ message: "lineGroupId is required" });
  }

  const group = await prisma.group.create({
    data: {
      lineGroupId: payload.lineGroupId,
      name: payload.name || null,
      isActive: payload.isActive ?? true,
      ruleSetting: {
        create: {
          protectUrl: payload.protectUrl ?? true,
          protectInvite: payload.protectInvite ?? true
        }
      }
    },
    include: { ruleSetting: true }
  });

  res.status(201).json({ group });
});

groupsRouter.get("/:groupId", requireAuth, async (req, res) => {
  const group = await prisma.group.findUnique({
    where: { id: req.params.groupId },
    include: {
      ruleSetting: true,
      blacklistEntries: true,
      whitelistEntries: true,
      _count: {
        select: {
          violations: true,
          messages: true,
          pendingActions: true,
          aiAssessments: true
        }
      }
    }
  });

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  res.json({ group });
});

groupsRouter.patch("/:groupId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = req.body || {};
  const group = await prisma.group.update({
    where: { id: req.params.groupId },
    data: {
      lineGroupId: payload.lineGroupId,
      name: payload.name,
      isActive: payload.isActive
    }
  });

  res.json({ group });
});

groupsRouter.delete("/:groupId", requireAuth, requireRole("ADMIN"), async (req, res) => {
  await prisma.group.delete({ where: { id: req.params.groupId } });
  res.json({ ok: true });
});

groupsRouter.get("/:groupId/rules", requireAuth, async (req, res) => {
  const rule = await prisma.ruleSetting.findUnique({
    where: { groupId: req.params.groupId }
  });
  res.json({ rule });
});

groupsRouter.put("/:groupId/rules", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = req.body || {};
  const current = await prisma.ruleSetting.findUnique({
    where: { groupId: req.params.groupId }
  });
  const rule = await prisma.ruleSetting.upsert({
    where: { groupId: req.params.groupId },
    update: {
      protectUrl: payload.protectUrl ?? current?.protectUrl ?? true,
      protectInvite: payload.protectInvite ?? current?.protectInvite ?? true,
      blacklistWords: Array.isArray(payload.blacklistWords) ? payload.blacklistWords : current?.blacklistWords || [],
      spamWindowSeconds: Number(payload.spamWindowSeconds ?? current?.spamWindowSeconds ?? 10),
      spamMaxMessages: Number(payload.spamMaxMessages ?? current?.spamMaxMessages ?? 5),
      warningThreshold: Number(payload.warningThreshold ?? current?.warningThreshold ?? 3),
      reviewThreshold: Number(payload.reviewThreshold ?? current?.reviewThreshold ?? 5),
      kickThreshold: Number(payload.kickThreshold ?? current?.kickThreshold ?? 7),
      warningPoints: Number(payload.warningPoints ?? current?.warningPoints ?? 2),
      reviewPoints: Number(payload.reviewPoints ?? current?.reviewPoints ?? 4),
      kickPoints: Number(payload.kickPoints ?? current?.kickPoints ?? 6),
      warningMessage: payload.warningMessage ?? current?.warningMessage ?? "請注意，您的訊息已違反群組規則。",
      adminNotifyLineIds: Array.isArray(payload.adminNotifyLineIds) ? payload.adminNotifyLineIds : current?.adminNotifyLineIds || [],
      adminNotifyTelegramChatIds: Array.isArray(payload.adminNotifyTelegramChatIds) ? payload.adminNotifyTelegramChatIds : current?.adminNotifyTelegramChatIds || []
    },
    create: {
      groupId: req.params.groupId,
      protectUrl: payload.protectUrl ?? true,
      protectInvite: payload.protectInvite ?? true,
      blacklistWords: Array.isArray(payload.blacklistWords) ? payload.blacklistWords : [],
      spamWindowSeconds: Number(payload.spamWindowSeconds ?? 10),
      spamMaxMessages: Number(payload.spamMaxMessages ?? 5),
      warningThreshold: Number(payload.warningThreshold ?? 3),
      reviewThreshold: Number(payload.reviewThreshold ?? 5),
      kickThreshold: Number(payload.kickThreshold ?? 7),
      warningPoints: Number(payload.warningPoints ?? 2),
      reviewPoints: Number(payload.reviewPoints ?? 4),
      kickPoints: Number(payload.kickPoints ?? 6),
      warningMessage: payload.warningMessage || "請注意，您的訊息已違反群組規則。",
      adminNotifyLineIds: Array.isArray(payload.adminNotifyLineIds) ? payload.adminNotifyLineIds : [],
      adminNotifyTelegramChatIds: Array.isArray(payload.adminNotifyTelegramChatIds) ? payload.adminNotifyTelegramChatIds : []
    }
  });

  res.json({ rule });
});

groupsRouter.post("/:groupId/blacklist", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const item = await prisma.blacklistEntry.create({
    data: {
      groupId: req.params.groupId,
      value: req.body.value,
      note: req.body.note || null
    }
  });
  res.json({ item });
});

groupsRouter.post("/:groupId/whitelist", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const item = await prisma.whitelistEntry.create({
    data: {
      groupId: req.params.groupId,
      value: req.body.value,
      note: req.body.note || null
    }
  });
  res.json({ item });
});
