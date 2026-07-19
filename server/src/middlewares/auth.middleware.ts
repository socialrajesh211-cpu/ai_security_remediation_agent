import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { resolveDemoSession, isDemoToken } from "../services/demoSession.service";
import { DemoUserDocument } from "../models/DemoUser.model";
import { DemoSessionDocument } from "../models/DemoSession.model";

/**
 * Common identity abstraction across both auth flows. Populated by
 * `requireGithubToken` (below) regardless of which flow the caller went
 * through, so downstream code (analytics, future per-identity rate
 * limiting, AI usage tracking) can depend on one shape instead of branching
 * on `req.demoUser` vs `req.githubToken` itself.
 */
export interface RequestIdentity {
  type: "github" | "demo";
  id: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * The token used to authenticate to GitHub's API for this request.
       * For a real GitHub session this is the caller's own OAuth token; for
       * a demo session it's the shared `DEMO_GITHUB_TOKEN`, injected
       * server-side — the browser never sees it either way. Controllers and
       * services should keep using this and generally don't need to know
       * which flow produced it.
       */
      githubToken?: string;
      /** Set only when this request authenticated via a demo (Google) session. */
      demoUser?: DemoUserDocument;
      demoSession?: DemoSessionDocument;
      identity?: RequestIdentity;
    }
  }
}

/**
 * Extracts the caller's raw bearer token from `Authorization: Bearer <token>`.
 * This may be a real GitHub token OR an opaque demo token — callers that
 * care about the difference should use `requireGithubToken` instead, which
 * resolves it fully.
 *
 * The `GITHUB_TOKEN` env var is only ever used as a fallback in non-production
 * environments — it exists purely so a developer can hit the API locally
 * without wiring up the full OAuth flow. Falling back to it in production
 * would mean every unauthenticated request silently acts as that PAT's
 * identity, which is not something this app does.
 */
export function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  if (!env.isProduction && env.github.token) return env.github.token;
  return null;
}

/**
 * Route guard for anything that needs a GitHub identity — real or demo.
 *
 * If the bearer token is a demo token, resolves the DemoSession, attaches
 * `req.demoUser` / `req.demoSession` / `req.identity`, and sets
 * `req.githubToken` to the shared `DEMO_GITHUB_TOKEN` (never the browser's
 * own value, since a demo token never IS a GitHub token). Otherwise falls
 * through to the existing GitHub bearer-token behavior unchanged.
 *
 * Either way, downstream controllers keep reading `req.githubToken` exactly
 * as before — this is what lets the rest of the app stay untouched.
 */
export async function requireGithubToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: "Missing or invalid GitHub token",
        code: "UNAUTHENTICATED",
        reason: "This request requires a valid GitHub session. Please sign in again.",
      });
    }

    if (isDemoToken(token)) {
      const resolved = await resolveDemoSession(token);
      if (!resolved) {
        return res.status(401).json({
          error: "Invalid or expired demo session",
          code: "DEMO_SESSION_EXPIRED",
          reason: "Your demo session has expired. Please start a new demo.",
        });
      }
      if (!env.demo.githubToken) {
        return res.status(503).json({
          error: "Demo Mode is not configured",
          code: "DEMO_MODE_NOT_CONFIGURED",
          reason: "DEMO_GITHUB_TOKEN is not set on the server.",
        });
      }
      req.demoUser = resolved.demoUser;
      req.demoSession = resolved.session;
      req.identity = { type: "demo", id: String(resolved.demoUser._id) };
      req.githubToken = env.demo.githubToken;
      return next();
    }

    req.githubToken = token;
    // Real GitHub identity is resolved lazily elsewhere (getAuthenticatedUser)
    // rather than on every request — the token itself is a stand-in id here,
    // sufficient for now since nothing yet keys off req.identity.id for GitHub.
    req.identity = { type: "github", id: token.slice(0, 12) };
    next();
  } catch (err) {
    next(err);
  }
}
