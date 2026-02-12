// MODIFIED BY AI: 2026-02-12 - add auth helpers for JWT, cookie parsing and password hashing
// FILE: server/auth.ts

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request } from "express";

export type UserRole = "admin" | "user";

export type AuthPayload = {
  userId: number;
  role: UserRole;
  deviceId: string;
  sessionId: number;
};

const DEFAULT_COOKIE_NAME = "app_auth_token";

export const getAuthCookieName = () =>
  process.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET environment variable");
  }
  return secret;
};

export const signAuthToken = (payload: AuthPayload) => {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
};

export const verifyAuthToken = (token: string): AuthPayload => {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid auth token payload");
  }

  const userId = Number((decoded as { userId?: unknown }).userId);
  const role = (decoded as { role?: unknown }).role;
  const deviceId = (decoded as { deviceId?: unknown }).deviceId;
  const sessionId = Number((decoded as { sessionId?: unknown }).sessionId);

  if (!Number.isInteger(userId) || !Number.isInteger(sessionId)) {
    throw new Error("Invalid auth token payload");
  }

  if (role !== "admin" && role !== "user") {
    throw new Error("Invalid auth token payload");
  }

  if (typeof deviceId !== "string" || !deviceId) {
    throw new Error("Invalid auth token payload");
  }

  return { userId, role, deviceId, sessionId };
};

export const hashPassword = async (password: string) => {
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  return bcrypt.hash(password, rounds);
};

export const verifyPassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};

export const parseCookies = (rawCookies: string | undefined) => {
  if (!rawCookies) return {} as Record<string, string>;

  return rawCookies.split(";").reduce<Record<string, string>>((acc, chunk) => {
    const index = chunk.indexOf("=");
    if (index <= 0) return acc;

    const key = chunk.slice(0, index).trim();
    const value = chunk.slice(index + 1).trim();
    if (!key) return acc;

    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
};

export const readBearerToken = (req: Request) => {
  const authHeader = req.header("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies[getAuthCookieName()] || null;
};

