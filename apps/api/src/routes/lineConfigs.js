import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireSuperAdmin, getTenantOwnerId } from "../middleware/tenant.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { encryptSecret, decryptSecret, maskSecret } from "../services/cryptoVault.js";

export const lineConfigsRouter = express.Router();

const createSchema = z.object({
  configName: z.string().min(1),
  channelId: z.string().min(1),
  channelSecret: z.string().min(1),
  channelAccessToken: z.string().min(1),
  basicId: z.string().optional().nullable(),
  botId: z.string().optional().nullable(),
  webhookUrl: z.string().optional().nullable(),
  webhookToken: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional()
});

const updateSchema = createSchema.partial();

const listSchema = z.object({
  q: z.string().optional(),
  isActive: z.string().optional(),
  isDefault: z.string().optional()
});

lineConfigsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const ownerAdminId = getTenantOwnerId(req);
  const where = ownerAdminId ? { ownerAdminId } : {};
  if (query.q) {
    where.OR = [
      { configName: { contains: query.q, mode: "insensitive" } },
      { channelId: { contains: query.q, mode: "insensitive" } },
      { basicId: { contains: query.q, mode: "insensitive" } },
      { botId: { contains: query.q, mode: "insensitive" } }
    ];
  }
  if (query.isActive === "true") where.isActive = true;
  if (query.isActive === "false") where.isActive = false;
  if (query.isDefault === "true") where.isDefault = true;
  if (query.isDefault === "false") where.isDefault = false;

  const items = await prisma.lineDeveloperConfig.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  res.json({
    items: items.map(sanitizeConfig)
  });
});

lineConfigsRouter.post("/", requireAuth, async (req, res) => {
  const payload = parseBody(createSchema, req, res);
  if (!payload) return;

  const ownerAdminId = getTenantOwnerId(req);
  if (!ownerAdminId && req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const webhookToken = String(payload.webhookToken || cryptoRandom());
  const isDefault = Boolean(payload.isDefault);

  if (isDefault) {
    await prisma.lineDeveloperConfig.updateMany({
      where: { ownerAdminId, isDefault: true },
      data: { isDefault: false }
    });
  }

  const config = await prisma.lineDeveloperConfig.create({
    data: {
      ownerAdminId,
      adminUserId: ownerAdminId || req.user.sub,
      configName: payload.configName,
      channelId: payload.channelId,
      channelSecretCiphertext: encryptSecret(payload.channelSecret),
      channelAccessTokenCiphertext: encryptSecret(payload.channelAccessToken),
      basicId: payload.basicId || null,
      botId: payload.botId || null,
      webhookUrl: payload.webhookUrl || null,
      webhookToken,
      isActive: payload.isActive ?? true,
      isDefault,
      status: "PENDING"
    }
  });

  res.status(201).json({ item: sanitizeConfig(config) });
});

lineConfigsRouter.patch("/:configId", requireAuth, async (req, res) => {
  const payload = parseBody(updateSchema, req, res);
  if (!payload) return;

  const ownerAdminId = getTenantOwnerId(req);
  const current = await prisma.lineDeveloperConfig.findUnique({
    where: { id: req.params.configId }
  });
  if (!current) {
    return res.status(404).json({ message: "Config not found" });
  }
  if (ownerAdminId && current.ownerAdminId !== ownerAdminId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const data = {};
  if (payload.configName !== undefined) data.configName = payload.configName;
  if (payload.channelId !== undefined) data.channelId = payload.channelId;
  if (payload.channelSecret !== undefined) data.channelSecretCiphertext = encryptSecret(payload.channelSecret);
  if (payload.channelAccessToken !== undefined) data.channelAccessTokenCiphertext = encryptSecret(payload.channelAccessToken);
  if (payload.basicId !== undefined) data.basicId = payload.basicId;
  if (payload.botId !== undefined) data.botId = payload.botId;
  if (payload.webhookUrl !== undefined) data.webhookUrl = payload.webhookUrl;
  if (payload.webhookToken !== undefined) data.webhookToken = payload.webhookToken || cryptoRandom();
  if (payload.isActive !== undefined) data.isActive = payload.isActive;
  if (payload.isDefault !== undefined) data.isDefault = payload.isDefault;

  if (data.isDefault) {
    await prisma.lineDeveloperConfig.updateMany({
      where: { ownerAdminId: current.ownerAdminId, isDefault: true, NOT: { id: current.id } },
      data: { isDefault: false }
    });
  }

  const item = await prisma.lineDeveloperConfig.update({
    where: { id: current.id },
    data
  });

  res.json({ item: sanitizeConfig(item) });
});

lineConfigsRouter.delete("/:configId", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const current = await prisma.lineDeveloperConfig.findUnique({
    where: { id: req.params.configId }
  });
  if (!current) {
    return res.status(404).json({ message: "Config not found" });
  }
  if (ownerAdminId && current.ownerAdminId !== ownerAdminId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await prisma.lineDeveloperConfig.delete({ where: { id: current.id } });
  res.json({ ok: true });
});

lineConfigsRouter.post("/:configId/test", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const config = await prisma.lineDeveloperConfig.findUnique({
    where: { id: req.params.configId }
  });
  if (!config) {
    return res.status(404).json({ message: "Config not found" });
  }
  if (ownerAdminId && config.ownerAdminId !== ownerAdminId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const verified = await prisma.lineDeveloperConfig.update({
    where: { id: config.id },
    data: {
      status: "VERIFIED",
      lastVerifiedAt: new Date(),
      lastVerifiedError: null
    }
  });

  res.json({
    ok: true,
    item: {
      ...sanitizeConfig(verified),
      channelSecretMasked: maskSecret(decryptSecret(verified.channelSecretCiphertext)),
      channelAccessTokenMasked: maskSecret(decryptSecret(verified.channelAccessTokenCiphertext))
    }
  });
});

function sanitizeConfig(config) {
  return {
    id: config.id,
    ownerAdminId: config.ownerAdminId,
    configName: config.configName,
    channelId: config.channelId,
    basicId: config.basicId,
    botId: config.botId,
    webhookUrl: config.webhookUrl,
    webhookToken: config.webhookToken,
    isActive: config.isActive,
    isDefault: config.isDefault,
    status: config.status,
    lastVerifiedAt: config.lastVerifiedAt,
    lastVerifiedError: config.lastVerifiedError,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
}

function cryptoRandom() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
