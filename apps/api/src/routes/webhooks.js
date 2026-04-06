import express from "express";
import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { analyzeMessage } from "../services/ruleEngine.js";
import { recordViolation } from "../services/violationProcessor.js";
import { replyText } from "../services/line.js";

export const webhooksRouter = express.Router();

webhooksRouter.post("/line", express.raw({ type: "application/json" }), async (req, res, next) => {
  try {
    const signature = String(req.headers["x-line-signature"] || "");
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const valid = verifySignature(rawBody, signature, env.lineChannelSecret);

    if (!valid) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const events = Array.isArray(payload.events) ? payload.events : [];

    for (const event of events) {
      if (event.type !== "message" || event.message?.type !== "text") {
        continue;
      }

      const lineGroupId = event.source?.groupId || event.source?.roomId;
      const lineUserId = event.source?.userId;
      if (!lineGroupId || !lineUserId) {
        continue;
      }

      const group = await upsertGroup(lineGroupId);
      const messageLog = await prisma.messageLog.create({
        data: {
          groupId: group.id,
          lineGroupId,
          lineUserId,
          content: event.message.text,
          messageType: "text",
          raw: event
        }
      });

      const analysis = await analyzeMessage({
        group,
        content: event.message.text,
        lineUserId
      });

      await prisma.aiAssessment.create({
        data: {
          groupId: group.id,
          messageLogId: messageLog.id,
          lineUserId,
          riskScore: analysis.aiAssessment.riskScore,
          category: analysis.aiAssessment.category,
          reason: analysis.aiAssessment.reason,
          confidence: analysis.aiAssessment.confidence,
          raw: analysis.aiAssessment.raw
        }
      });

      if (analysis.matches.length > 0) {
        await recordViolation({
          group,
          messageLog,
          lineUserId,
          analysis
        });
      }

      if (analysis.actionTaken === "WARNING") {
        await replyText(event.replyToken, group.ruleSetting?.warningMessage || "請注意，您的訊息已違反群組規則。");
      }
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function verifySignature(rawBody, signature, channelSecret) {
  if (!channelSecret || !signature) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");

  return digest === signature;
}

async function upsertGroup(lineGroupId) {
  const group = await prisma.group.upsert({
    where: { lineGroupId },
    update: {},
    create: {
      lineGroupId,
      ruleSetting: {
        create: {}
      }
    },
    include: { ruleSetting: true }
  });

  if (!group.ruleSetting) {
    await prisma.ruleSetting.upsert({
      where: { groupId: group.id },
      update: {},
      create: { groupId: group.id }
    });
  }

  return prisma.group.findUnique({
    where: { id: group.id },
    include: { ruleSetting: true }
  });
}
