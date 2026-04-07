import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { parseBody } from "../lib/validation.js";
import { logOperation } from "../services/activity.js";

export const welcomeRouter = express.Router();

const bodySchema = z.object({
  groupId: z.string().min(1),
  enabled: z.boolean().optional(),
  welcomeMessage: z.string().min(1),
  groupRulesMessage: z.string().min(1),
  flexTemplate: z.any().optional().nullable()
});

welcomeRouter.get("/groups/:groupId", requireAuth, async (req, res) => {
  const item = await prisma.welcomeSetting.findUnique({
    where: { groupId: req.params.groupId }
  });

  res.json({
    item: item || {
      groupId: req.params.groupId,
      enabled: false,
      welcomeMessage: "歡迎加入群組，請先閱讀群規。",
      groupRulesMessage: "請遵守群組規範，避免洗版與廣告。",
      flexTemplate: null
    }
  });
});

welcomeRouter.put("/groups/:groupId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = parseBody(bodySchema, req, res);
  if (!data) return;

  const item = await prisma.welcomeSetting.upsert({
    where: { groupId: req.params.groupId },
    update: {
      enabled: data.enabled ?? undefined,
      welcomeMessage: data.welcomeMessage,
      groupRulesMessage: data.groupRulesMessage,
      flexTemplate: data.flexTemplate ?? null
    },
    create: {
      groupId: req.params.groupId,
      enabled: data.enabled ?? false,
      welcomeMessage: data.welcomeMessage,
      groupRulesMessage: data.groupRulesMessage,
      flexTemplate: data.flexTemplate ?? null
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: req.params.groupId,
    eventType: "GROUP_SETTING_CHANGED",
    title: "更新歡迎設定",
    detail: "已更新新人歡迎與群規訊息"
  });

  res.json({ item });
});

