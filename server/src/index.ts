import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import { env } from "./config/env";
import { connectDB, disconnectDB, isDbConnected } from "./config/db";
import apiRoutes from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
import { generalLimiter } from "./middlewares/rateLimit.middleware";
import { logger } from "./utils/logger";

const app = express();

// Behind a reverse proxy (Render, Heroku, nginx, etc.) so `req.ip` and
// `X-Forwarded-*` are trusted correctly — required for rate limiting and
// logging to see the real client IP instead of the proxy's.
if (env.trustProxy) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet());

const allowedOrigins = [env.clientOrigin, ...env.extraCorsOrigins];
app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and anything
      // explicitly configured via CLIENT_ORIGIN / EXTRA_CORS_ORIGINS.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(requestIdMiddleware);

app.use(
  morgan(env.isProduction ? "combined" : "dev", {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: (req) => req.path === "/api/health",
  })
);

app.get("/api/health", (_req, res) => {
  const dbConnected = isDbConnected();
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "degraded",
    service: "ai-security-remediation-agent-server",
    uptimeSeconds: Math.round(process.uptime()),
    db: dbConnected ? "connected" : "disconnected",
  });
});

app.use("/api", generalLimiter, apiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND", path: req.path });
});

// Must be registered last — Express recognizes it as error-handling middleware
// by its 4-argument signature.
app.use(errorMiddleware);

const server = http.createServer(app);

// Prevent slow/idle clients from holding sockets open indefinitely.
server.requestTimeout = 60_000;
server.headersTimeout = 65_000; // must exceed requestTimeout per Node's docs
server.keepAliveTimeout = 61_000;

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async (err) => {
    if (err) logger.error("Error while closing HTTP server", { error: String(err) });
    try {
      await disconnectDB();
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(err ? 1 : 0);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { error: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception — exiting", { error: String(err), stack: err.stack });
  // An uncaught exception leaves the process in an unknown state; exit and
  // let the process manager (Docker/PM2/systemd) restart it cleanly rather
  // than limping along.
  process.exit(1);
});

async function start() {
  await connectDB();
  server.listen(env.port, () => {
    logger.info(`🔐 AI Security Remediation Agent server listening on http://localhost:${env.port}`, {
      env: env.nodeEnv,
    });
  });
}

start().catch((err) => {
  logger.error("Failed to start server", { error: String(err) });
  process.exit(1);
});
