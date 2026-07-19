import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/**
 * General limiter applied to every `/api` request — a coarse ceiling against
 * abuse/scraping. Generous enough not to bother real usage.
 */
export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later.", code: "RATE_LIMITED" },
});

/**
 * Tighter limiter for `/api/ai/*` — these calls cost real money (AI provider
 * usage) and take longer, so they get a stricter, separate budget from
 * general browsing/API traffic.
 */
export const aiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.aiMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many AI requests, please slow down.",
    code: "AI_RATE_LIMITED",
  },
});

/**
 * Strict limiter for the OAuth entry points — these are unauthenticated by
 * definition, so they're the easiest target for credential-stuffing / abuse
 * bots hammering GitHub's OAuth endpoint through this server.
 */
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later.", code: "AUTH_RATE_LIMITED" },
});
