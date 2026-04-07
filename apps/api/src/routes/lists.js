import express from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getTenantOwnerId } from "../middleware/tenant.js";

export const listsRouter = express.Router();

listsRouter.get("/", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const where = ownerAdminId ? { ownerAdminId } : {};
  const [blacklist, whitelist] = await Promise.all([
    prisma.blacklistEntry.findMany({ where, include: { group: true }, orderBy: { createdAt: "desc" } }),
    prisma.whitelistEntry.findMany({ where, include: { group: true }, orderBy: { createdAt: "desc" } })
  ]);

  res.json({ blacklist, whitelist });
});

listsRouter.delete("/:kind/:id", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const { kind, id } = req.params;
  if (kind === "blacklist") {
    const item = await prisma.blacklistEntry.findUnique({ where: { id } });
    if (!item || (ownerAdminId && item.ownerAdminId !== ownerAdminId)) {
      return res.status(404).json({ message: "找不到項目" });
    }
    await prisma.blacklistEntry.delete({ where: { id } });
  } else {
    const item = await prisma.whitelistEntry.findUnique({ where: { id } });
    if (!item || (ownerAdminId && item.ownerAdminId !== ownerAdminId)) {
      return res.status(404).json({ message: "找不到項目" });
    }
    await prisma.whitelistEntry.delete({ where: { id } });
  }

  res.json({ ok: true });
});
