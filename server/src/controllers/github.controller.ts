import { Request, Response } from "express";
import axios from "axios";
import {
  listRepositories,
  listCodeScanningAlerts,
  listDependabotAlerts,
  getAuthenticatedUser,
  normalizeCodeScanningAlerts,
  normalizeDependabotAlerts,
  getDependabotStatus,
  getCodeScanningStatus,
  enableDependabot,
  enableCodeScanningDefaultSetup,
  getFileSnippet,
} from "../services/github.service";
import { User } from "../models/User.model";
import { FindingModel } from "../models/Finding.model";
import { PreferenceModel } from "../models/Preference.model";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { encryptSecret } from "../utils/crypto";
import { extractToken } from "../middlewares/auth.middleware";
import { isDemoToken, resolveDemoSession } from "../services/demoSession.service";
import { logger } from "../utils/logger";

/**
 * `owner`/`repo` come straight from the URL and are forwarded into GitHub API
 * paths — validate them against GitHub's actual naming rules so malformed or
 * hostile input (path traversal attempts, absurdly long segments, etc.) is
 * rejected before it reaches an outbound request.
 */
const GITHUB_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function assertValidRepoParams(owner: string, repo: string): void {
  if (!GITHUB_NAME_RE.test(owner) || !GITHUB_NAME_RE.test(repo)) {
    throw new AppError({
      message: "Invalid repository reference",
      statusCode: 400,
      code: "INVALID_REPO_PARAMS",
      reason: "The repository owner/name in the URL isn't a valid GitHub identifier.",
    });
  }
}

/** @deprecated use `req.githubToken` (populated by `requireGithubToken`) or `extractToken(req)` directly. */
export function getToken(req: Request): string | null {
  return extractToken(req);
}

/**
 * Upserts the local User record for a verified GitHub profile. The access
 * token is encrypted at rest (see utils/crypto.ts) — it's kept only as an
 * audit trail of who has authenticated, never read back to make API calls
 * (every request supplies its own Bearer token).
 */
async function upsertUser(profile: Awaited<ReturnType<typeof getAuthenticatedUser>>, accessToken: string) {
  await User.findOneAndUpdate(
    { githubId: profile.id },
    {
      githubId: profile.id,
      username: profile.username,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      accessToken: encryptSecret(accessToken),
      lastLoginAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

/**
 * Step 1: redirect the browser to GitHub's OAuth consent screen.
 * This is the ONLY way into the app — there is no local/anonymous access.
 */
export function login(_req: Request, res: Response) {
  if (!env.github.clientId || !env.github.callbackUrl) {
    throw new AppError({
      message: "GitHub OAuth is not configured",
      statusCode: 503,
      code: "GITHUB_OAUTH_NOT_CONFIGURED",
      reason: "GITHUB_CLIENT_ID / GITHUB_CALLBACK_URL are not set on the server.",
      adminActionRequired: true,
    });
  }
  const params = new URLSearchParams({
    client_id: env.github.clientId,
    redirect_uri: env.github.callbackUrl,
    scope: "repo read:user security_events",
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

/**
 * Step 2: GitHub redirects back here with a ?code=, exchange it for an access token,
 * verify the user, and persist/update their record in MongoDB.
 */
export async function callback(req: Request, res: Response) {
  const { code } = req.query;
  const clientOrigin = env.clientOrigin;

  if (typeof code !== "string" || !code) {
    return res.redirect(`${clientOrigin}/?error=github_oauth_missing_code`);
  }

  try {
    const { data } = await axios.post(
      "https://github.com/login/oauth/access_token",
      { client_id: env.github.clientId, client_secret: env.github.clientSecret, code },
      { headers: { Accept: "application/json" }, timeout: 10_000 }
    );

    const accessToken = data.access_token;
    if (!accessToken) {
      logger.warn("GitHub OAuth callback did not return an access token", { detail: data.error });
      return res.redirect(`${clientOrigin}/?error=github_oauth_failed`);
    }

    const profile = await getAuthenticatedUser(accessToken);
    await upsertUser(profile, accessToken);

    // Hand the token back to the client via URL fragment (never sent to the server in logs).
    // The client stores it and uses it as a Bearer token for all subsequent API calls.
    res.redirect(`${clientOrigin}/dashboard#token=${accessToken}`);
  } catch (err) {
    logger.error("GitHub OAuth callback failed", { error: String(err) });
    res.redirect(`${clientOrigin}/?error=github_oauth_failed`);
  }
}

/**
 * Verifies the current Bearer token and returns a profile — either a real
 * GitHub profile, or (if the token is a demo token) the signed-in demo
 * user's profile. The frontend calls this on load to decide: show Landing
 * (logged out) or Dashboard (logged in); it doesn't need to know in advance
 * which flow the token came from.
 */
export async function me(req: Request, res: Response) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated", code: "UNAUTHENTICATED" });

  if (isDemoToken(token)) {
    const resolved = await resolveDemoSession(token);
    if (!resolved) {
      return res.status(401).json({ error: "Invalid or expired demo session", code: "SESSION_EXPIRED" });
    }
    const { demoUser } = resolved;
    return res.json({
      user: {
        id: demoUser.googleId,
        username: demoUser.name || demoUser.email,
        name: demoUser.name,
        avatarUrl: demoUser.avatarUrl,
      },
      isDemo: true,
      demoRepo: `${env.demo.repoOwner}/${env.demo.repoName}`,
    });
  }

  try {
    const profile = await getAuthenticatedUser(token);
    await upsertUser(profile, token);
    res.json({ user: profile, isDemo: false });
  } catch {
    res.status(401).json({ error: "Invalid or expired GitHub session", code: "SESSION_EXPIRED" });
  }
}

/** List the authenticated user's repositories. Expects `Authorization: Bearer <github_token>`. */
export async function repos(req: Request, res: Response) {
  const token = req.githubToken!;

  // Demo sessions authenticate to GitHub as the shared DEMO_GITHUB_TOKEN
  // owner, but must only ever see the one repo the demo is scoped to — not
  // that account's real repo list.
  if (req.demoUser) {
    return res.json({
      repos: [
        {
          id: 0,
          name: env.demo.repoName,
          fullName: `${env.demo.repoOwner}/${env.demo.repoName}`,
          private: false,
          defaultBranch: "main",
          updatedAt: new Date().toISOString(),
          description: "Shared demo repository",
          language: undefined,
          htmlUrl: `https://github.com/${env.demo.repoOwner}/${env.demo.repoName}`,
        },
      ],
    });
  }

  try {
    const list = await listRepositories(token);
    res.json({ repos: list });
  } catch (err) {
    throw new AppError({
      message: "Failed to list repositories",
      statusCode: 502,
      code: "GITHUB_LIST_REPOS_FAILED",
      reason: "GitHub didn't return the repository list — the token may be invalid or expired.",
      details: `${err}`,
    });
  }
}

/**
 * Runs the remediation agent's discovery step against a repo: pulls CodeQL code-scanning
 * alerts + Dependabot alerts straight from GitHub, normalizes them into Findings, and
 * persists them in MongoDB so the dashboard and finding workflow can read them back.
 */
export async function scan(req: Request, res: Response) {
  const token = req.githubToken!;
  const { owner, repo } = req.params;
  assertValidRepoParams(owner, repo);
  const repoFullName = `${owner}/${repo}`;

  try {
    const [codeScanning, dependabot] = await Promise.allSettled([
      listCodeScanningAlerts(token, owner, repo),
      listDependabotAlerts(token, owner, repo),
    ]);

    const codeScanningFindings =
      codeScanning.status === "fulfilled"
        ? normalizeCodeScanningAlerts(codeScanning.value as any[], repoFullName)
        : [];
    const dependabotFindings =
      dependabot.status === "fulfilled"
        ? normalizeDependabotAlerts(dependabot.value as any[], repoFullName)
        : [];

    if (codeScanning.status === "rejected") {
      logger.warn("Code scanning alerts fetch failed", { repo: repoFullName, error: String(codeScanning.reason) });
    }
    if (dependabot.status === "rejected") {
      logger.warn("Dependabot alerts fetch failed", { repo: repoFullName, error: String(dependabot.reason) });
    }

    // Code-scanning alerts don't include source code inline — fetch a small,
    // line-numbered snippet straight from the repo so finding details has real
    // code to show instead of "no snippet captured". Best-effort and capped so
    // a slow/huge repo can't stall the scan.
    await Promise.all(
      codeScanningFindings.slice(0, 40).map(async (f) => {
        f.codeSnippet = await getFileSnippet(token, owner, repo, f.file, f.startLine, f.endLine);
      })
    );

    const findings = [...codeScanningFindings, ...dependabotFindings];

    // Replace this repo's stored findings with the fresh scan result. Runs as a
    // single ordered sequence rather than a transaction (standalone MongoDB
    // deployments don't support multi-document transactions) — an interrupted
    // scan simply leaves the previous findings in place until the next retry.
    await FindingModel.deleteMany({ repoFullName });
    if (findings.length > 0) {
      await FindingModel.insertMany(
        findings.map((f) => ({ ...f, findingId: f.id, repoFullName })),
        { ordered: false }
      );
    }

    res.json({
      repo: repoFullName,
      count: findings.length,
      findings,
      warnings: [
        codeScanning.status === "rejected"
          ? "Code scanning is not enabled (or the token lacks security_events scope) for this repository."
          : null,
        dependabot.status === "rejected"
          ? "Dependabot alerts are not enabled (or unavailable) for this repository."
          : null,
      ].filter(Boolean),
    });
  } catch (err) {
    throw new AppError({
      message: "Scan failed",
      statusCode: 502,
      code: "GITHUB_SCAN_FAILED",
      reason: "The agent couldn't finish scanning this repository.",
      details: `${err}`,
    });
  }
}

/**
 * Reports whether Dependabot alerts and code scanning are enabled for a repo,
 * so the dashboard can show "Enabled / Disabled / In progress / Restricted"
 * instead of just silently failing to find findings.
 */
export async function securityStatus(req: Request, res: Response) {
  const token = req.githubToken!;
  const { owner, repo } = req.params;
  assertValidRepoParams(owner, repo);

  try {
    const [dependabot, codeScanning] = await Promise.all([
      getDependabotStatus(token, owner, repo),
      getCodeScanningStatus(token, owner, repo),
    ]);
    res.json({ dependabot, codeScanning });
  } catch (err) {
    throw new AppError({
      message: "Failed to read security status",
      statusCode: 502,
      code: "GITHUB_SECURITY_STATUS_FAILED",
      reason: "GitHub didn't return the repository's security feature status.",
      details: `${err}`,
    });
  }
}

/** Enables Dependabot alerts (+ security updates) for a repo using GitHub's default settings. */
export async function enableDependabotHandler(req: Request, res: Response) {
  const token = req.githubToken!;
  const { owner, repo } = req.params;
  assertValidRepoParams(owner, repo);

  try {
    await enableDependabot(token, owner, repo);
    const status = await getDependabotStatus(token, owner, repo);
    res.json({ dependabot: status });
  } catch (err: any) {
    const statusCode = err?.status ?? err?.response?.status;
    if (statusCode === 403 || statusCode === 404 || statusCode === 451) {
      return res.status(200).json({
        dependabot: {
          status: "restricted",
          message:
            "GitHub won't let this token enable Dependabot alerts automatically for this repository (private repo permissions or plan limits). Use the manual link instead.",
          manageUrl: `https://github.com/${owner}/${repo}/settings/security_analysis`,
        },
      });
    }
    throw new AppError({
      message: "Failed to enable Dependabot",
      statusCode: 502,
      code: "GITHUB_ENABLE_DEPENDABOT_FAILED",
      reason: "GitHub rejected the request to enable Dependabot alerts for this repository.",
      details: `${err}`,
    });
  }
}

/** Enables code scanning (CodeQL default setup) for a repo. Async on GitHub's side. */
export async function enableCodeScanningHandler(req: Request, res: Response) {
  const token = req.githubToken!;
  const { owner, repo } = req.params;
  assertValidRepoParams(owner, repo);

  try {
    await enableCodeScanningDefaultSetup(token, owner, repo);
    res.json({
      codeScanning: {
        status: "in_progress",
        message: "Code scanning was enabled — GitHub is running the first CodeQL analysis. This can take a few minutes.",
        manageUrl: `https://github.com/${owner}/${repo}/settings/security_analysis`,
      },
    });
  } catch (err: any) {
    const statusCode = err?.status ?? err?.response?.status;
    if (statusCode === 403 || statusCode === 404 || statusCode === 451) {
      return res.status(200).json({
        codeScanning: {
          status: "restricted",
          message:
            "Code scanning can't be enabled via the API for this repository (private repos need GitHub Advanced Security). Use the manual link instead.",
          manageUrl: `https://github.com/${owner}/${repo}/settings/security_analysis`,
        },
      });
    }
    throw new AppError({
      message: "Failed to enable code scanning",
      statusCode: 502,
      code: "GITHUB_ENABLE_CODE_SCANNING_FAILED",
      reason: "GitHub rejected the request to enable code scanning for this repository.",
      details: `${err}`,
    });
  }
}

/**
 * Per-user preferences (e.g. last selected repo/tab on the dashboard), persisted
 * in MongoDB so they survive across sessions and devices, not just localStorage.
 */
export async function getPreferences(req: Request, res: Response) {
  const token = req.githubToken!;

  // Demo sessions share one GitHub identity (DEMO_GITHUB_TOKEN's owner), so
  // per-GitHub-user preferences would leak across every demo visitor. Just
  // report the fixed demo repo instead of touching the Preference collection.
  if (req.demoUser) {
    return res.json({ lastSelectedRepo: `${env.demo.repoOwner}/${env.demo.repoName}` });
  }

  try {
    const profile = await getAuthenticatedUser(token);
    const pref = await PreferenceModel.findOne({ githubId: profile.id }).lean();
    res.json({ lastSelectedRepo: pref?.lastSelectedRepo ?? null });
  } catch (err) {
    throw new AppError({
      message: "Failed to load preferences",
      statusCode: 502,
      code: "PREFERENCES_LOAD_FAILED",
      reason: "Your saved preferences couldn't be loaded.",
      details: `${err}`,
    });
  }
}

export async function putPreferences(req: Request, res: Response) {
  const token = req.githubToken!;

  const { lastSelectedRepo } = req.body ?? {};
  if (typeof lastSelectedRepo !== "string" || lastSelectedRepo.length > 200) {
    return res.status(400).json({
      error: "lastSelectedRepo (string, max 200 chars) is required",
      code: "VALIDATION_ERROR",
    });
  }

  if (req.demoUser) {
    return res.json({ lastSelectedRepo: `${env.demo.repoOwner}/${env.demo.repoName}` });
  }

  try {
    const profile = await getAuthenticatedUser(token);
    await PreferenceModel.findOneAndUpdate(
      { githubId: profile.id },
      { githubId: profile.id, lastSelectedRepo, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ lastSelectedRepo });
  } catch (err) {
    throw new AppError({
      message: "Failed to save preferences",
      statusCode: 502,
      code: "PREFERENCES_SAVE_FAILED",
      reason: "Your preference couldn't be saved.",
      details: `${err}`,
    });
  }
}
