import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { markAllNotificationsRead, markNotificationRead } from "../services/activity.js";

export const notificationsRouter = express.Router();

const listSchema = z.object({
  groupId: z.string().optional(),
  type: z.string().optional(),
  isRead: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

notificationsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.type) where.type = query.type;
  if (query.isRead === "true") where.isRead = true;
  if (query.isRead === "false") where.isRead = false;

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: { group: true, member: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { isRead: false } })
  ]);

  res.json({ items, total, unreadCount, page, limit });
});

notificationsRouter.get("/unread-count", requireAuth, async (req, res) => {
  const unreadCount = await prisma.notification.count({ where: { isRead: false } });
  res.json({ unreadCount });
});

notificationsRouter.post("/:notificationId/read", requireAuth, async (req, res) => {
  const item = await markNotificationRead(req.params.notificationId);
  res.json({ item });
});

notificationsRouter.post("/read-all", requireAuth, async (req, res) => {
  const result = await markAllNotificationsRead();
  res.json({ result });
});

