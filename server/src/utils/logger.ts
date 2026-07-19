import { env } from "../config/env";

/**
 * Minimal leveled logger — no external dependency required.
 *
 * In production it emits single-line JSON (easy to ingest into CloudWatch /
 * Datadog / etc). In development it emits a readable, colorless one-liner.
 * Swap this module out for pino/winston later without touching call sites —
 * everything else imports `logger`, never `console`, directly.
 */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();

  if (env.isProduction) {
    const line = JSON.stringify({ timestamp, level, message, ...meta });
    if (level === "error") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
    return;
  }

  const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  const line = `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${suffix}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (!env.isProduction) emit("debug", message, meta);
  },
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
};
