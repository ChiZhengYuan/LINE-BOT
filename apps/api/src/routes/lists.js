import express from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const listsRouter = express.Router();

listsRouter.get("/", requireAuth, async (req, res) => {
  const [blacklist, whitelist] = await Promise.all([
    prisma.blacklistEntry.findMany({ include: { group: true }, orderBy: { createdAt: "desc" } }),
    prisma.whitelistEntry.findMany({ include: { group: true }, orderBy: { createdAt: "desc" } })
  ]);

  res.json({ blacklist, whitelist });
});

listsRouter.delete("/:kind/:id", requireAuth, async (req, res) => {
  const { kind, id } = req.params;
  if (kind === "blacklist") {
    await prisma.blacklistEntry.delete({ where: { id } });
  } else {
    await prisma.whitelistEntry.delete({ where: { id } });
  }
  res.json({ ok: true });
});
