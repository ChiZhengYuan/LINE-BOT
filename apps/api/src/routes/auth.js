import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { logOperation } from "../services/activity.js";

export const authRouter = express.Router();

authRouter.post("/login", async (req, res, next) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
  const userAgent = req.headers["user-agent"] || null;

  try {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) {
      await prisma.adminLoginLog.create({
        data: {
          email,
          success: false,
          reason: "USER_NOT_FOUND",
          ipAddress: stringifyHeader(ipAddress),
          userAgent
        }
      }).catch(() => {});
      return res.status(401).json({ message: "帳號或密碼錯誤" });
    }

    const statusCheck = getAccountStatus(user);
    if (!statusCheck.ok) {
      await prisma.adminLoginLog.create({
        data: {
          ownerAdminId: user.ownerAdminId || user.id,
          adminUserId: user.id,
          email: user.email,
          success: false,
          reason: statusCheck.reason,
          ipAddress: stringifyHeader(ipAddress),
          userAgent
        }
      }).catch(() => {});
      return res.status(403).json({ message: statusCheck.message });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await prisma.adminLoginLog.create({
        data: {
          ownerAdminId: user.ownerAdminId || user.id,
          adminUserId: user.id,
          email: user.email,
          success: false,
          reason: "INVALID_PASSWORD",
          ipAddress: stringifyHeader(ipAddress),
          userAgent
        }
      }).catch(() => {});
      return res.status(401).json({ message: "帳號或密碼錯誤" });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: stringifyHeader(ipAddress),
        lastLoginUserAgent: userAgent
      }
    });

    await prisma.adminLoginLog.create({
      data: {
        ownerAdminId: user.ownerAdminId || user.id,
        adminUserId: user.id,
        email: user.email,
        success: true,
        reason: "OK",
        ipAddress: stringifyHeader(ipAddress),
        userAgent
      }
    });

    await logOperation({
      adminUserId: user.id,
      ownerAdminId: user.ownerAdminId || user.id,
      eventType: "LOGIN",
      title: "管理員登入",
      detail: `${user.email} 已登入`
    }).catch(() => {});

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        planType: user.planType,
        expireAt: user.expireAt
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: req.user.sub },
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
      ownerAdminId: true
    }
  });

  res.json({ user });
});

function getAccountStatus(user) {
  if (user.status === "BLOCKED") {
    return { ok: false, reason: "BLOCKED", message: "帳號已被封鎖，請聯絡超級系統管理員。" };
  }

  if (user.status === "EXPIRED") {
    return { ok: false, reason: "EXPIRED", message: "帳號已到期，請聯絡超級系統管理員續約。" };
  }

  if (user.planType === "EXPIRING" && user.expireAt && new Date(user.expireAt).getTime() < Date.now()) {
    return { ok: false, reason: "EXPIRED", message: "帳號已到期，請聯絡超級系統管理員續約。" };
  }

  return { ok: true };
}

function stringifyHeader(value) {
  if (Array.isArray(value)) return value[0] || null;
  if (value === undefined || value === null) return null;
  return String(value);
}
