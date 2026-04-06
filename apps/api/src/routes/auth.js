import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = express.Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = await prisma.adminUser.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: "帳號或密碼錯誤" });
    }

    const valid = await bcrypt.compare(password || "", user.passwordHash);
    if (!valid) {
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

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: req.user.sub },
    select: { id: true, email: true, name: true, role: true }
  });

  res.json({ user });
});
