import { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express handler so a thrown/rejected error is forwarded to
 * `next()` (and therefore to `middlewares/error.middleware.ts`) instead of
 * crashing the process or requiring a try/catch in every route.
 */
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
