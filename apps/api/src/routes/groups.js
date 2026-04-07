import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { parseBody } from "../lib/validation.js";
import { ensureGroupSettings, logOperation } from "../services/activity.js";

export const groupsRouter = express.Router();

const DEFAULT_WARNING_MESSAGE = "請注意群組規範，若持續違規系統會自動升級處理。";

const createGroupSchema = z.object({
  lineGroupId: z.string().min(1),
  name: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

const updateGroupSchema = z.object({
  lineGroupId: z.string().optional(),
  name: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

const settingsSchema = z.object({
  autoEnforcement: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  blacklistFilteringEnabled: z.boolean().optional(),
  spamDetectionEnabled: z.boolean().optional(),
  welcomeEnabled: z.boolean().optional(),
  announcementEnabled: z.boolean().optional(),
  keywordAutoReplyEnabled: z.boolean().optional(),
  lotteryEnabled: z.boolean().optional(),
  missionEnabled: z.boolean().optional(),
  checkinEnabled: z.boolean().optional(),
  rankingEnabled: z.boolean().optional(),
  violationThreshold: z.coerce.number().int().min(0).optional(),
  spamWindowSeconds: z.coerce.number().int().min(1).optional(),
  spamMaxMessages: z.coerce.number().int().min(1).optional(),
  pushToGroup: z.boolean().optional(),
  notifyAdmins: z.boolean().optional(),
  protectUrl: z.boolean().optional(),
  protectInvite: z.boolean().optional(),
  blacklistWords: z.array(z.string()).optional(),
  warningThreshold: z.coerce.number().int().min(0).optional(),
  reviewThreshold: z.coerce.number().int().min(0).optional(),
  kickThreshold: z.coerce.number().int().min(0).optional(),
  warningPoints: z.coerce.number().int().min(0).optional(),
  reviewPoints: z.coerce.number().int().min(0).optional(),
  kickPoints: z.coerce.number().int().min(0).optional(),
  warningMessage: z.string().optional(),
  adminNotifyLineIds: z.array(z.string()).optional(),
  adminNotifyTelegramChatIds: z.array(z.string()).optional()
});

groupsRouter.get("/", requireAuth, async (req, res) => {
  const groups = await prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      ruleSetting: true,
      groupSetting: true,
      pendingActions: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      _count: {
        select: {
          violations: true,
          messages: true,
          pendingActions: true,
          members: true,
            notifications: true,
            loanCases: true
        }
      }
    }
  });

  res.json({ groups });
});

groupsRouter.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = parseBody(createGroupSchema, req, res);
  if (!payload) return;

  const existing = await prisma.group.findUnique({
    where: { lineGroupId: payload.lineGroupId }
  });
  if (existing) {
    return res.status(409).json({ message: "這個 LINE Group ID 已經存在，請直接編輯既有群組。" });
  }

  const group = await prisma.group.create({
    data: {
      lineGroupId: payload.lineGroupId,
      name: payload.name || null,
      isActive: payload.isActive ?? true,
      ruleSetting: {
        create: {
          warningMessage: DEFAULT_WARNING_MESSAGE
        }
      },
      groupSetting: {
        create: {}
      },
      welcomeSetting: {
        create: {
          enabled: false,
          welcomeMessage: "歡迎加入群組，請先閱讀群規。",
          groupRulesMessage: "請遵守群組規範，避免洗版、廣告與違規連結。"
        }
      }
    },
    include: {
      ruleSetting: true,
      groupSetting: true,
      welcomeSetting: true
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: group.id,
    eventType: "GROUP_SETTING_CHANGED",
    title: "建立群組",
    detail: payload.lineGroupId
  });

  res.status(201).json({ group });
});

groupsRouter.get("/:groupId", requireAuth, async (req, res) => {
  const group = await prisma.group.findUnique({
    where: { id: req.params.groupId },
    include: {
      ruleSetting: true,
      groupSetting: true,
      welcomeSetting: true,
      members: { orderBy: { updatedAt: "desc" }, take: 5 },
      announcements: { orderBy: { updatedAt: "desc" }, take: 5 },
      autoReplyRules: { orderBy: { updatedAt: "desc" }, take: 5 },
      pendingActions: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      notifications: { orderBy: { createdAt: "desc" }, take: 10 },
      loanCases: { orderBy: { updatedAt: "desc" }, take: 10 },
      operationLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: {
        select: {
          violations: true,
          messages: true,
          pendingActions: true,
          members: true,
          notifications: true,
          announcements: true,
          autoReplyRules: true,
            missions: true,
            lotteries: true,
            loanCases: true
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
  const payload = parseBody(updateGroupSchema, req, res);
  if (!payload) return;

  const data = {};
  if (typeof payload.lineGroupId === "string") data.lineGroupId = payload.lineGroupId;
  if (typeof payload.name === "string") data.name = payload.name;
  if (typeof payload.isActive === "boolean") data.isActive = payload.isActive;

  if (data.lineGroupId) {
    const existing = await prisma.group.findUnique({
      where: { lineGroupId: data.lineGroupId }
    });
    if (existing && existing.id !== req.params.groupId) {
      return res.status(409).json({ message: "這個 LINE Group ID 已經被其他群組使用。" });
    }
  }

  const group = await prisma.group.update({
    where: { id: req.params.groupId },
    data
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: group.id,
    eventType: "GROUP_SETTING_CHANGED",
    title: "更新群組",
    detail: group.name || group.lineGroupId
  });

  res.json({ group });
});

groupsRouter.delete("/:groupId", requireAuth, requireRole("ADMIN"), async (req, res) => {
  await prisma.group.delete({ where: { id: req.params.groupId } });
  await logOperation({
    adminUserId: req.user.sub,
    groupId: req.params.groupId,
    eventType: "GROUP_SETTING_CHANGED",
    title: "刪除群組",
    detail: req.params.groupId
  });
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
      warningMessage: payload.warningMessage ?? current?.warningMessage ?? DEFAULT_WARNING_MESSAGE,
      adminNotifyLineIds: Array.isArray(payload.adminNotifyLineIds) ? payload.adminNotifyLineIds : current?.adminNotifyLineIds || [],
      adminNotifyTelegramChatIds: Array.isArray(payload.adminNotifyTelegramChatIds)
        ? payload.adminNotifyTelegramChatIds
        : current?.adminNotifyTelegramChatIds || []
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
      warningMessage: payload.warningMessage || DEFAULT_WARNING_MESSAGE,
      adminNotifyLineIds: Array.isArray(payload.adminNotifyLineIds) ? payload.adminNotifyLineIds : [],
      adminNotifyTelegramChatIds: Array.isArray(payload.adminNotifyTelegramChatIds) ? payload.adminNotifyTelegramChatIds : []
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: req.params.groupId,
    eventType: "GROUP_SETTING_CHANGED",
    title: "更新規則",
    detail: "已更新規則設定"
  });

  res.json({ rule });
});

groupsRouter.get("/:groupId/settings", requireAuth, async (req, res) => {
  const { groupSetting, welcomeSetting } = await ensureGroupSettings(req.params.groupId);
  res.json({ groupSetting, welcomeSetting });
});

groupsRouter.put("/:groupId/settings", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = parseBody(settingsSchema, req, res);
  if (!payload) return;

  const currentSetting = await prisma.groupSetting.upsert({
    where: { groupId: req.params.groupId },
    update: {
      autoEnforcement: payload.autoEnforcement ?? undefined,
      aiEnabled: payload.aiEnabled ?? undefined,
      blacklistFilteringEnabled: payload.blacklistFilteringEnabled ?? undefined,
      spamDetectionEnabled: payload.spamDetectionEnabled ?? undefined,
      welcomeEnabled: payload.welcomeEnabled ?? undefined,
      announcementEnabled: payload.announcementEnabled ?? undefined,
      keywordAutoReplyEnabled: payload.keywordAutoReplyEnabled ?? undefined,
      lotteryEnabled: payload.lotteryEnabled ?? undefined,
      missionEnabled: payload.missionEnabled ?? undefined,
      checkinEnabled: payload.checkinEnabled ?? undefined,
      rankingEnabled: payload.rankingEnabled ?? undefined,
      violationThreshold: payload.violationThreshold ?? undefined,
      spamWindowSeconds: payload.spamWindowSeconds ?? undefined,
      spamMaxMessages: payload.spamMaxMessages ?? undefined,
      pushToGroup: payload.pushToGroup ?? undefined,
      notifyAdmins: payload.notifyAdmins ?? undefined
    },
    create: {
      groupId: req.params.groupId,
      autoEnforcement: payload.autoEnforcement ?? true,
      aiEnabled: payload.aiEnabled ?? true,
      blacklistFilteringEnabled: payload.blacklistFilteringEnabled ?? true,
      spamDetectionEnabled: payload.spamDetectionEnabled ?? true,
      welcomeEnabled: payload.welcomeEnabled ?? false,
      announcementEnabled: payload.announcementEnabled ?? false,
      keywordAutoReplyEnabled: payload.keywordAutoReplyEnabled ?? false,
      lotteryEnabled: payload.lotteryEnabled ?? false,
      missionEnabled: payload.missionEnabled ?? false,
      checkinEnabled: payload.checkinEnabled ?? false,
      rankingEnabled: payload.rankingEnabled ?? false,
      violationThreshold: payload.violationThreshold ?? 3,
      spamWindowSeconds: payload.spamWindowSeconds ?? 10,
      spamMaxMessages: payload.spamMaxMessages ?? 5,
      pushToGroup: payload.pushToGroup ?? false,
      notifyAdmins: payload.notifyAdmins ?? true
    }
  });

  const ruleSetting = await prisma.ruleSetting.upsert({
    where: { groupId: req.params.groupId },
    update: {
      protectUrl: payload.protectUrl ?? undefined,
      protectInvite: payload.protectInvite ?? undefined,
      blacklistWords: payload.blacklistWords ?? undefined,
      warningThreshold: payload.warningThreshold ?? undefined,
      reviewThreshold: payload.reviewThreshold ?? undefined,
      kickThreshold: payload.kickThreshold ?? undefined,
      warningPoints: payload.warningPoints ?? undefined,
      reviewPoints: payload.reviewPoints ?? undefined,
      kickPoints: payload.kickPoints ?? undefined,
      warningMessage: payload.warningMessage ?? undefined,
      adminNotifyLineIds: payload.adminNotifyLineIds ?? undefined,
      adminNotifyTelegramChatIds: payload.adminNotifyTelegramChatIds ?? undefined,
      spamWindowSeconds: payload.spamWindowSeconds ?? undefined,
      spamMaxMessages: payload.spamMaxMessages ?? undefined
    },
    create: {
      groupId: req.params.groupId,
      protectUrl: payload.protectUrl ?? true,
      protectInvite: payload.protectInvite ?? true,
      blacklistWords: payload.blacklistWords ?? [],
      warningThreshold: payload.warningThreshold ?? 3,
      reviewThreshold: payload.reviewThreshold ?? 5,
      kickThreshold: payload.kickThreshold ?? 7,
      warningPoints: payload.warningPoints ?? 2,
      reviewPoints: payload.reviewPoints ?? 4,
      kickPoints: payload.kickPoints ?? 6,
      warningMessage: payload.warningMessage || DEFAULT_WARNING_MESSAGE,
      adminNotifyLineIds: payload.adminNotifyLineIds ?? [],
      adminNotifyTelegramChatIds: payload.adminNotifyTelegramChatIds ?? [],
      spamWindowSeconds: payload.spamWindowSeconds ?? 10,
      spamMaxMessages: payload.spamMaxMessages ?? 5
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: req.params.groupId,
    eventType: "GROUP_SETTING_CHANGED",
    title: "更新群組設定",
    detail: "已更新群組功能開關與門檻"
  });

  res.json({ groupSetting: currentSetting, ruleSetting });
});
