import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
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

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());

  // Allow cross-origin calls from deployed frontend (Netlify) to Render
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
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

  const docs = {
    openapi: "3.0.1",
    info: {
      title: "Onay helper API",
      version: "1.0.0",
      description:
        "Визуальный playground для /api/onay/qr-start. Секреты из .env на сервере, на клиент не попадают.",
    },
    servers: [{ url: process.env.PUBLIC_BASE_URL || "http://localhost:3000" }],
    paths: {
      "/api/onay/qr-start": {
        post: {
          summary: "Запросить маршрут/госномер/цену по коду терминала",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    terminal: { type: "string", example: "1234" },
                  },
                  required: ["terminal"],
                },
              },
            },
          },
          responses: {
            200: {
              description: "Успех",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          route: { type: "string", nullable: true },
                          plate: { type: "string", nullable: true },
                          cost: { type: "integer", nullable: true, example: 12000 },
                          terminal: { type: "string" },
                          pan: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: "Не указан terminal" },
            500: { description: "Ошибка Onay" },
          },
        },
      },
      "/api/onay/sign-in": {
        post: {
          summary: "Принудительно получить новый token/shortToken",
          responses: {
            200: {
              description: "Успех",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
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
            500: { description: "Ошибка Onay" },
          },
        },
      },
    },
  } as const;

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(docs));
  app.get("/docs.json", (_req, res) => res.json(docs));

  app.post("/api/onay/qr-start", async (req, res) => {
    const terminal = String(req.body?.terminal || "").trim();

    if (!terminal) {
      return res
        .status(400)
        .json({ success: false, message: "terminal is required" });
    }

    try {
      const client = getOnayClient();
      const trip = await client.qrStart(terminal);

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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
