import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Assigns a short request id to every incoming request (reusing an inbound
 * `X-Request-Id` if a proxy/load balancer already set one), echoes it back
 * on the response, and makes it available to the logger and error middleware
 * so a client-reported error can be traced to the exact server log lines.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"];
  req.id = (typeof incoming === "string" && incoming.trim()) || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}
