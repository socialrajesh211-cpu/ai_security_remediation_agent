import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { isAppError } from "../utils/errors";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Central error handler — every route either throws/rejects with an `AppError`
 * (via asyncHandler) or falls through to the generic 500 below. This is what
 * gives the client a consistent `{ error, code, reason, adminActionRequired }`
 * shape to build a proper message from, instead of a flat "X failed" string.
 *
 * Must be registered LAST, after all routes, per Express's error-middleware rules.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.id;

  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, requestId, details: err.details });
    } else {
      logger.warn(err.message, { code: err.code, requestId });
    }
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      reason: err.reason,
      adminActionRequired: err.adminActionRequired,
      requestId,
      // Internal detail (raw exception text) is only useful for debugging and
      // may contain infrastructure/dependency internals — keep it out of
      // production responses.
      ...(err.details && !env.isProduction ? { details: err.details } : {}),
    });
  }

  // Malformed JSON body — express.json() throws a SyntaxError with a `status`/`statusCode` of 400.
  if (err instanceof SyntaxError && "status" in err && (err as any).status === 400 && "body" in err) {
    return res.status(400).json({
      error: "Malformed JSON in request body",
      code: "INVALID_JSON",
      reason: "The request body could not be parsed as JSON.",
      adminActionRequired: false,
      requestId,
    });
  }

  // Payload too large — raised by express.json({ limit }) when the body exceeds the configured cap.
  if (err && typeof err === "object" && (err as any).type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body too large",
      code: "PAYLOAD_TOO_LARGE",
      reason: "The request body exceeds the server's size limit.",
      adminActionRequired: false,
      requestId,
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: "Invalid data",
      code: "DB_VALIDATION_ERROR",
      reason: Object.values(err.errors)
        .map((e) => e.message)
        .join("; "),
      adminActionRequired: false,
      requestId,
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: "Invalid identifier",
      code: "DB_CAST_ERROR",
      reason: "One of the values in the request couldn't be interpreted correctly.",
      adminActionRequired: false,
      requestId,
    });
  }

  // MongoDB duplicate key error.
  if (err && typeof err === "object" && (err as any).code === 11000) {
    return res.status(409).json({
      error: "Conflict",
      code: "DB_DUPLICATE_KEY",
      reason: "A record with this identifier already exists.",
      adminActionRequired: false,
      requestId,
    });
  }

  logger.error("Unhandled error", { error: String(err), stack: err instanceof Error ? err.stack : undefined, requestId });
  res.status(500).json({
    error: "Something went wrong",
    code: "INTERNAL_ERROR",
    reason: "An unexpected server error occurred.",
    adminActionRequired: true,
    requestId,
  });
}
