import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;

  mongoose.set("strictQuery", true);

  // Fail fast instead of buffering commands indefinitely against a database
  // that never connects — a hung connection should surface as a clear error,
  // not as requests that silently never resolve.
  mongoose.set("bufferCommands", false);

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error", { error: String(err) });
  });
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });

  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
  });
  connected = true;

  logger.info("MongoDB connected", { uri: maskUri(env.mongodbUri) });
}

/** Closes the MongoDB connection cleanly — called from the server's graceful shutdown handler. */
export async function disconnectDB(): Promise<void> {
  if (!connected) return;
  await mongoose.connection.close();
  connected = false;
  logger.info("MongoDB connection closed");
}

/** True once `connectDB()` has resolved. Used by the /api/health endpoint. */
export function isDbConnected(): boolean {
  return connected && mongoose.connection.readyState === 1;
}

function maskUri(uri: string): string {
  // Hide credentials if present, e.g. mongodb+srv://user:pass@cluster/...
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}
