import { Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { exchangeGoogleCode, getGoogleProfile } from "../services/googleAuth.service";
import { upsertDemoUser, createDemoSession, isDemoModeConfigured } from "../services/demoSession.service";

/**
 * Step 1: redirect the browser to Google's OAuth consent screen.
 * Deliberately separate from GitHub login (controllers/github.controller.ts) —
 * this is a second, parallel entry point, not a replacement.
 */
export function login(_req: Request, res: Response) {
  if (!env.google.clientId || !env.google.callbackUrl) {
    throw new AppError({
      message: "Demo Mode is not configured",
      statusCode: 503,
      code: "DEMO_GOOGLE_OAUTH_NOT_CONFIGURED",
      reason: "GOOGLE_CLIENT_ID / GOOGLE_CALLBACK_URL are not set on the server.",
      adminActionRequired: true,
    });
  }
  if (!isDemoModeConfigured()) {
    throw new AppError({
      message: "Demo Mode is not configured",
      statusCode: 503,
      code: "DEMO_MODE_NOT_CONFIGURED",
      reason: "DEMO_GITHUB_TOKEN / DEMO_REPO_OWNER / DEMO_REPO_NAME are not fully set on the server.",
      adminActionRequired: true,
    });
  }

  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.callbackUrl,
    response_type: "code",
    // Only ever request profile + email — never anything broader.
    scope: "openid email profile",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/**
 * Step 2: Google redirects back here with ?code=. Exchange it, upsert the
 * DemoUser, create a DemoSession, and hand the browser an *opaque* demo
 * token — never a GitHub credential — via the same URL-fragment convention
 * the GitHub flow uses, so the frontend's existing token-pickup code in
 * AuthContext works unchanged for both flows.
 */
export async function callback(req: Request, res: Response) {
  const { code } = req.query;
  const clientOrigin = env.clientOrigin;

  if (typeof code !== "string" || !code) {
    return res.redirect(`${clientOrigin}/?error=demo_oauth_missing_code`);
  }

  try {
    const accessToken = await exchangeGoogleCode({
      code,
      clientId: env.google.clientId,
      clientSecret: env.google.clientSecret,
      redirectUri: env.google.callbackUrl,
    });

    const profile = await getGoogleProfile(accessToken);
    const demoUser = await upsertDemoUser(profile);
    const session = await createDemoSession(demoUser._id);

    res.redirect(`${clientOrigin}/dashboard#token=${session.token}`);
  } catch (err) {
    logger.error("Demo (Google) OAuth callback failed", { error: String(err) });
    res.redirect(`${clientOrigin}/?error=demo_oauth_failed`);
  }
}
