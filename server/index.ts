// MODIFIED BY AI: 2026-02-12 - add Supabase-backed auth, admin API, device binding and cleanup routes
// FILE: server/index.ts

import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "http";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import {
  ACCOUNT_EXPIRED_MESSAGE,
  DEVICE_IN_USE_MESSAGE,
  evaluateDeviceAccess,
} from "./accessRules";
import {
  getAuthCookieName,
  hashPassword,
  readBearerToken,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
  type AuthPayload,
  type UserRole,
} from "./auth";
import { cleanupExpiredUsers, type CleanupMode } from "./cleanupExpired";
import { query } from "./db";
import { OnayClient, loadOnayConfig } from "./onayClient";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let onayClient: OnayClient | null = null;

const getOnayClient = () => {
  if (!onayClient) {
    onayClient = new OnayClient(loadOnayConfig());
  }
  return onayClient;
};

const onayWarmupOnBoot = process.env.ONAY_WARMUP_ON_BOOT === "true";

// MODIFIED BY AI: 2026-02-12 - optional non-blocking Onay warmup to reduce first request latency
// FILE: server/index.ts
const warmupOnayClient = () => {
  if (!onayWarmupOnBoot) return;

  setTimeout(() => {
    try {
      const client = getOnayClient();
      void client
        .warmup()
        .then(() => {
          console.log("[onay] warmup completed");
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : "unknown warmup error";
          console.warn("[onay] warmup failed", message);
        });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown warmup error";
      console.warn("[onay] warmup init failed", message);
    }
  }, 250);
};

type UserRow = {
  id: number;
  login: string;
  password_hash: string;
  role: UserRole;
  device_id: string | null;
  expires_at: string | null;
  created_at: string;
};

type SessionAuthRow = {
  session_id: number;
  user_id: number;
  role: UserRole;
  device_id: string | null;
  expires_at: string | null;
  is_active: boolean;
};

type AuthenticatedRequest = Request & {
  auth?: AuthPayload;
};

const normalizeLogin = (value: unknown) => String(value || "").trim().toLowerCase();
const normalizePassword = (value: unknown) => String(value || "");
const normalizeDeviceId = (value: unknown) => String(value || "").trim();
const terminalDigitsPattern = /^\d+$/;

const parseUserId = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseExpiryInput = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const asDate = new Date(String(value));
  if (Number.isNaN(asDate.getTime())) {
    throw new Error("Invalid expires_at value");
  }
  return asDate.toISOString();
};

const toPublicUser = (row: {
  id: number;
  login: string;
  role: string;
  device_id: string | null;
  expires_at: string | null;
  created_at: string;
}) => ({
  id: row.id,
  login: row.login,
  role: row.role,
  deviceId: row.device_id,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const authCookieName = getAuthCookieName();
const authCookieMaxAgeSeconds = Number(
  process.env.AUTH_COOKIE_MAX_AGE_SECONDS || 60 * 60 * 24 * 7,
);
const authCookieSameSiteRaw = (process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
const authCookieSameSite =
  authCookieSameSiteRaw === "strict"
    ? "Strict"
    : authCookieSameSiteRaw === "none"
      ? "None"
      : "Lax";
const authCookieSecure =
  process.env.AUTH_COOKIE_SECURE === "true" ||
  authCookieSameSite === "None" ||
  process.env.NODE_ENV === "production";

const buildAuthCookie = (token: string) => {
  const parts = [
    `${authCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${authCookieMaxAgeSeconds}`,
    `SameSite=${authCookieSameSite}`,
    "HttpOnly",
  ];

  if (authCookieSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const buildClearedAuthCookie = () => {
  const parts = [
    `${authCookieName}=`,
    "Path=/",
    "Max-Age=0",
    `SameSite=${authCookieSameSite}`,
    "HttpOnly",
  ];

  if (authCookieSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const loginRateLimitWindowMs = Number(
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 60 * 1000,
);
const loginRateLimitMax = Number(process.env.LOGIN_RATE_LIMIT_MAX || 12);

const loginRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const key = req.ip || "unknown";
  const now = Date.now();
  const existing = loginAttempts.get(key);

  if (!existing || existing.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + loginRateLimitWindowMs });
    return next();
  }

  existing.count += 1;
  loginAttempts.set(key, existing);

  if (existing.count > loginRateLimitMax) {
    const retryInSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );
    res.setHeader("Retry-After", String(retryInSeconds));
    return res.status(429).json({
      success: false,
      error: "Слишком много попыток входа. Попробуйте позже.",
      retryInSeconds,
    });
  }

  return next();
};

const logAdminAction = async (params: {
  adminUserId: number;
  action: string;
  targetUserId?: number | null;
  notes?: string | null;
}) => {
  try {
    await query(
      `INSERT INTO admin_actions (admin_user_id, action, target_user_id, notes)
       VALUES ($1, $2, $3, $4)`,
      [
        params.adminUserId,
        params.action,
        params.targetUserId ?? null,
        params.notes ?? null,
      ],
    );
  } catch (error) {
    console.warn("Failed to write admin action", error);
  }
};

const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const payload = verifyAuthToken(token);

    const sessionResult = await query<SessionAuthRow>(
      `SELECT
         s.id AS session_id,
         s.user_id,
         s.is_active,
         u.role,
         u.device_id,
         u.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [payload.sessionId],
    );

    if (sessionResult.rowCount === 0) {
      return res.status(401).json({ success: false, error: "Session not found" });
    }

    const session = sessionResult.rows[0];

    if (session.user_id !== payload.userId) {
      return res.status(401).json({ success: false, error: "Invalid session" });
    }

    if (!session.is_active) {
      return res.status(401).json({ success: false, error: "Session inactive" });
    }

    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
      return res.status(410).json({ success: false, error: ACCOUNT_EXPIRED_MESSAGE });
    }

    // MODIFIED BY AI: 2026-02-12 - skip device lock check for admin sessions
    // FILE: server/index.ts
    if (session.role !== "admin" && session.device_id && session.device_id !== payload.deviceId) {
      return res.status(403).json({ success: false, error: DEVICE_IN_USE_MESSAGE });
    }

    await query(`UPDATE sessions SET last_seen = NOW() WHERE id = $1`, [payload.sessionId]);

    (req as AuthenticatedRequest).auth = {
      ...payload,
      role: session.role,
      deviceId: session.role === "admin" ? payload.deviceId : session.device_id || payload.deviceId,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  return next();
};

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));

  // MODIFIED BY AI: 2026-02-12 - switch CORS to credentials-compatible strategy for auth cookies
  // FILE: server/index.ts
  app.use((req, res, next) => {
    const origin = req.header("origin");
    const isAllowedOrigin = !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);

    if (origin && isAllowedOrigin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
    } else if (!origin) {
      res.header("Access-Control-Allow-Origin", "*");
    }

    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });

  // Guard against malformed encoded URLs (e.g., "/%VITE_ANALYTICS_ENDPOINT%/umami")
  app.use((req, res, next) => {
    try {
      decodeURIComponent(req.path);
      next();
    } catch (err) {
      console.warn("Bad request path", req.url);
      res.status(400).send("Bad request");
    }
  });

  // MODIFIED BY AI: 2026-02-13 - expand Swagger/OpenAPI docs with schemas, request bodies and bearer auth support
  // FILE: server/index.ts
  const docs = {
    openapi: "3.0.1",
    info: {
      title: "iOS Messages Generator API",
      version: "1.2.0",
      description:
        "OpenAPI docs for Onay helper endpoints and auth/admin management API.",
    },
    servers: [{ url: process.env.PUBLIC_BASE_URL || "http://localhost:3000" }],
    tags: [
      { name: "Onay", description: "Onay helper endpoints" },
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Admin", description: "Admin-only user/session management endpoints" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Paste JWT from /auth/login response data.token. For browser same-origin usage, cookie also works.",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string", example: "Invalid credentials" },
          },
        },
        UserPublic: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            login: { type: "string", example: "admin" },
            role: { type: "string", enum: ["admin", "user"], example: "admin" },
            deviceId: {
              type: "string",
              nullable: true,
              example: "0dab54e6-8a43-4a84-9acb-8e89a07cff30",
            },
            expiresAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: "2026-07-01T12:00:00.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-02-13T10:30:00.000Z",
            },
          },
          required: ["id", "login", "role", "deviceId", "expiresAt", "createdAt"],
        },
        SessionItem: {
          type: "object",
          properties: {
            id: { type: "integer", example: 23 },
            userId: { type: "integer", example: 1 },
            login: { type: "string", example: "admin" },
            role: { type: "string", enum: ["admin", "user"], example: "admin" },
            deviceId: {
              type: "string",
              example: "f5f52a09-0b74-4a9d-a75d-5f9d58bc18d6",
            },
            ip: { type: "string", nullable: true, example: "::1" },
            userAgent: { type: "string", nullable: true, example: "Mozilla/5.0 ..." },
            loginTime: {
              type: "string",
              format: "date-time",
              example: "2026-02-13T10:35:00.000Z",
            },
            lastSeen: {
              type: "string",
              format: "date-time",
              example: "2026-02-13T10:42:00.000Z",
            },
            isActive: { type: "boolean", example: true },
          },
          required: [
            "id",
            "userId",
            "login",
            "role",
            "deviceId",
            "ip",
            "userAgent",
            "loginTime",
            "lastSeen",
            "isActive",
          ],
        },
        LoginRequest: {
          type: "object",
          properties: {
            login: { type: "string", example: "admin" },
            password: { type: "string", example: "Asus2027$" },
            deviceId: {
              type: "string",
              example: "f5f52a09-0b74-4a9d-a75d-5f9d58bc18d6",
            },
          },
          required: ["login", "password", "deviceId"],
        },
      },
    },
    paths: {
      "/api/onay/qr-start": {
        post: {
          tags: ["Onay"],
          summary: "Get route and plate details by terminal code",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    terminal: {
                      type: "string",
                      pattern: "^[0-9]+$",
                      description: "Digits only terminal code",
                      example: "9909",
                    },
                  },
                  required: ["terminal"],
                },
              },
            },
          },
          responses: {
            200: {
              description: "Onay response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          route: { type: "string", nullable: true, example: "244" },
                          plate: { type: "string", nullable: true, example: "521AV05" },
                          cost: { type: "integer", nullable: true, example: 12000 },
                          terminal: { type: "string", example: "9909" },
                          pan: { type: "string", nullable: true, example: "4400********1234" },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: "Bad request" },
            500: { description: "Onay service error" },
          },
        },
      },
      "/api/onay/sign-in": {
        post: {
          tags: ["Onay"],
          summary: "Refresh Onay token bundle",
          responses: {
            200: {
              description: "Token bundle refreshed",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          token: { type: "string" },
                          shortToken: { type: "string" },
                          deviceId: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            500: { description: "Onay service error" },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login and receive JWT token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Login success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          token: { type: "string" },
                          tokenType: { type: "string", example: "Bearer" },
                          user: { $ref: "#/components/schemas/UserPublic" },
                          sessionId: { type: "integer", example: 31 },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            403: { description: "Device mismatch" },
            410: { description: "Account expired" },
            429: { description: "Rate limit exceeded" },
            500: { description: "Unexpected login error" },
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get current authenticated user",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Current user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          user: { $ref: "#/components/schemas/UserPublic" },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout current session",
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "Logged out" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/admin/users": {
        get: {
          tags: ["Admin"],
          summary: "List users",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Users list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          users: {
                            type: "array",
                            items: { $ref: "#/components/schemas/UserPublic" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
            403: { description: "Admin access required" },
          },
        },
        post: {
          tags: ["Admin"],
          summary: "Create user",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    login: { type: "string", example: "user01" },
                    password: { type: "string", example: "pass12345" },
                    role: { type: "string", enum: ["admin", "user"], example: "user" },
                    expires_at: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                      example: "2026-06-01T10:00:00.000Z",
                    },
                  },
                  required: ["login", "password"],
                },
              },
            },
          },
          responses: {
            201: {
              description: "User created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          user: { $ref: "#/components/schemas/UserPublic" },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: "Validation error" },
            409: { description: "Login already exists" },
          },
        },
      },
      "/admin/users/{id}/reset-device": {
        post: {
          tags: ["Admin"],
          summary: "Reset user device binding",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            200: { description: "Device reset" },
            404: { description: "User not found" },
          },
        },
      },
      "/admin/users/{id}": {
        delete: {
          tags: ["Admin"],
          summary: "Delete user and cascade sessions",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            200: { description: "User deleted" },
            404: { description: "User not found" },
          },
        },
      },
      "/admin/users/{id}/extend": {
        post: {
          tags: ["Admin"],
          summary: "Extend user expiry by months or set permanent",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    months: { type: "integer", example: 3 },
                    permanent: { type: "boolean", example: false },
                    expires_at: {
                      type: "string",
                      format: "date-time",
                      example: "2026-08-01T00:00:00.000Z",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "User expiry updated" },
            400: { description: "Validation error" },
            404: { description: "User not found" },
          },
        },
      },
      "/admin/sessions": {
        get: {
          tags: ["Admin"],
          summary: "List login sessions",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "active",
              in: "query",
              required: false,
              schema: { type: "boolean" },
              description: "When true, returns only active sessions",
            },
          ],
          responses: {
            200: {
              description: "Sessions list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          sessions: {
                            type: "array",
                            items: { $ref: "#/components/schemas/SessionItem" },
                          },
                          activeCount: { type: "integer", example: 7 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/admin/sessions/{id}": {
        delete: {
          tags: ["Admin"],
          summary: "Delete a session log",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            200: { description: "Session deleted" },
            400: { description: "Invalid session id or current session" },
            404: { description: "Session not found" },
          },
        },
      },
      "/admin/cleanup-expired": {
        post: {
          tags: ["Admin"],
          summary: "Cleanup expired users",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    mode: {
                      type: "string",
                      enum: ["deactivate", "delete"],
                      example: "deactivate",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Cleanup result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          mode: { type: "string", example: "deactivate" },
                          expiredUsers: { type: "integer", example: 2 },
                          affectedSessions: { type: "integer", example: 5 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as const;

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(docs));
  app.get("/docs.json", (_req, res) => res.json(docs));

  // MODIFIED BY AI: 2026-02-12 - add auth/login, auth/me and auth/logout routes
  // FILE: server/index.ts
  app.post("/auth/login", loginRateLimit, async (req, res) => {
    const login = normalizeLogin(req.body?.login);
    const password = normalizePassword(req.body?.password);
    const deviceId = normalizeDeviceId(req.body?.deviceId);

    if (!login || !password || !deviceId) {
      return res.status(400).json({
        success: false,
        error: "Fields login, password and deviceId are required",
      });
    }

    try {
      const userResult = await query<UserRow>(
        `SELECT id, login, password_hash, role, device_id, expires_at, created_at
         FROM users
         WHERE login = $1`,
        [login],
      );

      if (userResult.rowCount === 0) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      let user = userResult.rows[0];

      const isPasswordValid = await verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      const decision = evaluateDeviceAccess({
        userDeviceId: user.device_id,
        requestDeviceId: deviceId,
        expiresAt: user.expires_at,
        // MODIFIED BY AI: 2026-02-12 - pass role to allow admin multi-device login
        // FILE: server/index.ts
        role: user.role,
      });

      if (!decision.ok) {
        return res.status(decision.status).json({ success: false, error: decision.message });
      }

      if (decision.shouldBindDevice) {
        const bindResult = await query<UserRow>(
          `UPDATE users
           SET device_id = $1
           WHERE id = $2 AND device_id IS NULL
           RETURNING id, login, password_hash, role, device_id, expires_at, created_at`,
          [deviceId, user.id],
        );

        const bindCount = bindResult.rowCount ?? 0;
        if (bindCount > 0) {
          user = bindResult.rows[0];
        } else {
          const refreshed = await query<UserRow>(
            `SELECT id, login, password_hash, role, device_id, expires_at, created_at
             FROM users
             WHERE id = $1`,
            [user.id],
          );

          if (refreshed.rowCount === 0) {
            return res.status(401).json({ success: false, error: "User not found" });
          }

          user = refreshed.rows[0];

          if (user.device_id !== deviceId) {
            return res.status(403).json({ success: false, error: DEVICE_IN_USE_MESSAGE });
          }
        }
      }

      const sessionResult = await query<{ id: number }>(
        `INSERT INTO sessions (user_id, device_id, ip, user_agent, login_time, last_seen, is_active)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), TRUE)
         RETURNING id`,
        [user.id, deviceId, req.ip || null, req.get("user-agent") || null],
      );

      const sessionId = sessionResult.rows[0].id;
      const token = signAuthToken({
        userId: user.id,
        role: user.role,
        deviceId,
        sessionId,
      });

      loginAttempts.delete(req.ip || "unknown");

      res.setHeader("Set-Cookie", buildAuthCookie(token));

      return res.json({
        success: true,
        data: {
          token,
          tokenType: "Bearer",
          user: toPublicUser(user),
          sessionId,
        },
      });
    } catch (error) {
      console.error("/auth/login failed", error);
      return res.status(500).json({ success: false, error: "Login failed" });
    }
  });

  app.get("/auth/me", requireAuth, async (req, res) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      if (!auth) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const userResult = await query<Omit<UserRow, "password_hash">>(
        `SELECT id, login, role, device_id, expires_at, created_at
         FROM users
         WHERE id = $1`,
        [auth.userId],
      );

      if (userResult.rowCount === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      return res.json({ success: true, data: { user: toPublicUser(userResult.rows[0]) } });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Failed to load user" });
    }
  });

  app.post("/auth/logout", requireAuth, async (req, res) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      if (auth) {
        await query(
          `UPDATE sessions
           SET is_active = FALSE,
               last_seen = NOW()
           WHERE id = $1`,
          [auth.sessionId],
        );
      }

      res.setHeader("Set-Cookie", buildClearedAuthCookie());
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Logout failed" });
    }
  });

  // MODIFIED BY AI: 2026-02-12 - add admin API for users, sessions and expiry management
  // FILE: server/index.ts
  app.post("/admin/users", requireAuth, requireAdmin, async (req, res) => {
    const login = normalizeLogin(req.body?.login);
    const password = normalizePassword(req.body?.password);
    const role = req.body?.role === "admin" ? "admin" : "user";

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: "Fields login and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    let expiresAt: string | null | undefined;

    try {
      expiresAt = parseExpiryInput(req.body?.expires_at ?? req.body?.expiresAt);
    } catch (error) {
      return res.status(400).json({ success: false, error: "Invalid expires_at" });
    }

    try {
      const passwordHash = await hashPassword(password);

      const created = await query<Omit<UserRow, "password_hash">>(
        `INSERT INTO users (login, password_hash, role, device_id, expires_at)
         VALUES ($1, $2, $3, NULL, $4)
         RETURNING id, login, role, device_id, expires_at, created_at`,
        [login, passwordHash, role, expiresAt ?? null],
      );

      const auth = (req as AuthenticatedRequest).auth;
      if (auth) {
        await logAdminAction({
          adminUserId: auth.userId,
          action: "create_user",
          targetUserId: created.rows[0]?.id,
          notes: `role=${role}`,
        });
      }

      return res.status(201).json({
        success: true,
        data: { user: toPublicUser(created.rows[0]) },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        return res.status(409).json({ success: false, error: "Login already exists" });
      }

      return res.status(500).json({ success: false, error: "Failed to create user" });
    }
  });

  app.get("/admin/users", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const users = await query<
        Omit<UserRow, "password_hash">
      >(`SELECT id, login, role, device_id, expires_at, created_at
         FROM users
         ORDER BY created_at DESC`);

      return res.json({
        success: true,
        data: { users: users.rows.map((user) => toPublicUser(user)) },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Failed to load users" });
    }
  });

  app.post(
    "/admin/users/:id/reset-device",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const userId = parseUserId(req.params.id);
      if (!userId) {
        return res.status(400).json({ success: false, error: "Invalid user id" });
      }

      try {
        const updated = await query<Omit<UserRow, "password_hash">>(
          `UPDATE users
           SET device_id = NULL
           WHERE id = $1
           RETURNING id, login, role, device_id, expires_at, created_at`,
          [userId],
        );

        if (updated.rowCount === 0) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        await query(
          `UPDATE sessions
           SET is_active = FALSE,
               last_seen = NOW()
           WHERE user_id = $1 AND is_active = TRUE`,
          [userId],
        );

        const auth = (req as AuthenticatedRequest).auth;
        if (auth) {
          await logAdminAction({
            adminUserId: auth.userId,
            action: "reset_device",
            targetUserId: userId,
          });
        }

        return res.json({
          success: true,
          data: { user: toPublicUser(updated.rows[0]) },
        });
      } catch (error) {
        return res.status(500).json({ success: false, error: "Failed to reset device" });
      }
    },
  );

  app.delete("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, error: "Invalid user id" });
    }

    try {
      const deleted = await query<{ id: number }>(
        `DELETE FROM users
         WHERE id = $1
         RETURNING id`,
        [userId],
      );

      if (deleted.rowCount === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const auth = (req as AuthenticatedRequest).auth;
      if (auth) {
        await logAdminAction({
          adminUserId: auth.userId,
          action: "delete_user",
          targetUserId: userId,
        });
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Failed to delete user" });
    }
  });

  app.post("/admin/users/:id/extend", requireAuth, requireAdmin, async (req, res) => {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, error: "Invalid user id" });
    }

    const permanent = req.body?.permanent === true;

    try {
      let updated;

      if (permanent) {
        updated = await query<Omit<UserRow, "password_hash">>(
          `UPDATE users
           SET expires_at = NULL
           WHERE id = $1
           RETURNING id, login, role, device_id, expires_at, created_at`,
          [userId],
        );
      } else if (req.body?.expires_at || req.body?.expiresAt) {
        const parsed = parseExpiryInput(req.body?.expires_at ?? req.body?.expiresAt);
        updated = await query<Omit<UserRow, "password_hash">>(
          `UPDATE users
           SET expires_at = $2
           WHERE id = $1
           RETURNING id, login, role, device_id, expires_at, created_at`,
          [userId, parsed],
        );
      } else {
        const months = Number.parseInt(String(req.body?.months ?? 3), 10);

        if (!Number.isInteger(months) || months <= 0 || months > 60) {
          return res.status(400).json({
            success: false,
            error: "months must be an integer in range 1..60",
          });
        }

        updated = await query<Omit<UserRow, "password_hash">>(
          `UPDATE users
           SET expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + make_interval(months => $2::int)
           WHERE id = $1
           RETURNING id, login, role, device_id, expires_at, created_at`,
          [userId, months],
        );
      }

      if (updated.rowCount === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const auth = (req as AuthenticatedRequest).auth;
      if (auth) {
        await logAdminAction({
          adminUserId: auth.userId,
          action: "extend_user",
          targetUserId: userId,
          notes: permanent ? "permanent" : `months=${req.body?.months ?? 3}`,
        });
      }

      return res.json({
        success: true,
        data: { user: toPublicUser(updated.rows[0]) },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Failed to extend user" });
    }
  });

  app.get("/admin/sessions", requireAuth, requireAdmin, async (req, res) => {
    const onlyActive = String(req.query.active || "").toLowerCase() === "true";

    try {
      const whereClause = onlyActive ? "WHERE s.is_active = TRUE" : "";
      const sessions = await query<{
        id: number;
        userId: number;
        login: string;
        role: string;
        deviceId: string;
        ip: string | null;
        userAgent: string | null;
        loginTime: string;
        lastSeen: string;
        isActive: boolean;
      }>(
        `SELECT
           s.id,
           s.user_id AS "userId",
           u.login,
           u.role,
           s.device_id AS "deviceId",
           s.ip,
           s.user_agent AS "userAgent",
           s.login_time AS "loginTime",
           s.last_seen AS "lastSeen",
           s.is_active AS "isActive"
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         ${whereClause}
         ORDER BY s.login_time DESC
         LIMIT 500`,
      );

      const totals = await query<{ active: string }>(
        `SELECT COUNT(*)::text AS active
         FROM sessions
         WHERE is_active = TRUE`,
      );

      return res.json({
        success: true,
        data: {
          sessions: sessions.rows,
          activeCount: Number(totals.rows[0]?.active || "0"),
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Failed to load sessions" });
    }
  });

  // MODIFIED BY AI: 2026-02-12 - add admin endpoint to delete noisy session logs directly from panel
  // FILE: server/index.ts
  app.delete("/admin/sessions/:id", requireAuth, requireAdmin, async (req, res) => {
    const sessionId = parseUserId(req.params.id);
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "Invalid session id" });
    }

    const auth = (req as AuthenticatedRequest).auth;
    if (auth && auth.sessionId === sessionId) {
      return res.status(400).json({
        success: false,
        error: "Current session cannot be deleted",
      });
    }

    try {
      const deleted = await query<{ id: number; user_id: number }>(
        `DELETE FROM sessions
         WHERE id = $1
         RETURNING id, user_id`,
        [sessionId],
      );

      if (deleted.rowCount === 0) {
        return res.status(404).json({ success: false, error: "Session not found" });
      }

      if (auth) {
        await logAdminAction({
          adminUserId: auth.userId,
          action: "delete_session",
          targetUserId: deleted.rows[0].user_id,
          notes: `session_id=${sessionId}`,
        });
      }

      return res.json({
        success: true,
        data: { sessionId },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Failed to delete session" });
    }
  });

  app.post("/admin/cleanup-expired", requireAuth, requireAdmin, async (req, res) => {
    const rawMode = String(req.body?.mode || "deactivate").toLowerCase();
    const mode: CleanupMode = rawMode === "delete" ? "delete" : "deactivate";

    try {
      const result = await cleanupExpiredUsers(mode);

      const auth = (req as AuthenticatedRequest).auth;
      if (auth) {
        await logAdminAction({
          adminUserId: auth.userId,
          action: "cleanup_expired",
          notes: `mode=${mode}; expiredUsers=${result.expiredUsers}`,
        });
      }

      return res.json({ success: true, data: result });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Cleanup failed" });
    }
  });

  app.post("/api/onay/qr-start", async (req, res) => {
    const terminal = String(req.body?.terminal || "").trim();
    const startedAt = Date.now();

    if (!terminal) {
      return res
        .status(400)
        .json({ success: false, message: "terminal is required" });
    }
    // MODIFIED BY AI: 2026-02-12 - enforce digits-only terminal input for qr-start requests
    // FILE: server/index.ts
    if (!terminalDigitsPattern.test(terminal)) {
      return res
        .status(400)
        .json({ success: false, message: "terminal must contain digits only" });
    }

    try {
      const client = getOnayClient();
      const trip = await client.qrStart(terminal);
      res.setHeader("X-Onay-Latency-Ms", String(Date.now() - startedAt));

      return res.json({
        success: true,
        data: {
          route: trip.route || null,
          plate: trip.plate || null,
          cost: trip.cost ?? null,
          terminal: trip.terminalCode || terminal,
          pan: trip.pan || null,
        },
      });
    } catch (error) {
      const status = 500;
      const message =
        error instanceof Error ? error.message : "Unexpected Onay error";
      console.error("/api/onay/qr-start failed", message);
      res.setHeader("X-Onay-Latency-Ms", String(Date.now() - startedAt));
      return res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/onay/sign-in", async (_req, res) => {
    try {
      const client = getOnayClient();
      const tokens = await client.signIn(true);

      return res.json({
        success: true,
        data: {
          token: tokens.token,
          shortToken: tokens.shortToken,
          deviceId: tokens.deviceId,
        },
      });
    } catch (error) {
      const status = 500;
      const message =
        error instanceof Error ? error.message : "Unexpected Onay error";
      console.error("/api/onay/sign-in failed", message);
      return res.status(status).json({ success: false, message });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  warmupOnayClient();

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
