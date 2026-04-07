import crypto from "node:crypto";
import { env } from "../config/env.js";

function getKey() {
  return crypto.createHash("sha256").update(String(env.lineConfigEncryptionKey || env.jwtSecret)).digest();
}

export function encryptSecret(value) {
  const text = String(value || "");
  if (!text) return "";

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload) {
  if (!payload) return "";
  const raw = Buffer.from(String(payload), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskSecret(value, visible = 4) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= visible * 2) return `${text.slice(0, 2)}***`;
  return `${text.slice(0, visible)}***${text.slice(-visible)}`;
}
