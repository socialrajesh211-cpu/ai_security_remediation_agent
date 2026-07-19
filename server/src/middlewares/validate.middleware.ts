import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

/**
 * Validates `req.body` (or `.query` / `.params`) against a zod schema and
 * replaces it with the parsed (typed, defaulted) value on success. On
 * failure it responds 400 with the flattened zod error — callers don't
 * need to repeat this safeParse boilerplate in every route.
 */
export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: result.error.flatten(),
      });
    }
    req[source] = result.data;
    next();
  };
}
